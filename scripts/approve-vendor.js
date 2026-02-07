const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
admin.initializeApp({ projectId: "xiri-platform" });
const db = admin.firestore();

async function approveVendor() {
    console.log("Approving Advanced Plumbing (simulating UI)...");
    const snapshot = await db.collection('vendors')
        .where('companyName', '==', 'Advanced Plumbing')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("Rapid Roofers not found.");
        return;
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({ status: 'APPROVED' });
    console.log(`Vendor ${doc.id} updated to APPROVED.`);
}

approveVendor();
