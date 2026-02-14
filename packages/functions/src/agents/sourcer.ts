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
 * Uses Serper.dev (Google Maps) to find vendors.
 * 
 * Requires: process.env.SERPER_API_KEY
 */
export const searchVendors = async (query: string, location: string): Promise<RawVendor[]> => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn("SERPER_API_KEY is not set. Returning mock data.");
        return getMockVendors(query, location);
    }

    const fullQuery = `${query} in ${location}`;
    console.log(`Searching for: ${fullQuery} using Serper (places)...`);

    try {
        const response = await axios.post(
            'https://google.serper.dev/places',
            { q: fullQuery },
            { headers: { 'X-API-KEY': apiKey.trim(), 'Content-Type': 'application/json' } }
        );

        const places = response.data.places || [];
        console.log(`Serper returned ${places.length} raw results.`);

        // Return results directly from Serper without strict string matching on the city
        // This allows "NYC" -> "New York" matches to persist.
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
        const filteredVendors = rawVendors.filter((v: any) => v.rating === undefined || v.rating >= 3.5);
        console.log(`Filtered ${rawVendors.length} -> ${filteredVendors.length} vendors (Rating >= 3.5 or N/A).`);

        return filteredVendors;

    } catch (error: any) {
        console.error("Error searching vendors:", error.message);
        throw new Error(`Failed to source vendors: ${error.message}`);
    }
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
