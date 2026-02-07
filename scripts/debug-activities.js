const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-platform" });
}
const db = admin.firestore();

async function checkActivities() {
    console.log("Checking for Approved Vendors and Activities...");
    const vendors = await db.collection('vendors').where('status', '==', 'APPROVED').get();

    if (vendors.empty) {
        console.log("No APPROVED vendors found yet.");
        return;
    }

    for (const doc of vendors.docs) {
        console.log(`\nVendor: ${doc.data().companyName} (${doc.id})`);
        const activities = await db.collection('vendor_activities')
            .where('vendorId', '==', doc.id)
            .orderBy('createdAt', 'desc')
            .get();

        if (activities.empty) {
            console.log("  - No activities found.");
        } else {
            activities.forEach(act => {
                const data = act.data();
                console.log(`  - [${data.type}] ${data.description}`);
                if (data.metadata) console.log(`    Metadata: ${JSON.stringify(data.metadata)}`);
            });
        }
    }
}

checkActivities();
