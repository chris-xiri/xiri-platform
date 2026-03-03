#!/usr/bin/env node
/**
 * Seed referral partnership email templates into Firestore.
 * 
 * These are STATIC TEMPLATES (not AI prompts) — they use {{variable}} placeholders
 * that get replaced with lead data at send time.
 * 
 * Usage:
 *   node scripts/seed-referral-templates.js
 *   
 *   For emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-referral-templates.js
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

const templates = [
    {
        id: 'referral_partnership_1',
        name: 'Referral Partnership — Intro',
        type: 'template',  // NOT a prompt
        channel: 'email',
        subject: 'Referral Partnership — XIRI Facility Solutions',
        body: `Hi {{contactName}},

My name is Chris and I own XIRI Facility Solutions, a facility management business based in Queens/Nassau County.

I am reaching out because we are establishing referral partnerships with local commercial real estate brokers given your relationship with commercial tenants.

Services we offer:
• Move-in Deep Cleaning
• Move-out Deep Cleaning
• Post-Construction Clean
• Nightly Janitorial Services

Please let me know if you are interested.

Kind Regards,
Chris Leung
XIRI Facility Solutions
xiri.ai`,
        variables: ['contactName', 'businessName'],
        stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: 'referral_partnership_2',
        name: 'Referral Partnership — Follow-up 1',
        type: 'template',
        channel: 'email',
        subject: 'Following up — Referral Partnership',
        body: `Hi {{contactName}},

I wanted to follow up on my previous email about a referral partnership between XIRI Facility Solutions and {{businessName}}.

We work with medical offices, commercial tenants, and professional suites across Nassau County. When your tenants need cleaning or facility management, you'd simply refer them to us — and we take it from there.

There's no cost or commitment on your end. It's a simple way to add value to your tenant relationships.

Would you be open to a quick 5-minute call this week?

Best,
Chris Leung
XIRI Facility Solutions`,
        variables: ['contactName', 'businessName'],
        stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: 'referral_partnership_3',
        name: 'Referral Partnership — Final Follow-up',
        type: 'template',
        channel: 'email',
        subject: 'Final check-in — Partnership Opportunity',
        body: `Hi {{contactName}},

This is my last follow-up regarding a referral partnership with XIRI Facility Solutions.

If the timing isn't right, no worries at all. But if any of your commercial tenants ever need move-in/move-out cleaning, janitorial services, or facility maintenance, I'd love to be your go-to.

Feel free to reach out anytime at chris@xiri.ai or (646) 555-XIRI.

Best,
Chris Leung
XIRI Facility Solutions`,
        variables: ['contactName'],
        stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

async function main() {
    console.log('Seeding referral partnership templates...\n');

    for (const template of templates) {
        const { id, ...data } = template;
        await db.collection('templates').doc(id).set(data, { merge: true });
        console.log(`  ✅ ${id}: "${data.name}"`);
    }

    console.log(`\n📧 ${templates.length} templates seeded to Firestore 'templates' collection.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
