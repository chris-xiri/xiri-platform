// ─── Site-Wide Constants ─────────────────────────────────────────
// Single source of truth for company info, CTAs, and service area.
// Import from here instead of hardcoding in pages/components.

export const SITE = {
    name: 'XIRI Facility Solutions',
    legalName: 'Xiri Group LLC',
    shortName: 'XIRI',
    url: 'https://xiri.ai',
    phone: '+1-516-399-0350',
    phoneDisplay: '(516) 399-0350',
    email: 'chris@xiri.ai',
    tagline: 'One Partner. One Invoice. Done.',
    description: 'The facility management standard for single-tenant buildings. One partner. Zero headaches. Nightly verified.',
    insurance: '$1M Liability Policy',
    address: {
        street: '418 Broadway, Ste N',
        city: 'Albany',
        state: 'NY',
        zip: '12207',
        country: 'USA',
        full: '418 Broadway, Ste N, Albany, NY 12207',
    },
    social: {
        facebook: 'https://www.facebook.com/xirifacilitysolutions/',
        linkedin: 'https://www.linkedin.com/company/xiri-facility-solutions',
    },
} as const;

export const SERVICE_AREA = {
    primary: 'Nassau County',
    region: 'Long Island',
    state: 'New York',
    stateAbbr: 'NY',
    description: 'Nassau County and the greater Long Island area',
} as const;

export const CTA = {
    primary: 'Scope My Building',
    contractor: 'Join the Network',
    secondary: 'See If We Cover Your Area',
    audit: 'Get a Free Site Audit',
    href: '/#audit',
} as const;
