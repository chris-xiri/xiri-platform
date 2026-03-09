// ── Guide Data ──
// Extracted from app/guides/[slug]/page.tsx for separation of concerns.
// These are the hardcoded fallback guides; Firestore-published guides take priority.

export interface GuideData {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    datePublished?: string;   // ISO 8601 date string, e.g. '2026-03-09'
    dateModified?: string;    // ISO 8601 date string
    sections: { title: string; content: string; items?: string[] }[];
    calloutTitle?: string;
    calloutContent?: string;
    relatedServices: string[];
    faqs: { question: string; answer: string }[];
}

export const GUIDES: Record<string, GuideData> = {
    'jcaho-cleaning-requirements': {
        title: 'JCAHO Cleaning Requirements for Medical Offices',
        heroTitle: 'JCAHO Cleaning Requirements: What Your Medical Office Needs to Know',
        heroSubtitle: 'A practical guide to meeting Joint Commission environmental cleaning standards — and maintaining compliance between surveys.',
        metaDescription: 'Complete guide to JCAHO cleaning requirements for medical offices. Learn terminal cleaning protocols, documentation standards, and how to stay survey-ready year-round.',
        datePublished: '2025-09-15',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'Why JCAHO Cleaning Standards Matter',
                content: 'The Joint Commission (formerly JCAHO) evaluates healthcare facilities on Environmental Care standards as part of their accreditation surveys. A failed environmental cleaning element can trigger a Requirement for Improvement (RFI) that jeopardizes your accreditation — and with it, your ability to bill Medicare and most insurance plans.',
            },
            {
                title: 'The Five Pillars of JCAHO-Compliant Cleaning',
                content: 'The Joint Commission evaluates environmental cleaning across these core areas:',
                items: [
                    'Terminal Cleaning Protocols — End-of-day deep disinfection of all patient care areas using EPA-registered, hospital-grade products following CDC Guidelines for Environmental Infection Control',
                    'Chemical Management — Proper storage, labeling, and Safety Data Sheet (SDS) documentation for all cleaning chemicals used in your facility',
                    'Staff Training — Documented training records showing cleaning staff are trained in bloodborne pathogen handling (OSHA 29 CFR 1910.1030), PPE usage, and proper disinfection techniques',
                    'Quality Monitoring — A systematic process for verifying that cleaning is done correctly — not just that it was done. This can include visual inspection, ATP testing, or fluorescent marker programs',
                    'Documentation & Records — Cleaning logs with dates, times, areas cleaned, chemicals used, and staff identification that can be produced during an unannounced survey',
                ],
            },
            {
                title: 'Common Survey Deficiencies in Environmental Cleaning',
                content: 'Based on Joint Commission survey data, the most frequently cited environmental cleaning deficiencies include:',
                items: [
                    'No documented cleaning schedule or scope of work',
                    'Cleaning products not on the EPA List N or appropriate for healthcare settings',
                    'No evidence of ongoing staff training or competency verification',
                    'Lack of a quality monitoring program for cleaning effectiveness',
                    'Expired SDS sheets or improperly labeled chemical containers',
                    'No evidence that high-touch surfaces are cleaned with appropriate frequency',
                ],
            },
            {
                title: 'How to Build a Survey-Ready Cleaning Program',
                content: 'A compliant program isn\'t built during survey prep — it\'s built into your daily operations. Here\'s the framework:',
                items: [
                    'Create a written Scope of Work that specifies cleaning tasks, frequencies, and responsible parties for every room and area',
                    'Use only EPA-registered hospital-grade disinfectants with documented dwell times',
                    'Implement a log system (digital preferred) that records every cleaning session with timestamps and staff identification',
                    'Schedule quarterly training refreshers for all cleaning staff on infection control and chemical safety',
                    'Implement a quality verification program — either internal spot-checks or an independent auditing system like XIRI\'s Night Manager program',
                ],
            },
        ],
        calloutTitle: 'How XIRI Keeps You Survey-Ready',
        calloutContent: 'Our Night Managers independently audit every clean in your facility with photographic documentation. Your FSM maintains digital cleaning logs, chemical SDS sheets, and training records — giving you instant access to 12 months of compliance documentation for any survey or inspection.',
        relatedServices: ['medical-office-cleaning', 'surgery-center-cleaning', 'disinfecting-services'],
        faqs: [
            {
                question: 'Does XIRI provide JCAHO-compliant cleaning documentation?',
                answer: 'Yes. We maintain timestamped digital logs of every cleaning session, chemical SDS sheets, contractor training records, and Night Manager audit photos. Your FSM can generate a compliance report on demand.',
            },
            {
                question: 'How often does the Joint Commission survey for cleaning?',
                answer: 'JCAHO conducts unannounced surveys every 2–3 years for accredited organizations. Environmental cleaning is evaluated during every survey under the Environment of Care (EC) standards.',
            },
            {
                question: 'Can your documentation replace our internal quality monitoring?',
                answer: 'Our Night Manager audit program satisfies the JCAHO requirement for a quality monitoring system for environmental cleaning. Each audit includes photographic evidence and a standardized checklist that documents cleaning effectiveness.',
            },
        ],
    },
    'commercial-cleaning-cost-guide': {
        title: 'How Much Does Commercial Cleaning Cost?',
        heroTitle: 'What Drives the Cost of Commercial Cleaning?',
        heroSubtitle: 'Understand the factors that determine your cleaning costs — and how to make sure you\'re getting real value, not just the lowest bid.',
        metaDescription: 'Learn what drives commercial cleaning costs for offices, medical facilities, and single-tenant buildings. Understand key pricing factors and how to budget effectively.',
        datePublished: '2025-10-01',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'Why Cleaning Costs Vary So Much',
                content: 'Commercial cleaning isn\'t one-size-fits-all. A general office with standard trash-and-vacuum needs costs significantly less than a medical office requiring terminal disinfection and compliance documentation. The right question isn\'t "how much per square foot?" — it\'s "what does my facility actually need, and how do I avoid paying for work that isn\'t getting done?"',
            },
            {
                title: 'The Biggest Factors That Affect Your Price',
                content: 'When evaluating cleaning proposals or building a budget, these are the variables that matter most:',
                items: [
                    'Facility Type — Medical, surgical, and childcare environments require specialized chemicals, training, and compliance protocols that general offices don\'t. Higher regulatory standards mean higher service requirements',
                    'Cleaning Frequency — The more nights per week you need service, the higher the monthly cost. But less frequent cleaning often leads to deeper buildup and higher per-visit costs when you do clean',
                    'Scope of Work — Are you covering just trash and vacuuming, or do you need restroom sanitization, kitchen service, floor care, and supply restocking? A detailed scope prevents both overpaying and under-servicing',
                    'Quality Verification — A vendor who sends a crew with no oversight will always be cheaper than a service that independently audits every clean. But unverified cleaning is the most expensive option long-term',
                    'Building Size & Layout — Larger facilities benefit from efficiency gains, but complex layouts with many small rooms cost more per square foot than open floor plans',
                ],
            },
            {
                title: 'How to Avoid Overpaying',
                content: 'The most common reason facilities overpay for cleaning is poor scope definition. Without a detailed written scope, you\'re paying for what the vendor thinks you need — not what you actually need. Here\'s how to get the right price:',
                items: [
                    'Get a walkthrough-based scope — Never accept a quote based solely on square footage. A qualified vendor should walk your facility room by room and document exactly what\'s needed',
                    'Define frequencies by area — Not every room needs the same attention every night. High-traffic areas may need nightly service; storage rooms may need weekly',
                    'Consolidate vendors — Using one managed service for multiple needs (cleaning, floor care, pest control) reduces overhead and typically costs less than hiring separate vendors for each',
                    'Include quality verification — The cheapest bid with no quality control is the most expensive option long-term. Missed cleans and re-work cost more than doing it right the first time',
                ],
            },
            {
                title: 'The Hidden Cost of "Cheap" Cleaning',
                content: 'Low-bid cleaning vendors cut corners in predictable ways: they skip rooms, reduce dwell time on disinfectants, thin out crew sizes, and provide zero oversight. The result is inconsistent quality, tenant complaints, and eventual re-bidding — which costs more in time and frustration than paying for a properly managed service from the start.',
            },
        ],
        calloutTitle: 'Get a Custom Quote for Your Facility',
        calloutContent: 'Every facility is different. Our FSMs conduct a free on-site walkthrough, build a detailed room-by-room scope, and provide transparent flat-rate pricing — no hidden fees, no surprises.',
        relatedServices: ['commercial-cleaning', 'janitorial-services', 'medical-office-cleaning'],
        faqs: [
            {
                question: 'How does XIRI determine pricing?',
                answer: 'We quote based on a custom scope built from an on-site walkthrough — not just square footage. Your flat monthly rate reflects your actual cleaning needs, frequency, and facility complexity. No hidden fees, no per-incident charges.',
            },
            {
                question: 'Is XIRI more expensive than hiring a cleaning company directly?',
                answer: 'Our pricing includes Night Manager quality audits, FSM management, backup crew coverage, and consolidated invoicing — things a standalone vendor doesn\'t provide. When you factor in the cost of managing a vendor yourself, most clients find XIRI is cost-neutral or saves money.',
            },
            {
                question: 'Can I start with a smaller scope and expand later?',
                answer: 'Absolutely. Many clients start with core janitorial and add floor care, pest control, or other services over time. Your FSM recommends additions based on what they observe during weekly site visits.',
            },
        ],
    },
    'inhouse-vs-outsourced-facility-management': {
        title: 'In-House vs Outsourced Facility Management',
        heroTitle: 'Should You Hire In-House or Outsource Facility Management?',
        heroSubtitle: 'A practical comparison for business owners who are tired of managing building maintenance themselves.',
        metaDescription: 'Compare in-house facility management vs outsourcing to a managed service. Pros, cons, and when each approach makes sense for your business.',
        datePublished: '2025-10-15',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'The Real Cost of In-House',
                content: 'Hiring an in-house facility manager sounds simple until you add up the total cost. For most single-tenant buildings, the math is harder to justify than it looks:',
                items: [
                    'Salary + Benefits — A full-time facility manager requires a competitive salary plus health insurance, PTO, and payroll taxes that significantly increase the total cost of employment',
                    'Coverage Gap — One person can\'t cover nights, weekends, and vacations. Who verifies the cleaning was done at midnight?',
                    'Vendor Management — They still need to source, vet, and manage every contractor. Hiring a manager doesn\'t make the vendor coordination work disappear',
                    'Overhead — Between salary, benefits, tools, and vehicle costs, the fully-loaded expense of an in-house hire far exceeds what most small facilities expect',
                ],
            },
            {
                title: 'The Outsourced Alternative',
                content: 'Outsourcing facility management to a service like XIRI replaces the need for an in-house hire while adding capabilities a single employee can\'t provide:',
                items: [
                    'Dedicated FSM — Your Facility Solutions Manager functions as your building manager, conducting weekly site visits and managing all vendors',
                    'Night Coverage — Night Managers audit contractor work at midnight, 365 nights per year — something no single employee can do',
                    'Vendor Network — We\'ve already sourced, vetted, and insured contractors across every trade. No recruiting needed',
                    'Backup Coverage — If a vendor no-shows, we auto-dispatch a backup. No scrambling, no missed cleans',
                    'Lower Total Cost — A managed service typically costs significantly less than a full-time hire, and scales up or down with your needs',
                ],
            },
            {
                title: 'When In-House Makes Sense',
                content: 'In-house facility management can be the right choice in specific situations:',
                items: [
                    'Large campuses with complex mechanical systems requiring daily on-site presence',
                    'Organizations with regulatory requirements for a named Facilities Director (some hospital systems)',
                    'Budgets that can support a full team — manager, assistant, and backup coverage',
                ],
            },
            {
                title: 'When Outsourcing Makes Sense',
                content: 'Outsourcing is the better fit for most single-tenant buildings:',
                items: [
                    'Small to mid-size facilities where a full-time hire is overkill for the actual workload',
                    'Medical offices, auto dealerships, daycares, and professional offices that need consistent quality but don\'t have facility management expertise',
                    'Business owners who want to focus on their core business and not on vendor coordination and maintenance logistics',
                    'Organizations that want verified quality (nightly audits) without the overhead of a management hire',
                ],
            },
        ],
        calloutTitle: 'See What Outsourcing Looks Like for Your Facility',
        calloutContent: 'We\'ll conduct a free site audit, identify every service your facility needs, and show you a transparent monthly cost that replaces the need for an in-house hire — with better coverage, verified quality, and one invoice.',
        relatedServices: ['janitorial-services', 'commercial-cleaning', 'floor-care', 'hvac-maintenance', 'pest-control', 'handyman-services'],
        faqs: [
            {
                question: 'Can XIRI fully replace an in-house facility manager?',
                answer: 'For most single-tenant buildings — yes. Your FSM handles weekly site visits, vendor coordination, quality control, and issue resolution. Night Managers cover overnight auditing. You get better coverage than a single employee at a lower total cost.',
            },
            {
                question: 'What if we have an in-house person and just want help with vendor management?',
                answer: 'We work alongside in-house teams too. Your facility manager can focus on capital projects, tenant relations, or other priorities while XIRI handles the vendor sourcing, scheduling, and nightly quality verification.',
            },
            {
                question: 'How do your costs compare to a full-time hire?',
                answer: 'When you factor in salary, benefits, coverage gaps, and the vendor management work that doesn\'t go away, a managed service like XIRI typically costs significantly less — and includes Night Manager audits, backup coverage, and consolidated vendor management that a single employee can\'t provide.',
            },
        ],
    },
    'accreditation-360-preparation-guide': {
        title: 'Preparing for JCAHO Accreditation 360: 2026 Guide for Nassau Medical Offices',
        heroTitle: 'Preparing for the 2026 Accreditation 360 Update',
        heroSubtitle: 'A surgical-grade guide for Nassau County medical offices navigating the biggest accreditation overhaul since Medicare\'s creation.',
        metaDescription: 'Prepare for JCAHO Accreditation 360 in 2026. Learn what changed, how it affects your cleaning compliance, and how to stay survey-ready under the new Physical Environment standards.',
        datePublished: '2025-12-01',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'What Is Accreditation 360?',
                content: 'Accreditation 360 is the Joint Commission\'s most comprehensive overhaul of its hospital and medical office accreditation model — effective January 1, 2026. It removes over 700 redundant requirements, merges the Environment of Care (EC) and Life Safety (LS) chapters into a single "Physical Environment" section, and replaces the National Patient Safety Goals (NPSGs) with new National Performance Goals (NPGs) that emphasize measurable outcomes over static documentation.',
            },
            {
                title: 'The 5 Biggest Changes That Affect Your Cleaning Program',
                content: 'For practice managers and office administrators, here\'s what matters most:',
                items: [
                    'EC + LS Merge → "Physical Environment" — Your cleaning program, fire safety, and utilities management are now evaluated as one integrated category. Surveyors will expect a unified compliance system, not separate binders.',
                    'Continuous Readiness Over Survey Prep — The old model rewarded cramming before a survey. The new model emphasizes year-round operational compliance. If your cleaning documentation has gaps between surveys, you\'re exposed.',
                    'Direct Observation Over Document Review — Surveyors will spend more time watching your workflows and less time reviewing paperwork. Your cleaning crews need to demonstrate proper technique on the spot.',
                    'National Performance Goals (NPGs) — Infection control outcomes (HAIs, SSIs) will be measured against national benchmarks. Your environmental cleaning directly impacts these numbers.',
                    'Publicly Available Standards — For the first time, Joint Commission standards will be publicly available without a paid subscription. This means patients, insurers, and competitors can all see what you\'re being measured against.',
                ],
            },
            {
                title: 'What Surveyors Will Look for Under the New Model',
                content: 'Under Accreditation 360, survey methodology shifts significantly. Here\'s what to expect in your next unannounced survey:',
                items: [
                    'Live observation of terminal cleaning procedures — not just documentation that it happened',
                    'Evidence of continuous quality monitoring (not just pre-survey audits)',
                    'Staff competency demonstrated in real-time — can your cleaning crew explain proper dwell times, PPE usage, and high-touch surface protocols?',
                    'Integrated Physical Environment documentation — cleaning logs, chemical SDS sheets, and safety records in one accessible system',
                    'Infection control metrics tied to environmental cleaning practices',
                ],
            },
            {
                title: 'Your 2026 Readiness Checklist',
                content: 'Use this checklist to assess your practice\'s readiness for Accreditation 360:',
                items: [
                    'Merge your EC and LS documentation into a single "Physical Environment" compliance system',
                    'Implement a continuous cleaning quality monitoring program — not just annual training refreshers',
                    'Ensure every cleaning session is digitally logged with timestamps, chemicals used, and staff IDs',
                    'Train or retrain cleaning staff on verbal competency — they may be asked to explain their protocols during observation',
                    'Establish a regular audit cadence (nightly or weekly) with photographic evidence',
                    'Review and update your chemical inventory — ensure all products are EPA-registered and healthcare-grade with documented dwell times',
                    'Create a single point-of-contact who owns environmental cleaning compliance for your practice',
                ],
            },
        ],
        calloutTitle: 'How XIRI Makes You Accreditation 360-Ready',
        calloutContent: 'Our Night Managers already conduct nightly audits with photographic documentation — the exact continuous monitoring model that Accreditation 360 demands. Your FSM maintains digital cleaning logs, chemical SDS sheets, and training records in one system. When a surveyor walks in unannounced, you hand them a login, not a binder.',
        relatedServices: ['medical-office-cleaning', 'surgery-center-cleaning', 'disinfecting-services'],
        faqs: [
            {
                question: 'When does Accreditation 360 take effect?',
                answer: 'January 1, 2026, for hospitals and critical access hospitals. Medical offices and ambulatory care settings should expect the rollout shortly after as the Joint Commission extends the model to additional healthcare settings throughout 2026.',
            },
            {
                question: 'Does XIRI already comply with the new Accreditation 360 standards?',
                answer: 'Yes. Our operating model — nightly audits, digital documentation, continuous quality monitoring, and trained crews — already aligns with the outcome-focused, continuous-readiness approach that Accreditation 360 requires. We didn\'t need to change; the standards caught up to how we already work.',
            },
            {
                question: 'What happens to our existing JCAHO documentation?',
                answer: 'Your existing documentation is still valid, but it needs to be reorganized. The old EC and LS chapters merge into "Physical Environment." We help our clients consolidate their cleaning, safety, and environmental records into one integrated digital system that matches the new structure.',
            },
            {
                question: 'How is this different from your existing JCAHO guide?',
                answer: 'Our JCAHO Cleaning Requirements guide covers the foundational standards that haven\'t changed — terminal cleaning, chemical management, staff training, and documentation. This Accreditation 360 guide specifically addresses the 2026 structural changes and what they mean for your day-to-day cleaning operations.',
            },
        ],
    },

    // ─── NEW REGULATION COMPLIANCE GUIDES ───────────────────────────────

    'osha-bloodborne-pathogen-cleaning-standard': {
        title: 'OSHA Bloodborne Pathogen Cleaning Requirements (29 CFR 1910.1030)',
        heroTitle: 'OSHA Bloodborne Pathogen Standard: What Every Cleaning Contractor Must Follow',
        heroSubtitle: 'A practical guide to OSHA 29 CFR 1910.1030 compliance for janitorial teams working in medical offices, urgent care centers, and any facility where blood or bodily fluids are present.',
        metaDescription: 'Complete guide to OSHA Bloodborne Pathogen Standard (29 CFR 1910.1030) for cleaning contractors. Learn exposure control, PPE requirements, training mandates, and documentation standards.',
        datePublished: '2026-03-09',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'What Is the OSHA Bloodborne Pathogen Standard?',
                content: 'OSHA\'s Bloodborne Pathogen Standard (29 CFR 1910.1030) is a federal regulation that protects workers from health hazards caused by exposure to blood and other potentially infectious materials (OPIM). It applies to every employee who could reasonably anticipate contact with blood during their work — including janitorial and cleaning staff in medical offices, dental practices, urgent care centers, dialysis clinics, veterinary facilities, and laboratories. Violation penalties range from $16,131 per serious violation to $161,323 for willful or repeated violations (2024 OSHA penalty schedule).',
            },
            {
                title: 'Why This Standard Applies to Cleaning Contractors',
                content: 'Many facility managers assume the Bloodborne Pathogen Standard only applies to healthcare workers. It does not. OSHA explicitly includes any employee with "reasonably anticipated" occupational exposure — and cleaning crews in medical environments meet this threshold every shift. Mopping an exam room floor, emptying sharps-adjacent trash, or handling red-bag waste all constitute potential exposure events.',
            },
            {
                title: 'The 5 Requirements That Apply to Your Cleaning Program',
                content: 'If your cleaning contractors work in any environment where blood or OPIM could be present, these five requirements under 29 CFR 1910.1030 are non-negotiable:',
                items: [
                    'Written Exposure Control Plan (ECP) — You must maintain a written plan identifying which job classifications have occupational exposure, how you will minimize exposure, and your post-exposure procedures. This plan must be reviewed and updated annually',
                    'Universal Precautions — Cleaning crews must treat all blood and bodily fluids as if they are infectious. No exceptions, no judgment calls. Every surface that could carry blood gets treated with EPA-registered hospital-grade disinfectant',
                    'Personal Protective Equipment (PPE) — Employers must provide gloves, face shields, gowns, and eye protection at no cost to the worker. PPE must be appropriate to the task — nitrile gloves for routine cleaning, face shields for splash risk',
                    'Hepatitis B Vaccination — Employers must offer the Hepatitis B vaccine series to all employees with occupational exposure within 10 working days of initial assignment — at no cost to the employee',
                    'Training and Recordkeeping — Initial training before first assignment, annual refresher training, and detailed records of all training sessions, exposure incidents, and medical evaluations. Training records must be retained for 3 years',
                ],
            },
            {
                title: 'Common OSHA Violations in Cleaning Operations',
                content: 'Based on OSHA enforcement data, the most frequently cited violations for cleaning contractors include:',
                items: [
                    'No written Exposure Control Plan — or a plan that has not been updated in the past 12 months',
                    'PPE not provided or not appropriate — using latex gloves instead of nitrile, or no face protection for splash-risk tasks',
                    'No documentation of annual training — OSHA requires records showing each employee completed BBP training, signed an acknowledgment, and can demonstrate competency',
                    'Hepatitis B vaccination not offered — even if the employee declines, the offer must be documented with a signed declination form',
                    'Improper sharps handling — cleaning crew members reaching into sharps containers or handling sharps without needle-resistant gloves',
                    'No post-exposure incident procedure — lacking a documented process for what happens when an exposure event occurs',
                ],
            },
            {
                title: 'How to Build a Compliant Cleaning Program',
                content: 'A compliant program starts before the first mop hits the floor. Here is the framework your cleaning operation needs:',
                items: [
                    'Write your ECP — Document every job task with potential exposure, the controls in place, and the responsible person. Review it every January',
                    'Train before deploying — No cleaning contractor should enter a medical facility without documented BBP training. Cover PPE selection, spill response, sharps avoidance, and hand hygiene',
                    'Provide and inspect PPE — Stock nitrile gloves (multiple sizes), face shields, disposable gowns, and eye protection. Inspect before each shift',
                    'Post the exposure response protocol — Every supply closet should have a laminated card with the post-exposure steps: wash site, report to supervisor, seek medical evaluation within 24 hours',
                    'Log every training session — Name, date, topics covered, trainer qualifications, and signed acknowledgment. Keep records for a minimum of 3 years beyond the last date of employment',
                ],
            },
        ],
        calloutTitle: 'How XIRI Handles Bloodborne Pathogen Compliance',
        calloutContent: 'Every XIRI contractor deployed to a medical facility completes documented BBP training before their first shift. We maintain Exposure Control Plans, PPE inventories, and training records digitally — accessible to your facility manager on demand. Our Night Managers verify PPE usage and proper disinfection technique during every nightly audit.',
        relatedServices: ['medical-office-cleaning', 'surgery-center-cleaning', 'urgent-care-cleaning', 'disinfecting-services'],
        faqs: [
            {
                question: 'Does OSHA 29 CFR 1910.1030 apply to janitorial companies?',
                answer: 'Yes. The Bloodborne Pathogen Standard applies to any employee with reasonably anticipated occupational exposure to blood or other potentially infectious materials. Cleaning crews in medical offices, dental practices, urgent care centers, and labs all fall under this standard — regardless of whether they are direct employees or subcontracted vendors.',
            },
            {
                question: 'Who is responsible for BBP compliance — the facility or the cleaning company?',
                answer: 'Both. OSHA holds the employer of record responsible for their own employees. If your cleaning crew is employed by a contractor, that contractor must have their own Exposure Control Plan, provide PPE, and conduct training. However, the facility owner has a general duty to ensure safe working conditions. XIRI handles all BBP compliance for our deployed contractors.',
            },
            {
                question: 'How often must BBP training be renewed?',
                answer: 'Annually. OSHA requires initial BBP training before first assignment and refresher training at least once every 12 months. Additional training is required when new tasks or procedures affect occupational exposure. XIRI conducts refresher training every January and maintains signed records.',
            },
            {
                question: 'What happens if our cleaning contractor does not follow the Bloodborne Pathogen Standard?',
                answer: 'OSHA penalties for BBP violations range from $16,131 per serious violation to $161,323 for willful or repeated violations (2024 penalty schedule). Beyond fines, a violation can trigger a facility-wide inspection that uncovers additional issues — creating a cascade of compliance risk.',
            },
        ],
    },

    'hipaa-environmental-compliance-cleaning': {
        title: 'HIPAA Environmental Compliance for Janitorial Vendors',
        heroTitle: 'HIPAA and Your Cleaning Crew: What Janitorial Vendors Need to Know',
        heroSubtitle: 'Your cleaning contractor has access to your facility after hours. That means access to patient charts, prescription labels, and computer screens. Here is how to keep your practice HIPAA-compliant.',
        metaDescription: 'Guide to HIPAA environmental compliance for cleaning and janitorial vendors. Learn PHI exposure risks, Business Associate requirements, training mandates, and how to protect patient data.',
        datePublished: '2026-03-09',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'Why HIPAA Applies to Your Cleaning Contractor',
                content: 'The Health Insurance Portability and Accountability Act (HIPAA) protects patient health information — and that protection extends to anyone who could access it, including your after-hours cleaning crew. Under the HIPAA Security Rule and Privacy Rule, a janitorial vendor who enters a medical office with access to Protected Health Information (PHI) may qualify as a Business Associate. Penalties for HIPAA violations range from $141 to $2,134,831 per violation category, with a maximum of $2,134,831 per identical violation per year (2024 HHS penalty schedule). An unlocked chart room and a cleaning crew without training is all it takes.',
            },
            {
                title: 'When Your Cleaning Vendor Is a Business Associate',
                content: 'Not every cleaning contractor qualifies as a Business Associate under HIPAA — but many do. The determining factor is access, not intent:',
                items: [
                    'If your cleaning crew has unsupervised access to areas where PHI is stored, displayed, or accessible — they are likely a Business Associate',
                    'If your crew can see patient names on sign-in sheets, prescription labels in trash, or information on unattended computer screens — that constitutes potential PHI exposure',
                    'If PHI exposure is "reasonably anticipated" during cleaning operations, a Business Associate Agreement (BAA) is required under 45 CFR 164.502(e)',
                    'A BAA does not need to be complex — it establishes that the vendor will safeguard PHI, report breaches, and train their employees accordingly',
                ],
            },
            {
                title: 'The 4 HIPAA Risks Your Cleaning Crew Creates',
                content: 'These are the four most common HIPAA exposure vectors created by after-hours cleaning operations:',
                items: [
                    'Visual Exposure — Patient charts left on desks, sign-in sheets at reception, lab results on counters, or patient information visible on unlocked computer screens',
                    'Trash and Shredding — Prescription labels, appointment slips, EOBs, and printed patient records in regular trash instead of secure shredding bins',
                    'Unlocked Access — Cleaning crew given master key or code access to records rooms, file cabinets, or medication storage without need-to-know justification',
                    'Photography — Cleaning crews using personal phones to photograph task completion in areas where PHI is visible in the background',
                ],
            },
            {
                title: 'How to HIPAA-Proof Your Cleaning Program',
                content: 'Protecting PHI during cleaning operations requires controls on both sides — your practice and your vendor. Here is the practical framework:',
                items: [
                    'Execute a BAA — If your cleaning vendor has unsupervised access to areas with PHI, execute a Business Associate Agreement before they start. This is a legal requirement, not a best practice',
                    'Define restricted zones — Not every room needs to be accessible to cleaning. Lock records rooms, medication cabinets, and server rooms. Provide access only to the areas that need cleaning',
                    'Implement a clean-desk policy — Require staff to secure PHI before leaving for the night. Flip charts face-down, log out of computers, close file drawers. This is your responsibility, not the cleaner\'s',
                    'Train your cleaning crew — Conduct HIPAA awareness training covering: what PHI looks like, what to do if they see it, and the absolute prohibition on reading, photographing, or discussing patient information',
                    'Ban personal phones in PHI areas — Require cleaning crews to leave personal devices in a designated area when working in patient care zones. XIRI enforces this in all our medical facility protocols',
                    'Audit compliance — Your facility should periodically verify that PHI is properly secured before the cleaning crew arrives, and that the crew follows restricted-zone protocols',
                ],
            },
        ],
        calloutTitle: 'How XIRI Protects Your PHI',
        calloutContent: 'Every XIRI contractor deployed to a medical facility signs a Business Associate Agreement and completes HIPAA awareness training. We enforce a no-personal-phone policy in patient care areas, define restricted zones in every cleaning scope, and our Night Managers verify that PHI is not visible or accessible during their nightly audits.',
        relatedServices: ['medical-office-cleaning', 'surgery-center-cleaning', 'urgent-care-cleaning'],
        faqs: [
            {
                question: 'Does my cleaning company need a Business Associate Agreement?',
                answer: 'If your cleaning vendor has unsupervised access to areas where Protected Health Information is stored, displayed, or reasonably accessible — yes. Under 45 CFR 164.502(e), a BAA is required before they begin work. This includes most after-hours cleaning arrangements in medical offices, dental practices, and behavioral health clinics.',
            },
            {
                question: 'What HIPAA training should cleaning staff receive?',
                answer: 'At minimum: what PHI looks like (patient names, dates of birth, diagnosis codes, prescription labels), what to do if they encounter it (do not read, do not move, report to supervisor), and the consequences of unauthorized access or disclosure. Training should be documented with signed acknowledgments.',
            },
            {
                question: 'Is the practice or the cleaning company liable for a HIPAA breach?',
                answer: 'Both can be liable. The covered entity (your practice) is responsible for executing a BAA and implementing reasonable safeguards. The Business Associate (cleaning vendor) is responsible for training their staff and following the BAA terms. HHS can impose penalties on both parties depending on the nature of the breach.',
            },
            {
                question: 'What should I do if my cleaning crew sees patient information?',
                answer: 'If PHI was visible but not accessed, used, or disclosed — document it as a potential incident, implement corrective action (better clean-desk enforcement or restricted access), and brief the crew. If PHI was read, copied, photographed, or shared, it constitutes a potential breach that must be reported under your HIPAA breach notification procedures.',
            },
        ],
    },

    'nys-part-226-voc-cleaning-compliance': {
        title: 'NYS DEC Part 226 VOC Compliance for Commercial Cleaning',
        heroTitle: 'NYS Part 226: VOC Limits That Affect Every Cleaning Company in New York',
        heroSubtitle: 'New York State regulates volatile organic compounds in cleaning solvents. If your janitorial vendor uses non-compliant products, your facility is at risk.',
        metaDescription: 'Guide to NYS DEC Part 226 VOC compliance for commercial cleaning operations. Learn VOC limits for cleaning solvents, product compliance requirements, and how to avoid violations in New York.',
        datePublished: '2026-03-09',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'What Is NYS DEC Part 226?',
                content: 'New York State Department of Environmental Conservation (DEC) Part 226 establishes limits on Volatile Organic Compounds (VOCs) in consumer and commercial products — including cleaning solvents, degreasers, glass cleaners, and general-purpose cleaners used by janitorial companies. VOCs contribute to ground-level ozone formation, which causes respiratory harm and violates federal Clean Air Act standards. Part 226 sets enforceable VOC content limits (measured as grams of VOC per liter of product) for each product category. Using non-compliant products in New York is a violation regardless of whether the product was purchased out of state.',
            },
            {
                title: 'VOC Limits for Common Cleaning Products',
                content: 'Part 226 specifies maximum VOC content by product category. These are the limits most relevant to commercial cleaning operations:',
                items: [
                    'General Purpose Cleaner — Maximum 0.5% VOC by weight for ready-to-use products',
                    'Glass Cleaner — Maximum 4.0% VOC by weight',
                    'Heavy-Duty Hand Cleaner — Maximum 8.0% VOC by weight',
                    'Bathroom and Tile Cleaner — Maximum 5.0% VOC by weight',
                    'Carpet and Upholstery Cleaner — Maximum 0.1% VOC by weight',
                    'Floor Polish and Finish — Maximum 7.0% VOC by weight for resilient flooring products',
                    'Degreaser (non-aerosol) — Maximum 3.5% VOC by weight',
                ],
            },
            {
                title: 'Why This Matters for Your Facility',
                content: 'Part 226 compliance is the cleaning vendor\'s responsibility — but the consequences affect your facility too. If inspectors find non-compliant products being used in your building, both the vendor and the facility operator can face enforcement action. Beyond regulatory risk, high-VOC cleaning products degrade indoor air quality, which matters especially in healthcare, childcare, laboratory, and food service environments where occupants are vulnerable.',
            },
            {
                title: 'How to Verify Your Cleaning Vendor Is Compliant',
                content: 'Most facility managers never check their cleaning vendor\'s chemical inventory. Here is how to verify compliance without becoming a chemist:',
                items: [
                    'Request the product list — Ask your cleaning vendor for a complete list of every product they use in your facility, including brand names and product numbers',
                    'Check Safety Data Sheets (SDS) — Section 9 of the SDS includes VOC content. Compare against Part 226 limits for the product category',
                    'Look for low-VOC certifications — Products with Green Seal (GS-37 or GS-53), EPA Safer Choice, or UL ECOLOGO certifications typically comply with Part 226 limits',
                    'Require substitution reporting — If your vendor switches products, they should notify you and provide the SDS for the new product before using it',
                    'Include Part 226 compliance in your cleaning contract — Make VOC compliance an explicit contractual requirement, not an assumption',
                ],
            },
            {
                title: 'Special Considerations for Sensitive Environments',
                content: 'Certain facilities have even stricter practical requirements beyond Part 226 minimums:',
                items: [
                    'Laboratories and Cleanrooms — High-VOC solvents can contaminate air quality readings, interfere with sensitive experiments, and compromise cleanroom classifications (ISO 14644-1)',
                    'Medical Offices — Patients with respiratory conditions (asthma, COPD) are disproportionately affected by VOCs. Low-VOC products protect patients and reduce liability',
                    'Daycares and Schools — Children are more susceptible to VOC exposure than adults. Green Seal GS-37 certified products are the practical standard for childcare environments',
                    'Food Service and Manufacturing — VOC residue on food preparation surfaces creates FDA compliance risk in addition to DEC enforcement risk',
                ],
            },
        ],
        calloutTitle: 'How XIRI Handles VOC Compliance',
        calloutContent: 'We maintain a centralized chemical inventory for every facility we manage. Every product is verified against Part 226 limits before deployment, and our contractors are prohibited from substituting products without FSM approval. For sensitive environments — labs, medical offices, and daycares — we default to Green Seal certified, low-VOC products that exceed Part 226 requirements.',
        relatedServices: ['commercial-cleaning', 'janitorial-services', 'medical-office-cleaning', 'daycare-cleaning'],
        faqs: [
            {
                question: 'Does NYS Part 226 apply to cleaning companies?',
                answer: 'Yes. Part 226 applies to any commercial product sold, offered for sale, or used in New York that falls within its regulated categories — including general-purpose cleaners, glass cleaners, degreasers, floor polishes, and carpet cleaners. If your cleaning vendor uses these products in your New York facility, the products must comply with Part 226 VOC limits.',
            },
            {
                question: 'What happens if non-compliant cleaning products are used in my building?',
                answer: 'The NYS DEC can issue notices of violation, require corrective action, and impose civil penalties. While the primary obligation falls on the product distributor and user (your cleaning vendor), facility operators can also face scrutiny during environmental inspections — especially in healthcare and laboratory settings where air quality is regulated.',
            },
            {
                question: 'How do I know if a cleaning product complies with Part 226?',
                answer: 'Check the product\'s Safety Data Sheet (SDS), Section 9, for VOC content in grams per liter or percentage by weight. Compare against the Part 226 limit for that product category. Products with Green Seal GS-37, GS-53, or EPA Safer Choice certifications generally comply with Part 226 limits.',
            },
            {
                question: 'Are "green" cleaning products automatically Part 226 compliant?',
                answer: 'Not necessarily. "Green" and "eco-friendly" are marketing terms with no regulatory definition. A product can be marketed as green and still exceed Part 226 VOC limits. Always verify with the SDS or look for specific certifications (Green Seal, EPA Safer Choice, UL ECOLOGO) that have enforceable VOC standards.',
            },
        ],
    },

    'cms-conditions-for-coverage-cleaning': {
        title: 'CMS Conditions for Coverage: Cleaning Requirements for Dialysis Centers',
        heroTitle: 'CMS Conditions for Coverage: What Your Dialysis Center Cleaning Program Must Include',
        heroSubtitle: 'CMS ties your Medicare reimbursement to infection control — and your environmental cleaning program is the first thing surveyors evaluate. Here is what your cleaning vendor needs to know.',
        metaDescription: 'Complete guide to CMS Conditions for Coverage cleaning requirements for dialysis and ESRD facilities. Learn infection control mandates, station turnover protocols, and documentation standards.',
        datePublished: '2026-03-09',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'What Are CMS Conditions for Coverage?',
                content: 'The Centers for Medicare & Medicaid Services (CMS) publishes Conditions for Coverage (CoC) that every End-Stage Renal Disease (ESRD) facility must meet to participate in the Medicare program — which represents the majority of dialysis center revenue. Under 42 CFR Part 494 (specifically §494.30), ESRD facilities must maintain an active infection control program that includes environmental cleaning as a core component. Failure to meet CMS CoC during a state survey can result in termination from the Medicare program — effectively closing the facility.',
            },
            {
                title: 'Why Environmental Cleaning Is the First Line of Defense',
                content: 'Dialysis patients are among the most infection-vulnerable populations in outpatient healthcare. They undergo repeated vascular access procedures, often have compromised immune systems, and spend 3–4 hours per session in close proximity to other patients. Bloodborne pathogen exposure is not theoretical — it is a routine operational reality. The CDC reports that dialysis patients are at significantly elevated risk for hepatitis B (HBV) and hepatitis C (HCV) compared to the general population. Your environmental cleaning program is the primary barrier between a routine treatment session and a reportable infection control event.',
            },
            {
                title: 'CMS Cleaning Requirements for Dialysis Facilities',
                content: 'Under 42 CFR §494.30 and the CMS ESRD Interpretive Guidance, these environmental cleaning requirements are mandatory:',
                items: [
                    'Station Turnover Cleaning — Every dialysis station must be cleaned and disinfected between patients. All external surfaces of the dialysis machine, the chair or bed, side tables, and any shared equipment must be wiped with an EPA-registered intermediate-level disinfectant with documented dwell time',
                    'Terminal Cleaning — End-of-day deep cleaning of the entire treatment area including floors, walls (splash zones), sinks, restrooms, and common areas',
                    'Isolation Room Protocols — Facilities must have a dedicated isolation area for HBV-positive patients. This area requires separate cleaning equipment (mops, buckets, cloths) that is never used in the general treatment area',
                    'Spill Response — Immediate cleanup of blood spills using EPA-registered disinfectant with appropriate dwell time. All cleaning staff must be trained in OSHA BBP protocols (29 CFR 1910.1030)',
                    'Water Treatment Area — The water treatment room requires separate cleaning protocols to prevent contamination of the reverse osmosis system and dialysate preparation',
                ],
            },
            {
                title: 'What CMS Surveyors Look for in Your Cleaning Program',
                content: 'State survey agencies conduct recertification surveys on behalf of CMS every 9–15 months. During the environmental cleaning portion, surveyors evaluate:',
                items: [
                    'Direct observation of station turnover cleaning — they will watch your crew clean between patients and verify proper disinfectant use and dwell time',
                    'Written infection control policies that specifically address environmental cleaning procedures, frequencies, and products',
                    'Training documentation showing cleaning staff completed initial and annual infection control training',
                    'Logs demonstrating consistent daily cleaning with dates, times, staff identification, and areas cleaned',
                    'Evidence that isolation area cleaning equipment is separated from general equipment — labeled, color-coded, or stored separately',
                    'Water treatment area cleaning logs maintained separately from general facility cleaning documentation',
                ],
            },
            {
                title: 'Building a CMS-Compliant Cleaning Program',
                content: 'Most dialysis centers outsource environmental cleaning but remain directly responsible for CMS compliance. Here is the framework:',
                items: [
                    'Write a cleaning-specific infection control policy — generic "we follow manufacturer instructions" language will not pass a CMS survey. Specify products, dwell times, and procedures by area',
                    'Separate station turnover from terminal cleaning — these are two distinct processes with different scopes, frequencies, and documentation requirements',
                    'Color-code isolation equipment — use a dedicated color (typically red) for all mops, buckets, and cloths used in HBV isolation areas',
                    'Document everything digitally — CMS surveyors ask for 30+ days of cleaning logs. Paper logs get lost. Digital systems with timestamps and staff IDs satisfy surveyor expectations',
                    'Train cleaning staff on your specific dialysis environment — generic janitorial training is not sufficient. Staff need to understand station layout, machine external surfaces, waste handling, and isolation protocols specific to your facility',
                ],
            },
        ],
        calloutTitle: 'How XIRI Protects Your CMS Compliance',
        calloutContent: 'Our contractors deployed to dialysis facilities receive facility-specific infection control training before their first shift. We maintain digital cleaning logs with timestamps and staff IDs, enforce color-coded isolation cleaning equipment, and our Night Managers verify station turnover and terminal cleaning compliance nightly. Your FSM can generate a survey-ready compliance report on demand.',
        relatedServices: ['medical-office-cleaning', 'disinfecting-services', 'commercial-cleaning'],
        faqs: [
            {
                question: 'Can a dialysis center lose CMS certification for cleaning issues?',
                answer: 'Yes. Environmental cleaning falls under 42 CFR §494.30 (Infection Control). A deficiency in this area can result in a Condition-level citation, which triggers a Plan of Correction. If the facility fails to correct the deficiency, CMS can terminate the facility\'s Medicare provider agreement — which ends Medicare reimbursement and effectively closes most dialysis centers.',
            },
            {
                question: 'How often are dialysis facilities surveyed by CMS?',
                answer: 'State survey agencies conduct recertification surveys every 9 to 15 months on behalf of CMS. Surveys are unannounced. Additionally, CMS can initiate a complaint-based survey at any time if a patient, employee, or other party files a complaint about infection control practices.',
            },
            {
                question: 'Does XIRI handle station turnover cleaning between patient shifts?',
                answer: 'Yes. We provide split-shift and day porter services specifically designed for dialysis center workflows. Our contractors handle station turnover cleaning between patient shifts using EPA-registered intermediate-level disinfectants with documented dwell times, and terminal cleaning after the final patient shift of the day.',
            },
            {
                question: 'What is the difference between station turnover and terminal cleaning?',
                answer: 'Station turnover cleaning occurs between patients during the operating day — it covers the dialysis machine exterior, chair, table, and immediate area. Terminal cleaning occurs after the last patient session and covers the entire treatment area including floors, walls, sinks, restrooms, and common spaces. Both are required under CMS CoC.',
            },
        ],
    },

    'aaahc-surgery-center-cleaning-standards': {
        title: 'AAAHC Cleaning Standards for Ambulatory Surgery Centers',
        heroTitle: 'AAAHC Accreditation: Environmental Cleaning Standards for Surgery Centers',
        heroSubtitle: 'Your AAAHC accreditation depends on demonstrable environmental cleaning quality. Surveyors observe your process, question your staff, and review your documentation. Here is what passes — and what does not.',
        metaDescription: 'Guide to AAAHC cleaning standards for ambulatory surgery centers. Learn environmental cleaning requirements, terminal cleaning protocols, and how to prepare for AAAHC accreditation surveys.',
        datePublished: '2026-03-09',
        dateModified: '2026-03-09',
        sections: [
            {
                title: 'What Is AAAHC Accreditation?',
                content: 'The Accreditation Association for Ambulatory Health Care (AAAHC) accredits over 6,100 ambulatory surgery centers (ASCs), office-based surgery facilities, and outpatient care organizations across the United States. AAAHC accreditation is often required by state licensing boards and insurance payers as a condition of operating. Unlike CMS surveys that are government-mandated, AAAHC is a voluntary accreditation — but losing it can mean losing payer contracts and, in some states, your license to operate.',
            },
            {
                title: 'How AAAHC Evaluates Environmental Cleaning',
                content: 'AAAHC evaluates environmental cleaning under Chapter 7 (Facilities and Environment) and Chapter 9 (Infection Prevention and Control/Safety) of its accreditation standards. The evaluation is weighted heavily toward direct observation and staff competency:',
                items: [
                    'Direct Observation — Surveyors watch your cleaning process in real-time. They observe operating room turnover cleaning, instrument processing, and terminal cleaning procedures. Technique matters, not just documentation',
                    'Staff Interviews — Surveyors ask cleaning staff to explain their protocols. Can your crew describe proper disinfectant dwell times? Do they know the difference between cleaning, disinfection, and sterilization?',
                    'Policy Review — Written environmental cleaning policies must align with actual practice. If your policy says you use ATP testing but you do not have an ATP monitor, that is a deficiency',
                    'Infection Control Integration — Cleaning must be integrated into your overall infection prevention program with documented oversight by your Infection Control Officer',
                ],
            },
            {
                title: 'Terminal Cleaning Requirements for Operating Rooms',
                content: 'Terminal cleaning of operating rooms is the single most scrutinized cleaning process in an AAAHC survey. For ASCs, terminal cleaning follows AORN (Association of periOperative Registered Nurses) guidelines:',
                items: [
                    'All horizontal surfaces cleaned and disinfected — surgical tables, instrument stands, Mayo stands, anesthesia equipment, overhead lights and tracks',
                    'Floors wet-mopped with EPA-registered hospital-grade disinfectant — working from cleanest to dirtiest areas, from far wall toward the door',
                    'Walls spot-cleaned for visible contamination — full wall washing per facility protocol (typically weekly or monthly, not after every case)',
                    'Waste and linen removed before surface disinfection begins',
                    'Adequate dwell time documented — the disinfectant must remain wet on surfaces for the manufacturer-specified contact time. Wiping too soon renders it ineffective',
                    'Room verified before next case — visual inspection by circulating nurse or designated staff member before the next patient enters',
                ],
            },
            {
                title: 'Common AAAHC Survey Deficiencies in Environmental Cleaning',
                content: 'Based on AAAHC survey trends, these environmental cleaning issues are cited most frequently:',
                items: [
                    'Insufficient dwell time — Staff wipe surfaces before the disinfectant has fully acted. This is the number one observed deficiency',
                    'No documented terminal cleaning schedule — Surveyors ask for cleaning logs. If you cannot show who cleaned the OR, when, and with what product, it is a deficiency',
                    'Staff cannot articulate protocols — When asked, cleaning staff should be able to describe their process without referring to a manual. Verbal competency is expected',
                    'Cleaning products not appropriate for surgical environments — Standard commercial cleaners do not meet the requirements for OR environments. Products must be EPA-registered, healthcare-grade, and effective against surgical site infection pathogens',
                    'No integration with infection control — Cleaning exists in isolation from the facility\'s infection prevention program, with no formal oversight or reporting structure',
                ],
            },
            {
                title: 'How to Prepare for Your AAAHC Environmental Survey',
                content: 'AAAHC surveys occur every 3 years (initial) or annually (in some cases). Preparation should be continuous, not cramped into the weeks before a survey:',
                items: [
                    'Conduct monthly internal audits — Walk the facility with your infection control officer and evaluate cleaning quality using the same criteria AAAHC surveyors use',
                    'Train for verbal competency — Quiz cleaning staff periodically. They should explain dwell times, product selection, and the terminal cleaning sequence without hesitation',
                    'Maintain 12 months of cleaning logs — Digital logs with timestamps, staff names, products used, and areas cleaned. Surveyors may ask for any date range',
                    'Align policies with practice — Review your written cleaning policies quarterly. Update them when you change products, procedures, or staffing models',
                    'Practice live observation — Have your infection control officer observe terminal cleaning as if they were a surveyor. Identify and correct technique issues before the real survey',
                ],
            },
        ],
        calloutTitle: 'How XIRI Keeps Your ASC Accreditation-Ready',
        calloutContent: 'Our Night Managers audit terminal cleaning in every ASC we service — verifying dwell times, technique, and product usage with photographic documentation. We train our contractors on AORN-based OR cleaning protocols and conduct verbal competency checks quarterly. When your AAAHC surveyor walks in, your cleaning documentation is already digital, current, and accessible.',
        relatedServices: ['surgery-center-cleaning', 'medical-office-cleaning', 'disinfecting-services'],
        faqs: [
            {
                question: 'What cleaning standards does AAAHC require for surgery centers?',
                answer: 'AAAHC evaluates environmental cleaning under Chapter 7 (Facilities and Environment) and Chapter 9 (Infection Prevention and Control). Surgery centers must demonstrate terminal cleaning protocols aligned with AORN guidelines, documented cleaning schedules, trained staff who can articulate their protocols, and integration with the facility\'s infection prevention program.',
            },
            {
                question: 'Do AAAHC surveyors watch cleaning in real-time?',
                answer: 'Yes. Unlike some accrediting bodies that focus primarily on documentation, AAAHC surveyors conduct direct observation of cleaning processes during their survey. They watch operating room turnover, interview cleaning staff, and evaluate whether actual practice matches written policies.',
            },
            {
                question: 'What is the most common cleaning deficiency in AAAHC surveys?',
                answer: 'Insufficient disinfectant dwell time. Staff commonly wipe surfaces before the disinfectant has had enough contact time to be effective. AAAHC surveyors specifically watch for this. The fix: train crews on manufacturer-specified dwell times and audit compliance during internal quality checks.',
            },
            {
                question: 'Can we use our existing commercial cleaner in the OR?',
                answer: 'In most cases, no. Operating rooms require EPA-registered, hospital-grade disinfectants effective against surgical site infection pathogens (including MRSA, VRE, and C. diff). Standard commercial cleaners do not meet these requirements. Your cleaning vendor should use products from the EPA List H (hospital/healthcare disinfectants) or equivalent.',
            },
        ],
    },
};

