/**
 * Service-Specific FAQ Intelligence
 * ----------------------------------
 * Maps each service slug to unique, industry-specific FAQ content backed by
 * authoritative sources: ISSA, CDC, BLS, OSHA, EPA, NAEYC, AORN, Liberty Mutual.
 *
 * Every FAQ carries a `sources` array with verifiable citation URLs
 * so facility managers can check the claims themselves.
 */

/** A citation link rendered as a footnote badge below the FAQ answer. */
export interface FaqSource {
  /** Short label displayed in the badge, e.g. "CDC" or "BLS OES 2023" */
  name: string;
  /** Full URL to the authoritative source document */
  url: string;
}

/** Return type shared by every FAQ method: answer text + verifiable sources. */
export interface FaqEntry {
  question: string;
  answer: string;
  sources?: FaqSource[];
}

export interface ServiceFaqIntelligence {
  /** Which service slugs share this intelligence profile */
  slugs: string[];
  /** Service-specific quality/retention FAQ override */
  qualityFaq: (townName: string, medianWage: number, premiumPct: number, areaTitle: string, minWage: number) => FaqEntry;
  /** Service-specific competitive-landscape FAQ override */
  competitorFaq: (townName: string, region: string, competitorCount: number) => FaqEntry;
  /** Service-specific pricing FAQ override */
  pricingFaq: (townName: string, serviceName: string) => FaqEntry;
  /** Service-specific compliance/insurance FAQ override */
  complianceFaq: (townName: string, serviceName: string) => FaqEntry;
  /** Extra FAQ unique to this service category (always appended) */
  bonusFaq?: (townName: string, serviceName: string) => FaqEntry;
}

// ─── Reusable source references ─────────────────────────────────
const SRC = {
  BLS_OES: { name: 'BLS Occupational Employment Statistics', url: 'https://www.bls.gov/oes/current/oes372011.htm' },
  CENSUS_CBP: { name: 'U.S. Census Bureau — County Business Patterns', url: 'https://www.census.gov/programs-surveys/cbp.html' },
  ISSA_CIMS: { name: 'ISSA Cleaning Industry Management Standard', url: 'https://www.issa.com/certification-standards/cims' },
  ISSA_CT: { name: 'ISSA Cleaning Times & Tasks', url: 'https://www.issa.com/resource-center/issa-value-of-clean' },
  CDC_ENV_INFECTION: { name: 'CDC — Environmental Infection Control in Healthcare', url: 'https://www.cdc.gov/infection-control/hcp/environmental-control/index.html' },
  CDC_HAI: { name: 'CDC — Healthcare-Associated Infections', url: 'https://www.cdc.gov/hai/data/portal/index.html' },
  CDC_CHILDCARE: { name: 'CDC — Childcare & Schools Guidance', url: 'https://www.cdc.gov/hygiene/childcare/index.html' },
  CDC_DENTAL: { name: 'CDC — Infection Control in Dental Settings', url: 'https://www.cdc.gov/dental-infection-control/hcp/summary/index.html' },
  CDC_MRSA: { name: 'CDC — MRSA in Athletic Facilities', url: 'https://www.cdc.gov/mrsa/community/environment/index.html' },
  CDC_DIALYSIS: { name: 'CDC — Dialysis Safety', url: 'https://www.cdc.gov/dialysis/prevention-tips/index.html' },
  OSHA_BBP: { name: 'OSHA Bloodborne Pathogens Standard (29 CFR 1910.1030)', url: 'https://www.osha.gov/bloodborne-pathogens/standards' },
  OSHA_HOUSEKEEPING: { name: 'OSHA Walking-Working Surfaces (29 CFR 1910.22)', url: 'https://www.osha.gov/walking-working-surfaces/standards' },
  EPA_SAFER_CHOICE: { name: 'EPA Safer Choice Program', url: 'https://www.epa.gov/saferchoice' },
  EPA_LIST_N: { name: 'EPA List N: Disinfectants for Emerging Viral Pathogens', url: 'https://www.epa.gov/pesticide-registration/disinfectants-emerging-viral-pathogens-evps' },
  EPA_IAQ_SCHOOLS: { name: 'EPA IAQ Tools for Schools', url: 'https://www.epa.gov/iaq-schools' },
  EPA_DENTAL_EFFLUENT: { name: 'EPA Dental Amalgam Effluent Guidelines', url: 'https://www.epa.gov/eg/dental-effluent-guidelines' },
  LIBERTY_MUTUAL: { name: 'Liberty Mutual Workplace Safety Index', url: 'https://business.libertymutual.com/insights/workplace-safety-index/' },
  BLS_INJURIES: { name: 'BLS — Nonfatal Workplace Injuries', url: 'https://www.bls.gov/iif/' },
  CMS_ESRD: { name: 'CMS — Conditions for Coverage: ESRD Facilities', url: 'https://www.cms.gov/medicare/health-safety-standards/quality-safety-oversight-general-information/esrd' },
  ISO_14644: { name: 'ISO 14644 — Cleanrooms & Controlled Environments', url: 'https://www.iso.org/standard/53394.html' },
} as const;

