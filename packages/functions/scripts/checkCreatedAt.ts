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
        const snap = await db.collection("contacts")
            .where("emailEngagement.lastEvent", "==", "clicked")
            .get();

        snap.forEach(doc => {
            const data = doc.data();
            console.log(`Contact ID: ${doc.id}, Email: ${data.email}, CreatedAt: ${!!data.createdAt}`);
        });

    } catch (e) {
        console.error("Error", e);
    }
}

run();
