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

I noticed you took a look at our partnership details — that tells me you're at least curious about what XIRI can do for {{vendorName}}.

Here's the quick version: we handle all the sales, scheduling, and client management. You just do what you do best — {{specialty}}.

No cold calling, no chasing invoices, no admin headaches.

Takes about 5 minutes to get started:
{{onboardingUrl}}

Any questions? Just hit reply — I read every one.

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
        subject: '{{contactName}}, contractors in {{city}} are getting booked through us',
        body: `Hi {{contactName}},

Not sure if my last email got buried — so I'll keep this short.

We're connecting {{specialty}} contractors in {{city}} with steady, recurring facility work. No bidding wars, no chasing payments.

XIRI handles:
✅ Finding you clients
✅ Scheduling your jobs
✅ Getting you paid on time

Sound interesting? Takes 5 minutes:
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
        subject: 'Other {{specialty}} pros in {{city}} are already on board',
        body: `Hey {{contactName}},

Quick update — we've been onboarding {{specialty}} contractors in the {{city}} area, and the feedback has been great.

Most of our partners tell us the best part is not having to chase down new clients or deal with invoicing anymore.

If you've been thinking about it, now's a good time to join:
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
        description: 'Second follow-up for unengaged vendors. Value prop angle.',
        subject: 'What if you never had to do sales again?',
        body: `Hi {{contactName}},

I know your inbox is busy, so I'll be direct:

XIRI is looking for quality {{specialty}} contractors in {{city}}. We bring you the clients. You do the work. We handle everything else.

No contracts to chase. No sales calls. No paperwork.

If that sounds like something you'd be into:
{{onboardingUrl}}

No pressure — but the spots in your area won't last forever.

Chris
XIRI Facility Solutions`,
        content: 'Cold follow-up #2 with strong value proposition.',
    },

    // ─── Follow-Up #4 (Standard — final breakup email) ───
    {
        id: 'vendor_outreach_5',
        name: 'Follow-Up #4 — Last Chance',
        category: 'vendor',
        description: 'Final "breakup" email. Creates urgency without being pushy.',
        subject: 'Closing the loop — {{contactName}}',
        body: `Hi {{contactName}},

This is my last follow-up — I don't want to keep filling your inbox.

If {{vendorName}} is interested in getting matched with facility clients in {{city}}, the door is still open:
{{onboardingUrl}}

If the timing isn't right, no worries at all. I'll close out your file for now, and you can always reach out whenever you're ready.

Wishing you the best,
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
        subject: 'Still interested? Let me make this easy — {{contactName}}',
        body: `Hey {{contactName}},

I can see you've been checking out what XIRI has to offer — so I want to make this as easy as possible.

Here's what happens when you sign up:
1️⃣ You fill out a quick 5-min profile
2️⃣ We match you with facility clients near {{city}}
3️⃣ You start getting scheduled jobs

No upfront costs. No commitments. Just more work.

Last chance to jump in:
{{onboardingUrl}}

After this, I'll close your file — but you can always come back later.

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

I've reached out a few times about partnering with XIRI for {{specialty}} work in {{city}}.

I get it — not everyone's looking for new clients right now.

I'm going to close out your file, but if things change, the link below still works:
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