// ──────────────────────────────────────────────
// HEALTHCARE: Medical Offices, Urgent Care, Surgery Centers
// ──────────────────────────────────────────────
const healthcareFaqs: ServiceFaqIntelligence = {
  slugs: [
    'medical-office-cleaning',
    'urgent-care-cleaning',
    'surgery-center-cleaning',
  ],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why does healthcare cleaning cost more than standard janitorial in ${townName}?`,
    answer: `Healthcare cleaning commands a 25–50% premium over standard office cleaning (ISSA Cleaning Industry Management Standard). The median hourly wage for janitorial workers in the ${areaTitle} is $${medianWage.toFixed(2)}/hr — ${premiumPct}% above New York's $${minWage.toFixed(2)}/hr minimum wage (BLS OES, May 2023). But in medical settings, you're not paying for mops — you're paying for infection control training, OSHA Bloodborne Pathogen compliance (29 CFR 1910.1030), and EPA-registered hospital-grade disinfectants with verified dwell times. Bidding medical cleaning at general-janitorial rates means staff who skip terminal protocols because they were never trained in them.`,
    sources: [SRC.ISSA_CIMS, SRC.BLS_OES, SRC.OSHA_BBP],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `With ${competitorCount.toLocaleString()} cleaning companies in ${region}, why choose XIRI for medical facilities?`,
    answer: `Of the ${competitorCount.toLocaleString()} registered janitorial companies in ${region} (U.S. Census Bureau, County Business Patterns), fewer than 15% specialize in healthcare-grade cleaning. The CDC estimates healthcare-associated infections (HAIs) cost the U.S. healthcare system $28–33 billion annually — and environmental cleaning is a fundamental infection prevention measure (CDC Guidelines for Environmental Infection Control). XIRI differentiates by deploying only contractors trained in CDC disinfection hierarchies, verifying every clean with Night Manager audits, and maintaining the digital compliance chain your JCAHO or state survey demands.`,
    sources: [SRC.CENSUS_CBP, SRC.CDC_ENV_INFECTION, SRC.CDC_HAI],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `How much does ${serviceName.toLowerCase()} cost per square foot in ${townName}?`,
    answer: `Healthcare cleaning typically ranges from $0.14–$0.35/sq ft for routine maintenance, and $1.00–$4.00+/sq ft for specialized areas like surgical suites requiring terminal disinfection (ISSA industry benchmarks, 2024). Your actual cost depends on facility layout, exam room count, biohazard scope, and service frequency. Use our free cost calculator for an instant estimate, or request a complimentary site audit — we'll deliver a custom quote within 48 hours. No long-term contracts required.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName, serviceName) => ({
    question: `What infection control certifications do your cleaners hold for ${townName} medical facilities?`,
    answer: `Every contractor deployed to healthcare facilities is trained in OSHA's Bloodborne Pathogen Standard (29 CFR 1910.1030), HIPAA environmental compliance, and CDC guidelines for environmental infection control in healthcare facilities. We use only EPA-registered hospital-grade disinfectants, follow the "clean first, then disinfect" hierarchy with verified dwell times, and carry $1M+ general liability insurance with healthcare endorsement. All credentials are verified before a single shift begins.`,
    sources: [SRC.OSHA_BBP, SRC.CDC_ENV_INFECTION],
  }),
  bonusFaq: (townName) => ({
    question: `How does XIRI help prevent healthcare-associated infections (HAIs) in ${townName}?`,
    answer: `HAIs affect 1 in 31 hospital patients on any given day (CDC, 2023) and cost U.S. facilities $28–33 billion annually. Our infection prevention approach follows CDC's evidence-based hierarchy: clean high-touch surfaces first (bed rails, light switches, door handles), use EPA-registered disinfectants with strict dwell-time compliance, prevent cross-contamination with fresh cloths per room, and verify thoroughness through Night Manager ATP bioluminescence testing. This isn't aesthetic cleaning — it's measurable infection prevention documented nightly.`,
    sources: [SRC.CDC_HAI, SRC.CDC_ENV_INFECTION],
  }),
};

// ──────────────────────────────────────────────
// DENTAL
// ──────────────────────────────────────────────
const dentalFaqs: ServiceFaqIntelligence = {
  slugs: ['dental-offices'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why does dental office cleaning require specialists in ${townName}?`,
    answer: `Dental offices generate aerosols, amalgam waste, and sharps that standard janitorial crews aren't trained to handle. The median janitorial wage in ${areaTitle} is $${medianWage.toFixed(2)}/hr — ${premiumPct}% above minimum wage (BLS OES). But dental cleaning demands OSHA Bloodborne Pathogen compliance (29 CFR 1910.1030), proper amalgam waste handling per EPA's dental effluent guidelines, and disinfection protocols calibrated to the procedure room's risk level. We pay above market rate specifically to retain cleaners experienced in dental environments.`,
    sources: [SRC.BLS_OES, SRC.OSHA_BBP, SRC.EPA_DENTAL_EFFLUENT],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I evaluate cleaning companies for my ${townName} dental practice?`,
    answer: `Among the ${competitorCount.toLocaleString()} janitorial companies in ${region} (U.S. Census Bureau), few understand dental-specific hazards: amalgam waste, aerosol contamination, and operatory sterilization. Ask vendors three questions: (1) Are your crews trained in OSHA's Bloodborne Pathogen Standard? (2) Do you follow CDC Guidelines for Infection Control in Dental Health-Care Settings? (3) Can you produce digital cleaning logs for a state board inspection? XIRI answers "yes" to all three — with nightly verification.`,
    sources: [SRC.CENSUS_CBP, SRC.OSHA_BBP, SRC.CDC_DENTAL],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does dental office cleaning cost in ${townName}?`,
    answer: `Dental cleaning falls in the healthcare premium range of $0.14–$0.35/sq ft for routine maintenance (ISSA benchmarks), potentially higher for operatory-level disinfection. Variables include number of operatories, procedure types (general vs. surgical), and whether you need amalgam waste coordination. Get a precise estimate with our free cost calculator, or schedule a complimentary walk-through.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI follow CDC dental infection control guidelines in ${townName}?`,
    answer: `Yes. Our contractors follow the CDC's Guidelines for Infection Control in Dental Health-Care Settings, including surface barrier usage, EPA-registered intermediate-level disinfection on clinical contact surfaces, and proper operatory turnover protocols. We also handle sharps container management and maintain digital compliance logs accessible for state dental board inspections.`,
    sources: [SRC.CDC_DENTAL, SRC.OSHA_BBP],
  }),
};

