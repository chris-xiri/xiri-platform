const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'xiri-facility-solutions' });
const db = admin.firestore();

async function run() {
    // Check what OUTREACH_SENT activities look like — do they have metadata.resendId?
    const acts = await db.collection('vendor_activities')
        .where('type', '==', 'OUTREACH_SENT')
        .limit(5)
        .get();
    console.log(`OUTREACH_SENT count: ${acts.size}`);
    acts.docs.forEach(d => {
        const data = d.data();
        console.log(JSON.stringify({
            vendorId: data.vendorId,
            type: data.type,
            resendId: data.metadata?.resendId,
            deliveryStatus: data.metadata?.deliveryStatus,
            subject: data.metadata?.subject,
        }, null, 2));
    });
}
run().catch(e => { console.error(e.message); process.exit(1); });
