import * as admin from 'firebase-admin';

// Initialize firebase admin
const serviceAccount = require('../../../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    try {
        console.log("Looking for Minuteman Press company...");
        const companySnap = await db.collection("companies").doc("KV1S7H06NV322lhnrcNN").get();
        if (!companySnap.exists) {
            console.log("Minuteman Press not found in companies.");
        } else {
            console.log(`Company ID: KV1S7H06NV322lhnrcNN`);
            console.log(JSON.stringify(companySnap.data(), null, 2));

            const contactsSnap = await db.collection("contacts").where("companyId", "==", "KV1S7H06NV322lhnrcNN").get();
            console.log(`Found ${contactsSnap.size} contacts for this company.`);
            contactsSnap.forEach(c => {
                console.log(`Contact ID: ${c.id}`);
                console.log(JSON.stringify(c.data(), null, 2));
            });
        }
    } catch (e) {
        console.error("Error", e);
    }
}

run();
