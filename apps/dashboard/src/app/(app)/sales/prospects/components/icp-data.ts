/**
 * Client-side ICP metadata — synced with packages/functions/src/utils/prospectingTargets.ts
 * Focus: Private Dental & Orthodontic Practices across Long Island, NYC 5 Boroughs,
 *        Yonkers, and Westchester County.
 */

export interface ICPCategory {
  label: string;
  queries: string[];
  tier: 1 | 2 | 3;
}

export const ICP_CATEGORIES: ICPCategory[] = [
  // Tier 1: Core Focus — Dental & Orthodontics
  {
    label: 'General & Family Dental',
    queries: ['dental office', 'general dentist', 'family dentist', 'cosmetic dentist', 'dental practice'],
    tier: 1,
  },
  {
    label: 'Orthodontics',
    queries: ['orthodontist', 'orthodontic practice', 'orthodontics clinic', 'invisalign orthodontist', 'braces orthodontist'],
    tier: 1,
  },

  // Tier 2: High-LTV Dental Specialties
  {
    label: 'Pediatric Dentistry',
    queries: ['pediatric dentist', 'children dentist', 'kids dental office'],
    tier: 2,
  },
  {
    label: 'Oral Surgery & Implants',
    queries: ['oral surgeon', 'oral and maxillofacial surgery', 'dental implant specialist'],
    tier: 2,
  },
  {
    label: 'Endo / Perio / Prostho',
    queries: ['endodontist', 'periodontist', 'prosthodontist'],
    tier: 2,
  },

  // Tier 3: Optional Adjacent Medical
  {
    label: 'Private Medical & Urgent Care',
    queries: ['medical office', 'urgent care clinic', 'outpatient surgery center', 'dermatologist office'],
    tier: 3,
  },
];

export const TIER_LABELS: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Core Dental & Orthodontics', color: 'text-emerald-900', bgColor: 'bg-emerald-100 border-emerald-300' },
  2: { label: 'Dental Specialties', color: 'text-blue-900', bgColor: 'bg-blue-100 border-blue-300' },
  3: { label: 'Adjacent Healthcare (Optional)', color: 'text-violet-900', bgColor: 'bg-violet-100 border-violet-300' },
};

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
      'New Hyde Park', 'Jericho', 'Carle Place', 'Roslyn', 'Woodbury',
      'Baldwin', 'Cedarhurst', 'Hewlett', 'Lawrence', 'Seaford', 'Williston Park',
    ],
  },
  {
    county: 'Suffolk',
    state: 'NY',
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

export function getAllICPQueries(): Set<string> {
  const set = new Set<string>();
  for (const cat of ICP_CATEGORIES) {
    for (const q of cat.queries) {
      set.add(q.toLowerCase());
    }
  }
  return set;
}

export function findCountyForLocation(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes('brooklyn')) return 'Brooklyn';
  if (lower.includes('manhattan') || lower.includes('new york, ny')) return 'Manhattan';
  if (lower.includes('bronx')) return 'Bronx';
  if (lower.includes('staten island')) return 'Staten Island';
  if (lower.includes('yonkers') || lower.includes('westchester')) return 'Westchester & Yonkers';

  const townPart = location.split(',')[0].trim().toLowerCase();
  for (const county of SERVICE_COUNTIES) {
    if (county.towns.some(t => t.split(',')[0].trim().toLowerCase() === townPart)) {
      return county.county;
    }
  }
  return null;
}

export function groupLocationsByCounty(locations: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const loc of locations) {
    const county = findCountyForLocation(loc) || 'Other';
    if (!groups[county]) groups[county] = [];
    groups[county].push(loc);
  }
  return groups;
}

export function groupQueriesByTier(queries: string[]): Record<number, { category: string; query: string }[]> {
  const groups: Record<number, { category: string; query: string }[]> = {};
  const queryLower = new Map(queries.map(q => [q.toLowerCase(), q]));

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

  for (const q of queries) {
    if (!matched.has(q.toLowerCase())) {
      if (!groups[0]) groups[0] = [];
      groups[0].push({ category: 'Custom', query: q });
    }
  }

  return groups;
}

export function findMissingICPCategories(currentQueries: string[]): ICPCategory[] {
  const currentLower = new Set(currentQueries.map(q => q.toLowerCase()));
  return ICP_CATEGORIES.filter(cat =>
    cat.tier <= 2 && !cat.queries.some(q => currentLower.has(q.toLowerCase()))
  );
}
