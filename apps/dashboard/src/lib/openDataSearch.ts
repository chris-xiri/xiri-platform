/**
 * NY Open Data — SODA API client for Property Assessment Rolls + NYC PLUTO
 *
 * Two data sources, same preview → approve flow:
 *   1. NY State Assessment Rolls (7vem-aaz7) — Nassau, Suffolk counties
 *   2. NYC PLUTO (64uk-42ks) — Manhattan, Brooklyn, Queens, Bronx, Staten Island
 *
 * Queries the free public SODA API directly from the browser.
 * No API key required (unauthenticated gets 1,000 req/hr throttle).
 * Data only enters Firestore when user clicks "Approve".
 */

import type { PreviewProperty } from '@xiri/shared';

// ── Constants ──

const NY_STATE_DATASET = '7vem-aaz7';
const NY_STATE_URL = `https://data.ny.gov/resource/${NY_STATE_DATASET}.json`;

const PLUTO_DATASET = '64uk-42ks';
const PLUTO_URL = `https://data.cityofnewyork.us/resource/${PLUTO_DATASET}.json`;

// Counties / boroughs available for search
export const AVAILABLE_COUNTIES = [
    // NY State Assessment Rolls
    { value: 'Nassau', label: 'Nassau', source: 'nystate' as const },
    { value: 'Suffolk', label: 'Suffolk', source: 'nystate' as const },
    // NYC PLUTO boroughs
    { value: 'QN', label: 'Queens', source: 'pluto' as const },
    { value: 'BK', label: 'Brooklyn', source: 'pluto' as const },
    { value: 'MN', label: 'Manhattan', source: 'pluto' as const },
    { value: 'BX', label: 'Bronx', source: 'pluto' as const },
    { value: 'SI', label: 'Staten Island', source: 'pluto' as const },
] as const;

// NY State property class codes (for Assessment Rolls)
export const PROPERTY_CLASS_OPTIONS = [
    // ── Recommended (default selection) ──
    { code: '431', label: 'Auto Body / Collision', facilityType: 'auto_service_center', recommended: true },
    { code: '432', label: 'Auto Service / Gas Station', facilityType: 'auto_service_center', recommended: false },
    { code: '433', label: 'Auto Dealer / Showroom', facilityType: 'auto_dealer_showroom', recommended: false },
    { code: '461', label: 'Bank / Single Occupant', facilityType: 'office_general', recommended: true },
    { code: '462', label: 'Branch Bank', facilityType: 'office_general', recommended: false },
    { code: '464', label: 'Medical Office / Clinic', facilityType: 'medical_private', recommended: true },
    { code: '465', label: 'Professional Bldg (Medical/Legal)', facilityType: 'medical_private', recommended: true },
    { code: '471', label: 'Funeral Home', facilityType: 'office_general', recommended: true },
    { code: '472', label: 'Veterinary / Kennel', facilityType: 'office_general', recommended: true },
    { code: '480', label: 'Multiple Use (Mostly Commercial)', facilityType: 'office_general', recommended: false },
    { code: '481', label: 'Attached Row Building', facilityType: 'office_general', recommended: false },
    { code: '482', label: 'Detached Row Building', facilityType: 'office_general', recommended: false },
    { code: '483', label: 'Converted Residence', facilityType: 'office_general', recommended: true },
    { code: '484', label: 'One Story Small Structure', facilityType: 'office_general', recommended: true },
    { code: '485', label: 'One Story Small Structure (Secondary)', facilityType: 'office_general', recommended: false },
    { code: '486', label: 'Multi-Story Small Structure', facilityType: 'office_general', recommended: false },
    { code: '534', label: 'Social Organization', facilityType: 'office_general', recommended: false },
    { code: '612', label: 'Schools (Private/Daycare)', facilityType: 'edu_daycare', recommended: false },
    { code: '642', label: 'Health Facility', facilityType: 'medical_urgent_care', recommended: false },
    { code: '662', label: 'Police / Fire Station', facilityType: 'office_general', recommended: false },
    { code: '682', label: 'Fitness / Recreation', facilityType: 'fitness_gym', recommended: false },
] as const;

