// ============================================================
// xiriOS Bid Calculator Engine
// Production rates based on ISSA 612 standards and industry data
// ============================================================

export interface BuildingType {
    id: string;
    name: string;
    icon: string;
    /** Sqft cleaned per hour — varies by building type */
    productionRate: number;
    /** Default floor mix: percentage that is carpet vs hard floor */
    carpetPercent: number;
    /** Multiplier for specialty cleaning needs (medical = higher) */
    complexityMultiplier: number;
    /** Whether this is a "popular" (high-usage) type or "advanced" */
    popular: boolean;
    /** Default restroom fixture count per 10k sqft */
    fixturesPer10k: { toilets: number; urinals: number; sinks: number };
}

export const BUILDING_TYPES: BuildingType[] = [
    // --- Popular / High-Usage ---
    {
        id: "office",
        name: "Office Building",
        icon: "🏢",
        productionRate: 4200,
        carpetPercent: 65,
        complexityMultiplier: 1.0,
        popular: true,
        fixturesPer10k: { toilets: 6, urinals: 2, sinks: 6 },
    },
    {
        id: "medical",
        name: "Medical / Clinic",
        icon: "🏥",
        productionRate: 2200,
        carpetPercent: 20,
        complexityMultiplier: 1.4,
        popular: true,
        fixturesPer10k: { toilets: 4, urinals: 1, sinks: 6 },
    },
    {
        id: "school",
        name: "School / University",
        icon: "🏫",
        productionRate: 3800,
        carpetPercent: 30,
        complexityMultiplier: 1.1,
        popular: true,
        fixturesPer10k: { toilets: 10, urinals: 4, sinks: 8 },
    },
    {
        id: "retail",
        name: "Retail / Storefront",
        icon: "🏬",
        productionRate: 4500,
        carpetPercent: 25,
        complexityMultiplier: 0.9,
        popular: true,
        fixturesPer10k: { toilets: 3, urinals: 1, sinks: 3 },
    },
    {
        id: "restaurant",
        name: "Restaurant / Food Service",
        icon: "🍽️",
        productionRate: 2800,
        carpetPercent: 5,
        complexityMultiplier: 1.3,
        popular: true,
        fixturesPer10k: { toilets: 4, urinals: 1, sinks: 4 },
    },
    {
        id: "warehouse",
        name: "Warehouse / Industrial",
        icon: "🏭",
        productionRate: 6000,
        carpetPercent: 5,
        complexityMultiplier: 0.8,
        popular: true,
        fixturesPer10k: { toilets: 2, urinals: 1, sinks: 2 },
    },
    // --- Advanced / Less Common ---
    {
        id: "church",
        name: "Church / Worship",
        icon: "⛪",
        productionRate: 4000,
        carpetPercent: 70,
        complexityMultiplier: 0.95,
        popular: false,
        fixturesPer10k: { toilets: 4, urinals: 2, sinks: 4 },
    },
    {
        id: "gym",
        name: "Gym / Health Club",
        icon: "🏋️",
        productionRate: 3200,
        carpetPercent: 15,
        complexityMultiplier: 1.15,
        popular: false,
        fixturesPer10k: { toilets: 6, urinals: 2, sinks: 6 },
    },
    {
        id: "bank",
        name: "Bank / Financial",
        icon: "🏦",
        productionRate: 4500,
        carpetPercent: 70,
        complexityMultiplier: 1.0,
        popular: false,
        fixturesPer10k: { toilets: 3, urinals: 1, sinks: 3 },
    },
    {
        id: "daycare",
        name: "Daycare / Childcare",
        icon: "👶",
        productionRate: 2500,
        carpetPercent: 40,
        complexityMultiplier: 1.35,
        popular: false,
        fixturesPer10k: { toilets: 8, urinals: 0, sinks: 6 },
    },
    {
        id: "hotel",
        name: "Hotel / Hospitality",
        icon: "🏨",
        productionRate: 3000,
        carpetPercent: 55,
        complexityMultiplier: 1.2,
        popular: false,
        fixturesPer10k: { toilets: 8, urinals: 2, sinks: 8 },
    },
    {
        id: "auto-dealer",
        name: "Auto Dealership",
        icon: "🚗",
        productionRate: 4800,
        carpetPercent: 35,
        complexityMultiplier: 0.9,
        popular: false,
        fixturesPer10k: { toilets: 3, urinals: 1, sinks: 3 },
    },
    {
        id: "salon",
        name: "Salon / Spa",
        icon: "💇",
        productionRate: 3000,
        carpetPercent: 20,
        complexityMultiplier: 1.1,
        popular: false,
        fixturesPer10k: { toilets: 3, urinals: 0, sinks: 5 },
    },
    {
        id: "movie-theater",
        name: "Movie Theater",
        icon: "🎬",
        productionRate: 3500,
        carpetPercent: 80,
        complexityMultiplier: 1.05,
        popular: false,
        fixturesPer10k: { toilets: 6, urinals: 3, sinks: 6 },
    },
    {
        id: "residential",
        name: "Residential Home",
        icon: "🏠",
        productionRate: 2000,
        carpetPercent: 55,
        complexityMultiplier: 1.0,
        popular: false,
        fixturesPer10k: { toilets: 3, urinals: 0, sinks: 3 },
    },
];

export type Frequency = "once" | "1" | "2" | "3" | "4" | "5" | "6" | "7";

export const FREQUENCIES: { value: Frequency; label: string; group: "recurring" | "once" }[] = [
    { value: "once", label: "One-Time / Deep Clean", group: "once" },
    { value: "1", label: "1x per week", group: "recurring" },
    { value: "2", label: "2x per week", group: "recurring" },
    { value: "3", label: "3x per week", group: "recurring" },
    { value: "4", label: "4x per week", group: "recurring" },
    { value: "5", label: "5x per week (weekdays)", group: "recurring" },
    { value: "6", label: "6x per week", group: "recurring" },
    { value: "7", label: "7x per week (daily)", group: "recurring" },
];

// ============================================================
// State-Based Recommended Rates
// Janitor wage data from BLS (median hourly, 2024), payroll tax
// estimates include avg SUTA + FUTA + FICA + WC by state
// ============================================================

export interface StateData {
    code: string;
    name: string;
    /** Recommended hourly wage for janitors/cleaners */
    recommendedWage: number;
    /** Estimated total payroll tax burden % */
    payrollTaxPercent: number;
    /** Supply cost multiplier (1.0 = national avg) */
    supplyCostMultiplier: number;
}

