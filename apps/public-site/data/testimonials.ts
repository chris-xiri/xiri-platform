// ─── Testimonials ────────────────────────────────────────────────
// Used by: Testimonials component, potentially industry pages.

export interface Testimonial {
    quote: string;
    role: string;
    facility: string;
    location: string;
    initials: string;
    rating: number;
    /** Optional: tag by industry for filtering on industry pages */
    industry?: string;
}

export const TESTIMONIALS: Testimonial[] = [
    {
        quote: "We went through three janitorial companies in two years before finding the right fit. Having one partner handle cleaning, supplies, and compliance paperwork has been a game changer — our staff doesn't have to chase vendors anymore.",
        role: 'Office Manager',
        facility: 'Multi-Specialty Medical Office',
        location: 'Nassau County, NY',
        initials: 'R.M.',
        rating: 5,
        industry: 'medical-offices',
    },
    {
        quote: "The nightly verification reports give us peace of mind we never had before. We know exactly what was cleaned, what was restocked, and whether protocols were followed — without having to check ourselves.",
        role: 'Facilities Director',
        facility: 'Urgent Care Center',
        location: 'Long Island, NY',
        initials: 'T.K.',
        rating: 5,
        industry: 'urgent-care',
    },
    {
        quote: "Consolidating five separate contractors under one invoice saved us hours every month on billing alone. The cleaning quality is the best we've had in over a decade of managing this building.",
        role: 'Property Manager',
        facility: 'Professional Office Building',
        location: 'Queens, NY',
        initials: 'S.P.',
        rating: 5,
        industry: 'professional-offices',
    },
];
