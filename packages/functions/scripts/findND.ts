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
        const snap = await db.collection("companies").get();
        let ndId = "";
        snap.forEach(doc => {
            if(doc.data().businessName?.toLowerCase().includes("national dental")) {
                console.log("Found company:", doc.id, doc.data().businessName);
                ndId = doc.id;
            }
        });

        if (ndId) {
            const contacts = await db.collection("contacts").where("companyId", "==", ndId).get();
            contacts.forEach(c => {
                console.log("Contact:", c.id, c.data().email, "createdAt:", !!c.data().createdAt, "lastEvent:", c.data().emailEngagement?.lastEvent, "unsc:", c.data().unsubscribed);
            });
        }
    } catch (e) {
        console.error("Error", e);
    }
}

run();
