import axios from 'axios';

// Define the shape of a raw vendor outcome
export interface RawVendor {
    name: string;
    description: string;
    location: string;
    phone?: string;
    website?: string;
    source: string;
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
            { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
        );

        const places = response.data.places || [];
        console.log(`Serper returned ${places.length} raw results.`);

        // Filter out results that don't match the requested location strictly
        // We extract the city name from the "location" argument (e.g. "New Hyde Park, NY" -> "New Hyde Park")
        // and check if it exists in the vendor's address.
        const targetCity = location.split(',')[0].trim().toLowerCase();

        return places
            .filter((place: any) => {
                if (!place.address) return false;
                const address = place.address.toLowerCase();
                const isMatch = address.includes(targetCity);
                if (!isMatch) console.log(`Skipping "${place.title}" (${place.address}) - Not in ${targetCity}`);
                // Check if the address contains the city name
                return isMatch;
            })
            .map((place: any) => ({
                name: place.title,
                description: `${place.category || ''} - ${place.address || ''}`,
                location: place.address,
                phone: place.phoneNumber,
                website: place.website,
                source: 'google_maps_serper'
            }));

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
