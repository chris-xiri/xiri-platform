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
        name: 'Introduction — Services Overview',
        sequence: 1,
        subject: 'Facility Services for {{businessName}}',
        body: `Hi {{contactName}},

My name is Chris and I'm the founder of XIRI Facility Solutions. We provide single-source facility management for medical practices and commercial tenants across Nassau County and Queens.

I noticed {{businessName}} and wanted to reach out — we specialize in:

• Nightly Janitorial & Sanitization
• Medical-Grade Deep Cleaning
• Day Porter Services
• Emergency Response Cleaning

We currently serve over 20 medical and commercial facilities, handling everything so your team can focus on what matters most.

Would you be open to a quick 10-minute call this week to see if we can help?

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
    {
        id: 'tenant_lead_1_warm',
        name: 'Introduction — Warm (opened/clicked previous)',
        sequence: 1,
        variant: 'warm',
        subject: 'Quick question about {{businessName}} facility needs',
        body: `Hi {{contactName}},

Thanks for taking a look at my previous note. I wanted to follow up with a quick question:

Is {{businessName}} currently handling facility management in-house, or working with multiple vendors?

Either way, we've helped practices like yours consolidate to a single provider — saving 15+ hours/month on coordination alone.

Happy to share how in a quick 10-minute call. Would this week work?

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'tenant_lead_1_cold',
        name: 'Introduction — Cold (no engagement)',
        sequence: 1,
        variant: 'cold',
        subject: 'Simplify facility management at {{businessName}}',
        body: `Hi {{contactName}},

I know your inbox is busy, so I'll keep this brief.

XIRI Facility Solutions provides single-source facility management for medical practices — one point of contact for janitorial, deep cleaning, and day porter services.

If {{businessName}} is ever looking to simplify facility operations, I'd love to chat for 5 minutes.

No pressure at all — just reply to this email.

Best,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },

    // ── Step 2: Value Proposition ──
    {
        id: 'tenant_lead_2',
        name: 'Value Proposition — Time Savings',
        sequence: 2,
        subject: 'Quick follow-up — saving 15+ hours/month at {{businessName}}',
        body: `Hi {{contactName}},

I wanted to follow up on my previous email. Managing facility services can be a headache — coordinating multiple vendors, dealing with inconsistent quality, and fielding complaints from staff.

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
    },
    {
        id: 'tenant_lead_2_warm',
        name: 'Value Prop — Warm',
        sequence: 2,
        variant: 'warm',
        subject: 'The #1 thing practices tell us after switching',
        body: `Hi {{contactName}},

Thanks for engaging with my previous email. Here's the #1 thing practices tell us after switching to XIRI:

"I can't believe how much time I was wasting coordinating vendors."

We handle everything — nightly janitorial, deep cleans, day porter coverage — so your office manager can focus on patients, not cleaning schedules.

Want to see what this looks like for {{businessName}}? I can put together a custom proposal in 24 hours.

Just reply "interested" and I'll get started.

Best,
Chris Leung`,
    },
    {
        id: 'tenant_lead_2_cold',
        name: 'Value Prop — Cold',
        sequence: 2,
        variant: 'cold',
        subject: 'One thing to consider about your facility costs',
        body: `Hi {{contactName}},

Quick thought — most multi-vendor facility setups cost 20-30% more than a single-source partner, once you factor in coordination time, missed cleans, and vendor management overhead.

XIRI consolidates everything into one contract with one point of contact. No more juggling.

If this is ever on your radar, I'm here. Just reply to this email.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ── Step 3: Social Proof ──
    {
        id: 'tenant_lead_3',
        name: 'Social Proof — Case Study',
        sequence: 3,
        subject: 'How practices like {{businessName}} made the switch',
        body: `Hi {{contactName}},

A multi-location urgent care group in Nassau County was juggling 4 different cleaning vendors. After switching to XIRI:

→ Reduced facility management time by 80%
→ Improved patient satisfaction scores related to cleanliness
→ Saved over $2,000/month by consolidating vendors
→ Achieved consistent quality across all locations

We handle everything from nightly janitorial to emergency deep cleans — all managed through a single dashboard.

I'd be happy to put together a custom proposal for {{businessName}}. Would that be helpful?

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'tenant_lead_3_warm',
        name: 'Social Proof — Warm',
        sequence: 3,
        variant: 'warm',
        subject: 'A quick case study for {{contactName}}',
        body: `Hi {{contactName}},

Since you've been reading my emails, I thought you might appreciate a real example:

One of our medical office clients was spending $4,200/month across 3 vendors. We consolidated everything into one $3,100/month contract — better quality, less hassle, guaranteed compliance.

That's $13,200/year in savings, plus ~20 hours/month of admin time back.

Want me to run the numbers for {{businessName}}?

Best,
Chris Leung`,
    },
    {
        id: 'tenant_lead_3_cold',
        name: 'Social Proof — Cold',
        sequence: 3,
        variant: 'cold',
        subject: '30 seconds — how we save medical practices $2K/month',
        body: `Hi {{contactName}},

30-second version: Medical practices that switch to XIRI save an average of $2,000/month by consolidating facility vendors into one partner.

That's it. If that's interesting, reply here. If not, no worries — I won't keep emailing.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ── Step 4: Final Check-in ──
    {
        id: 'tenant_lead_4',
        name: 'Final Check-in — Free Walkthrough',
        sequence: 4,
        subject: 'Last check-in — complimentary facility walkthrough',
        body: `Hi {{contactName}},

This will be my last note — I don't want to be a bother.

If facility management is something {{businessName}} is looking to simplify, I'd love to offer a complimentary walkthrough and custom proposal. No commitment.

You can reply to this email or book a time directly: https://xiri.ai/contact

Either way, I wish you and your team all the best.

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
];

