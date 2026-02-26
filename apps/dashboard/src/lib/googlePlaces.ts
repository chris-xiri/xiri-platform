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
                radius: 30000, // 30km radius
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

// ── Helpers: Name Cleanup ──

/**
 * Strip common legal suffixes from entity names to improve Google matching.
 * "3442 JANITORIAL SERVICES CORP." → "3442 Janitorial Services"
 */
function stripLegalSuffixes(name: string): string {
    return name
        .replace(/\b(inc\.?|corp\.?|llc\.?|ltd\.?|l\.?l\.?c\.?|co\.?|company|incorporated|corporation|limited)\b\.?/gi, '')
        .replace(/[.,]+$/g, '')   // trailing punctuation
        .replace(/\s{2,}/g, ' ')  // collapse whitespace
        .trim();
}

/**
 * Validate a Places result against the expected state.
 * Returns true if valid, false if it's a wrong-state match.
 */
function validateResultState(details: PlacesEnrichment, expectedState?: string): boolean {
    if (!expectedState || !details.formattedAddress) return true;
    const resultState = extractStateFromAddress(details.formattedAddress);
    if (resultState && resultState !== expectedState.toUpperCase().trim()) {
        console.warn(
            `Places enrichment discarded: expected ${expectedState.toUpperCase()} but got ${resultState} (${details.formattedAddress})`
        );
        return false;
    }
    return true;
}

// ── Public API ──

/** Cache to avoid duplicate API calls for the same property */
const cache = new Map<string, PlacesEnrichment | null>();

/**
 * Enrich a vendor with Google Places data using a cascading search strategy:
 *
 * 1. Try cleaned entity name + location (strips "Inc.", "Corp.", "LLC", etc.)
 * 2. If no match, try address-only (finds whatever business operates there)
 *
 * Results are cached per-query to avoid duplicate API calls.
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

    const location = [address, city, state].filter(Boolean).join(', ');
    const cacheKey = `${businessName || ''}|${location}`.toLowerCase().trim();
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) || null;
    }

    const biasCenter = resolveLocationBias(city, state);

    try {
        // ── Try 1: Cleaned entity name + location ──
        if (businessName) {
            const cleanName = stripLegalSuffixes(businessName);
            const query1 = `${cleanName} ${location}`;
            const result1 = await textSearchPlace(query1, biasCenter);

            if (result1) {
                const details = await getPlaceDetails(result1.placeId);
                if (details && validateResultState(details, state)) {
                    cache.set(cacheKey, details);
                    return details;
                }
            }
        }

        // ── Try 2: Address-only (find whatever business is at this address) ──
        if (address && city) {
            const query2 = location; // just the address without business name
            const result2 = await textSearchPlace(query2, biasCenter);

            if (result2) {
                const details = await getPlaceDetails(result2.placeId);
                if (details && validateResultState(details, state)) {
                    cache.set(cacheKey, details);
                    return details;
                }
            }
        }

        // No valid match found
        cache.set(cacheKey, null);
        return null;
    } catch (err) {
        console.error('Google Places enrichment failed:', err);
        cache.set(cacheKey, null);
        return null;
    }
}
