import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { analyzeIncomingMessage } from "../agents/outreach";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

export const onIncomingMessage = onDocumentCreated("vendor_activities/{activityId}", async (event) => {
    if (!event.data) return;

    const activity = event.data.data();
    const vendorId = activity.vendorId;

    // Only process INBOUND_REPLY type
    if (activity.type !== 'INBOUND_REPLY') return;

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
        const analysis = await analyzeIncomingMessage(vendor, activity.description, previousContext);

        logger.info(`Analysis result for ${vendorId}: ${JSON.stringify(analysis)}`);

        // 4. Take Action based on Intent
        let newStatus = vendor?.status;
        let actionDescription = "";

        if (analysis.intent === 'INTERESTED') {
            newStatus = 'NEGOTIATING';
            actionDescription = "Vendor expressed interest. Status updated to NEGOTIATING.";
        } else if (analysis.intent === 'NOT_INTERESTED') {
            newStatus = 'REJECTED';
            actionDescription = "Vendor not interested. Status updated to REJECTED.";
        } else if (analysis.intent === 'QUESTION') {
            newStatus = 'NEGOTIATING'; // Move to negotiating so we handle the Q
            actionDescription = "Vendor has a question.";
        } else {
            actionDescription = "AI could not determine clear intent.";
        }

        // 5. Update Status if changed
        if (newStatus && newStatus !== vendor?.status) {
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
                    oldStatus: vendor?.status,
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

    } catch (error) {
        logger.error("Error processing inbound message:", error);
    }
});
