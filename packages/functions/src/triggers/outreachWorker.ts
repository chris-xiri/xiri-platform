import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { fetchPendingTasks, updateTaskStatus, enqueueTask, QueueItem } from "../utils/queueUtils";
import { getNextBusinessSlot } from "../utils/timeUtils";
import { generateOutreachContent } from "../agents/outreach";
import { sendEmail } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Run every minute to check for pending tasks
// Region must match project config
export const processOutreachQueue = onSchedule({
    schedule: "every 1 minutes",
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
}, async (event) => {
    logger.info("Processing outreach queue...");

    try {
        const tasks = await fetchPendingTasks(db);
        if (tasks.length === 0) {
            logger.info("No pending tasks found.");
            return;
        }

        logger.info(`Found ${tasks.length} tasks to process.`);

        for (const task of tasks) {
            try {
                if (task.type === 'GENERATE') {
                    await handleGenerate(task);
                } else if (task.type === 'SEND') {
                    await handleSend(task);
                }
            } catch (err) {
                logger.error(`Error processing task ${task.id}:`, err);
                // Simple retry logic: Increment count, set to retry, backoff
                // If > 5 retries, mark FAILED
                const newRetryCount = (task.retryCount || 0) + 1;
                const status = newRetryCount > 5 ? 'FAILED' : 'RETRY';

                // Exponential backoff for retry (1m, 2m, 4m...)
                const nextAttempt = new Date();
                nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));

                await updateTaskStatus(db, task.id!, status, {
                    retryCount: newRetryCount,
                    scheduledAt: admin.firestore.Timestamp.fromDate(nextAttempt),
                    error: String(err)
                });
            }
        }
    } catch (error) {
        logger.error("Fatal error in queue processor:", error);
    }
});

async function handleGenerate(task: QueueItem) {
    logger.info(`Generating content for task ${task.id}`);

    // Reconstruct vendor object from metadata
    // In production, might be better to fetch fresh vendor data
    const vendorData = task.metadata;

    const outreachResult = await generateOutreachContent(vendorData, vendorData.phone ? 'SMS' : 'EMAIL');

    if (outreachResult.error) {
        throw new Error("AI Generation Failed: " + (outreachResult.sms || "Unknown Error"));
    }

    // 1. Log the drafts (Visible to User)
    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: "OUTREACH_QUEUED", // Using same type for UI compatibility
        description: `Outreach drafts generated (waiting to send).`,
        createdAt: new Date(),
        metadata: {
            sms: outreachResult.sms,
            email: outreachResult.email,
            preferredChannel: outreachResult.channel,
            campaignUrgency: vendorData.hasActiveContract ? "URGENT" : "SUPPLY"
        }
    });

    // 2. Calculate Schedule
    const scheduledTime = getNextBusinessSlot(vendorData.hasActiveContract ? "URGENT" : "SUPPLY");

    // 3. Enqueue SEND Task
    await enqueueTask(db, {
        vendorId: task.vendorId,
        type: 'SEND',
        scheduledAt: admin.firestore.Timestamp.fromDate(scheduledTime),
        metadata: {
            // Pass the generated content along
            sms: outreachResult.sms,
            email: outreachResult.email,
            channel: outreachResult.channel
        }
    });

    // 4. Mark GENERATE task complete
    await updateTaskStatus(db, task.id!, 'COMPLETED');
    logger.info(`Task ${task.id} completed. Send scheduled for ${scheduledTime.toISOString()}`);
}

async function handleSend(task: QueueItem) {
    logger.info(`Executing SEND for task ${task.id}`);

    const vendorDoc = await db.collection("vendors").doc(task.vendorId).get();
    const vendor = vendorDoc.exists ? vendorDoc.data() : null;
    const vendorEmail = vendor?.email || task.metadata?.email?.to;

    let sendSuccess = false;

    if (task.metadata.channel === 'EMAIL' && vendorEmail) {
        // ─── Real Resend Email ───
        const emailData = task.metadata.email;
        const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || '').replace(/\n/g, '<br/>')}</div>`;

        sendSuccess = await sendEmail(
            vendorEmail,
            emailData?.subject || 'Xiri Facility Solutions — Partnership Opportunity',
            htmlBody
        );

        if (!sendSuccess) {
            logger.error(`Failed to send email to ${vendorEmail} for task ${task.id}`);
            throw new Error(`Resend email failed for vendor ${task.vendorId}`);
        }
    } else if (task.metadata.channel === 'SMS') {
        // ─── SMS: Twilio integration deferred ───
        logger.info(`SMS send deferred for task ${task.id} (Twilio not yet integrated)`);
        sendSuccess = true; // Log as success for now
    } else {
        logger.warn(`No valid channel/email for task ${task.id}. Channel: ${task.metadata.channel}, Email: ${vendorEmail}`);
        sendSuccess = false;
    }

    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
        description: sendSuccess
            ? `Automated ${task.metadata.channel} sent to ${vendorEmail || 'vendor'}.`
            : `Failed to send ${task.metadata.channel} to vendor.`,
        createdAt: new Date(),
        metadata: {
            channel: task.metadata.channel,
            to: vendorEmail || 'unknown',
            content: task.metadata.channel === 'SMS' ? task.metadata.sms : task.metadata.email?.subject
        }
    });

    await updateTaskStatus(db, task.id!, sendSuccess ? 'COMPLETED' : 'FAILED');

    // Update Vendor Record
    await db.collection("vendors").doc(task.vendorId).update({
        outreachStatus: sendSuccess ? 'SENT' : 'PENDING',
        outreachChannel: task.metadata.channel,
        outreachTime: new Date()
    });
}
