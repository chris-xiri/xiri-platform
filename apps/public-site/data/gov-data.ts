// ─── Census Bureau + BLS Government Data ─────────────────────────
// NAICS code mappings and service areas for dynamic Census data fetching.
// Actual establishment counts are fetched at build time via lib/census.ts.
// Used by: IndustryHubPage, industry pillar pages, calculator.

// ─── Service Areas ────────────────────────────────────────────────

export interface ServiceArea {
    id: string;
    label: string;
    /** Short display label for inline copy, e.g. "the New York metro area" */
    display: string;
    /** Census geographic level */
    censusLevel: 'county' | 'msa';
    /** FIPS code for Census API */
    censusFips: string;
    /** State FIPS (required for county-level queries) */
    stateFips?: string;
}

export const SERVICE_AREAS: ServiceArea[] = [
    {
        id: 'nyc-metro',
        label: 'New York Metro Area',
        display: 'the New York metro area',
        censusLevel: 'msa',
        censusFips: '35620',
    },
    {
        id: 'nassau',
        label: 'Nassau County',
        display: 'Nassau County',
        censusLevel: 'county',
        censusFips: '059',
        stateFips: '36',
    },
    {
        id: 'queens',
        label: 'Queens County',
        display: 'Queens',
        censusLevel: 'county',
        censusFips: '081',
        stateFips: '36',
    },
    {
        id: 'suffolk',
        label: 'Suffolk County',
        display: 'Suffolk County',
        censusLevel: 'county',
        censusFips: '103',
        stateFips: '36',
    },
    {
        id: 'kings',
        label: 'Kings County (Brooklyn)',
        display: 'Brooklyn',
        censusLevel: 'county',
        censusFips: '047',
        stateFips: '36',
    },
];

export const DEFAULT_METRO_AREA = SERVICE_AREAS.find(a => a.id === 'nyc-metro')!;
export const DEFAULT_LOCAL_AREA = SERVICE_AREAS.find(a => a.id === 'nassau')!;

// ─── NAICS Code Mapping ──────────────────────────────────────────
// Maps facility-type slugs to their Census NAICS codes.
// Multiple codes are summed (e.g. new + used car dealers).

export interface NAICSMapping {
    /** Facility type slug from data/facility-types.ts */
    facilitySlug: string;
    /** NAICS codes to query (results are summed) */
    naicsCodes: string[];
    /** Human-readable Census label for citations */
    censusLabel: string;
    /** Singular noun for copy, e.g. "physician office" */
    singular: string;
    /** Plural noun for copy, e.g. "physician offices" */
    plural: string;
}

export const NAICS_MAPPINGS: NAICSMapping[] = [
    // Healthcare
    {
        facilitySlug: 'medical-offices',
        naicsCodes: ['621111'],
        censusLabel: 'Offices of physicians (except mental health specialists)',
        singular: 'physician office',
        plural: 'physician offices',
    },
    {
        facilitySlug: 'dental-offices',
        naicsCodes: ['621210'],
        censusLabel: 'Offices of dentists',
        singular: 'dental practice',
        plural: 'dental practices',
    },
    {
        facilitySlug: 'urgent-care',
        naicsCodes: ['621493'],
        censusLabel: 'Freestanding ambulatory surgical and emergency centers',
        singular: 'urgent care center',
        plural: 'urgent care centers',
    },
    {
        facilitySlug: 'surgery-centers',
        naicsCodes: ['621493'],
        censusLabel: 'Freestanding ambulatory surgical and emergency centers',
        singular: 'surgery center',
        plural: 'surgery centers',
    },
    {
        facilitySlug: 'dialysis-centers',
        naicsCodes: ['621492'],
        censusLabel: 'Kidney dialysis centers',
        singular: 'dialysis center',
        plural: 'dialysis centers',
    },
    {
        facilitySlug: 'veterinary-clinics',
        naicsCodes: ['541940'],
        censusLabel: 'Veterinary services',
        singular: 'veterinary clinic',
        plural: 'veterinary clinics',
    },
    // Automotive
    {
        facilitySlug: 'auto-dealerships',
        naicsCodes: ['441110', '441120'],
        censusLabel: 'New and used car dealers',
        singular: 'auto dealership',
        plural: 'auto dealerships',
    },
    // Education
    {
        facilitySlug: 'daycare-preschool',
        naicsCodes: ['624410'],
        censusLabel: 'Child day care services',
        singular: 'child care center',
        plural: 'child care centers',
    },
    {
        facilitySlug: 'private-schools',
        naicsCodes: ['611110'],
        censusLabel: 'Elementary and secondary schools',
        singular: 'school',
        plural: 'schools',
    },
    // Commercial
    {
        facilitySlug: 'professional-offices',
        naicsCodes: ['541110'],
        censusLabel: 'Offices of lawyers',
        singular: 'professional office',
        plural: 'professional offices',
    },
    {
        facilitySlug: 'fitness-gyms',
        naicsCodes: ['713940'],
        censusLabel: 'Fitness and recreational sports centers',
        singular: 'fitness center',
        plural: 'fitness centers',
    },
    {
        facilitySlug: 'retail-storefronts',
        naicsCodes: ['44-45'],
        censusLabel: 'Retail trade',
        singular: 'retail establishment',
        plural: 'retail establishments',
    },
    // Facility Services (our industry)
    {
        facilitySlug: 'janitorial-services',
        naicsCodes: ['561720'],
        censusLabel: 'Janitorial services',
        singular: 'janitorial company',
        plural: 'janitorial companies',
    },
];