// ──────────────────────────────────────────────
// DIALYSIS CENTERS
// ──────────────────────────────────────────────
const dialysisFaqs: ServiceFaqIntelligence = {
  slugs: ['dialysis-centers'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `What makes dialysis center cleaning different from standard medical cleaning in ${townName}?`,
    answer: `Dialysis centers handle blood products at a scale that exceeds most medical offices — every station is a potential bloodborne pathogen exposure point. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we invest in cleaners specifically trained in CMS Conditions for Coverage for ESRD facilities, OSHA's Bloodborne Pathogen Standard, and water treatment area sanitation protocols. This isn't about mops — it's about patient safety between treatments.`,
    sources: [SRC.BLS_OES, SRC.CMS_ESRD, SRC.OSHA_BBP],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How should I choose a cleaning company for my dialysis center in ${region}?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), almost none specialize in dialysis-specific protocols. Critical differentiators: Can they demonstrate CMS Conditions for Coverage awareness? Do they follow CDC dialysis infection prevention guidelines? Can they handle station turnover cleaning between patient sessions? XIRI verifies all three, nightly, with documented audits.`,
    sources: [SRC.CENSUS_CBP, SRC.CMS_ESRD, SRC.CDC_DIALYSIS],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `How is dialysis center cleaning priced in ${townName}?`,
    answer: `Dialysis cleaning is priced at the upper end of healthcare cleaning — $0.20–$0.40+/sq ft — reflecting the intensive between-station turnover, bloodborne pathogen risk, and CMS compliance documentation requirements (ISSA industry benchmarks). Pricing scales with station count, hours of operation, and water treatment area complexity. Request a free site audit for a precise custom quote.`,
    sources: [SRC.ISSA_CIMS, SRC.CMS_ESRD],
  }),
  complianceFaq: (townName) => ({
    question: `Are your cleaners trained in CMS dialysis facility requirements for ${townName}?`,
    answer: `Yes. Contractors deployed to dialysis facilities are trained in CMS Conditions for Coverage for ESRD facilities, OSHA Bloodborne Pathogen Standard (29 CFR 1910.1030), and CDC guidelines for dialysis infection prevention. We maintain digital logs of station-by-station cleaning with timestamps, chemical usage, and Night Manager verification — ready for unannounced CMS surveys.`,
    sources: [SRC.CMS_ESRD, SRC.OSHA_BBP, SRC.CDC_DIALYSIS],
  }),
};

// ──────────────────────────────────────────────
// VETERINARY CLINICS
// ──────────────────────────────────────────────
const vetFaqs: ServiceFaqIntelligence = {
  slugs: ['veterinary-clinics'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why do veterinary clinics need specialized cleaning in ${townName}?`,
    answer: `Veterinary facilities deal with zoonotic pathogens (diseases transferable between animals and humans), kennel areas with persistent biological contamination, and surgical suites requiring disinfection beyond standard commercial cleaning. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES, ${premiumPct}% above minimum), we pay for cleaners trained in veterinary-specific biohazard handling and EPA-registered disinfectants effective against parvovirus, ringworm, and kennel cough pathogens.`,
    sources: [SRC.BLS_OES, SRC.OSHA_BBP],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `Do any of the ${competitorCount.toLocaleString()} cleaning companies in ${region} understand veterinary cleaning?`,
    answer: `Very few. Most of the ${competitorCount.toLocaleString()} registered janitorial companies in ${region} (Census Bureau) have zero experience with zoonotic pathogen risks, kennel disinfection protocols, or veterinary surgical suite turnover. XIRI deploys contractors who understand the difference between bactericidal, virucidal, and fungicidal disinfectants — because a parvovirus-contaminated kennel requires a different approach than a dusty office carpet.`,
    sources: [SRC.CENSUS_CBP, SRC.OSHA_BBP],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does veterinary clinic cleaning cost in ${townName}?`,
    answer: `Veterinary cleaning falls in the healthcare-adjacent range ($0.15–$0.35/sq ft) with premiums for surgical areas, kennels, and isolation rooms. Variables include kennel count, whether you offer boarding/daycare, and surgery volume. Use our free calculator for a baseline estimate, then schedule a walk-through for a custom scope.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `How does XIRI handle biohazard waste at ${townName} veterinary clinics?`,
    answer: `Our contractors follow OSHA's Bloodborne Pathogen Standard adapted for veterinary environments, including proper sharps disposal, red-bag waste segregation, and kennel-specific disinfection using EPA-registered products effective against common veterinary pathogens. Every contractor carries $1M+ liability insurance and undergoes background verification before deployment.`,
    sources: [SRC.OSHA_BBP],
  }),
};

// ──────────────────────────────────────────────
// CHILDCARE: Daycare, Preschool
// ──────────────────────────────────────────────
const childcareFaqs: ServiceFaqIntelligence = {
  slugs: ['daycare-cleaning', 'daycare-preschool'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does XIRI ensure child-safe cleaning products in ${townName} daycares?`,
    answer: `Children are more vulnerable to chemical exposure than adults — conventional cleaning products can trigger asthma and allergic reactions (EPA IAQ Tools for Schools). At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we invest in cleaners trained in child-safe protocols. Every product we use carries EPA Safer Choice or Green Seal certification. We follow CDC childcare cleaning guidelines: sanitize after each diaper change, disinfect food-contact surfaces before and after meals, and use HEPA-filtered vacuums to trap allergens instead of recirculating them.`,
    sources: [SRC.EPA_IAQ_SCHOOLS, SRC.BLS_OES, SRC.EPA_SAFER_CHOICE, SRC.CDC_CHILDCARE],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `What should I look for when hiring a cleaner for my ${townName} daycare?`,
    answer: `Among ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), few understand childcare-specific requirements. Critical questions: (1) Do they exclusively use EPA Safer Choice or Green Seal certified products? (2) Are crews trained in CDC childcare cleaning protocols — including toy sanitization and diaper-station disinfection? (3) Do they schedule major cleaning when children are absent? XIRI meets all three standards, verified nightly by our Night Managers.`,
    sources: [SRC.CENSUS_CBP, SRC.EPA_SAFER_CHOICE, SRC.CDC_CHILDCARE],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `How much does ${serviceName.toLowerCase()} cost in ${townName}?`,
    answer: `Childcare facility cleaning typically runs $0.12–$0.28/sq ft (ISSA benchmarks), with variation based on classroom count, age groups served (infant rooms require more intensive sanitization), and whether you need toy/equipment sanitization included. Since children's health is at stake, we strongly recommend daily service — the most effective schedule for preventing illness outbreaks per CDC childcare guidelines. Get a free estimate with our cost calculator.`,
    sources: [SRC.ISSA_CIMS, SRC.CDC_CHILDCARE],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI meet state childcare licensing cleaning requirements in ${townName}?`,
    answer: `Yes. Beyond meeting New York State childcare licensing cleaning standards, we follow CDC guidelines for childcare facility cleaning: EPA-registered products used per label dwell times, child-exclusion zones during disinfection, hazardous chemical storage out of reach, and adequate ventilation during all cleaning activities. We maintain digital logs documenting every service for your licensing inspections.`,
    sources: [SRC.CDC_CHILDCARE, SRC.EPA_SAFER_CHOICE],
  }),
  bonusFaq: (townName) => ({
    question: `How does professional cleaning help prevent illness outbreaks in ${townName} daycares?`,
    answer: `The CDC identifies proper cleaning as a frontline defense against illness outbreaks in childcare settings. Children under 5 are especially susceptible to gastrointestinal and respiratory infections spread through contaminated surfaces. Our evidence-based protocol covers the CDC's priority areas: high-touch surfaces cleaned daily, diaper stations disinfected after each use, food-contact surfaces sanitized before and after meals, and soft items laundered in hot water. This systematic approach reduces the surface-to-hand-to-mouth transmission chain that drives childcare outbreaks.`,
    sources: [SRC.CDC_CHILDCARE],
  }),
};

