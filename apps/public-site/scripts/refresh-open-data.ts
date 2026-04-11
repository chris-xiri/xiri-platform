// ─── Open Data Refresh Script ────────────────────────────────────
// Fetches data from 3 free government APIs and writes to open-data-cache.json:
//   1. Census CBP  →  Establishment counts by NAICS × area
//   2. Census ACS  →  County demographics (population, income)
//   3. BLS OEWS    →  Area-specific wages (janitors, cleaners)
//
// Run:   npm run refresh-open-data
// When:  Once per year when new CBP/ACS data drops, or when adding areas.
//
// To expand to a new market:
//   1. Add the area to SERVICE_AREAS below (keep in sync with gov-data.ts)
//   2. Run: npm run refresh-open-data
//   3. Done — all pages auto-populate with the new area's data.
//
// Env vars (optional):
//   CENSUS_API_KEY  – Free key from api.census.gov/data/key_signup.html
//   BLS_API_KEY     – Free key from bls.gov/developers/
//
// The cached data is committed to the repo and read at build time.
// Zero API calls during builds or at runtime.

const fs = require('fs');
const path = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────

const CBP_BASE = 'https://api.census.gov/data/2023/cbp';
const ACS_BASE = 'https://api.census.gov/data/2023/acs/acs5';
const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || '';
const BLS_API_KEY = process.env.BLS_API_KEY || '';

// Rate limiting delays (ms)
const CENSUS_DELAY = 250;
const BLS_DELAY = 500;

// ─── TYPES ───────────────────────────────────────────────────────

interface ServiceArea {
    id: string;
    label: string;
    display: string;
    censusLevel: 'county' | 'msa';
    censusFips: string;
    stateFips?: string;
    /** BLS OEWS area code for wage queries */
    blsAreaCode?: string;
    blsAreaType?: string;
}

interface NAICSMapping {
    facilitySlug: string;
    naicsCodes: string[];
    censusLabel: string;
    singular: string;
    plural: string;
}

interface WageConfig {
    key: string;
    soc: string;
    title: string;
}

// ─── DATA (keep in sync with gov-data.ts) ────────────────────────

const SERVICE_AREAS: ServiceArea[] = [
    {
        id: 'nyc-metro',
        label: 'New York Metro Area',
        display: 'the New York metro area',
        censusLevel: 'msa',
        censusFips: '35620',
        blsAreaCode: '0035620',
        blsAreaType: 'M',
    },
    {
        id: 'nassau',
        label: 'Nassau County',
        display: 'Nassau County',
        censusLevel: 'county',
        censusFips: '059',
        stateFips: '36',
        // BLS OEWS doesn't publish metro division time series —
        // fall back to NYC MSA (which covers all our service areas)
        blsAreaCode: '0035620',
        blsAreaType: 'M',
    },
    {
        id: 'suffolk',
        label: 'Suffolk County',
        display: 'Suffolk County',
        censusLevel: 'county',
        censusFips: '103',
        stateFips: '36',
        blsAreaCode: '0035620',
        blsAreaType: 'M',
    },
    {
        id: 'queens',
        label: 'Queens County',
        display: 'Queens',
        censusLevel: 'county',
        censusFips: '081',
        stateFips: '36',
        blsAreaCode: '0035620',
        blsAreaType: 'M',
    },
    {
        id: 'kings',
        label: 'Kings County (Brooklyn)',
        display: 'Brooklyn',
        censusLevel: 'county',
        censusFips: '047',
        stateFips: '36',
        blsAreaCode: '0035620',
        blsAreaType: 'M',
    },
];

