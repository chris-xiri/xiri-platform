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
