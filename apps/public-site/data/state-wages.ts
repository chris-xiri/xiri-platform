/**
 * State minimum wages — used to scale janitorial pricing by region.
 * NY is the baseline ($20/hr). All rates scale proportionally.
 *
 * Updated: 2025. Re-check annually at dol.gov/agencies/whd/minimum-wage/state
 */

export interface StateWage {
    code: string;
    name: string;
    minWage: number;
}

export const NY_MIN_WAGE = 20.00;

// Major states — we cover the top-population states + all we care about
export const STATE_WAGES: StateWage[] = [
    { code: 'NY', name: 'New York', minWage: 20.00 },
    { code: 'CA', name: 'California', minWage: 16.50 },
    { code: 'WA', name: 'Washington', minWage: 16.66 },
    { code: 'MA', name: 'Massachusetts', minWage: 15.00 },
    { code: 'CT', name: 'Connecticut', minWage: 15.69 },
    { code: 'NJ', name: 'New Jersey', minWage: 15.49 },
    { code: 'MD', name: 'Maryland', minWage: 15.00 },
    { code: 'IL', name: 'Illinois', minWage: 15.00 },
    { code: 'AZ', name: 'Arizona', minWage: 14.70 },
    { code: 'CO', name: 'Colorado', minWage: 14.81 },
    { code: 'OR', name: 'Oregon', minWage: 14.70 },
    { code: 'VT', name: 'Vermont', minWage: 14.01 },
    { code: 'RI', name: 'Rhode Island', minWage: 14.00 },
    { code: 'DE', name: 'Delaware', minWage: 13.25 },
    { code: 'ME', name: 'Maine', minWage: 14.15 },
    { code: 'HI', name: 'Hawaii', minWage: 14.00 },
    { code: 'MN', name: 'Minnesota', minWage: 11.13 },
    { code: 'NV', name: 'Nevada', minWage: 12.00 },
    { code: 'FL', name: 'Florida', minWage: 13.00 },
    { code: 'MI', name: 'Michigan', minWage: 10.56 },
    { code: 'MO', name: 'Missouri', minWage: 13.75 },
    { code: 'NE', name: 'Nebraska', minWage: 13.50 },
    { code: 'SD', name: 'South Dakota', minWage: 11.20 },
    { code: 'OH', name: 'Ohio', minWage: 10.65 },
    { code: 'VA', name: 'Virginia', minWage: 12.41 },
    { code: 'NM', name: 'New Mexico', minWage: 12.00 },
    { code: 'AK', name: 'Alaska', minWage: 11.73 },
    { code: 'MT', name: 'Montana', minWage: 10.55 },
    { code: 'AR', name: 'Arkansas', minWage: 11.00 },
    { code: 'PA', name: 'Pennsylvania', minWage: 7.25 },
    { code: 'TX', name: 'Texas', minWage: 7.25 },
    { code: 'GA', name: 'Georgia', minWage: 7.25 },
    { code: 'NC', name: 'North Carolina', minWage: 7.25 },
    { code: 'SC', name: 'South Carolina', minWage: 7.25 },
    { code: 'TN', name: 'Tennessee', minWage: 7.25 },
    { code: 'IN', name: 'Indiana', minWage: 7.25 },
    { code: 'WI', name: 'Wisconsin', minWage: 7.25 },
    { code: 'KY', name: 'Kentucky', minWage: 7.25 },
    { code: 'AL', name: 'Alabama', minWage: 7.25 },
    { code: 'MS', name: 'Mississippi', minWage: 7.25 },
    { code: 'IA', name: 'Iowa', minWage: 7.25 },
    { code: 'KS', name: 'Kansas', minWage: 7.25 },
    { code: 'ID', name: 'Idaho', minWage: 7.25 },
    { code: 'LA', name: 'Louisiana', minWage: 7.25 },
    { code: 'NH', name: 'New Hampshire', minWage: 7.25 },
    { code: 'OK', name: 'Oklahoma', minWage: 7.25 },
    { code: 'ND', name: 'North Dakota', minWage: 7.25 },
    { code: 'WV', name: 'West Virginia', minWage: 8.75 },
    { code: 'UT', name: 'Utah', minWage: 7.25 },
    { code: 'WY', name: 'Wyoming', minWage: 7.25 },
    { code: 'DC', name: 'Washington D.C.', minWage: 17.50 },
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Scale rates based on state min wage vs NY baseline.
 * Preserves the COGS ratios:
 *   cleaner = minWage × 1.25
 *   sub = cleaner × 2
 *   client = sub × 1.54
 */
export function scaleRates(stateMinWage: number) {
    const scale = stateMinWage / NY_MIN_WAGE;
    const cleanerRate = Math.round(25 * scale * 100) / 100;
    const subRate = Math.round(cleanerRate * 2 * 100) / 100;
    const clientRate = Math.round(subRate * 1.54 * 100) / 100;
    return { cleanerRate, subRate, clientRate, scale };
}