export const STATES: StateData[] = [
    { code: "AL", name: "Alabama", recommendedWage: 13.50, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.90 },
    { code: "AK", name: "Alaska", recommendedWage: 17.00, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.25 },
    { code: "AZ", name: "Arizona", recommendedWage: 15.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.98 },
    { code: "AR", name: "Arkansas", recommendedWage: 13.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.88 },
    { code: "CA", name: "California", recommendedWage: 18.50, payrollTaxPercent: 16.5, supplyCostMultiplier: 1.20 },
    { code: "CO", name: "Colorado", recommendedWage: 17.00, payrollTaxPercent: 14.5, supplyCostMultiplier: 1.08 },
    { code: "CT", name: "Connecticut", recommendedWage: 17.50, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.15 },
    { code: "DE", name: "Delaware", recommendedWage: 15.00, payrollTaxPercent: 14.5, supplyCostMultiplier: 1.02 },
    { code: "DC", name: "Washington D.C.", recommendedWage: 19.00, payrollTaxPercent: 16.0, supplyCostMultiplier: 1.25 },
    { code: "FL", name: "Florida", recommendedWage: 15.00, payrollTaxPercent: 13.0, supplyCostMultiplier: 1.00 },
    { code: "GA", name: "Georgia", recommendedWage: 14.00, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.95 },
    { code: "HI", name: "Hawaii", recommendedWage: 17.50, payrollTaxPercent: 16.0, supplyCostMultiplier: 1.30 },
    { code: "ID", name: "Idaho", recommendedWage: 14.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.92 },
    { code: "IL", name: "Illinois", recommendedWage: 16.50, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.05 },
    { code: "IN", name: "Indiana", recommendedWage: 14.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.92 },
    { code: "IA", name: "Iowa", recommendedWage: 14.00, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.90 },
    { code: "KS", name: "Kansas", recommendedWage: 14.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.90 },
    { code: "KY", name: "Kentucky", recommendedWage: 13.50, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.88 },
    { code: "LA", name: "Louisiana", recommendedWage: 13.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.90 },
    { code: "ME", name: "Maine", recommendedWage: 15.50, payrollTaxPercent: 15.0, supplyCostMultiplier: 1.02 },
    { code: "MD", name: "Maryland", recommendedWage: 16.50, payrollTaxPercent: 15.0, supplyCostMultiplier: 1.10 },
    { code: "MA", name: "Massachusetts", recommendedWage: 18.00, payrollTaxPercent: 16.0, supplyCostMultiplier: 1.18 },
    { code: "MI", name: "Michigan", recommendedWage: 15.00, payrollTaxPercent: 15.0, supplyCostMultiplier: 0.95 },
    { code: "MN", name: "Minnesota", recommendedWage: 16.00, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.02 },
    { code: "MS", name: "Mississippi", recommendedWage: 12.50, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.85 },
    { code: "MO", name: "Missouri", recommendedWage: 14.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.92 },
    { code: "MT", name: "Montana", recommendedWage: 14.50, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.95 },
    { code: "NE", name: "Nebraska", recommendedWage: 14.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.90 },
    { code: "NV", name: "Nevada", recommendedWage: 15.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 1.02 },
    { code: "NH", name: "New Hampshire", recommendedWage: 15.50, payrollTaxPercent: 14.5, supplyCostMultiplier: 1.05 },
    { code: "NJ", name: "New Jersey", recommendedWage: 17.00, payrollTaxPercent: 16.0, supplyCostMultiplier: 1.15 },
    { code: "NM", name: "New Mexico", recommendedWage: 14.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.92 },
    { code: "NY", name: "New York", recommendedWage: 18.00, payrollTaxPercent: 16.5, supplyCostMultiplier: 1.20 },
    { code: "NC", name: "North Carolina", recommendedWage: 14.00, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.95 },
    { code: "ND", name: "North Dakota", recommendedWage: 15.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.92 },
    { code: "OH", name: "Ohio", recommendedWage: 14.50, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.92 },
    { code: "OK", name: "Oklahoma", recommendedWage: 13.50, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.88 },
    { code: "OR", name: "Oregon", recommendedWage: 16.50, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.08 },
    { code: "PA", name: "Pennsylvania", recommendedWage: 15.50, payrollTaxPercent: 15.0, supplyCostMultiplier: 1.00 },
    { code: "RI", name: "Rhode Island", recommendedWage: 16.00, payrollTaxPercent: 15.5, supplyCostMultiplier: 1.08 },
    { code: "SC", name: "South Carolina", recommendedWage: 13.50, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.92 },
    { code: "SD", name: "South Dakota", recommendedWage: 14.00, payrollTaxPercent: 13.0, supplyCostMultiplier: 0.88 },
    { code: "TN", name: "Tennessee", recommendedWage: 14.00, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.92 },
    { code: "TX", name: "Texas", recommendedWage: 14.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.95 },
    { code: "UT", name: "Utah", recommendedWage: 15.00, payrollTaxPercent: 14.0, supplyCostMultiplier: 0.95 },
    { code: "VT", name: "Vermont", recommendedWage: 16.00, payrollTaxPercent: 15.0, supplyCostMultiplier: 1.05 },
    { code: "VA", name: "Virginia", recommendedWage: 15.50, payrollTaxPercent: 14.0, supplyCostMultiplier: 1.02 },
    { code: "WA", name: "Washington", recommendedWage: 18.00, payrollTaxPercent: 16.0, supplyCostMultiplier: 1.15 },
    { code: "WV", name: "West Virginia", recommendedWage: 13.00, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.88 },
    { code: "WI", name: "Wisconsin", recommendedWage: 15.00, payrollTaxPercent: 14.5, supplyCostMultiplier: 0.95 },
    { code: "WY", name: "Wyoming", recommendedWage: 14.50, payrollTaxPercent: 13.5, supplyCostMultiplier: 0.92 },
];

/** Get recommended financial defaults for a given state */
export function getStateDefaults(stateCode: string): Partial<CalculatorInputs> | null {
    const state = STATES.find((s) => s.code === stateCode);
    if (!state) return null;
    return {
        wageRate: state.recommendedWage,
        payrollTaxPercent: state.payrollTaxPercent,
        supplyCostPerSqft: Math.round(0.0015 * state.supplyCostMultiplier * 10000) / 10000,
    };
}

