export interface NycComplianceRequirement {
    key: string;
    title: string;
    cadence: string;
    scope: string;
    agency: string;
    fineSummary: string;
    whyItMatters: string;
    officialUrl: string;
}

export interface QueensCdProfile {
    cd: number;
    borough: 'Queens';
    ll152Year: number;
    neighborhoods: string[];
}

export const NYC_COMPLIANCE_REQUIREMENTS: NycComplianceRequirement[] = [
    {
        key: 'backflow',
        title: 'Backflow Preventer Annual Test',
        cadence: 'Every year (per installed device)',
        scope: 'Buildings with required DEP backflow prevention assemblies',
        agency: 'NYC DEP',
        fineSummary: 'OATH schedule commonly starts around $500; default penalties can be higher.',
        whyItMatters: 'Missing annual testing risks violations and can jeopardize water service compliance status.',
        officialUrl: 'https://www.nyc.gov/site/dep/about/backflow-prevention-frequently-asked-questions.page',
    },
    {
        key: 'boiler',
        title: 'Boiler Annual Inspection and Filing',
        cadence: 'Annual filing cycle',
        scope: 'Covered low-pressure and high-pressure boilers',
        agency: 'NYC DOB',
        fineSummary: 'Failure-to-file penalties are commonly cited at $1,000 per cycle, plus late penalties.',
        whyItMatters: 'Boiler filing violations stack quickly and can delay permits, renewals, and insurance updates.',
        officialUrl: 'https://www.nyc.gov/site/buildings/safety/boiler-compliance.page',
    },
    {
        key: 'll152',
        title: 'Local Law 152 Gas Piping Inspection',
        cadence: 'Every 4 years (by Community District cycle)',
        scope: 'Most buildings with gas piping systems',
        agency: 'NYC DOB',
        fineSummary: '$5,000 civil penalty for failing to file by deadline.',
        whyItMatters: 'This is one of the most expensive avoidable filings for mixed-use and commercial properties.',
        officialUrl: 'https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page',
    },
    {
        key: 'fisp',
        title: 'Façade Inspection Safety Program (FISP)',
        cadence: 'Every 5 years (cycle based)',
        scope: 'Buildings greater than 6 stories',
        agency: 'NYC DOB',
        fineSummary: 'Late filing and failure-to-file penalties can become monthly recurring fines.',
        whyItMatters: 'Missed FISP cycles create compounding penalties and major public safety exposure.',
        officialUrl: 'https://www.nyc.gov/site/buildings/safety/facade-inspection-safety-program.page',
    },
    {
        key: 'cooling-tower',
        title: 'Cooling Tower Annual Certification',
        cadence: 'Annual certification and maintenance tracking',
        scope: 'Properties with registered cooling towers',
        agency: 'NYC DOHMH',
        fineSummary: 'Violations can include significant civil penalties for missing annual certification and records.',
        whyItMatters: 'Cooling tower compliance is health-code critical and often audited during broader facility reviews.',
        officialUrl: 'https://www.nyc.gov/site/doh/business/permits-and-licenses/cooling-towers.page',
    },
    {
        key: 'elevator',
        title: 'Elevator Periodic / CAT Compliance',
        cadence: 'Annual periodic + category test cycles',
        scope: 'Properties with elevators',
        agency: 'NYC DOB',
        fineSummary: 'Penalties vary by test type and lateness, and can become substantial per device.',
        whyItMatters: 'Elevator violations can trigger DOB enforcement and operational risk for occupied buildings.',
        officialUrl: 'https://www.nyc.gov/site/buildings/safety/elevator-compliance.page',
    },
];

export const QUEENS_LL152_CDS: QueensCdProfile[] = [
    { cd: 1, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Astoria', 'Long Island City', 'Woodside'] },
    { cd: 2, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Sunnyside', 'Woodside', 'Long Island City'] },
    { cd: 3, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Jackson Heights', 'East Elmhurst', 'Corona'] },
    { cd: 4, borough: 'Queens', ll152Year: 2026, neighborhoods: ['Corona', 'Elmhurst'] },
    { cd: 5, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Ridgewood', 'Glendale', 'Maspeth'] },
    { cd: 6, borough: 'Queens', ll152Year: 2026, neighborhoods: ['Forest Hills', 'Rego Park'] },
    { cd: 7, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Flushing', 'Whitestone', 'College Point'] },
    { cd: 8, borough: 'Queens', ll152Year: 2026, neighborhoods: ['Jamaica Hills', 'Hollis', 'Fresh Meadows'] },
    { cd: 9, borough: 'Queens', ll152Year: 2026, neighborhoods: ['Kew Gardens', 'Richmond Hill', 'Woodhaven'] },
    { cd: 10, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Howard Beach', 'Ozone Park', 'South Ozone Park'] },
    { cd: 11, borough: 'Queens', ll152Year: 2027, neighborhoods: ['Bayside', 'Douglaston', 'Little Neck'] },
    { cd: 12, borough: 'Queens', ll152Year: 2027, neighborhoods: ['Jamaica', 'St. Albans', 'Hollis'] },
    { cd: 13, borough: 'Queens', ll152Year: 2025, neighborhoods: ['Queens Village', 'Cambria Heights', 'Bellerose'] },
    { cd: 14, borough: 'Queens', ll152Year: 2027, neighborhoods: ['Far Rockaway', 'Arverne', 'Rockaway Beach'] },
];

export const QUEENS_PSEO_YEARS = [2026, 2027] as const;

export function getQueensYearComplianceSlug(year: number): string {
    return `queens-nyc-building-compliance-plan-${year}`;
}

export function getQueensCdComplianceSlug(cd: number, year: number): string {
    return `queens-ll152-gas-piping-cd-${cd}-${year}`;
}

export function getQueensCdsByYear(year: number): QueensCdProfile[] {
    return QUEENS_LL152_CDS.filter((entry) => entry.ll152Year === year);
}

export function getQueensCdByNumberAndYear(cd: number, year: number): QueensCdProfile | undefined {
    return QUEENS_LL152_CDS.find((entry) => entry.cd === cd && entry.ll152Year === year);
}
