/**
 * startLeadSequence — Manually kick off a drip email sequence for a sales lead.
 *
 * Now reads sequence definitions from the `sequences` Firestore collection
 * instead of hardcoded step arrays. Accepts an optional `sequenceId`; if
 * not provided, defaults based on the lead's `leadType`.
 *
 * Prevents duplicate enrollment: if the resolved contact has already been
 * enrolled in the requested sequence (tracked via `sequenceHistory` map
 * on the contact doc), the call is rejected.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { buildScheduledDate } from "../utils/scheduleUtils";
import { sendEmail } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ─── Default sequence mapping by leadType ──────────────────────
const DEFAULT_SEQUENCE_MAP: Record<string, string> = {
    enterprise: "enterprise_lead_sequence",
    referral_partnership: "referral_partnership_sequence",
    tenant: "tenant_lead_sequence",
    direct: "tenant_lead_sequence",
};

export const startLeadSequence = onCall(async (request) => {
    const { leadId, contactId: requestedContactId, sequenceId: requestedSequenceId } = request.data;

    if (!leadId) {
        throw new HttpsError("invalid-argument", "leadId is required");
    }

    // ── Fetch the lead (try companies first, fall back to leads) ──
    let leadDoc = await db.collection("companies").doc(leadId).get();
    let leadCollection = "companies";
    if (!leadDoc.exists) {
        leadDoc = await db.collection("leads").doc(leadId).get();
        leadCollection = "leads";
    }
    if (!leadDoc.exists) {
        throw new HttpsError("not-found", `Lead/Company ${leadId} not found in companies or leads`);
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || "Unknown";
    const leadType = lead.leadType || "direct";

    // ── Guard: block enrollment of unsubscribed / lost leads ──
    if (lead.unsubscribedAt || lead.status === 'lost') {
        throw new HttpsError(
            "failed-precondition",
            `${businessName} has unsubscribed or is marked as lost — cannot enroll in a sequence.`
        );
    }

    // ── Resolve contact (contact-centric model) ───────────────
    let contactId: string | null = requestedContactId || null;
    let contactEmail = "";
    let contactName = "";

    if (contactId) {
        const contactDoc = await db.collection("contacts").doc(contactId).get();
        if (contactDoc.exists) {
            const contact = contactDoc.data()!;
            if (contact.unsubscribed) {
                throw new HttpsError(
                    "failed-precondition",
                    `Contact ${contact.firstName || ''} ${contact.lastName || ''} has unsubscribed — cannot enroll in a sequence.`.trim()
                );
            }
            contactEmail = contact.email || "";
            contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
        }
    }

    if (!contactEmail) {
        // Try primary contact lookup
        const primarySnap = await db
            .collection("contacts")
            .where("companyId", "==", leadId)
            .where("isPrimary", "==", true)
            .limit(1)
            .get();

        if (!primarySnap.empty) {
            const primaryContact = primarySnap.docs[0];
            contactId = primaryContact.id;
            const pData = primaryContact.data();
            contactEmail = pData.email || "";
            contactName = `${pData.firstName || ""} ${pData.lastName || ""}`.trim();
        }
    }

    // Backward compat: fall back to lead-level email
    if (!contactEmail) {
        contactEmail = lead.email || "";
        contactName = lead.contactName || "";
    }

    // Guard: need an email
    if (!contactEmail || contactEmail.trim().length === 0) {
        await db.collection(leadCollection).doc(leadId).update({
            outreachStatus: "NEEDS_MANUAL",
        });
        throw new HttpsError(
            "failed-precondition",
            `Lead ${businessName} has no email — manual outreach required.`
        );
    }

    // ── Resolve sequence ──────────────────────────────────────
    const sequenceId = requestedSequenceId || DEFAULT_SEQUENCE_MAP[leadType] || "tenant_lead_sequence";

    const sequenceDoc = await db.collection("sequences").doc(sequenceId).get();
    if (!sequenceDoc.exists) {
        throw new HttpsError(
            "not-found",
            `Sequence "${sequenceId}" not found. Create it in the Sequence Builder first.`
        );
    }

    const sequence = sequenceDoc.data()!;

    // ── Guard: prevent cross-audience enrollment ────────────
    // Vendor sequences should never be assigned to leads. This can happen
    // if the UI fails to filter or if the callable is invoked directly.
    const BLOCKED_CATEGORIES = ['vendor', 'vendor_email'];
    if (BLOCKED_CATEGORIES.includes(sequence.category)) {
        throw new HttpsError(
            'failed-precondition',
            `Cannot enroll a lead in vendor sequence "${sequence.name || sequenceId}". Use a lead or referral sequence instead.`
        );
    }

    const steps: { templateId: string; dayOffset: number; label: string }[] = sequence.steps || [];

    if (steps.length === 0) {
        throw new HttpsError(
            "failed-precondition",
            `Sequence "${sequence.name}" has no steps defined.`
        );
    }

    // ── Duplicate enrollment check ────────────────────────────
    if (contactId) {
        const contactDoc = await db.collection("contacts").doc(contactId).get();
        if (contactDoc.exists) {
            const contactData = contactDoc.data()!;
            const history = contactData.sequenceHistory || {};
            if (history[sequenceId]) {
                const prevStart = history[sequenceId].startedAt;
                const prevDate = prevStart?.toDate ? prevStart.toDate() : prevStart;
                throw new HttpsError(
                    "already-exists",
                    `${contactName || contactEmail} was already enrolled in "${sequence.name}" on ${prevDate ? prevDate.toLocaleDateString() : "a previous date"}. Contacts cannot be re-enrolled in the same sequence.`
                );
            }
        }
    }

    // ── Cancel any existing pending/retry tasks ───────────────
    const { cancelLeadTasks } = await import("../utils/queueUtils");
    const cancelledCount = await cancelLeadTasks(db, leadId);
    if (cancelledCount > 0) {
        logger.info(`[StartSequence] Cancelled ${cancelledCount} existing tasks for lead ${leadId}`);
    }

    logger.info(
        `[StartSequence] Starting "${sequence.name}" (${sequenceId}) for lead ${leadId} (${businessName}), contact ${contactId || "lead-level"}`
    );

    // ── Resolve sender from email_senders (default to 'sales') ─────
    let senderFrom = 'Chris Leung — XIRI <chris@xiri.ai>';
    try {
        const senderDoc = await db.collection('email_senders').doc('sales').get();
        if (senderDoc.exists) {
            const s = senderDoc.data()!;
            senderFrom = `${s.name} <${s.email}>`;
        }
    } catch { /* use default */ }

    // ── Schedule emails natively via Resend (Pro) ─────────────────
    // Templates are resolved upfront so Resend holds the final content.
    const now = new Date();
    const scheduledResendIds: string[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const sendAt = buildScheduledDate(now, step.dayOffset);

        const templateId = step.templateId;
        if (!templateId) {
            logger.warn(`[StartSequence] Step ${i} has no templateId — skipping.`);
            continue;
        }

        // Fetch and merge template
        const templateDoc = await db.collection('templates').doc(templateId).get();
        if (!templateDoc.exists) {
            logger.warn(`[StartSequence] Template ${templateId} not found — skipping step ${i}.`);
            continue;
        }
        const template = templateDoc.data()!;

        // Build merge variables
        const titleCase = (s: string) => s
            ? s.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase())
            : '';

        const mergeVars: Record<string, string> = {
            contactName: contactName || 'there',
            businessName: businessName || 'your facility',
            facilityType: titleCase(lead.facilityType || 'Medical Office'),
            address: lead.address || '',
            squareFootage: String(lead.squareFootage || ''),
        };

        // Inject facility-type personalization phrases (inline, no @xiri/shared dep)
        const FACILITY_PHRASES: Record<string, { strength: string; compliance: string }> = {
            'medical_office': { strength: 'clinical-grade disinfection', compliance: 'HIPAA & CDC-compliant protocols' },
            'dental_office':  { strength: 'infection control expertise', compliance: 'CDC sterilization guidelines' },
            'commercial':     { strength: 'commercial-scale cleaning', compliance: 'OSHA-compliant standards' },
            'warehouse':      { strength: 'industrial-grade cleaning', compliance: 'OSHA workplace safety standards' },
            'school':         { strength: 'EPA-certified disinfection', compliance: 'CDC school sanitization guidance' },
        };
        const facilityKey = (lead.facilityType || '').toLowerCase().replace(/[\s-]/g, '_');
        const phrases = FACILITY_PHRASES[facilityKey] || { strength: 'professional facility cleaning', compliance: 'industry-standard protocols' };
        for (const [key, value] of Object.entries(phrases)) {
            if (!mergeVars[key]) mergeVars[key] = value;
        }

        // Defensive aliases for any vendor-style vars accidentally in template
        const aliases: Record<string, string> = {
            vendorName: mergeVars.businessName,
            city: lead.address?.split(',')[0]?.trim() || '',
            state: '',
            services: titleCase(lead.facilityType || 'Facility Services'),
            specialty: titleCase(lead.facilityType || 'Facility Services'),
            onboardingUrl: 'https://xiri.ai/demo',
        };
        for (const [key, value] of Object.entries(aliases)) {
            if (!mergeVars[key]) mergeVars[key] = value;
        }

        let subject = template.subject || '';
        let body = template.body || '';
        for (const [key, value] of Object.entries(mergeVars)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        }
        // Clean any remaining unresolved vars
        subject = subject.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
        body = body.replace(/\{\{[a-zA-Z_]+\}\}/g, '');

        const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.7;">${body.replace(/\n/g, '<br/>')}</div>`;

        const result = await sendEmail(
            contactEmail, subject, htmlBody,
            undefined,         // attachments (positional)
            senderFrom,        // from
            leadId,            // entityId (for unsubscribe footer and leadId tag)
            templateId,        // templateId tag
            'lead',            // entityType
            { contactId: contactId || undefined, scheduledAt: sendAt },
        );

        if (result.resendId) {
            scheduledResendIds.push(result.resendId);
        }

        logger.info(`[StartSequence] Step ${i} (${step.label}) scheduled for ${sendAt.toISOString()} — Resend ID: ${result.resendId || 'none'}`);

        // Increment template stats.sent
        try {
            await db.collection('templates').doc(templateId).update({
                'stats.sent': admin.firestore.FieldValue.increment(1),
                'stats.lastUpdated': new Date(),
            });
        } catch { /* non-critical */ }
    }

    // ── Update lead/company doc ────────────────────────────────────────────
    await db.collection(leadCollection).doc(leadId).update({
        status: lead.status === "new" ? "contacted" : lead.status,
        outreachStatus: "PENDING",
        sequenceId,
        sequenceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        sequenceStartedBy: request.auth?.uid || "manual",
        // Store Resend email IDs so we can cancel scheduled emails if needed
        ...(scheduledResendIds.length > 0 ? { scheduledEmailIds: scheduledResendIds } : {}),
    });

    // ── Write sequenceHistory on contact doc ──────────────────
    if (contactId) {
        await db.collection("contacts").doc(contactId).update({
            [`sequenceHistory.${sequenceId}`]: {
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                startedBy: request.auth?.uid || "manual",
                status: "in_progress",
                sequenceName: sequence.name,
                stepCount: steps.length,
            },
        });
    }

    // ── Log activity ──────────────────────────────────────────
    const dayList = steps.map((s) => `Day ${s.dayOffset}`).join("/");
    await db.collection("lead_activities").add({
        leadId,
        contactId: contactId || null,
        type: "SEQUENCE_STARTED",
        description: `"${sequence.name}" sequence started for ${businessName} → ${contactName || contactEmail}. Schedule: ${dayList}. ${scheduledResendIds.length} emails scheduled via Resend.`,
        createdAt: new Date(),
        startedBy: request.auth?.uid || "manual",
        metadata: {
            leadType,
            sequenceId,
            sequenceName: sequence.name,
            stepCount: steps.length,
            schedule: dayList,
            contactId: contactId || null,
            scheduledResendIds,
        },
    });


    logger.info(
        `[StartSequence] "${sequence.name}" started for ${leadId}: ${steps.length} emails (${dayList})`
    );

    return {
        success: true,
        message: `"${sequence.name}" started for ${businessName}`,
        sequenceId,
        stepCount: steps.length,
        schedule: dayList,
    };
});
