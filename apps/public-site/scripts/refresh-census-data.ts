// ─── Census Bureau API → Cache Refresh Script ────────────────────
// Fetches establishment counts from Census CBP API for all
// NAICS codes × service areas and writes to census-cache.json.
//
// Run:  npm run refresh-census
// When: Once per year when new CBP data drops, or when adding new service areas.
//
// To expand to a new market:
//   1. Add the area to SERVICE_AREAS in data/gov-data.ts
//   2. Run: npm run refresh-census
//   3. Done — all pages auto-populate with the new area's data.
//
// The cached data is committed to the repo and read at build time.
// No API calls happen during builds.

const fs = require('fs');
const path = require('path');

const CBP_BASE = 'https://api.census.gov/data/2022/cbp';

// ─── CONFIG ──────────────────────────────────────────────────────
// Mirrors data/gov-data.ts. We duplicate here to avoid TS import
// issues in a standalone script. Keep in sync with gov-data.ts.

interface ServiceArea {
    id: string;
    label: string;
    display: string;
    censusLevel: 'county' | 'msa';
    censusFips: string;
    stateFips?: string;
}

interface NAICSMapping {
    facilitySlug: string;
    naicsCodes: string[];
    censusLabel: string;
    singular: string;
    plural: string;
}

// ⬇️  KEEP IN SYNC with data/gov-data.ts  ⬇️

const SERVICE_AREAS: ServiceArea[] = [
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
    // ──────────────────────────────────────────────────────────────
    // To expand: copy an entry above and update with the new area.
    // Example:
    // {
    //     id: 'la-metro',
    //     label: 'Los Angeles Metro Area',
    //     display: 'the Los Angeles metro area',
    //     censusLevel: 'msa',
    //     censusFips: '31080',
    // },
    // ──────────────────────────────────────────────────────────────
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
];

// ─── API FETCH ───────────────────────────────────────────────────

function buildUrl(area: ServiceArea, naicsCode: string): string {
    const params = new URLSearchParams({
        get: 'ESTAB,NAICS2017_LABEL,NAME',
        NAICS2017: naicsCode,
    });

    if (area.censusLevel === 'county') {
        params.set('for', `county:${area.censusFips}`);
        if (area.stateFips) params.set('in', `state:${area.stateFips}`);
    } else {
        params.set('for', `metropolitan statistical area/micropolitan statistical area:${area.censusFips}`);
    }

    return `${CBP_BASE}?${params.toString()}`;
}

async function fetchCount(area: ServiceArea, naicsCode: string): Promise<number> {
    const url = buildUrl(area, naicsCode);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`  ⚠ HTTP ${res.status} for NAICS ${naicsCode} in ${area.label}`);
            return 0;
        }
        const data = await res.json() as string[][];
        if (!data || data.length < 2) return 0;
        return parseInt(data[1][0], 10) || 0;
    } catch (err) {
        console.warn(`  ⚠ Error fetching NAICS ${naicsCode} in ${area.label}:`, err);
        return 0;
    }
}

// ─── MAIN ────────────────────────────────────────────────────────

interface CacheEntry {
    facilitySlug: string;
    areas: Record<string, { establishments: number; areaLabel: string }>;
}

interface CensusCache {
    generatedAt: string;
    censusYear: number;
    source: string;
    entries: Record<string, CacheEntry>;
}

async function main() {
    console.log('');
    console.log('🏛️  Census Bureau Data Refresh');
    console.log('━'.repeat(50));
    console.log(`   Areas:      ${SERVICE_AREAS.map(a => a.label).join(', ')}`);
    console.log(`   Industries: ${NAICS_MAPPINGS.length}`);
    console.log(`   API calls:  ~${NAICS_MAPPINGS.reduce((s, m) => s + m.naicsCodes.length, 0) * SERVICE_AREAS.length}`);
    console.log('━'.repeat(50));
    console.log('');

    const cache: CensusCache = {
        generatedAt: new Date().toISOString(),
        censusYear: 2022,
        source: 'U.S. Census Bureau, County Business Patterns',
        entries: {},
    };

    for (const mapping of NAICS_MAPPINGS) {
        console.log(`📊 ${mapping.facilitySlug} (NAICS: ${mapping.naicsCodes.join(', ')})`);
        const entry: CacheEntry = {
            facilitySlug: mapping.facilitySlug,
            areas: {},
        };

        for (const area of SERVICE_AREAS) {
            const counts = await Promise.all(
                mapping.naicsCodes.map(code => fetchCount(area, code))
            );
            const total = counts.reduce((sum, c) => sum + c, 0);
            entry.areas[area.id] = {
                establishments: total,
                areaLabel: area.label,
            };
            console.log(`   ${area.label}: ${total.toLocaleString()}`);

            // Small delay to be respectful of Census API
            await new Promise(r => setTimeout(r, 200));
        }

        cache.entries[mapping.facilitySlug] = entry;
    }

    // Write cache file
    const outPath = path.join(__dirname, '..', 'data', 'census-cache.json');
    fs.writeFileSync(outPath, JSON.stringify(cache, null, 2));

    console.log('');
    console.log('━'.repeat(50));
    console.log(`✅ Cache written to data/census-cache.json`);
    console.log(`   ${Object.keys(cache.entries).length} facility types × ${SERVICE_AREAS.length} areas`);
    console.log(`   Generated: ${cache.generatedAt}`);
    console.log('');
    console.log('Next steps:');
    console.log('   1. Commit census-cache.json');
    console.log('   2. Deploy — pages will show updated stats');
    console.log('');
}

main().catch(console.error);
