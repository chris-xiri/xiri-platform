/**
 * Seed Script: In-House Conversion 4-Step Email Sequence
 *
 * Creates 4 email templates and 1 sequence document in Firestore
 * for the in-house conversion pipeline. These templates target
 * facilities currently hiring in-house janitorial/facility staff.
 *
 * The pitch focuses on:
 *   - Eliminating payroll burden (salary, benefits, PTO, workers comp)
 *   - Cost reduction (30-40% savings vs in-house)
 *   - No management headaches (hiring, training, coverage when sick)
 *   - Trial offer → low-risk conversion
 *
 * Run via: npx ts-node seed-in-house-sequence.ts
 * Or deploy as a one-time onCall function.
 */

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { DASHBOARD_CORS } from "../utils/cors";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const TEMPLATES = [
    {
        id: "in_house_step1_cost_reality",
        name: "In-House Step 1 — The True Cost of In-House Cleaning",
        description: "Opener that highlights real cost of in-house staff (salary + benefits + overhead) vs outsourcing",
        subject: "{{contactName}}, your in-house cleaning is costing you more than you think",
        category: "in_house_conversion",
        type: "cold_email",
        variables: ["contactName", "businessName", "facilityType"],
        body: `<p>Hi {{contactName}},</p>

<p>I noticed {{businessName}} is hiring for a facility cleaning role — and I wanted to share something that could save you a significant amount.</p>

<p>Most facility managers don't realize the <strong>true cost</strong> of an in-house janitor. When you add it up — salary, health insurance, workers' comp, PTO, sick days, training, equipment, and cleaning supplies — you're looking at <strong>$45,000–$65,000+ per year</strong> for a single position.</p>

<p>What if you could get the same (or better) cleaning quality for <strong>30–40% less</strong> — with zero HR headaches?</p>

<p>At <strong>XIRI Facility Solutions</strong>, we provide professional, fully insured cleaning crews at a fixed monthly cost. No payroll. No benefits to manage. No scrambling when someone calls in sick.</p>

<p>Would it make sense to see a quick cost comparison for {{businessName}}? I can put one together in under 24 hours — no obligation.</p>

<p>Best,<br/>Chris Leung<br/>XIRI Facility Solutions<br/>chris@xiri.ai</p>`,
    },
    {
        id: "in_house_step2_hidden_costs",
        name: "In-House Step 2 — The Hidden Costs You're Absorbing",
        description: "Follow-up: breaks down the hidden costs they're paying beyond the wage",
        subject: "The hidden costs of in-house cleaning at {{businessName}}",
        category: "in_house_conversion",
        type: "follow_up",
        variables: ["contactName", "businessName"],
        body: `<p>Hi {{contactName}},</p>

<p>Following up on my last note — I wanted to share a quick breakdown that's eye-opening for most facility managers.</p>

<p>Here's what in-house cleaning <em>really</em> costs beyond the hourly wage:</p>

<ul>
<li>💰 <strong>Payroll taxes</strong> — FICA, FUTA, state unemployment (~10% on top)</li>
<li>🏥 <strong>Health insurance</strong> — $5,000–$12,000/year per employee</li>
<li>🤕 <strong>Workers' comp insurance</strong> — required, and janitorial is a high-risk category</li>
<li>🏖️ <strong>PTO + sick days</strong> — who covers when they're out?</li>
<li>📋 <strong>Hiring + training</strong> — turnover is 200%+ in janitorial</li>
<li>🧹 <strong>Supplies + equipment</strong> — commercial-grade products aren't cheap</li>
<li>📊 <strong>Management overhead</strong> — someone has to supervise, schedule, and QA</li>
</ul>

<p>When you outsource to XIRI, <strong>all of that is included</strong> in one predictable monthly invoice. We handle staffing, supplies, insurance, and quality assurance.</p>

<p>Worth a 10-minute call to explore? I can walk you through what the switch would look like for {{businessName}}.</p>

<p>Best,<br/>Chris Leung<br/>XIRI Facility Solutions</p>`,
    },
    {
        id: "in_house_step3_case_study",
        name: "In-House Step 3 — How a Facility Like Yours Saved $22K",
        description: "Social proof: real savings case study from a similar conversion",
        subject: "How a facility like {{businessName}} cut cleaning costs by 35%",
        category: "in_house_conversion",
        type: "follow_up",
        variables: ["contactName", "businessName", "facilityType"],
        body: `<p>Hi {{contactName}},</p>

<p>Quick story that might resonate — </p>

<p>A {{facilityType}} similar to {{businessName}} came to us last year. They had <strong>two in-house janitors</strong> costing them roughly <strong>$110,000/year</strong> between salaries, benefits, and supplies.</p>

<p>After switching to XIRI, their cleaning costs dropped to <strong>$71,500/year</strong> — a savings of <strong>$38,500 annually</strong>. And the quality actually improved because we use trained, specialized crews with commercial-grade equipment.</p>

<p>Here's what they got:</p>
<ul>
<li>✅ Same-night cleaning, 5 days/week</li>
<li>✅ $0 in payroll, HR, or insurance costs</li>
<li>✅ Guaranteed coverage (no call-outs, no scrambling)</li>
<li>✅ NFC-verified quality inspections every visit</li>
<li>✅ One flat invoice — no surprises</li>
</ul>

<p>I'd love to run the same analysis for {{businessName}}. Even if you stay in-house, you'll have real numbers to compare against.</p>

<p>Can I send over a custom cost comparison?</p>

<p>Chris Leung<br/>XIRI Facility Solutions<br/>chris@xiri.ai</p>`,
    },
    {
        id: "in_house_step4_trial_offer",
        name: "In-House Step 4 — Risk-Free Trial Offer",
        description: "Final touch: low-risk trial offer to make the switch easy",
        subject: "Last thing, {{contactName}} — try us risk-free",
        category: "in_house_conversion",
        type: "breakup",
        variables: ["contactName", "businessName"],
        body: `<p>Hi {{contactName}},</p>

<p>I know switching from in-house cleaning is a big decision — which is why I wanted to make it a no-brainer.</p>

<p>We're offering a <strong>risk-free 30-day trial</strong> for facilities like {{businessName}} that are considering the switch:</p>

<ul>
<li>🔄 <strong>No long-term contract required</strong></li>
<li>📊 <strong>Side-by-side comparison</strong> — keep your current team while we prove the difference</li>
<li>💵 <strong>Guaranteed cost savings</strong> — or you pay nothing for the trial month</li>
<li>✅ <strong>Full insurance + bonding coverage from day one</strong></li>
</ul>

<p>Worst case: you get a free month of professional cleaning and real data to make an informed decision.</p>

<p>Shall I set up the trial details for {{businessName}}? Takes about 10 minutes.</p>

<p>Chris Leung<br/>XIRI Facility Solutions<br/>📞 (908) 596-4360<br/>📧 chris@xiri.ai</p>`,
    },
];

