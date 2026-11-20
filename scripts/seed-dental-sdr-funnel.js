/**
 * Seed Dental & Orthodontic Content + CTA Email Marketing Funnel,
 * AI SDR Studio Prompts, and Metro NY Prospecting Config into Firestore.
 *
 * Targets: Private Dental & Orthodontic Practices across Long Island (Nassau & Suffolk),
 *          NYC 5 Boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island),
 *          Yonkers, and Westchester County.
 *
 * Usage:
 *   node scripts/seed-dental-sdr-funnel.js
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

// ══════════════════════════════════════════════════════════════════════
// 1. DENTAL PRACTICE 6-TOUCH FUNNEL TEMPLATES (dental_funnel_v1)
// ══════════════════════════════════════════════════════════════════════

const DENTAL_TEMPLATES = [
    // ── Touch 1 (Day 0): Personalized Hook + NFC Proof-of-Work Soft Reply CTA ──
    {
        id: 'dental_funnel_1',
        name: 'Dental Touch 1 — Pre-Opening Verification Hook',
        category: 'dental_lead',
        sequence: 1,
        useCustomDraft: true,
        subject: 'pre-opening logs — {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Quick question for {{cleanBizName}} — do you have photo-verified proof your operatories and sterilization area were actually terminal-cleaned before doors open each morning?

Most dental office managers we talk to across Long Island, NYC, and Westchester end up doing a 7:45 AM spot check (or having $60/hr hygienists wipe down what the night crew missed).

We built XIRI specifically for private dental practices: chair-safe EPA List N disinfection (safe on A-dec/Belmont upholstery), neutral floor care that removes CaviWipe haze, and timestamped NFC proof-of-work logs sent to your inbox before your first patient arrives.

Open to seeing a 60-second sample nightly verification log for {{cleanBizName}}?`,
    },

    // ── Touch 2 (Day 3): Value Content — Terminal Cleaning Checklist ──
    {
        id: 'dental_funnel_2',
        name: 'Dental Touch 2 — Terminal Cleaning Checklist (Base)',
        category: 'dental_lead',
        sequence: 2,
        subject: '2026 dental terminal cleaning checklist for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Whether you keep your current night crew or look at options down the road, I wanted to share something genuinely useful for {{cleanBizName}}.

We put together a 3-zone [2026 Dental Office Terminal Cleaning Checklist](https://xiri.ai/guides/dental-office-terminal-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t2) aligned with CDC DHCP & OSHA 1910.1030 — covering operatory upholstery protection, clean-to-dirty sterilization lab flow, and EPA 40 CFR Part 441 amalgam trap rules.

Most office managers use it to spot-check what their current cleaners are skipping.

Worth passing along to your lead assistant or current cleaning crew?`,
    },
    {
        id: 'dental_funnel_2_warm',
        name: 'Dental Touch 2 (Warm) — Checklist + Scope Benchmark',
        category: 'dental_lead',
        sequence: 2,
        subject: 're: pre-opening logs — {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Following up quickly — I wanted to send over our [2026 Dental Office Terminal Cleaning Checklist](https://xiri.ai/guides/dental-office-terminal-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t2_warm) built for private practices in {{city}}.

It breaks down the exact clean-to-dirty protocol for operatories, sterilization galleys, and CBCT/imaging rooms (plus why bleach/alcohol sprays quietly crack A-dec & Belmont chair seams).

If it's helpful, I'm happy to spend 10 minutes benchmarking {{cleanBizName}}'s current cleaning scope against it — no pitch, just an honest second opinion. Want me to send two times?`,
    },
    {
        id: 'dental_funnel_2_cold',
        name: 'Dental Touch 2 (Cold) — Chair Upholstery & CaviWipe Floor Haze',
        category: 'dental_lead',
        sequence: 2,
        subject: 'protecting dental chair upholstery at {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

One expensive mistake we see general office cleaners make in NY dental practices: spraying bleach or harsh alcohol wipes onto medical vinyl/Ultraleather chairs — which voids warranties and cracks seams within 18 months — while leaving sticky CaviWipe buildup on LVT operatory floors.

We documented our chair-safe [Dental Suite Sanitization Protocol](https://xiri.ai/solutions/dental-suite-sanitization?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t2_cold) specifically for private practices across Long Island, NYC, and Westchester.

Is chair upholstery wear or floor haze something your team has noticed lately at {{cleanBizName}}?`,
    },

    // ── Touch 3 (Day 7): Interactive Tool CTA — Compliance Checker / Cost Benchmark ──
    {
        id: 'dental_funnel_3',
        name: 'Dental Touch 3 — Interactive Compliance & Cost Benchmark',
        category: 'dental_lead',
        sequence: 3,
        subject: '60-second OSHA/HIPAA cleaning check for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Two quick interactive tools our Metro NY dental office managers have been using this quarter:

1. [60-Second Dental Cleaning Compliance Checker](https://xiri.ai/tools/compliance-checker?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t3) — checks HIPAA BAA, OSHA 1910.1030, EPA List N dwell times & color-coded microfiber separation.
2. [NY Dental Cleaning Cost Calculator](https://xiri.ai/calculator?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t3) — see local Metro NY benchmarks ($650–$1,850/mo) vs. paying RDHs/DAs to clean after hours.

Try either one — and if you'd like a flat-rate comparison number for {{cleanBizName}}, just reply with your rough chair count.`,
    },
    {
        id: 'dental_funnel_3_warm',
        name: 'Dental Touch 3 (Warm) — Dental Compliance Readiness Checker',
        category: 'dental_lead',
        sequence: 3,
        subject: 'quick compliance score for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Since you took a look at our last note, I thought you might like our free [Dental Cleaning Compliance Checker](https://xiri.ai/tools/compliance-checker?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t3_warm).

It takes 60 seconds and flags the 4 most common environmental gaps we see in NY dental practices (missing vendor HIPAA BAAs, cross-contaminated restroom/operatory mops, unverified disinfectant dwell times, and paper logs).

If anything comes back yellow or red, reply with your chair count and I'll send over a transparent flat-rate scope for {{cleanBizName}}.`,
    },
    {
        id: 'dental_funnel_3_cold',
        name: 'Dental Touch 3 (Cold) — RDH Time vs Flat-Rate Cost Calculator',
        category: 'dental_lead',
        sequence: 3,
        subject: 'what {{city}} dental offices actually pay for nightly cleaning',
        body: `Hi {{contactFirstName}},

A quick stat from practices we audit across Long Island, the 5 boroughs, and Westchester: having $55–$68/hr hygienists or assistants spend even 25 minutes a night mopping floors and scrubbing restrooms costs more than a dedicated clinical night crew — and accelerates staff burnout.

You can plug {{cleanBizName}}'s approximate square footage into our [NY Dental Cleaning Cost Calculator](https://xiri.ai/calculator?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t3_cold) to see instant local market pricing (no login required).

Curious how that compares to what you're paying today?`,
    },

    // ── Touch 4 (Day 11): Local NY Proof & NFC Verification Case Study ──
    {
        id: 'dental_funnel_4',
        name: 'Dental Touch 4 — Local NY Proof & NFC Verification',
        category: 'dental_lead',
        sequence: 4,
        subject: 'why local NY verification beats cleaning franchises',
        body: `Hi {{contactFirstName}},

Most dental practices we take over aren't switching because of price — they're switching because a franchise crew started strong for 30 days and then quietly stopped dusting light arms, missed corners, or rotated in untrained subs.

We run the same [NFC Proof-of-Work Verification](https://xiri.ai/solutions/nfc-proof-of-work?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t4) and smart facility standards we documented in our [NY Facility Verification Case Study](https://xiri.ai/case-studies/ubs-arena-georgia-pacific?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t4) — scaled specifically for private dental offices across Long Island, NYC, and Westchester.

Want me to send a redacted morning verification report from a local NY dental clinic so you can see what lands in the office manager's inbox?`,
    },

    // ── Touch 5 (Day 16): Risk-Reversal Direct Hygiene Audit Offer ──
    {
        id: 'dental_funnel_5',
        name: 'Dental Touch 5 — Free 15-Min Hygiene & Upholstery Audit',
        category: 'dental_lead',
        sequence: 5,
        subject: '15-min hygiene & upholstery audit for {{cleanBizName}}?',
        body: `Hi {{contactFirstName}},

If you're open to a fresh set of eyes on {{cleanBizName}}, I'd love to offer a complimentary 15-minute after-hours Hygiene & Upholstery Audit.

You'll get:
- A quick zone-by-zone check of operatory floors, sterilization galley, and chair upholstery condition
- A transparent flat-rate monthly proposal (zero long-term lock-in, full HIPAA BAA & $2M COI)
- Zero obligation — keep the checklist even if you stay with your current vendor

You can [grab a 15-minute audit slot here](https://xiri.ai/audit/start?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t5&facilityType=medical_dental) or just reply "audit" and I'll send two times this week.`,
    },

    // ── Touch 6 (Day 21): Respectful Breakup + Free RFP Generator Leave-Behind ──
    {
        id: 'dental_funnel_6',
        name: 'Dental Touch 6 — Breakup + Free Dental RFP Generator',
        category: 'dental_lead',
        sequence: 6,
        subject: 'closing the loop — {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

I know running a busy dental practice doesn't leave much spare time for vendor emails, so I'll close your file for now.

Before I step back, feel free to bookmark our free [Dental Practice Janitorial RFP Generator](https://xiri.ai/tools/janitorial-rfp/dental-offices?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_funnel_t6) — if your current crew ever misses a night or you re-bid later this year, it generates a clean OSHA/CDC scope you can send to any vendor.

Should I check back in 6 months, or is cleaning all set for the year at {{cleanBizName}}?`,
    },
];

// ══════════════════════════════════════════════════════════════════════
// 2. ORTHODONTIC PRACTICE 6-TOUCH FUNNEL TEMPLATES (ortho_funnel_v1)
// ══════════════════════════════════════════════════════════════════════

const ORTHO_TEMPLATES = [
    // ── Touch 1 (Day 0): Personalized Open-Bay & Parent Reception Hook ──
    {
        id: 'ortho_funnel_1',
        name: 'Ortho Touch 1 — Open-Bay & Pre-Opening Verification Hook',
        category: 'ortho_lead',
        sequence: 1,
        useCustomDraft: true,
        subject: 'quick question for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

In a high-volume orthodontic clinic, parents and teens see everything at once — open-bay chairs, floor scuffs from the after-school rush, brushing-station mirrors, and composite/bonding dust on overhead light arms.

Most ortho office managers we speak with across Long Island, NYC, and Westchester are frustrated by generic cleaners who smear floors, miss glass smudges, or use harsh sprays around Boyd/A-dec chairs and iTero scanners.

We built XIRI's local NY crews specifically for orthodontic & dental clinics — with chair-safe EPA List N disinfection and timestamped NFC photo-verified logs delivered before doors open.

Open to seeing a 60-second sample nightly verification log for {{cleanBizName}}?`,
    },

    // ── Touch 2 (Day 3): Value Content — Dedicated Orthodontic Cleaning Checklist ──
    {
        id: 'ortho_funnel_2',
        name: 'Ortho Touch 2 — Orthodontic Practice Cleaning Checklist (Base)',
        category: 'ortho_lead',
        sequence: 2,
        subject: '2026 orthodontic office cleaning checklist for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Orthodontic practices have very different cleaning realities than closed-door dental offices — open-bay floor traffic, debonding resin dust, iTero/3D printer labs, and patient brushing stations.

We published a zone-by-zone [2026 Orthodontic Practice Nightly Cleaning Checklist](https://xiri.ai/guides/orthodontic-office-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t2) tailored specifically for private ortho clinics.

Feel free to share it with your current night crew or treatment coordinator to benchmark what's being covered after hours at {{cleanBizName}}.`,
    },
    {
        id: 'ortho_funnel_2_warm',
        name: 'Ortho Touch 2 (Warm) — Ortho Checklist + Scope Benchmark',
        category: 'ortho_lead',
        sequence: 2,
        subject: 're: quick question for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Sharing our [2026 Orthodontic Practice Nightly Cleaning Checklist](https://xiri.ai/guides/orthodontic-office-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t2_warm) — built specifically for open-bay ortho clinics in {{city}} and Metro NY.

It covers chair upholstery protection (Boyd/A-dec/Belmont), anti-static dusting around iTero scanners and 3D retainer labs, brushing-station biofilm removal, and spotless teen/parent reception zones.

Happy to spend 10 minutes benchmarking {{cleanBizName}}'s current cleaning scope against it — zero pressure. Would Thursday or Friday work?`,
    },
    {
        id: 'ortho_funnel_2_cold',
        name: 'Ortho Touch 2 (Cold) — Open-Bay Floor Haze, Brushing Stations & iTero Safety',
        category: 'ortho_lead',
        sequence: 2,
        subject: 'open-bay floors & brushing stations at {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Three things parents notice in the first 15 seconds at an orthodontic clinic: smudged check-in glass, toothpaste buildup around the brushing station, and dull/sticky CaviWipe haze on open-bay LVT floors.

We put together an [Orthodontic Clinic Nightly Sanitation Guide](https://xiri.ai/guides/orthodontic-office-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t2_cold) covering how to fix all three without risking bleach damage to chair vinyl or overspray near iTero scanners.

Are any of those headaches coming up with your current crew at {{cleanBizName}}?`,
    },

    // ── Touch 3 (Day 7): Interactive Tool CTA — Cost Benchmark / Compliance Checker ──
    {
        id: 'ortho_funnel_3',
        name: 'Ortho Touch 3 — Interactive Cost & Compliance Tools',
        category: 'ortho_lead',
        sequence: 3,
        subject: 'ortho cleaning benchmarks in {{city}} (no login needed)',
        body: `Hi {{contactFirstName}},

Two quick self-serve tools orthodontic office managers across Long Island, NYC, and Westchester have been using to gut-check their cleaning setup:

1. [NY Clinical Cleaning Cost Calculator](https://xiri.ai/calculator?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t3) — see local 5x/week pricing benchmarks ($1,100–$2,400/mo for 2,000–3,500 sq ft) vs. assistant overtime.
2. [60-Second Compliance Readiness Checker](https://xiri.ai/tools/compliance-checker?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t3) — checks OSHA, HIPAA BAA, and color-coded microfiber separation.

If you'd like a flat-rate side-by-side number for {{cleanBizName}}, just reply with your chair count and days/week.`,
    },
    {
        id: 'ortho_funnel_3_warm',
        name: 'Ortho Touch 3 (Warm) — Compliance Readiness Checker',
        category: 'ortho_lead',
        sequence: 3,
        subject: '60-second compliance check for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Since you opened our ortho checklist, here's a quick 60-second [Clinical Cleaning Compliance Checker](https://xiri.ai/tools/compliance-checker?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t3_warm) to spot vendor gaps (HIPAA BAA, EPA List N dwell times, restroom-to-bay microfiber cross-contamination).

If anything flags yellow or red, reply with your open-bay chair count and I'll send over a transparent flat-rate monthly scope for {{cleanBizName}}.`,
    },
    {
        id: 'ortho_funnel_3_cold',
        name: 'Ortho Touch 3 (Cold) — NY Ortho Cleaning Cost Calculator',
        category: 'ortho_lead',
        sequence: 3,
        subject: 'what {{city}} orthodontic clinics pay for 5x/wk cleaning',
        body: `Hi {{contactFirstName}},

Between 3:00 PM school-release rushes and Saturday hours, paying clinical orthodontic assistants overtime to mop open bays or scrub brushing stations drains margins and burns out your team.

You can check local Metro NY pricing for a practice the size of {{cleanBizName}} in 30 seconds with our [NY Clinical Cleaning Cost Calculator](https://xiri.ai/calculator?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t3_cold) — no signup required.

Curious how your current monthly invoice stacks up?`,
    },

    // ── Touch 4 (Day 11): Local Proof & NFC Nightly Verification ──
    {
        id: 'ortho_funnel_4',
        name: 'Ortho Touch 4 — Local Metro NY Proof & NFC Logs',
        category: 'ortho_lead',
        sequence: 4,
        subject: 'no more 7:45 AM surprise inspections at {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

The #1 complaint we hear from orthodontic practice managers isn't pricing — it's consistency. A crew starts strong for a month, then mirrors streak, brushing stations get skipped, and nobody catches it until the first family walks in.

With XIRI's [NFC Zone Proof-of-Work](https://xiri.ai/solutions/nfc-proof-of-work?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t4), every cleaner physically taps in at your Open Bay, Brushing Station, Sterilization Galley, Restrooms, and Reception — sending a timestamped completion report before you open.

Want me to send a 60-second sample verification report so you can see how it works?`,
    },

    // ── Touch 5 (Day 16): Risk-Reversal Direct Open-Bay Hygiene Audit ──
    {
        id: 'ortho_funnel_5',
        name: 'Ortho Touch 5 — Free 15-Min Open-Bay Hygiene Audit',
        category: 'ortho_lead',
        sequence: 5,
        subject: 'free 15-min open-bay hygiene audit for {{cleanBizName}}?',
        body: `Hi {{contactFirstName}},

Would you be open to a complimentary 15-minute after-hours Hygiene & Upholstery Audit at {{cleanBizName}}?

We walk your open bay, brushing station, lab/scanner perimeter, and reception with you, hand you a scored zone report, and send a flat-rate monthly proposal with:
- Chair-safe EPA List N protocols & HIPAA BAA
- Nightly NFC photo-verified proof-of-work
- Zero long-term contract lock-in

[Pick a 15-min audit window here](https://xiri.ai/audit/start?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t5&facilityType=medical_dental&specialty=ortho) or reply "audit" and I'll send two times this week.`,
    },

    // ── Touch 6 (Day 21): Respectful Breakup + Free RFP Leave-Behind ──
    {
        id: 'ortho_funnel_6',
        name: 'Ortho Touch 6 — Breakup + Free Clinical RFP Tool',
        category: 'ortho_lead',
        sequence: 6,
        subject: 'closing your file for now — {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

I know how packed an orthodontic schedule gets, so I won't keep nudging your inbox.

If your current cleaning crew ever drops the ball — or you want a clean checklist when re-bidding — feel free to save our [Orthodontic Practice Cleaning Checklist](https://xiri.ai/guides/orthodontic-office-cleaning-checklist?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t6) and free [Clinical RFP Generator](https://xiri.ai/tools/janitorial-rfp/dental-offices?utm_source=sdr_email&utm_medium=email&utm_campaign=ortho_funnel_t6).

Should I circle back in 6 months, or are you all set for the year at {{cleanBizName}}?`,
    },
];

// ══════════════════════════════════════════════════════════════════════
// 3. LONG-TERM MONTHLY CONTENT NURTURE (dental_monthly_nurture)
// ══════════════════════════════════════════════════════════════════════

const MONTHLY_NURTURE_TEMPLATES = [
    {
        id: 'dental_nurture_m1_voc_osha',
        name: 'Monthly Nurture 1 — NYS Part 226 VOC & OSHA Guide',
        category: 'nurture',
        sequence: 1,
        subject: 'NY dental compliance note: NYS Part 226 VOC rules',
        body: `Hi {{contactFirstName}},

Quick NY compliance update for {{cleanBizName}}: New York State DEC enforces Part 226 VOC limits on commercial cleaning chemicals used inside healthcare suites — and many low-cost janitorial crews still bring non-compliant retail chemicals on site.

We summarized what practice managers need to verify on vendor SDS sheets here: [NYS Part 226 Cleaning Compliance Guide](https://xiri.ai/guides/nys-part-226-voc-cleaning-compliance?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_nurture_m1).

If you ever want a quick second opinion on your current crew's chemicals or scope, just hit reply.`,
    },
    {
        id: 'dental_nurture_m2_hipaa',
        name: 'Monthly Nurture 2 — HIPAA Environmental & BAA Checklist',
        category: 'nurture',
        sequence: 2,
        subject: 'does your night cleaning crew have a signed HIPAA BAA?',
        body: `Hi {{contactFirstName}},

A surprisingly common audit finding we see across Long Island, NYC, and Westchester practices: after-hours cleaners have unsupervised access to reception desks, scheduling monitors, and operatories — yet the practice doesn't have a signed HIPAA Business Associate Agreement (BAA) on file.

Here's our short breakdown of what's actually required: [HIPAA Environmental Compliance for Dental & Medical Suites](https://xiri.ai/guides/hipaa-environmental-compliance-cleaning?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_nurture_m2).

Happy to send our sample HIPAA-compliant nightly checklist for {{cleanBizName}} anytime.`,
    },
    {
        id: 'dental_nurture_m3_seasonal',
        name: 'Monthly Nurture 3 — High-Traffic Waiting Room & Chair Reset',
        category: 'nurture',
        sequence: 3,
        subject: 'quick check-in for {{cleanBizName}}',
        body: `Hi {{contactFirstName}},

Hope things are running smoothly at {{cleanBizName}}.

As patient volume picks up across Metro NY, we've been helping local dental and orthodontic practices reset dull LVT operatory floors, deep-clean high-touch reception/brushing zones, and switch to NFC photo-verified nightly cleaning.

If your current vendor has started slipping — or you'd like a fresh flat-rate benchmark — you can [request a free 15-min hygiene audit here](https://xiri.ai/audit/start?utm_source=sdr_email&utm_medium=email&utm_campaign=dental_nurture_m3) or just reply to this email.`,
    },
];

// ══════════════════════════════════════════════════════════════════════
// 4. SEQUENCES DEFINITIONS
// ══════════════════════════════════════════════════════════════════════

const SEQUENCES = [
    {
        id: 'dental_funnel_v1',
        name: 'Dental Practice Content + CTA Funnel (6 Touches / 21 Days)',
        description: 'Automated 21-day dental practice email funnel combining personalized NFC hook, CDC/OSHA terminal cleaning checklist, interactive compliance/cost calculators, local NY proof, 15-min audit CTA, and RFP leave-behind. Branches dynamically on opens/clicks and transitions to monthly value nurture.',
        category: 'dental_lead',
        senderId: 'sales',
        nextSequenceId: 'dental_monthly_nurture',
        steps: [
            { dayOffset: 0, templateId: 'dental_funnel_1', label: 'Touch 1 — Pre-Opening Verification Hook (AI Draft)', description: 'Personalized practice hook + soft reply CTA' },
            { dayOffset: 3, templateId: 'dental_funnel_2', label: 'Touch 2 — Terminal Cleaning Checklist (Warm/Cold)', description: 'Warm: CDC/OSHA checklist | Cold: Chair upholstery & CaviWipe haze' },
            { dayOffset: 7, templateId: 'dental_funnel_3', label: 'Touch 3 — Compliance & Cost Tools (Warm/Cold)', description: 'Warm: 60-sec Compliance Checker | Cold: NY Cost Calculator' },
            { dayOffset: 11, templateId: 'dental_funnel_4', label: 'Touch 4 — Local NY Proof & NFC Logs', description: 'Local case proof + sample morning report offer' },
            { dayOffset: 16, templateId: 'dental_funnel_5', label: 'Touch 5 — Free 15-Min Hygiene Audit CTA', description: 'Direct risk-reversal hygiene audit & flat-rate proposal' },
            { dayOffset: 21, templateId: 'dental_funnel_6', label: 'Touch 6 — Breakup + Dental RFP Generator', description: 'Respectful close + free RFP tool leave-behind' },
        ],
    },
    {
        id: 'ortho_funnel_v1',
        name: 'Orthodontic Practice Content + CTA Funnel (6 Touches / 21 Days)',
        description: 'Tailored 21-day orthodontic practice funnel highlighting open-bay chair rows, debonding dust, iTero scanner safety, patient brushing stations, teen/parent reception, and NFC morning verification. Branches on opens/clicks and transitions to monthly value nurture.',
        category: 'ortho_lead',
        senderId: 'sales',
        nextSequenceId: 'dental_monthly_nurture',
        steps: [
            { dayOffset: 0, templateId: 'ortho_funnel_1', label: 'Touch 1 — Open-Bay Verification Hook (AI Draft)', description: 'Personalized ortho clinic hook + soft reply CTA' },
            { dayOffset: 3, templateId: 'ortho_funnel_2', label: 'Touch 2 — Orthodontic Checklist (Warm/Cold)', description: 'Warm: Ortho Cleaning Checklist | Cold: Open-bay floors & brushing stations' },
            { dayOffset: 7, templateId: 'ortho_funnel_3', label: 'Touch 3 — Cost & Compliance Benchmark (Warm/Cold)', description: 'Warm: Compliance Checker | Cold: NY Ortho Cost Calculator' },
            { dayOffset: 11, templateId: 'ortho_funnel_4', label: 'Touch 4 — Local NY Proof & NFC Logs', description: 'Eliminating 7:45 AM surprise inspections' },
            { dayOffset: 16, templateId: 'ortho_funnel_5', label: 'Touch 5 — Free 15-Min Open-Bay Audit CTA', description: 'Direct after-hours open-bay audit & flat-rate quote' },
            { dayOffset: 21, templateId: 'ortho_funnel_6', label: 'Touch 6 — Breakup + Ortho Checklist & RFP Tool', description: 'Respectful close + free checklist/RFP leave-behind' },
        ],
    },
    {
        id: 'dental_lead_sequence',
        name: 'Dental Lead Sequence (Alias → Dental Funnel v1)',
        description: 'Legacy ID alias mapped to the 6-touch Dental Practice Content + CTA Funnel.',
        category: 'dental_lead',
        senderId: 'sales',
        nextSequenceId: 'dental_monthly_nurture',
        steps: [
            { dayOffset: 0, templateId: 'dental_funnel_1', label: 'Touch 1 — Pre-Opening Verification Hook' },
            { dayOffset: 3, templateId: 'dental_funnel_2', label: 'Touch 2 — Terminal Cleaning Checklist (Warm/Cold)' },
            { dayOffset: 7, templateId: 'dental_funnel_3', label: 'Touch 3 — Compliance & Cost Tools (Warm/Cold)' },
            { dayOffset: 11, templateId: 'dental_funnel_4', label: 'Touch 4 — Local NY Proof & NFC Logs' },
            { dayOffset: 16, templateId: 'dental_funnel_5', label: 'Touch 5 — Free 15-Min Hygiene Audit CTA' },
            { dayOffset: 21, templateId: 'dental_funnel_6', label: 'Touch 6 — Breakup + Dental RFP Generator' },
        ],
    },
    {
        id: 'dental_monthly_nurture',
        name: 'Dental & Ortho Monthly Content Nurture',
        description: 'Low-frequency monthly value emails (NYS Part 226 VOC, HIPAA BAA, seasonal reset) for practices that completed the 21-day funnel without replying or unsubscribing.',
        category: 'nurture',
        senderId: 'sales',
        steps: [
            { dayOffset: 30, templateId: 'dental_nurture_m1_voc_osha', label: 'Month 1 — NYS Part 226 VOC & OSHA Guide' },
            { dayOffset: 60, templateId: 'dental_nurture_m2_hipaa', label: 'Month 2 — HIPAA Environmental & BAA Checklist' },
            { dayOffset: 90, templateId: 'dental_nurture_m3_seasonal', label: 'Month 3 — High-Traffic Reset & Open Audit Invite' },
        ],
    },
];

// ══════════════════════════════════════════════════════════════════════
// 5. METRO NY DENTAL & ORTHO PROSPECTING CONFIG
// ══════════════════════════════════════════════════════════════════════

const DENTAL_ORTHO_QUERIES = [
    // Tier 1: Core Dental & Orthodontics
    'dental office',
    'general dentist',
    'family dentist',
    'cosmetic dentist',
    'dental practice',
    'orthodontist',
    'orthodontic practice',
    'orthodontics clinic',
    'invisalign orthodontist',
    'braces orthodontist',
    // Tier 2: High-LTV Dental Specialties
    'pediatric dentist',
    'children dentist',
    'kids dental office',
    'oral surgeon',
    'oral and maxillofacial surgery',
    'dental implant specialist',
    'endodontist',
    'periodontist',
    'prosthodontist',
];

const METRO_NY_LOCATIONS = [
    // Nassau County (Long Island)
    'Garden City, NY', 'Mineola, NY', 'Hicksville, NY', 'Levittown, NY', 'Freeport, NY',
    'Hempstead, NY', 'Westbury, NY', 'Great Neck, NY', 'Manhasset, NY', 'Floral Park, NY',
    'Massapequa, NY', 'Rockville Centre, NY', 'Long Beach, NY', 'Valley Stream, NY',
    'Port Washington, NY', 'Syosset, NY', 'Glen Cove, NY', 'Farmingdale, NY',
    'Merrick, NY', 'Bellmore, NY', 'Wantagh, NY', 'Plainview, NY', 'Bethpage, NY',
    'Oceanside, NY', 'East Meadow, NY', 'Franklin Square, NY', 'Lynbrook, NY',
    'New Hyde Park, NY', 'Jericho, NY', 'Carle Place, NY', 'Roslyn, NY', 'Woodbury, NY',
    'Baldwin, NY', 'Cedarhurst, NY', 'Hewlett, NY', 'Lawrence, NY', 'Seaford, NY', 'Williston Park, NY',

    // Suffolk County (Long Island)
    'Huntington, NY', 'Melville, NY', 'Babylon, NY', 'Bay Shore, NY', 'Islip, NY',
    'Brentwood, NY', 'Smithtown, NY', 'Commack, NY', 'Hauppauge, NY', 'Patchogue, NY',
    'Ronkonkoma, NY', 'Lake Grove, NY', 'Riverhead, NY', 'Deer Park, NY', 'Lindenhurst, NY',
    'West Islip, NY', 'Centereach, NY', 'Bohemia, NY', 'Holbrook, NY', 'Medford, NY',
    'Sayville, NY', 'East Northport, NY', 'Northport, NY', 'Kings Park, NY',
    'Port Jefferson, NY', 'Stony Brook, NY', 'East Setauket, NY', 'Coram, NY', 'Selden, NY',
    'Southampton, NY', 'East Hampton, NY', 'Westhampton Beach, NY', 'Amityville, NY',
    'Copiague, NY', 'Miller Place, NY', 'Rocky Point, NY', 'Shirley, NY',

    // Queens
    'Flushing, NY', 'Jamaica, NY', 'Astoria, NY', 'Long Island City, NY',
    'Forest Hills, NY', 'Bayside, NY', 'Jackson Heights, NY', 'Rego Park, NY',
    'Elmhurst, NY', 'Ridgewood, NY', 'Fresh Meadows, NY', 'Whitestone, NY',
    'College Point, NY', 'Woodside, NY', 'Kew Gardens, NY', 'Howard Beach, NY',
    'Ozone Park, NY', 'Richmond Hill, NY', 'Maspeth, NY', 'Glendale, NY',
    'Sunnyside, NY', 'Middle Village, NY', 'Douglaston, NY', 'Little Neck, NY',

    // Brooklyn
    'Park Slope, Brooklyn, NY', 'Brooklyn Heights, Brooklyn, NY', 'Williamsburg, Brooklyn, NY',
    'Bay Ridge, Brooklyn, NY', 'Bensonhurst, Brooklyn, NY', 'Dyker Heights, Brooklyn, NY',
    'Midwood, Brooklyn, NY', 'Sheepshead Bay, Brooklyn, NY', 'Borough Park, Brooklyn, NY',
    'Carroll Gardens, Brooklyn, NY', 'Cobble Hill, Brooklyn, NY', 'Greenpoint, Brooklyn, NY',
    'Fort Greene, Brooklyn, NY', 'Downtown Brooklyn, NY', 'Dumbo, Brooklyn, NY',
    'Flatbush, Brooklyn, NY', 'Crown Heights, Brooklyn, NY', 'Prospect Heights, Brooklyn, NY',
    'Marine Park, Brooklyn, NY', 'Mill Basin, Brooklyn, NY', 'Sunset Park, Brooklyn, NY',
    'Bushwick, Brooklyn, NY', 'Bedford-Stuyvesant, Brooklyn, NY',

    // Manhattan
    'Upper East Side, Manhattan, NY', 'Upper West Side, Manhattan, NY',
    'Midtown East, Manhattan, NY', 'Midtown West, Manhattan, NY',
    'Murray Hill, Manhattan, NY', 'Gramercy, Manhattan, NY',
    'Chelsea, Manhattan, NY', 'Flatiron, Manhattan, NY',
    'SoHo, Manhattan, NY', 'Tribeca, Manhattan, NY',
    'Greenwich Village, Manhattan, NY', 'East Village, Manhattan, NY',
    'Financial District, Manhattan, NY', 'Lower East Side, Manhattan, NY',
    'Harlem, Manhattan, NY', 'Washington Heights, Manhattan, NY',
    'Battery Park City, Manhattan, NY', 'Kips Bay, Manhattan, NY',
    'Hell\'s Kitchen, Manhattan, NY', 'Yorkville, Manhattan, NY',

    // Bronx
    'Riverdale, Bronx, NY', 'Morris Park, Bronx, NY', 'Pelham Bay, Bronx, NY',
    'Throgs Neck, Bronx, NY', 'Kingsbridge, Bronx, NY', 'Fordham, Bronx, NY',
    'Parkchester, Bronx, NY', 'Concourse, Bronx, NY', 'Woodlawn, Bronx, NY',
    'Mott Haven, Bronx, NY', 'Country Club, Bronx, NY', 'Baychester, Bronx, NY',

    // Staten Island
    'New Dorp, Staten Island, NY', 'Great Kills, Staten Island, NY',
    'St. George, Staten Island, NY', 'Todt Hill, Staten Island, NY',
    'Eltingville, Staten Island, NY', 'Annadale, Staten Island, NY',
    'Tottenville, Staten Island, NY', 'West Brighton, Staten Island, NY',
    'Huguenot, Staten Island, NY', 'Bull\'s Head, Staten Island, NY',

    // Yonkers & Westchester County
    'Yonkers, NY', 'White Plains, NY', 'New Rochelle, NY', 'Scarsdale, NY',
    'Rye, NY', 'Harrison, NY', 'Mamaroneck, NY', 'Larchmont, NY',
    'Bronxville, NY', 'Eastchester, NY', 'Tuckahoe, NY', 'Mount Vernon, NY',
    'Pelham, NY', 'Tarrytown, NY', 'Sleepy Hollow, NY', 'Dobbs Ferry, NY',
    'Hastings-on-Hudson, NY', 'Irvington, NY', 'Ardsley, NY', 'Hartsdale, NY',
    'Armonk, NY', 'Chappaqua, NY', 'Mount Kisco, NY', 'Rye Brook, NY',
    'Port Chester, NY', 'Yorktown Heights, NY', 'Ossining, NY', 'Peekskill, NY',
];

const EXCLUDE_PATTERNS = [
    'aspen dental', 'heartland dental', 'pacific dental', 'tend dental',
    'dental365', 'prohealth dental', 'clearchoice', 'great expressions',
    'smile doctors', 'western dental', 'dental lab', 'dental supply', 'hospital',
];

// ══════════════════════════════════════════════════════════════════════
// 6. AI SDR PROMPTS (prompts/{id})
// ══════════════════════════════════════════════════════════════════════

const SDR_PROMPTS = [
    {
        id: 'sdr_profiler',
        name: 'Agent 1: Dental & Ortho ICP Profiler',
        description: 'Evaluates private dental & orthodontic practices across Long Island, NYC 5 Boroughs, Yonkers & Westchester; extracts ClinicDossier, specialty, chair estimate, decision-maker, and DSO disqualification.',
        content: `You are an expert B2B SDR Intelligence Agent for XIRI Facility Solutions, specializing in Dental and Orthodontic practice intelligence across Metro New York.

Your task: Analyze the provided website content, search evidence, and practice metadata for a dental or orthodontic practice.
Evaluate its ICP fit, classify its exact specialty (especially whether it is an orthodontic practice vs. general/specialty dental), identify whether it is a private practice or corporate DSO, and find the best local decision-maker.

TARGET ICP CRITERIA:
- Private or partner-owned Dental or Orthodontic practice (General/Family, Orthodontics, Pediatric, Oral Surgery, Endodontics, Periodontics, Prosthodontics, Cosmetic)
- Physical clinic with 2+ operatories/chairs located in Long Island (Nassau/Suffolk), NYC 5 Boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island), Yonkers, or Westchester County
- Decision-Maker Priority:
  1. Office Manager, Practice Administrator, Practice Director, Treatment Coordinator / Operations Manager
  2. Lead Dental Assistant / Clinical Coordinator (if involved in facilities/OSHA)
  3. Owner / Partner Doctor (for solo or boutique practices)
- DISQUALIFY / REJECT (set icpScore < 30 and isDsoChain: true when applicable):
  - Corporate DSO chains with centralized procurement (Aspen Dental, Heartland, Pacific Dental, Tend, Dental365, ProHEALTH Dental, Great Expressions, ClearChoice, Smile Doctors, Western Dental)
  - Dental labs, dental supply vendors, hospital clinics, university clinics, or mobile-only services

WEBSITE & SEARCH CONTENT:
Business Name: {{businessName}}
Address: {{address}}
Website: {{website}}
Content:
{{websiteText}}

Return ONLY valid JSON with this exact schema:
{
  "clinicType": "general" | "ortho" | "pediatric" | "oral_surgery" | "periodontics" | "endodontics" | "prosthodontics" | "cosmetic" | "other",
  "isDsoChain": boolean,
  "dsoName": string | null,
  "estimatedOperatories": number,
  "doctorCount": number,
  "keyObservation": "1-2 concise, concrete sentences about their clinical focus (e.g. open-bay ortho clinic, Invisalign/iTero, pediatric family space, multi-doctor dental suite), doctors, or operational setup to personalize an email opening",
  "icpScore": number (0 to 100, >=75 is auto-enroll high fit),
  "decisionMaker": {
    "name": "full name of best decision maker or null",
    "title": "their exact title or null",
    "roleType": "office_manager" | "practice_administrator" | "owner_doctor" | "clinical_coordinator" | "unknown",
    "email": "personal direct email address if found, or null",
    "phone": "direct or office phone or null"
  },
  "genericEmail": "fallback info@ or office@ email if no personal email found, or null",
  "confidence": "high" | "medium" | "low",
  "qualificationReason": "brief explanation of why this practice fits or does not fit our ICP"
}`,
    },
    {
        id: 'sdr_copywriter',
        name: 'Agent 2: Dental & Ortho Funnel Copywriter (Touch 1)',
        description: 'Writes personalized <95-word Touch 1 cold emails tailored to private dental or orthodontic practices across Long Island, NYC 5 Boroughs, Yonkers & Westchester.',
        content: `You are an elite B2B SDR Copywriter for XIRI Facility Solutions, writing Email #1 of an email marketing funnel to a private dental or orthodontic practice decision-maker in Metro NY (Long Island, NYC 5 Boroughs, Yonkers, or Westchester).

CORE VALUE PROPOSITION:
1. SPECIALIZED DENTAL & ORTHO PROTOCOLS: Chair-safe EPA List N disinfection (protects A-dec/Belmont/Boyd Ultraleather upholstery), CaviWipe LVT haze removal, sterilization galley detailing, and (for orthodontic clinics) open-bay chair/iTero scanner protection and spotless teen/parent waiting areas.
2. NFC PHOTO-VERIFIED ACCOUNTABILITY: Timestamped digital proof-of-work logs delivered before clinic doors open — so office managers and hygienists never waste 7:45 AM re-cleaning or chasing an absentee crew.
3. LOCAL METRO NY TEAM & TRANSPARENT FLAT-RATE PRICING: Locally managed crews across Long Island, NYC, Yonkers & Westchester (never an absentee national franchise), with flat-rate pricing and no long-term lock-in.

TARGET PRACTICE CONTEXT:
- Practice Name: {{cleanBizName}}
- Contact: {{contactName}} ({{contactTitle}})
- Town / Neighborhood: {{city}}
- Clinical Focus: {{clinicType}}
- Specific Observation: {{keyObservation}}

COPYWRITING RULES:
1. Strictly under 95 words. Conversational, peer-to-peer, respectful of a busy practice schedule.
2. Open with a concrete reference tailored to {{cleanBizName}} using {{keyObservation}} (NEVER generic "local practices" filler).
3. If Clinical Focus is "ortho", emphasize open-bay chairs, parent/teen waiting-room first impressions, and scanner/bracket-dust detailing. Otherwise emphasize operatory terminal cleaning, chair upholstery safety, and RDH/DA relief.
4. One clear, low-friction CTA: ask if they'd like to see a 60-second sample nightly verification log or schedule a free 15-minute after-hours hygiene audit for {{cleanBizName}}.
5. Subject line: short (3-6 words), conversational, lowercase or sentence case (e.g. "quick question for {{cleanBizName}}" or "pre-opening logs — {{cleanBizName}}").
6. Do NOT include a full signature block (appended automatically) — end cleanly with a question CTA.

Return ONLY valid JSON:
{
  "subject": "subject line",
  "body": "email body text with paragraph breaks"
}`,
    },
    {
        id: 'sdr_intent_triage',
        name: 'Agent 3: Inbound Reply & Intent Triage Guard',
        description: 'Triages inbound dental/ortho replies to immediately halt cold sequences on positive replies or opt-outs and alert Chris in Google Chat.',
        content: `You are an SDR Safety and Intent Triage Agent for XIRI Facility Solutions.
Your job is to analyze inbound email replies and high-intent engagement actions from prospective dental and orthodontic practices across Metro NY.

DETERMINE IF A HUMAN HANDOFF IS REQUIRED:
A human handoff is REQUIRED whenever:
- The prospect expresses positive interest ("Yes, send info", "Call me tomorrow", "What are your rates?", "Send a sample log", "Audit")
- The prospect asks a genuine question ("Are you insured?", "Who else do you clean for in Westchester / Brooklyn / Garden City?", "Do you clean after 8 PM?")
- The prospect requests a quote, pricing, or walkthrough

A human handoff is NOT required if:
- Auto-responder / Out of Office ("I am out of office until Monday")
- Hard negative / Unsubscribe ("Please remove us", "Not interested", "Stop emailing")
- Spam or delivery bounce

LEAD CONTEXT:
- Practice: {{businessName}}
- Contact: {{contactName}} ({{contactTitle}})
- Email: {{leadEmail}}
- Event / Reply:
{{inboundContent}}

Return ONLY valid JSON:
{
  "intent": "positive_interest" | "question_pricing" | "question_scope" | "out_of_office" | "negative_not_interested" | "negative_unsubscribe" | "ambiguous",
  "isHotLead": boolean,
  "confidence": number (0 to 1),
  "summary": "1-sentence executive summary of what the prospect said/did",
  "action": "hand_off_to_human" | "continue_drip" | "suppress_contact"
}`,
    },
];

async function seedDentalSdrFunnel() {
    const now = new Date();
    const allTemplates = [...DENTAL_TEMPLATES, ...ORTHO_TEMPLATES, ...MONTHLY_NURTURE_TEMPLATES];

    console.log(`\n🌱 Seeding ${allTemplates.length} Dental/Ortho funnel & nurture templates...`);
    for (const tpl of allTemplates) {
        await db.collection('templates').doc(tpl.id).set({
            name: tpl.name,
            category: tpl.category,
            sequence: tpl.sequence,
            subject: tpl.subject,
            body: tpl.body,
            content: tpl.body,
            useCustomDraft: !!tpl.useCustomDraft,
            updatedAt: now,
            stats: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                bounced: 0,
                lastUpdated: now,
            },
        }, { merge: true });
        console.log(`   ✓ template/${tpl.id}`);
    }

    console.log(`\n🌱 Seeding ${SEQUENCES.length} sequences...`);
    for (const seq of SEQUENCES) {
        await db.collection('sequences').doc(seq.id).set({
            name: seq.name,
            description: seq.description,
            category: seq.category,
            senderId: seq.senderId,
            nextSequenceId: seq.nextSequenceId || null,
            steps: seq.steps,
            updatedAt: now,
        }, { merge: true });
        console.log(`   ✓ sequences/${seq.id} (${seq.steps.length} steps)`);
    }

    console.log(`\n🤖 Seeding ${SDR_PROMPTS.length} AI SDR Studio prompts...`);
    for (const prompt of SDR_PROMPTS) {
        await db.collection('prompts').doc(prompt.id).set({
            name: prompt.name,
            description: prompt.description,
            content: prompt.content,
            updatedAt: now,
        }, { merge: true });
        console.log(`   ✓ prompts/${prompt.id}`);
    }

    console.log(`\n📍 Seeding Dental & Ortho Metro NY prospecting_config/default...`);
    await db.collection('prospecting_config').doc('default').set({
        queries: DENTAL_ORTHO_QUERIES,
        locations: METRO_NY_LOCATIONS,
        dailyTarget: 60,
        maxDailyOutreach: 30,
        autoEnrollEnabled: true,
        autoEnrollMinIcp: 75,
        enabled: true,
        excludePatterns: EXCLUDE_PATTERNS,
        updatedAt: now,
    }, { merge: true });
    console.log(`   ✓ prospecting_config/default (${DENTAL_ORTHO_QUERIES.length} queries × ${METRO_NY_LOCATIONS.length} locations = ${DENTAL_ORTHO_QUERIES.length * METRO_NY_LOCATIONS.length} combos)`);

    console.log('\n✅ Dental & Orthodontic SDR Funnel seeding complete!\n');
}

if (require.main === module) {
    seedDentalSdrFunnel()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('❌ Seed failed:', err);
            process.exit(1);
        });
}

module.exports = { seedDentalSdrFunnel };
