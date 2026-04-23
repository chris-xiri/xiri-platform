import axios from 'axios';
import * as crypto from 'crypto';
import { db } from '../utils/firebase';
import { SERVICE_REGIONS } from '../utils/prospectingTargets';

// Define the shape of a raw vendor outcome
export interface RawVendor {
    name: string;
    description: string;
    location: string;
    phone?: string;
    website?: string;
    source: string;
    rating?: number;
    user_ratings_total?: number;
    dcaCategory?: string;
}

const STATE_NAME_TO_CODE: Record<string, string> = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
    missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
    'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
    texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
    'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
    'district of columbia': 'DC',
};

const STATE_CODE_TO_NAME = Object.fromEntries(
    Object.entries(STATE_NAME_TO_CODE).map(([name, code]) => [code, name])
) as Record<string, string>;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeToken(value: string): string {
    return normalizeWhitespace(value.toLowerCase().replace(/[^a-z0-9\s]/g, ''));
}

function extractStateCode(value: string): string | null {
    const token = normalizeToken(value);
    if (!token) return null;
    const maybeCode = token.toUpperCase();
    if (/^[A-Z]{2}$/.test(maybeCode) && STATE_CODE_TO_NAME[maybeCode]) return maybeCode;
    return STATE_NAME_TO_CODE[token] || null;
}

function parseLocationConstraint(location: string): { city: string | null; stateCode: string | null } {
    const parts = location
        .split(',')
        .map(p => normalizeWhitespace(p))
        .filter(Boolean);

    let stateCode: string | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
        const code = extractStateCode(parts[i]);
        if (code) {
            stateCode = code;
            break;
        }
    }

    const firstPart = parts[0] || '';
    const city = firstPart ? normalizeToken(firstPart.replace(/\bcounty\b/gi, '')) : null;

    return {
        city: city || null,
        stateCode,
    };
}

const ALLOWED_SERVICE_STATE = 'NY';
const ALLOWED_SERVICE_COUNTY_TOKENS = new Set(
    SERVICE_REGIONS.map(r => normalizeToken(r.county))
);
const ALLOWED_SERVICE_CITY_TOKENS = new Set(
    SERVICE_REGIONS.flatMap(r => r.towns.map(t => normalizeToken(t)))
);

function extractCityTokenFromAddress(address: string): string | null {
    const parts = address.split(',').map(p => normalizeWhitespace(p)).filter(Boolean);
    // Typical format: street, city, state zip
    if (parts.length >= 2) return normalizeToken(parts[1]);
    return null;
}

function extractCountyTokenFromAddress(address: string): string | null {
    const normalized = normalizeToken(address);
    for (const county of ALLOWED_SERVICE_COUNTY_TOKENS) {
        if (normalized.includes(`${county} county`) || normalized.includes(county)) {
            return county;
        }
    }
    return null;
}

function isInsideCoreServiceArea(vendorLocation: string | undefined): boolean {
    if (!vendorLocation) return false;
    if (!addressHasState(vendorLocation, ALLOWED_SERVICE_STATE)) return false;

    const city = extractCityTokenFromAddress(vendorLocation);
    if (city && ALLOWED_SERVICE_CITY_TOKENS.has(city)) return true;

    const county = extractCountyTokenFromAddress(vendorLocation);
    if (county && ALLOWED_SERVICE_COUNTY_TOKENS.has(county)) return true;

    return false;
}

function addressContainsCity(address: string, city: string): boolean {
    const normalizedAddress = normalizeToken(address);
    if (!normalizedAddress || !city) return false;
    return normalizedAddress.includes(city);
}

function addressHasState(address: string, stateCode: string): boolean {
    const normalizedAddress = normalizeWhitespace(address);
    if (!normalizedAddress || !stateCode) return false;

    const codeRegex = new RegExp(`[,\\s]${stateCode}(?:\\s+\\d{5}(?:-\\d{4})?|[,\\s]|$)`, 'i');
    if (codeRegex.test(normalizedAddress)) return true;

    const fullName = STATE_CODE_TO_NAME[stateCode];
    if (!fullName) return false;
    const fullNameRegex = new RegExp(`\\b${fullName}\\b`, 'i');
    return fullNameRegex.test(normalizedAddress);
}

function vendorMatchesLocationConstraint(vendorLocation: string | undefined, requestedLocation: string): boolean {
    if (!vendorLocation) return false;
    if (!isInsideCoreServiceArea(vendorLocation)) return false;

    const constraint = parseLocationConstraint(requestedLocation);
    const hasCityConstraint = !!constraint.city;
    const hasStateConstraint = !!constraint.stateCode;

    if (!hasCityConstraint && !hasStateConstraint) return true;

    if (hasStateConstraint && !addressHasState(vendorLocation, constraint.stateCode!)) {
        return false;
    }

    if (hasCityConstraint && !addressContainsCity(vendorLocation, constraint.city!)) {
        return false;
    }

    return true;
}

