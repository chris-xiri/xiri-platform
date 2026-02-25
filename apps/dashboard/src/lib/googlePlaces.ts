/**
 * Google Places API (New) — client-side enrichment
 *
 * Uses the Text Search (New) + Place Details (New) APIs.
 * Each property click = 1–2 API calls (~$0.009).
 * ~22,200 free lookups/month with $200 credit.
 *
 * Requires `Places API (New)` enabled in Google Cloud Console.
 * Uses the same NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 */

// ── Types ──

export interface PlacesEnrichment {
    placeId: string;
    name: string;
    formattedAddress: string;
    website?: string;
    phone?: string;
    rating?: number;
    ratingCount?: number;
    businessStatus?: string;
    types?: string[];
    openNow?: boolean;
    weekdayHours?: string[];
    googleMapsUrl?: string;
    photoUrls: string[];
    priceLevel?: string;
}

// ── Helpers ──

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Known center coordinates for NY counties / boroughs commonly used in SODA searches.
 * Avoids an extra geocoding API call for location bias.
 */
const NY_COUNTY_COORDS: Record<string, { latitude: number; longitude: number }> = {
    nassau: { latitude: 40.7282, longitude: -73.5594 },
    suffolk: { latitude: 40.7891, longitude: -72.8648 },
    queens: { latitude: 40.7282, longitude: -73.7949 },
    brooklyn: { latitude: 40.6782, longitude: -73.9442 },
    kings: { latitude: 40.6782, longitude: -73.9442 },
    bronx: { latitude: 40.8448, longitude: -73.8648 },
    manhattan: { latitude: 40.7831, longitude: -73.9712 },
    'new york': { latitude: 40.7831, longitude: -73.9712 },
    'staten island': { latitude: 40.5795, longitude: -74.1502 },
    richmond: { latitude: 40.5795, longitude: -74.1502 },
    westchester: { latitude: 41.1220, longitude: -73.7949 },
    rockland: { latitude: 41.1489, longitude: -74.0260 },
    orange: { latitude: 41.4017, longitude: -74.3118 },
    dutchess: { latitude: 41.7651, longitude: -73.7471 },
    putnam: { latitude: 41.4270, longitude: -73.7496 },
    albany: { latitude: 42.6526, longitude: -73.7562 },
    erie: { latitude: 42.8864, longitude: -78.8784 },
    monroe: { latitude: 43.1566, longitude: -77.6088 },
    onondaga: { latitude: 43.0481, longitude: -76.1474 },
};

/** US state abbreviations for post-search validation */
const US_STATES = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
    'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
    'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
    'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

/**
 * Try to resolve a lat/lng center for the given city/state to bias the Places search.
 */
function resolveLocationBias(city?: string, state?: string): { latitude: number; longitude: number } | null {
    if (city) {
        const key = city.toLowerCase().trim();
        if (NY_COUNTY_COORDS[key]) return NY_COUNTY_COORDS[key];
    }
    // Default NY center if state is NY but city didn't match a known county
    if (state && state.toUpperCase().trim() === 'NY') {
        return { latitude: 40.7128, longitude: -74.0060 }; // NYC center
    }
    return null;
}

/**
 * Extract a US state abbreviation from a Google formatted address string.
 * e.g. "123 Main St, Freeport, NY 11520, USA" → "NY"
 */
function extractStateFromAddress(formattedAddress: string): string | null {
    // Match ", XX " or ", XX," where XX is a 2-letter state code
    const match = formattedAddress.match(/,\s*([A-Z]{2})\s+\d{5}/);
    if (match && US_STATES.has(match[1])) return match[1];
    // Fallback: look for ", XX, USA" or ", XX USA"
    const match2 = formattedAddress.match(/,\s*([A-Z]{2})(?:,\s*|\s+)USA/);
    if (match2 && US_STATES.has(match2[1])) return match2[1];
    return null;
}

/**
 * Search for a business at a given address using Places Text Search (New).
 * Returns the top match's placeId for a follow-up details call.
 * Accepts an optional locationBias to constrain results geographically.
 */
