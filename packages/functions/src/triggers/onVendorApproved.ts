import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";


if (!admin.apps.length) {
    admin.initializeApp();
}
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
                createdAt: new Date(),
                metadata: {
                    oldStatus: oldData.status,
                    newStatus: newData.status
                }
            });

            // 1b. Update Vendor Document with Outreach Status
            await event.data.after.ref.update({
                outreachStatus: 'PENDING',
                statusUpdatedAt: new Date()
            });

            // 2. Enqueue Outreach Generation Task
            // Decoupled for resilience (429 retries) and smart scheduling
            const { enqueueTask } = await import("../utils/queueUtils");

            await enqueueTask(db, {
                vendorId: vendorId,
                type: 'GENERATE',
                scheduledAt: new Date() as any, // Process immediately
                metadata: {
                    status: newData.status,
                    hasActiveContract: newData.hasActiveContract,
                    phone: newData.phone,
                    companyName: newData.companyName,
                    specialty: newData.specialty
                }
            });

            logger.info(`Outreach generation task enqueued for vendor ${vendorId}`);
        } catch (error) {
            logger.error("Error in onVendorApproved workflow:", error);
        }
    }
});
