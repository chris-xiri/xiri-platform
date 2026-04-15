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
        console.log("Looking for National Dental...");
        const companySnap = await db.collection("companies").where("businessName", "==", "National Dental").get();
        if (companySnap.empty) {
            console.log("Not found in companies.");
        } else {
            for (const doc of companySnap.docs) {
                console.log(`Company ID: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));

                const contactsSnap = await db.collection("contacts").where("companyId", "==", doc.id).get();
                console.log(`Found ${contactsSnap.size} contacts for this company.`);
                contactsSnap.forEach(c => {
                    console.log(`Contact ID: ${c.id}`);
                    console.log(JSON.stringify(c.data(), null, 2));
                });
            }
        }
    } catch (e) {
        console.error("Error", e);
    }
}

run();
