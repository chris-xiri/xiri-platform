// DLP Solutions Data — Sales Pillar Pages (Batch A)
// These are "deep-deep spoke" pages: hidden from nav, linked via sidebar + directory only.

export interface DLPSolution {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    sidebarCategory: string;
    complianceChecklist: { item: string; standard: string }[];
    sections: { title: string; content: string }[];
    faqs: { question: string; answer: string }[];
    relevantServices: string[];
}

export interface SpokeHub {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    dlpSlugs: string[];
    sidebarCategory: string;
}

// ── SPOKE HUBS (3) ──
export const SPOKE_HUBS: Record<string, SpokeHub> = {
    'healthcare-labs': {
        title: 'Healthcare & Labs',
        heroTitle: 'Specialized Cleaning for Healthcare & Laboratory Environments',
        heroSubtitle: 'JCAHO-compliant disinfection, cleanroom protocols, and biosafety-grade decontamination — managed by XIRI.',
        metaDescription: 'Specialized facility cleaning for medical offices, surgery centers, dental suites, cleanrooms, and laboratories. JCAHO and ISO compliant.',
        dlpSlugs: [
            'jcaho-survey-ready-disinfection', 'terminal-cleaning-surgery-centers',
            'dental-suite-sanitization', 'npi-verified-facility-governance', 'converted-clinical-suites',
            'iso-7-8-cleanroom-protocol', 'cgmp-lab-decontamination', 'bsl-2-lab-waste-management',
        ],
        sidebarCategory: 'medical',
    },
    'industrial-manufacturing': {
        title: 'Industrial & Manufacturing',
        heroTitle: 'Industrial-Grade Cleaning for Manufacturing & Service Facilities',
        heroSubtitle: 'Slip-coefficient logging, ESD-safe floor care, and zinc-whisker remediation — documented and verified.',
        metaDescription: 'Industrial facility cleaning for auto shops, data centers, and light manufacturing. NYS Part 226 compliance, FOD prevention, and ESD-safe protocols.',
        dlpSlugs: [
            'auto-shop-slip-coefficient-logging', 'data-center-zinc-whisker-remediation', 'esd-safe-floor-care',
        ],
        sidebarCategory: 'industrial',
    },
    'professional-suites': {
        title: 'Professional Suites',
        heroTitle: 'High-Security Cleaning for Professional & Financial Environments',
        heroSubtitle: 'Vault-grade sanitization, cash room protocols, and access-restricted cleaning — with full chain-of-custody documentation.',
        metaDescription: 'Specialized cleaning for bank vaults, cash rooms, and high-security professional suites. Bonded, insured, and access-controlled.',
        dlpSlugs: [
            'bank-vault-micro-climate-sanitization', 'high-security-cash-room-protocols',
        ],
        sidebarCategory: 'institutional',
    },
};