// PLUTO building class codes (for NYC)
export const PLUTO_BLDG_CLASS_OPTIONS = [
    { code: 'D1', label: 'Elevator Apt (Semi-Fireproof)', facilityType: 'office_general', recommended: false },
    { code: 'F1', label: 'Factory (Heavy Mfg)', facilityType: 'office_general', recommended: false },
    { code: 'F5', label: 'Factory (Light Mfg)', facilityType: 'office_general', recommended: false },
    { code: 'G', label: 'Garage / Gas Station', facilityType: 'auto_service_center', recommended: true },
    { code: 'G1', label: 'Garage (All Types)', facilityType: 'auto_service_center', recommended: true },
    { code: 'G2', label: 'Auto Body / Collision', facilityType: 'auto_service_center', recommended: true },
    { code: 'G3', label: 'Gas Station', facilityType: 'auto_service_center', recommended: false },
    { code: 'G5', label: 'Auto Dealer / Showroom', facilityType: 'auto_dealer_showroom', recommended: true },
    { code: 'I1', label: 'Hospital / Health Facility', facilityType: 'medical_urgent_care', recommended: true },
    { code: 'I4', label: 'Doctor Office / Clinic', facilityType: 'medical_private', recommended: true },
    { code: 'I5', label: 'Medical Office Bldg', facilityType: 'medical_private', recommended: true },
    { code: 'I7', label: 'Mental Health Facility', facilityType: 'medical_private', recommended: false },
    { code: 'I9', label: 'Health Clinic', facilityType: 'medical_urgent_care', recommended: true },
    { code: 'K1', label: 'One Story Retail', facilityType: 'office_general', recommended: false },
    { code: 'K4', label: 'Professional/Medical Office', facilityType: 'medical_private', recommended: true },
    { code: 'K5', label: 'Funeral Home', facilityType: 'office_general', recommended: true },
    { code: 'K6', label: 'Service Facility', facilityType: 'office_general', recommended: false },
    { code: 'K9', label: 'Misc Commercial', facilityType: 'office_general', recommended: false },
    { code: 'W1', label: 'School (Private)', facilityType: 'edu_daycare', recommended: false },
    { code: 'W3', label: 'Daycare / Nursery', facilityType: 'edu_daycare', recommended: false },
    { code: 'Y5', label: 'Veterinary / Kennel', facilityType: 'office_general', recommended: true },
] as const;

export const RECOMMENDED_CODES = PROPERTY_CLASS_OPTIONS
    .filter(p => p.recommended)
    .map(p => p.code);

export const RECOMMENDED_PLUTO_CODES = PLUTO_BLDG_CLASS_OPTIONS
    .filter(p => p.recommended)
    .map(p => p.code);

export interface OpenDataSearchParams {
    counties: string[];           // e.g. ['Nassau', 'Suffolk', 'QN']
    propertyClasses: string[];    // NY State codes like '465'
    plutoBldgClasses: string[];   // PLUTO codes like 'K4', 'I4'
    minLotSqFt?: number;
    maxLotSqFt?: number;
    minMarketValue?: number;
    maxMarketValue?: number;
    municipality?: string;        // optional town filter
    limit?: number;               // default 200
    offset?: number;              // for pagination
}

export interface OpenDataSearchResult {
    properties: PreviewProperty[];
    totalCount: number;
    offset: number;
    hasMore: boolean;
}

// ── Helpers ──

function getSelectedSources(counties: string[]) {
    const nyStateCounties = counties.filter(c =>
        AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'nystate')
    );
    const plutoBoroughs = counties.filter(c =>
        AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'pluto')
    );
    return { nyStateCounties, plutoBoroughs };
}

// ── NY State SODA Query Builder ──

function buildNYStateQuery(params: OpenDataSearchParams, counties: string[]): string {
    const conditions: string[] = [];

    // Only latest roll year to avoid duplicates
    conditions.push("roll_year='2024'");

    // County filter
    if (counties.length === 1) {
        conditions.push(`county_name='${counties[0]}'`);
    } else if (counties.length > 1) {
        conditions.push(`county_name in(${counties.map(c => `'${c}'`).join(',')})`);
    }

    // Property class filter
    if (params.propertyClasses.length === 1) {
        conditions.push(`property_class='${params.propertyClasses[0]}'`);
    } else if (params.propertyClasses.length > 1) {
        conditions.push(`property_class in(${params.propertyClasses.map(c => `'${c}'`).join(',')})`);
    }

    // Lot size filter (front × depth)
    if (params.minLotSqFt) conditions.push(`front * depth >= ${params.minLotSqFt}`);
    if (params.maxLotSqFt) conditions.push(`front * depth <= ${params.maxLotSqFt}`);

    // Market value filter
    if (params.minMarketValue) conditions.push(`full_market_value >= ${params.minMarketValue}`);
    if (params.maxMarketValue) conditions.push(`full_market_value <= ${params.maxMarketValue}`);

    // Municipality filter
    if (params.municipality?.trim()) {
        conditions.push(`upper(municipality_name)='${params.municipality.trim().toUpperCase()}'`);
    }

    return conditions.join(' AND ');
}