// ═══════════════════════════════════════════════════════════
// REFERRAL PARTNERSHIP TEMPLATES (CRE brokers, property mgmt)
// ═══════════════════════════════════════════════════════════
const REFERRAL_PARTNERSHIP = [
    // ── Step 1: Intro ──
    {
        id: 'referral_partnership_1',
        name: 'Partnership Introduction',
        sequence: 1,
        subject: 'Referral Partnership — XIRI Facility Solutions',
        body: `Hi {{contactName}},

My name is Chris and I own XIRI Facility Solutions, a facility management business based in Queens/Nassau County.

I am reaching out because we are establishing referral partnerships with local commercial real estate brokers given your relationship with commercial tenants.

Services we offer:
• Move-in Deep Cleaning
• Move-out Deep Cleaning
• Post-Construction Clean
• Nightly Janitorial Services

For every tenant referral that converts to a recurring contract, we offer a referral fee.

Please let me know if you are interested.

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
    {
        id: 'referral_partnership_1_warm',
        name: 'Partnership Intro — Warm',
        sequence: 1,
        variant: 'warm',
        subject: 'Re: Referral partnership details',
        body: `Hi {{contactName}},

Thanks for taking a look at my previous email. I wanted to share a few more details on how our referral partnerships work:

1. You refer a tenant who needs facility services
2. We handle the proposal, onboarding, and service delivery
3. You receive a referral fee for every converted recurring contract

It's completely hands-off after the intro. Several brokers in Nassau County are already in the program.

Want to hop on a quick call to discuss? I'm flexible this week.

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'referral_partnership_1_cold',
        name: 'Partnership Intro — Cold',
        sequence: 1,
        variant: 'cold',
        subject: 'Quick note — facility referral program',
        body: `Hi {{contactName}},

Short version: XIRI Facility Solutions pays referral fees to CRE brokers who introduce us to commercial tenants needing cleaning/janitorial services.

Move-in cleans, move-out cleans, recurring janitorial — we handle everything.

If this is something you'd consider, just reply "interested" and I'll send details.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ── Step 2: Follow-up ──
    {
        id: 'referral_partnership_2',
        name: 'Follow-up — Partnership Benefits',
        sequence: 2,
        subject: 'Following up — Referral Partnership',
        body: `Hi {{contactName}},

I wanted to follow up on my previous note about a referral partnership with XIRI Facility Solutions.

Here's what brokers tell us they love about the program:

✓ Adds value to your tenant relationships (you're solving a real problem)
✓ Zero effort after the intro — we handle proposals, contracts, and service
✓ Referral fee for every recurring contract
✓ Makes you look good when the space is spotless on move-in day

We currently have several active partnerships with brokers across Long Island and Queens.

Would you be open to a 10-minute call to see if this makes sense?

Best,
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

The tenants love it because they get a vetted, insured facility partner on day one. The broker looks great for making the connection.

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

Next time a tenant asks "do you know a good cleaning company?" — send them our way. We'll handle everything, and you get a referral fee.

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
