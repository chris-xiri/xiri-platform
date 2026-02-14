const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'; // Force emulator
admin.initializeApp({ projectId: "xiri-platform" });
const db = admin.firestore();

async function checkVendors() {
    console.log("Checking Firestore for vendors...");
    const snapshot = await db.collection('vendors').get();
    if (snapshot.empty) {
        console.log("No vendors found in 'vendors' collection.");
    } else {
        console.log(`Found ${snapshot.size} vendors:`);
        snapshot.forEach(doc => {
            console.log(`- [${doc.id}] Status: ${doc.data().status}, Name: ${doc.data().companyName}, Outreach: ${doc.data().outreachStatus || 'N/A'}`);
        });
    }
}

checkVendors();
