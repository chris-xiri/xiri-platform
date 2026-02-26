/**
 * Google Places Enrichment for Cloud Functions
 * 
 * Uses the Google Places API (New) Text Search to enrich vendor data
 * with ratings, reviews, business types, and other signals before
 * passing to the AI analysis pipeline.
 */

interface PlacesEnrichmentResult {
    placeId?: string;
    name?: string;
    rating?: number;
    ratingCount?: number;
    phone?: string;
    website?: string;
    types?: string[];
    openNow?: boolean;
    googleMapsUrl?: string;
    // Scoring helpers
    isEstablished: boolean;  // 20+ reviews
    isHighlyRated: boolean;  // 4.0+ rating
}

const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/**
 * Enrich a single vendor with Google Places data using Text Search.
 * Uses the vendor name + optional location for best match.
 */
export async function enrichVendorWithPlaces(
    vendorName: string,
    vendorAddress?: string,
    apiKey?: string,
): Promise<PlacesEnrichmentResult | null> {
    const key = apiKey || process.env.GOOGLE_MAPS_API_KEY || "";
    if (!key) {
        console.warn("GOOGLE_MAPS_API_KEY not set — skipping Places enrichment");
        return null;
    }

    try {
        const textQuery = vendorAddress
            ? `${vendorName} near ${vendorAddress}`
            : vendorName;

        const response = await fetch(PLACES_TEXT_SEARCH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri,places.types,places.currentOpeningHours,places.googleMapsUri",
            },
            body: JSON.stringify({
                textQuery,
                maxResultCount: 1,
                languageCode: "en",
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Places API error for "${vendorName}": ${response.status} — ${errText}`);
            return null;
        }

        const data = await response.json();
        const place = data.places?.[0];
        if (!place) return null;

        const rating = place.rating || 0;
        const ratingCount = place.userRatingCount || 0;

        return {
            placeId: place.id,
            name: place.displayName?.text || vendorName,
            rating,
            ratingCount,
            phone: place.internationalPhoneNumber || undefined,
            website: place.websiteUri || undefined,
            types: place.types || [],
            openNow: place.currentOpeningHours?.openNow,
            googleMapsUrl: place.googleMapsUri || undefined,
            isEstablished: ratingCount >= 20,
            isHighlyRated: rating >= 4.0,
        };
    } catch (err: any) {
        console.warn(`Places enrichment failed for "${vendorName}": ${err.message}`);
        return null;
    }
}

/**
 * Batch enrich multiple vendors with Google Places data.
 * Uses parallel requests with a concurrency limit to avoid rate limits.
 */
export async function batchEnrichVendors(
    vendors: Array<{ name: string; address?: string; index: number }>,
    apiKey?: string,
    concurrencyLimit = 5, // Max parallel requests
): Promise<Map<number, PlacesEnrichmentResult>> {
    const results = new Map<number, PlacesEnrichmentResult>();

    // Process in batches of concurrencyLimit
    for (let i = 0; i < vendors.length; i += concurrencyLimit) {
        const batch = vendors.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(
            batch.map(async (v) => {
                const result = await enrichVendorWithPlaces(v.name, v.address, apiKey);
                return { index: v.index, result };
            }),
        );

        for (const { index, result } of batchResults) {
            if (result) {
                results.set(index, result);
            }
        }
    }

    console.log(`Places enrichment: ${results.size}/${vendors.length} vendors enriched.`);
    return results;
}

/**
 * Calculate sub-scores from Google Places data for the AI prompt context.
 */
export function calculatePlacesSubScores(places: PlacesEnrichmentResult | null): {
    googleReputation: number;
    businessMaturity: number;
    websiteQuality: number;
} {
    if (!places) {
        return { googleReputation: 30, businessMaturity: 30, websiteQuality: 20 };
    }

    // Google Reputation (0-100): rating + review volume
    let googleReputation = 30; // Base for having a Places listing
    if (places.rating) {
        if (places.rating >= 4.5) googleReputation = 90;
        else if (places.rating >= 4.0) googleReputation = 75;
        else if (places.rating >= 3.5) googleReputation = 55;
        else if (places.rating >= 3.0) googleReputation = 40;
        else googleReputation = 25; // Below 3.0 = red flag
    }
    // Boost for review volume
    if (places.ratingCount && places.ratingCount >= 50) googleReputation = Math.min(100, googleReputation + 10);
    else if (places.ratingCount && places.ratingCount >= 20) googleReputation = Math.min(100, googleReputation + 5);

    // Business Maturity (0-100): review count as proxy
    let businessMaturity = 30;
    if (places.ratingCount) {
        if (places.ratingCount >= 100) businessMaturity = 95;
        else if (places.ratingCount >= 50) businessMaturity = 80;
        else if (places.ratingCount >= 20) businessMaturity = 65;
        else if (places.ratingCount >= 5) businessMaturity = 45;
    }

    // Website Quality (0-100): has website = good
    let websiteQuality = 20; // No website
    if (places.website) websiteQuality = 60; // Has website
    if (places.website && places.ratingCount && places.ratingCount > 10) websiteQuality = 80; // Website + reviews

    return { googleReputation, businessMaturity, websiteQuality };
}