const SEQUENCE = {
    id: "in_house_conversion_sequence",
    name: "In-House Conversion — 4-Step",
    description: "Targets facilities hiring in-house janitorial staff. Pitches outsourcing for cost reduction, elimination of payroll/benefits, and a risk-free trial.",
    category: "in_house_conversion" as const,
    steps: [
        { templateId: "in_house_step1_cost_reality", dayOffset: 0, label: "Step 1 — True Cost Opener" },
        { templateId: "in_house_step2_hidden_costs", dayOffset: 3, label: "Step 2 — Hidden Costs Breakdown" },
        { templateId: "in_house_step3_case_study", dayOffset: 7, label: "Step 3 — Case Study" },
        { templateId: "in_house_step4_trial_offer", dayOffset: 14, label: "Step 4 — Trial Offer (Breakup)" },
    ],
};

export const seedInHouseSequence = onCall({
    cors: DASHBOARD_CORS,
}, async () => {
    const batch = db.batch();

    // Write templates
    for (const tpl of TEMPLATES) {
        const ref = db.collection("templates").doc(tpl.id);
        batch.set(ref, {
            name: tpl.name,
            description: tpl.description,
            subject: tpl.subject,
            body: tpl.body,
            category: tpl.category,
            type: tpl.type,
            variables: tpl.variables,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // Write sequence
    const seqRef = db.collection("sequences").doc(SEQUENCE.id);
    batch.set(seqRef, {
        name: SEQUENCE.name,
        description: SEQUENCE.description,
        category: SEQUENCE.category,
        steps: SEQUENCE.steps,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    logger.info(`[SeedInHouse] Created ${TEMPLATES.length} templates + 1 sequence.`);
    return { message: `Seeded ${TEMPLATES.length} templates + sequence "${SEQUENCE.name}"` };
});