async function textSearchPlace(
    query: string,
    biasCenter?: { latitude: number; longitude: number } | null,
): Promise<{ placeId: string; displayName: string } | null> {
    const requestBody: Record<string, unknown> = {
        textQuery: query,
        maxResultCount: 1,
    };

    if (biasCenter) {
        requestBody.locationBias = {
            circle: {
                center: biasCenter,
                radiusMeters: 30000, // 30km radius
            },
        };
    }

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
        console.warn('Places text search failed:', res.status, await res.text());
        return null;
    }

    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;

    return {
        placeId: place.id,
        displayName: place.displayName?.text || '',
    };
}

/**
 * Get full details for a placeId using Places Details (New).
 */
async function getPlaceDetails(placeId: string): Promise<PlacesEnrichment | null> {
    const fields = [
        'id', 'displayName', 'formattedAddress',
        'websiteUri', 'nationalPhoneNumber', 'internationalPhoneNumber',
        'rating', 'userRatingCount', 'businessStatus',
        'types', 'currentOpeningHours', 'googleMapsUri',
        'photos', 'priceLevel',
    ].join(',');

    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': fields,
        },
    });

    if (!res.ok) {
        console.warn('Places details failed:', res.status, await res.text());
        return null;
    }

    const p = await res.json();

    // Build photo URLs (up to 3)
    const photoUrls: string[] = [];
    if (p.photos) {
        for (const photo of p.photos.slice(0, 3)) {
            if (photo.name) {
                photoUrls.push(
                    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${API_KEY}`
                );
            }
        }
    }

    return {
        placeId: p.id,
        name: p.displayName?.text || '',
        formattedAddress: p.formattedAddress || '',
        website: p.websiteUri || undefined,
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || undefined,
        rating: p.rating || undefined,
        ratingCount: p.userRatingCount || undefined,
        businessStatus: p.businessStatus || undefined,
        types: p.types || undefined,
        openNow: p.currentOpeningHours?.openNow,
        weekdayHours: p.currentOpeningHours?.weekdayDescriptions,
        googleMapsUrl: p.googleMapsUri || undefined,
        photoUrls,
        priceLevel: p.priceLevel || undefined,
    };
}

// ── Public API ──

/** Cache to avoid duplicate API calls for the same property */
const cache = new Map<string, PlacesEnrichment | null>();

/**
 * Enrich a property with Google Places data.
 * Uses the address + business name (if available) as the search query.
 * Results are cached per-address to avoid duplicate API calls.
 */
export async function enrichWithGooglePlaces(
    address: string,
    city?: string,
    state?: string,
    businessName?: string,
): Promise<PlacesEnrichment | null> {
    if (!API_KEY) {
        console.warn('Google Maps API key not set');
        return null;
    }

    // Build search query
    const location = [address, city, state].filter(Boolean).join(', ');
    const query = businessName ? `${businessName} ${location}` : location;

    // Check cache
    const cacheKey = query.toLowerCase().trim();
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) || null;
    }

    try {
        // Resolve geographic bias from vendor city/state
        const biasCenter = resolveLocationBias(city, state);

        // Step 1: Text search to find the place (with location bias)
        const searchResult = await textSearchPlace(query, biasCenter);
        if (!searchResult) {
            cache.set(cacheKey, null);
            return null;
        }

        // Step 2: Get full details
        const details = await getPlaceDetails(searchResult.placeId);

        // Step 3: Post-search state validation — discard wrong-state matches
        if (details && state && details.formattedAddress) {
            const resultState = extractStateFromAddress(details.formattedAddress);
            const expectedState = state.toUpperCase().trim();
            if (resultState && resultState !== expectedState) {
                console.warn(
                    `Places enrichment discarded: expected ${expectedState} but got ${resultState} for "${businessName}" (${details.formattedAddress})`
                );
                cache.set(cacheKey, null);
                return null;
            }
        }

        cache.set(cacheKey, details);
        return details;
    } catch (err) {
        console.error('Google Places enrichment failed:', err);
        cache.set(cacheKey, null);
        return null;
    }
}
