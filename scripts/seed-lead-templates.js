/**
 * Seed LEAD outreach templates (tenant + referral partnership) into Firestore.
 * Each step has standard, _warm, and _cold variants for engagement-based routing.
 *
 * Usage:  node scripts/seed-lead-templates.js
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});
const db = admin.firestore();

// ═══════════════════════════════════════════════════════════
// TENANT LEAD TEMPLATES (direct/tenant — Northwell affiliates etc.)
// ═══════════════════════════════════════════════════════════
const TENANT_LEAD = [
    // ── Step 1: Introduction ──
    {
        id: 'tenant_lead_1',
        name: 'Introduction — Accountability Hook',
        sequence: 1,
        subject: 'Do you know if {{businessName}} actually got cleaned last night?',
        body: `Hi {{contactName}},

Quick question — do you know if your building got cleaned last night? Not "I think so" — do you have proof?

Most facility managers can't answer that. That's why we built XIRI differently.

We put NFC chips in every room of your facility. Your cleaning crew taps in when they arrive, works a room-by-room checklist, and taps out. Every morning, you see exactly what was done — room by room, task by task, with timestamps.

If a room gets skipped, you know before you walk in.

We manage over 20 medical and commercial facilities across Nassau County and Queens. Same cleaning services you'd expect — janitorial, deep cleans, day porters — but with built-in proof of work.

Worth a quick 10-minute conversation?

Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },

    // ── Step 2: Value Proposition ──
    {
        id: 'tenant_lead_2',
        name: 'Value Proposition — Verification',
        sequence: 2,
        subject: 'What happens in {{businessName}} at midnight?',
        body: `Hi {{contactName}},

Following up on my last email — here's the thing about facility cleaning:

Your current vendor might be doing a great job. But you're trusting, not verifying. Every night, someone has unsupervised access to your building, and your only evidence it got cleaned is that there aren't complaints the next morning.

XIRI gives you a compliance log — a live, digital record of every cleaning session:

✓ Which rooms were serviced (and which weren't)
✓ Exactly when the crew arrived and left
✓ Task-by-task completion for each zone
✓ All viewable on your phone the next morning

This isn't software you have to manage — it runs automatically. We handle the cleaning, the crew, and the accountability.

Would a free walkthrough of {{businessName}} be helpful? No pressure — just an honest assessment.

Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'tenant_lead_2_warm',
        name: 'Value Prop — Warm',
        sequence: 2,
        variant: 'warm',
        subject: 'Here\'s what your compliance log looks like',
        body: `Hi {{contactName}},

Since you've been reading — here's what a XIRI compliance log actually looks like for a facility your size:

→ 4 zones checked: Lobby, Restrooms, Exam Rooms, Break Room
→ Clock-in: 10:47 PM | Clock-out: 12:12 AM
→ 23 tasks completed across all zones
→ Accessible via a shareable link — no login needed

You can share this link with inspectors, landlords, or corporate compliance. Proof of work every single night, without lifting a finger.

Want me to mock one up for {{businessName}}? Takes 24 hours.

Chris Leung`,
    },
    {
        id: 'tenant_lead_2_cold',
        name: 'Value Prop — Cold',
        sequence: 2,
        variant: 'cold',
        subject: 'The one question your cleaner can\'t answer',
        body: `Hi {{contactName}},

Here's a question to ask your current cleaning company:

"Can you show me proof that Suite [X] was cleaned last Tuesday night?"

If the answer is a pause, a vague "yes," or nothing — that's the gap we fill.

XIRI provides timestamped, room-by-room verification for every cleaning session. Not because your cleaner is bad — because you deserve to know.

If this ever matters to you, I'm here. Just reply.

Chris Leung
XIRI Facility Solutions`,
    },

    // ── Step 3: Social Proof ──
    {
        id: 'tenant_lead_3',
        name: 'Social Proof — Discovery Story',
        sequence: 3,
        subject: 'Why a 4-location urgent care fired their cleaning company',
        body: `Hi {{contactName}},

A multi-location urgent care in Nassau County had the same cleaning company for 6 years. Good relationship. No major complaints.

Then they installed our NFC proof-of-work system and discovered:

→ 2 of 4 locations were being cleaned in under 40 minutes (should take 90+)
→ Restrooms were routinely skipped on Fridays
→ The "deep clean" they paid for monthly wasn't happening

They didn't fire their cleaner because the quality was bad. They fired them because they finally had the data to see what was actually happening.

Now they have XIRI — same services, but with verifiable proof every single night.

Want to see what the data looks like for {{businessName}}?

Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'tenant_lead_3_warm',
        name: 'Social Proof — Warm',
        sequence: 3,
        variant: 'warm',
        subject: 'The math behind verified cleaning',
        body: `Hi {{contactName}},

Here's what happened when we put data behind a client's cleaning:

Before: $4,200/month across 3 vendors, no verification, 2-3 complaints/week
After: $3,100/month with XIRI, NFC proof-of-work, zero complaints in 90 days

The savings came from eliminating undocumented "deep cleans" they were paying for but never receiving.

That's $13,200/year in savings — plus the peace of mind of knowing exactly what happened every night.

Want me to run the numbers for {{businessName}}?

Chris Leung`,
    },
    {
        id: 'tenant_lead_3_cold',
        name: 'Social Proof — Cold',
        sequence: 3,
        variant: 'cold',
        subject: '15 seconds — one thing no other cleaning company offers',
        body: `Hi {{contactName}},

No other cleaning company on Long Island gives you this:

A digital compliance log proving your building was cleaned — room by room, task by task, with timestamps. Every night.

That's it. If you want to see what it looks like, reply here. If not, no worries.

Chris Leung
XIRI Facility Solutions`,
    },

    // ── Step 4: Final Check-in ──
    {
        id: 'tenant_lead_4',
        name: 'Final Check-in — Accountability Close',
        sequence: 4,
        subject: 'Last note — one thing to remember about XIRI',
        body: `Hi {{contactName}},

This is my last email — I know you're busy running {{businessName}}.

If you take one thing away from my emails, it's this:

You should be able to verify your building was cleaned. Not assume. Not hope. Verify.

If that ever becomes important — after a failed inspection, a tenant complaint, or just a gut feeling that something isn't right — I'm here.

xiri.ai/contact | chris@xiri.ai

Kind Regards,
Chris Leung
XIRI Facility Solutions`,
    },
];

// ═══════════════════════════════════════════════════════════
// REFERRAL PARTNERSHIP TEMPLATES (CRE brokers, property mgmt)
// ═══════════════════════════════════════════════════════════
const REFERRAL_PARTNERSHIP = [
    // ── Step 1: Intro ──
    {
        id: 'referral_partnership_1',
        name: 'Partnership Introduction — Accountability Angle',
        sequence: 1,
        subject: 'A facility partner your tenants will actually thank you for',
        body: `Hi {{contactName}},

I'm Chris, founder of XIRI Facility Solutions. We manage cleaning and maintenance for commercial tenants across Queens and Nassau County.

Here's why brokers send tenants our way:

We give every tenant a live compliance log — a digital record proving their building was cleaned every night, room by room, with timestamps. Their tenants can share it with inspectors, corporate, or landlords.

No other cleaning company offers this. Your tenants notice.

For every referral that converts to a recurring contract, we pay a referral fee. Zero effort after the intro — we handle proposals, contracts, and ongoing service.

Worth a quick call?

Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },

    // ── Step 2: Follow-up ──
    {
        id: 'referral_partnership_2',
        name: 'Follow-up — Accountability Value',
        sequence: 2,
        subject: 'The question your tenants will ask their next cleaner',
        body: `Hi {{contactName}},

Here's what happens after a tenant experiences verified cleaning from XIRI:

They never go back to blind trust. They start asking every cleaning vendor: "Can you show me proof you cleaned last night?"

That's the value you're giving your tenants when you refer XIRI — a standard of accountability they didn't know existed.

For you:
✓ Referral fee on every recurring contract
✓ Zero effort — one intro email, we handle the rest
✓ Tenants associate you with quality (not just square footage)

Would you be open to trying it with one tenant?

Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'referral_partnership_2_warm',
        name: 'Follow-up — Warm',
        sequence: 2,
        variant: 'warm',
        subject: 'How other brokers are using our partnership',
        body: `Hi {{contactName}},

Since you've been reading my notes, I thought you'd appreciate a real example:

One broker in Garden City referred 3 tenants in Q4 last year. Each one converted to a recurring janitorial contract. That's ongoing referral income for a 2-minute email introduction.

The tenants love it because they get a vetted, insured facility partner on day one — with NFC-verified proof of work their current cleaner can't match. The broker looks great for making the connection.

Want to try it with one tenant? No commitment.

Best,
Chris Leung`,
    },
    {
        id: 'referral_partnership_2_cold',
        name: 'Follow-up — Cold',
        sequence: 2,
        variant: 'cold',
        subject: 'One more thought — tenant services',
        body: `Hi {{contactName}},

I know you're busy with deals, so here's the 10-second version:

Next time a tenant asks "do you know a good cleaning company?" — send them our way. We're the only facility partner that gives tenants verified proof of work every night. We handle everything, and you get a referral fee.

Reply "yes" and I'll send you a one-pager you can forward.

Best,
Chris Leung`,
    },

    // ── Step 3: Final ──
    {
        id: 'referral_partnership_3',
        name: 'Final Check-in — Partnership',
        sequence: 3,
        subject: 'Final check-in — Partnership Opportunity',
        body: `Hi {{contactName}},

This will be my last note on this. I know timing is everything in CRE.

If you ever have a tenant who needs facility services — move-in cleaning, janitorial, or anything in between — I'm just an email away.

The referral program stays open, so no rush.

Wishing you a strong quarter ahead.

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
];

// ═══════════════════════════════════════════════════════════

async function seed() {
    const allTemplates = [
        ...TENANT_LEAD.map(t => ({ ...t, category: 'tenant_lead', type: 'template' })),
        ...REFERRAL_PARTNERSHIP.map(t => ({ ...t, category: 'referral_partnership', type: 'template' })),
    ];

    console.log(`Seeding ${allTemplates.length} lead outreach templates...\n`);

    for (const t of allTemplates) {
        const { id, ...data } = t;
        // Extract variables from body/subject
        const vars = [...new Set(
            [...(data.body || '').matchAll(/\{\{(\w+)\}\}/g), ...(data.subject || '').matchAll(/\{\{(\w+)\}\}/g)]
                .map(m => m[1])
        )];

        await db.collection('templates').doc(id).set({
            ...data,
            variables: vars,
            stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });

        const label = data.variant ? ` (${data.variant})` : '';
        console.log(`  ✅ ${id}: ${data.name}${label}`);
    }

    console.log(`\nDone! ${allTemplates.length} templates seeded.`);
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