// ============================================================
// Metro-Level BLS Wage Data
// Imported from auto-generated metro-wages.ts (run: npx tsx scripts/generate-market-data.ts)
// ============================================================

export { METRO_WAGES as METROS, getMetrosForState, resolveZip } from "./metro-wages";
export type { MetroWageData as MetroData } from "./metro-wages";
import { METRO_WAGES } from "./metro-wages";

/** Get recommended financial defaults for a given metro area */
export function getMetroDefaults(metroId: string): Partial<CalculatorInputs> | null {
    const metro = METRO_WAGES.find((m) => m.id === metroId);
    if (!metro) return null;
    return { wageRate: metro.medianWage };
}


export interface CleaningTask {
    id: string;
    name: string;
    category: "general" | "restrooms" | "floors" | "surfaces" | "prep" | "travel" | "specialty";
    /** Whether this is included by default */
    defaultIncluded: boolean;
    /** ISSA-calibrated minutes per 1,000 sqft */
    minutesPer1kSqft: number;
    /** How carpet/hard-floor split affects this task's sqft */
    floorType: "carpet" | "hard" | "none";
    /** Description for the proposal */
    description: string;
    /**
     * Industry-standard recommended frequency (times per week).
     * "max" = every visit (match bid frequency).  Otherwise a numeric string.
     */
    recommendedFrequency: "max" | string;
}

export const CLEANING_TASKS: CleaningTask[] = [
    // General — every-visit tasks
    { id: "trash", name: "Empty trash & replace liners", category: "general", defaultIncluded: true, minutesPer1kSqft: 2.5, floorType: "none", description: "Empty all waste baskets, replace liners, transport to dumpster", recommendedFrequency: "max" },
    { id: "dust", name: "Dust surfaces & desks", category: "general", defaultIncluded: true, minutesPer1kSqft: 3.0, floorType: "none", description: "Dust all reachable horizontal surfaces, desks, ledges, and countertops", recommendedFrequency: "max" },
    { id: "wipe", name: "Wipe & sanitize surfaces", category: "general", defaultIncluded: true, minutesPer1kSqft: 2.5, floorType: "none", description: "Wipe down and sanitize high-touch surfaces: door handles, light switches, railings", recommendedFrequency: "max" },
    { id: "glass-entry", name: "Clean entry glass & doors", category: "general", defaultIncluded: true, minutesPer1kSqft: 1.0, floorType: "none", description: "Clean and polish entry glass doors and sidelights", recommendedFrequency: "3" },
    { id: "high-touch-disinfect", name: "High-touch point disinfection", category: "general", defaultIncluded: false, minutesPer1kSqft: 1.8, floorType: "none", description: "Disinfect touch points such as pulls, switches, handles, railings, and shared controls", recommendedFrequency: "max" },
    // Restrooms — every visit
    { id: "restroom-clean", name: "Clean & disinfect restrooms", category: "restrooms", defaultIncluded: true, minutesPer1kSqft: 3.5, floorType: "none", description: "Clean and disinfect toilets, urinals, sinks, mirrors, and partitions", recommendedFrequency: "max" },
    { id: "restroom-restock", name: "Restock restroom supplies", category: "restrooms", defaultIncluded: true, minutesPer1kSqft: 0.75, floorType: "none", description: "Restock paper towels, toilet paper, hand soap, and sanitizer", recommendedFrequency: "max" },
    { id: "restroom-fixture-detail", name: "Restroom fixture detail cleaning", category: "restrooms", defaultIncluded: false, minutesPer1kSqft: 1.6, floorType: "none", description: "Detail-clean partitions, fixtures, dispensers, and metal hardware", recommendedFrequency: "2" },
    // Floors — every visit (affected by carpet/hard split)
    { id: "vacuum", name: "Vacuum carpeted areas", category: "floors", defaultIncluded: true, minutesPer1kSqft: 4.5, floorType: "carpet", description: "Vacuum all carpeted areas including edges and corners", recommendedFrequency: "max" },
    { id: "mop", name: "Mop hard floors", category: "floors", defaultIncluded: true, minutesPer1kSqft: 5.0, floorType: "hard", description: "Damp mop all hard-surface flooring", recommendedFrequency: "max" },
    { id: "sweep", name: "Sweep hard floors", category: "floors", defaultIncluded: false, minutesPer1kSqft: 3.5, floorType: "hard", description: "Sweep all hard-surface floors before mopping", recommendedFrequency: "max" },
    { id: "dust-mop", name: "Dust mop hard floors", category: "floors", defaultIncluded: false, minutesPer1kSqft: 2.9, floorType: "hard", description: "Dry dust mop to remove loose debris prior to wet floor steps", recommendedFrequency: "max" },
    { id: "auto-scrub", name: "Auto-scrub hard floors", category: "floors", defaultIncluded: false, minutesPer1kSqft: 3.2, floorType: "hard", description: "Machine scrub and recover solution on hard floor surfaces", recommendedFrequency: "2" },
    // Surfaces / detail production tasks
    { id: "dust-treated", name: "Dust with treated cloth", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 1.8, floorType: "none", description: "Detailed dusting of horizontal surfaces using treated cloth method", recommendedFrequency: "3" },
    { id: "wipe-disinfect-surfaces", name: "Damp wipe with disinfectant", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 2.2, floorType: "none", description: "Damp wipe and disinfect desks, counters, ledges, and contact surfaces", recommendedFrequency: "3" },
    { id: "detail-crevice", name: "Corners & crevices detail cleaning", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 2.6, floorType: "none", description: "Detail clean corners and crevices with hand tools or vacuum attachments", recommendedFrequency: "1" },
    { id: "glass-panel-clean", name: "Interior glass panel / partition cleaning", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 2.4, floorType: "none", description: "Clean interior glass panels, partitions, and spot-prone glazed surfaces", recommendedFrequency: "1" },
    { id: "handrail-wipe", name: "Handrail / banister wipe", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 1.0, floorType: "none", description: "Dust and damp wipe handrails and banisters in circulation zones", recommendedFrequency: "max" },
    { id: "mat-vacuum", name: "Walk-off mat vacuuming", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 1.2, floorType: "none", description: "Vacuum and detail entry walk-off mats and adjacent transitions", recommendedFrequency: "max" },
    { id: "stair-damp-mop", name: "Stairwell damp mopping", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 2.1, floorType: "none", description: "Damp mop stair treads and landings, including nosing edges", recommendedFrequency: "3" },
    { id: "elevator-spot-clean", name: "Elevator cab spot cleaning", category: "surfaces", defaultIncluded: false, minutesPer1kSqft: 1.1, floorType: "none", description: "Spot clean elevator glass, control panels, tracks, and interior surfaces", recommendedFrequency: "3" },
    // Prep / solution handling (modeled as low-overhead per-area adders)
    { id: "solution-fill-1gal", name: "Solution prep: fill 1-gallon bottles", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.2, floorType: "none", description: "Mix and fill trigger and quart bottles for route use", recommendedFrequency: "max" },
    { id: "solution-fill-5gal", name: "Solution prep: fill 5-gallon container", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.4, floorType: "none", description: "Prepare and fill 5-gallon bucket or solution reservoir", recommendedFrequency: "max" },
    { id: "solution-fill-20gal", name: "Solution prep: fill 20-gallon tank", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.8, floorType: "none", description: "Fill larger machine tank/reservoir for route deployment", recommendedFrequency: "3" },
    { id: "sprayer-empty-rinse", name: "Empty/rinse trigger sprayers", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.15, floorType: "none", description: "Empty and rinse trigger sprayers to prevent residue and clogging", recommendedFrequency: "3" },
    { id: "dustmop-cleanup", name: "Post-job dust mop cleanup", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.3, floorType: "none", description: "Shake out and refresh dust mop after route", recommendedFrequency: "max" },
    { id: "mopbucket-cleanup", name: "Post-job mop bucket/wringer cleanup", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.4, floorType: "none", description: "Clean and rinse mop bucket and wringer after use", recommendedFrequency: "max" },
    { id: "vacuum-cleanup", name: "Post-job vacuum cleanup", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.3, floorType: "none", description: "Empty and wipe vacuum unit and attachments", recommendedFrequency: "max" },
    { id: "change-dustmop", name: "Change dust mop head", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.2, floorType: "none", description: "Change out dust mop head or disposable pad", recommendedFrequency: "max" },
    { id: "change-wetmop", name: "Change wet mop head", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.2, floorType: "none", description: "Swap wet mop head during route as needed", recommendedFrequency: "max" },
    { id: "cord-wrap", name: "Equipment cord wrap/reset", category: "prep", defaultIncluded: false, minutesPer1kSqft: 0.1, floorType: "none", description: "Secure machine cords and reset equipment after service", recommendedFrequency: "max" },
    // Travel / circulation overhead adders
    { id: "travel-walk-slow", name: "Travel overhead: slow interior walking", category: "travel", defaultIncluded: false, minutesPer1kSqft: 0.9, floorType: "none", description: "Interior walking/travel overhead for fragmented layouts", recommendedFrequency: "max" },
    { id: "travel-walk-standard", name: "Travel overhead: standard walking", category: "travel", defaultIncluded: false, minutesPer1kSqft: 0.6, floorType: "none", description: "Typical circulation/travel overhead between areas", recommendedFrequency: "max" },
    { id: "travel-machine-rider", name: "Travel overhead: rider machine movement", category: "travel", defaultIncluded: false, minutesPer1kSqft: 0.4, floorType: "none", description: "Rider machine routing overhead in large-format facilities", recommendedFrequency: "max" },
    // Specialty / Add-ons — periodic
    { id: "breakroom", name: "Kitchen / breakroom cleaning", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 2.5, floorType: "none", description: "Clean breakroom counters, tables, sinks, and appliance exteriors", recommendedFrequency: "3" },
    { id: "glass-interior", name: "Interior glass & partitions", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 2.0, floorType: "none", description: "Clean interior glass partitions, conference room glass, and mirrors", recommendedFrequency: "1" },
    { id: "high-dust", name: "High dusting (vents, ledges)", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 2.0, floorType: "none", description: "Dust high areas: vents, ceiling ledges, tops of cabinets", recommendedFrequency: "0.25" },
    { id: "floor-wax", name: "Floor waxing & buffing", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 8.0, floorType: "hard", description: "Strip, wax, and buff hard floors (periodic)", recommendedFrequency: "0.25" },
    { id: "carpet-extract", name: "Carpet extraction / shampooing", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 10.0, floorType: "carpet", description: "Deep clean carpets with hot water extraction (periodic)", recommendedFrequency: "0.25" },
    { id: "pressure-wash", name: "Pressure washing (exterior)", category: "specialty", defaultIncluded: false, minutesPer1kSqft: 5.0, floorType: "none", description: "Pressure wash building exterior, sidewalks, and parking areas", recommendedFrequency: "0.25" },
];