const NAICS_MAPPINGS: NAICSMapping[] = [
    { facilitySlug: 'medical-offices', naicsCodes: ['621111'], censusLabel: 'Offices of physicians', singular: 'physician office', plural: 'physician offices' },
    { facilitySlug: 'dental-offices', naicsCodes: ['621210'], censusLabel: 'Offices of dentists', singular: 'dental practice', plural: 'dental practices' },
    { facilitySlug: 'urgent-care', naicsCodes: ['621493'], censusLabel: 'Freestanding ambulatory surgical and emergency centers', singular: 'urgent care center', plural: 'urgent care centers' },
    { facilitySlug: 'surgery-centers', naicsCodes: ['621493'], censusLabel: 'Freestanding ambulatory surgical and emergency centers', singular: 'surgery center', plural: 'surgery centers' },
    { facilitySlug: 'dialysis-centers', naicsCodes: ['621492'], censusLabel: 'Kidney dialysis centers', singular: 'dialysis center', plural: 'dialysis centers' },
    { facilitySlug: 'veterinary-clinics', naicsCodes: ['541940'], censusLabel: 'Veterinary services', singular: 'veterinary clinic', plural: 'veterinary clinics' },
    { facilitySlug: 'auto-dealerships', naicsCodes: ['441110', '441120'], censusLabel: 'New and used car dealers', singular: 'auto dealership', plural: 'auto dealerships' },
    { facilitySlug: 'daycare-preschool', naicsCodes: ['624410'], censusLabel: 'Child day care services', singular: 'child care center', plural: 'child care centers' },
    { facilitySlug: 'private-schools', naicsCodes: ['611110'], censusLabel: 'Elementary and secondary schools', singular: 'school', plural: 'schools' },
    { facilitySlug: 'professional-offices', naicsCodes: ['541110'], censusLabel: 'Offices of lawyers', singular: 'professional office', plural: 'professional offices' },
    { facilitySlug: 'fitness-gyms', naicsCodes: ['713940'], censusLabel: 'Fitness and recreational sports centers', singular: 'fitness center', plural: 'fitness centers' },
    { facilitySlug: 'retail-storefronts', naicsCodes: ['44-45'], censusLabel: 'Retail trade', singular: 'retail establishment', plural: 'retail establishments' },
    { facilitySlug: 'janitorial-services', naicsCodes: ['561720'], censusLabel: 'Janitorial services', singular: 'janitorial company', plural: 'janitorial companies' },
];

const WAGE_OCCUPATIONS: WageConfig[] = [
    { key: 'janitors', soc: '37-2011', title: 'Janitors and Cleaners' },
    { key: 'building-cleaners', soc: '37-2012', title: 'Maids and Housekeeping Cleaners' },
];

// ACS variables to fetch
const ACS_VARIABLES = {
    population: 'B01003_001E',
    medianHouseholdIncome: 'B19013_001E',
};

// ─── CENSUS CBP API ──────────────────────────────────────────────

function buildCbpUrl(area: ServiceArea, naicsCode: string): string {
    const params = new URLSearchParams({
        get: 'ESTAB,NAICS2017_LABEL,NAME',
        NAICS2017: naicsCode,
    });
    if (CENSUS_API_KEY) params.set('key', CENSUS_API_KEY);

    if (area.censusLevel === 'county') {
        params.set('for', `county:${area.censusFips}`);
        if (area.stateFips) params.set('in', `state:${area.stateFips}`);
    } else {
        params.set('for', `metropolitan statistical area/micropolitan statistical area:${area.censusFips}`);
    }

    return `${CBP_BASE}?${params.toString()}`;
}

async function fetchCbpCount(area: ServiceArea, naicsCode: string): Promise<number> {
    const url = buildCbpUrl(area, naicsCode);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`  ⚠ CBP HTTP ${res.status} for NAICS ${naicsCode} in ${area.label}`);
            return 0;
        }
        const data = await res.json() as string[][];
        if (!data || data.length < 2) return 0;
        return parseInt(data[1][0], 10) || 0;
    } catch (err) {
        console.warn(`  ⚠ CBP error for NAICS ${naicsCode} in ${area.label}:`, (err as Error).message);
        return 0;
    }
}

// ─── CENSUS ACS API ──────────────────────────────────────────────

