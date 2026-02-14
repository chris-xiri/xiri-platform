const admin = require('firebase-admin');

// Initialize (Emulator)
if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';
    admin.initializeApp({ projectId: 'xiri-facility-solutions' });
}

const db = admin.firestore();

async function checkVendors() {
    console.log("🔍 Checking latest 5 vendors...");

    const snapshot = await db.collection('vendors')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.log("❌ No vendors found in database.");
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n📄 Vendor ID: ${doc.id}`);
        console.log(`   - Name: ${data.businessName}`);
        console.log(`   - Status: '${data.status}'`);
        console.log(`   - CreatedAt: ${data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt}`);
    });
}

checkVendors();
