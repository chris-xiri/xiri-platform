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
exports.onVendorCreated = exports.autoApproveVendor = exports.telegramWebhook = exports.notifyHumanReview = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const telegraf_1 = require("telegraf");
const tasks_1 = require("@google-cloud/tasks");
// Initialize Telegraf
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN || "YOUR_BOT_TOKEN_PLACEHOLDER");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const tasksClient = new tasks_1.CloudTasksClient();
const PROJECT = process.env.GCLOUD_PROJECT || "xiri-facility-solutions-485813";
const LOCATION = "us-central1"; // hardcoded as per standard
const QUEUE = "approval-timeout";
// 1. Notify Human Review
const notifyHumanReview = async (vendorId) => {
    const doc = await db.collection("vendors").doc(vendorId).get();
    if (!doc.exists)
        return;
    const vendor = doc.data();
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
        ...telegraf_1.Markup.inlineKeyboard([
            telegraf_1.Markup.button.callback('✅ Approve', `approve_${vendorId}`),
            telegraf_1.Markup.button.callback('❌ Reject', `reject_${vendorId}`)
        ])
    });
    // Save message ID to Firestore to edit it later
    await doc.ref.update({ telegramMessageId: sentMsg.message_id });
    // Schedule 4-hour timeout task
    await scheduleAutoApproval(vendorId);
};
exports.notifyHumanReview = notifyHumanReview;
async function scheduleAutoApproval(vendorId) {
    const parent = tasksClient.queuePath(PROJECT, LOCATION, QUEUE);
    const url = `https://${LOCATION}-${PROJECT}.cloudfunctions.net/autoApproveVendor`;
    const payload = { vendorId };
    const inSeconds = 4 * 60 * 60;
    // Construct the task
    const task = {
        httpRequest: {
            httpMethod: 'POST',
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
    }
    catch (error) {
        console.error("Error scheduling task:", error);
    }
}
// 2. Bot Action Handlers
exports.telegramWebhook = (0, https_1.onRequest)({ secrets: ["TELEGRAM_BOT_TOKEN", "OPS_CHAT_ID"] }, async (req, res) => {
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
async function updateVendorStatus(vendorId, status, ctx) {
    const ref = db.collection('vendors').doc(vendorId);
    await ref.update({ status });
    // Edit message to remove buttons
    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.reply(`Vendor ${status} successfully.`);
    }
    catch (e) {
        console.error("Error editing message", e);
    }
}
// 3. Auto-Approval Function
exports.autoApproveVendor = (0, https_1.onRequest)(async (req, res) => {
    const { vendorId } = req.body;
    if (!vendorId) {
        res.status(400).send("Missing vendorId");
        return;
    }
    const ref = db.collection('vendors').doc(vendorId);
    const doc = await ref.get();
    if (doc.exists) {
        const data = doc.data();
        if (data.status === 'PENDING_REVIEW') {
            await ref.update({ status: 'AI_AUTO_APPROVED' });
            console.log(`Auto-approved vendor ${vendorId}`);
        }
        else {
            console.log(`Vendor ${vendorId} status is ${data.status}, skipping auto-approve.`);
        }
    }
    res.status(200).send("OK");
});
// 4. Firestore Trigger for New Vendors
const firestore_1 = require("firebase-functions/v2/firestore");
exports.onVendorCreated = (0, firestore_1.onDocumentCreated)({
    document: "vendors/{vendorId}",
    secrets: ["TELEGRAM_BOT_TOKEN", "OPS_CHAT_ID"]
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const data = snapshot.data();
    if (data.status === 'PENDING_REVIEW') {
        const vendorId = event.params.vendorId;
        console.log(`New pending vendor detected: ${vendorId}. Sending notification.`);
        await (0, exports.notifyHumanReview)(vendorId);
    }
});
//# sourceMappingURL=telegramBot.js.map