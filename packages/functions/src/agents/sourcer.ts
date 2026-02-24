import axios from 'axios';

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
}

/**
 * Lead Sourcing Agent
 * Supports multiple data providers:
 * - google_maps (default): Serper.dev / Google Maps
 * - nyc_open_data: NYC DCA + NY State SODA APIs — licensed, verified businesses
 * - all: Both sources combined and deduplicated
 *
 * Requires: process.env.SERPER_API_KEY (for google_maps)
 */
export const searchVendors = async (
    query: string,
    location: string,
    provider: 'google_maps' | 'nyc_open_data' | 'all' = 'google_maps'
): Promise<RawVendor[]> => {
    console.log(`Searching for: "${query}" in "${location}" [provider: ${provider}]`);

    // ─── NYC Open Data Only ───
    if (provider === 'nyc_open_data') {
        const { searchVendorsSoda } = await import('./sodaSourcer');
        return searchVendorsSoda(query, location);
    }

    // ─── Google Maps ───
    const apiKey = process.env.SERPER_API_KEY || "02ece77ffd27d2929e3e79604cb27e1dfaa40fe7";
    if (!apiKey) {
        console.warn("SERPER_API_KEY is not set. Returning mock data.");
        return getMockVendors(query, location);
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

        // Filter out low-rated vendors immediately
        googleResults = rawVendors.filter((v: any) => v.rating === undefined || v.rating >= 3.5);
        console.log(`Filtered ${rawVendors.length} -> ${googleResults.length} vendors (Rating >= 3.5 or N/A).`);

    } catch (error: any) {
        console.error("Error searching vendors via Google:", error.message);
        if (provider !== 'all') {
            throw new Error(`Failed to source vendors: ${error.message}`);
        }
    }

    // ─── Combined (All Sources) ───
    if (provider === 'all') {
        const { searchVendorsSoda } = await import('./sodaSourcer');
        const sodaResults = await searchVendorsSoda(query, location);

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