// ── PLUTO SODA Query Builder ──

function buildPlutoQuery(params: OpenDataSearchParams, boroughs: string[]): string {
    const conditions: string[] = [];

    // Borough filter
    if (boroughs.length === 1) {
        conditions.push(`borough='${boroughs[0]}'`);
    } else if (boroughs.length > 1) {
        conditions.push(`borough in(${boroughs.map(b => `'${b}'`).join(',')})`);
    }

    // Building class filter
    if (params.plutoBldgClasses.length === 1) {
        conditions.push(`bldgclass='${params.plutoBldgClasses[0]}'`);
    } else if (params.plutoBldgClasses.length > 1) {
        conditions.push(`bldgclass in(${params.plutoBldgClasses.map(c => `'${c}'`).join(',')})`);
    }

    // Lot area filter
    if (params.minLotSqFt) conditions.push(`lotarea >= ${params.minLotSqFt}`);
    if (params.maxLotSqFt) conditions.push(`lotarea <= ${params.maxLotSqFt}`);

    // Assessed value filter
    if (params.minMarketValue) conditions.push(`assesstot >= ${params.minMarketValue}`);
    if (params.maxMarketValue) conditions.push(`assesstot <= ${params.maxMarketValue}`);

    return conditions.join(' AND ');
}

// ── Map NY State record → PreviewProperty ──

function mapNYStateRecord(record: any, offset: number, i: number): PreviewProperty {
    const front = parseFloat(record.front) || 0;
    const depth = parseFloat(record.depth) || 0;
    const lotSqFt = front * depth;

    const addressParts = [
        record.parcel_address_number,
        record.parcel_address_street,
        record.parcel_address_suff,
    ].filter(Boolean).join(' ');

    const ownerName = [
        record.primary_owner_first_name,
        record.primary_owner_last_name,
    ].filter(Boolean).join(' ');

    const mailingAddress = [
        record.mailing_address_number,
        record.mailing_address_street,
        record.mailing_address_suff,
        record.mailing_address_city,
        record.mailing_address_state,
        record.mailing_address_zip,
    ].filter(Boolean).join(' ');

    const classConfig = PROPERTY_CLASS_OPTIONS.find(p => p.code === record.property_class);

    return {
        id: `nys_${record.swis_code || ''}_${record.print_key_code || ''}_${offset + i}`,
        name: ownerName || record.municipality_name || 'Unknown Property',
        address: addressParts || 'No address',
        city: record.municipality_name || '',
        state: 'NY',
        zip: record.mailing_address_zip?.substring(0, 5) || '',
        propertyType: record.property_class_description || '',
        squareFootage: lotSqFt > 0 ? Math.round(lotSqFt) : undefined,
        ownerName,
        source: 'ny_opendata',
        sourceId: `nys_${record.swis_code}_${record.print_key_code}`,
        lastSalePrice: parseFloat(record.full_market_value) || undefined,
        facilityType: classConfig?.facilityType || 'office_general',
        isDismissed: false,
        rawData: {
            dataSource: 'ny_state_assessment',
            propertyClass: record.property_class,
            propertyClassDescription: record.property_class_description,
            rollYear: record.roll_year,
            front, depth, lotSqFt, mailingAddress,
            assessmentTotal: record.assessment_total,
            countyTaxable: record.county_taxable_value,
            printKeyCode: record.print_key_code,
        },
    };
}

// ── Map PLUTO record → PreviewProperty ──

