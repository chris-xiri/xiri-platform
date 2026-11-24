/**
 * Unified Lead Email Sequence Engine (Queue-Backed)
 *
 * Enqueues Step 0 of an email marketing funnel into `outreach_queue` so that
 * `processOutreachQueue` (`outreachWorker.ts`) paces sends strictly within
 * `maxDailyOutreach`, skips weekends, evaluates real-time suppression/pipeline
 * status before every touch, branches dynamically between `_warm` and `_cold`
 * variants based on live opens/clicks, and chains each subsequent step.
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";
import { cleanBusinessName, isOrthodonticPractice } from "@xiri/shared";
import { buildScheduledDate } from "./scheduleUtils";
import { enqueueTask, cancelLeadTasks, cancelContactTasks, cancelLeadScheduledEmails } from "./queueUtils";
import { parseAddress } from "./emailUtils";

const DEFAULT_SEQUENCE_MAP: Record<string, string> = {
    enterprise: "enterprise_lead_sequence",
    referral_partnership: "referral_partnership_sequence",
    tenant: "tenant_lead_sequence",
    direct: "dental_funnel_v1",
    in_house_conversion: "in_house_conversion_sequence",
};

const HUMAN_PIPELINE_STATUSES = new Set([
    "qualified",
    "walkthrough",
    "proposal",
    "quoted",
    "won",
]);

function formatLifecycleDate(value: any): string | null {
    if (!value) return null;
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const BUSINESS_NAME_KEYWORDS = /\b(dental|dentistry|orthodont\w*|ortho|smiles?|clinic|studio|associates|center|group|pediatric|endo\w*|perio\w*|implant|care|practice|office|llc|p\.?c\.?|inc\.?|pllc|dds|dmd)\b/i;

export function extractContactFirstName(contactName?: string | null, businessName?: string | null): string {
    if (!contactName) return "there";
    const trimmed = contactName
        .replace(/,?\s*(?:D\.?D\.?S\.?|D\.?M\.?D\.?|M\.?S\.?D\.?|M\.?S\.?|M\.?D\.?|P\.?C\.?)\b\.?/gi, "")
        .trim();
    if (!trimmed) return "there";
    const lower = trimmed.toLowerCase();
    if (
        lower === "practice manager" ||
        lower === "office manager" ||
        lower === "practice administrator" ||
        lower === "front desk" ||
        lower === "there" ||
        (businessName && lower === businessName.trim().toLowerCase())
    ) {
        return "there";
    }
    // Preserve "Dr. LastName" when contact starts with Dr. (even if business name also has dental/ortho)
    if (/^dr\.?\s+/i.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        return parts.length >= 2 ? `Dr. ${parts[parts.length - 1]}` : "there";
    }
    // Reject business names accidentally stored in contactName (e.g. "Hidden Smiles Orthodontic Studio")
    if (BUSINESS_NAME_KEYWORDS.test(trimmed)) {
        return "there";
    }
    return trimmed.split(/\s+/)[0];
}

/**
 * Resolve the best default sequenceId for a company/lead.
 * All private dental & orthodontic practices route into the unified
 * `dental_funnel_v1` sequence (with `{{practiceType}}` personalized per clinic).
 */
export async function resolveDefaultSequenceId(
    db: admin.firestore.Firestore,
    lead: Record<string, any>
): Promise<string> {
    const isOrtho = isOrthodonticPractice({
        clinicType: lead.dossier?.clinicType,
        practiceSpecialty: lead.practiceSpecialty,
        businessName: lead.businessName || lead.name,
        searchQuery: lead.searchQuery,
    });

    const isDental =
        lead.facilityType === "medical_dental" ||
        String(lead.facilityType || "").toLowerCase().includes("dental") ||
        String(lead.category || "").toLowerCase().includes("dental") ||
        isOrtho;

    if (isDental) {
        const dentalV1 = await db.collection("sequences").doc("dental_funnel_v1").get();
        if (dentalV1.exists) return "dental_funnel_v1";
        const dentalLegacy = await db.collection("sequences").doc("dental_lead_sequence").get();
        if (dentalLegacy.exists) return "dental_lead_sequence";
    }

    const leadType = lead.leadType || "direct";
    const mapped = DEFAULT_SEQUENCE_MAP[leadType] || "dental_funnel_v1";
    const mappedDoc = await db.collection("sequences").doc(mapped).get();
    if (mappedDoc.exists) return mapped;

    return "tenant_lead_sequence";
}

