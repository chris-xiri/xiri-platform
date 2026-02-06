import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { generateOutreachContent } from "../agents/outreach";

const db = admin.firestore();

export const onVendorApproved = onDocumentUpdated("vendors/{vendorId}", async (event) => {
    if (!event.data) return;

    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const vendorId = event.params.vendorId;

    if (!newData || !oldData) return;

    // Check if status changed to APPROVED
    if (newData.status === 'APPROVED' && oldData.status !== 'APPROVED') {
        logger.info(`Vendor ${vendorId} approved. Triggering CRM workflow.`);

        try {
            // 1. Log Activity: "Vendor Approved"
            await db.collection("vendor_activities").add({
                vendorId: vendorId,
                type: "STATUS_CHANGE",
                description: "Vendor status updated to APPROVED by user.",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    oldStatus: oldData.status,
                    newStatus: newData.status
                }
            });

            // 2. Generate and Queue Outreach
            // We call the agent directly here for simplicity in this phase.
            // Ideally this would be offloaded if it takes > 60s, but Gemini is fast enough.

            const outreachResult = await generateOutreachContent(newData, newData.phone ? 'SMS' : 'EMAIL');

            await db.collection("vendor_activities").add({
                vendorId: vendorId,
                type: "OUTREACH_QUEUED",
                description: `Outreach draft created via ${outreachResult.channel}.`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    content: outreachResult.content,
                    channel: outreachResult.channel,
                    campaignUrgency: newData.hasActiveContract ? "URGENT" : "SUPPLY"
                }
            });

        } catch (error) {
            logger.error("Error in onVendorApproved workflow:", error);
        }
    }
});