function buildAcsUrl(area: ServiceArea): string {
    const vars = Object.values(ACS_VARIABLES).join(',');
    const params = new URLSearchParams({
        get: `NAME,${vars}`,
    });
    if (CENSUS_API_KEY) params.set('key', CENSUS_API_KEY);

    if (area.censusLevel === 'county') {
        params.set('for', `county:${area.censusFips}`);
        if (area.stateFips) params.set('in', `state:${area.stateFips}`);
    } else {
        params.set('for', `metropolitan statistical area/micropolitan statistical area:${area.censusFips}`);
    }

    return `${ACS_BASE}?${params.toString()}`;
}

interface AcsResult {
    population: number;
    medianHouseholdIncome: number;
}

async function fetchAcs(area: ServiceArea): Promise<AcsResult> {
    const url = buildAcsUrl(area);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`  ⚠ ACS HTTP ${res.status} for ${area.label}`);
            return { population: 0, medianHouseholdIncome: 0 };
        }
        const data = await res.json() as string[][];
        if (!data || data.length < 2) {
            return { population: 0, medianHouseholdIncome: 0 };
        }
        // data[0] is headers, data[1] is values
        // NAME, B01003_001E (pop), B19013_001E (income), ...geography
        return {
            population: parseInt(data[1][1], 10) || 0,
            medianHouseholdIncome: parseInt(data[1][2], 10) || 0,
        };
    } catch (err) {
        console.warn(`  ⚠ ACS error for ${area.label}:`, (err as Error).message);
        return { population: 0, medianHouseholdIncome: 0 };
    }
}

// ─── BLS OEWS API ────────────────────────────────────────────────

/**
 * Build BLS OEWS series ID.
 * Format: OE + U + areatype(1) + areacode(7) + industry(6) + soc(6) + datatype(2)
 * industry = 000000 (all industries)
 *
 * Verified BLS OEWS datatype codes:
 *   03 = mean hourly wage
 *   04 = median annual wage (NOT hourly!)
 *   13 = median annual wage (alternate)
 *   01 = employment
 *
 * Note: BLS OEWS time series only exist at MSA level, NOT metro divisions.
 * All our service areas use the NYC MSA code (0035620).
 */
function buildBlsSeriesId(
    area: ServiceArea,
    soc: string,
    datatype: '01' | '03' | '04' | '13'
): string | null {
    if (!area.blsAreaCode || !area.blsAreaType) return null;
    const socClean = soc.replace('-', '');
    return `OEU${area.blsAreaType}${area.blsAreaCode}000000${socClean}${datatype}`;
}

interface BlsWageResult {
    soc: string;
    median_hourly: number;
    mean_hourly: number;
    median_annual: number;
    area_title: string;
}

async function fetchBlsWages(area: ServiceArea, wage: WageConfig): Promise<BlsWageResult | null> {
    // 04 = median annual, 03 = mean hourly
    const medianAnnualSeries = buildBlsSeriesId(area, wage.soc, '04');
    const meanHourlySeries = buildBlsSeriesId(area, wage.soc, '03');

    if (!medianAnnualSeries || !meanHourlySeries) return null;

    const seriesIds = [medianAnnualSeries, meanHourlySeries];

    try {
        const body: any = {
            seriesid: seriesIds,
            startyear: '2024',
            endyear: '2024',
        };
        if (BLS_API_KEY) body.registrationkey = BLS_API_KEY;

        const res = await fetch(BLS_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.warn(`  ⚠ BLS HTTP ${res.status} for ${wage.key} in ${area.label}`);
            return null;
        }

        const json: any = await res.json();
        if (json.status !== 'REQUEST_SUCCEEDED') {
            console.warn(`  ⚠ BLS status: ${json.status} for ${wage.key} in ${area.label}`);
            return null;
        }

        let medianAnnual = 0;
        let meanHourly = 0;

        for (const series of json.Results?.series || []) {
            const id = series.seriesID as string;
            const latestValue = parseFloat(series.data?.[0]?.value || '0');
            if (id === medianAnnualSeries) medianAnnual = latestValue;
            else if (id === meanHourlySeries) meanHourly = latestValue;
        }

        // Derive median hourly from annual (standard 2,080 hour work year)
        const medianHourly = medianAnnual > 0
            ? Math.round((medianAnnual / 2080) * 100) / 100
            : 0;

        return {
            soc: wage.soc,
            median_hourly: medianHourly,
            mean_hourly: meanHourly,
            median_annual: medianAnnual,
            area_title: area.label,
        };
    } catch (err) {
        console.warn(`  ⚠ BLS error for ${wage.key} in ${area.label}:`, (err as Error).message);
        return null;
    }
}

