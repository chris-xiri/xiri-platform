const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const saPath = path.join(__dirname, '..', 'service-account.json');
    if (fs.existsSync(saPath)) {
        const serviceAccount = require(saPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'xiri-facility-solutions',
        });
    } else {
        admin.initializeApp({
            projectId: 'xiri-facility-solutions',
        });
    }
}
const db = admin.firestore();

async function triggerReverification() {
    console.log("🔄 Resetting status to PENDING for all vendor ACORD 25 PDFs to trigger Cloud Function re-verification...");

    const snapshot = await db.collection('vendors').get();
    if (snapshot.empty) {
        console.log("No vendors found.");
        return;
    }

    let count = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const vendorData = doc.data();
        const acord25 = vendorData.compliance?.acord25;
        if (acord25?.url) {
            count++;
            console.log(`  -> Queuing re-verification for vendor: ${vendorData.businessName || doc.id}`);
            batch.update(doc.ref, {
                'compliance.acord25.status': 'PENDING',
                'compliance.acord25.retriggeredAt': admin.firestore.FieldValue.serverTimestamp(),
                dispatchBlocked: true,
                dispatchBlockReason: 'Insurance verification pending or non-compliant',
                canAcceptWork: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully queued ${count} vendor ACORD 25 PDFs for re-verification!`);
        console.log("Firebase Cloud Functions will automatically process each PDF in the background using the active Gemini Flash model.");
    } else {
        console.log("No vendors with ACORD 25 URLs found.");
    }
}

triggerReverification().then(() => process.exit(0)).catch(err => {
    console.error("Failed to trigger re-verification:", err);
    process.exit(1);
});
