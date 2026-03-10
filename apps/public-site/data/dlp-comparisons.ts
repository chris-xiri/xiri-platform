// Comparison / Alternative Pages — pSEO Data
// Target keywords: "[XIRI] vs [Competitor]", "[Competitor] alternative", "best commercial cleaning companies [location]"

export interface ComparisonPage {
    title: string;
    h1: string;
    metaDescription: string;
    /** 'vs' = XIRI vs Competitor, 'alternative' = [X] Alternative, 'best-of' = Best [X] in [Location] */
    type: 'vs' | 'alternative' | 'best-of';
    intro: string;
    comparisonTable: {
        feature: string;
        xiri: string;
        competitor: string;
    }[];
    sections: { title: string; content: string }[];
    verdict: string;
    faqs: { question: string; answer: string }[];
}

export const COMPARISON_PAGES: Record<string, ComparisonPage> = {
    // ── VS PAGES ──
    'xiri-vs-jani-king': {
        title: 'XIRI vs. Jani-King — Franchise vs. Single-Vendor',
        h1: 'XIRI vs. Jani-King: Which Commercial Cleaning Model Works Better?',
        metaDescription: 'Compare XIRI vs. Jani-King for commercial cleaning. See differences in compliance, pricing, and accountability. Single-vendor vs. franchise model.',
        type: 'vs',
        intro: 'Jani-King is the world\'s largest commercial cleaning franchise. XIRI is a single-vendor facility management partner. Both clean buildings — but the models couldn\'t be more different. Here\'s what matters when you\'re choosing.',
        comparisonTable: [
            { feature: 'Business Model', xiri: 'Single managed vendor — one contract, one point of contact', competitor: 'Franchise — your local franchisee varies in quality and experience' },
            { feature: 'Compliance Documentation', xiri: 'Nightly audit reports, ATP testing, JCAHO-ready documentation', competitor: 'Varies by franchisee — no standardized compliance system' },
            { feature: 'Insurance', xiri: '$1M GL + Workers\' Comp verified annually', competitor: 'Franchisee-dependent — coverage may lapse without corporate oversight' },
            { feature: 'Quality Control', xiri: 'Night Manager physically verifies work every shift', competitor: 'Self-reported quality — no independent verification layer' },
            { feature: 'Medical Facility Capability', xiri: 'OSHA + HIPAA trained crews, terminal cleaning certified', competitor: 'General commercial cleaning — medical specialization varies' },
            { feature: 'Pricing Transparency', xiri: 'Fixed-scope, per-sqft pricing with line-item breakdown', competitor: 'Franchise fee + markup — total cost often unclear' },
            { feature: 'Contractor Vetting', xiri: 'Background-checked, insured, Standard Track certified', competitor: 'Franchisee buys territory — vetting depth varies' },
        ],
        sections: [
            { title: 'The Franchise Model Problem', content: 'Franchise commercial cleaning companies sell territories to independent operators. The quality of your cleaning depends entirely on which franchisee bought your zip code. XIRI eliminates this lottery by vetting, training, and auditing every contractor centrally.' },
            { title: 'Why Medical Facilities Choose XIRI', content: 'Medical offices, surgery centers, and dental practices need more than general janitorial. They need compliance-grade documentation, OSHA-trained crews, and audit-ready cleaning logs. XIRI was built for this specific need — not adapted from a residential cleaning franchise.' },
            { title: 'The Night Manager Difference', content: 'XIRI\'s Night Manager physically verifies every cleaning shift. This isn\'t a checklist app — it\'s an actual person walking your facility, checking work quality, and filing reports. Franchise models rely on self-reporting, which means problems don\'t surface until you notice them.' },
        ],
        verdict: 'If you need basic office cleaning and don\'t mind variability, a franchise might work. If you manage a medical facility, require compliance documentation, or need accountability beyond a checklist app — XIRI is built for you.',
        faqs: [
            { question: 'Is XIRI more expensive than Jani-King?', answer: 'XIRI pricing is typically comparable or lower when you factor in Jani-King\'s franchise fees, markup structure, and the cost of managing quality issues yourself. XIRI provides a transparent per-sqft price with everything included.' },
            { question: 'Can XIRI handle multiple locations?', answer: 'Yes. XIRI manages multi-site portfolios under a single contract. One invoice, one point of contact, consistent quality across all locations — regardless of geography.' },
            { question: 'What if I\'m currently with Jani-King?', answer: 'We offer a free facility audit to identify gaps in your current service. Most transitions take 2–3 weeks with zero downtime.' },
        ],
    },
    'xiri-vs-coverall': {
        title: 'XIRI vs. Coverall — Managed Service vs. Franchise',
        h1: 'XIRI vs. Coverall: Why Single-Vendor Beats Franchise for Medical Facilities',
        metaDescription: 'XIRI vs. Coverall commercial cleaning comparison. See why medical offices choose single-vendor management over franchise models.',
        type: 'vs',
        intro: 'Coverall is a franchise-based commercial cleaning company. XIRI is a managed facility services partner. If you\u2019re evaluating both, here\u2019s what you need to know.',
        comparisonTable: [
            { feature: 'Business Model', xiri: 'Fully managed — XIRI recruits, trains, and audits all contractors', competitor: 'Franchise — franchisees purchase cleaning accounts' },
            { feature: 'Medical Specialization', xiri: 'Purpose-built for healthcare facilities', competitor: 'General commercial cleaning with medical add-ons' },
            { feature: 'Night Audits', xiri: 'Physical verification every shift by Night Manager', competitor: 'No independent verification layer' },
            { feature: 'Compliance Docs', xiri: 'JCAHO, OSHA, HIPAA documentation included', competitor: 'Basic cleaning logs — compliance extras vary' },
            { feature: 'Multi-Service', xiri: 'Janitorial + HVAC + landscaping + handyman under one contract', competitor: 'Janitorial only — other trades require separate vendors' },
            { feature: 'Technology', xiri: 'xiriOS dashboard for real-time tracking, reports, and communication', competitor: 'Basic CRM — limited client visibility' },
        ],
        sections: [
            { title: 'Why "Franchise" Doesn\u2019t Mean "Better"', content: 'Franchise cleaning companies sell territories to independent operators who may have limited experience. Your cleaning quality depends on which franchisee services your area. XIRI centralizes recruitment, training, and quality control — so every facility gets the same standard.' },
            { title: 'Beyond Janitorial', content: 'Coverall provides janitorial services. XIRI provides facility management: janitorial, HVAC maintenance, landscaping, handyman services, and compliance documentation — all under one contract. That means one vendor, one invoice, one relationship.' },
        ],
        verdict: 'Coverall is fine for basic commercial cleaning. For medical facilities, multi-service needs, or anyone who wants verified quality rather than self-reported quality — XIRI is the purpose-built solution.',
        faqs: [
            { question: 'How is XIRI different from Coverall?', answer: 'XIRI is a managed facility services company, not a franchise. We recruit, vet, and audit all contractors centrally. Coverall sells franchise territories to independent operators.' },
            { question: 'Does XIRI cost more than Coverall?', answer: 'XIRI pricing is competitive and includes compliance documentation, night audits, and multi-service coordination that Coverall charges extra for or doesn\'t provide.' },
        ],
    },

    // ── BEST-OF PAGES ──
    'best-commercial-cleaning-nassau-county': {
        title: 'Best Commercial Cleaning Companies in Nassau County (2026)',
        h1: 'Best Commercial Cleaning Companies in Nassau County, NY — 2026 Guide',
        metaDescription: 'Ranked: the best commercial cleaning companies in Nassau County for 2026. Compare pricing, compliance, and specializations for offices and medical facilities.',
        type: 'best-of',
        intro: 'Finding a reliable commercial cleaning company in Nassau County means sorting through dozens of options — from one-person crews to national franchises. We evaluated the top providers based on insurance, compliance capability, medical specialization, and client reviews.',
        comparisonTable: [
            { feature: 'Medical Facility Certified', xiri: '✓ OSHA, HIPAA, JCAHO trained', competitor: 'Varies — most lack healthcare specialization' },
            { feature: 'Night Audit Verification', xiri: '✓ Physical verification every shift', competitor: '✗ Self-reported quality across the market' },
            { feature: '$1M Insurance Verified', xiri: '✓ Annual COI verification', competitor: 'Most small operators carry minimum coverage' },
            { feature: 'Multi-Service (HVAC, Landscaping)', xiri: '✓ Single vendor for all facility needs', competitor: 'Janitorial only — requires multiple vendors' },
            { feature: 'Transparent Pricing', xiri: '✓ Per-sqft, line-item breakdown', competitor: 'Opaque quotes common in the market' },
            { feature: 'Technology Platform', xiri: '✓ xiriOS dashboard with real-time reports', competitor: 'Paper-based or basic apps' },
        ],
        sections: [
            { title: 'What to Look for in a Nassau County Cleaning Company', content: 'Insurance is non-negotiable: $1M general liability and workers\' compensation. For medical facilities, add OSHA bloodborne pathogen training and HIPAA awareness. Ask for references from similar facility types — a company that cleans offices well may struggle with medical compliance requirements.' },
            { title: 'Why Local Matters', content: 'Nassau County has unique requirements: high commercial density from Great Neck to Garden City, a strong medical corridor, and demanding property managers. Choose a cleaning company with route density in your area — less drive time means more cleaning time and better margins for them (and pricing for you).' },
            { title: 'The XIRI Approach', content: 'XIRI manages a network of vetted, insured subcontractors across Nassau County. Instead of hiring one company and hoping they deliver, XIRI provides managed accountability: nightly audits, compliance documentation, and a single point of contact for your entire facility portfolio.' },
        ],
        verdict: 'For general office cleaning, any licensed, insured provider can work. For medical facilities, multi-site portfolios, or anyone who needs compliance documentation and verified quality — XIRI is the managed solution purpose-built for Nassau County.',
        faqs: [
            { question: 'How much does commercial cleaning cost in Nassau County?', answer: 'Typical rates range from $0.08–$0.35/sqft depending on facility type. Medical offices run $0.15–$0.45/sqft due to compliance requirements. XIRI provides transparent, per-sqft pricing with no hidden fees.' },
            { question: 'What\u2019s the difference between a cleaning company and a facility management company?', answer: 'A cleaning company provides janitorial services. A facility management company like XIRI provides janitorial plus HVAC, landscaping, handyman, compliance documentation, and centralized management — all under one contract.' },
            { question: 'How do I switch cleaning companies in Nassau County?', answer: 'Most transitions take 2–3 weeks. XIRI offers a free facility audit before you switch. We assess your current service gaps, build a custom scope, and handle the onboarding — zero disruption to your operations.' },
        ],
    },

    'xiri-vs-servpro': {
        title: 'XIRI vs. SERVPRO — Ongoing Facility Management vs. Restoration',
        h1: 'XIRI vs. SERVPRO: Different Services for Different Problems',
        metaDescription: 'XIRI vs. SERVPRO — not competitors, but fundamentally different services. Compare ongoing facility management vs. disaster restoration to see which you actually need.',
        type: 'vs',
        intro: 'XIRI and SERVPRO both work in commercial facilities — but they solve completely different problems. SERVPRO is a fire, water, and storm restoration company. XIRI is an ongoing facility management partner. Understanding the difference can save you from hiring the wrong vendor for the wrong job.',
        comparisonTable: [
            { feature: 'Core Service', xiri: 'Ongoing facility management — janitorial, HVAC, landscaping, maintenance', competitor: 'Disaster restoration — fire, flood, mold, and storm damage cleanup' },
            { feature: 'When You Call', xiri: 'Before something goes wrong — preventive maintenance and daily cleaning', competitor: 'After something goes wrong — emergency restoration and reconstruction' },
            { feature: 'Engagement Type', xiri: 'Recurring monthly contract with scheduled services', competitor: 'One-time project-based engagement per incident' },
            { feature: 'Scope', xiri: 'Multi-trade: janitorial + HVAC + landscaping + handyman + compliance', competitor: 'Single-trade: water extraction, fire remediation, mold abatement' },
            { feature: 'Business Model', xiri: 'Managed vendor — XIRI recruits, trains, and audits all contractors', competitor: 'Franchise — local franchise owner operates independently' },
            { feature: 'Compliance Docs', xiri: 'OSHA, HIPAA, JCAHO documentation for ongoing operations', competitor: 'IICRC certifications for restoration work' },
            { feature: 'Pricing Model', xiri: 'Fixed monthly per-sqft pricing', competitor: 'Per-project pricing based on damage scope (often insurance-billed)' },
            { feature: 'Medical Facility Focus', xiri: 'Purpose-built for healthcare — terminal cleaning, infection control', competitor: 'General commercial — no specific healthcare compliance specialization' },
        ],
        sections: [
            { title: 'They\'re Not Competitors — They Solve Different Problems', content: 'The most common mistake facility managers make is thinking "cleaning company" is one category. It\'s not. SERVPRO is who you call when your basement floods, a pipe bursts, or fire damage needs remediation. XIRI is who you call when you need your medical office cleaned every night, your HVAC filters changed quarterly, and your compliance documentation audit-ready year-round. You might need both — but never for the same job.' },
            { title: 'Preventive vs. Reactive', content: 'SERVPRO\'s business model is reactive by design: they respond to emergencies. XIRI\'s model is preventive: regular maintenance, nightly cleaning, and documented inspections that reduce the likelihood of the emergencies SERVPRO handles. A well-maintained facility with proper HVAC, plumbing, and janitorial programs has fewer water damage incidents, fewer mold issues, and fewer insurance claims.' },
            { title: 'The Franchise Question', content: 'Both SERVPRO and traditional cleaning franchises use franchise models — but the comparison ends there. SERVPRO franchise owners invest in expensive restoration equipment and specialized IICRC training for emergency work. XIRI is not a franchise: we centrally recruit, vet, train, and audit all contractors in our network, ensuring consistent quality across every facility.' },
            { title: 'When You Actually Need SERVPRO', content: 'Pipe burst, roof leak, fire damage, storm damage, mold discovered behind walls — these are legitimate SERVPRO scenarios. They have the extraction equipment, dehumidifiers, and remediation expertise for these events. Once the restoration is complete, however, you need an ongoing facility management partner to prevent it from happening again and maintain the space day-to-day. That\'s XIRI.' },
        ],
        verdict: 'SERVPRO and XIRI are not competitors — they\'re complementary. SERVPRO handles the emergencies; XIRI handles everything else. If you need ongoing facility management (daily cleaning, HVAC, landscaping, compliance documentation), you need XIRI. If your facility just had a disaster, call SERVPRO first — then call XIRI to make sure it doesn\'t happen again.',
        faqs: [
            { question: 'Is XIRI a competitor to SERVPRO?', answer: 'No. SERVPRO is a restoration company that handles fire, water, and storm damage. XIRI is an ongoing facility management company that handles daily cleaning, preventive maintenance, and compliance documentation. They solve different problems.' },
            { question: 'Can XIRI handle water damage or fire restoration?', answer: 'No. XIRI focuses on ongoing preventive facility management. For emergency restoration, we recommend working with a certified restoration company like SERVPRO. Once the restoration is complete, XIRI handles the ongoing maintenance.' },
            { question: 'Do I need both XIRI and SERVPRO?', answer: 'Most facilities need ongoing management (XIRI) and rarely need restoration (SERVPRO). Having XIRI\'s preventive maintenance program actually reduces the likelihood of needing emergency restoration — proper HVAC maintenance prevents mold, regular plumbing inspections catch leaks early, and nightly facility checks identify issues before they become disasters.' },
            { question: 'My facility just had water damage. Who should I call?', answer: 'Call a restoration company (like SERVPRO) immediately for water extraction and remediation. Once the space is restored, contact XIRI to set up ongoing facility management to prevent recurring issues and maintain the space properly.' },
        ],
    },

    // ── CONCEPT PAGES ──
    'general-contractor-facility-maintenance': {
        title: 'The General Contractor Model for Facility Maintenance',
        h1: 'Why Your Building Needs a GC for Facility Maintenance — Not Just a Cleaning Company',
        metaDescription: 'You hire a general contractor for construction. Why not for ongoing facility maintenance? See how the GC model — vetted subs, insurance, single point of contact — works for cleaning, HVAC, and maintenance.',
        type: 'alternative',
        intro: 'When you build or renovate a building, you don\'t hire the electrician, plumber, painter, and framer separately. You hire a General Contractor who vets the subs, carries the insurance, manages the schedule, and takes responsibility for the outcome. So why do building owners still manage 5 separate vendors for ongoing facility maintenance? XIRI applies the GC model to facility operations — and the results speak for themselves.',
        comparisonTable: [
            { feature: 'Number of Vendor Relationships', xiri: '1 — XIRI manages everything', competitor: '4-6 separate vendors (cleaning, HVAC, landscaping, handyman, snow, pest)' },
            { feature: 'Insurance Verification', xiri: 'XIRI verifies COIs annually for every subcontractor', competitor: 'You verify each vendor individually (and hope they don\'t lapse)' },
            { feature: 'Subcontractor Vetting', xiri: 'Background checks, reference checks, 90-day probation, Standard Track certification', competitor: 'You trust Google reviews and a handshake' },
            { feature: 'Quality Control', xiri: 'Night Manager physically verifies work every shift', competitor: 'You walk the building yourself (or don\'t, and things slip)' },
            { feature: 'Invoicing', xiri: 'One consolidated monthly invoice for all services', competitor: '4-6 separate invoices, payment schedules, and AP headaches' },
            { feature: 'Accountability', xiri: 'XIRI is the single point of accountability — no finger-pointing', competitor: '"That\'s not our scope" — every vendor points to another' },
            { feature: 'Compliance Documentation', xiri: 'OSHA, HIPAA, JCAHO documentation maintained and audit-ready', competitor: 'You compile documentation from each vendor (if they have any)' },
            { feature: 'Backup Coverage', xiri: 'XIRI provides backup subcontractors if primary is unavailable', competitor: 'Your cleaner calls out sick — you scramble' },
        ],
        sections: [
            { title: 'The GC Analogy Everyone Understands', content: 'In construction, nobody questions why you hire a General Contractor. The GC doesn\'t swing every hammer — they vet the subcontractors, verify insurance, manage the schedule, inspect the work, and take responsibility if something goes wrong. You pay one company, get one point of contact, and hold one entity accountable. XIRI does exactly the same thing — but for the ongoing life of your building instead of the construction phase.' },
            { title: 'Why Multi-Vendor Management Fails', content: 'Most building owners manage facility maintenance the hard way: one company for cleaning, another for HVAC, a landscaper, a handyman, maybe a separate pest control vendor. Each has their own schedule, insurance, billing, and quality standards. When something falls through the cracks — and it always does — each vendor points to another. There\'s no single point of accountability. It\'s the same reason people stopped acting as their own GC on construction projects decades ago.' },
            { title: 'What a Facility GC Actually Does', content: 'XIRI recruits, vets, insures, trains, schedules, audits, and manages every subcontractor that touches your building. Janitorial crews are background-checked and Standard Track certified. HVAC techs carry EPA 608. Landscapers have commercial insurance. Every night, our Night Manager physically inspects the work. You get one contract, one invoice, one call when something needs attention — and one company that\'s accountable for all of it.' },
            { title: 'NNN Lease Owners: This Is Especially For You', content: 'If you own a single-tenant NNN lease property, you already understand the GC model from when the building was constructed or renovated. But once the tenant moves in, facility maintenance becomes fragmented across multiple vendors — and you lose the visibility and control you had during construction. XIRI brings it back: one managed partner handling all ongoing maintenance, with documented compliance and transparent pricing.' },
        ],
        verdict: 'You wouldn\'t build a building without a GC. You shouldn\'t maintain one without a facility management partner either. XIRI is the General Contractor for the ongoing life of your building — vetted subcontractors, verified insurance, nightly quality inspections, and one point of accountability for everything.',
        faqs: [
            { question: 'Is XIRI actually a General Contractor?', answer: 'XIRI applies the General Contractor operating model to facility maintenance services. Like a GC, we vet subcontractors, verify insurance, manage scheduling, inspect work quality, and serve as a single point of accountability. We don\'t hold a GC license — we manage ongoing facility operations, not construction projects.' },
            { question: 'Why is the GC model better for facility maintenance?', answer: 'The same reasons it\'s better for construction: single point of accountability, verified insurance across all trades, quality control by an independent party, and simplified billing. Most building owners manage 4-6 separate maintenance vendors — XIRI consolidates all of them under one managed contract.' },
            { question: 'How is this different from a property management company?', answer: 'Property management companies handle tenant relations, leasing, and rent collection. XIRI handles the physical operations: cleaning, HVAC maintenance, landscaping, handyman services, and compliance documentation. We complement property managers — we don\'t replace them.' },
            { question: 'What types of buildings benefit most from this model?', answer: 'Medical offices, dental practices, surgery centers, auto dealerships, and any facility with compliance requirements or multiple maintenance needs. Single-tenant NNN lease properties benefit especially, as owners get construction-grade accountability for ongoing operations.' },
        ],
    },
};