// ──────────────────────────────────────────────
// EDUCATION: Private Schools
// ──────────────────────────────────────────────
const schoolFaqs: ServiceFaqIntelligence = {
  slugs: ['private-schools'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why should ${townName} private schools invest in professional cleaning?`,
    answer: `Conventional cleaning chemicals are a leading indoor asthma trigger in schools (EPA IAQ Tools for Schools). With $${medianWage.toFixed(2)}/hr median janitorial wages in ${areaTitle} (BLS OES), we invest in cleaners trained in EPA's green cleaning guidelines for education facilities. Every product carries EPA Safer Choice or Green Seal certification. We use HEPA-filtered vacuums to trap allergens, microfiber tools that capture particles without chemical overuse, and schedule intensive cleaning when students are absent to minimize exposure.`,
    sources: [SRC.EPA_IAQ_SCHOOLS, SRC.BLS_OES, SRC.EPA_SAFER_CHOICE],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I choose the right cleaning company for a ${townName} private school?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), most use conventional chemicals not designed for child-occupied spaces. Key differentiators: EPA Safer Choice certified products, HEPA-filtered vacuums (not standard vacuums that recirculate allergens), crew background checks appropriate for education settings, and a written green cleaning policy. XIRI provides all four — documented nightly through our audit system.`,
    sources: [SRC.CENSUS_CBP, SRC.EPA_SAFER_CHOICE, SRC.EPA_IAQ_SCHOOLS],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does professional cleaning cost for ${townName} private schools?`,
    answer: `Education facility cleaning typically ranges from $0.08–$0.22/sq ft depending on classroom count, gymnasium and cafeteria requirements, and restroom density (ISSA benchmarks). Schools with laboratories, art studios, or athletic facilities may require specialized scope additions. Our free site audit accounts for your school's unique layout and academic calendar to deliver precise pricing.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI use child-safe, allergen-reducing cleaning products in ${townName} schools?`,
    answer: `Absolutely. All products used in education facilities carry EPA Safer Choice or Green Seal certification — free of fragrances, ammonia, and harsh chemicals that trigger childhood asthma (CDPH Healthy Cleaning & Asthma-Safer Schools guidelines). We use microfiber tools, HEPA-filtered vacuums, and maintain a fragrance-free product standard across every school we serve.`,
    sources: [SRC.EPA_SAFER_CHOICE, SRC.EPA_IAQ_SCHOOLS],
  }),
};

// ──────────────────────────────────────────────
// FITNESS: Gyms, Fitness Centers
// ──────────────────────────────────────────────
const fitnessFaqs: ServiceFaqIntelligence = {
  slugs: ['fitness-gyms'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does XIRI prevent MRSA and staph in ${townName} fitness facilities?`,
    answer: `Gym environments are breeding grounds for MRSA, staph, and fungal infections — the CDC identifies shared athletic equipment and locker rooms as high-risk transmission zones. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we retain cleaners trained in fitness facility-specific disinfection: EPA-registered products effective against MRSA/staph on equipment surfaces, dedicated mop heads per zone to prevent cross-contamination, and moisture control protocols for locker rooms and showers to inhibit bacterial and fungal growth.`,
    sources: [SRC.CDC_MRSA, SRC.BLS_OES, SRC.EPA_LIST_N],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `What should ${townName} gym owners look for in a cleaning company?`,
    answer: `Among ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), most treat gyms like offices. But fitness facilities need: (1) EPA-registered disinfectants effective against MRSA and staph on equipment surfaces, (2) locker room moisture management to prevent fungal growth, (3) dedicated equipment cleaning tools that prevent cross-contamination between zones. XIRI deploys gym-experienced crews who understand that a sparkling mirror doesn't matter if the bench press pad is growing staph.`,
    sources: [SRC.CENSUS_CBP, SRC.CDC_MRSA, SRC.EPA_LIST_N],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does gym cleaning cost in ${townName}?`,
    answer: `Fitness facility cleaning typically ranges from $0.10–$0.25/sq ft, scaling with equipment density, locker room size, pool areas, and hours of operation (ISSA benchmarks). High-traffic gyms often benefit from split-service models: day porter for equipment wipe-downs and member-facing areas, overnight crew for deep disinfection. Get a tailored estimate with our free cost calculator.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `How does XIRI handle locker room and shower cleaning at ${townName} gyms?`,
    answer: `Locker rooms are the highest-risk zone in any fitness facility for bacterial and fungal transmission (CDC community infection prevention guidelines). Our protocol includes: EPA-registered disinfectants on all shower surfaces, bench sanitization between peak periods, biofilm prevention in drains, moisture management through ventilation verification, and dedicated cleaning tools that never cross into the main gym floor. All crews carry $1M+ liability insurance and pass background checks.`,
    sources: [SRC.CDC_MRSA],
  }),
};

