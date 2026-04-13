/**
 * Prospecting Target Generator — Ideal Customer Profile (ICP) Engine
 *
 * Auto-generates optimized search queries and locations based on XIRI's ICP:
 *   → Single-tenant buildings
 *   → Single-tenant suites where janitorial is NOT included by the landlord
 *
 * These are businesses that manage their own cleaning — medical offices,
 * dental practices, gyms, vet clinics, daycares, dealerships, etc.
 *
 * Excludes: Generic "office building" (Class A/B buildings provide janitorial),
 * mall tenants (shared CAM), co-working spaces, etc.
 */

// ══════════════════════════════════════════════════════════════════════
// ICP FACILITY CATEGORIES — Each generates multiple Serper Places queries
// ══════════════════════════════════════════════════════════════════════

interface FacilityCategory {
    /** Human-readable label */
    label: string;
    /** Why this category fits the ICP */
    icpReason: string;
    /** Search queries that surface these businesses on Google Places */
    queries: string[];
    /** Priority tier: 1 = highest (medical), 2 = mid, 3 = nice-to-have */
    tier: 1 | 2 | 3;
}

const ICP_CATEGORIES: FacilityCategory[] = [
    // ── TIER 1: Medical & Healthcare (highest LTV, strictest cleaning needs) ──
    {
        label: 'Dental',
        icpReason: 'Always single-tenant suite. OSHA mandates sterile environment. High cleaning frequency.',
        queries: ['dental office', 'orthodontist', 'pediatric dentist', 'oral surgeon office', 'endodontist'],
        tier: 1,
    },
    {
        label: 'Medical Office',
        icpReason: 'Private practices lease suites and manage own cleaning. Compliance-driven.',
        queries: ['medical office', 'doctor office', 'family medicine practice', 'pediatrician office', 'internal medicine office'],
        tier: 1,
    },
    {
        label: 'Specialist Medical',
        icpReason: 'Specialist suites are always tenant-responsible for cleaning.',
        queries: ['dermatologist office', 'eye doctor optometrist', 'ENT doctor office', 'allergist office', 'podiatrist office'],
        tier: 1,
    },
    {
        label: 'Urgent Care & Surgery',
        icpReason: 'Standalone or anchor tenant. High-margin terminal cleaning.',
        queries: ['urgent care clinic', 'outpatient surgery center', 'walk-in clinic'],
        tier: 1,
    },
    {
        label: 'Veterinary',
        icpReason: 'Almost always standalone buildings. Odor/sanitation critical.',
        queries: ['veterinary clinic', 'animal hospital', 'pet emergency vet'],
        tier: 1,
    },
    {
        label: 'Physical Therapy & Rehab',
        icpReason: 'Suite or standalone. Equipment requires specialized cleaning.',
        queries: ['physical therapy center', 'chiropractor office', 'rehabilitation center'],
        tier: 1,
    },
    {
        label: 'Dialysis',
        icpReason: 'Standalone. Biohazard cleaning, CMS regulated.',
        queries: ['dialysis center'],
        tier: 1,
    },

    // ── TIER 2: Commercial Businesses (good volume, moderate LTV) ──
    {
        label: 'Automotive',
        icpReason: 'Always standalone lot + building. Showroom + service bays.',
        queries: ['car dealership', 'auto repair shop', 'auto body shop', 'tire shop'],
        tier: 2,
    },
    {
        label: 'Childcare & Education',
        icpReason: 'Standalone or strip mall. Health dept mandates cleaning. Parents expect spotless.',
        queries: ['daycare center', 'preschool', 'childcare center', 'Montessori school'],
        tier: 2,
    },
    {
        label: 'Tutoring & Learning',
        icpReason: 'Strip mall/standalone suite. Manage own cleaning.',
        queries: ['tutoring center', 'learning center', 'test prep center'],
        tier: 2,
    },
    {
        label: 'Fitness & Wellness',
        icpReason: 'Standalone or anchor tenant. High-traffic, equipment sanitation critical.',
        queries: ['gym fitness center', 'CrossFit gym', 'yoga studio', 'pilates studio', 'martial arts studio'],
        tier: 2,
    },
    {
        label: 'Retail Storefront',
        icpReason: 'Strip mall or standalone. Tenant manages own cleaning.',
        queries: ['retail store', 'boutique shop', 'bridal shop', 'furniture store'],
        tier: 2,
    },
    {
        label: 'Salon & Personal Care',
        icpReason: 'Suite/strip mall tenant. Cleaning is tenant responsibility.',
        queries: ['hair salon', 'barbershop', 'nail salon', 'spa day spa', 'med spa'],
        tier: 2,
    },
    {
        label: 'Religious Centers',
        icpReason: 'Standalone buildings. Large common areas. Weekly deep clean.',
        queries: ['church', 'synagogue', 'mosque', 'temple'],
        tier: 2,
    },
    {
        label: 'Funeral Homes',
        icpReason: 'Always standalone. Discretion and presentation critical.',
        queries: ['funeral home', 'funeral parlor'],
        tier: 2,
    },
    {
        label: 'Pet Services',
        icpReason: 'Standalone/strip mall. Odor control and sanitation critical.',
        queries: ['pet grooming', 'doggy daycare', 'pet boarding kennel'],
        tier: 2,
    },

    // ── TIER 3: Professional Services (in small buildings or strip malls) ──
    {
        label: 'Legal',
        icpReason: 'Small firms in standalone or strip. NOT in Class A towers (those have building janitorial).',
        queries: ['law firm office', 'attorney office'],
        tier: 3,
    },
    {
        label: 'Insurance & Finance',
        icpReason: 'Agency offices in strip malls / small buildings. Manage own cleaning.',
        queries: ['insurance agency office', 'accounting firm office', 'tax preparation office'],
        tier: 3,
    },
    {
        label: 'Real Estate',
        icpReason: 'Brokerage offices in standalone / strip. Manage own cleaning.',
        queries: ['real estate office'],
        tier: 3,
    },
    {
        label: 'Pharmacy',
        icpReason: 'Independent pharmacies in strip malls. Chain pharmacies less likely.',
        queries: ['pharmacy', 'compounding pharmacy'],
        tier: 3,
    },
    {
        label: 'Dance & Performing Arts',
        icpReason: 'Studios in strip or standalone. High floor care needs.',
        queries: ['dance studio', 'music school', 'performing arts studio'],
        tier: 3,
    },
    {
        label: 'Private Schools',
        icpReason: 'Campus buildings. Large-scale cleaning needs.',
        queries: ['private school', 'preparatory school'],
        tier: 3,
    },
    {
        label: 'Light Industrial',
        icpReason: 'Warehouse/light manufacturing. Standalone or industrial park.',
        queries: ['warehouse', 'light manufacturing facility'],
        tier: 3,
    },
];

