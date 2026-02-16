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
exports.onIncomingMessage = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const outreach_1 = require("../agents/outreach");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.onIncomingMessage = (0, firestore_1.onDocumentCreated)("vendor_activities/{activityId}", async (event) => {
    if (!event.data)
        return;
    const activity = event.data.data();
    const vendorId = activity.vendorId;
    // Only process INBOUND_REPLY type
    if (activity.type !== 'INBOUND_REPLY')
        return;
    logger.info(`Processing inbound message from vendor ${vendorId}`);
    try {
        // 1. Fetch Vendor Data
        const vendorDoc = await db.collection("vendors").doc(vendorId).get();
        if (!vendorDoc.exists) {
            logger.error(`Vendor ${vendorId} not found`);
            return;
        }
        const vendor = vendorDoc.data();
        // 2. Fetch Previous Context (Last Outreach Sent)
        // Ideally query for the last OUTREACH_SENT activity
        const lastOutreachSnapshot = await db.collection("vendor_activities")
            .where("vendorId", "==", vendorId)
            .where("type", "==", "OUTREACH_SENT")
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        const previousContext = !lastOutreachSnapshot.empty ?
            lastOutreachSnapshot.docs[0].data().description :
            "Initial outreach sent.";
        // 3. Analyze Message
        const analysis = await (0, outreach_1.analyzeIncomingMessage)(vendor, activity.description, previousContext);
        logger.info(`Analysis result for ${vendorId}: ${JSON.stringify(analysis)}`);
        // 4. Take Action based on Intent
        let newStatus = vendor === null || vendor === void 0 ? void 0 : vendor.status;
        let actionDescription = "";
        if (analysis.intent === 'INTERESTED') {
            newStatus = 'NEGOTIATING';
            actionDescription = "Vendor expressed interest. Status updated to NEGOTIATING.";
        }
        else if (analysis.intent === 'NOT_INTERESTED') {
            newStatus = 'REJECTED';
            actionDescription = "Vendor not interested. Status updated to REJECTED.";
        }
        else if (analysis.intent === 'QUESTION') {
            newStatus = 'NEGOTIATING'; // Move to negotiating so we handle the Q
            actionDescription = "Vendor has a question.";
        }
        else {
            actionDescription = "AI could not determine clear intent.";
        }
        // 5. Update Status if changed
        if (newStatus && newStatus !== (vendor === null || vendor === void 0 ? void 0 : vendor.status)) {
            await db.collection("vendors").doc(vendorId).update({
                status: newStatus,
                statusUpdatedAt: new Date()
            });
            // Log the status change
            await db.collection("vendor_activities").add({
                vendorId: vendorId,
                type: 'STATUS_CHANGE',
                description: actionDescription,
                createdAt: new Date(),
                metadata: {
                    oldStatus: vendor === null || vendor === void 0 ? void 0 : vendor.status,
                    newStatus: newStatus,
                    aiIntent: analysis.intent
                }
            });
        }
        // 6. Draft/Send Reply (Log as AI_REPLY)
        await db.collection("vendor_activities").add({
            vendorId: vendorId,
            type: 'AI_REPLY',
            description: analysis.reply,
            createdAt: new Date(), // Slightly after the inbound
            metadata: {
                intent: analysis.intent,
                inReplyTo: event.params.activityId
            }
        });
    }
    catch (error) {
        logger.error("Error processing inbound message:", error);
    }
});
//# sourceMappingURL=onIncomingMessage.js.map