export const TASK_CATEGORIES = [
    { id: "general" as const, label: "General Cleaning", icon: "🧹" },
    { id: "restrooms" as const, label: "Restrooms", icon: "🚻" },
    { id: "floors" as const, label: "Floors", icon: "🧽" },
    { id: "surfaces" as const, label: "Surfaces & Detail", icon: "🪟" },
    { id: "prep" as const, label: "Setup & Refill", icon: "🧪" },
    { id: "travel" as const, label: "Travel & Movement", icon: "🚶" },
    { id: "specialty" as const, label: "Specialty / Add-ons", icon: "✨" },
];

// ============================================================
// Room-Level Floor Types — grouped by cleaning method
// ============================================================

export type RoomFloorType = 'carpet' | 'vinyl' | 'vct' | 'tile' | 'concrete';

export interface FloorTypeConfig {
    id: RoomFloorType;
    label: string;
    cleaningMethod: string;
    /** Maps to CleaningTask.floorType for time calculations */
    taskFloorCategory: 'carpet' | 'hard';
    /** Task IDs auto-recommended when this floor type is selected */
    recommendedTasks: string[];
}

export const ROOM_FLOOR_TYPES: FloorTypeConfig[] = [
    { id: 'carpet', label: 'Carpet', cleaningMethod: 'Vacuum + spot clean',
        taskFloorCategory: 'carpet', recommendedTasks: ['vacuum'] },
    { id: 'vinyl', label: 'Vinyl / LVP', cleaningMethod: 'Dust mop → damp mop',
        taskFloorCategory: 'hard', recommendedTasks: ['mop'] },
    { id: 'vct', label: 'VCT', cleaningMethod: 'Dust mop → damp mop, periodic strip & wax',
        taskFloorCategory: 'hard', recommendedTasks: ['mop', 'floor-wax'] },
    { id: 'tile', label: 'Tile (Ceramic/Porcelain)', cleaningMethod: 'Mop + periodic grout scrub',
        taskFloorCategory: 'hard', recommendedTasks: ['mop'] },
    { id: 'concrete', label: 'Concrete / Epoxy', cleaningMethod: 'Sweep → auto-scrub',
        taskFloorCategory: 'hard', recommendedTasks: ['sweep', 'mop'] },
];