// ── 7-day Serper Places cache ────────────────────────────────────────
const CACHE_COLLECTION = 'serper_places_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(query: string, location: string): string {
    const raw = `${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

async function getCachedPlaces(query: string, location: string): Promise<RawVendor[] | null> {
    try {
        const docId = cacheKey(query, location);
        const doc = await db.collection(CACHE_COLLECTION).doc(docId).get();
        if (!doc.exists) return null;

        const data = doc.data()!;
        const cachedAt = data.cachedAt?.toDate?.() || new Date(data.cachedAt);
        const age = Date.now() - cachedAt.getTime();

        if (age > CACHE_TTL_MS) {
            // Expired — let caller fetch fresh data (don't delete; just ignore)
            console.log(`[PlacesCache] Expired for "${query}" in "${location}" (age: ${Math.round(age / 3600000)}h)`);
            return null;
        }

        console.log(`[PlacesCache] HIT for "${query}" in "${location}" (age: ${Math.round(age / 3600000)}h, ${data.results?.length || 0} results)`);
        return data.results as RawVendor[];
    } catch (err: any) {
        console.warn(`[PlacesCache] Read error: ${err.message}`);
        return null;
    }
}

async function setCachedPlaces(query: string, location: string, results: RawVendor[]): Promise<void> {
    try {
        const docId = cacheKey(query, location);
        await db.collection(CACHE_COLLECTION).doc(docId).set({
            query: query.toLowerCase().trim(),
            location: location.toLowerCase().trim(),
            results,
            resultCount: results.length,
            cachedAt: new Date(),
        });
        console.log(`[PlacesCache] SET for "${query}" in "${location}" (${results.length} results)`);
    } catch (err: any) {
        // Non-fatal — just skip caching
        console.warn(`[PlacesCache] Write error: ${err.message}`);
    }
}

/**
 * Lead Sourcing Agent
 * Supports multiple data providers:
 * - google_maps (default): Serper.dev / Google Maps
 * - nyc_open_data: NYC DCA + NY State SODA APIs — licensed, verified businesses
 * - all: Both sources combined and deduplicated
 *
 * Requires: process.env.SERPER_API_KEY (for google_maps)
 * 
 * Results are cached in Firestore for 7 days to avoid redundant API calls
 * when the same query+location combo runs daily.
 */
export const searchVendors = async (
    query: string,
    location: string,
    provider: 'google_maps' | 'nyc_open_data' | 'all' = 'google_maps',
    dcaCategory?: string
): Promise<RawVendor[]> => {
    console.log(`Searching for: "${query}" in "${location}" [provider: ${provider}]`);

    // ─── NYC Open Data Only ───
    if (provider === 'nyc_open_data') {
        const { searchVendorsSoda } = await import('./sodaSourcer');
        return searchVendorsSoda(query, location, dcaCategory);
    }

    // ─── Google Maps ───
    const apiKey = process.env.SERPER_API_KEY || "02ece77ffd27d2929e3e79604cb27e1dfaa40fe7";
    if (!apiKey) {
        console.warn("SERPER_API_KEY is not set. Returning mock data.");
        return getMockVendors(query, location);
    }

    // ─── Check cache first ───
    const cached = await getCachedPlaces(query, location);
    if (cached !== null) {
        const filteredCached = cached.filter(v => vendorMatchesLocationConstraint(v.location, location));
        if (filteredCached.length !== cached.length) {
            console.log(`[PlacesCache] Geo-filtered cached results ${cached.length} -> ${filteredCached.length} (location="${location}").`);
        }
        return filteredCached;
    }

    const fullQuery = `${query} in ${location}`;
    console.log(`Searching for: ${fullQuery} using Serper (places)...`);

    let googleResults: RawVendor[] = [];

    try {
        const response = await axios.post(
            'https://google.serper.dev/places',
            { q: fullQuery },
            { headers: { 'X-API-KEY': apiKey.trim(), 'Content-Type': 'application/json' } }
        );

        const places = response.data.places || [];
        console.log(`Serper returned ${places.length} raw results.`);

        const rawVendors = places.map((place: any) => ({
            name: place.title,
            description: `${place.category || ''} - ${place.address || ''}`,
            location: place.address,
            phone: place.phoneNumber,
            website: place.website,
            source: 'google_maps_serper',
            rating: place.rating,
            user_ratings_total: place.userRatingsTotal
        }));

        // First enforce city/state constraint to prevent cross-state bleed (e.g., Medford, NJ for Medford, NY).
        const locationFiltered = rawVendors.filter((v: any) => vendorMatchesLocationConstraint(v.location, location));
        console.log(`Geo-filtered ${rawVendors.length} -> ${locationFiltered.length} vendors (location="${location}").`);

        // Then filter out low-rated vendors.
        googleResults = locationFiltered.filter((v: any) => v.rating === undefined || v.rating >= 3.5);
        console.log(`Quality-filtered ${locationFiltered.length} -> ${googleResults.length} vendors (Rating >= 3.5 or N/A).`);

        // ─── Cache the filtered results ───
        await setCachedPlaces(query, location, googleResults);

    } catch (error: any) {
        console.error("Error searching vendors via Google:", error.message);
        if (provider !== 'all') {
            throw new Error(`Failed to source vendors: ${error.message}`);
        }
    }

    // ─── Combined (All Sources) ───
    if (provider === 'all') {
        const { searchVendorsSoda } = await import('./sodaSourcer');
        const sodaResults = await searchVendorsSoda(query, location, dcaCategory);

        const combined = [...googleResults, ...sodaResults];

        // Deduplicate by normalized name
        const seen = new Set<string>();
        const deduped = combined.filter(v => {
            const key = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`Combined: ${googleResults.length} Google + ${sodaResults.length} SODA = ${deduped.length} unique`);
        return deduped;
    }

    return googleResults;
};

// Fallback Mock Data if no API Key
const getMockVendors = (query: string, location: string): RawVendor[] => {
    return [
        {
            name: "Mock Cleaning Services " + location,
            description: "Deep comercial cleaning and janitorial services.",
            location: location,
            source: 'mock'
        },
        {
            name: "Test HVAC Solutions " + location,
            description: "HVAC maintenance and repair.",
            location: location,
            source: 'mock'
        },
        {
            name: "General Facilities Co",
            description: "We do everything including plumbing and electrical.",
            location: location,
            source: 'mock'
        }
    ];
};