// ──────────────────────────────────────────────
// RETAIL: Storefronts
// ──────────────────────────────────────────────
const retailFaqs: ServiceFaqIntelligence = {
  slugs: ['retail-storefronts'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does store cleanliness affect sales in ${townName} retail locations?`,
    answer: `Research consistently shows that 92% of consumers say a clean environment is the most important factor in their purchase decision, and 66–69% of shoppers have left a store due to poor appearance (Tennant Company / ISSA industry surveys). At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we invest in cleaners who understand that retail cleaning drives revenue — not just aesthetics. First-impression zones (entrance, restrooms, checkout) receive priority treatment because customers form subconscious judgments within the first 10 feet.`,
    sources: [SRC.ISSA_CIMS, SRC.BLS_OES],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `What makes XIRI different from other retail cleaners in ${region}?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), most clean retail spaces the same way they clean offices. But retail cleanliness directly impacts conversion: 80% of shoppers rank basic cleanliness above interactive technology in influencing their experience, and 95% say cleanliness elevates a "good" business to "great" (industry surveys). XIRI trains retail crews on first-impression zone prioritization, high-touch surface frequency matching foot traffic, and visual merchandising-compatible cleaning schedules that protect displays.`,
    sources: [SRC.CENSUS_CBP, SRC.ISSA_CIMS],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does retail store cleaning cost in ${townName}?`,
    answer: `Retail cleaning typically ranges from $0.07–$0.18/sq ft for standard maintenance (ISSA benchmarks), varying by store layout, foot traffic volume, and specialty areas (fitting rooms, food service, restrooms). Many retailers see the strongest ROI from day porter services during operating hours — maintaining first-impression zones in real time rather than relying solely on overnight cleaning. Get a free estimate with our cost calculator.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI clean during store hours to maintain customer experience in ${townName}?`,
    answer: `Yes. Our day porter services handle real-time maintenance during business hours — restroom checks, entrance cleanliness, spill response, and fitting room turnover. Deep cleaning happens after close. This dual-service model keeps your store at "just opened" condition throughout the day, which research shows directly increases customer dwell time and conversion rates.`,
    sources: [SRC.ISSA_CIMS],
  }),
};

// ──────────────────────────────────────────────
// AUTO DEALERSHIPS
// ──────────────────────────────────────────────
const autoDealerFaqs: ServiceFaqIntelligence = {
  slugs: ['auto-dealerships'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does showroom cleanliness affect CSI scores at ${townName} dealerships?`,
    answer: `Manufacturer CSI (Customer Satisfaction Index) scores directly impact your allocation, incentives, and franchise standing. A spotless showroom triggers the "halo effect" — customers subconsciously attribute higher quality and professionalism to the entire dealership. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we retain cleaners experienced in dealership environments: high-gloss floor care that makes inventory pop, service bay degreasing that prevents slip hazards, and customer lounge maintenance that supports the buying experience.`,
    sources: [SRC.BLS_OES, SRC.LIBERTY_MUTUAL],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `What should ${townName} dealerships look for in a cleaning company?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), few understand the dealership environment — showroom, service bay, parts department, and customer lounge each require different cleaning approaches. Key differentiators: Can they handle industrial service bay degreasing AND delicate showroom glass? Do they work overnight to ensure a pristine opening? XIRI provides purpose-trained crews who understand that a clean dealership sells more cars.`,
    sources: [SRC.CENSUS_CBP],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does dealership cleaning cost in ${townName}?`,
    answer: `Dealership cleaning is complex due to mixed-use spaces — pricing typically ranges from $0.08–$0.20/sq ft for showroom and office areas, with premiums for service bay degreasing, parts department cleaning, and lot maintenance (ISSA benchmarks). Most dealerships benefit from overnight service so you open to a pristine showroom. Get a free custom estimate with our cost calculator.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Can XIRI clean around dealership operating hours in ${townName}?`,
    answer: `Absolutely. We typically work overnight after your sales floor closes — ensuring you open to a spotless showroom every morning. For service departments and customer lounges, we offer split scheduling that works around your service hours. Your dedicated FSM coordinates directly with your GM to build a schedule that never interrupts a deal. All crews are insured ($1M+), bonded, and background-checked.`,
    sources: [],
  }),
};

// ──────────────────────────────────────────────
// FLOOR CARE
// ──────────────────────────────────────────────
const floorCareFaqs: ServiceFaqIntelligence = {
  slugs: ['floor-care', 'carpet-upholstery'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why is professional floor care a safety investment, not just cosmetic in ${townName}?`,
    answer: `Falls on the same level cost U.S. employers nearly $10 billion annually in medical expenses and lost wages (Liberty Mutual Workplace Safety Index, 2024). Slips and trips account for over 25% of all nonfatal workplace injuries (BLS). At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we invest in floor technicians who understand that professional maintenance is your first line of defense against liability. Improperly maintained floors — or poorly applied floor finish — can actually increase slip risk, which is why we only deploy ISSA-trained technicians.`,
    sources: [SRC.LIBERTY_MUTUAL, SRC.BLS_INJURIES, SRC.BLS_OES, SRC.ISSA_CIMS],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I find reliable floor care specialists in ${region}?`,
    answer: `Among ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), many offer floor care as an add-on rather than a specialty. Key questions to ask: Do they follow ISSA production rate standards for floor maintenance? Do they use equipment matched to your flooring type? Can they prove their floor finishes meet slip-resistance standards? XIRI deploys dedicated floor care technicians — not general cleaners with a buffer — because floor maintenance directly impacts both aesthetics and slip-and-fall liability.`,
    sources: [SRC.CENSUS_CBP, SRC.ISSA_CT, SRC.LIBERTY_MUTUAL],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does professional ${serviceName.toLowerCase()} cost in ${townName}?`,
    answer: `Floor care pricing varies significantly by flooring type and service scope — standard VCT strip-and-wax runs $0.25–$0.60/sq ft, while hardwood refinishing or specialty stone care can reach $1.50+/sq ft (ISSA benchmarks). Variables include current floor condition, coating type, and whether you need one-time restoration versus a recurring maintenance program. The ROI is clear: professional maintenance extends flooring lifespan by 3–5x versus neglect. Get a free floor assessment with our site audit.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI's floor care reduce slip-and-fall liability in ${townName} facilities?`,
    answer: `Yes. Slip-and-fall claims average over $50,000 in legal defense costs alone, with total same-level fall costs reaching $10B annually (Liberty Mutual, 2024). Our floor maintenance program follows ISSA standards for slip-resistant finishes, identifies and addresses "hotspot" zones (entrances, restrooms, break rooms), and maintains documentation of every floor service — providing a defensible maintenance record that protects your facility in the event of a claim.`,
    sources: [SRC.LIBERTY_MUTUAL, SRC.ISSA_CIMS],
  }),
};

