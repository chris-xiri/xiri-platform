/**
 * startLeadSequence — Manually kick off a drip email sequence for a sales lead.
 * 
 * Called from the dashboard UI. Uses the lead's `leadType` to determine
 * which template sequence to schedule (tenant, referral_partnership, or direct).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { enqueueTask } from "../utils/queueUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const startLeadSequence = onCall(async (request) => {
    const { leadId } = request.data;

    if (!leadId) {
        throw new HttpsError('invalid-argument', 'leadId is required');
    }

    // Fetch the lead
    const leadDoc = await db.collection("leads").doc(leadId).get();
    if (!leadDoc.exists) {
        throw new HttpsError('not-found', `Lead ${leadId} not found`);
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || 'Unknown';
    const contactEmail = lead.email;

    // Guard: need an email
    if (!contactEmail || contactEmail.trim().length === 0) {
        await db.collection("leads").doc(leadId).update({
            outreachStatus: 'NEEDS_MANUAL',
        });
        throw new HttpsError(
            'failed-precondition',
            `Lead ${businessName} has no email — manual outreach required.`
        );
    }

    // Cancel any existing pending/retry tasks before starting a new sequence
    const { cancelLeadTasks } = await import("../utils/queueUtils");
    const cancelledCount = await cancelLeadTasks(db, leadId);
    if (cancelledCount > 0) {
        logger.info(`[StartSequence] Cancelled ${cancelledCount} existing tasks for lead ${leadId}`);
    }

    const leadType = lead.leadType || 'direct';

    logger.info(`[StartSequence] Manually starting ${leadType} sequence for lead ${leadId} (${businessName})`);

    const now = new Date();

    // ── Different sequences per lead type ──
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
        // tenant + direct both use 4-step sequence
        steps = [
            { dayOffset: 0, sequence: 0 },
            { dayOffset: 3, sequence: 1 },
            { dayOffset: 7, sequence: 2 },
            { dayOffset: 14, sequence: 3 },
        ];
    }

    // Determine template prefix by lead type
    const templatePrefix = leadType === 'enterprise'
        ? 'enterprise_lead_'
        : leadType === 'referral_partnership'
            ? 'referral_partnership_'
            : 'tenant_lead_';

    for (const step of steps) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
        scheduledDate.setHours(14, 0, 0, 0); // 9am ET = 14:00 UTC

        const sendAt = step.dayOffset === 0 ? now : scheduledDate;

        await enqueueTask(db, {
            leadId,
            type: 'SEND',
            scheduledAt: admin.firestore.Timestamp.fromDate(sendAt),
            metadata: {
                sequence: step.sequence,
                businessName,
                email: contactEmail,
                contactName: lead.contactName || '',
                facilityType: lead.facilityType || '',
                address: lead.address || '',
                squareFootage: lead.squareFootage || '',
                propertySourcing: lead.propertySourcing || null,
                leadType,
                templateId: `${templatePrefix}${step.sequence + 1}`,
            }
        });
    }

    // Update lead — mark as contacted and set outreach status
    await db.collection("leads").doc(leadId).update({
        status: lead.status === 'new' ? 'contacted' : lead.status,
        outreachStatus: 'PENDING',
        sequenceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        sequenceStartedBy: request.auth?.uid || 'manual',
    });

    // Log activity
    const schedule = leadType === 'enterprise' ? 'Day 0/4/8/14/21'
        : leadType === 'referral_partnership' ? 'Day 0/4/10' : 'Day 0/3/7/14';
    await db.collection("lead_activities").add({
        leadId,
        type: "SEQUENCE_STARTED",
        description: `${leadType} email sequence manually started for ${businessName}. Schedule: ${schedule}`,
        createdAt: new Date(),
        startedBy: request.auth?.uid || 'manual',
        metadata: { leadType, stepCount: steps.length, schedule }
    });

    logger.info(`[StartSequence] ${leadType} sequence started for ${leadId}: ${steps.length} emails`);

    return {
        success: true,
        message: `${leadType} sequence started for ${businessName}`,
        stepCount: steps.length,
        schedule,
    };
});