// ══════════════════════════════════════════════════════════════════════
// SERVICE AREA — Town-level locations for granular Serper results
// ══════════════════════════════════════════════════════════════════════

interface ServiceRegion {
    county: string;
    state: string;
    towns: string[];
}

const SERVICE_REGIONS: ServiceRegion[] = [
    {
        county: 'Nassau',
        state: 'NY',
        towns: [
            'Garden City', 'Mineola', 'Hicksville', 'Levittown', 'Freeport',
            'Hempstead', 'Westbury', 'Great Neck', 'Manhasset', 'Floral Park',
            'Massapequa', 'Rockville Centre', 'Long Beach', 'Valley Stream',
            'Port Washington', 'Syosset', 'Glen Cove', 'Farmingdale',
            'Merrick', 'Bellmore', 'Wantagh', 'Plainview', 'Bethpage',
            'Oceanside', 'East Meadow', 'Franklin Square', 'Lynbrook',
            'New Hyde Park', 'Jericho', 'Carle Place',
        ],
    },
    {
        county: 'Suffolk',
        state: 'NY',
        towns: [
            'Huntington', 'Babylon', 'Bay Shore', 'Islip', 'Brentwood',
            'Smithtown', 'Commack', 'Hauppauge', 'Patchogue', 'Ronkonkoma',
            'Lake Grove', 'Riverhead', 'Deer Park', 'Lindenhurst',
            'West Islip', 'Centereach', 'Bohemia', 'Holbrook',
            'Medford', 'Sayville', 'East Northport', 'Kings Park',
            'Port Jefferson', 'Stony Brook', 'Coram', 'Selden',
        ],
    },
    {
        county: 'Queens',
        state: 'NY',
        towns: [
            'Flushing', 'Jamaica', 'Astoria', 'Long Island City',
            'Forest Hills', 'Bayside', 'Jackson Heights', 'Rego Park',
            'Elmhurst', 'Ridgewood', 'Fresh Meadows', 'Whitestone',
            'College Point', 'Woodside', 'Kew Gardens', 'Howard Beach',
            'Ozone Park', 'Richmond Hill', 'Maspeth', 'Glendale',
        ],
    },
];

