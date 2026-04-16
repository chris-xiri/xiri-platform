import * as admin from 'firebase-admin';

const serviceAccount = require('../../../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    try {
        const contact = await db.collection("contacts").doc("UbMLIXymDeqyX0OzcFCs").get();
        console.log("Contact:", contact.data());
        
        const companyId = contact.data()?.companyId;
        if (companyId) {
            const co = await db.collection("companies").doc(companyId).get();
            console.log("Company:", co.data());
        }
    } catch (e) {
        console.error("Error", e);
    }
}

run();