// ──────────────────────────────────────────────
// GENERAL COMMERCIAL: Janitorial, Commercial Cleaning, Day Porter
// ──────────────────────────────────────────────
const commercialFaqs: ServiceFaqIntelligence = {
  slugs: [
    'commercial-cleaning',
    'janitorial-services',
    'day-porter',
    'professional-offices',
  ],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does XIRI prevent the "revolving door" of cleaning crews in ${townName}?`,
    answer: `The commercial cleaning industry averages 150–200% annual turnover (ISSA industry reports). At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES) — ${premiumPct}% above New York's $${minWage.toFixed(2)}/hr minimum — companies that bid at minimum wage face constant crew replacement. Every new cleaner learns on your floors. XIRI builds contracts around market-rate labor costs, which means experienced cleaners who know your building's layout, security protocols, and expectations from day one.`,
    sources: [SRC.ISSA_CIMS, SRC.BLS_OES],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `With ${competitorCount.toLocaleString()} cleaning companies in ${region}, how do I avoid getting burned?`,
    answer: `There are ${competitorCount.toLocaleString()} registered janitorial companies in ${region} (U.S. Census Bureau, County Business Patterns). Most compete on price alone — and you get what you pay for. Red flags: no Night Manager audits, no insurance certificates on file, and the same "we care about quality" pitch with zero accountability. XIRI differentiates by publishing transparent market data, assigning a dedicated Facility Services Manager, and verifying every clean nightly — not waiting for your complaint to find out something was missed.`,
    sources: [SRC.CENSUS_CBP],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `How much does ${serviceName.toLowerCase()} cost in ${townName}?`,
    answer: `Standard commercial cleaning ranges from $0.05–$0.15/sq ft for routine maintenance, scaling with facility complexity, tenant requirements, and service frequency (ISSA Cleaning Times & Tasks benchmarks). Pricing should always be based on actual cleanable square footage — not total building footprint — and adjusted for fixture density, floor types, and scope. Use our free calculator for an instant estimate, or request a complimentary site audit with a custom quote in 48 hours. No long-term contracts required.`,
    sources: [SRC.ISSA_CT],
  }),
  complianceFaq: (townName) => ({
    question: `Are XIRI's commercial cleaning crews insured and vetted in ${townName}?`,
    answer: `Every contractor in our network carries $1M+ in general liability insurance and is fully bonded. We run comprehensive background checks and verify OSHA compliance, proper waste disposal certifications, and facility-specific requirements before deployment. Unlike companies that "set it and forget it," our Night Managers physically verify work quality nightly with photographic documentation.`,
    sources: [SRC.OSHA_BBP],
  }),
  bonusFaq: (townName) => ({
    question: `What's the true cost of cheap cleaning for a ${townName} commercial property?`,
    answer: `Beyond visible dirt, underinvestment in cleaning has measurable costs: the ISSA estimates that poor indoor air quality from inadequate cleaning reduces worker productivity by 2–4%. Every crew turnover event (150–200% annual rate in the industry) costs thousands in recruitment, training, and the quality dip while new staff learn your building. And deferred floor maintenance can cut flooring lifespan by 60–80%. Market-rate cleaning isn't an expense — it's a facility investment with documented ROI.`,
    sources: [SRC.ISSA_CIMS, SRC.LIBERTY_MUTUAL],
  }),
};

// ──────────────────────────────────────────────
// DISINFECTING SERVICES
// ──────────────────────────────────────────────
const disinfectingFaqs: ServiceFaqIntelligence = {
  slugs: ['disinfecting-services'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `What separates professional disinfection from regular cleaning in ${townName}?`,
    answer: `Cleaning removes visible dirt; disinfecting kills pathogens — and the CDC is clear that you must clean first, then disinfect, in that order. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), our disinfection crews are trained in EPA-registered product selection, proper dwell time verification (the surface must remain wet for the labeled duration to actually kill germs), and high-touch surface prioritization. "Spraying and wiping" without dwell-time compliance is theater, not disinfection.`,
    sources: [SRC.CDC_ENV_INFECTION, SRC.BLS_OES, SRC.EPA_LIST_N],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I verify a ${region} disinfecting company actually kills pathogens?`,
    answer: `Among ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), many claim "hospital-grade disinfection" without verifying dwell times or using EPA-registered products. Key questions: (1) Is the product on EPA's List N for your target pathogen? (2) How do they verify the surface remained wet for the required dwell time? (3) Can they provide ATP testing to prove surface contamination reduction? XIRI answers all three with documented nightly verification.`,
    sources: [SRC.CENSUS_CBP, SRC.EPA_LIST_N],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does professional disinfecting service cost in ${townName}?`,
    answer: `Disinfecting services typically run $0.10–$0.35/sq ft depending on the method (manual wipe-down, electrostatic spraying, or fogging), facility type, and target pathogen level (ISSA benchmarks). Facilities with higher infection risk (healthcare, daycare, fitness) require more intensive protocols. Use our free calculator for a baseline, or request a site assessment to determine the right disinfection scope for your facility.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI use EPA-registered disinfectants in ${townName}?`,
    answer: `Yes — exclusively. Every disinfectant in our protocol is EPA-registered, with specific efficacy claims against target pathogens verified against EPA's List N. Our crews are trained to apply products at label-specified dwell times and concentrations — the two factors that determine whether disinfection actually works. We maintain product SDS sheets and application logs in your facility's digital compliance file.`,
    sources: [SRC.EPA_LIST_N],
  }),
};

// ──────────────────────────────────────────────
// SPECIALTY: Window Cleaning
// ──────────────────────────────────────────────
const windowCleaningFaqs: ServiceFaqIntelligence = {
  slugs: ['window-cleaning'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why does commercial window cleaning require professionals in ${townName}?`,
    answer: `Clean windows directly impact tenant satisfaction and building value — research shows first impressions form within seconds, and exterior appearance is the first thing visitors and clients notice. At $${medianWage.toFixed(2)}/hr median wage in ${areaTitle} (BLS OES), we deploy trained window technicians equipped with proper water-fed pole systems, squeegee techniques, and OSHA fall protection for elevated work. Amateur window cleaning risks streaking, seal damage, and — for anything above ground level — serious safety liability.`,
    sources: [SRC.BLS_OES, SRC.OSHA_HOUSEKEEPING],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I choose a reliable window cleaning company in ${region}?`,
    answer: `Among ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), window cleaning is often treated as an afterthought. Key differentiators: proper OSHA fall protection compliance for elevated work, water-fed pole systems or lift access for multi-story buildings, and insurance that specifically covers window cleaning operations. XIRI's window crews carry $1M+ liability with a window-specific endorsement.`,
    sources: [SRC.CENSUS_CBP, SRC.OSHA_HOUSEKEEPING],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does commercial window cleaning cost in ${townName}?`,
    answer: `Window cleaning pricing varies by pane count, story height, and accessibility — interior/exterior packages typically run $2–$7 per pane for standard windows, with premiums for multi-story, hard-to-access, or floor-to-ceiling glass. Most commercial properties see optimal ROI on quarterly schedules, with monthly service for high-visibility storefronts. Get a free pane-count estimate with our site audit.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Are XIRI's window cleaners OSHA compliant for elevated work in ${townName}?`,
    answer: `Yes. All window cleaning technicians deployed to multi-story projects comply with OSHA fall protection standards (29 CFR 1926 Subpart M), carry appropriate certifications for lift and scaffold operation, and are covered under our $1M+ liability insurance with specific window cleaning endorsements. Safety documentation is available on request.`,
    sources: [SRC.OSHA_HOUSEKEEPING],
  }),
};

