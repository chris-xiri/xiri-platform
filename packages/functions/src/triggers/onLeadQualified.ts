import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { enqueueTask } from "../utils/queueUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Sales Lead Drip Campaign Scheduler
 * 
 * When a lead's status changes to 'qualified', schedule a 4-step
 * outreach email sequence targeting the business owner or property manager.
 * 
 * Sequence:
 *   Day 0  — Intro: "One call for all your facility needs"
 *   Day 3  — Value Prop: "Here's how we save you 15+ hours/month"
 *   Day 7  — Social Proof: Case study from similar facility
 *   Day 14 — Final follow-up: "Schedule a walkthrough?"
 */
export const onLeadQualified = onDocumentUpdated({
    document: "leads/{leadId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when status changes TO 'qualified'
    if (before.status === after.status) return;
    if (after.status !== 'qualified') return;

    const leadId = event.params.leadId;
    const businessName = after.businessName || 'Unknown';
    const contactEmail = after.email;

    // Guard: need an email to send to
    if (!contactEmail || contactEmail.trim().length === 0) {
        logger.warn(`[SalesOutreach] Lead ${leadId} (${businessName}) has no email — marking NEEDS_MANUAL.`);
        await db.collection("leads").doc(leadId).update({
            outreachStatus: 'NEEDS_MANUAL',
        });
        await db.collection("lead_activities").add({
            leadId,
            type: "OUTREACH_NEEDS_MANUAL",
            description: `No email found for ${businessName}. Manual outreach required.`,
            createdAt: new Date(),
        });
        return;
    }

    logger.info(`[SalesOutreach] Scheduling drip campaign for lead ${leadId} (${businessName})`);

    const now = new Date();
    const leadType = after.leadType || 'direct';

    // ── Different sequences per lead type ──
    // Subjects come from the Firestore `templates` collection at send time
    let steps: { dayOffset: number; sequence: number }[];

    if (leadType === 'enterprise') {
        steps = [
            { dayOffset: 0, sequence: 0 },
            { dayOffset: 4, sequence: 1 },
            { dayOffset: 8, sequence: 2 },
            { dayOffset: 14, sequence: 3 },
            { dayOffset: 21, sequence: 4 },
        ];
    } else if (leadType === 'referral_partnership') {
        steps = [
            { dayOffset: 0, sequence: 0 },
            { dayOffset: 4, sequence: 1 },
            { dayOffset: 10, sequence: 2 },
        ];
    } else {
        steps = [
            { dayOffset: 0, sequence: 0 },
            { dayOffset: 3, sequence: 1 },
            { dayOffset: 7, sequence: 2 },
            { dayOffset: 14, sequence: 3 },
        ];
    }

    for (const step of steps) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
        // Schedule at 9am ET (14:00 UTC)
        scheduledDate.setHours(14, 0, 0, 0);

        // Day 0 sends immediately (or at next 9am if past)
        const sendAt = step.dayOffset === 0 ? now : scheduledDate;

        // Determine template prefix by lead type
        const templatePrefix = leadType === 'enterprise'
            ? 'enterprise_lead_'
            : leadType === 'referral_partnership'
                ? 'referral_partnership_'
                : 'tenant_lead_';

        await enqueueTask(db, {
            leadId,
            type: 'SEND',
            scheduledAt: admin.firestore.Timestamp.fromDate(sendAt),
            metadata: {
                sequence: step.sequence,
                businessName,
                email: contactEmail,
                contactName: after.contactName || '',
                facilityType: after.facilityType || '',
                address: after.address || '',
                squareFootage: after.squareFootage || '',
                propertySourcing: after.propertySourcing || null,
                leadType,
                templateId: `${templatePrefix}${step.sequence + 1}`,
            }
        });
    }

    // Update lead outreach status
    await db.collection("leads").doc(leadId).update({
        outreachStatus: 'PENDING',
    });

    // Log activity
    await db.collection("lead_activities").add({
        leadId,
        type: "DRIP_SCHEDULED",
        description: `Sales drip campaign scheduled: 4 emails over 14 days for ${businessName}.`,
        createdAt: new Date(),
        metadata: { followUpCount: 4, schedule: 'Day 0/3/7/14' }
    });

    logger.info(`[SalesOutreach] Drip campaign scheduled for lead ${leadId}: 4 emails at days 0, 3, 7, 14`);
});
