import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * When a contact is deleted from Firestore, cancel all their
 * pending/retry outreach queue tasks so they never receive another email.
 */
export const onContactDeleted = onDocumentDeleted("contacts/{contactId}", async (event) => {
    const contactId = event.params.contactId;
    const deletedData = event.data?.data();
    const email = deletedData?.email || "unknown";
    const companyId = deletedData?.companyId || null;

    logger.info(`[ContactCleanup] Contact ${contactId} (${email}) deleted. Cancelling pending tasks.`);

    // Cancel tasks by contactId
    const contactTasks = await db.collection("outreach_queue")
        .where("contactId", "==", contactId)
        .where("status", "in", ["PENDING", "RETRY"])
        .get();

    // Also cancel tasks by leadId (companyId) to catch older tasks
    // that may not have contactId set
    let leadTasks: admin.firestore.QuerySnapshot | null = null;
    if (companyId) {
        leadTasks = await db.collection("outreach_queue")
            .where("leadId", "==", companyId)
            .where("status", "in", ["PENDING", "RETRY"])
            .get();
    }

    const batch = db.batch();
    let count = 0;

    const seen = new Set<string>();

    for (const doc of contactTasks.docs) {
        batch.update(doc.ref, { status: "CANCELLED", cancelledAt: new Date() });
        seen.add(doc.id);
        count++;
    }

    if (leadTasks) {
        for (const doc of leadTasks.docs) {
            if (!seen.has(doc.id)) {
                // Only cancel if the task's email matches the deleted contact
                const taskEmail = doc.data().metadata?.email;
                if (taskEmail === email) {
                    batch.update(doc.ref, { status: "CANCELLED", cancelledAt: new Date() });
                    count++;
                }
            }
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    logger.info(`[ContactCleanup] Cancelled ${count} pending task(s) for deleted contact ${contactId} (${email}).`);
});