// ─── MAIN ────────────────────────────────────────────────────────

interface OpenDataCache {
    generatedAt: string;
    sources: Record<string, any>;
    counties: Record<string, any>;
}

async function main() {
    console.log('');
    console.log('🏛️  Open Data Refresh — Government API Data Collection');
    console.log('━'.repeat(60));
    console.log(`   Areas:         ${SERVICE_AREAS.map(a => a.label).join(', ')}`);
    console.log(`   Industries:    ${NAICS_MAPPINGS.length}`);
    console.log(`   Wages:         ${WAGE_OCCUPATIONS.length} occupations`);
    console.log(`   Census key:    ${CENSUS_API_KEY ? '✓ provided' : '⚠ not set (rate limits apply)'}`);
    console.log(`   BLS key:       ${BLS_API_KEY ? '✓ provided' : '⚠ not set (limited to 25 req/day)'}`);
    console.log('━'.repeat(60));
    console.log('');

    // Use process.cwd() — script is always run from the public-site directory
    const cachePath = path.join(process.cwd(), 'data', 'open-data-cache.json');
    console.log(`   Cache path: ${cachePath}`);
    let existingCache: OpenDataCache | null = null;
    try {
        existingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch {
        console.log('   No existing cache found — starting fresh.');
    }

    const output: OpenDataCache = {
        generatedAt: new Date().toISOString(),
        sources: {
            census_cbp: {
                year: 2023,
                citation: 'U.S. Census Bureau, County Business Patterns (2023)',
                url: 'https://data.census.gov/table/CBP2023.CB2300CBP',
            },
            census_acs: {
                year: 2023,
                citation: 'U.S. Census Bureau, American Community Survey 5-Year Estimates (2023)',
                url: 'https://data.census.gov/table/ACSST5Y2023.S0101',
            },
            bls_oews: {
                year: 2024,
                month: 'May',
                citation: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024',
                url: 'https://www.bls.gov/oes/',
            },
        },
        counties: {},
    };

    // ───────────────────────────────────────────────────────────────
    // PART 1: Census CBP — Establishment counts
    // ───────────────────────────────────────────────────────────────

    console.log('📊 PART 1: Census Bureau — County Business Patterns');
    console.log('─'.repeat(40));

    for (const area of SERVICE_AREAS) {
        output.counties[area.id] = {
            fips: area.censusLevel === 'county'
                ? { state: area.stateFips, county: area.censusFips }
                : { msa: area.censusFips },
            demographics: {},
            establishments: {},
            wages: {},
        };

        for (const mapping of NAICS_MAPPINGS) {
            const counts = await Promise.all(
                mapping.naicsCodes.map(code => fetchCbpCount(area, code))
            );
            const total = counts.reduce((sum, c) => sum + c, 0);

            // Fallback: use existing cache if API returns 0
            const fallback = existingCache?.counties?.[area.id]?.establishments?.[mapping.facilitySlug];
            const finalCount = total > 0 ? total : (fallback ?? 0);

            output.counties[area.id].establishments[mapping.facilitySlug] = finalCount;

            if (total > 0) {
                console.log(`   ${area.label} → ${mapping.facilitySlug}: ${total.toLocaleString()}`);
            } else if (fallback) {
                console.log(`   ${area.label} → ${mapping.facilitySlug}: ${fallback.toLocaleString()} (cached)`);
            }

            await new Promise(r => setTimeout(r, CENSUS_DELAY));
        }
    }

    // ───────────────────────────────────────────────────────────────
    // PART 2: Census ACS — County demographics
    // ───────────────────────────────────────────────────────────────

    console.log('');
    console.log('👥 PART 2: Census Bureau — American Community Survey');
    console.log('─'.repeat(40));

    for (const area of SERVICE_AREAS) {
        const acs = await fetchAcs(area);
        const fallback = existingCache?.counties?.[area.id]?.demographics;

        output.counties[area.id].demographics = {
            population: acs.population > 0 ? acs.population : (fallback?.population ?? 0),
            medianHouseholdIncome: acs.medianHouseholdIncome > 0
                ? acs.medianHouseholdIncome
                : (fallback?.medianHouseholdIncome ?? 0),
            totalBusinessEstablishments: fallback?.totalBusinessEstablishments ?? 0,
            source: 'census_acs',
        };

        console.log(`   ${area.label}: pop=${output.counties[area.id].demographics.population.toLocaleString()}, income=$${output.counties[area.id].demographics.medianHouseholdIncome.toLocaleString()}`);

        await new Promise(r => setTimeout(r, CENSUS_DELAY));
    }

    // ───────────────────────────────────────────────────────────────
    // PART 3: BLS OEWS — Area wages
    // ───────────────────────────────────────────────────────────────

    console.log('');
    console.log('💰 PART 3: Bureau of Labor Statistics — Area Wages');
    console.log('─'.repeat(40));

    // De-duplicate BLS fetches — Nassau & Suffolk share an area code
    const fetchedWages: Record<string, Record<string, BlsWageResult | null>> = {};

    for (const area of SERVICE_AREAS) {
        const areaKey = area.blsAreaCode || area.id;

        if (!fetchedWages[areaKey]) {
            fetchedWages[areaKey] = {};
            for (const wage of WAGE_OCCUPATIONS) {
                const result = await fetchBlsWages(area, wage);
                fetchedWages[areaKey][wage.key] = result;
                if (result) {
                    console.log(`   ${area.label} (${areaKey}) → ${wage.key}: median=$${result.median_hourly}/hr, mean=$${result.mean_hourly}/hr, annual=$${result.median_annual.toLocaleString()}`);
                } else {
                    console.log(`   ${area.label} (${areaKey}) → ${wage.key}: no data (will use fallback)`);
                }
                await new Promise(r => setTimeout(r, BLS_DELAY));
            }
        }

        // Write wages to output (shared areas get the same data)
        for (const wage of WAGE_OCCUPATIONS) {
            const result = fetchedWages[areaKey][wage.key];
            const fallback = existingCache?.counties?.[area.id]?.wages?.[wage.key];

            output.counties[area.id].wages[wage.key] = result || fallback || {
                soc: wage.soc,
                median_hourly: 0,
                mean_hourly: 0,
                median_annual: 0,
                area_title: area.label,
            };
        }
    }

    // ───────────────────────────────────────────────────────────────
    // WRITE OUTPUT
    // ───────────────────────────────────────────────────────────────

    // Update totalBusinessEstablishments from CBP sum
    for (const area of SERVICE_AREAS) {
        const estabs = output.counties[area.id].establishments;
        // Sum all tracked establishment types (rough proxy for total commercial)
        const tracked = Object.values(estabs).reduce((s: number, v: any) => s + (v || 0), 0);
        if (output.counties[area.id].demographics.totalBusinessEstablishments === 0) {
            output.counties[area.id].demographics.totalBusinessEstablishments = tracked;
        }
    }

    fs.writeFileSync(cachePath, JSON.stringify(output, null, 2));

    console.log('');
    console.log('━'.repeat(60));
    console.log(`✅ Cache written to data/open-data-cache.json`);
    console.log(`   ${Object.keys(output.counties).length} areas`);
    console.log(`   ${NAICS_MAPPINGS.length} industry types`);
    console.log(`   ${WAGE_OCCUPATIONS.length} wage occupations`);
    console.log(`   Generated: ${output.generatedAt}`);
    console.log('');
    console.log('Next steps:');
    console.log('   1. Review the output file');
    console.log('   2. Commit open-data-cache.json');
    console.log('   3. Deploy — pages will show updated stats');
    console.log('');
}

main().catch(console.error);
