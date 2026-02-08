import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { verifyDocument } from "../agents/documentVerifier";

const db = admin.firestore();

export const onDocumentUploaded = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: ["GEMINI_API_KEY"]
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const vendorId = event.params.vendorId;

    if (!before || !after) return;

    // Check COI
    if (after.compliance?.coi?.status === 'PENDING' && before.compliance?.coi?.status !== 'PENDING') {
        console.log(`Processing COI for ${vendorId}`);
        await runVerification(vendorId, 'COI', after);
    }

    // Check W9
    if (after.compliance?.w9?.status === 'PENDING' && before.compliance?.w9?.status !== 'PENDING') {
        console.log(`Processing W9 for ${vendorId}`);
        await runVerification(vendorId, 'W9', after);
    }
});

async function runVerification(vendorId: string, docType: 'COI' | 'W9', vendorData: any) {
    try {
        const result = await verifyDocument(docType, vendorData.companyName || "Vendor", vendorData.specialty || "General");

        // Update Vendor
        const fieldPath = docType === 'COI' ? 'compliance.coi' : 'compliance.w9';
        await db.doc(`vendors/${vendorId}`).update({
            [`${fieldPath}.status`]: result.valid ? 'VERIFIED' : 'REJECTED',
            [`${fieldPath}.aiAnalysis`]: {
                valid: result.valid,
                reasoning: result.reasoning,
                extracted: result.extracted
            },
            [`${fieldPath}.verifiedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log Activity
        await db.collection('vendor_activities').add({
            vendorId: vendorId,
            type: 'AI_VERIFICATION', // New type
            description: `AI ${result.valid ? 'Verified' : 'Rejected'} ${docType}: ${result.reasoning}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                docType,
                valid: result.valid,
                extracted: result.extracted
            }
        });

    } catch (error) {
        console.error(`Verification failed for ${docType}:`, error);
    }
}