// ─── REGULATION × LOCATION pSEO ────────────────────────────────────

/** Guide slugs eligible for Regulation × Location pages */
export const REGULATION_GUIDE_SLUGS = [
    'osha-bloodborne-pathogen-cleaning-standard',
    'hipaa-environmental-compliance-cleaning',
    'nys-part-226-voc-cleaning-compliance',
    'cms-conditions-for-coverage-cleaning',
    'aaahc-surgery-center-cleaning-standards',
] as const;

/** County-specific compliance context for location pages */
export const COUNTY_COMPLIANCE: Record<string, {
    enforcementNote: string;
    facilityDensity: string;
    keyFact: string;
}> = {
    'Nassau': {
        enforcementNote: 'Nassau County has one of the highest concentrations of medical offices and ambulatory surgery centers on Long Island, making it a frequent target for OSHA, CMS, and AAAHC compliance surveys.',
        facilityDensity: '500+ medical facilities',
        keyFact: 'Nassau County DOH conducts joint inspection programs with NYS, increasing the likelihood of multi-agency compliance reviews.',
    },
    'Queens': {
        enforcementNote: 'Queens has the most diverse healthcare landscape in New York City, with high-volume urgent care centers, dialysis clinics, and community health centers concentrated along Queens Boulevard and Northern Boulevard corridors.',
        facilityDensity: '800+ medical facilities',
        keyFact: 'NYC DOHMH oversees additional cleaning and sanitation requirements beyond state-level mandates for facilities in Queens.',
    },
    'Suffolk': {
        enforcementNote: 'Suffolk County\'s suburban footprint includes standalone surgery centers, large medical office parks, and growing dialysis networks — all subject to federal and state environmental cleaning requirements.',
        facilityDensity: '400+ medical facilities',
        keyFact: 'Suffolk County has seen a 15% increase in ambulatory surgery center openings since 2022, driving demand for AAAHC-compliant cleaning programs.',
    },
};

