import * as admin from 'firebase-admin';

const serviceAccount = require('../../../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

interface LeadFunnel {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
}

async function run() {
    try {
        const snap = await db.collection("contacts").get();
        const contacts: any[] = [];
        snap.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });

        const data: LeadFunnel = { total: contacts.length, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
        for (const c of contacts) {
            if (c.unsubscribed) data.unsubscribed++;
            const eng = c.emailEngagement;
            if (!eng?.lastEvent) continue;
            data.sent++;
            switch (eng.lastEvent) {
                case 'clicked':
                    data.clicked++;
                    data.opened++;
                    data.delivered++;
                    break;
                case 'opened':
                    data.opened++;
                    data.delivered++;
                    break;
                case 'delivered':
                    data.delivered++;
                    break;
                case 'bounced':
                case 'spam':
                    data.bounced++;
                    break;
            }
        }
        
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error", e);
    }
}

run();
