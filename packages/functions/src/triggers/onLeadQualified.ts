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

    // Schedule 4-step drip: Day 0, Day 3, Day 7, Day 14
    const steps = [
        { dayOffset: 0, sequence: 0, subject: 'Simplify your facility management' },
        { dayOffset: 3, sequence: 1, subject: 'How we save you 15+ hours/month' },
        { dayOffset: 7, sequence: 2, subject: 'How practices like yours made the switch' },
        { dayOffset: 14, sequence: 3, subject: 'Last check in — free walkthrough offer' },
    ];

    for (const step of steps) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
        // Schedule at 9am ET (14:00 UTC)
        scheduledDate.setHours(14, 0, 0, 0);

        // Day 0 sends immediately (or at next 9am if past)
        const sendAt = step.dayOffset === 0 ? now : scheduledDate;

        await enqueueTask(db, {
            leadId,
            type: step.sequence === 0 ? 'GENERATE' : 'FOLLOW_UP',
            scheduledAt: admin.firestore.Timestamp.fromDate(sendAt),
            metadata: {
                sequence: step.sequence,
                subject: step.subject,
                businessName,
                email: contactEmail,
                contactName: after.contactName || '',
                facilityType: after.facilityType || '',
                address: after.address || '',
                propertySourcing: after.propertySourcing || null,
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