// ══════════════════════════════════════════════════════════════════════
// CONFIG GENERATOR
// ══════════════════════════════════════════════════════════════════════

interface GeneratedConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    enabled: boolean;
    excludePatterns: string[];
    /** Metadata about the generated config for review */
    _generatorMeta: {
        totalCombos: number;
        estimatedWeeksOfFreshData: number;
        tierBreakdown: Record<string, number>;
        generatedAt: string;
    };
}

/**
 * Generate an optimized prospecting config based on the ICP.
 *
 * @param options.tiers - Which priority tiers to include (default: all)
 * @param options.maxQueriesPerCategory - Cap queries per category to limit API spend
 * @param options.includeCountyFallback - Also include county-level queries as fallback
 */
export function generateProspectingConfig(options?: {
    tiers?: (1 | 2 | 3)[];
    maxQueriesPerCategory?: number;
    includeCountyFallback?: boolean;
    dailyTarget?: number;
}): GeneratedConfig {
    const tiers = options?.tiers ?? [1, 2, 3];
    const maxPerCat = options?.maxQueriesPerCategory ?? 99; // no limit by default
    const includeCounty = options?.includeCountyFallback ?? false;
    const dailyTarget = options?.dailyTarget ?? 100;

    // Build queries from selected tiers
    const queries: string[] = [];
    const tierBreakdown: Record<string, number> = {};

    for (const cat of ICP_CATEGORIES) {
        if (!tiers.includes(cat.tier)) continue;
        const tierKey = `tier${cat.tier}`;
        const catQueries = cat.queries.slice(0, maxPerCat);
        queries.push(...catQueries);
        tierBreakdown[tierKey] = (tierBreakdown[tierKey] || 0) + catQueries.length;
    }

    // Build locations (town-level)
    const locations: string[] = [];
    for (const region of SERVICE_REGIONS) {
        for (const town of region.towns) {
            locations.push(`${town}, ${region.state}`);
        }
        if (includeCounty) {
            locations.push(`${region.county} County, ${region.state}`);
        }
    }

    const totalCombos = queries.length * locations.length;
    // Each combo yields ~3-5 net new prospects. Conservative estimate: 3.
    // 7 day cache → need totalCombos / 7 per day at minimum
    const estimatedWeeksOfFreshData = Math.floor(totalCombos / (dailyTarget / 3) / 7);

    return {
        queries,
        locations,
        dailyTarget,
        enabled: true,
        excludePatterns: [],
        _generatorMeta: {
            totalCombos,
            estimatedWeeksOfFreshData,
            tierBreakdown,
            generatedAt: new Date().toISOString(),
        },
    };
}

/**
 * Get a human-readable summary of what was generated.
 * Useful for logging or dashboard display.
 */
export function getConfigSummary(config: GeneratedConfig): string {
    const meta = config._generatorMeta;
    return [
        `📊 Prospecting Config Generated`,
        `   Queries: ${config.queries.length}`,
        `   Locations: ${config.locations.length}`,
        `   Total Combos: ${meta.totalCombos}`,
        `   Daily Target: ${config.dailyTarget}`,
        `   Est. Weeks of Fresh Data: ${meta.estimatedWeeksOfFreshData}`,
        `   Tier Breakdown: ${JSON.stringify(meta.tierBreakdown)}`,
        ``,
        `   Sample queries: ${config.queries.slice(0, 5).join(', ')}...`,
        `   Sample locations: ${config.locations.slice(0, 5).join(', ')}...`,
    ].join('\n');
}

// Export for use in other modules
export { ICP_CATEGORIES, SERVICE_REGIONS };
export type { FacilityCategory, ServiceRegion };
