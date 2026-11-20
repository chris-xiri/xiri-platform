/**
 * Prospecting Target Generator — Dental & Orthodontic Metro NY ICP Engine
 *
 * Focused on private, owner/partner-operated Dental and Orthodontic practices
 * across the full NY Metro service area:
 *   - Long Island: Nassau County & Suffolk County
 *   - NYC 5 Boroughs: Manhattan, Brooklyn, Queens, Bronx, Staten Island
 *   - Yonkers & Westchester County
 *
 * Excludes corporate DSO chains, hospital dental clinics, dental labs, and supply vendors.
 */

export interface FacilityCategory {
    /** Human-readable label */
    label: string;
    /** Why this category fits the ICP */
    icpReason: string;
    /** Search queries that surface these businesses on Google Places */
    queries: string[];
    /** Priority tier: 1 = core (Dental & Orthodontics), 2 = Dental Specialties, 3 = Adjacent Medical */
    tier: 1 | 2 | 3;
}

const ICP_CATEGORIES: FacilityCategory[] = [
    // ── TIER 1: Core Focus — Private Dental & Orthodontic Practices ──
    {
        label: 'General & Family Dental',
        icpReason: 'Private multi-operatory suites. OSHA 1910.1030 & CDC DHCP compliance, Ultraleather chair safety, nightly verification.',
        queries: [
            'dental office',
            'general dentist',
            'family dentist',
            'cosmetic dentist',
            'dental practice',
        ],
        tier: 1,
    },
    {
        label: 'Orthodontics',
        icpReason: 'High-traffic open-bay clinics with teen/parent waiting rooms, bonding dust, iTero scanners, and high parent visual standards.',
        queries: [
            'orthodontist',
            'orthodontic practice',
            'orthodontics clinic',
            'invisalign orthodontist',
            'braces orthodontist',
        ],
        tier: 1,
    },

    // ── TIER 2: High-LTV Dental Specialties ──
    {
        label: 'Pediatric Dentistry',
        icpReason: 'Parents scrutinize waiting room and operatory cleanliness; non-toxic EPA List N & NYS Part 226 compliance critical.',
        queries: [
            'pediatric dentist',
            'children dentist',
            'kids dental office',
        ],
        tier: 2,
    },
    {
        label: 'Oral Surgery & Implants',
        icpReason: 'Surgical-grade terminal cleaning, high bloodborne pathogen exposure, strict post-procedure sanitation.',
        queries: [
            'oral surgeon',
            'oral and maxillofacial surgery',
            'dental implant specialist',
        ],
        tier: 2,
    },
    {
        label: 'Endodontics, Periodontics & Prosthodontics',
        icpReason: 'High-margin specialist practices with expensive microscopy/CBCT imaging and dedicated operatories.',
        queries: [
            'endodontist',
            'periodontist',
            'prosthodontist',
        ],
        tier: 2,
    },

    // ── TIER 3: Optional Adjacent Private Healthcare (off by default) ──
    {
        label: 'Private Medical & Urgent Care',
        icpReason: 'Optional expansion tier if dental/ortho capacity is saturated.',
        queries: [
            'medical office',
            'urgent care clinic',
            'outpatient surgery center',
            'dermatologist office',
        ],
        tier: 3,
    },
];

// ══════════════════════════════════════════════════════════════════════
// SERVICE AREA — Full Metro NY (Long Island, 5 Boroughs, Yonkers & Westchester)
// ══════════════════════════════════════════════════════════════════════

export interface ServiceRegion {
    county: string;
    state: string;
    /** Postal city names Google Maps returns for addresses in this region */
    postalCities: string[];
    /** 3-digit NY ZIP prefixes belonging to this region */
    zipPrefixes: string[];
    towns: string[];
}

