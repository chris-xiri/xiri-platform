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
import { enqueueTask } from "../utils/queueUtils";
import { buildScheduledDate } from "../utils/scheduleUtils";

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

    // ── Schedule tasks from sequence steps (business days only) ──
    const now = new Date();

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // buildScheduledDate skips weekends and defaults to 10 AM ET (14:00 UTC)
        const sendAt = buildScheduledDate(now, step.dayOffset);

        await enqueueTask(db, {
            leadId,
            contactId: contactId || undefined,
            type: "SEND",
            scheduledAt: admin.firestore.Timestamp.fromDate(sendAt),
            metadata: {
                sequence: i,
                businessName,
                email: contactEmail,
                contactName,
                contactId: contactId || null,
                facilityType: lead.facilityType || "",
                address: lead.address || "",
                squareFootage: lead.squareFootage || "",
                propertySourcing: lead.propertySourcing || null,
                leadType,
                templateId: step.templateId,
                sequenceId,
                stepLabel: step.label,
            },
        });
    }

    // ── Update lead/company doc ────────────────────────────────
    await db.collection(leadCollection).doc(leadId).update({
        status: lead.status === "new" ? "contacted" : lead.status,
        outreachStatus: "PENDING",
        sequenceId,
        sequenceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        sequenceStartedBy: request.auth?.uid || "manual",
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
        description: `"${sequence.name}" sequence started for ${businessName} → ${contactName || contactEmail}. Schedule: ${dayList}`,
        createdAt: new Date(),
        startedBy: request.auth?.uid || "manual",
        metadata: {
            leadType,
            sequenceId,
            sequenceName: sequence.name,
            stepCount: steps.length,
            schedule: dayList,
            contactId: contactId || null,
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