// ── DLP PAGES (12) ──
export const DLP_SOLUTIONS: Record<string, DLPSolution> = {
    // ─── MEDICAL (4) ───
    'jcaho-survey-ready-disinfection': {
        title: 'JCAHO Survey-Ready Disinfection',
        heroTitle: 'JCAHO Survey-Ready Disinfection for Medical Facilities',
        heroSubtitle: 'Continuous compliance — not last-minute scrambles. Your facility is clean-room ready every night, not just before a survey.',
        metaDescription: 'JCAHO survey-ready disinfection protocols for medical offices and clinics in Nassau County. Nightly audits, EPA-registered products, and compliance documentation.',
        sidebarCategory: 'medical',
        complianceChecklist: [
            { item: 'EPA-registered hospital-grade disinfectants with proper contact time', standard: 'JCAHO EC.02.06.01' },
            { item: 'High-touch surface disinfection log with timestamps', standard: 'JCAHO EC.02.02.01' },
            { item: 'Bloodborne pathogen exposure control plan', standard: 'OSHA 29 CFR 1910.1030' },
            { item: 'Chemical SDS sheets accessible to all staff', standard: 'OSHA HazCom' },
            { item: 'Terminal cleaning protocol for exam rooms', standard: 'CDC Guidelines' },
            { item: 'Restroom sanitation with ATP verification', standard: 'JCAHO IC.02.02.01' },
        ],
        sections: [
            { title: 'What "Survey-Ready" Actually Means', content: 'Most facilities panic-clean before a JCAHO survey. Survey-ready means your facility passes inspection any night of the year — because XIRI Night Managers audit every clean against the same checklist a surveyor uses. No surprises. No cramming.' },
            { title: 'Our Disinfection Protocol', content: 'We use EPA-registered, hospital-grade disinfectants (List N qualified) with verified contact times. Every surface is logged. Every room is documented. Your FSM maintains a rolling 12-month archive of cleaning logs, chemical records, and audit photos — accessible in minutes when a surveyor asks.' },
            { title: 'Beyond the Clean: Documentation That Protects You', content: 'JCAHO surveyors don\'t just look at surfaces — they audit your process. XIRI maintains digital cleaning logs with timestamps, chemical usage records with SDS sheets, and nightly audit photos. When EC.02.06.01 comes up, you hand them a tablet, not a filing cabinet.' },
        ],
        faqs: [
            { question: 'What JCAHO standards does XIRI\'s disinfection protocol address?', answer: 'Our protocol directly addresses EC.02.06.01 (environment maintenance), EC.02.02.01 (hazardous materials management), and IC.02.02.01 (infection prevention). We maintain documentation for all three.' },
            { question: 'How quickly can you produce cleaning logs for a surveyor?', answer: 'Within minutes. All logs are digital and searchable by date, room, and cleaning type. We keep a rolling 12-month archive that\'s always current.' },
            { question: 'Do you use EPA-registered disinfectants?', answer: 'Yes. All products are EPA List N registered with verified contact times. We track lot numbers and maintain current SDS sheets for every chemical used in your facility.' },
        ],
        relevantServices: ['medical-office-cleaning', 'disinfecting-services'],
    },
    'terminal-cleaning-surgery-centers': {
        title: 'Terminal Cleaning for Surgery Centers',
        heroTitle: 'Terminal Cleaning Protocols for Ambulatory Surgery Centers',
        heroSubtitle: 'Sterile-field turnover cleaning documented to AORN standards. Every OR, every night, verified by an independent auditor.',
        metaDescription: 'Terminal cleaning services for surgery centers and ASCs. AORN-aligned protocols, sterile field procedures, and nightly independent audits.',
        sidebarCategory: 'medical',
        complianceChecklist: [
            { item: 'Terminal clean between every surgical case', standard: 'AORN Guidelines' },
            { item: 'End-of-day deep terminal clean of all ORs', standard: 'AORN/CMS CoP' },
            { item: 'Ceiling-to-floor cleaning sequence documented', standard: 'APIC Guidelines' },
            { item: 'Anesthesia equipment wipe-down protocol', standard: 'ASA Guidelines' },
            { item: 'Surgical light and boom arm disinfection', standard: 'AORN Perioperative' },
        ],
        sections: [
            { title: 'What Terminal Cleaning Means for ASCs', content: 'Terminal cleaning is the complete, top-to-bottom decontamination of an operating room at the end of the surgical day. It\'s not just mopping — it\'s ceiling vents, surgical lights, boom arms, anesthesia equipment, walls, and floors, in that order. XIRI follows AORN perioperative guidelines to the letter.' },
            { title: 'Our OR Protocol', content: 'High-to-low, clean-to-dirty. We start with ceiling-mounted equipment and work down to the floor. Every surface is wiped with EPA-registered, sporicidal disinfectants. Waste is segregated by category. Logs are timestamped and photographed.' },
            { title: 'Independent Verification', content: 'The crew that cleans is never the crew that audits. XIRI Night Managers perform independent verification of every terminal clean using a standardized checklist. You get photographic proof before the first case the next morning.' },
        ],
        faqs: [
            { question: 'Do you follow AORN terminal cleaning guidelines?', answer: 'Yes. Our protocol is built directly from AORN perioperative standards, including the high-to-low sequence, proper dwell times, and documentation requirements.' },
            { question: 'Can you handle turnover cleaning between cases?', answer: 'Yes. We provide both between-case turnover cleaning and end-of-day terminal cleaning, each with separate protocols and documentation.' },
            { question: 'What disinfectants do you use in ORs?', answer: 'We use EPA-registered sporicidal disinfectants appropriate for surgical environments. Product selection is matched to your facility\'s infection control plan.' },
        ],
        relevantServices: ['surgery-center-cleaning', 'disinfecting-services'],
    },
    'dental-suite-sanitization': {
        title: 'Dental Suite Sanitization',
        heroTitle: 'Dental Suite Sanitization & Sterilization Support',
        heroSubtitle: 'CDC dental infection control guidelines built into every clean. Operatory turnover, sterilization area maintenance, and waterline compliance.',
        metaDescription: 'Dental office sanitization aligned with CDC dental infection control guidelines. Operatory cleaning, sterilization area support, and dental unit waterline compliance.',
        sidebarCategory: 'medical',
        complianceChecklist: [
            { item: 'Operatory surface disinfection between patients', standard: 'CDC DHCP Guidelines' },
            { item: 'Sterilization area cleaning and organization', standard: 'CDC/OSAP' },
            { item: 'Dental unit waterline flush protocol support', standard: 'CDC DUWL' },
            { item: 'Amalgam separator area maintenance', standard: 'EPA/ADA' },
            { item: 'Sharps container monitoring and replacement', standard: 'OSHA BBP Standard' },
        ],
        sections: [
            { title: 'Why Dental Suites Need Specialized Cleaning', content: 'Dental offices generate unique contamination challenges: aerosolized particles from high-speed handpieces, amalgam waste, waterline biofilm, and high-touch surfaces in operatories. Generic cleaning companies miss critical dental-specific protocols that CDC guidelines require.' },
            { title: 'Our Dental Protocol', content: 'XIRI cleaners are trained on CDC dental infection control procedures. We disinfect operatory surfaces with EPA-registered intermediate-level disinfectants, maintain sterilization area cleanliness, support waterline flushing protocols, and ensure amalgam separator areas meet EPA standards.' },
        ],
        faqs: [
            { question: 'Do your cleaners understand CDC dental infection control guidelines?', answer: 'Yes. Every team assigned to dental facilities is trained on CDC DHCP (Dental Health Care Personnel) guidelines, including proper surface disinfection, sterilization area protocols, and waterline management.' },
            { question: 'Can you handle multi-operatory dental practices?', answer: 'Yes. We coordinate after-hours cleaning across all operatories with standardized protocols, ensuring consistent quality across every room.' },
        ],
        relevantServices: ['medical-office-cleaning', 'disinfecting-services'],
    },
    'npi-verified-facility-governance': {
        title: 'NPI-Verified Facility Governance',
        heroTitle: 'NPI-Verified Facility Governance for Independent Practices',
        heroSubtitle: 'Linking your NPI to a documented, audit-ready facility maintenance program. Governance-grade cleaning for physician-owned practices.',
        metaDescription: 'NPI-verified facility governance for independent medical practices. Documented cleaning protocols tied to your practice identity for compliance and credentialing.',
        sidebarCategory: 'medical',
        complianceChecklist: [
            { item: 'Facility maintenance records linked to practice NPI', standard: 'CMS CoP' },
            { item: 'Credentialing-ready environmental documentation', standard: 'NCQA' },
            { item: 'Payer audit response package for facility standards', standard: 'Commercial Payers' },
            { item: 'Annual facility compliance certificate', standard: 'XIRI Standard Track' },
        ],
        sections: [
            { title: 'What NPI-Verified Governance Means', content: 'Your NPI isn\'t just a billing number — it\'s your practice identity. When payers, credentialing bodies, or surveyors ask about your facility standards, NPI-verified governance means your cleaning and maintenance records are documented, organized, and tied to your practice. XIRI provides this documentation automatically.' },
            { title: 'Why Independent Practices Need This', content: 'Hospital-employed physicians have institutional compliance departments. Independent practitioners don\'t. XIRI fills that gap by maintaining facility governance documentation that satisfies credentialing requirements, payer audits, and JCAHO environmental standards — without you hiring a compliance officer.' },
        ],
        faqs: [
            { question: 'What does NPI-verified facility governance include?', answer: 'It includes documented cleaning protocols, maintenance logs, chemical records, and audit photos — all organized and linked to your practice NPI. This creates an audit-ready compliance package for payers, credentialing bodies, and surveyors.' },
            { question: 'Is this required for credentialing?', answer: 'Many credentialing bodies (NCQA, hospital systems) ask about facility maintenance standards. Having documented records significantly strengthens your credentialing applications and renewals.' },
        ],
        relevantServices: ['medical-office-cleaning', 'disinfecting-services'],
    },
    'converted-clinical-suites': {
        title: 'Converted Clinical Suites',
        heroTitle: 'Facility Management for Converted Clinical Suites',
        heroSubtitle: 'Residential-to-medical conversions need specialized protocols. Residential HVAC, wood flooring, basement labs — we know what surveyors look for.',
        metaDescription: 'Medical office conversion compliance in Nassau County. OSHA standards for residential-based clinics NY. JCAHO environment of care for small practices on Long Island.',
        sidebarCategory: 'medical',
        complianceChecklist: [
            { item: 'Residential HVAC system cleaning and filter protocol', standard: 'ASHRAE 62.1 / JCAHO EC' },
            { item: 'Wood and laminate flooring sanitization (non-VCT)', standard: 'CDC Surface Guidelines' },
            { item: 'Basement or lower-level lab decontamination', standard: 'OSHA 1910.1030' },
            { item: 'ADA accessibility pathway cleaning and clearance', standard: 'ADA Title III' },
            { item: 'Residential plumbing backflow prevention verification', standard: 'NYS Plumbing Code' },
            { item: 'Shared-entrance infection control (patient vs. residential)', standard: 'JCAHO IC.02.01.01' },
            { item: 'Low-ceiling dust control and HEPA filtration', standard: 'OSHA PEL / JCAHO EC' },
        ],
        sections: [
            { title: 'Why Converted Suites Are Different', content: 'A converted residential home operating as a medical practice has compliance challenges that purpose-built medical offices don\'t. Residential HVAC systems weren\'t designed for clinical air quality. Wood flooring can\'t be strip-waxed like VCT. Basement labs face unique decontamination challenges. Low ceilings trap particulates. And shared entrances create infection control risks that surveyors increasingly flag.' },
            { title: 'Common in Great Neck and Long Island', content: 'Nassau County — particularly Great Neck, Manhasset, and the Northern Boulevard corridor — has hundreds of independent physician practices operating from converted residential buildings. These high-end residential conversions are architecturally beautiful but operationally complex. XIRI has developed specific protocols for these environments.' },
            { title: 'The One-Key-Ring Advantage', content: 'Independent physicians in converted suites typically juggle 3–4 separate maintenance vendors. XIRI consolidates everything under one agreement: cleaning, floor care, HVAC filter changes, pest control, and compliance documentation. One point of contact. One invoice. One system that understands the unique challenges of your converted space.' },
        ],
        faqs: [
            { question: 'What are the OSHA standards for residential-based clinics in New York?', answer: 'OSHA 29 CFR 1910.1030 (bloodborne pathogens) applies regardless of building type. Additionally, residential conversions must meet ventilation (1910.94), walking surfaces (1910.22), and electrical safety standards. XIRI documents compliance for all applicable standards.' },
            { question: 'Can a converted home pass a JCAHO environment of care survey?', answer: 'Yes — with proper protocols. Key challenges include HVAC air quality, non-standard flooring sanitization, and shared-entrance infection control. XIRI\'s converted suite protocol addresses each survey focal point.' },
            { question: 'What is One-Key-Ring management?', answer: 'One-Key-Ring is XIRI\'s consolidation model: one partner manages all facility services. Instead of 4–5 vendors, you hand XIRI the key ring. We manage cleaning, floors, HVAC, pest control, and documentation under one agreement.' },
            { question: 'How do you handle wood flooring in a medical environment?', answer: 'We use CDC-recommended intermediate-level disinfectants effective against bloodborne pathogens without damaging wood finishes. We document moisture levels and finish condition to prevent deterioration.' },
        ],
        relevantServices: ['medical-office-cleaning', 'disinfecting-services', 'floor-care', 'hvac-maintenance'],
    },

    // ─── LIFE SCIENCES (3) ───
    'iso-7-8-cleanroom-protocol': {
        title: 'ISO 7 & ISO 8 Cleanroom Protocol',
        heroTitle: 'ISO 7 & ISO 8 Cleanroom Maintenance Protocol',
        heroSubtitle: 'Particle control, gowning compliance, and documented cleaning for classified cleanroom environments.',
        metaDescription: 'ISO 14644-1 compliant cleanroom cleaning for ISO 7 and ISO 8 classified environments. Particle control protocols, gowning procedures, and documented maintenance.',
        sidebarCategory: 'life-sciences',
        complianceChecklist: [
            { item: 'Particle count verification after cleaning', standard: 'ISO 14644-1' },
            { item: 'Proper gowning and de-gowning sequence', standard: 'ISO 14644-5' },
            { item: 'HEPA-filtered vacuum use only (H13 minimum)', standard: 'ISO 14644-1' },
            { item: 'Unidirectional wiping pattern documentation', standard: 'IEST-RP-CC018' },
            { item: 'Cleanroom-compatible chemical verification', standard: 'ISO 14644-7' },
        ],
        sections: [
            { title: 'What ISO 7 and ISO 8 Classification Requires', content: 'ISO 7 allows ≤352,000 particles per cubic meter at 0.5μm. ISO 8 allows ≤3,520,000. These aren\'t aspirational — they\'re measurable. Every cleaning action either maintains or violates these thresholds. XIRI cleaners are trained on particle-generating behaviors and countermeasures.' },
            { title: 'Our Cleanroom Protocol', content: 'HEPA-H13 filtered vacuums. Unidirectional wiping patterns. Cleanroom-grade chemicals. Pre-saturated wipes (never spray bottles). Gowning compliance verified before entry. Post-clean particle counts documented. Every session logged.' },
        ],
        faqs: [
            { question: 'Do you perform particle count verification after cleaning?', answer: 'Yes. We document particle counts post-clean to verify ISO classification maintenance. Results are logged and available for your quality team.' },
            { question: 'What cleaning tools do you use in cleanrooms?', answer: 'HEPA-H13 filtered vacuums, pre-saturated cleanroom wipes (never spray bottles), and ISO-compatible cleaning chemicals. All tools are dedicated to cleanroom use only.' },
        ],
        relevantServices: ['disinfecting-services'],
    },
    'cgmp-lab-decontamination': {
        title: 'cGMP Lab Decontamination',
        heroTitle: 'cGMP Laboratory Decontamination Services',
        heroSubtitle: 'FDA-grade decontamination protocols for regulated labs. Documented, verified, and audit-ready.',
        metaDescription: 'cGMP compliant laboratory decontamination for FDA-regulated facilities. Chain-of-custody documentation, validated cleaning procedures, and audit-ready records.',
        sidebarCategory: 'life-sciences',
        complianceChecklist: [
            { item: 'Validated cleaning procedures with documented efficacy', standard: '21 CFR Part 211' },
            { item: 'Chain-of-custody for cleaning chemicals', standard: 'cGMP' },
            { item: 'Equipment cleaning verification logs', standard: 'FDA Guidance' },
            { item: 'Cross-contamination prevention protocols', standard: '21 CFR 211.176' },
        ],
        sections: [
            { title: 'cGMP Cleaning Is Not Regular Cleaning', content: 'cGMP environments require validated cleaning procedures — meaning every step is documented, every chemical is tracked, and every surface is verified clean. XIRI provides this level of documentation automatically, so your quality team can focus on science, not janitorial oversight.' },
            { title: 'Documentation That Satisfies the FDA', content: 'We maintain chain-of-custody records for all cleaning chemicals, validated procedure logs, equipment cleaning verification, and cross-contamination prevention documentation. All records are digital, searchable, and audit-ready.' },
        ],
        faqs: [
            { question: 'Are your decontamination procedures validated?', answer: 'Yes. Our procedures follow cGMP validation requirements with documented efficacy testing, SOPs, and deviation reporting.' },
            { question: 'Do you maintain chain-of-custody for chemicals?', answer: 'Yes. Every chemical used is tracked from receipt through use, with lot numbers, SDS sheets, and usage logs maintained digitally.' },
        ],
        relevantServices: ['disinfecting-services'],
    },
    'bsl-2-lab-waste-management': {
        title: 'BSL-2 Lab Waste Management',
        heroTitle: 'BSL-2 Laboratory Waste Management & Decontamination',
        heroSubtitle: 'Biosafety-compliant waste handling, autoclave area maintenance, and decontamination protocols for BSL-2 laboratories.',
        metaDescription: 'BSL-2 laboratory waste management and decontamination. Biohazard waste handling, autoclave area cleaning, and CDC/NIH biosafety compliance documentation.',
        sidebarCategory: 'life-sciences',
        complianceChecklist: [
            { item: 'Biohazard waste segregation and containerization', standard: 'CDC/NIH BMBL' },
            { item: 'Autoclave area cleaning and maintenance', standard: 'BSL-2 Standards' },
            { item: 'Spill kit availability and inspection log', standard: 'OSHA BBP' },
            { item: 'Surface decontamination with approved sporicidal agents', standard: 'CDC BMBL 6th Ed' },
        ],
        sections: [
            { title: 'BSL-2 Waste Requires Specialized Handling', content: 'BSL-2 laboratories work with moderate-risk biological agents. Waste management isn\'t just disposal — it\'s segregation, containerization, autoclave verification, and documented chain-of-custody. XIRI teams are trained on CDC/NIH Biosafety in Microbiological and Biomedical Laboratories (BMBL) protocols.' },
            { title: 'Our BSL-2 Support Services', content: 'We handle autoclave area cleaning and maintenance, biohazard waste container monitoring, spill kit inspections, and surface decontamination with CDC-approved sporicidal agents. All activities are documented with timestamps and verification photos.' },
        ],
        faqs: [
            { question: 'Are your teams trained on BSL-2 protocols?', answer: 'Yes. Teams assigned to BSL-2 environments are trained on CDC/NIH BMBL requirements, including proper PPE use, waste segregation, and decontamination procedures.' },
            { question: 'Do you handle biohazard waste disposal?', answer: 'We handle waste containerization, monitoring, and autoclave area maintenance. Final disposal is coordinated with your licensed waste hauler — we ensure containers are properly sealed, labeled, and documented.' },
        ],
        relevantServices: ['disinfecting-services', 'waste-management'],
    },

    // ─── INDUSTRIAL (3) ───
    'auto-shop-slip-coefficient-logging': {
        title: 'Auto Shop Slip-Coefficient Logging',
        heroTitle: 'Auto Shop Slip-Coefficient Logging & Floor Safety',
        heroSubtitle: 'NYS Part 226 compliant floor safety documentation for auto service bays. Measured, logged, and liability-proof.',
        metaDescription: 'Auto shop slip-coefficient logging and floor safety services. NYS Part 226 OSHA compliance, friction testing documentation, and degreasing protocols for service bays.',
        sidebarCategory: 'industrial',
        complianceChecklist: [
            { item: 'Static coefficient of friction (SCOF) testing and logging', standard: 'ASTM C1028 / ANSI A326.3' },
            { item: 'Service bay degreasing with documented frequency', standard: 'NYS Part 226' },
            { item: 'Spill response protocol and supply verification', standard: 'OSHA 1910.22' },
            { item: 'Floor drainage inspection and maintenance log', standard: 'EPA SPCC' },
        ],
        sections: [
            { title: 'Why Slip-Coefficient Logging Matters', content: 'Auto service bays are slip-and-fall hotspots. Oil, coolant, and cleaning chemicals create liability exposure. NYS Part 226 requires employers to maintain safe walking surfaces. XIRI documents floor friction levels, degreasing frequency, and spill response — creating a defensible safety record.' },
            { title: 'Our Floor Safety Protocol', content: 'We perform regularly scheduled degreasing of service bays using OSHA-compliant products, document SCOF measurements, maintain spill kit inventories, and log all floor maintenance activities. Your records are timestamped, photographed, and audit-ready.' },
        ],
        faqs: [
            { question: 'What is slip-coefficient logging?', answer: 'It\'s the documented measurement of floor friction levels (SCOF) in your service bays. We test, log, and track these values over time to prove your floors meet safety standards and to protect you from slip-and-fall liability claims.' },
            { question: 'Is this required by New York State?', answer: 'NYS Part 226 requires employers to maintain safe walking surfaces. While friction testing isn\'t explicitly mandated, documented evidence of floor safety practices significantly strengthens your defense in liability claims.' },
        ],
        relevantServices: ['floor-care', 'commercial-cleaning'],
    },
    'data-center-zinc-whisker-remediation': {
        title: 'Data Center Zinc-Whisker Remediation',
        heroTitle: 'Data Center Sub-Floor Zinc-Whisker Remediation',
        heroSubtitle: 'Microscopic zinc whiskers from galvanized floor tiles cause short circuits. We identify, remediate, and prevent recurrence.',
        metaDescription: 'Zinc-whisker remediation for data center sub-floors. HEPA-filtered cleaning, galvanized tile assessment, and contamination prevention protocols.',
        sidebarCategory: 'industrial',
        complianceChecklist: [
            { item: 'Sub-floor plenum inspection and HEPA vacuuming', standard: 'ASHRAE TC 9.9' },
            { item: 'Zinc whisker identification on galvanized tiles', standard: 'iNEMI Guidelines' },
            { item: 'HEPA-H14 filtered airborne particle control', standard: 'ISO 14644-1' },
            { item: 'Anti-static protocols for equipment proximity work', standard: 'ANSI/ESD S20.20' },
        ],
        sections: [
            { title: 'What Are Zinc Whiskers?', content: 'Zinc whiskers are microscopic metal filaments that grow from galvanized steel floor tiles. They break off, become airborne in sub-floor plenums, and cause short circuits in IT equipment. A single whisker can take down a server. Most data center operators don\'t know they have a zinc whisker problem until equipment fails.' },
            { title: 'Our Remediation Process', content: 'We inspect sub-floor plenums for zinc whisker contamination, HEPA-vacuum affected areas with H14-grade filtration, assess galvanized tiles for replacement priority, and implement ongoing monitoring protocols. All work follows ASHRAE TC 9.9 and iNEMI guidelines.' },
        ],
        faqs: [
            { question: 'How do I know if my data center has a zinc whisker problem?', answer: 'If your data center has galvanized steel floor tiles (common in pre-2005 builds), you likely have zinc whiskers. We perform a sub-floor inspection with magnification and particle sampling to assess severity.' },
            { question: 'Can zinc whiskers be permanently eliminated?', answer: 'The whiskers themselves can be removed with HEPA vacuuming, but they regrow from galvanized surfaces. Long-term solutions include tile replacement with non-galvanized alternatives and ongoing HEPA maintenance cleaning.' },
        ],
        relevantServices: ['commercial-cleaning'],
    },
    'esd-safe-floor-care': {
        title: 'ESD-Safe Floor Care',
        heroTitle: 'ESD-Safe Floor Care for Light Manufacturing',
        heroSubtitle: 'Electrostatic discharge prevention built into every floor maintenance visit. Conductive testing, approved chemicals, and documented compliance.',
        metaDescription: 'ESD-safe floor care for electronics manufacturing and assembly. Conductive floor testing, approved cleaning chemicals, and ANSI/ESD S20.20 compliance documentation.',
        sidebarCategory: 'industrial',
        complianceChecklist: [
            { item: 'Floor conductivity testing before and after maintenance', standard: 'ANSI/ESD S7.1' },
            { item: 'ESD-safe cleaning chemical verification', standard: 'ANSI/ESD S20.20' },
            { item: 'Wax/finish conductivity certification', standard: 'ESD TR20.20' },
            { item: 'Grounding strap verification for cleaning personnel', standard: 'ANSI/ESD S1.1' },
        ],
        sections: [
            { title: 'Why ESD-Safe Floor Care Matters', content: 'Standard floor waxes and cleaning chemicals can destroy the conductive properties of ESD flooring. A single floor maintenance visit with the wrong product can void your ESD protection and expose sensitive electronics to static discharge damage. XIRI uses only verified ESD-compatible products.' },
            { title: 'Our ESD Floor Protocol', content: 'We test floor conductivity before and after every maintenance visit, use only ANSI/ESD S20.20 approved chemicals and finishes, verify grounding continuity, and document all measurements. Your ESD compliance records are always current.' },
        ],
        faqs: [
            { question: 'Do you test floor conductivity?', answer: 'Yes. We measure floor-to-ground resistance before and after every maintenance visit to verify ESD protection is maintained. Results are logged and available for your quality team.' },
            { question: 'What floor finishes do you use?', answer: 'Only ESD-certified conductive finishes that maintain proper resistance levels. We verify product certifications and maintain records of every product applied to your floors.' },
        ],
        relevantServices: ['floor-care'],
    },

    // ─── INSTITUTIONAL (2) ───
    'bank-vault-micro-climate-sanitization': {
        title: 'Bank Vault Micro-Climate Sanitization',
        heroTitle: 'Bank Vault Micro-Climate Sanitization',
        heroSubtitle: 'Climate-controlled vault environments require specialized cleaning that doesn\'t disrupt temperature, humidity, or security protocols.',
        metaDescription: 'Bank vault cleaning and micro-climate sanitization. Temperature-controlled cleaning, humidity preservation, and full chain-of-custody security documentation.',
        sidebarCategory: 'institutional',
        complianceChecklist: [
            { item: 'Temperature and humidity monitoring during cleaning', standard: 'ASHRAE 62.1' },
            { item: 'Chain-of-custody documentation for vault access', standard: 'FFIEC Guidelines' },
            { item: 'Dual-control entry compliance', standard: 'Bank Security Act' },
            { item: 'Non-outgassing cleaning products only', standard: 'Vault Preservation' },
        ],
        sections: [
            { title: 'Why Vaults Need Specialized Cleaning', content: 'Bank vaults maintain precise micro-climates for document and currency preservation. Standard cleaning products can outgas VOCs that damage sensitive materials. Standard procedures can disrupt temperature and humidity levels. XIRI uses vault-specific protocols that clean without compromising the controlled environment.' },
            { title: 'Security-First Cleaning', content: 'Every vault clean follows dual-control entry procedures, chain-of-custody documentation, and security camera coordination. Our bonded, background-checked teams are trained on financial institution security requirements.' },
        ],
        faqs: [
            { question: 'How do you maintain vault climate during cleaning?', answer: 'We use non-outgassing products, minimize door-open time through pre-staged equipment, and monitor temperature/humidity readings before and after service. Deviations are documented and reported.' },
            { question: 'Are your teams cleared for vault access?', answer: 'Yes. All vault-assigned personnel undergo enhanced background checks, are fully bonded, and follow dual-control entry procedures with chain-of-custody documentation.' },
        ],
        relevantServices: ['commercial-cleaning'],
    },
    'high-security-cash-room-protocols': {
        title: 'High-Security Cash Room Protocols',
        heroTitle: 'High-Security Cash Room Cleaning Protocols',
        heroSubtitle: 'Bonded, background-checked teams with dual-control access, camera coordination, and documented chain-of-custody for every cleaning visit.',
        metaDescription: 'High-security cash room cleaning with dual-control access, bonded personnel, and chain-of-custody documentation for financial institutions.',
        sidebarCategory: 'institutional',
        complianceChecklist: [
            { item: 'Dual-control access with witness sign-off', standard: 'FFIEC/BSA' },
            { item: 'Security camera coordination before entry', standard: 'Bank Security' },
            { item: 'No personal items in cash handling areas', standard: 'Cash Room SOP' },
            { item: 'Post-clean room seal verification', standard: 'Institution Policy' },
        ],
        sections: [
            { title: 'Cash Room Cleaning Is a Security Event', content: 'Cleaning a cash room isn\'t housekeeping — it\'s a security procedure. Every entry is documented, witnessed, and camera-verified. Every item in the room is accounted for before and after. XIRI treats cash room cleaning with the same rigor as the institution itself.' },
            { title: 'Our Security Protocol', content: 'Pre-entry camera coordination with security. Dual-control entry with witness sign-off. No personal items past the threshold. Cleaning performed with institution-approved products only. Post-clean room seal verification. Full documentation provided to your security team.' },
        ],
        faqs: [
            { question: 'What security clearance do your teams have?', answer: 'Cash room teams undergo enhanced background screening, are fully bonded and insured, and sign confidentiality agreements. We coordinate all scheduling with your security department.' },
            { question: 'How do you handle cash room documentation?', answer: 'Every entry is logged with dual-control sign-off, timestamps, camera coordination confirmation, and post-clean verification. Reports are provided to your security team after each service.' },
        ],
        relevantServices: ['commercial-cleaning'],
    },
};