/** Given a room's floor breakdown, return recommended cleaning task IDs */
export function getRecommendedFloorTasks(floorBreakdown: { type: RoomFloorType }[]): string[] {
    const tasks = new Set<string>();
    for (const fb of floorBreakdown) {
        const config = ROOM_FLOOR_TYPES.find(f => f.id === fb.type);
        config?.recommendedTasks.forEach(t => tasks.add(t));
    }
    return [...tasks];
}

// ============================================================
// Room / Space Types for scope-per-room
// ============================================================

export interface RoomType {
    id: string;
    name: string;
    icon: string;
    defaultTasks: string[];
    relevantCategories: string[];  // which task categories to show in this room
    /** Controls fixture input visibility on room cards */
    showFixtures?: 'prominent' | 'sinks-only' | false;
}

export const ROOM_TYPES: RoomType[] = [
    { id: "lobby", name: "Lobby / Reception", icon: "🏢", defaultTasks: ["trash", "dust", "wipe", "glass-entry", "vacuum", "mop"], relevantCategories: ["general", "floors", "specialty"] },
    { id: "offices", name: "Offices", icon: "💼", defaultTasks: ["trash", "dust", "wipe", "vacuum"], relevantCategories: ["general", "floors"] },
    { id: "restrooms", name: "Restrooms", icon: "🚻", defaultTasks: ["restroom-clean", "restroom-restock", "mop"], relevantCategories: ["restrooms", "floors"], showFixtures: 'prominent' },
    { id: "hallways", name: "Hallways / Corridors", icon: "🚶", defaultTasks: ["vacuum", "mop", "dust"], relevantCategories: ["general", "floors"] },
    { id: "kitchen", name: "Kitchen / Breakroom", icon: "🍽️", defaultTasks: ["breakroom", "trash", "wipe", "mop"], relevantCategories: ["general", "floors", "specialty"], showFixtures: 'sinks-only' },
    { id: "conference", name: "Conference Rooms", icon: "📋", defaultTasks: ["trash", "dust", "wipe", "vacuum", "glass-interior"], relevantCategories: ["general", "floors"] },
    { id: "patient", name: "Patient / Exam Rooms", icon: "🩺", defaultTasks: ["trash", "dust", "wipe", "restroom-clean", "mop"], relevantCategories: ["general", "restrooms", "floors", "specialty"], showFixtures: 'prominent' },
    { id: "common", name: "Common Areas", icon: "🛋️", defaultTasks: ["trash", "dust", "wipe", "vacuum"], relevantCategories: ["general", "floors", "specialty"] },
    { id: "warehouse", name: "Warehouse / Storage", icon: "📦", defaultTasks: ["sweep", "trash"], relevantCategories: ["general", "floors"] },
    { id: "exterior", name: "Exterior", icon: "🏗️", defaultTasks: ["pressure-wash"], relevantCategories: ["specialty"] },
    { id: "custom", name: "Custom Area", icon: "✏️", defaultTasks: [], relevantCategories: ["general", "restrooms", "floors", "specialty"] },
];

export const TASK_FREQUENCY_OPTIONS = [
    { value: "7", label: "7x/wk" },
    { value: "6", label: "6x/wk" },
    { value: "5", label: "5x/wk" },
    { value: "4", label: "4x/wk" },
    { value: "3", label: "3x/wk" },
    { value: "2", label: "2x/wk" },
    { value: "1", label: "1x/wk" },
    { value: "0.5", label: "2x/mo" },
    { value: "0.25", label: "1x/mo" },
    { value: "0.083", label: "Quarterly" },
    { value: "0.042", label: "Semi-Annual" },
    { value: "0.019", label: "Annual" },
] as const;

/**
 * Resolve the recommended frequency for a task, capped at bid frequency.
 * - "max" → use bid frequency
 * - numeric → min(recommended, bidFreq)
 * - once → always "once" (single visit)
 */
export function resolveTaskFrequency(recommended: "max" | string, bidFrequency: string): string {
    if (bidFrequency === "once") return "once";
    const bidVal = parseFloat(bidFrequency);
    if (recommended === "max") return bidFrequency;
    const recVal = parseFloat(recommended);
    if (isNaN(recVal)) return bidFrequency;
    // Cap at bid frequency
    const effective = Math.min(recVal, bidVal);
    // Snap to the nearest known option value
    const opt = TASK_FREQUENCY_OPTIONS.find(o => parseFloat(o.value) === effective);
    if (opt) return opt.value;
    // If capped matches bid exactly, use that
    if (effective === bidVal) return bidFrequency;
    // Fall back to the closest option ≤ effective
    const closest = [...TASK_FREQUENCY_OPTIONS]
        .filter(o => parseFloat(o.value) <= effective)
        .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
    return closest.length ? closest[0].value : bidFrequency;
}

/**
 * Return frequency options filtered to values ≤ bid frequency.
 * If bid is "once", returns only the one-time option.
 */
export function getTaskFrequencyOptions(bidFrequency: string) {
    if (bidFrequency === "once") return [{ value: "once" as const, label: "1x (one-time)" }];
    const bidVal = parseFloat(bidFrequency);
    return TASK_FREQUENCY_OPTIONS.filter(o => parseFloat(o.value) <= bidVal);
}

export interface CustomTask {
    id: string;           // unique ID (prefixed with 'ct-')
    name: string;
    description?: string;
    frequency?: string;   // per-task frequency (defaults to bid frequency)
}

export interface RoomFloorBreakdown {
    type: RoomFloorType;
    /** Percentage of room that is this floor type (should total 100 across all entries) */
    percent: number;
}

export interface RoomFixtures {
    toilets?: number;
    urinals?: number;
    sinks?: number;
}

