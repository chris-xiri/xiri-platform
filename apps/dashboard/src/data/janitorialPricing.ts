/**
 * Janitorial Pricing Calculator
 *
 * Hours-based model:
 *   sqft ÷ production rate + fixture time + add-ons × shift = hours/visit
 *   hours/visit × $77/hr = per-visit cost
 *   per-visit × days/month = monthly rate (±20%)
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface PricingConfig {
    serviceTag: string;
    label: string;
    costStack: {
        clientRate: number;       // $/hr billed to client
        subcontractorRate: number; // $/hr paid to sub
        cleanerRate: number;       // $/hr cleaner earns
        minHours: number;          // minimum per visit
    };
    productionRates: Record<string, number>; // sqft/hr by facility type
    fixtures: {
        restroomFixtureMinutes: number;
        trashBinMinutes: number;
    };
    floorModifiers: Record<string, number>; // production rate multiplier
    shiftModifiers: Record<string, number>;
    addOns: Record<string, number>; // time multiplier (0.10 = +10%)
}

export interface FloorBreakdown {
    type: string;   // 'carpet' | 'hardFloor' | 'tile' | 'concrete' | 'vinyl'
    percent: number; // 0-100
}

export interface EstimateParams {
    facilityType: string;
    sqft: number;
    floorBreakdown: FloorBreakdown[];
    restroomFixtures: number;
    trashBins: number;
    daysPerWeek: number;
    shift: string; // 'afterHours' | 'daytime' | 'weekend'
    addOns: Record<string, boolean>;
}

export interface EstimateResult {
    hoursPerVisit: number;
    perVisit: number;
    daysPerMonth: number;
    monthly: {
        low: number;
        mid: number;
        high: number;
    };
}

// ─── Default config (fallback if Firestore unavailable) ──────────────

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    serviceTag: 'janitorial',
    label: 'Janitorial Cleaning',
    costStack: {
        clientRate: 77,
        subcontractorRate: 50,
        cleanerRate: 25,
        minHours: 1,
    },
    productionRates: {
        office_general: 4250,
        medical_private: 2500,
        medical_dental: 2500,
        medical_veterinary: 2500,
        medical_urgent_care: 1750,
        medical_surgery: 1750,
        medical_dialysis: 1750,
        auto_dealer_showroom: 3500,
        auto_service_center: 3500,
        edu_daycare: 3000,
        edu_private_school: 3000,
        fitness_gym: 3000,
        retail_storefront: 4750,
        lab_cleanroom: 1250,
        lab_bsl: 1250,
        manufacturing_light: 3000,
        other: 3500,
    },
    fixtures: {
        restroomFixtureMinutes: 3,
        trashBinMinutes: 1,
    },
    floorModifiers: {
        carpet: 1.0,
        hardFloor: 0.85,
        tile: 0.80,
        concrete: 1.1,
        vinyl: 0.90,
    },
    shiftModifiers: {
        afterHours: 1.0,
        daytime: 1.15,
        weekend: 1.25,
    },
    addOns: {
        kitchen: 0.10,
        highTouchDisinfection: 0.15,
        entryWayMats: 0.03,
    },
};

// ─── Labels for UI rendering ─────────────────────────────────────────

export const FLOOR_TYPE_LABELS: Record<string, string> = {
    carpet: 'Carpet',
    hardFloor: 'Hard Floor',
    tile: 'Tile',
    concrete: 'Concrete',
    vinyl: 'Vinyl / LVT',
};

export const SHIFT_LABELS: Record<string, string> = {
    afterHours: 'After-hours',
    daytime: 'Daytime',
    weekend: 'Weekend',
};

export const ADD_ON_LABELS: Record<string, string> = {
    kitchen: 'Kitchen / Breakroom',
    highTouchDisinfection: 'High-Touch Disinfection',
    entryWayMats: 'Entryway Mats',
};

// ─── Calculator ──────────────────────────────────────────────────────

export function calculateJanitorialEstimate(
    config: PricingConfig,
    params: EstimateParams
): EstimateResult {
    const { costStack, productionRates, fixtures, floorModifiers, shiftModifiers, addOns: addOnRates } = config;
    const { facilityType, sqft, floorBreakdown, restroomFixtures, trashBins, daysPerWeek, shift, addOns } = params;

    // 1. Get base production rate for facility type
    const baseRate = productionRates[facilityType] || productionRates['other'] || 3500;

    // 2. Calculate weighted production rate from floor type mix
    let weightedRate = baseRate;
    if (floorBreakdown.length > 0) {
        const totalPercent = floorBreakdown.reduce((s, f) => s + f.percent, 0);
        if (totalPercent > 0) {
            weightedRate = floorBreakdown.reduce((sum, f) => {
                const modifier = floorModifiers[f.type] ?? 1.0;
                return sum + (baseRate * modifier * (f.percent / totalPercent));
            }, 0);
        }
    }

    // 3. Base cleaning hours from sqft
    const baseHours = sqft / weightedRate;

    // 4. Fixture time (minutes → hours)
    const fixtureMinutes =
        (restroomFixtures * fixtures.restroomFixtureMinutes) +
        (trashBins * fixtures.trashBinMinutes);
    const fixtureHours = fixtureMinutes / 60;

    // 5. Add-on multiplier
    let addOnMultiplier = 1.0;
    for (const [key, enabled] of Object.entries(addOns)) {
        if (enabled && addOnRates[key]) {
            addOnMultiplier += addOnRates[key];
        }
    }

    // 6. Shift multiplier
    const shiftMultiplier = shiftModifiers[shift] ?? 1.0;

    // 7. Total hours per visit (with minimum)
    const rawHours = (baseHours + fixtureHours) * addOnMultiplier * shiftMultiplier;
    const hoursPerVisit = Math.max(costStack.minHours, Math.round(rawHours * 10) / 10); // round to 0.1

    // 8. Per-visit cost
    const perVisit = hoursPerVisit * costStack.clientRate;

    // 9. Monthly projection
    const daysPerMonth = Math.round(daysPerWeek * 4.33 * 10) / 10;
    const mid = Math.round(perVisit * daysPerMonth);
    const low = Math.round(mid * 0.8);
    const high = Math.round(mid * 1.2);

    return {
        hoursPerVisit,
        perVisit: Math.round(perVisit),
        daysPerMonth,
        monthly: { low, mid, high },
    };
}
