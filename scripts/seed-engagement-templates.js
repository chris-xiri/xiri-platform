/**
 * Seed warm/cold template variants and 4th follow-up template.
 * 
 * Usage: node scripts/seed-engagement-templates.js
 */
const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const templates = [
    // ─── Follow-Up #2 Warm (opened/clicked previous email) ───
    {
        id: 'vendor_outreach_2_warm',
        name: 'Follow-Up #1 — Warm (Opened)',
        category: 'vendor',
        description: 'Sent when vendor opened/clicked the initial outreach. More direct, acknowledges interest.',
        subject: 'Saw you checked us out — quick question, {{contactName}}',
        body: `Hi {{contactName}},

I noticed you took a look at the {{specialty}} jobs we have available in {{city}} — sounds like you might be looking for work.

Here's the deal: we have recurring nightly contracts at medical offices and commercial sites. You clean. We handle every other part — finding clients, invoicing, scheduling, client management.

Check what's available near you:
{{onboardingUrl}}

Any questions? Just hit reply.

Best,
Chris
XIRI Facility Solutions`,
        content: 'Warm follow-up for vendors who opened/clicked the initial outreach email.',
    },

    // ─── Follow-Up #2 Cold (delivered but not opened) ───
    {
        id: 'vendor_outreach_2_cold',
        name: 'Follow-Up #1 — Cold (No Open)',
        category: 'vendor',
        description: 'Sent when initial email was delivered but never opened. Different subject line angle.',
        subject: '{{specialty}} crews needed in {{city}} — steady nightly routes',
        body: `Hi {{contactName}},

Not sure if my last email got buried — so I'll keep this short.

We have {{specialty}} contracts available in {{city}}. Recurring nightly work at medical offices and commercial buildings.

XIRI handles:
✅ Finding you clients
✅ Scheduling your routes
✅ Getting you paid — automatically

See what jobs are available:
{{onboardingUrl}}

Best,
Chris
XIRI Facility Solutions`,
        content: 'Cold follow-up for vendors who never opened the initial email. Different subject line and angle.',
    },

    // ─── Follow-Up #3 Warm ───
    {
        id: 'vendor_outreach_3_warm',
        name: 'Follow-Up #2 — Warm',
        category: 'vendor',
        description: 'Second follow-up for engaged vendors. Social proof angle.',
        subject: 'Other {{specialty}} pros in {{city}} are already getting routed',
        body: `Hey {{contactName}},

Quick update — {{specialty}} contractors in the {{city}} area are getting matched with recurring jobs through us. The ones who joined early are the ones with the best routes.

If you've been thinking about it, check what's still available:
{{onboardingUrl}}

Happy to answer any questions — just reply here.

Chris
XIRI Facility Solutions`,
        content: 'Warm follow-up #2 with social proof angle.',
    },

    // ─── Follow-Up #3 Cold ───
    {
        id: 'vendor_outreach_3_cold',
        name: 'Follow-Up #2 — Cold',
        category: 'vendor',
        description: 'Second follow-up for unengaged vendors. Direct value prop.',
        subject: 'What if you never had to do sales again, {{contactName}}?',
        body: `Hi {{contactName}},

I know your inbox is busy, so I'll be direct:

We have {{specialty}} contracts in {{city}} that need crews. You do the work. We handle everything else — sales, billing, client management.

No sales calls. No chasing payments. Just steady work.

See what's available near you:
{{onboardingUrl}}

Chris
XIRI Facility Solutions`,
        content: 'Cold follow-up #2 with strong value proposition.',
    },

    // ─── Follow-Up #4 (Standard — final breakup email) ───
    {
        id: 'vendor_outreach_5',
        name: 'Follow-Up #4 — Last Chance',
        category: 'vendor',
        description: 'Final breakup email. Creates urgency without being pushy.',
        subject: 'Last note — {{contactName}}',
        body: `Hi {{contactName}},

This is my last follow-up — I don't want to keep filling your inbox.

If {{vendorName}} ever wants steady {{specialty}} work in {{city}} without the sales grind, the link still works:
{{onboardingUrl}}

If the timing isn't right, no worries at all. You can always reach out whenever you're ready.

All the best,
Chris
XIRI Facility Solutions`,
        content: 'Final breakup email creating urgency without being pushy.',
    },

    // ─── Follow-Up #4 Warm ───
    {
        id: 'vendor_outreach_5_warm',
        name: 'Follow-Up #4 — Warm (Last Chance)',
        category: 'vendor',
        description: 'Final email for engaged vendors who still haven\'t signed up.',
        subject: 'Still looking for work? Let me make this easy — {{contactName}}',
        body: `Hey {{contactName}},

I can see you've been checking out what we have available — so let me make this as easy as possible.

Here's what happens when you sign up:
1️⃣ You fill out a quick 5-min profile
2️⃣ We match you with facility jobs near {{city}}
3️⃣ You start getting scheduled routes

No upfront costs. No commitment. Just more work.

Last chance to see what's available:
{{onboardingUrl}}

After this, I'll step back — but you can always come back later.

Chris
XIRI Facility Solutions`,
        content: 'Warm final email for engaged vendors.',
    },

    // ─── Follow-Up #4 Cold ───
    {
        id: 'vendor_outreach_5_cold',
        name: 'Follow-Up #4 — Cold (Last Chance)',
        category: 'vendor',
        description: 'Final email for unengaged vendors. Very short, zero pressure.',
        subject: 'No hard feelings — {{contactName}}',
        body: `Hi {{contactName}},

I've reached out a few times about {{specialty}} work available in {{city}}.

I get it — not everyone's looking right now.

I'll step back, but if things change, the link below still works:
{{onboardingUrl}}

All the best,
Chris
XIRI Facility Solutions`,
        content: 'Cold final breakup email. Very short, zero pressure.',
    },
];

async function seed() {
    console.log(`Seeding ${templates.length} engagement template variants...\n`);

    for (const t of templates) {
        const { id, ...data } = t;
        await db.collection('templates').doc(id).set({
            ...data,
            stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });
        console.log(`  ✅ ${id}: ${data.name}`);
    }

    // Also initialize stats on existing templates
    const existing = ['vendor_outreach_1', 'vendor_outreach_2', 'vendor_outreach_3'];
    for (const id of existing) {
        const doc = await db.collection('templates').doc(id).get();
        if (doc.exists && !doc.data()?.stats) {
            await db.collection('templates').doc(id).update({
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
            });
            console.log(`  📊 ${id}: initialized stats`);
        }
    }

    console.log('\n✅ Done!');
    process.exit(0);
}

seed().catch(err => { console.error('❌', err); process.exit(1); });