export interface RoomScope {
    id: string;           // unique instance id (crypto.randomUUID)
    roomTypeId: string;
    customName?: string;  // editable name for custom rooms
    sqft?: number;        // per-room sqft (auto-distributed from total, user can override)
    // Walkthrough dimensions
    width?: number;       // feet (from walkthrough measurement)
    length?: number;      // feet (from walkthrough measurement)
    // Per-room floor type(s) — a room can have multiple (e.g. 70% tile + 30% carpet)
    floorBreakdown?: RoomFloorBreakdown[];
    // Per-room fixture counts from walkthrough
    fixtures?: RoomFixtures;
    tasks: string[];      // selected preset task IDs
    customTasks?: CustomTask[];  // user-created tasks for this room
    taskOverrides?: Record<string, { name?: string; description?: string }>; // edited preset tasks
    taskFrequencies?: Record<string, string>; // per-task frequency overrides (task ID -> frequency value)
    taskTimeOverrides?: Record<string, number>; // per-task time overrides (minutes, replaces ISSA default)
    notes?: string;
}

// ============================================================
// Room Area Ratios — how total sqft is distributed per building type
// ============================================================

export const ROOM_AREA_RATIOS: Record<string, Record<string, number>> = {
    office: { lobby: 0.08, offices: 0.40, restrooms: 0.08, hallways: 0.15, kitchen: 0.07, conference: 0.22 },
    medical: { lobby: 0.15, patient: 0.45, restrooms: 0.12, hallways: 0.28 },
    retail: { lobby: 0.65, restrooms: 0.10, common: 0.25 },
    school: { lobby: 0.08, offices: 0.15, restrooms: 0.10, hallways: 0.20, kitchen: 0.07, common: 0.40 },
    gym: { lobby: 0.15, restrooms: 0.15, common: 0.70 },
    warehouse: { offices: 0.10, restrooms: 0.05, warehouse: 0.85 },
    restaurant: { lobby: 0.60, restrooms: 0.12, kitchen: 0.28 },
    church: { lobby: 0.12, restrooms: 0.08, common: 0.65, offices: 0.15 },
    hotel: { lobby: 0.15, restrooms: 0.10, hallways: 0.25, common: 0.50 },
    bank: { lobby: 0.40, offices: 0.45, restrooms: 0.15 },
    daycare: { lobby: 0.10, restrooms: 0.12, common: 0.55, offices: 0.08, kitchen: 0.15 },
    "auto-dealer": { lobby: 0.50, offices: 0.25, restrooms: 0.10, common: 0.15 },
    salon: { lobby: 0.55, restrooms: 0.15, common: 0.30 },
    "movie-theater": { lobby: 0.20, restrooms: 0.12, common: 0.58, hallways: 0.10 },
    residential: { lobby: 0.10, restrooms: 0.10, kitchen: 0.15, common: 0.65 },
};

/** Auto-seed rooms based on building type, distributing sqft */
export function getDefaultRooms(buildingTypeId: string, totalSqft?: number): RoomScope[] {
    const presets: Record<string, string[]> = {
        office: ["lobby", "offices", "restrooms", "hallways", "kitchen", "conference"],
        medical: ["lobby", "patient", "restrooms", "hallways"],
        retail: ["lobby", "restrooms", "common"],
        school: ["lobby", "offices", "restrooms", "hallways", "kitchen", "common"],
        gym: ["lobby", "restrooms", "common"],
        warehouse: ["offices", "restrooms", "warehouse"],
        restaurant: ["lobby", "restrooms", "kitchen"],
        church: ["lobby", "restrooms", "common", "offices"],
        government: ["lobby", "offices", "restrooms", "hallways", "conference"],
        hotel: ["lobby", "restrooms", "hallways", "common"],
        industrial: ["offices", "restrooms", "warehouse"],
        bank: ["lobby", "offices", "restrooms"],
    };
    const roomIds = presets[buildingTypeId] || ["lobby", "offices", "restrooms"];
    const ratios = ROOM_AREA_RATIOS[buildingTypeId];
    return roomIds.map((rid) => {
        const rt = ROOM_TYPES.find((r) => r.id === rid)!;
        const ratio = ratios?.[rid];
        return {
            id: crypto.randomUUID(),
            roomTypeId: rid,
            sqft: totalSqft && ratio ? Math.round(totalSqft * ratio) : undefined,
            tasks: [...rt.defaultTasks],
        };
    });
}

export type SupplyPolicy = "company" | "client" | "shared";

export interface CalculatorInputs {
    buildingTypeId: string;
    sqft: number;
    frequency: Frequency;
    /** Wages per hour in dollars */
    wageRate: number;
    /** Payroll tax percentage (FICA, SUTA, FUTA, WC) */
    payrollTaxPercent: number;
    /** Overhead percentage */
    overheadPercent: number;
    /** Desired profit margin percentage */
    profitPercent: number;
    /** Supply cost per sqft per visit */
    supplyCostPerSqft: number;
    /** Who covers supplies: company (full), client ($0), or shared (50/50) */
    supplyPolicy: SupplyPolicy;
    /**
     * Optional override for global production rate in sqft/hour.
     * When provided, task-time model is scaled from ISSA baseline by:
     * baselineProductionRate / productionRateOverride
     */
    productionRateOverride?: number;
    /**
     * Optional per-task override for ISSA minutes per 1,000 sqft.
     * Key is CleaningTask.id, value is minutes/1k sqft.
     */
    taskMinutesPer1kOverrides?: Record<string, number>;
}

export interface CalculatorResults {
    buildingType: BuildingType;
    // Time
    hoursPerVisit: number;
    visitsPerMonth: number;
    totalHoursPerMonth: number;
    // Fixture estimates
    estimatedFixtures: { toilets: number; urinals: number; sinks: number };
    // Cost breakdown
    laborCostPerMonth: number;
    payrollTaxCost: number;
    supplyCostPerMonth: number;
    overheadCost: number;
    totalCostPerMonth: number;
    profitAmount: number;
    totalPricePerMonth: number;
    // Per-visit and per-sqft
    pricePerVisit: number;
    pricePerSqft: number;
    // Effective hourly rate
    effectiveHourlyRate: number;
}

export const DEFAULT_INPUTS: CalculatorInputs = {
    buildingTypeId: "office",
    sqft: 10000,
    frequency: "5",
    wageRate: 16,
    payrollTaxPercent: 15,
    overheadPercent: 12,
    profitPercent: 15,
    supplyCostPerSqft: 0.0015,
    supplyPolicy: "company",
};

/** Calculate the restroom fixture time in hours per visit */
function fixtureTime(fixtures: { toilets: number; urinals: number; sinks: number }): number {
    // Industry standard: ~3 min per toilet, ~1.5 min per urinal, ~1 min per sink
    const minutes =
        fixtures.toilets * 3 +
        fixtures.urinals * 1.5 +
        fixtures.sinks * 1;
    return minutes / 60;
}

