// Industry Pillar Configuration
// Maps individual industry pages to their parent pillar hubs

export interface IndustryPillar {
    slug: string;
    name: string;
    description: string;
    industries: string[]; // industry slugs
}

export const INDUSTRY_PILLARS: IndustryPillar[] = [
    {
        slug: 'healthcare',
        name: 'Healthcare Facilities',
        description: 'OSHA, HIPAA, and CMS-compliant cleaning for medical offices, surgery centers, urgent care, dental, dialysis, veterinary clinics, and converted clinical suites.',
        industries: ['medical-offices', 'urgent-care', 'surgery-centers', 'dental-offices', 'dialysis-centers', 'converted-clinical-suites', 'veterinary-clinics'],
    },
    {
        slug: 'automotive',
        name: 'Automotive Facilities',
        description: 'Showroom-ready cleaning and OSHA-compliant service bay maintenance for auto dealerships.',
        industries: ['auto-dealerships'],
    },
    {
        slug: 'education',
        name: 'Education & Childcare',
        description: 'Child-safe, Green Seal-certified cleaning for daycare centers, preschools, and private schools.',
        industries: ['daycare-preschool', 'private-schools'],
    },
    {
        slug: 'commercial',
        name: 'Commercial & Retail',
        description: 'Nightly-verified, ADA-compliant cleaning for professional offices, retail storefronts, and fitness facilities.',
        industries: ['professional-offices', 'retail-storefronts', 'fitness-gyms'],
    },
    {
        slug: 'specialized',
        name: 'Specialized Facilities',
        description: 'ISO-classified cleanroom maintenance and cGMP-compliant cleaning for labs, cleanrooms, and light manufacturing.',
        industries: ['labs-cleanrooms', 'light-manufacturing'],
    },
];

/** Get the pillar for a given industry slug */
export function getPillarForIndustry(industrySlug: string): IndustryPillar | null {
    return INDUSTRY_PILLARS.find(p => p.industries.includes(industrySlug)) || null;
}

/** All valid pillar slugs */
export const PILLAR_SLUGS = INDUSTRY_PILLARS.map(p => p.slug);