const SERVICE_REGIONS: ServiceRegion[] = [
    {
        county: 'Nassau',
        state: 'NY',
        postalCities: ['nassau'],
        zipPrefixes: ['110', '115', '117', '118'],
        towns: [
            'Garden City', 'Mineola', 'Hicksville', 'Levittown', 'Freeport',
            'Hempstead', 'Westbury', 'Great Neck', 'Manhasset', 'Floral Park',
            'Massapequa', 'Rockville Centre', 'Long Beach', 'Valley Stream',
            'Port Washington', 'Syosset', 'Glen Cove', 'Farmingdale',
            'Merrick', 'Bellmore', 'Wantagh', 'Plainview', 'Bethpage',
            'Oceanside', 'East Meadow', 'Franklin Square', 'Lynbrook',
            'New Hyde Park', 'Jericho', 'Carle Place', 'Roslyn', 'Woodbury',
            'Baldwin', 'Cedarhurst', 'Hewlett', 'Lawrence', 'Seaford', 'Williston Park',
        ],
    },
    {
        county: 'Suffolk',
        state: 'NY',
        postalCities: ['suffolk'],
        zipPrefixes: ['117', '119'],
        towns: [
            'Huntington', 'Melville', 'Babylon', 'Bay Shore', 'Islip',
            'Brentwood', 'Smithtown', 'Commack', 'Hauppauge', 'Patchogue',
            'Ronkonkoma', 'Lake Grove', 'Riverhead', 'Deer Park', 'Lindenhurst',
            'West Islip', 'Centereach', 'Bohemia', 'Holbrook', 'Medford',
            'Sayville', 'East Northport', 'Northport', 'Kings Park',
            'Port Jefferson', 'Stony Brook', 'East Setauket', 'Coram', 'Selden',
            'Southampton', 'East Hampton', 'Westhampton Beach', 'Amityville',
            'Copiague', 'Miller Place', 'Rocky Point', 'Shirley',
        ],
    },
    {
        county: 'Queens',
        state: 'NY',
        postalCities: ['queens', 'long island city', 'flushing', 'jamaica', 'astoria', 'forest hills', 'bayside', 'elmhurst', 'rego park', 'jackson heights', 'woodside', 'whitestone', 'fresh meadows', 'ridgewood', 'kew gardens', 'howard beach', 'ozone park', 'richmond hill', 'maspeth', 'glendale', 'college point', 'douglaston', 'little neck', 'sunnyside', 'middle village', 'corona', 'far rockaway'],
        zipPrefixes: ['110', '111', '113', '114', '116'],
        towns: [
            'Flushing', 'Jamaica', 'Astoria', 'Long Island City',
            'Forest Hills', 'Bayside', 'Jackson Heights', 'Rego Park',
            'Elmhurst', 'Ridgewood', 'Fresh Meadows', 'Whitestone',
            'College Point', 'Woodside', 'Kew Gardens', 'Howard Beach',
            'Ozone Park', 'Richmond Hill', 'Maspeth', 'Glendale',
            'Sunnyside', 'Middle Village', 'Douglaston', 'Little Neck',
        ],
    },
    {
        county: 'Brooklyn',
        state: 'NY',
        postalCities: ['brooklyn', 'kings'],
        zipPrefixes: ['112'],
        towns: [
            'Park Slope, Brooklyn', 'Brooklyn Heights, Brooklyn', 'Williamsburg, Brooklyn',
            'Bay Ridge, Brooklyn', 'Bensonhurst, Brooklyn', 'Dyker Heights, Brooklyn',
            'Midwood, Brooklyn', 'Sheepshead Bay, Brooklyn', 'Borough Park, Brooklyn',
            'Carroll Gardens, Brooklyn', 'Cobble Hill, Brooklyn', 'Greenpoint, Brooklyn',
            'Fort Greene, Brooklyn', 'Downtown Brooklyn', 'Dumbo, Brooklyn',
            'Flatbush, Brooklyn', 'Crown Heights, Brooklyn', 'Prospect Heights, Brooklyn',
            'Marine Park, Brooklyn', 'Mill Basin, Brooklyn', 'Sunset Park, Brooklyn',
            'Bushwick, Brooklyn', 'Bedford-Stuyvesant, Brooklyn',
        ],
    },
    {
        county: 'Manhattan',
        state: 'NY',
        postalCities: ['new york', 'manhattan'],
        zipPrefixes: ['100', '101', '102'],
        towns: [
            'Upper East Side, Manhattan', 'Upper West Side, Manhattan',
            'Midtown East, Manhattan', 'Midtown West, Manhattan',
            'Murray Hill, Manhattan', 'Gramercy, Manhattan',
            'Chelsea, Manhattan', 'Flatiron, Manhattan',
            'SoHo, Manhattan', 'Tribeca, Manhattan',
            'Greenwich Village, Manhattan', 'East Village, Manhattan',
            'Financial District, Manhattan', 'Lower East Side, Manhattan',
            'Harlem, Manhattan', 'Washington Heights, Manhattan',
            'Battery Park City, Manhattan', 'Kips Bay, Manhattan',
            'Hell\'s Kitchen, Manhattan', 'Yorkville, Manhattan',
        ],
    },
    {
        county: 'Bronx',
        state: 'NY',
        postalCities: ['bronx', 'the bronx'],
        zipPrefixes: ['104'],
        towns: [
            'Riverdale, Bronx', 'Morris Park, Bronx', 'Pelham Bay, Bronx',
            'Throgs Neck, Bronx', 'Kingsbridge, Bronx', 'Fordham, Bronx',
            'Parkchester, Bronx', 'Concourse, Bronx', 'Woodlawn, Bronx',
            'Mott Haven, Bronx', 'Country Club, Bronx', 'Baychester, Bronx',
        ],
    },
    {
        county: 'Staten Island',
        state: 'NY',
        postalCities: ['staten island', 'richmond'],
        zipPrefixes: ['103'],
        towns: [
            'New Dorp, Staten Island', 'Great Kills, Staten Island',
            'St. George, Staten Island', 'Todt Hill, Staten Island',
            'Eltingville, Staten Island', 'Annadale, Staten Island',
            'Tottenville, Staten Island', 'West Brighton, Staten Island',
            'Huguenot, Staten Island', 'Bull\'s Head, Staten Island',
        ],
    },
    {
        county: 'Westchester & Yonkers',
        state: 'NY',
        postalCities: ['yonkers', 'westchester'],
        zipPrefixes: ['105', '106', '107', '108'],
        towns: [
            'Yonkers', 'White Plains', 'New Rochelle', 'Scarsdale',
            'Rye', 'Harrison', 'Mamaroneck', 'Larchmont',
            'Bronxville', 'Eastchester', 'Tuckahoe', 'Mount Vernon',
            'Pelham', 'Tarrytown', 'Sleepy Hollow', 'Dobbs Ferry',
            'Hastings-on-Hudson', 'Irvington', 'Ardsley', 'Hartsdale',
            'Armonk', 'Chappaqua', 'Mount Kisco', 'Rye Brook',
            'Port Chester', 'Yorktown Heights', 'Ossining', 'Peekskill',
        ],
    },
];

