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
        console.log("Looking for clicked contacts with details...");
        const contactsSnap = await db.collection("contacts").get();
        contactsSnap.forEach(c => {
            const data = c.data();
            if (data.emailEngagement && data.emailEngagement.lastEvent === 'clicked') {
                console.log(`---\nContact ID: ${c.id}`);
                console.log(`Email: ${data.email}`);
                console.log(`Company ID: ${data.companyId}`);
                console.log(`Is Unsubscribed: ${data.unsubscribed}`);
            }
        });
    } catch (e) {
        console.error("Error", e);
    }
}

run();
