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
        console.log("Looking for clicked contacts...");
        const contactsSnap = await db.collection("contacts").get();
        let clickedCount = 0;
        contactsSnap.forEach(c => {
            const data = c.data();
            if (data.emailEngagement && data.emailEngagement.lastEvent === 'clicked') {
                console.log(`Clicked contact: ${data.email} (${data.companyName})`);
                clickedCount++;
            }
        });
        console.log(`Total clicked: ${clickedCount}`);
    } catch (e) {
        console.error("Error", e);
    }
}

run();
