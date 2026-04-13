/**
 * Client-side ICP metadata — lightweight copy of prospectingTargets.ts
 * for display purposes in the ConfigPanel.
 *
 * This avoids coupling the Next.js dashboard build to the Cloud Functions package.
 * Keep in sync with: packages/functions/src/utils/prospectingTargets.ts
 */

// ── ICP Category metadata for grouping queries by tier ──────────────

export interface ICPCategory {
  label: string;
  queries: string[];
  tier: 1 | 2 | 3;
}

export const ICP_CATEGORIES: ICPCategory[] = [
  // Tier 1: Medical & Healthcare
  { label: 'Dental', queries: ['dental office', 'orthodontist', 'pediatric dentist', 'oral surgeon office', 'endodontist'], tier: 1 },
  { label: 'Medical Office', queries: ['medical office', 'doctor office', 'family medicine practice', 'pediatrician office', 'internal medicine office'], tier: 1 },
  { label: 'Specialist Medical', queries: ['dermatologist office', 'eye doctor optometrist', 'ENT doctor office', 'allergist office', 'podiatrist office'], tier: 1 },
  { label: 'Urgent Care & Surgery', queries: ['urgent care clinic', 'outpatient surgery center', 'walk-in clinic'], tier: 1 },
  { label: 'Veterinary', queries: ['veterinary clinic', 'animal hospital', 'pet emergency vet'], tier: 1 },
  { label: 'Physical Therapy & Rehab', queries: ['physical therapy center', 'chiropractor office', 'rehabilitation center'], tier: 1 },
  { label: 'Dialysis', queries: ['dialysis center'], tier: 1 },

  // Tier 2: Commercial
  { label: 'Automotive', queries: ['car dealership', 'auto repair shop', 'auto body shop', 'tire shop'], tier: 2 },
  { label: 'Childcare & Education', queries: ['daycare center', 'preschool', 'childcare center', 'Montessori school'], tier: 2 },
  { label: 'Tutoring & Learning', queries: ['tutoring center', 'learning center', 'test prep center'], tier: 2 },
  { label: 'Fitness & Wellness', queries: ['gym fitness center', 'CrossFit gym', 'yoga studio', 'pilates studio', 'martial arts studio'], tier: 2 },
  { label: 'Retail Storefront', queries: ['retail store', 'boutique shop', 'bridal shop', 'furniture store'], tier: 2 },
  { label: 'Salon & Personal Care', queries: ['hair salon', 'barbershop', 'nail salon', 'spa day spa', 'med spa'], tier: 2 },
  { label: 'Religious Centers', queries: ['church', 'synagogue', 'mosque', 'temple'], tier: 2 },
  { label: 'Funeral Homes', queries: ['funeral home', 'funeral parlor'], tier: 2 },
  { label: 'Pet Services', queries: ['pet grooming', 'doggy daycare', 'pet boarding kennel'], tier: 2 },

  // Tier 3: Professional Services
  { label: 'Legal', queries: ['law firm office', 'attorney office'], tier: 3 },
  { label: 'Insurance & Finance', queries: ['insurance agency office', 'accounting firm office', 'tax preparation office'], tier: 3 },
  { label: 'Real Estate', queries: ['real estate office'], tier: 3 },
  { label: 'Pharmacy', queries: ['pharmacy', 'compounding pharmacy'], tier: 3 },
  { label: 'Dance & Performing Arts', queries: ['dance studio', 'music school', 'performing arts studio'], tier: 3 },
  { label: 'Private Schools', queries: ['private school', 'preparatory school'], tier: 3 },
  { label: 'Light Industrial', queries: ['warehouse', 'light manufacturing facility'], tier: 3 },
];

export const TIER_LABELS: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Medical & Healthcare', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900' },
  2: { label: 'Commercial', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' },
  3: { label: 'Professional Services', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900' },
};

// ── Service regions for grouping locations by county ─────────────────

export interface ServiceCounty {
  county: string;
  state: string;
  towns: string[];
}

export const SERVICE_COUNTIES: ServiceCounty[] = [
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

/**
 * Get all ICP queries as a flat set (lowercased) for quick lookups.
 */
export function getAllICPQueries(): Set<string> {
  const set = new Set<string>();
  for (const cat of ICP_CATEGORIES) {
    for (const q of cat.queries) {
      set.add(q.toLowerCase());
    }
  }
  return set;
}

/**
 * Find which county a location belongs to (by town name matching).
 */
export function findCountyForLocation(location: string): string | null {
  const townPart = location.split(',')[0].trim().toLowerCase();
  for (const county of SERVICE_COUNTIES) {
    if (county.towns.some(t => t.toLowerCase() === townPart)) {
      return county.county;
    }
  }
  return null;
}

/**
 * Group an array of location strings by county.
 * Locations not matching any county go into "Other".
 */
export function groupLocationsByCounty(locations: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const loc of locations) {
    const county = findCountyForLocation(loc) || 'Other';
    if (!groups[county]) groups[county] = [];
    groups[county].push(loc);
  }
  return groups;
}

/**
 * Group queries by their ICP tier.
 * Queries not in any ICP category go into tier 0 ("Custom").
 */
export function groupQueriesByTier(queries: string[]): Record<number, { category: string; query: string }[]> {
  const groups: Record<number, { category: string; query: string }[]> = {};
  const queryLower = new Map(queries.map(q => [q.toLowerCase(), q]));

  // Match known ICP queries
  const matched = new Set<string>();
  for (const cat of ICP_CATEGORIES) {
    for (const catQuery of cat.queries) {
      const original = queryLower.get(catQuery.toLowerCase());
      if (original) {
        if (!groups[cat.tier]) groups[cat.tier] = [];
        groups[cat.tier].push({ category: cat.label, query: original });
        matched.add(catQuery.toLowerCase());
      }
    }
  }

  // Unmatched queries go to tier 0
  for (const q of queries) {
    if (!matched.has(q.toLowerCase())) {
      if (!groups[0]) groups[0] = [];
      groups[0].push({ category: 'Custom', query: q });
    }
  }

  return groups;
}

/**
 * Find ICP categories that have ZERO queries in the current config.
 * Returns categories that could be added.
 */
export function findMissingICPCategories(currentQueries: string[]): ICPCategory[] {
  const currentLower = new Set(currentQueries.map(q => q.toLowerCase()));
  return ICP_CATEGORIES.filter(cat =>
    !cat.queries.some(q => currentLower.has(q.toLowerCase()))
  );
}