/**
 * Apply floor-type scaling to sqft based on building carpet %.
 *  - "carpet" → sqft × (carpetPercent / 100)
 *  - "hard"   → sqft × ((100 - carpetPercent) / 100)
 *  - "none"   → full sqft (task applies to all surfaces)
 */
function applyFloorType(sqft: number, floorType: CleaningTask["floorType"], carpetPercent: number): number {
    if (floorType === "carpet") return sqft * (carpetPercent / 100);
    if (floorType === "hard") return sqft * ((100 - carpetPercent) / 100);
    return sqft;
}

/**
 * Apply floor-type scaling using per-room floor breakdown.
 * A room can have multiple floor types (e.g. 70% tile + 30% carpet).
 * Calculates the effective sqft for a given task floor type.
 */
function applyRoomFloorBreakdown(
    roomSqft: number,
    taskFloorType: CleaningTask["floorType"],
    floorBreakdown: RoomFloorBreakdown[]
): number {
    if (taskFloorType === "none") return roomSqft;

    let carpetPct = 0;
    let hardPct = 0;
    for (const fb of floorBreakdown) {
        const config = ROOM_FLOOR_TYPES.find(f => f.id === fb.type);
        if (!config) continue;
        if (config.taskFloorCategory === 'carpet') {
            carpetPct += fb.percent;
        } else {
            hardPct += fb.percent;
        }
    }

    if (taskFloorType === "carpet") return roomSqft * (carpetPct / 100);
    if (taskFloorType === "hard") return roomSqft * (hardPct / 100);
    return roomSqft;
}

/**
 * Task-based pricing engine.
 *
 * Computes monthly labor from each room's tasks (ISSA times × per-room sqft × frequency),
 * then applies building complexity, wage, payroll, overhead, supplies, and profit.
 *
 * @param inputs   Financial and building parameters
 * @param rooms    Current room scopes with per-room sqft and task selections
 */
