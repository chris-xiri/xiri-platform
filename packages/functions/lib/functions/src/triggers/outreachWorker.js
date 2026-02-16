"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOutreachQueue = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const queueUtils_1 = require("../utils/queueUtils");
const timeUtils_1 = require("../utils/timeUtils");
const outreach_1 = require("../agents/outreach");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Run every minute to check for pending tasks
// Region must match project config
exports.processOutreachQueue = (0, scheduler_1.onSchedule)("every 1 minutes", async (event) => {
    logger.info("Processing outreach queue...");
    try {
        const tasks = await (0, queueUtils_1.fetchPendingTasks)(db);
        if (tasks.length === 0) {
            logger.info("No pending tasks found.");
            return;
        }
        logger.info(`Found ${tasks.length} tasks to process.`);
        for (const task of tasks) {
            try {
                if (task.type === 'GENERATE') {
                    await handleGenerate(task);
                }
                else if (task.type === 'SEND') {
                    await handleSend(task);
                }
            }
            catch (err) {
                logger.error(`Error processing task ${task.id}:`, err);
                // Simple retry logic: Increment count, set to retry, backoff
                // If > 5 retries, mark FAILED
                const newRetryCount = (task.retryCount || 0) + 1;
                const status = newRetryCount > 5 ? 'FAILED' : 'RETRY';
                // Exponential backoff for retry (1m, 2m, 4m...)
                const nextAttempt = new Date();
                nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));
                await (0, queueUtils_1.updateTaskStatus)(db, task.id, status, {
                    retryCount: newRetryCount,
                    scheduledAt: admin.firestore.Timestamp.fromDate(nextAttempt),
                    error: String(err)
                });
            }
        }
    }
    catch (error) {
        logger.error("Fatal error in queue processor:", error);
    }
});
async function handleGenerate(task) {
    logger.info(`Generating content for task ${task.id}`);
    // Reconstruct vendor object from metadata
    // In production, might be better to fetch fresh vendor data
    const vendorData = task.metadata;
    const outreachResult = await (0, outreach_1.generateOutreachContent)(vendorData, vendorData.phone ? 'SMS' : 'EMAIL');
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
    const scheduledTime = (0, timeUtils_1.getNextBusinessSlot)(vendorData.hasActiveContract ? "URGENT" : "SUPPLY");
    // 3. Enqueue SEND Task
    await (0, queueUtils_1.enqueueTask)(db, {
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
    await (0, queueUtils_1.updateTaskStatus)(db, task.id, 'COMPLETED');
    logger.info(`Task ${task.id} completed. Send scheduled for ${scheduledTime.toISOString()}`);
}
async function handleSend(task) {
    logger.info(`Executing SEND for task ${task.id}`);
    // In a real system, call Twilio/SendGrid here.
    // For now, we log the "Simulated Send".
    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: "OUTREACH_SENT",
        description: `Automated ${task.metadata.channel} sent to vendor.`,
        createdAt: new Date(),
        metadata: {
            channel: task.metadata.channel,
            content: task.metadata.channel === 'SMS' ? task.metadata.sms : task.metadata.email.subject
        }
    });
    await (0, queueUtils_1.updateTaskStatus)(db, task.id, 'COMPLETED');
    // Update Vendor Record
    await db.collection("vendors").doc(task.vendorId).update({
        outreachStatus: 'SENT',
        outreachChannel: task.metadata.channel,
        outreachTime: new Date()
    });
}
//# sourceMappingURL=outreachWorker.js.map