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
 * Search for a business at a given address using Places Text Search (New).
 * Returns the top match's placeId for a follow-up details call.
 */
async function textSearchPlace(query: string): Promise<{ placeId: string; displayName: string } | null> {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName',
        },
        body: JSON.stringify({
            textQuery: query,
            maxResultCount: 1,
        }),
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
        // Step 1: Text search to find the place
        const searchResult = await textSearchPlace(query);
        if (!searchResult) {
            cache.set(cacheKey, null);
            return null;
        }

        // Step 2: Get full details
        const details = await getPlaceDetails(searchResult.placeId);
        cache.set(cacheKey, details);
        return details;
    } catch (err) {
        console.error('Google Places enrichment failed:', err);
        cache.set(cacheKey, null);
        return null;
    }
}
