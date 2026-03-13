// ── Guide Data ──
// Loads guide content from individual JSON files in content/guides/
// Helper functions for regulation × location pSEO are kept inline.

import fs from 'fs';
import path from 'path';

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

const guidesDir = path.join(process.cwd(), 'content', 'guides');

// Cache: loaded once per process
let _cache: Record<string, GuideData> | null = null;

function loadGuides(): Record<string, GuideData> {
    if (_cache) return _cache;

    _cache = {};
    const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const slug = file.replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(guidesDir, file), 'utf-8'));
        _cache[slug] = data as GuideData;
    }
    return _cache;
}

export const GUIDES: Record<string, GuideData> = loadGuides();

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
