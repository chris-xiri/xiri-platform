// ─── Open Data Service ───────────────────────────────────────────
// Typed reader for the unified open-data-cache.json.
// Provides helpers for county demographics, establishment counts,
// local wage data, and formatted citations.
//
// Data sources:
//   - Census Bureau, County Business Patterns (establishments)
//   - Census Bureau, American Community Survey (demographics)
//   - BLS, Occupational Employment & Wage Statistics (area wages)
//
// All data is pre-fetched — zero API calls at runtime.

import openDataCache from '@/data/open-data-cache.json';
import {
    CENSUS_CITATION,
    ACS_CITATION,
    BLS_OEWS_CITATION,
} from '@/data/gov-data';

// ─── Types ───────────────────────────────────────────────────────

export type CountyId = 'nyc-metro' | 'nassau' | 'suffolk' | 'queens' | 'kings';

export interface CountyDemographics {
    population: number;
    medianHouseholdIncome: number;
    totalBusinessEstablishments: number;
    citation: string;
}

export interface EstablishmentResult {
    facilitySlug: string;
    establishments: number;
    countyId: CountyId;
    countyLabel: string;
    citation: string;
}

export interface LocalWage {
    soc: string;
    medianHourly: number;
    meanHourly: number;
    medianAnnual: number;
    areaTitle: string;
    citation: string;
}