/** Look up NAICS mapping by facility slug */
export function getNAICSMapping(facilitySlug: string): NAICSMapping | undefined {
    return NAICS_MAPPINGS.find(m => m.facilitySlug === facilitySlug);
}

/** Get all NAICS mappings for a list of facility slugs */
export function getNAICSMappings(slugs: string[]): NAICSMapping[] {
    return slugs.map(s => NAICS_MAPPINGS.find(m => m.facilitySlug === s)).filter(Boolean) as NAICSMapping[];
}

// ─── BLS Reference Data ──────────────────────────────────────────
// Static reference data from BLS (not fetched dynamically).
// Updated manually when new OES data releases (annually, ~March).

export const BLS_WAGE_DATA = {
    janitorsCleaners: {
        soc: '37-2011',
        title: 'Janitors and Cleaners, Except Maids and Housekeeping Cleaners',
        medianHourly: 17.27,
        meanHourly: 18.33,
        medianAnnual: 35920,
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/oes/current/oes372011.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024',
    },
    buildingCleaners: {
        soc: '37-2012',
        title: 'Maids and Housekeeping Cleaners',
        medianHourly: 15.19,
        meanHourly: 15.83,
        medianAnnual: 31590,
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/oes/current/oes372012.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024',
    },

    // ─── Trade-Specific Wages (for referral partner content) ──────
    plumbers: {
        soc: '47-2152',
        title: 'Plumbers, Pipefitters, and Steamfitters',
        medianHourly: 30.27,
        medianAnnual: 62970,
        employment: 561400,
        growthProjection: '2%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/construction-and-extraction/plumbers-pipefitters-and-steamfitters.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    electricians: {
        soc: '47-2111',
        title: 'Electricians',
        medianHourly: 30.00,
        medianAnnual: 62350,
        employment: 865900,
        growthProjection: '6%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/construction-and-extraction/electricians.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    hvacTechs: {
        soc: '49-9021',
        title: 'Heating, Air Conditioning, and Refrigeration Mechanics and Installers',
        medianHourly: 28.75,
        medianAnnual: 59810,
        employment: 415200,
        growthProjection: '9%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/installation-maintenance-and-repair/heating-air-conditioning-and-refrigeration-mechanics-and-installers.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    propertyManagers: {
        soc: '11-9141',
        title: 'Property, Real Estate, and Community Association Managers',
        medianHourly: 32.07,
        medianAnnual: 66700,
        growthProjection: '2%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/management/property-real-estate-and-community-association-managers.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    realEstateBrokers: {
        soc: '41-9022',
        title: 'Real Estate Brokers',
        medianHourly: 34.75,
        medianAnnual: 72280,
        growthProjection: '2%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/sales/real-estate-brokers-and-sales-agents.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    pestControlWorkers: {
        soc: '37-2021',
        title: 'Pest Control Workers',
        medianHourly: 20.59,
        medianAnnual: 42820,
        growthProjection: '1%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/building-and-grounds-cleaning/pest-control-workers.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    securityGuards: {
        soc: '33-9032',
        title: 'Security Guards',
        medianHourly: 16.69,
        medianAnnual: 34720,
        growthProjection: '3%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/protective-service/security-guards.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    accountants: {
        soc: '13-2011',
        title: 'Accountants and Auditors',
        medianHourly: 39.42,
        medianAnnual: 82000,
        growthProjection: '6%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/business-and-financial/accountants-and-auditors.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    insuranceAgents: {
        soc: '41-3021',
        title: 'Insurance Sales Agents',
        medianHourly: 29.64,
        medianAnnual: 61650,
        growthProjection: '8%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/sales/insurance-sales-agents.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    elevatorInstallers: {
        soc: '47-4021',
        title: 'Elevator and Escalator Installers and Repairers',
        medianHourly: 49.66,
        medianAnnual: 103310,
        growthProjection: '2%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/ooh/construction-and-extraction/elevator-installers-and-repairers.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Outlook Handbook, May 2024',
    },
    locksmiths: {
        soc: '49-9094',
        title: 'Locksmiths and Safe Repairers',
        medianHourly: 22.97,
        medianAnnual: 47770,
        growthProjection: '6%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/oes/current/oes499094.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024',
    },
    fireInspectors: {
        soc: '33-2021',
        title: 'Fire Inspectors and Investigators',
        medianHourly: 33.35,
        medianAnnual: 69370,
        growthProjection: '6%',
        growthPeriod: '2023-2033',
        year: 2024,
        month: 'May',
        sourceUrl: 'https://www.bls.gov/oes/current/oes332021.htm',
        citation: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024',
    },
};

// ─── Census Citation Helpers ──────────────────────────────────────

export const CENSUS_CITATION = {
    source: 'U.S. Census Bureau',
    dataset: 'County Business Patterns',
    year: 2023,
    baseUrl: 'https://data.census.gov/table/CBP2023.CB2300CBP',
    get citation() {
        return `${this.source}, ${this.dataset} (${this.year})`;
    },
};

export const ACS_CITATION = {
    source: 'U.S. Census Bureau',
    dataset: 'American Community Survey 5-Year Estimates',
    year: 2023,
    baseUrl: 'https://data.census.gov/table/ACSST5Y2023.S0101',
    get citation() {
        return `${this.source}, ${this.dataset} (${this.year})`;
    },
};

export const BLS_OEWS_CITATION = {
    source: 'U.S. Bureau of Labor Statistics',
    dataset: 'Occupational Employment and Wage Statistics',
    year: 2024,
    month: 'May',
    baseUrl: 'https://www.bls.gov/oes/',
    get citation() {
        return `${this.source}, ${this.dataset}, ${this.month} ${this.year}`;
    },
};