// ──────────────────────────────────────────────
// SPECIALTY: Pressure Washing
// ──────────────────────────────────────────────
const pressureWashingFaqs: ServiceFaqIntelligence = {
  slugs: ['pressure-washing'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `Why does professional pressure washing matter for ${townName} properties?`,
    answer: `Building exteriors, walkways, and parking structures accumulate biological contaminants (mold, algae, mildew) that create slip hazards and accelerate surface degradation. Falls on the same level cost employers nearly $10 billion annually (Liberty Mutual, 2024). At $${medianWage.toFixed(2)}/hr median wage in ${areaTitle} (BLS OES), we deploy pressure washing technicians trained in surface-appropriate PSI settings, EPA-compliant wastewater management, and slip-hazard prevention — because incorrect pressure can damage facades, strip sealants, or create worse slip conditions.`,
    sources: [SRC.LIBERTY_MUTUAL, SRC.BLS_OES],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `What should I look for in a ${region} pressure washing company?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), many offer pressure washing without understanding surface-specific PSI requirements or EPA wastewater guidelines. Ask: Do they adjust pressure for concrete vs. pavers vs. stucco? Do they contain and dispose of wastewater per local regulations? Can they provide before/after documentation? XIRI addresses all three with trained technicians and photographic service verification.`,
    sources: [SRC.CENSUS_CBP],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does commercial pressure washing cost in ${townName}?`,
    answer: `Pricing depends on surface area, material type, and contamination level — sidewalks and driveways typically run $0.08–$0.35/sq ft, building facades $0.15–$0.50/sq ft (industry benchmarks). Most commercial properties benefit from quarterly or semi-annual scheduling to prevent buildup that accelerates surface damage. Get a free estimate tailored to your property.`,
    sources: [SRC.ISSA_CIMS],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI follow EPA wastewater guidelines for pressure washing in ${townName}?`,
    answer: `Yes. Our technicians follow EPA and local municipality guidelines for wastewater containment and disposal during pressure washing operations. We use appropriate recovery systems for regulated surfaces and ensure all runoff management meets local stormwater regulations. All crews carry $1M+ liability insurance and maintain compliance documentation.`,
    sources: [],
  }),
};

// ──────────────────────────────────────────────
// LABS & CLEANROOMS
// ──────────────────────────────────────────────
const labFaqs: ServiceFaqIntelligence = {
  slugs: ['labs-cleanrooms', 'converted-clinical-suites'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `What makes lab and cleanroom cleaning different in ${townName}?`,
    answer: `Cleanroom and laboratory environments have contamination thresholds measured in particles per cubic meter — a single untrained cleaner can compromise an entire production run or research cycle. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we invest in technicians trained in ISO 14644 cleanroom standards, proper gowning procedures, and cleanroom-compatible cleaning agents. The cost of cutting corners in a cleanroom isn't a dirty floor — it's contaminated samples, failed batches, and regulatory citations.`,
    sources: [SRC.BLS_OES, SRC.ISO_14644],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How should I evaluate cleaning vendors for my ${townName} lab or cleanroom?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), very few have cleanroom experience. Non-negotiable questions: (1) Are crews trained in ISO 14644 cleanroom protocols? (2) Do they use cleanroom-compatible, residue-free cleaning agents? (3) Can they gown properly and understand particle count standards? (4) Do they log every entry and service for your compliance records? XIRI verifies all four.`,
    sources: [SRC.CENSUS_CBP, SRC.ISO_14644],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does lab/cleanroom cleaning cost in ${townName}?`,
    answer: `Cleanroom cleaning commands significant premiums — typically $0.50–$3.00+/sq ft depending on ISO classification level, gowning requirements, and restricted-access protocols. Standard lab cleaning runs $0.20–$0.50/sq ft (ISSA benchmarks). The cost reflects the specialized training, cleanroom-compatible consumables, and controlled-environment protocols required. Contact us for a free scope assessment.`,
    sources: [SRC.ISSA_CIMS, SRC.ISO_14644],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI maintain ISO cleanroom compliance documentation in ${townName}?`,
    answer: `Yes. We maintain detailed digital logs of every cleanroom service including: entry/exit timestamps, gowning verification, cleaning agent usage, and post-clean particle count documentation. These records integrate with your facility's ISO 14644 compliance file and are available on demand for audits. All cleanroom technicians carry $1M+ liability insurance with laboratory endorsement.`,
    sources: [SRC.ISO_14644],
  }),
};