export function calculate(inputs: CalculatorInputs, rooms?: RoomScope[]): CalculatorResults {
    const buildingType = BUILDING_TYPES.find((b) => b.id === inputs.buildingTypeId) ?? BUILDING_TYPES[0];
    const isOneOff = inputs.frequency === "once";
    const bidFreqValue = isOneOff ? 1 : parseFloat(inputs.frequency);
    const bidVisitsPerMonth = isOneOff ? 1 : Math.round(bidFreqValue * 4.33);

    // --- Task-based time calculation ---
    let totalMonthlyMinutes = 0;
    // Track "max frequency" visits for hoursPerVisit derivation
    let maxFreqMinutesPerVisit = 0;

    if (rooms && rooms.length > 0) {
        const taskMap = new Map(CLEANING_TASKS.map(t => [t.id, t]));

        // Track whether any rooms have explicit fixture counts
        let hasRoomFixtures = false;
        let roomFixtureTotal = { toilets: 0, urinals: 0, sinks: 0 };

        for (const room of rooms) {
            // Room sqft: use room override, or fallback to total / roomCount
            const roomSqft = room.sqft || Math.round(inputs.sqft / rooms.length);

            // Collect per-room fixture counts
            if (room.fixtures && (room.fixtures.toilets || room.fixtures.urinals || room.fixtures.sinks)) {
                hasRoomFixtures = true;
                roomFixtureTotal.toilets += room.fixtures.toilets || 0;
                roomFixtureTotal.urinals += room.fixtures.urinals || 0;
                roomFixtureTotal.sinks += room.fixtures.sinks || 0;
            }

            for (const taskId of room.tasks) {
                const taskDef = taskMap.get(taskId);
                if (!taskDef) continue;

                // Calculate effective sqft (floor-type adjusted)
                // Use per-room floor breakdown if available, otherwise fall back to building-level carpetPercent
                const effectiveSqft = room.floorBreakdown && room.floorBreakdown.length > 0
                    ? applyRoomFloorBreakdown(roomSqft, taskDef.floorType, room.floorBreakdown)
                    : applyFloorType(roomSqft, taskDef.floorType, buildingType.carpetPercent);
                if (effectiveSqft <= 0) continue;

                // Base task time from ISSA task model, with optional per-task override
                const minutesPer1k = inputs.taskMinutesPer1kOverrides?.[taskId];
                const effectiveMinutesPer1k =
                    Number.isFinite(minutesPer1k) && (minutesPer1k as number) > 0
                        ? (minutesPer1k as number)
                        : taskDef.minutesPer1kSqft;
                const baseMinutes = effectiveMinutesPer1k * (effectiveSqft / 1000);
                const taskMinutes = room.taskTimeOverrides?.[taskId] ?? baseMinutes;

                // Task frequency
                const taskFreqStr = room.taskFrequencies?.[taskId] || inputs.frequency;
                let taskMonthlyVisits: number;
                if (isOneOff || taskFreqStr === "once") {
                    taskMonthlyVisits = 1;
                } else {
                    const taskFreqVal = parseFloat(taskFreqStr);
                    taskMonthlyVisits = Math.round(taskFreqVal * 4.33);
                }

                totalMonthlyMinutes += taskMinutes * taskMonthlyVisits;

                // Track per-visit hours (for tasks at bid frequency)
                if (taskFreqStr === inputs.frequency || taskFreqStr === "once") {
                    maxFreqMinutesPerVisit += taskMinutes;
                }
            }

            // Custom tasks: flat 2 min per 1k sqft each (no specific ISSA data)
            if (room.customTasks) {
                for (const ct of room.customTasks) {
                    const ctMinutes = 2.0 * (roomSqft / 1000);
                    const ctFreqStr = ct.frequency || inputs.frequency;
                    let ctMonthlyVisits: number;
                    if (isOneOff || ctFreqStr === "once") {
                        ctMonthlyVisits = 1;
                    } else {
                        ctMonthlyVisits = Math.round(parseFloat(ctFreqStr) * 4.33);
                    }
                    totalMonthlyMinutes += ctMinutes * ctMonthlyVisits;
                    if (ctFreqStr === inputs.frequency) {
                        maxFreqMinutesPerVisit += ctMinutes;
                    }
                }
            }
        }

        // Fixtures: use room-level counts if any rooms specified them,
        // otherwise fall back to global building-type estimate
        if (hasRoomFixtures) {
            const fixHours = fixtureTime(roomFixtureTotal);
            totalMonthlyMinutes += fixHours * 60 * bidVisitsPerMonth;
            maxFreqMinutesPerVisit += fixHours * 60;
        } else {
            const fixtureMultiplier = inputs.sqft / 10000;
            const autoFixtures = {
                toilets: Math.round(buildingType.fixturesPer10k.toilets * fixtureMultiplier),
                urinals: Math.round(buildingType.fixturesPer10k.urinals * fixtureMultiplier),
                sinks: Math.round(buildingType.fixturesPer10k.sinks * fixtureMultiplier),
            };
            const fixHours = fixtureTime(autoFixtures);
            totalMonthlyMinutes += fixHours * 60 * bidVisitsPerMonth;
            maxFreqMinutesPerVisit += fixHours * 60;
        }
    } else {
        // Fallback: no rooms provided, use old production-rate model
        const baseHours = inputs.sqft / buildingType.productionRate;
        totalMonthlyMinutes = baseHours * 60 * bidVisitsPerMonth;
        maxFreqMinutesPerVisit = baseHours * 60;

        // Global fixture estimate (no rooms)
        const fixtureMultiplier = inputs.sqft / 10000;
        const autoFixtures = {
            toilets: Math.round(buildingType.fixturesPer10k.toilets * fixtureMultiplier),
            urinals: Math.round(buildingType.fixturesPer10k.urinals * fixtureMultiplier),
            sinks: Math.round(buildingType.fixturesPer10k.sinks * fixtureMultiplier),
        };
        const fixHours = fixtureTime(autoFixtures);
        totalMonthlyMinutes += fixHours * 60 * bidVisitsPerMonth;
        maxFreqMinutesPerVisit += fixHours * 60;
    }

    // Fixture estimates for results output
    const fixtureMultiplier = inputs.sqft / 10000;
    const estimatedFixtures = rooms && rooms.length > 0
        ? (() => {
            const hasRoomFix = rooms.some(r => r.fixtures && (r.fixtures.toilets || r.fixtures.urinals || r.fixtures.sinks));
            if (hasRoomFix) {
                return rooms.reduce((acc, r) => ({
                    toilets: acc.toilets + (r.fixtures?.toilets || 0),
                    urinals: acc.urinals + (r.fixtures?.urinals || 0),
                    sinks: acc.sinks + (r.fixtures?.sinks || 0),
                }), { toilets: 0, urinals: 0, sinks: 0 });
            }
            return {
                toilets: Math.round(buildingType.fixturesPer10k.toilets * fixtureMultiplier),
                urinals: Math.round(buildingType.fixturesPer10k.urinals * fixtureMultiplier),
                sinks: Math.round(buildingType.fixturesPer10k.sinks * fixtureMultiplier),
            };
        })()
        : {
            toilets: Math.round(buildingType.fixturesPer10k.toilets * fixtureMultiplier),
            urinals: Math.round(buildingType.fixturesPer10k.urinals * fixtureMultiplier),
            sinks: Math.round(buildingType.fixturesPer10k.sinks * fixtureMultiplier),
        };

    // Apply global production-rate override (faster rate => fewer hours)
    if (inputs.productionRateOverride && inputs.productionRateOverride > 0) {
        const baselineRate = buildingType.productionRate || 1;
        const speedFactor = baselineRate / inputs.productionRateOverride;
        totalMonthlyMinutes *= speedFactor;
        maxFreqMinutesPerVisit *= speedFactor;
    }

    // Apply building complexity multiplier
    totalMonthlyMinutes *= buildingType.complexityMultiplier;
    maxFreqMinutesPerVisit *= buildingType.complexityMultiplier;

    const rawTotalHoursPerMonth = totalMonthlyMinutes / 60;
    const minTotalHoursPerMonth = bidVisitsPerMonth > 0 ? bidVisitsPerMonth * 1 : 0;
    const totalHoursPerMonth = Math.round(Math.max(rawTotalHoursPerMonth, minTotalHoursPerMonth) * 100) / 100;
    const hoursPerVisit = bidVisitsPerMonth > 0
        ? Math.round(Math.max(1, totalHoursPerMonth / bidVisitsPerMonth) * 100) / 100
        : 0;

    // --- Cost Calculation ---
    const laborCostPerMonth = totalHoursPerMonth * inputs.wageRate;
    const payrollTaxCost = laborCostPerMonth * (inputs.payrollTaxPercent / 100);
    const supplyMultiplier = inputs.supplyPolicy === "client" ? 0 : inputs.supplyPolicy === "shared" ? 0.5 : 1;
    const supplyCostPerMonth = inputs.supplyCostPerSqft * inputs.sqft * bidVisitsPerMonth * supplyMultiplier;
    const subtotalDirect = laborCostPerMonth + payrollTaxCost + supplyCostPerMonth;
    const overheadCost = subtotalDirect * (inputs.overheadPercent / 100);
    const totalCostPerMonth = subtotalDirect + overheadCost;
    const profitAmount = totalCostPerMonth * (inputs.profitPercent / 100);
    const totalPricePerMonth = Math.round((totalCostPerMonth + profitAmount) * 100) / 100;

    // --- Derived ---
    const pricePerVisit = bidVisitsPerMonth > 0
        ? Math.round((totalPricePerMonth / bidVisitsPerMonth) * 100) / 100
        : totalPricePerMonth;
    const pricePerSqft = inputs.sqft > 0
        ? Math.round((totalPricePerMonth / inputs.sqft) * 1000) / 1000
        : 0;
    const effectiveHourlyRate =
        totalHoursPerMonth > 0
            ? Math.round((totalPricePerMonth / totalHoursPerMonth) * 100) / 100
            : 0;

    return {
        buildingType,
        hoursPerVisit,
        visitsPerMonth: bidVisitsPerMonth,
        totalHoursPerMonth,
        estimatedFixtures,
        laborCostPerMonth: Math.round(laborCostPerMonth * 100) / 100,
        payrollTaxCost: Math.round(payrollTaxCost * 100) / 100,
        supplyCostPerMonth: Math.round(supplyCostPerMonth * 100) / 100,
        overheadCost: Math.round(overheadCost * 100) / 100,
        totalCostPerMonth: Math.round(totalCostPerMonth * 100) / 100,
        profitAmount: Math.round(profitAmount * 100) / 100,
        totalPricePerMonth,
        pricePerVisit,
        pricePerSqft,
        effectiveHourlyRate,
    };
}
