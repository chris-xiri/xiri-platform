import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { enqueueTask } from "../utils/queueUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Drip Campaign Scheduler
 * 
 * When a vendor's status changes to 'awaiting_onboarding',
 * schedule follow-up emails at Day 3, Day 7, and Day 14.
 * 
 * Each follow-up reminds them to complete the onboarding form.
 * After Day 14 with no response, the vendor is auto-dismissed at Day 21.
 */
export const onAwaitingOnboarding = onDocumentUpdated({
    document: "vendors/{vendorId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when status changes TO 'awaiting_onboarding'
    if (before.status === after.status) return;
    if (after.status !== 'awaiting_onboarding') return;

    const vendorId = event.params.vendorId;
    const businessName = after.businessName || 'Unknown';

    logger.info(`Scheduling drip campaign for vendor ${vendorId} (${businessName})`);

    const now = new Date();

    // Schedule follow-ups: Day 3, Day 7, Day 14
    const followUps = [
        { dayOffset: 3, sequence: 1, subject: 'Quick reminder — complete your Xiri profile' },
        { dayOffset: 7, sequence: 2, subject: 'Just checking in — your Xiri application' },
        { dayOffset: 14, sequence: 3, subject: 'Final follow-up — don\'t miss out on work opportunities' },
    ];

    for (const fu of followUps) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + fu.dayOffset);
        // Schedule at 10am ET
        scheduledDate.setHours(15, 0, 0, 0); // 15:00 UTC = 10:00 ET

        await enqueueTask(db, {
            vendorId,
            type: 'FOLLOW_UP',
            scheduledAt: admin.firestore.Timestamp.fromDate(scheduledDate),
            metadata: {
                sequence: fu.sequence,
                subject: fu.subject,
                businessName,
                email: after.email,
                preferredLanguage: after.preferredLanguage || 'en',
            }
        });
    }

    // Log each follow-up as a separate activity for timeline visibility
    for (const fu of followUps) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + fu.dayOffset);
        scheduledDate.setHours(15, 0, 0, 0);

        await db.collection("vendor_activities").add({
            vendorId,
            type: "DRIP_SCHEDULED",
            description: `Follow-up #${fu.sequence} scheduled: "${fu.subject}"`,
            createdAt: new Date(),
            scheduledFor: scheduledDate,
            metadata: { sequence: fu.sequence, dayOffset: fu.dayOffset, subject: fu.subject }
        });
    }

    logger.info(`Drip campaign scheduled for ${vendorId}: 3 follow-ups at days 3, 7, 14`);
});
