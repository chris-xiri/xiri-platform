const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
admin.initializeApp({ projectId: "xiri-platform" });
const db = admin.firestore();

async function resetVendor() {
    console.log("Resetting Rapid Roofers...");
    const snapshot = await db.collection('vendors')
        .where('companyName', '==', 'Rapid Roofers')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("Rapid Roofers not found. Cannot reset.");
        return;
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({ status: 'PENDING_REVIEW' });
    console.log(`Vendor ${doc.id} reset to PENDING_REVIEW.`);

    // Optional: Clear activities to have a clean slate
    const acts = await db.collection('vendor_activities').where('vendorId', '==', doc.id).get();
    const batch = db.batch();
    acts.forEach(a => batch.delete(a.ref));
    await batch.commit();
    console.log(`Cleared ${acts.size} activities.`);
}

resetVendor();