export interface EnqueueLeadSequenceInput {
    db: admin.firestore.Firestore;
    leadId: string;
    contactId?: string | null;
    sequenceId?: string | null;
    /** Optional initial delay in minutes (used by auto-enroll to jitter sends) */
    initialDelayMinutes?: number;
    /** Optional business-day stagger for secondary contacts at the same company (e.g. +1 or +2 days) */
    initialDelayDays?: number;
    /** Mark secondary contacts (Contact #2/#3 at the same company) so they use contact-scoped Touch 1 copy */
    isSecondaryContact?: boolean;
    /** Allow silent skip on duplicate/guard instead of throwing HttpsError (for autonomous cron) */
    throwOnGuard?: boolean;
    /** Tag enrollment source for analytics */
    enrolledBy?: "manual" | "auto_sdr" | "bulk";
}

export interface EnqueueLeadSequenceResult {
    success: boolean;
    skipped?: boolean;
    skipReason?: string;
    leadId: string;
    contactId: string | null;
    contactEmail?: string;
    sequenceId?: string;
    sequenceName?: string;
    stepsTotal?: number;
    firstTaskId?: string;
    firstSendAt?: string;
}

export async function enqueueLeadSequence(
    input: EnqueueLeadSequenceInput
): Promise<EnqueueLeadSequenceResult> {
    const {
        db,
        leadId,
        contactId: requestedContactId,
        sequenceId: requestedSequenceId,
        initialDelayMinutes = 0,
        initialDelayDays = 0,
        isSecondaryContact = false,
        throwOnGuard = true,
        enrolledBy = "manual",
    } = input;

    const fail = (code: any, message: string): EnqueueLeadSequenceResult => {
        if (throwOnGuard) {
            throw new HttpsError(code, message);
        }
        return {
            success: false,
            skipped: true,
            skipReason: message,
            leadId,
            contactId: requestedContactId || null,
        };
    };

    // ── Fetch company/lead ──
    let leadDoc = await db.collection("companies").doc(leadId).get();
    let leadCollection: "companies" | "leads" = "companies";
    if (!leadDoc.exists) {
        leadDoc = await db.collection("leads").doc(leadId).get();
        leadCollection = "leads";
    }
    if (!leadDoc.exists) {
        return fail("not-found", `Lead/Company ${leadId} not found in companies or leads`);
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || lead.name || "Unknown";

    // ── Guard: block suppressed, lost, or active human-pipeline accounts ──
    const isManuallyLost = lead.status === "lost" && !lead.lostReason?.includes("bounce");
    const isStillSuppressed = !!lead.unsubscribedAt;
    if (isStillSuppressed || isManuallyLost) {
        return fail(
            "failed-precondition",
            lead.unsubscribedAt
                ? `${businessName} is suppressed (unsubscribed/bounced) — update the contact's email first to re-enable outreach.`
                : `${businessName} is marked as lost — cannot enroll in a sequence.`
        );
    }

    if (HUMAN_PIPELINE_STATUSES.has(lead.status)) {
        return fail(
            "failed-precondition",
            `${businessName} is already in active sales pipeline ("${lead.status}") — automated cold funnel blocked.`
        );
    }

    // ── Resolve contact (contact-centric model) ──
    let contactId: string | null = requestedContactId || null;
    let contactEmail = "";
    let contactName = "";
    let contactTitle = "";

    if (contactId) {
        const contactDoc = await db.collection("contacts").doc(contactId).get();
        if (contactDoc.exists) {
            const contact = contactDoc.data()!;
            if (contact.lifecycleStatus === "held") {
                const holdUntil = formatLifecycleDate(contact.holdUntilAt);
                return fail(
                    "failed-precondition",
                    holdUntil
                        ? `Contact ${contact.firstName || ""} ${contact.lastName || ""} is on hold until ${holdUntil} — reactivate before enrolling.`.trim()
                        : `Contact ${contact.firstName || ""} ${contact.lastName || ""} is on hold — reactivate before enrolling.`.trim()
                );
            }
            if (contact.unsubscribed || contact.lifecycleStatus === "suppressed") {
                return fail(
                    "failed-precondition",
                    `Contact ${contact.firstName || ""} ${contact.lastName || ""} is unsubscribed/suppressed — cannot enroll.`.trim()
                );
            }
            contactEmail = contact.email || "";
            contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
            contactTitle = contact.title || "";
        }
    }

    if (!contactEmail) {
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
            if (pData.lifecycleStatus === "held") {
                const holdUntil = formatLifecycleDate(pData.holdUntilAt);
                return fail(
                    "failed-precondition",
                    holdUntil
                        ? `${businessName}'s primary contact is on hold until ${holdUntil}.`
                        : `${businessName}'s primary contact is on hold.`
                );
            }
            if (pData.unsubscribed || pData.lifecycleStatus === "suppressed") {
                return fail("failed-precondition", `${businessName}'s primary contact is unsubscribed/suppressed.`);
            }
            contactEmail = pData.email || "";
            contactName = `${pData.firstName || ""} ${pData.lastName || ""}`.trim();
            contactTitle = pData.title || "";
        }
    }

    if (!contactEmail) {
        contactEmail = lead.email || "";
        contactName = lead.contactName || "";
        contactTitle = lead.contactTitle || "";
    }

    if (!contactEmail || contactEmail.trim().length === 0) {
        await db.collection(leadCollection).doc(leadId).update({
            outreachStatus: "NEEDS_MANUAL",
        });
        return fail("failed-precondition", `Lead ${businessName} has no email — manual outreach required.`);
    }

    // ── Resolve sequence ──
    const sequenceId = requestedSequenceId || (await resolveDefaultSequenceId(db, lead));
    const sequenceDoc = await db.collection("sequences").doc(sequenceId).get();
    if (!sequenceDoc.exists) {
        return fail(
            "not-found",
            `Sequence "${sequenceId}" not found. Run scripts/seed-dental-sdr-funnel.js or create it in Email Templates.`
        );
    }

    const sequence = sequenceDoc.data()!;
    const BLOCKED_CATEGORIES = ["vendor", "vendor_email"];
    if (BLOCKED_CATEGORIES.includes(sequence.category)) {
        return fail(
            "failed-precondition",
            `Cannot enroll a lead in vendor sequence "${sequence.name || sequenceId}".`
        );
    }

    const steps: Array<{
        templateId: string;
        dayOffset: number;
        label?: string;
        warmTemplateId?: string;
        coldTemplateId?: string;
    }> = sequence.steps || [];

    if (steps.length === 0) {
        return fail("failed-precondition", `Sequence "${sequence.name}" has no steps defined.`);
    }

    // ── Duplicate enrollment check ──
    if (contactId) {
        const contactDoc = await db.collection("contacts").doc(contactId).get();
        if (contactDoc.exists) {
            const history = contactDoc.data()?.sequenceHistory || {};
            if (history[sequenceId]) {
                const prevStart = history[sequenceId].startedAt;
                const prevDate = prevStart?.toDate ? prevStart.toDate() : prevStart;
                return fail(
                    "already-exists",
                    `${contactName || contactEmail} was already enrolled in "${sequence.name}" on ${prevDate ? new Date(prevDate).toLocaleDateString() : "a previous date"
                    }.`
                );
            }
        }
    }

    // ── Cancel any existing pending tasks for THIS contact (preserving sibling contacts at the same company) ──
    if (contactId) {
        await cancelContactTasks(db, leadId, contactId);
    } else {
        await cancelLeadTasks(db, leadId);
        await cancelLeadScheduledEmails(db, leadId, leadCollection);
    }

    // ── Compute first step send time ──
    const now = new Date();
    const firstStep = steps[0];
    let firstSendAt = buildScheduledDate(now, (firstStep.dayOffset || 0) + (initialDelayDays || 0));
    if (initialDelayMinutes > 0) {
        firstSendAt = new Date(firstSendAt.getTime() + initialDelayMinutes * 60_000);
    }

    const parsedAddr = parseAddress(lead.address);
    const city = lead.city || parsedAddr.city || (lead.address ? lead.address.split(",")[0].trim() : "Metro NY");
    const cleanBiz = cleanBusinessName(businessName) || businessName;
    const isOrtho = isOrthodonticPractice({
        clinicType: lead.dossier?.clinicType,
        practiceSpecialty: lead.practiceSpecialty,
        businessName,
        searchQuery: lead.searchQuery,
    });
    const practiceType = isOrtho ? "orthodontic practice" : "dental practice";

    // ── Enqueue Step 0 into outreach_queue ──
    const taskRef = await enqueueTask(db, {
        leadId,
        contactId: contactId || undefined,
        type: "SEND",
        scheduledAt: admin.firestore.Timestamp.fromDate(firstSendAt),
        metadata: {
            sequenceId,
            sequenceName: sequence.name || sequenceId,
            sequence: 1, // 1-based display step
            stepIndex: 0, // 0-based index into sequence.steps
            totalSteps: steps.length,
            templateId: firstStep.templateId,
            stepLabel: firstStep.label || "Touch 1",
            businessName: cleanBiz,
            rawBusinessName: businessName,
            contactName: contactName || "there",
            contactFirstName: extractContactFirstName(contactName),
            contactTitle: contactTitle || (isOrtho ? "Office Manager" : "Practice Manager"),
            contactId: contactId || null,
            email: contactEmail,
            facilityType: lead.facilityType || "medical_dental",
            practiceType,
            clinicType: lead.dossier?.clinicType || (isOrtho ? "ortho" : "general"),
            keyObservation: lead.dossier?.keyObservation || "",
            estimatedOperatories: lead.dossier?.estimatedOperatories ? String(lead.dossier.estimatedOperatories) : "",
            address: lead.address || "",
            city,
            state: lead.state || parsedAddr.state || "NY",
            squareFootage: lead.squareFootage ? String(lead.squareFootage) : "",
            outreachDraft: isSecondaryContact ? null : (lead.outreachDraft || null),
            useCompanyDraft: !isSecondaryContact,
            isSecondaryContact,
            senderId: sequence.senderId || "sales",
            enrolledBy,
        },
    });

    // ── Update company & contact records ──
    const companyUpdate: Record<string, any> = {
        outreachStatus: "QUEUED",
        activeSequenceId: sequenceId,
        activeSequenceName: sequence.name || sequenceId,
        sequenceEnrolledAt: now,
        sequenceEnrolledBy: enrolledBy,
        updatedAt: now,
    };
    if (!lead.status || lead.status === "new") {
        companyUpdate.status = "contacted";
    }
    await db.collection(leadCollection).doc(leadId).update(companyUpdate);

    if (contactId) {
        await db.collection("contacts").doc(contactId).set(
            {
                emailStatus: "sequenced",
                lifecycleStatus: "active",
                activeSequenceId: sequenceId,
                [`sequenceHistory.${sequenceId}`]: {
                    sequenceName: sequence.name || sequenceId,
                    startedAt: now,
                    totalSteps: steps.length,
                    currentStep: 0,
                    status: "active",
                    enrolledBy,
                },
                updatedAt: now,
            },
            { merge: true }
        );
    }

    // ── Log enrollment activity ──
    await db.collection("lead_activities").add({
        leadId,
        contactId: contactId || null,
        type: "SEQUENCE_ENROLLED",
        description: `Enrolled ${contactName || contactEmail} in "${sequence.name || sequenceId}" (${steps.length} touches, queued via SDR funnel).`,
        createdAt: now,
        metadata: {
            sequenceId,
            sequenceName: sequence.name || sequenceId,
            totalSteps: steps.length,
            firstTaskId: taskRef.id,
            firstSendAt: firstSendAt.toISOString(),
            contactEmail,
            enrolledBy,
        },
    });

    logger.info(
        `[LeadSequenceEngine] Enqueued "${sequenceId}" Step 1/${steps.length} for ${businessName} (${contactEmail}) [task=${taskRef.id}, by=${enrolledBy}]`
    );

    return {
        success: true,
        leadId,
        contactId,
        contactEmail,
        sequenceId,
        sequenceName: sequence.name || sequenceId,
        stepsTotal: steps.length,
        firstTaskId: taskRef.id,
        firstSendAt: firstSendAt.toISOString(),
    };
}
