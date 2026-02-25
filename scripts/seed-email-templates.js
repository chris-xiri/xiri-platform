/**
 * Seed outreach email templates to Firestore
 * Run: node scripts/seed-email-templates.js
 *
 * Templates use merge fields: {{vendorName}}, {{contactName}}, {{city}}, {{state}}, {{services}}, {{specialty}}, {{onboardingUrl}}
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});
const db = admin.firestore();

const TEMPLATES = [
    {
        id: 'vendor_outreach_1',
        name: 'Initial Outreach',
        description: 'First contact — lead with available work, drive to onboarding.',
        category: 'vendor_email',
        sequence: 1,
        subject: '{{specialty}} work available in {{city}} — steady contracts',
        body: `{{contactName}},

We have facility contracts in {{city}} that need {{specialty}} crews. Recurring nightly work at medical offices and commercial sites — the kind of steady jobs that fill your calendar without the sales grind.

Here's how it works with XIRI:

• We find the clients and negotiate the contracts — you just show up and clean
• Invoices are automatic. You get paid on schedule, every month
• No client management. No chasing payments. No admin work

We only work with insured contractors (GL + WC required) — that's non-negotiable for our medical-grade sites.

If {{vendorName}} is insured and looking for consistent work, see what's available in your area:

👉 {{onboardingUrl}}

Takes about 5 minutes. No commitment — just gets you in the system for upcoming jobs.

— Chris Leung
XIRI Facility Solutions
chris@xiri.ai

¿Habla español? Nuestro formulario está disponible en español.`,
        updatedAt: new Date(),
    },
    {
        id: 'vendor_outreach_2',
        name: 'Follow-Up 1 (Day 3)',
        description: 'Day 3 follow-up — lead with the pain of chasing payments.',
        category: 'vendor_email',
        sequence: 2,
        subject: 'Re: {{specialty}} jobs in {{city}}',
        body: `{{contactName}},

Following up — we still have {{specialty}} contracts available in the {{city}} area.

Most contractors we talk to say the same thing: "I'm great at the work — it's the billing and sales that kill me." That's exactly what XIRI handles for you.

You clean. We handle the rest — client relationships, invoicing, scheduling, everything.

See what jobs are available near you:
👉 {{onboardingUrl}}

Happy to answer any questions — just reply here.

— Chris Leung
XIRI Facility Solutions

¿Habla español? Nuestro formulario está disponible en español.`,
        updatedAt: new Date(),
    },
    {
        id: 'vendor_outreach_3',
        name: 'Follow-Up 2 (Day 7)',
        description: 'Day 7 — social proof, urgency on available routes.',
        category: 'vendor_email',
        sequence: 3,
        subject: 'Crews in {{city}} are picking up routes — {{vendorName}}',
        body: `{{contactName}},

Other {{specialty}} contractors in your area are already getting matched with recurring facility jobs through XIRI — nightly routes at medical offices and commercial buildings.

If you've been on the fence, here's the short version:

✅ We bring you the work — no cold calling, no bidding
✅ We handle all the invoicing — you get paid automatically
✅ You keep doing what you're good at — we handle the rest

See what's still available in {{city}}:
👉 {{onboardingUrl}}

— Chris Leung
XIRI Facility Solutions
chris@xiri.ai

¿Habla español? Nuestro formulario está disponible en español.`,
        updatedAt: new Date(),
    },
    {
        id: 'vendor_outreach_4',
        name: 'Follow-Up 3 — Final (Day 14)',
        description: 'Final breakup email. Low pressure, leave the door open.',
        category: 'vendor_email',
        sequence: 4,
        subject: 'Last note — {{contactName}}',
        body: `{{contactName}},

I'll keep this short — I don't want to keep hitting your inbox if you're not looking for work right now.

If you're at capacity, that's great. I'll step back.

But if you ever want steady facility contracts without the sales work, the link below stays open:

👉 {{onboardingUrl}}

Either way, good luck out there.

— Chris Leung
XIRI Facility Solutions
chris@xiri.ai

¿Habla español? Nuestro formulario está disponible en español.`,
        updatedAt: new Date(),
    }
];

async function seed() {
    console.log('Seeding outreach email templates...');
    for (const t of TEMPLATES) {
        await db.collection('templates').doc(t.id).set(t, { merge: true });
        console.log(`  ✅ ${t.id}: ${t.name}`);
    }
    console.log('\nDone!');
}

seed().catch(e => { console.error(e); process.exit(1); });
