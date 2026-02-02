import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Telegraf, Markup } from "telegraf";
import { CloudTasksClient } from "@google-cloud/tasks";
import { Vendor } from "../utils/types";

// Initialize Telegraf
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "YOUR_BOT_TOKEN_PLACEHOLDER");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const tasksClient = new CloudTasksClient();

const PROJECT = process.env.GCLOUD_PROJECT || "xiri-facility-solutions-485813";
const LOCATION = "us-central1"; // hardcoded as per standard
const QUEUE = "approval-timeout";

// 1. Notify Human Review
export const notifyHumanReview = async (vendorId: string) => {
    const doc = await db.collection("vendors").doc(vendorId).get();
    if (!doc.exists) return;

    const vendor = doc.data() as Vendor;
    const chatId = process.env.OPS_CHAT_ID || "YOUR_CHAT_ID_PLACEHOLDER";

    const message = `🚨 *New Vendor Review*

*Name:* ${vendor.companyName}
*Type:* ${vendor.businessType || 'Unknown'}
*Specialty:* ${vendor.specialty}
*Location:* ${vendor.location}
*AI Fit Score:* ${vendor.fitScore}

*Contact:*
📞 ${vendor.phone || 'N/A'}
🌐 ${vendor.website ? `[Website](${vendor.website})` : 'N/A'}`;

    const sentMsg = await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            Markup.button.callback('✅ Approve', `approve_${vendorId}`),
            Markup.button.callback('❌ Reject', `reject_${vendorId}`)
        ])
    });

    // Save message ID to Firestore to edit it later
    await doc.ref.update({ telegramMessageId: sentMsg.message_id });

    // Schedule 4-hour timeout task
    await scheduleAutoApproval(vendorId);
};

async function scheduleAutoApproval(vendorId: string) {
    const parent = tasksClient.queuePath(PROJECT, LOCATION, QUEUE);
    const url = `https://${LOCATION}-${PROJECT}.cloudfunctions.net/autoApproveVendor`;

    const payload = { vendorId };
    const inSeconds = 4 * 60 * 60;

    // Construct the task
    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            headers: {
                'Content-Type': 'application/json',
            },
        },
        scheduleTime: {
            seconds: Date.now() / 1000 + inSeconds,
        },
    };

    try {
        await tasksClient.createTask({ parent, task });
        console.log(`Task scheduled for vendor ${vendorId}`);
    } catch (error) {
        console.error("Error scheduling task:", error);
    }
}

// 2. Bot Action Handlers
export const telegramWebhook = onRequest(async (req, res) => {
    // Pass the update to Telegraf
    await bot.handleUpdate(req.body, res);
});

// Define actions
bot.action(/approve_(.+)/, async (ctx) => {
    const vendorId = ctx.match[1].replace('approve_', ''); // regex match group 1
    await updateVendorStatus(vendorId, 'APPROVED', ctx);
});

bot.action(/reject_(.+)/, async (ctx) => {
    const vendorId = ctx.match[1].replace('reject_', '');
    await updateVendorStatus(vendorId, 'REJECTED', ctx);
});

// Fix regex matching access: ctx.match is RegExpExecArray in newer telegraf? 
// Actually Telegraf typings for actions can be tricky.
// But standard usage `bot.action(/.../, (ctx) => ...)` works.

async function updateVendorStatus(vendorId: string, status: Vendor['status'], ctx: any) {
    const ref = db.collection('vendors').doc(vendorId);

    await ref.update({ status });

    // Edit message to remove buttons
    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.reply(`Vendor ${status} successfully.`);
    } catch (e) {
        console.error("Error editing message", e);
    }
}

// 3. Auto-Approval Function
export const autoApproveVendor = onRequest(async (req, res) => {
    const { vendorId } = req.body;
    if (!vendorId) {
        res.status(400).send("Missing vendorId");
        return;
    }

    const ref = db.collection('vendors').doc(vendorId);
    const doc = await ref.get();

    if (doc.exists) {
        const data = doc.data() as Vendor;
        if (data.status === 'PENDING_REVIEW') {
            await ref.update({ status: 'AI_AUTO_APPROVED' });
            console.log(`Auto-approved vendor ${vendorId}`);
        } else {
            console.log(`Vendor ${vendorId} status is ${data.status}, skipping auto-approve.`);
        }
    }

    res.status(200).send("OK");
});

// 4. Firestore Trigger for New Vendors
import { onDocumentCreated } from "firebase-functions/v2/firestore";

export const onVendorCreated = onDocumentCreated("vendors/{vendorId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const data = snapshot.data() as Vendor;

    if (data.status === 'PENDING_REVIEW') {
        const vendorId = event.params.vendorId;
        console.log(`New pending vendor detected: ${vendorId}. Sending notification.`);
        await notifyHumanReview(vendorId);
    }
});

