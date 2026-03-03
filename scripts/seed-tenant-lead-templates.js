/**
 * Seed tenant/direct lead outreach templates into Firestore.
 * 4-step drip sequence with {{variable}} merge fields.
 *
 * Usage:  node scripts/seed-tenant-lead-templates.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const templates = [
    {
        id: 'tenant_lead_1',
        name: 'Introduction — Services Overview',
        description: 'Day 0: Initial outreach introducing XIRI services',
        sequence: 1,
        category: 'tenant_lead',
        type: 'template',
        subject: 'Facility Services for {{businessName}}',
        body: `Hi {{contactName}},

My name is Chris and I'm the founder of XIRI Facility Solutions. We provide single-source facility management for medical practices and commercial tenants across Nassau County and Queens.

I noticed {{businessName}} at {{address}} and wanted to reach out — we specialize in:

• Nightly Janitorial & Sanitization
• Medical-Grade Deep Cleaning
• Day Porter Services
• Emergency Response Cleaning

We currently serve over 20 medical and commercial facilities, handling everything so your team can focus on what matters most.

Would you be open to a quick 10-minute call this week to see if we can help?

Kind Regards,
Chris Leung
XIRI Facility Solutions
(516) 234-5678`,
        variables: ['contactName', 'businessName', 'address'],
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    },
    {
        id: 'tenant_lead_2',
        name: 'Value Proposition — Time Savings',
        description: 'Day 3: Follow-up emphasizing time/cost savings',
        sequence: 2,
        category: 'tenant_lead',
        type: 'template',
        subject: 'Quick follow-up — saving 15+ hours/month at {{businessName}}',
        body: `Hi {{contactName}},

I wanted to follow up on my previous email. I know managing facility services can be a headache — coordinating multiple vendors, dealing with inconsistent quality, and fielding complaints from staff.

That's exactly why practices like yours switch to XIRI:

✓ One point of contact for all facility needs
✓ 15+ hours/month saved on vendor coordination
✓ Consistent, inspected cleaning with photo documentation
✓ Compliance-ready for healthcare facilities

We'd love to offer a free walkthrough of {{businessName}} to show you exactly how we can help.

No pressure — just a quick assessment. Would 15 minutes work this week?

Best,
Chris Leung
XIRI Facility Solutions`,
        variables: ['contactName', 'businessName'],
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    },
    {
        id: 'tenant_lead_3',
        name: 'Social Proof — Case Study',
        description: 'Day 7: Follow-up with social proof from similar facilities',
        sequence: 3,
        category: 'tenant_lead',
        type: 'template',
        subject: 'How practices like {{businessName}} made the switch',
        body: `Hi {{contactName}},

I wanted to share a quick example of how we've helped a practice similar to yours.

A multi-location urgent care group in Nassau County was juggling 4 different cleaning vendors. After switching to XIRI:

→ Reduced their facility management time by 80%
→ Improved patient satisfaction scores related to cleanliness
→ Saved over $2,000/month by consolidating vendors
→ Achieved consistent quality across all locations

We handle everything from nightly janitorial to emergency deep cleans — all managed through a single dashboard with real-time reporting.

I'd be happy to put together a custom proposal for {{businessName}} based on your {{squareFootage}} space. Would that be helpful?

Best,
Chris Leung
XIRI Facility Solutions`,
        variables: ['contactName', 'businessName', 'squareFootage'],
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    },
    {
        id: 'tenant_lead_4',
        name: 'Final Check-in — Free Walkthrough',
        description: 'Day 14: Final follow-up with free walkthrough offer',
        sequence: 4,
        category: 'tenant_lead',
        type: 'template',
        subject: 'Last check-in — complimentary facility walkthrough',
        body: `Hi {{contactName}},

This will be my last note — I don't want to be a bother.

If facility management is something {{businessName}} is looking to simplify, I'd love to offer a complimentary walkthrough and custom proposal. No commitment, just a chance to show you what a single-source partner can do.

You can reply to this email or book a time directly: https://xiri.ai/contact

Either way, I wish you and your team all the best.

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai | (516) 234-5678`,
        variables: ['contactName', 'businessName'],
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    },
];

async function seed() {
    console.log('Seeding tenant lead outreach templates...');
    for (const t of templates) {
        const { id, ...data } = t;
        await db.collection('templates').doc(id).set({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });
        console.log(`  ✓ ${id}: ${data.name}`);
    }
    console.log(`\nDone! ${templates.length} tenant lead templates seeded.`);
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