/** Regulation-specific local FAQ generators */
export function getRegulationLocalFaqs(
    guideSlug: string,
    city: string,
    county: string,
): { question: string; answer: string }[] {
    const base: { question: string; answer: string }[] = [
        {
            question: `Does XIRI provide compliant cleaning services in ${city}?`,
            answer: `Yes. XIRI deploys trained, insured contractors to facilities in ${city} and throughout ${county} County. Every contractor completes regulation-specific training before their first shift, and our Night Managers conduct nightly compliance audits.`,
        },
    ];

    switch (guideSlug) {
        case 'osha-bloodborne-pathogen-cleaning-standard':
            return [
                {
                    question: `Who enforces OSHA Bloodborne Pathogen standards in ${county} County?`,
                    answer: `In New York, OSHA enforcement is handled by the federal OSHA Area Office (for private sector employers) and PESH (Public Employee Safety and Health) for public facilities. The nearest OSHA office serving ${county} County is the Long Island Area Office in Westbury, NY.`,
                },
                ...base,
            ];
        case 'hipaa-environmental-compliance-cleaning':
            return [
                {
                    question: `Are cleaning companies in ${city} required to sign a HIPAA BAA?`,
                    answer: `If the cleaning company has unsupervised access to areas where PHI is stored or visible — which describes most after-hours cleaning arrangements in ${city} medical offices — then yes, a Business Associate Agreement is required under 45 CFR 164.502(e).`,
                },
                ...base,
            ];
        case 'nys-part-226-voc-cleaning-compliance':
            return [
                {
                    question: `Does NYS Part 226 apply to cleaning companies in ${county} County?`,
                    answer: `Yes. Part 226 applies to any commercial cleaning product used anywhere in New York State, including ${county} County. The NYS DEC can enforce VOC limits on both the product distributor and the end user (your cleaning vendor).`,
                },
                ...base,
            ];
        case 'cms-conditions-for-coverage-cleaning':
            return [
                {
                    question: `How often are dialysis centers in ${county} County surveyed by CMS?`,
                    answer: `CMS recertification surveys occur every 9 to 15 months and are unannounced. The New York State DOH conducts these surveys on behalf of CMS. Dialysis centers in ${county} County follow the same schedule as all ESRD facilities in New York.`,
                },
                ...base,
            ];
        case 'aaahc-surgery-center-cleaning-standards':
            return [
                {
                    question: `Are surgery centers in ${city} required to have AAAHC accreditation?`,
                    answer: `AAAHC accreditation is voluntary but effectively required for most surgery centers in ${city} — insurance payers and state licensing boards increasingly require accreditation as a condition of doing business. Losing AAAHC accreditation can mean losing payer contracts.`,
                },
                ...base,
            ];
        default:
            return base;
    }
}
