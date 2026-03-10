// ─── Facility Types (Industries) ─────────────────────────────────
// Single source of truth for all facility types.
// Used by: Navigation, Footer, IndustriesSection, sitemap, IndustryHubPage.
// Grouped by pillar — pillar config lives in lib/industry-pillars.ts.

import { Hospital, Car, Baby, Building2, FlaskConical, Factory, GraduationCap, Stethoscope, Dog } from 'lucide-react';

export interface FacilityType {
    slug: string;
    label: string;
    group: string;
    pillar: string;
    /** Short descriptive phrase for cards/tooltips */
    shortDescription?: string;
}

export const FACILITY_TYPES: FacilityType[] = [
    // Healthcare
    { slug: 'medical-offices', label: 'Medical Offices', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'urgent-care', label: 'Urgent Care Centers', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'surgery-centers', label: 'Surgery Centers', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'dental-offices', label: 'Dental Offices', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'dialysis-centers', label: 'Dialysis Centers', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'veterinary-clinics', label: 'Veterinary Clinics', group: 'Healthcare', pillar: 'healthcare' },
    { slug: 'converted-clinical-suites', label: 'Converted Clinical Suites', group: 'Healthcare', pillar: 'healthcare' },
    // Automotive
    { slug: 'auto-dealerships', label: 'Auto Dealerships', group: 'Automotive', pillar: 'automotive' },
    // Specialized
    { slug: 'labs-cleanrooms', label: 'Labs & Cleanrooms', group: 'Specialized', pillar: 'specialized' },
    { slug: 'light-manufacturing', label: 'Light Manufacturing', group: 'Specialized', pillar: 'specialized' },
    // Education
    { slug: 'daycare-preschool', label: 'Daycares & Preschools', group: 'Education', pillar: 'education' },
    { slug: 'private-schools', label: 'Private Schools', group: 'Education', pillar: 'education' },
    // Commercial
    { slug: 'professional-offices', label: 'Professional Offices', group: 'Commercial', pillar: 'commercial' },
    { slug: 'fitness-gyms', label: 'Fitness & Gyms', group: 'Commercial', pillar: 'commercial' },
    { slug: 'retail-storefronts', label: 'Retail Storefronts', group: 'Commercial', pillar: 'commercial' },
];

/** Group facility types by their group name */
export function groupFacilityTypes(): Record<string, FacilityType[]> {
    return FACILITY_TYPES.reduce((acc, ft) => {
        if (!acc[ft.group]) acc[ft.group] = [];
        acc[ft.group].push(ft);
        return acc;
    }, {} as Record<string, FacilityType[]>);
}

/** Get the pillar route for a facility: /industries/{pillar}/{slug} */
export function getFacilityHref(ft: FacilityType): string {
    return `/industries/${ft.pillar}/${ft.slug}`;
}

// ─── Service Links (for Navigation dropdown) ─────────────────────

export interface ServiceLink {
    slug: string;
    label: string;
}

export const SERVICE_GROUPS: Record<string, { label: string; href: string; services: ServiceLink[] }> = {
    'Commercial Cleaning': {
        label: 'Commercial Cleaning',
        href: '/services/commercial-cleaning',
        services: [
            { label: 'Janitorial Services', slug: 'janitorial-services' },
            { label: 'Commercial Cleaning', slug: 'commercial-cleaning' },
            { label: 'Floor Care', slug: 'floor-care' },
            { label: 'Carpet & Upholstery', slug: 'carpet-upholstery' },
            { label: 'Day Porters', slug: 'day-porter' },
            { label: 'Disinfecting', slug: 'disinfecting-services' },
        ],
    },
    'Facility Management': {
        label: 'Facility Management',
        href: '/services/facility-management',
        services: [
            { label: 'Window Cleaning', slug: 'window-cleaning' },
            { label: 'Pressure Washing', slug: 'pressure-washing' },
            { label: 'HVAC Maintenance', slug: 'hvac-maintenance' },
            { label: 'Pest Control', slug: 'pest-control' },
            { label: 'Snow & Ice Removal', slug: 'snow-ice-removal' },
            { label: 'Handyman Services', slug: 'handyman-services' },
        ],
    },
};

/** Flat array of all service slugs */
export const ALL_SERVICE_SLUGS = Object.values(SERVICE_GROUPS).flatMap(g => g.services.map(s => s.slug));
