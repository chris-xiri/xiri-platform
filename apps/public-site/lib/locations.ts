export interface Location {
    slug: string;
    city: string;
    state: string;
    county: string;
}

export const LOCATIONS: Location[] = [
    // Nassau County (5)
    { slug: 'garden-city', city: 'Garden City', state: 'NY', county: 'Nassau' },
    { slug: 'great-neck', city: 'Great Neck', state: 'NY', county: 'Nassau' },
    { slug: 'manhasset', city: 'Manhasset', state: 'NY', county: 'Nassau' },
    { slug: 'rockville-centre', city: 'Rockville Centre', state: 'NY', county: 'Nassau' },
    { slug: 'syosset', city: 'Syosset', state: 'NY', county: 'Nassau' },

    // Queens (5)
    { slug: 'astoria', city: 'Astoria', state: 'NY', county: 'Queens' },
    { slug: 'long-island-city', city: 'Long Island City', state: 'NY', county: 'Queens' },
    { slug: 'forest-hills', city: 'Forest Hills', state: 'NY', county: 'Queens' },
    { slug: 'bayside', city: 'Bayside', state: 'NY', county: 'Queens' },
    { slug: 'flushing', city: 'Flushing', state: 'NY', county: 'Queens' },

    // Suffolk County (5)
    { slug: 'melville', city: 'Melville', state: 'NY', county: 'Suffolk' },
    { slug: 'huntington', city: 'Huntington', state: 'NY', county: 'Suffolk' },
    { slug: 'stony-brook', city: 'Stony Brook', state: 'NY', county: 'Suffolk' },
    { slug: 'smithtown', city: 'Smithtown', state: 'NY', county: 'Suffolk' },
    { slug: 'bay-shore', city: 'Bay Shore', state: 'NY', county: 'Suffolk' },
];

export const getLocationBySlug = (slug: string): Location | undefined => {
    return LOCATIONS.find((loc) => loc.slug === slug);
};
