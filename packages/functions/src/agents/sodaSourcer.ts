import axios from 'axios';
import { RawVendor } from './sourcer';

/**
 * NYC Open Data Sourcer
 * 
 * Queries two SODA API datasets:
 * 1. NYC DCA Issued Licenses (5 boroughs) — dataset: w7w3-xahh
 * 2. NY State Active Corporations (state-wide, covers Nassau/Suffolk) — dataset: 7tqb-y2d4
 * 
 * No API key required (public data).
 */

// ─── NYC DCA: Issued Licenses (5 boroughs) ─────────────────────
const NYC_DCA_ENDPOINT = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';

// SODA query: search business names for facility service keywords
// DCA categories don't map well to commercial services, so name search is more effective

async function searchNycDca(query: string, location: string, dcaCategory?: string, limit: number = 50): Promise<RawVendor[]> {
    let where = "license_status='Active'";

    if (dcaCategory) {
        // If exact category is selected, filter by it directly
        where += ` AND business_category='${dcaCategory.replace(/'/g, "''")}'`;
    } else {
        // Build name keyword filter from the user's search query
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        // If no useful keywords from query, use common facility service terms
        const searchTerms = queryWords.length > 0 ? queryWords : ['clean', 'janitor', 'maintenance', 'hvac'];
        const nameFilter = searchTerms
            .map(w => `upper(business_name) like '%${w.toUpperCase()}%'`)
            .join(' OR ');

        where += ` AND (${nameFilter})`;
    }

    // Location filter — map common names to boroughs
    const boroughMap: Record<string, string> = {
        'manhattan': 'Manhattan', 'nyc': '', 'new york': '',
        'brooklyn': 'Brooklyn', 'queens': 'Queens',
        'bronx': 'Bronx', 'staten island': 'Staten Island',
    };
    const normalizedLoc = location.toLowerCase().trim();
    const borough = boroughMap[normalizedLoc];

    if (borough) {
        where += ` AND address_borough='${borough}'`;
    }

    try {
        const params = new URLSearchParams({
            '$limit': String(limit),
            '$where': where,
            '$select': 'business_name,business_category,contact_phone,address_building,address_street_name,address_city,address_state,address_zip,address_borough,license_status,lic_expir_dd,latitude,longitude',
            '$order': 'business_name ASC',
        });

        console.log(`[SODA/NYC] Querying DCA: ${where}`);
        const response = await axios.get(`${NYC_DCA_ENDPOINT}?${params}`);
        const results = response.data || [];
        console.log(`[SODA/NYC] Found ${results.length} results from NYC DCA`);

        return results.map((item: any) => ({
            name: item.business_name,
            description: `NYC DCA Licensed ${item.business_category} (${item.license_status})`,
            location: `${item.address_building} ${item.address_street_name}, ${item.address_city}, ${item.address_state} ${item.address_zip}`,
            phone: item.contact_phone,
            source: 'nyc_open_data',
            dcaCategory: item.business_category,
            rating: undefined,
            user_ratings_total: undefined,
        }));
    } catch (error: any) {
        console.error('[SODA/NYC] Error:', error.message);
        return [];
    }
}

// ─── NY State: Active Corporations (Nassau/Suffolk/State-wide) ──
const NYS_CORP_ENDPOINT = 'https://data.ny.gov/resource/n9v6-gdp6.json';

async function searchNyState(query: string, location: string, limit: number = 50): Promise<RawVendor[]> {
    // Build keyword filter from query
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const nameFilters = queryWords
        .map(w => `upper(current_entity_name) like '%${w.toUpperCase()}%'`)
        .join(' OR ');

    // Location filter
    const locationWords = location.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    let locFilter = '';
    if (locationWords.length > 0) {
        const locConditions = locationWords.map(w =>
            `upper(dos_process_city) like '%${w.toUpperCase()}%'`
        ).join(' OR ');
        locFilter = ` AND (${locConditions})`;
    }

    const where = `(${nameFilters || "current_entity_name like '%CLEAN%'"})${locFilter}`;

    try {
        const params = new URLSearchParams({
            '$limit': String(limit),
            '$where': where,
            '$order': 'initial_dos_filing_date DESC',
        });

        console.log(`[SODA/NYS] Querying State Corps: ${where}`);
        const response = await axios.get(`${NYS_CORP_ENDPOINT}?${params}`);
        const results = response.data || [];
        console.log(`[SODA/NYS] Found ${results.length} results from NY State`);

        return results.map((b: any) => ({
            name: titleCase(b.current_entity_name || ''),
            description: `${b.entity_type_desc || 'Business Entity'} — Registered in NY State. Filed: ${b.initial_dos_filing_date ? new Date(b.initial_dos_filing_date).toLocaleDateString() : 'N/A'}`,
            location: [b.dos_process_address_1, b.dos_process_city, 'NY', b.dos_process_zip].filter(Boolean).join(', '),
            phone: undefined,
            source: 'ny_state_corps',
            rating: undefined,
            user_ratings_total: undefined,
        }));
    } catch (error: any) {
        console.error('[SODA/NYS] Error:', error.message);
        return [];
    }
}

// ─── Combined SODA Search ───────────────────────────────────────

/**
 * Search SODA open data sources for vendors.
 * Combines NYC DCA (5 boroughs) + NY State Corps (state-wide including Nassau/Suffolk).
 */
export async function searchVendorsSoda(query: string, location: string, dcaCategory?: string): Promise<RawVendor[]> {
    const normalizedLoc = location.toLowerCase().trim();

    // Determine which datasets to query based on location
    const isNycBorough = ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'nyc', 'new york city', 'new york'].includes(normalizedLoc);
    const isLongIsland = ['nassau', 'suffolk', 'long island', 'garden city', 'mineola', 'hempstead', 'hicksville', 'huntington', 'babylon', 'islip'].includes(normalizedLoc);

    const results: RawVendor[] = [];

    if (isNycBorough || (!isLongIsland)) {
        // Query NYC DCA for boroughs (or if location is ambiguous, try both)
        const nycResults = await searchNycDca(query, location, dcaCategory, 25);
        results.push(...nycResults);
    }

    // Always query NY State for broader coverage (especially Nassau/Suffolk)
    const nysResults = await searchNyState(query, location, 25);
    results.push(...nysResults);

    // Deduplicate by business name (rough match)
    const seen = new Set<string>();
    const deduped = results.filter(v => {
        const key = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[SODA] Total: ${deduped.length} unique vendors (${results.length} before dedup)`);
    return deduped;
}

// ─── Utility ─────────────────────────────────────────────────────
function titleCase(s: string): string {
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
