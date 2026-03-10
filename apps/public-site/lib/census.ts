// ─── Census Data Service (Cache-Based) ───────────────────────────
// Reads pre-fetched Census data from census-cache.json.
// No API calls at build time — data is refreshed annually via
// scripts/refresh-census-data.ts.

import censusCache from '@/data/census-cache.json';
import {
    type ServiceArea,
    type NAICSMapping,
    CENSUS_CITATION,
} from '@/data/gov-data';

export interface CensusEstablishmentResult {
    facilitySlug: string;
    establishments: number;
    areaLabel: string;
    areaId: string;
    naicsCodes: string[];
    censusYear: number;
    citation: string;
}

/**
 * Get establishment count for a facility type in a given area.
 * Reads from the committed cache file — zero API calls.
 */
export function getEstablishments(
    mapping: NAICSMapping,
    area: ServiceArea
): CensusEstablishmentResult {
    const entry = (censusCache as any).entries?.[mapping.facilitySlug];
    const areaData = entry?.areas?.[area.id];

    return {
        facilitySlug: mapping.facilitySlug,
        establishments: areaData?.establishments ?? 0,
        areaLabel: areaData?.areaLabel ?? area.label,
        areaId: area.id,
        naicsCodes: mapping.naicsCodes,
        censusYear: (censusCache as any).censusYear ?? CENSUS_CITATION.year,
        citation: CENSUS_CITATION.citation,
    };
}

/**
 * Get establishment counts for multiple facility types.
 */
export function getEstablishmentsBatch(
    mappings: NAICSMapping[],
    area: ServiceArea
): CensusEstablishmentResult[] {
    return mappings.map(m => getEstablishments(m, area));
}

/**
 * Get total establishments across multiple facility types.
 */
export function getTotalEstablishments(
    mappings: NAICSMapping[],
    area: ServiceArea
): { total: number; results: CensusEstablishmentResult[] } {
    const results = getEstablishmentsBatch(mappings, area);
    const total = results.reduce((sum, r) => sum + r.establishments, 0);
    return { total, results };
}
