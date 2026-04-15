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
        const companyIds = ['26StUoAzyN6TPoy4WcmO', 'KV1S7H06NV322lhnrcNN', 'UJDAWVwXNyKJVB3BmEfX', 'FpD7vvAomy9YKpqWxkDX'];
        for (const cid of companyIds) {
            const doc = await db.collection('companies').doc(cid).get();
            if (doc.exists) {
                console.log(`${doc.data()?.businessName} -> Status: ${doc.data()?.status}`);
            } else {
                console.log(`Company ID ${cid} NOT FOUND`);
            }
        }
    } catch (e) {
        console.error("Error", e);
    }
}

run();