export interface CountySummary {
    id: CountyId;
    population: number;
    medianIncome: number;
    totalBusinesses: number;
    janitorialCompetitors: number;
    janitorMedianWage: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

const cache = openDataCache as typeof openDataCache;
const counties = cache.counties as Record<string, any>;

/** Human-readable labels for county IDs */
export const COUNTY_LABELS: Record<CountyId, string> = {
    'nyc-metro': 'New York Metro Area',
    nassau: 'Nassau County',
    suffolk: 'Suffolk County',
    queens: 'Queens',
    kings: 'Brooklyn',
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get county demographics (population, income, total businesses).
 */
export function getCountyDemographics(countyId: CountyId): CountyDemographics | null {
    const county = counties[countyId];
    if (!county?.demographics) return null;
    const d = county.demographics;
    return {
        population: d.population ?? 0,
        medianHouseholdIncome: d.medianHouseholdIncome ?? 0,
        totalBusinessEstablishments: d.totalBusinessEstablishments ?? 0,
        citation: ACS_CITATION.citation,
    };
}

/**
 * Get establishment count for a facility type in a county.
 */
export function getEstablishmentCount(
    countyId: CountyId,
    facilitySlug: string
): EstablishmentResult {
    const county = counties[countyId];
    const count = county?.establishments?.[facilitySlug] ?? 0;
    return {
        facilitySlug,
        establishments: count,
        countyId,
        countyLabel: COUNTY_LABELS[countyId] ?? countyId,
        citation: CENSUS_CITATION.citation,
    };
}

/**
 * Get multiple establishment counts for a county.
 */
export function getEstablishmentCounts(
    countyId: CountyId,
    facilitySlugs: string[]
): EstablishmentResult[] {
    return facilitySlugs.map(slug => getEstablishmentCount(countyId, slug));
}

/**
 * Get local area wage data for a specific occupation.
 */
export function getLocalWage(
    countyId: CountyId,
    occupation: 'janitors' | 'building-cleaners'
): LocalWage | null {
    const county = counties[countyId];
    const wage = county?.wages?.[occupation];
    if (!wage) return null;
    return {
        soc: wage.soc ?? '',
        medianHourly: wage.median_hourly ?? 0,
        meanHourly: wage.mean_hourly ?? 0,
        medianAnnual: wage.median_annual ?? 0,
        areaTitle: wage.area_title ?? '',
        citation: BLS_OEWS_CITATION.citation,
    };
}

/**
 * Get janitorial competitor count in a county (NAICS 561720).
 */
export function getJanitorialCompetitors(countyId: CountyId): number {
    return counties[countyId]?.establishments?.['janitorial-services'] ?? 0;
}

/**
 * Get a formatted citation string for a specific data source.
 */
export function getCitation(source: 'census_cbp' | 'census_acs' | 'bls_oews'): string {
    switch (source) {
        case 'census_cbp': return CENSUS_CITATION.citation;
        case 'census_acs': return ACS_CITATION.citation;
        case 'bls_oews': return BLS_OEWS_CITATION.citation;
    }
}

/**
 * Get a full county summary — useful for hub page headers.
 */
export function getCountySummary(countyId: CountyId): CountySummary | null {
    const county = counties[countyId];
    if (!county) return null;
    const d = county.demographics ?? {};
    return {
        id: countyId,
        population: d.population ?? 0,
        medianIncome: d.medianHouseholdIncome ?? 0,
        totalBusinesses: d.totalBusinessEstablishments ?? 0,
        janitorialCompetitors: county.establishments?.['janitorial-services'] ?? 0,
        janitorMedianWage: county.wages?.janitors?.median_hourly ?? 0,
    };
}

// ─── Region → County Mapping ─────────────────────────────────────
// Maps seo-data.json location `region` values to CountyId keys.

const REGION_TO_COUNTY: Record<string, CountyId> = {
    'Nassau County': 'nassau',
    'Suffolk County': 'suffolk',
    'Queens': 'queens',
    'Queens County': 'queens',
    'Kings County': 'kings',
    'Brooklyn': 'kings',
    'New York Metro Area': 'nyc-metro',
};

/**
 * Resolve a location region string (from seo-data.json) to a CountyId.
 */
export function regionToCountyId(region: string): CountyId | null {
    return REGION_TO_COUNTY[region] ?? null;
}

/**
 * Get human-readable label for a county ID.
 */
export function getCountyLabel(countyId: CountyId): string {
    return COUNTY_LABELS[countyId] ?? countyId;
}

// ─── Minimum Wage Data ───────────────────────────────────────────
// Static — updated when state law changes. Current: NY State $16.50/hr
// (effective Jan 1, 2025), NYC/LI/Westchester $16.50/hr (parity reached).

export const NY_MINIMUM_WAGE = {
    hourly: 16.50,
    effectiveDate: '2025-01-01',
    source: 'New York State Department of Labor',
    url: 'https://dol.ny.gov/minimum-wage-0',
};

// ─── Market Wage Context ─────────────────────────────────────────

export interface MarketWageContext {
    medianHourly: number;
    minWage: number;
    premium: number;       // median - minWage
    premiumPct: number;    // ((median - min) / min) * 100
    areaTitle: string;
    countyLabel: string;
    citations: {
        wage: string;
        minWage: string;
    };
}

/**
 * Get market-vs-regulation wage context for a county.
 * Returns median janitorial hourly wage vs NY minimum wage,
 * showing the real market premium employers must account for.
 */
export function getMarketWageContext(countyId: CountyId): MarketWageContext | null {
    const wage = getLocalWage(countyId, 'janitors');
    if (!wage || wage.medianHourly === 0) return null;
    const premium = +(wage.medianHourly - NY_MINIMUM_WAGE.hourly).toFixed(2);
    const premiumPct = +((premium / NY_MINIMUM_WAGE.hourly) * 100).toFixed(0);
    return {
        medianHourly: wage.medianHourly,
        minWage: NY_MINIMUM_WAGE.hourly,
        premium,
        premiumPct,
        areaTitle: wage.areaTitle,
        countyLabel: COUNTY_LABELS[countyId] ?? countyId,
        citations: {
            wage: wage.citation,
            minWage: `${NY_MINIMUM_WAGE.source} (effective ${NY_MINIMUM_WAGE.effectiveDate})`,
        },
    };
}

/**
 * List all available county IDs.
 */
export function getAvailableCounties(): CountyId[] {
    return Object.keys(counties) as CountyId[];
}

/**
 * Get the data generation timestamp.
 */
export function getDataTimestamp(): string {
    return cache.generatedAt;
}