function mapPlutoRecord(record: any, offset: number, i: number): PreviewProperty {
    const boroughNames: Record<string, string> = {
        MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
    };

    const bldgConfig = PLUTO_BLDG_CLASS_OPTIONS.find(p => p.code === record.bldgclass);
    const lotArea = parseFloat(record.lotarea) || 0;
    const bldgArea = parseFloat(record.bldgarea) || 0;

    return {
        id: `pluto_${record.bbl || `${record.borough}_${record.block}_${record.lot}`}_${offset + i}`,
        name: record.ownername || 'Unknown Owner',
        address: record.address || 'No address',
        city: boroughNames[record.borough] || record.borough || '',
        state: 'NY',
        zip: record.zipcode || '',
        propertyType: bldgConfig?.label || `Class ${record.bldgclass}`,
        squareFootage: bldgArea > 0 ? Math.round(bldgArea) : (lotArea > 0 ? Math.round(lotArea) : undefined),
        ownerName: record.ownername || '',
        source: 'nyc_pluto',
        sourceId: `pluto_${record.bbl || ''}`,
        lastSalePrice: parseFloat(record.assesstot) || undefined,
        yearBuilt: parseInt(record.yearbuilt) || undefined,
        facilityType: bldgConfig?.facilityType || 'office_general',
        isDismissed: false,
        rawData: {
            dataSource: 'nyc_pluto',
            bbl: record.bbl,
            borough: record.borough,
            block: record.block,
            lot: record.lot,
            bldgClass: record.bldgclass,
            landUse: record.landuse,
            lotArea, bldgArea,
            numBldgs: record.numbldgs,
            numFloors: record.numfloors,
            yearBuilt: record.yearbuilt,
            assessTotal: record.assesstot,
        },
    };
}

// ── Main Search Function ──

export async function searchOpenData(params: OpenDataSearchParams): Promise<OpenDataSearchResult> {
    const limit = params.limit || 200;
    const offset = params.offset || 0;
    const { nyStateCounties, plutoBoroughs } = getSelectedSources(params.counties);

    const fetches: Promise<{ properties: PreviewProperty[]; totalCount: number }>[] = [];

    // NY State Assessment Rolls
    if (nyStateCounties.length > 0 && params.propertyClasses.length > 0) {
        const where = buildNYStateQuery(params, nyStateCounties);
        const dataUrl = `${NY_STATE_URL}?$limit=${limit}&$offset=${offset}&$where=${encodeURIComponent(where)}&$order=municipality_name,parcel_address_street`;
        const countUrl = `${NY_STATE_URL}?$select=count(*)&$where=${encodeURIComponent(where)}`;

        fetches.push(
            Promise.all([fetch(dataUrl), fetch(countUrl)]).then(async ([dataRes, countRes]) => {
                if (!dataRes.ok) throw new Error(`NY State API error: ${await dataRes.text()}`);
                const [data, countData] = await Promise.all([
                    dataRes.json(),
                    countRes.ok ? countRes.json() : [{ count: '0' }],
                ]);
                return {
                    properties: data.map((r: any, i: number) => mapNYStateRecord(r, offset, i)),
                    totalCount: parseInt(countData[0]?.count || '0', 10),
                };
            })
        );
    }

    // NYC PLUTO
    if (plutoBoroughs.length > 0 && params.plutoBldgClasses.length > 0) {
        const where = buildPlutoQuery(params, plutoBoroughs);
        const dataUrl = `${PLUTO_URL}?$limit=${limit}&$offset=${offset}&$where=${encodeURIComponent(where)}&$order=borough,address`;
        const countUrl = `${PLUTO_URL}?$select=count(*)&$where=${encodeURIComponent(where)}`;

        fetches.push(
            Promise.all([fetch(dataUrl), fetch(countUrl)]).then(async ([dataRes, countRes]) => {
                if (!dataRes.ok) throw new Error(`PLUTO API error: ${await dataRes.text()}`);
                const [data, countData] = await Promise.all([
                    dataRes.json(),
                    countRes.ok ? countRes.json() : [{ count: '0' }],
                ]);
                return {
                    properties: data.map((r: any, i: number) => mapPlutoRecord(r, offset, i)),
                    totalCount: parseInt(countData[0]?.count || '0', 10),
                };
            })
        );
    }

    if (fetches.length === 0) {
        throw new Error('Select at least one county/borough and property class');
    }

    const results = await Promise.all(fetches);

    // Merge results from both sources
    const allProperties = results.flatMap(r => r.properties);
    const totalCount = results.reduce((sum, r) => sum + r.totalCount, 0);

    return {
        properties: allProperties,
        totalCount,
        offset,
        hasMore: offset + limit < totalCount,
    };
}
