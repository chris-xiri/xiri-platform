import seoData from '@/data/seo-data.json';

export const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export interface LocationData {
    slug: string;
    name: string;
    state: string;
    region: string;
    latitude?: number;
    longitude?: number;
    population?: string;
    medicalDensity?: string;
    keyIntersection?: string;
    localInsight?: string;
    complianceNote?: string;
    serviceChallenges?: string;
    whyXiri?: string;
    facilityTypes?: string[];
    landmarks?: string[];
    nearbyCities?: string[];
    zipCodes?: string[];
    localFaqs?: { question: string; answer: string }[];
    lastVerified?: string;
}

export function getAllLocations(): LocationData[] {
    return seoData.locations as LocationData[];
}

export function getLocationBySlugs(stateSlug: string, countySlug: string, townSlug: string): LocationData | undefined {
    return getAllLocations().find(loc => {
        const tSlug = slugify(loc.name.split(',')[0]);
        const cSlug = slugify(loc.region);
        const sSlug = slugify(loc.state);
        return sSlug === stateSlug && cSlug === countySlug && tSlug === townSlug;
    });
}

export function getCountiesByState(stateSlug: string): string[] {
    const locations = getAllLocations().filter(loc => slugify(loc.state) === stateSlug);
    const counties = new Set(locations.map(loc => loc.region));
    return Array.from(counties).sort();
}

export function getTownsByCounty(stateSlug: string, countySlug: string): LocationData[] {
    return getAllLocations().filter(loc => {
        return slugify(loc.state) === stateSlug && slugify(loc.region) === countySlug;
    }).sort((a, b) => a.name.localeCompare(b.name));
}

export function getStates(): string[] {
    const states = new Set(getAllLocations().map(loc => loc.state));
    return Array.from(states).sort();
}

// ─── Subcontractor Allowed Service Area Validator ───
const ALLOWED_COUNTIES_OR_BOROUGHS = [
    'nassau', 'suffolk', 'queens', 'brooklyn', 'kings', 'bronx', 'manhattan', 'new york city', 'nyc', 'new york'
];

const ALLOWED_NY_TOWNS = new Set([
    // Nassau County
    'garden city', 'mineola', 'hicksville', 'levittown', 'freeport', 'hempstead', 'westbury', 
    'great neck', 'manhasset', 'floral park', 'massapequa', 'rockville centre', 'long beach', 
    'valley stream', 'port washington', 'syosset', 'glen cove', 'farmingdale', 'merrick', 
    'bellmore', 'wantagh', 'plainview', 'bethpage', 'oceanside', 'east meadow', 'franklin square', 
    'lynbrook', 'new hyde park', 'jericho', 'carle place', 'woodbury', 'woodmere', 'inwood', 
    'north woodmere', 'lido beach', 'old westbury', 'old bethpage', 'oyster bay', 'sea cliff', 
    'seaford', 'uniondale', 'west hempstead', 'williston park', 'roslyn', 'roslyn heights', 
    'massapequa park', 'malverne', 'roosevelt', 'point lookout',

    // Suffolk County
    'huntington', 'babylon', 'bay shore', 'islip', 'brentwood', 'smithtown', 'commack', 
    'hauppauge', 'patchogue', 'ronkonkoma', 'lake grove', 'riverhead', 'deer park', 
    'lindenhurst', 'west islip', 'centereach', 'bohemia', 'holbrook', 'medford', 'sayville', 
    'east northport', 'kings park', 'port jefferson', 'stony brook', 'coram', 'selden', 
    'east hampton', 'southampton', 'sag harbor', 'hampton bays', 'westhampton', 'mattituck', 
    'cutchogue', 'greenport', 'montauk',

    // Queens Borough
    'flushing', 'jamaica', 'astoria', 'long island city', 'forest hills', 'bayside', 
    'jackson heights', 'rego park', 'elmhurst', 'ridgewood', 'fresh meadows', 'whitestone', 
    'college point', 'woodside', 'kew gardens', 'howard beach', 'ozone park', 'richmond hill', 
    'maspeth', 'glendale', 'far rockaway', 'arverne', 'breezy point',

    // Brooklyn Borough (Kings)
    'brooklyn', 'williamsburg', 'bushwick', 'greenpoint', 'dumbo', 'brooklyn heights', 
    'crown heights', 'flatbush', 'bay ridge', 'sunset park', 'park slope', 'bed stuy', 
    'bedford stuyvesant', 'canarsie', 'bensonhurst', 'coney island', 'sheepshead bay', 'marine park',

    // Bronx Borough
    'bronx', 'riverdale', 'mott haven', 'pelham bay', 'throggs neck', 'fordham', 
    'city island', 'morris park', 'kingsbridge', 'belmont', 'coop city',

    // Manhattan Borough (New York)
    'manhattan', 'new york', 'harlem', 'soho', 'tribeca', 'chelsea', 'midtown', 
    'upper east side', 'upper west side', 'washington heights', 'financial district', 
    'fidi', 'east village', 'west village'
]);

export function isSubcontractorInAllowedServiceArea(city: string, state: string): boolean {
    if (!state) return false;
    const normState = state.trim().toUpperCase();
    if (normState !== 'NY' && normState !== 'NEW YORK') return false;

    if (!city) return true; // Default allow if state is NY and city not entered yet

    const normCity = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (ALLOWED_NY_TOWNS.has(normCity)) return true;
    
    for (const token of ALLOWED_COUNTIES_OR_BOROUGHS) {
        if (normCity.includes(token)) return true;
    }

    for (const town of ALLOWED_NY_TOWNS) {
        if (normCity.includes(town) || town.includes(normCity)) return true;
    }

    return false;
}
