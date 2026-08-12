import { RfpInput } from '@xiri-facility-solutions/shared';

export interface FacilityRfpPreset {
    slug: string;
    name: string;
    category: string;
    title: string;
    metaDescription: string;
    heroSubtitle: string;
    badgeText: string;
    inputDefaults: RfpInput;
    whyRfpMatters: string;
    keyComplianceStandards: { item: string; standard: string }[];
    sampleRequirements: string[];
    faqs: { question: string; answer: string }[];
}

export const FACILITY_RFP_PRESETS: Record<string, FacilityRfpPreset> = {
    'public-libraries': {
        slug: 'public-libraries',
        name: 'Public Libraries & Community Centers',
        category: 'Civic & Education',
        title: 'Public Library & Community Center Janitorial RFP Template',
        metaDescription: 'Download and customize a public library janitorial RFP standard. Engineered for book stack dust control, carpet extraction, non-toxic children section sanitization, and quiet-hours service.',
        heroSubtitle: 'Free RFP template & specification scope for library trustees, municipal directors, and public facility managers. Customized for public stack maintenance and board-compliant auditing.',
        badgeText: 'Municipal & Civic Standard',
        inputDefaults: {
            facilityName: 'Great Neck Library System / Community Center',
            facilityType: 'Public Library / Civic Center',
            location: 'Nassau County / Queens, NY',
            estimatedSqft: 25000,
            cleaningFrequency: 'weekdays',
            serviceWindow: '7pm-6am',
            requiredServices: [
                'Book stack & shelving high dusting (HEPA-filtered)',
                'Non-toxic children section sanitization',
                'High-traffic carpet vacuuming & extraction',
                'Public restroom deep cleaning & hourly logs',
                'Computer lab screen & keyboard wipe-down',
            ],
            complianceRequirements: [
                '$1M General Liability & Workers Comp COI',
                'NYS Green Seal-certified eco-cleaning products',
                'Public employee background checks (DCJS/FBI)',
                'SDS binder on-site and digitally accessible',
            ],
            slaRequirements: [
                'Missed shift notification by 8pm same night',
                'Emergency spill/leak response under 90 minutes',
                'Monthly physical QA audit score report for Board',
            ],
            transitionDate: '30 days from award',
            incumbentPainPoints: [
                'Dust accumulation on high book stacks',
                'Inconsistent restroom sanitization during peak hours',
                'No digital proof-of-cleaning logs for library board',
            ],
        },
        whyRfpMatters: 'Public libraries and community centers host hundreds of daily visitors across book stacks, children sections, meeting rooms, and computer labs. Standard office cleaning fails to address stack dust control, non-toxic chemical requirements, and public board accountability.',
        keyComplianceStandards: [
            { item: 'HEPA-filtered stack dust control', standard: 'Indoor Air Quality (IAQ) Standards' },
            { item: 'Green Seal GS-37 Certified Cleaning Chemicals', standard: 'NYS Executive Order 4 / NYS DEC' },
            { item: 'Background Vetting for Public Facilities', standard: 'DCJS Public Safety Standards' },
            { item: 'Public Restroom Sanitation Logs', standard: 'NYS DOH Public Health Code' },
        ],
        sampleRequirements: [
            'Nightly HEPA vacuuming of public reading areas and stack aisles',
            'Weekly low-moisture sanitization of children section play areas and furniture',
            'Quarterly hot-water carpet extraction for high-footfall corridors',
            'Digital timestamped proof-of-performance reports accessible by Library Operations Director',
        ],
        faqs: [
            {
                question: 'Can this RFP template be used for municipal library board bidding?',
                answer: 'Yes. This template is structured to comply with municipal public bidding guidelines, including clear scope definitions, insurance requirements, and verifiable SLA metrics.',
            },
            {
                question: 'Does XIRI provide green cleaning products required for public buildings?',
                answer: 'Yes. All cleaning products used in library and civic facility contracts meet Green Seal (GS-37/GS-40) standards and comply with NYS Executive Order 4.',
            },
        ],
    },
    'funeral-homes': {
        slug: 'funeral-homes',
        name: 'Funeral Homes & Mortuaries',
        category: 'Specialized & Death Care',
        title: 'Funeral Home & Mortuary Janitorial RFP Standard Template',
        metaDescription: 'Customizable janitorial RFP template for funeral home directors. Engineered for embalming prep suite OSHA 1910.1030 compliance, viewing room carpet care, and flexible visitation schedules.',
        heroSubtitle: 'Discreet, high-compliance janitorial scope specification for funeral home directors and mortuary operations managers. Includes OSHA Bloodborne Pathogen standards and flexible schedule locks.',
        badgeText: 'OSHA 1910.1030 Compliant',
        inputDefaults: {
            facilityName: 'Grace Memorial Funeral Home & Chapel',
            facilityType: 'Funeral Home / Mortuary',
            location: 'Nassau County, NY',
            estimatedSqft: 12000,
            cleaningFrequency: 'weekdays',
            serviceWindow: '9pm-6am',
            requiredServices: [
                'Embalming prep room floor & surface sanitization',
                'Viewing chapel carpet vacuuming & chair care',
                'Family lounge & refreshment room sanitation',
                'Restroom sanitization & odor control',
                'Entryway & foyer floor buffing',
            ],
            complianceRequirements: [
                'OSHA Bloodborne Pathogen Standard (29 CFR 1910.1030)',
                'EPA List N disinfectant usage & contact time log',
                '$1M General Liability & Workers Comp COI',
                'Discreet, uniform-clad background-checked crews',
            ],
            slaRequirements: [
                'Flexible scheduling around evening visitation services',
                'Sub-2 hour emergency spill response before public viewings',
                'Nightly shift completion verification',
            ],
            transitionDate: '14 days from award',
            incumbentPainPoints: [
                'Cleaners arriving during private family visitations',
                'Inadequate sanitation in preparation areas',
                'Lingering odors in chapel and reception space',
            ],
        },
        whyRfpMatters: 'Funeral homes demand an exceptional degree of sensitivity, schedule flexibility, and strict biohazard compliance. Preparation suites require OSHA Bloodborne Pathogen-trained crews, while public chapels require spotless presentation before morning services.',
        keyComplianceStandards: [
            { item: 'Bloodborne Pathogen Exposure Control', standard: 'OSHA 29 CFR 1910.1030' },
            { item: 'Preparation Suite Disinfection', standard: 'EPA List N Hospital-Grade Disinfectants' },
            { item: 'Chemical SDS Accessibility', standard: 'OSHA Hazard Communication Standard' },
            { item: 'Discreet Operations Protocol', standard: 'XIRI Funeral Services Charter' },
        ],
        sampleRequirements: [
            'Nightly terminal-grade sanitization of preparation suite surfaces and floors',
            'Carpet grooming and spot cleaning in main chapels prior to scheduled services',
            'Automatic schedule pause/shift flexibility during extended evening wakes',
            'Digital supervisor walkthrough logs archived for health department review',
        ],
        faqs: [
            {
                question: 'How do you handle cleaning around unpredictable visitation hours?',
                answer: 'Our operations team coordinates directly with your funeral director weekly. Cleaning windows are dynamically adjusted so crews never interfere with family services or private viewings.',
            },
            {
                question: 'Are cleaning crews trained in bloodborne pathogen protocols?',
                answer: 'Yes. All personnel assigned to funeral home facilities complete OSHA 29 CFR 1910.1030 Bloodborne Pathogens training and wear mandatory PPE when servicing preparation suites.',
            },
        ],
    },
    'dental-offices': {
        slug: 'dental-offices',
        name: 'Dental Practices & Clinical Suites',
        category: 'Healthcare & Clinical',
        title: 'Dental Practice Facility Janitorial RFP Template',
        metaDescription: 'B2B janitorial RFP template for dental office managers. Operatory surface disinfection, sterilization area protocols, amalgam effluent compliance, and zero consumer terminology confusion.',
        heroSubtitle: 'Download and customize a compliance-grade janitorial RFP scope for dental practices. Built for CDC dental infection control guidelines, operatory disinfection, and state board audit readiness.',
        badgeText: 'CDC & OSHA Healthcare Standard',
        inputDefaults: {
            facilityName: 'Dental Care Associates',
            facilityType: 'Dental Practice Suite',
            location: 'Queens / Nassau County, NY',
            estimatedSqft: 4500,
            cleaningFrequency: 'weekdays',
            serviceWindow: '7pm-5am',
            requiredServices: [
                'Operatory non-clinical contact surface disinfection',
                'Sterilization area floor & counter deep clean',
                'Waiting room high-touch surface sanitization',
                'Sharps container perimeter inspection & clearance',
                'Restroom disinfection & ATP audit verification',
            ],
            complianceRequirements: [
                'OSHA Bloodborne Pathogen Standard (29 CFR 1910.1030)',
                'CDC Guidelines for Infection Control in Dental Health-Care Settings',
                'EPA Dental Effluent Guideline awareness (Amalgam waste)',
                'HIPAA Business Associate Agreement (BAA) executed',
            ],
            slaRequirements: [
                'Zero cross-contamination protocol (color-coded microfiber)',
                'Nightly digital inspection report with timestamped photos',
                'Rapid issue escalation under 2 hours',
            ],
            transitionDate: '14 days from award',
            incumbentPainPoints: [
                'General office cleaners using same mops in waiting room and operatory',
                'Failure to understand dental aerosol residue build-up',
                'No verifiable compliance documentation for state dental board audits',
            ],
        },
        whyRfpMatters: 'Dental practices generate aerosols, amalgam waste, and clinical contact hazards. Standard commercial janitorial vendors lack the training required to clean clinical suites safely without cross-contaminating operatory and reception spaces.',
        keyComplianceStandards: [
            { item: 'Dental Infection Control Guidelines', standard: 'CDC Guidelines for Dental Health-Care Settings' },
            { item: 'Bloodborne Pathogens Standard', standard: 'OSHA 29 CFR 1910.1030' },
            { item: 'Amalgam Effluent Waste Segregation', standard: 'EPA 40 CFR Part 441' },
            { item: 'HIPAA Environmental Privacy', standard: '45 CFR 164.502(e)' },
        ],
        sampleRequirements: [
            'Exclusive use of EPA-registered List N intermediate-level disinfectants in all operatory suites',
            'Strict color-coded microfiber system separating operatory, restroom, and waiting room tools',
            'Nightly verification log filed digitally and accessible for state dental board inspections',
        ],
        faqs: [
            {
                question: 'Does XIRI sign a HIPAA Business Associate Agreement (BAA)?',
                answer: 'Yes. Because our after-hours crews work in clinical environments where patient records or screens may be present, XIRI executes a standard HIPAA BAA with all dental practices.',
            },
            {
                question: 'How do you prevent operatory cross-contamination?',
                answer: 'We enforce a four-color microfiber protocol (Red = Restroom, Yellow = Operatory, Blue = Glass/General, Green = Waiting Room) and disposable mop head systems.',
            },
        ],
    },
    'chiropractic-clinics': {
        slug: 'chiropractic-clinics',
        name: 'Chiropractic & Wellness Clinics',
        category: 'Healthcare & Outpatient',
        title: 'Chiropractic Clinic & Wellness Center Janitorial RFP Template',
        metaDescription: 'Janitorial RFP standard for chiropractic practices and wellness suites. Designed for high patient-turnover adjustment table sanitization, non-toxic floor care, and HIPAA privacy compliance.',
        heroSubtitle: 'Professional janitorial scope builder for chiropractic directors and wellness clinic managers. Specialized for high-touch adjustment tables, rehab zones, and patient comfort.',
        badgeText: 'Outpatient Care Standard',
        inputDefaults: {
            facilityName: 'Spine & Wellness Center',
            facilityType: 'Chiropractic Clinic',
            location: 'Garden City / Melville, NY',
            estimatedSqft: 3500,
            cleaningFrequency: '3x_week',
            serviceWindow: '6pm-10pm',
            requiredServices: [
                'Adjustment table vinyl surface safe sanitization',
                'Therapy room floor mopping & allergen control',
                'Reception & waiting room seating sanitization',
                'Restroom disinfection & restock',
                'High-touch door handle & counter wipe-down',
            ],
            complianceRequirements: [
                '$1M General Liability & Workers Comp COI',
                'HIPAA privacy compliance training',
                'Non-corrosive, vinyl-safe EPA disinfectant',
                'SDS binder on-site',
            ],
            slaRequirements: [
                'Non-damaging vinyl cleaner certification',
                'Next-day issue resolution guarantee',
            ],
            transitionDate: '7 days from award',
            incumbentPainPoints: [
                'Harsh chemicals degrading expensive leather/vinyl adjustment tables',
                'Strong chemical smells lingering during morning patient hours',
                'Inconsistent floor cleaning in therapy exercise areas',
            ],
        },
        whyRfpMatters: 'Chiropractic clinics feature high patient volume interacting directly with adjustment tables, vinyl cushions, and therapy equipment. Cleaning crews must use non-damaging, vinyl-safe disinfectants that eliminate pathogens without destroying practice equipment.',
        keyComplianceStandards: [
            { item: 'Vinyl & Leather Surface Safe Disinfection', standard: 'Manufacturer Material Compatibility' },
            { item: 'HIPAA Environmental Privacy', standard: '45 CFR 164.502(e)' },
            { item: 'Indoor Air Quality & Low VOCs', standard: 'NYS Part 226 VOC Standards' },
        ],
        sampleRequirements: [
            'Use of neutral pH EPA-registered disinfectants compatible with vinyl treatment tables',
            'HEPA filtration vacuuming in all treatment and waiting zones to reduce indoor allergens',
            'Digital shift audit log delivered after every scheduled clean',
        ],
        faqs: [
            {
                question: 'Will your cleaning products damage leather or vinyl adjustment tables?',
                answer: 'No. We specify non-alcohol, neutral pH disinfectants recommended by leading chiropractic table manufacturers to preserve vinyl integrity while achieving 99.99% pathogen reduction.',
            },
        ],
    },
    'physical-therapy': {
        slug: 'physical-therapy',
        name: 'Physical Therapy & Sports Rehab Facilities',
        category: 'Healthcare & Rehab',
        title: 'Physical Therapy & Sports Rehab Facility Janitorial RFP Standard',
        metaDescription: 'Download a physical therapy janitorial RFP scope template. Built for rehab equipment surface disinfection, turf/mat hygiene, non-slip floor safety, and hydrotherapy area moisture control.',
        heroSubtitle: 'RFP scope builder for physical therapy clinic directors and rehab operations leads. Engineered for high-touch athletic turf, treatment mats, and patient infection control.',
        badgeText: 'Rehab & Sports Med Standard',
        inputDefaults: {
            facilityName: 'Apex Physical Therapy & Sports Rehab',
            facilityType: 'Physical Therapy Facility',
            location: 'Syosset / Rockville Centre, NY',
            estimatedSqft: 6000,
            cleaningFrequency: 'weekdays',
            serviceWindow: '7pm-11pm',
            requiredServices: [
                'Rehab equipment & weight machine wipe-down',
                'Synthetic turf & rubber mat deep vacuuming & sanitization',
                'Treatment table vinyl sanitization',
                'Hydrotherapy area mold & moisture remediation',
                'Non-slip hard floor scrub & sanitization',
            ],
            complianceRequirements: [
                'OSHA Bloodborne Pathogen Standard',
                'EPA-registered hospital-grade disinfectant',
                '$1M General Liability & Workers Comp COI',
                'Non-slip floor safety compliance (ASTM D2047)',
            ],
            slaRequirements: [
                'Zero slick residue on treatment room floors',
                'Nightly proof-of-performance photos',
            ],
            transitionDate: '14 days from award',
            incumbentPainPoints: [
                'Sweat buildup on mats and turf causing odors',
                'Slippery floor finishes creating fall hazards for rehab patients',
                'Grout discoloration in hydrotherapy areas',
            ],
        },
        whyRfpMatters: 'Physical therapy facilities host patients recovering from injuries and surgeries alongside active rehab exercises. Floors must maintain high slip resistance, and exercise equipment requires daily sanitization to prevent bacterial spread.',
        keyComplianceStandards: [
            { item: 'Static Coefficient of Friction (Non-slip floors)', standard: 'ASTM D2047 / OSHA Floor Safety' },
            { item: 'Bloodborne Pathogens & Body Fluid Cleanup', standard: 'OSHA 29 CFR 1910.1030' },
            { item: 'Synthetic Turf & Rubber Mat Sanitization', standard: 'ISSA Sports Facility Guidelines' },
        ],
        sampleRequirements: [
            'Daily anti-fungal mopping and surface disinfection in hydrotherapy and wet rooms',
            'Extraction and antimicrobial treatment of synthetic turf and rubber gym flooring 2x/week',
            'Verification of slip-resistant floor finish application to prevent patient fall risks',
        ],
        faqs: [
            {
                question: 'How do you sanitize synthetic turf and rubber matting in rehab clinics?',
                answer: 'We utilize low-moisture antimicrobial extraction systems designed specifically for athletic turf and rubberized flooring to lift sweat, skin oils, and bacteria without oversaturating the backing.',
            },
        ],
    },
    'fitness-gyms': {
        slug: 'fitness-gyms',
        name: 'Gyms & Health Clubs',
        category: 'Commercial & Wellness',
        title: 'Gym & Health Club Janitorial RFP Template & Scope Builder',
        metaDescription: 'Customizable RFP template for gym owners and health club managers. Locker room deep sanitization, sauna/steam room hygiene, cardio equipment wipe-downs, and sweat odor control.',
        heroSubtitle: 'RFP specification generator for gym owners, health club general managers, and fitness directors. High-capacity locker room sanitization and equipment hygiene.',
        badgeText: 'Health Club Deep Clean Standard',
        inputDefaults: {
            facilityName: 'Titan Fitness & Athletic Club',
            facilityType: 'Gym / Health Club',
            location: 'Astoria / Long Island City, NY',
            estimatedSqft: 18000,
            cleaningFrequency: 'daily',
            serviceWindow: '11pm-4am',
            requiredServices: [
                'Cardio & strength equipment frame & touchpoint sanitization',
                'Locker room tile scrub, shower descaling & disinfection',
                'Sauna & steam room wood sanitization & mold prevention',
                'Studio hardwood & rubber floor scrubbing',
                'Continuous drain bio-treatment & odor elimination',
            ],
            complianceRequirements: [
                'EPA-registered virucidal & fungicidal disinfectants',
                'OSHA Hazard Communication compliance',
                '$1M General Liability Insurance',
            ],
            slaRequirements: [
                'Locker room inspection readiness by 5:00 AM daily',
                'Sub-2 hour emergency spill response',
            ],
            transitionDate: '14 days from award',
            incumbentPainPoints: [
                'Persistent locker room and shower drain odors',
                'Soap scum and hard water scale buildup in showers',
                'Members complaining about dirty cardio touchscreens',
            ],
        },
        whyRfpMatters: 'Gyms and fitness centers experience heavy traffic, sweat accumulation, and high humidity in locker rooms. Inadequate cleaning leads to member churn, foul odors, and fungal growth in showers and saunas.',
        keyComplianceStandards: [
            { item: 'Fungicidal Disinfection in Wet Areas', standard: 'EPA Registered Fungicide Standards' },
            { item: 'Hardwood Studio Floor Maintenance', standard: 'MFMA Flooring Guidelines' },
            { item: 'Locker Room Sanitation', standard: 'Local DOH Gym Hygiene Codes' },
        ],
        sampleRequirements: [
            'Nightly pressure scrubbing and chemical descaling of all shower enclosures and tile grout',
            'Disinfection of all high-touch strength equipment handles, pin selectors, and cardio consoles',
            'Enzymatic drain dosing to eliminate organic bio-film and odor sources in locker room drains',
        ],
        faqs: [
            {
                question: 'How do you eliminate persistent locker room shower odors?',
                answer: 'We combine daily acid-free descaling with weekly enzymatic drain treatments that break down organic hair, soap scum, and body oil buildup in floor drains.',
            },
        ],
    },
};

export function getFacilityRfpPreset(slug: string): FacilityRfpPreset | undefined {
    return FACILITY_RFP_PRESETS[slug];
}

export function getAllFacilityRfpPresetSlugs(): string[] {
    return Object.keys(FACILITY_RFP_PRESETS);
}