// ──────────────────────────────────────────────
// LIGHT MANUFACTURING
// ──────────────────────────────────────────────
const manufacturingFaqs: ServiceFaqIntelligence = {
  slugs: ['light-manufacturing'],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does professional cleaning improve safety in ${townName} manufacturing facilities?`,
    answer: `OSHA reports that slips, trips, and falls account for over 25% of nonfatal workplace injuries. In manufacturing, add machine oil, metal shavings, and production dust to the equation. At $${medianWage.toFixed(2)}/hr median janitorial wage in ${areaTitle} (BLS OES), we deploy industrial cleaning crews trained in manufacturing-specific hazards: oil/grease removal from production floors, metal particulate containment, and OSHA-compliant housekeeping standards that reduce your workers' comp exposure. Every shift is a safety investment.`,
    sources: [SRC.OSHA_HOUSEKEEPING, SRC.BLS_OES, SRC.BLS_INJURIES],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I find a cleaning company for my ${townName} manufacturing facility?`,
    answer: `Of ${competitorCount.toLocaleString()} janitorial companies in ${region} (Census Bureau), few can handle industrial environments. Your vendor must understand: OSHA housekeeping standards for manufacturing floors, proper handling of machine coolant residue, production dust containment vs. recirculation, and scheduling around production shifts. XIRI deploys industry-experienced crews and verifies compliance nightly.`,
    sources: [SRC.CENSUS_CBP, SRC.OSHA_HOUSEKEEPING],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `What does manufacturing facility cleaning cost in ${townName}?`,
    answer: `Light manufacturing cleaning typically ranges from $0.06–$0.15/sq ft for office and common areas, with production floor cleaning running $0.10–$0.30/sq ft depending on contamination type and OSHA requirements (ISSA benchmarks). Variables include production schedule, waste type, and whether cleanroom-adjacent zones exist. Get a free industrial site assessment for precise pricing.`,
    sources: [SRC.ISSA_CIMS, SRC.OSHA_HOUSEKEEPING],
  }),
  complianceFaq: (townName) => ({
    question: `Does XIRI meet OSHA housekeeping standards for ${townName} manufacturing facilities?`,
    answer: `Yes. Our manufacturing cleaning protocols follow OSHA's General Duty Clause and specific housekeeping standards (29 CFR 1910.22) for walking-working surfaces. We address common OSHA citations: uncontained spills, obstructed emergency exits, accumulated combustible dust, and improper waste storage. All crews carry $1M+ liability insurance and maintain digital service records for your safety compliance files.`,
    sources: [SRC.OSHA_HOUSEKEEPING],
  }),
};

// ──────────────────────────────────────────────
// EXTERIOR / FACILITY SERVICES CATCHALL
// ──────────────────────────────────────────────
const facilityServicesFaqs: ServiceFaqIntelligence = {
  slugs: [
    'snow-ice-removal',
    'hvac-maintenance',
    'pest-control',
    'waste-management',
    'parking-lot-maintenance',
    'handyman-services',
    'post-construction-cleanup',
    'preventive-maintenance',
    'indoor-plant-watering',
  ],
  qualityFaq: (townName, medianWage, premiumPct, areaTitle, minWage) => ({
    question: `How does XIRI ensure reliable facility services in ${townName}?`,
    answer: `Facility maintenance directly impacts tenant satisfaction, safety compliance, and property value. At $${medianWage.toFixed(2)}/hr median service worker wage in ${areaTitle} (BLS OES), cutting corners means hiring unreliable crews who treat your property as an afterthought. XIRI assigns a dedicated Facility Services Manager who coordinates every service, verifies completion nightly, and provides photographic documentation — so you never have to wonder if the work was done right.`,
    sources: [SRC.BLS_OES],
  }),
  competitorFaq: (townName, region, competitorCount) => ({
    question: `How do I find dependable facility service providers in ${region}?`,
    answer: `Among ${competitorCount.toLocaleString()} service companies in ${region} (Census Bureau), most specialize in one trade and leave you coordinating multiple vendors. XIRI consolidates facility services under one invoice, one FSM, and one accountability system. Every contractor in our network carries $1M+ liability insurance, passes background checks, and is verified through our nightly audit process.`,
    sources: [SRC.CENSUS_CBP],
  }),
  pricingFaq: (townName, serviceName) => ({
    question: `How much does ${serviceName.toLowerCase()} cost in ${townName}?`,
    answer: `Facility service pricing varies widely by scope, frequency, and property size. Rather than quoting generic ranges, we recommend a free site assessment — our FSM walks your property and delivers a custom proposal within 48 hours covering exact scope, scheduling, and pricing. One invoice, one point of contact, no long-term contracts required.`,
    sources: [],
  }),
  complianceFaq: (townName) => ({
    question: `Are XIRI's facility service contractors insured and background-checked in ${townName}?`,
    answer: `Yes. Every contractor carries $1M+ in general liability insurance, is fully bonded, and passes comprehensive background checks before accessing your property. We verify OSHA compliance, maintain digital service logs, and provide your building management with a single compliance file covering all services — eliminating the paperwork burden of managing multiple vendors.`,
    sources: [SRC.OSHA_BBP],
  }),
};

// ──────────────────────────────────────────────
// MASTER INDEX: slug → intelligence profile
// ──────────────────────────────────────────────
const allProfiles: ServiceFaqIntelligence[] = [
  healthcareFaqs,
  dentalFaqs,
  dialysisFaqs,
  vetFaqs,
  childcareFaqs,
  schoolFaqs,
  fitnessFaqs,
  retailFaqs,
  autoDealerFaqs,
  floorCareFaqs,
  commercialFaqs,
  disinfectingFaqs,
  windowCleaningFaqs,
  pressureWashingFaqs,
  labFaqs,
  manufacturingFaqs,
  facilityServicesFaqs,
];

const slugToProfile = new Map<string, ServiceFaqIntelligence>();
for (const profile of allProfiles) {
  for (const s of profile.slugs) {
    slugToProfile.set(s, profile);
  }
}

/**
 * Resolve the FAQ intelligence profile for a given service slug.
 * Falls back to the generic commercial profile if no specific match.
 */
export function getServiceFaqProfile(serviceSlug: string): ServiceFaqIntelligence {
  return slugToProfile.get(serviceSlug) ?? commercialFaqs;
}

/**
 * Also match industry slugs (industry pages use different slugs
 * but map to the same intelligence when generating FAQs).
 */
const industrySlugMap: Record<string, string> = {
  'medical-offices': 'medical-office-cleaning',
  'urgent-care': 'urgent-care-cleaning',
  'surgery-centers': 'surgery-center-cleaning',
  'dental-offices': 'dental-offices',
  'dialysis-centers': 'dialysis-centers',
  'veterinary-clinics': 'veterinary-clinics',
  'daycare-preschool': 'daycare-cleaning',
  'fitness-gyms': 'fitness-gyms',
  'retail-storefronts': 'retail-storefronts',
  'auto-dealerships': 'auto-dealerships',
  'labs-cleanrooms': 'labs-cleanrooms',
  'light-manufacturing': 'light-manufacturing',
  'converted-clinical-suites': 'converted-clinical-suites',
  'professional-offices': 'professional-offices',
  'private-schools': 'private-schools',
};

export function getIndustryFaqProfile(industrySlug: string): ServiceFaqIntelligence {
  const mappedSlug = industrySlugMap[industrySlug] ?? industrySlug;
  return slugToProfile.get(mappedSlug) ?? commercialFaqs;
}