// ══════════════════════════════════════════════════════════════════════
// CONFIG GENERATOR
// ══════════════════════════════════════════════════════════════════════

export interface GeneratedConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    maxDailyOutreach: number;
    autoEnrollEnabled: boolean;
    autoEnrollMinIcp: number;
    enabled: boolean;
    excludePatterns: string[];
    _generatorMeta: {
        totalCombos: number;
        estimatedWeeksOfFreshData: number;
        tierBreakdown: Record<string, number>;
        regions: string[];
        generatedAt: string;
    };
}

/**
 * Generate an optimized Dental & Orthodontic Metro NY prospecting config.
 * Defaults to Tiers 1 & 2 (General/Family Dental, Orthodontics, Pediatric, Oral Surgery, Endo/Perio/Prostho).
 */
export function generateProspectingConfig(options?: {
    tiers?: (1 | 2 | 3)[];
    categories?: string[];
    regions?: string[];
    maxQueriesPerCategory?: number;
    includeCountyFallback?: boolean;
    dailyTarget?: number;
    maxDailyOutreach?: number;
    autoEnrollEnabled?: boolean;
    autoEnrollMinIcp?: number;
}): GeneratedConfig {
    const tiers = options?.tiers ?? [1, 2];
    const categoryFilters = options?.categories?.map(c => c.toLowerCase());
    const regionFilters = options?.regions?.map(r => r.toLowerCase());
    const maxPerCat = options?.maxQueriesPerCategory ?? 99;
    const includeCounty = options?.includeCountyFallback ?? false;
    const dailyTarget = options?.dailyTarget ?? 60;
    const maxDailyOutreach = options?.maxDailyOutreach ?? 30;
    const autoEnrollEnabled = options?.autoEnrollEnabled ?? true;
    const autoEnrollMinIcp = options?.autoEnrollMinIcp ?? 75;

    const queries: string[] = [];
    const tierBreakdown: Record<string, number> = {};

    for (const cat of ICP_CATEGORIES) {
        if (!tiers.includes(cat.tier)) continue;
        if (categoryFilters && categoryFilters.length > 0 && !categoryFilters.includes(cat.label.toLowerCase())) continue;
        const tierKey = `tier${cat.tier}`;
        const catQueries = cat.queries.slice(0, maxPerCat);
        queries.push(...catQueries);
        tierBreakdown[tierKey] = (tierBreakdown[tierKey] || 0) + catQueries.length;
    }

    const locations: string[] = [];
    const includedRegions: string[] = [];
    for (const region of SERVICE_REGIONS) {
        if (regionFilters && regionFilters.length > 0 && !regionFilters.includes(region.county.toLowerCase())) {
            continue;
        }
        includedRegions.push(region.county);
        for (const town of region.towns) {
            locations.push(`${town}, ${region.state}`);
        }
        if (includeCounty) {
            locations.push(`${region.county}, ${region.state}`);
        }
    }

    const totalCombos = queries.length * locations.length;
    const estimatedWeeksOfFreshData = Math.max(1, Math.floor(totalCombos / Math.max(1, dailyTarget / 3) / 7));

    return {
        queries,
        locations,
        dailyTarget,
        maxDailyOutreach,
        autoEnrollEnabled,
        autoEnrollMinIcp,
        enabled: true,
        excludePatterns: [
            'aspen dental',
            'heartland dental',
            'pacific dental',
            'tend dental',
            'dental365',
            'prohealth dental',
            'clearchoice',
            'great expressions',
            'dental lab',
            'dental supply',
            'hospital',
        ],
        _generatorMeta: {
            totalCombos,
            estimatedWeeksOfFreshData,
            tierBreakdown,
            regions: includedRegions,
            generatedAt: new Date().toISOString(),
        },
    };
}

export function getConfigSummary(config: GeneratedConfig): string {
    const meta = config._generatorMeta;
    return [
        `📊 Dental & Ortho Metro NY Prospecting Config Generated`,
        `   Queries: ${config.queries.length}`,
        `   Locations: ${config.locations.length} across ${meta.regions.join(', ')}`,
        `   Total Combos: ${meta.totalCombos}`,
        `   Daily Discovery Target: ${config.dailyTarget} | Max Daily Emails: ${config.maxDailyOutreach}`,
        `   Auto-Enroll: ${config.autoEnrollEnabled ? `ON (ICP >= ${config.autoEnrollMinIcp})` : 'OFF'}`,
        `   Est. Weeks of Fresh Data: ${meta.estimatedWeeksOfFreshData}`,
    ].join('\n');
}

export { ICP_CATEGORIES, SERVICE_REGIONS };
