/**
 * Seed email_senders collection — configurable sender profiles for outreach.
 * Each pipeline/template references a sender ID from this collection.
 *
 * Usage: node scripts/seed-email-senders.js
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});
const db = admin.firestore();

const senders = [
    {
        id: 'partnerships',
        name: 'XIRI Partnerships',
        email: 'partnerships@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Vendor/contractor partnership outreach',
        context: 'vendor',
    },
    {
        id: 'sales',
        name: 'Chris Leung — XIRI',
        email: 'chris@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Sales lead outreach (tenant, enterprise, referral)',
        context: 'lead',
    },
    {
        id: 'onboarding',
        name: 'XIRI Facility Solutions',
        email: 'onboarding@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Onboarding invites and confirmations',
        context: 'onboarding',
    },
    {
        id: 'compliance',
        name: 'XIRI Compliance',
        email: 'compliance@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Document verification and compliance notices',
        context: 'compliance',
    },
    {
        id: 'billing',
        name: 'XIRI Facility Solutions',
        email: 'billing@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Invoices, payment confirmations, billing notices',
        context: 'billing',
    },
    {
        id: 'quotes',
        name: 'XIRI Facility Solutions',
        email: 'quotes@xiri.ai',
        replyTo: 'chris@xiri.ai',
        description: 'Quote proposals and responses',
        context: 'quotes',
    },
];

async function main() {
    console.log(`\nSeeding ${senders.length} email senders...\n`);

    for (const sender of senders) {
        const { id, ...data } = sender;
        await db.collection('email_senders').doc(id).set({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });
        console.log(`  ✅ ${id}: ${data.name} <${data.email}>`);
    }

    console.log(`\nDone! ${senders.length} senders seeded.\n`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
