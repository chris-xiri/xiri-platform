// ─── Calculator Engine ────────────────────────────────────────────────
// Pure calculation logic extracted from PublicCalculator.tsx
// Zero dependencies — can be used in tests, API routes, or other components.

// ─── Types ────────────────────────────────────────────────────────────
export interface FloorBreakdown { type: string; percent: number; }
export interface EstimateResult {
    perVisit: number;
    daysPerMonth: number;
    monthly: { low: number; mid: number; high: number };
}

// ─── Constants ────────────────────────────────────────────────────────
export const FACILITY_LABELS: Record<string, string> = {
    office_general: 'Office (General)',
    medical_private: 'Medical (Private Practice)',
    medical_dental: 'Medical (Dental)',
    medical_veterinary: 'Medical (Veterinary)',
    medical_urgent_care: 'Medical (Urgent Care)',
    medical_surgery: 'Medical (Surgery Center)',
    medical_dialysis: 'Medical (Dialysis)',
    auto_dealer_showroom: 'Auto Dealership (Showroom)',
    auto_service_center: 'Auto (Service Center)',
    edu_daycare: 'Daycare / Preschool',
    edu_private_school: 'Private School',
    fitness_gym: 'Fitness / Gym',
    retail_storefront: 'Retail Storefront',
    lab_cleanroom: 'Lab / Cleanroom',
    lab_bsl: 'Lab (BSL)',
    manufacturing_light: 'Light Manufacturing',
    other: 'Other',
};

export const PRODUCTION_RATES: Record<string, number> = {
    office_general: 4250, medical_private: 2500, medical_dental: 2500,
    medical_veterinary: 2500, medical_urgent_care: 1750, medical_surgery: 1750,
    medical_dialysis: 1750, auto_dealer_showroom: 3500, auto_service_center: 3500,
    edu_daycare: 3000, edu_private_school: 3000, fitness_gym: 3000,
    retail_storefront: 4750, lab_cleanroom: 1250, lab_bsl: 1250,
    manufacturing_light: 3000, other: 3500,
};

export const FLOOR_TYPES = [
    { key: 'carpet', label: 'Carpet', modifier: 1.0, method: 'Vacuum — fastest surface', includes: 'Carpet, carpet tile' },
    { key: 'resilient', label: 'Resilient', modifier: 0.85, method: 'Dust mop + wet mop', includes: 'VCT, LVT, vinyl, linoleum, rubber' },
    { key: 'tileStone', label: 'Tile / Stone', modifier: 0.75, method: 'Mop + periodic grout care', includes: 'Ceramic, porcelain, terrazzo, marble' },
    { key: 'concrete', label: 'Concrete', modifier: 1.1, method: 'Dust mop — easiest surface', includes: 'Sealed/polished concrete, epoxy' },
] as const;

export const SHIFT_OPTIONS = [
    { key: 'afterHours', label: 'After-hours', modifier: 1.0 },
    { key: 'daytime', label: 'Daytime', modifier: 1.15 },
    { key: 'weekend', label: 'Weekend', modifier: 1.25 },
] as const;

export const ADDON_OPTIONS = [
    { key: 'kitchen', label: 'Kitchen / Breakroom', modifier: 0.10 },
    { key: 'highTouchDisinfection', label: 'High-Touch Disinfection', modifier: 0.15 },
    { key: 'entryWayMats', label: 'Entryway Mats', modifier: 0.03 },
] as const;

export const FIXTURE_MINUTES = { restroom: 3, trash: 1 } as const;
export const MIN_HOURS = 1;

// Lower frequency = more work per visit (facility gets dirtier in between)
export const FREQUENCY_MULTIPLIERS: Record<number, number> = {
    7: 0.95,  // -5% per visit (nightly, less buildup)
    6: 0.97,  // -3% per visit
    5: 1.0,   // baseline
    4: 1.05,  // +5% per visit
    3: 1.10,  // +10% per visit
    2: 1.15,  // +15% per visit
    1: 1.25,  // +25% per visit
};

export const DEFAULT_FLOORS: FloorBreakdown[] = [
    { type: 'carpet', percent: 50 },
    { type: 'resilient', percent: 40 },
    { type: 'tileStone', percent: 10 },
];

// ─── Helper Functions ─────────────────────────────────────────────────

/** Cost-of-living tier labels (hides explicit $/hr) */
export function getCostTier(minWage: number): string {
    if (minWage >= 16) return 'High-cost market';
    if (minWage >= 12) return 'Mid-cost market';
    return 'Low-cost market';
}

/** Format a number as USD currency */
export function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

// ─── Calculator Engine ────────────────────────────────────────────────
export function calculate(
    hourlyRate: number,
    facilityType: string,
    sqft: number,
    floorBreakdown: FloorBreakdown[],
    restroomFixtures: number,
    trashBins: number,
    daysPerWeek: number,
    shift: string,
    addOns: Record<string, boolean>,
): EstimateResult {
    const baseRate = PRODUCTION_RATES[facilityType] || 3500;
    const totalPct = floorBreakdown.reduce((s, f) => s + f.percent, 0);
    let weightedRate = baseRate;
    if (totalPct > 0) {
        weightedRate = floorBreakdown.reduce((sum, f) => {
            const mod = FLOOR_TYPES.find(ft => ft.key === f.type)?.modifier || 1.0;
            return sum + (baseRate * mod * (f.percent / totalPct));
        }, 0);
    }
    const baseHours = sqft / weightedRate;
    const fixtureHours = (restroomFixtures * FIXTURE_MINUTES.restroom + trashBins * FIXTURE_MINUTES.trash) / 60;
    let addOnMult = 1.0;
    for (const [key, on] of Object.entries(addOns)) {
        if (on) addOnMult += ADDON_OPTIONS.find(a => a.key === key)?.modifier || 0;
    }
    const shiftMult = SHIFT_OPTIONS.find(s => s.key === shift)?.modifier || 1.0;
    const rawHours = (baseHours + fixtureHours) * addOnMult * shiftMult;
    const hours = Math.max(MIN_HOURS, Math.round(rawHours * 10) / 10);
    const freqMult = FREQUENCY_MULTIPLIERS[daysPerWeek] ?? 1.0;
    const perVisit = Math.round(hours * hourlyRate * freqMult);
    const daysPerMonth = Math.round(daysPerWeek * 4.33 * 10) / 10;
    const mid = Math.round(perVisit * daysPerMonth);
    return { perVisit, daysPerMonth, monthly: { low: Math.round(mid * 0.8), mid, high: Math.round(mid * 1.2) } };
}
