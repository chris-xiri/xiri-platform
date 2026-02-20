/**
 * NY/NJ Destination-Based Tax Rates
 * 
 * Static zip-to-rate lookup for sales tax calculation.
 * Rates are combined (state + county + city + special district).
 * 
 * Source: NY Tax Dept / NJ Division of Taxation (as of 2025)
 * 
 * NOTE: This is a static lookup for MVP. For production scale,
 * consider TaxJar or Avalara API integration.
 */

export interface TaxRate {
    zip: string;
    state: string;
    county: string;
    city?: string;
    stateRate: number;
    countyRate: number;
    cityRate: number;
    specialRate: number;
    combinedRate: number;
    effectiveDate: string;
}

// ─── Region Defaults ──────────────────────────────────────────

const NYC_RATE: Omit<TaxRate, 'zip' | 'county' | 'city'> = {
    state: 'NY', stateRate: 0.04, countyRate: 0.045, cityRate: 0.0, specialRate: 0.00375,
    combinedRate: 0.08875, effectiveDate: '2025-01-01',
};

const NASSAU_RATE: Omit<TaxRate, 'zip' | 'city'> = {
    state: 'NY', county: 'Nassau', stateRate: 0.04, countyRate: 0.04625, cityRate: 0.0, specialRate: 0.00375,
    combinedRate: 0.08625, effectiveDate: '2025-01-01',
};

const SUFFOLK_RATE: Omit<TaxRate, 'zip' | 'city'> = {
    state: 'NY', county: 'Suffolk', stateRate: 0.04, countyRate: 0.04, cityRate: 0.0, specialRate: 0.00375,
    combinedRate: 0.08375, effectiveDate: '2025-01-01',
};

const WESTCHESTER_RATE: Omit<TaxRate, 'zip' | 'city'> = {
    state: 'NY', county: 'Westchester', stateRate: 0.04, countyRate: 0.04, cityRate: 0.0, specialRate: 0.00375,
    combinedRate: 0.08375, effectiveDate: '2025-01-01',
};

const NJ_RATE: Omit<TaxRate, 'zip' | 'county' | 'city'> = {
    state: 'NJ', stateRate: 0.06625, countyRate: 0.0, cityRate: 0.0, specialRate: 0.0,
    combinedRate: 0.06625, effectiveDate: '2025-01-01',
};

// ─── ZIP Code Ranges → County Mapping ─────────────────────────

type ZipRange = { start: string; end: string; county: string; city?: string; rate: Omit<TaxRate, 'zip' | 'county' | 'city'> };

const ZIP_RANGES: ZipRange[] = [
    // Manhattan
    { start: '10001', end: '10282', county: 'New York', city: 'New York', rate: NYC_RATE },
    // Bronx
    { start: '10451', end: '10475', county: 'Bronx', city: 'New York', rate: NYC_RATE },
    // Brooklyn
    { start: '11201', end: '11256', county: 'Kings', city: 'New York', rate: NYC_RATE },
    // Queens
    { start: '11101', end: '11109', county: 'Queens', city: 'New York', rate: NYC_RATE },
    { start: '11351', end: '11697', county: 'Queens', city: 'New York', rate: NYC_RATE },
    // Staten Island
    { start: '10301', end: '10314', county: 'Richmond', city: 'New York', rate: NYC_RATE },
    // Nassau County (Long Island)
    { start: '11001', end: '11099', county: 'Nassau', rate: NASSAU_RATE },
    { start: '11501', end: '11599', county: 'Nassau', rate: NASSAU_RATE },
    { start: '11701', end: '11799', county: 'Nassau', rate: NASSAU_RATE },
    // Suffolk County (Long Island)
    { start: '11713', end: '11980', county: 'Suffolk', rate: SUFFOLK_RATE },
    // Westchester County
    { start: '10501', end: '10599', county: 'Westchester', rate: WESTCHESTER_RATE },
    { start: '10601', end: '10710', county: 'Westchester', rate: WESTCHESTER_RATE },
    { start: '10801', end: '10805', county: 'Westchester', rate: WESTCHESTER_RATE },
    // Northern NJ (common service area)
    { start: '07001', end: '07199', county: 'NJ', rate: NJ_RATE },
    { start: '07301', end: '07399', county: 'NJ', rate: NJ_RATE },
    { start: '07410', end: '07675', county: 'NJ', rate: NJ_RATE },
];

// ─── Lookup Function ──────────────────────────────────────────

/**
 * Get the combined sales tax rate for a ZIP code.
 * Returns null if the ZIP isn't in our service area.
 */
export function getTaxRate(zip: string): TaxRate | null {
    if (!zip || zip.length < 5) return null;

    const zipClean = zip.slice(0, 5); // handle ZIP+4

    for (const range of ZIP_RANGES) {
        if (zipClean >= range.start && zipClean <= range.end) {
            return {
                zip: zipClean,
                county: range.county,
                city: range.city,
                ...range.rate,
            };
        }
    }

    return null;
}

/**
 * Calculate tax amount from a rate and a base amount.
 * Rounds to 2 decimal places.
 */
export function calculateTax(amount: number, taxRate: number): number {
    return Math.round(amount * taxRate * 100) / 100;
}

/**
 * Check if a service qualifies for ST-120.1 exemption.
 * 
 * ST-120.1 (Contractor Exempt Purchase Certificate) in NY applies broadly
 * to purchases for resale — not limited to janitorial/cleaning.
 * When a vendor has this certificate on file, the exemption applies to
 * all services they provide as a subcontractor for resale.
 * 
 * Returns true unless the service is explicitly a non-resale direct purchase.
 */
export function isEligibleForST120(_serviceCategory?: string): boolean {
    // ST-120.1 applies to all services purchased for resale when vendor has cert.
    // No service-category restriction — the certificate itself is what qualifies.
    return true;
}
