"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchVendors = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Lead Sourcing Agent
 * Uses Serper.dev (Google Maps) to find vendors.
 *
 * Requires: process.env.SERPER_API_KEY
 */
const searchVendors = async (query, location) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn("SERPER_API_KEY is not set. Returning mock data.");
        return getMockVendors(query, location);
    }
    const fullQuery = `${query} in ${location}`;
    console.log(`Searching for: ${fullQuery} using Serper (places)...`);
    try {
        const response = await axios_1.default.post('https://google.serper.dev/places', { q: fullQuery }, { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } });
        const places = response.data.places || [];
        console.log(`Serper returned ${places.length} raw results.`);
        // Filter out results that don't match the requested location strictly
        // We extract the city name from the "location" argument (e.g. "New Hyde Park, NY" -> "New Hyde Park")
        // and check if it exists in the vendor's address.
        const targetCity = location.split(',')[0].trim().toLowerCase();
        return places
            .filter((place) => {
            if (!place.address)
                return false;
            const address = place.address.toLowerCase();
            const isMatch = address.includes(targetCity);
            if (!isMatch)
                console.log(`Skipping "${place.title}" (${place.address}) - Not in ${targetCity}`);
            // Check if the address contains the city name
            return isMatch;
        })
            .map((place) => ({
            name: place.title,
            description: `${place.category || ''} - ${place.address || ''}`,
            location: place.address,
            phone: place.phoneNumber,
            website: place.website,
            source: 'google_maps_serper'
        }));
    }
    catch (error) {
        console.error("Error searching vendors:", error.message);
        throw new Error(`Failed to source vendors: ${error.message}`);
    }
};
exports.searchVendors = searchVendors;
// Fallback Mock Data if no API Key
const getMockVendors = (query, location) => {
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
//# sourceMappingURL=sourcer.js.map