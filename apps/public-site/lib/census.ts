// ─── Census Data Service (Backward Compatible) ──────────────────
// Reads from the unified open-data-cache.json.
// Maintains backward compatibility with existing getEstablishments() calls
// while new code should use data/open-data.ts instead.
//
// @deprecated — New code should import from '@/data/open-data' instead.

import openDataCache from '@/data/open-data-cache.json';
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
 * Reads from the committed open-data-cache.json — zero API calls.
 *
 * @deprecated Use `getEstablishmentCount()` from `@/data/open-data` instead.
 */
export function getEstablishments(
    mapping: NAICSMapping,
    area: ServiceArea
): CensusEstablishmentResult {
    const county = (openDataCache as any).counties?.[area.id];
    const count = county?.establishments?.[mapping.facilitySlug] ?? 0;

    return {
        facilitySlug: mapping.facilitySlug,
        establishments: count,
        areaLabel: county?.demographics?.areaLabel ?? area.label,
        areaId: area.id,
        naicsCodes: mapping.naicsCodes,
        censusYear: (openDataCache as any).sources?.census_cbp?.year ?? CENSUS_CITATION.year,
        citation: CENSUS_CITATION.citation,
    };
}

/**
 * Get establishment counts for multiple facility types.
 *
 * @deprecated Use `getEstablishmentCounts()` from `@/data/open-data` instead.
 */
export function getEstablishmentsBatch(
    mappings: NAICSMapping[],
    area: ServiceArea
): CensusEstablishmentResult[] {
    return mappings.map(m => getEstablishments(m, area));
}

/**
 * Get total establishments across multiple facility types.
 *
 * @deprecated Use `getEstablishmentCounts()` from `@/data/open-data` instead.
 */
export function getTotalEstablishments(
    mappings: NAICSMapping[],
    area: ServiceArea
): { total: number; results: CensusEstablishmentResult[] } {
    const results = getEstablishmentsBatch(mappings, area);
    const total = results.reduce((sum, r) => sum + r.establishments, 0);
    return { total, results };
}
