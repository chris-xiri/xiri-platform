/**
 * Seed ENTERPRISE LEAD outreach templates into Firestore.
 * 5-step sequence with standard, _warm, and _cold variants (15 total).
 *
 * Usage:  node scripts/seed-enterprise-lead-templates.js
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});
const db = admin.firestore();

const ENTERPRISE_LEAD = [
    // ══════════════════════════════════════════════════════
    // Step 1: Executive Introduction (Day 0)
    // ══════════════════════════════════════════════════════
    {
        id: 'enterprise_lead_1',
        name: 'Executive Introduction',
        sequence: 1,
        subject: 'Enterprise Facility Management for {{businessName}}',
        body: `Hi {{contactName}},

My name is Chris Leung and I'm the founder of XIRI Facility Solutions. We provide enterprise-grade facility management for multi-location organizations across the greater New York metropolitan area.

I'm reaching out because organizations like {{businessName}} often face a common challenge: managing facility operations across multiple branches with consistent quality, compliance, and reporting.

XIRI specializes in exactly this:

• Multi-site facility management under a single contract
• Compliance-ready operations (OSHA, industry-specific regulations)
• Centralized reporting dashboard with real-time quality metrics
• Dedicated account management team
• Scalable staffing across your entire footprint

We currently manage facility operations for multi-location healthcare networks and commercial portfolios across Long Island and Queens.

Would you be open to a brief 15-minute call to explore whether we might be a good fit for {{businessName}}?

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
    {
        id: 'enterprise_lead_1_warm',
        name: 'Executive Introduction — Warm',
        sequence: 1,
        variant: 'warm',
        subject: 'Quick question about {{businessName}} facility operations',
        body: `Hi {{contactName}},

Thanks for taking a look at my previous note. I wanted to follow up with a direct question:

Is {{businessName}} currently managing facility services through a single provider, or coordinating between multiple vendors across your locations?

We've helped organizations like yours consolidate to a single enterprise partner — bringing consistency, compliance documentation, and centralized reporting under one contract.

Would a brief 15-minute call with our enterprise team make sense? I'm flexible this week.

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'enterprise_lead_1_cold',
        name: 'Executive Introduction — Cold',
        sequence: 1,
        variant: 'cold',
        subject: 'One point of contact for all {{businessName}} facility needs',
        body: `Hi {{contactName}},

I know your inbox is busy, so I'll be direct.

XIRI Facility Solutions provides enterprise-grade facility management for multi-location organizations — one contract, one point of contact, full compliance documentation.

If {{businessName}} is ever evaluating facility partners, I'd welcome a brief conversation. Just reply to this email.

Best,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },

    // ══════════════════════════════════════════════════════
    // Step 2: Multi-Site Value Proposition (Day 4)
    // ══════════════════════════════════════════════════════
    {
        id: 'enterprise_lead_2',
        name: 'Multi-Site Value Proposition',
        sequence: 2,
        subject: 'Managing {{businessName}} facilities across multiple locations',
        body: `Hi {{contactName}},

Following up on my previous note — I wanted to share a specific challenge we solve for enterprise organizations:

The Multi-Vendor Problem:
Most multi-location businesses end up with a patchwork of local vendors for each branch. This creates:
→ Inconsistent quality across locations
→ No centralized reporting or accountability
→ 30-50 hours/month wasted on vendor coordination
→ Compliance gaps that create liability risk

The XIRI Approach:
✓ One contract, one point of contact — across all your locations
✓ Standardized SOPs customized to your compliance requirements
✓ Real-time quality dashboards accessible to your leadership team
✓ Guaranteed response times with documented SLAs
✓ Background-checked, trained staff at every location

For an organization like {{businessName}}, we'd start with a comprehensive facility assessment across your locations to identify cost savings and compliance improvements.

Would a 20-minute call with our enterprise team make sense?

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'enterprise_lead_2_warm',
        name: 'Multi-Site Value Prop — Warm',
        sequence: 2,
        variant: 'warm',
        subject: 'The hidden cost of managing multiple facility vendors',
        body: `Hi {{contactName}},

Since you've been reading my notes, I thought you'd appreciate the data:

Enterprise organizations that consolidate from multiple facility vendors to a single partner typically see:

→ 25-40% reduction in total facility management costs
→ 80% less time spent on vendor coordination
→ Zero compliance gaps (one provider, one standard)
→ Faster resolution of facility issues (dedicated team, not a dispatch queue)

We built XIRI specifically for multi-location organizations like {{businessName}} — one contract that scales across your entire footprint.

Want me to run a preliminary cost analysis? Just reply and I'll put one together.

Best,
Chris Leung`,
    },
    {
        id: 'enterprise_lead_2_cold',
        name: 'Multi-Site Value Prop — Cold',
        sequence: 2,
        variant: 'cold',
        subject: 'Quick thought on facility costs at {{businessName}}',
        body: `Hi {{contactName}},

One stat worth knowing: multi-location organizations that consolidate facility vendors save an average of 30% on total facility costs, primarily from eliminated coordination overhead.

XIRI handles everything under one contract with enterprise-grade SLAs. If that's ever worth a conversation, I'm here.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ══════════════════════════════════════════════════════
    // Step 3: Compliance & Risk Management (Day 8)
    // ══════════════════════════════════════════════════════
    {
        id: 'enterprise_lead_3',
        name: 'Compliance & Risk Management',
        sequence: 3,
        subject: 'Compliance-ready facility management for {{businessName}}',
        body: `Hi {{contactName}},

One thing I hear repeatedly from enterprise facility managers: "How do I prove compliance across all our locations?"

XIRI was built with compliance as a core feature:

📋 Documentation: Every clean is logged with timestamps, photos, and inspector sign-offs
📊 Reporting: Monthly compliance reports delivered to your leadership team
🔒 Staff Vetting: Full background checks, E-Verify, and industry-specific training
⚡ Incident Response: Documented protocols with guaranteed response times
📑 Insurance: Full coverage with certificates tailored to your requirements

For regulated industries like banking, healthcare, and corporate offices, this level of documentation isn't optional — it's essential.

We'd be happy to walk your team through our compliance framework. No commitment — just a conversation to see if we're aligned.

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'enterprise_lead_3_warm',
        name: 'Compliance & Risk — Warm',
        sequence: 3,
        variant: 'warm',
        subject: 'Your compliance documentation question — answered',
        body: `Hi {{contactName}},

Since you've been engaging with my emails, I wanted to proactively answer the #1 question enterprise clients ask us:

"How do you handle compliance documentation?"

Every XIRI engagement includes:
✓ Per-location clean logs with timestamps and photos
✓ Monthly compliance reports to leadership
✓ Staff background checks and E-Verify
✓ Custom SOPs aligned to your regulatory requirements
✓ Certificate of insurance tailored to each location

For {{businessName}}, I can prepare a compliance overview showing exactly how this would work across your locations. Takes 5 minutes to review.

Want me to send it over?

Best,
Chris Leung`,
    },
    {
        id: 'enterprise_lead_3_cold',
        name: 'Compliance & Risk — Cold',
        sequence: 3,
        variant: 'cold',
        subject: '30 seconds — compliance-ready facility management',
        body: `Hi {{contactName}},

30-second version: XIRI provides fully documented, compliance-ready facility management for multi-location organizations. Every clean logged, every staff member background-checked, every location covered under enterprise-grade insurance.

If compliance documentation matters to {{businessName}}, we should talk. Reply here.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ══════════════════════════════════════════════════════
    // Step 4: Enterprise Case Study (Day 14)
    // ══════════════════════════════════════════════════════
    {
        id: 'enterprise_lead_4',
        name: 'Enterprise Case Study',
        sequence: 4,
        subject: 'How a multi-location network consolidated with XIRI',
        body: `Hi {{contactName}},

I wanted to share a real example of how we've helped organizations similar to {{businessName}}:

A regional healthcare network with 12 locations across Long Island was managing 8 different cleaning vendors. After consolidating with XIRI:

→ 40% reduction in facility management overhead
→ Standardized cleaning protocols across all 12 locations
→ Single monthly invoice replacing 8 separate vendor payments
→ Real-time quality scores visible to corporate leadership
→ Zero compliance findings in their next regulatory audit

The switch took 30 days from initial assessment to full operations — we handled all the transition logistics.

If {{businessName}} is managing multiple vendors across your branches, I'd love to show you what consolidation could look like. I can prepare a custom assessment at no cost.

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'enterprise_lead_4_warm',
        name: 'Enterprise Case Study — Warm',
        sequence: 4,
        variant: 'warm',
        subject: 'A case study for {{contactName}} — 12 locations, 1 partner',
        body: `Hi {{contactName}},

Since you've been following along, here's a deeper dive into a real engagement:

Client: Regional healthcare network, 12 locations
Challenge: 8 different cleaning vendors, inconsistent quality, compliance gaps

Results after consolidating with XIRI:
✓ 40% lower facility management costs
✓ Single monthly invoice (previously 8)
✓ Standardized SOPs across all locations
✓ Real-time quality dashboards for corporate
✓ Clean regulatory audit — zero findings

The entire transition took 30 days. We handled vendor termination notices, staff hiring, training, and equipment procurement.

What would consolidation look like for {{businessName}}? I can model it out — no cost, no commitment.

Best,
Chris Leung`,
    },
    {
        id: 'enterprise_lead_4_cold',
        name: 'Enterprise Case Study — Cold',
        sequence: 4,
        variant: 'cold',
        subject: '40% cost reduction — multi-location facility case study',
        body: `Hi {{contactName}},

Quick result: A 12-location organization reduced facility management costs by 40% by consolidating 8 vendors into one XIRI contract. Zero compliance findings in their next audit.

If {{businessName}} manages facilities across multiple locations, this is worth a 10-minute conversation. Reply here.

Best,
Chris Leung
XIRI Facility Solutions`,
    },

    // ══════════════════════════════════════════════════════
    // Step 5: Final Executive Check-in (Day 21)
    // ══════════════════════════════════════════════════════
    {
        id: 'enterprise_lead_5',
        name: 'Final Executive Check-in',
        sequence: 5,
        subject: 'Last note — enterprise facility partnership',
        body: `Hi {{contactName}},

This will be my final note. I understand enterprise decisions take time, and I respect your schedule.

If {{businessName}} is ever evaluating facility management partners — whether it's for a new branch opening, vendor consolidation, or simply improving consistency across locations — XIRI would welcome the opportunity to present a proposal.

We can start with a single location as a pilot, then scale as you see results. No long-term commitment required upfront.

You can reach me directly at chris@xiri.ai or schedule time here: https://xiri.ai/contact

Wishing you and your team continued success.

Kind Regards,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
    {
        id: 'enterprise_lead_5_warm',
        name: 'Final Check-in — Warm',
        sequence: 5,
        variant: 'warm',
        subject: 'One last thought for {{contactName}}',
        body: `Hi {{contactName}},

Since you've been engaging with my emails, I want to make one final offer:

I'll put together a custom facility assessment for {{businessName}} — completely free, no strings attached. It would include:

• Cost comparison: current multi-vendor vs. consolidated single-provider
• Compliance gap analysis across your locations
• Recommended transition timeline

If you're interested, just reply "send it" and I'll have it ready within 48 hours.

Either way, it's been a pleasure connecting. I'm always just an email away.

Best,
Chris Leung
XIRI Facility Solutions`,
    },
    {
        id: 'enterprise_lead_5_cold',
        name: 'Final Check-in — Cold',
        sequence: 5,
        variant: 'cold',
        subject: 'Closing the loop — {{businessName}} facilities',
        body: `Hi {{contactName}},

Last note from me. If facility management ever comes up at {{businessName}} — new branch, vendor issues, compliance audit — I'm one email away.

No pressure. Wishing you a strong quarter.

Best,
Chris Leung
XIRI Facility Solutions
chris@xiri.ai`,
    },
];

// ═══════════════════════════════════════════════════════════

async function seed() {
    const allTemplates = ENTERPRISE_LEAD.map(t => ({
        ...t,
        category: 'enterprise_lead',
        type: 'template',
    }));

    console.log(`Seeding ${allTemplates.length} enterprise lead outreach templates...\n`);

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

    console.log(`\nDone! ${allTemplates.length} enterprise templates seeded.`);
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
