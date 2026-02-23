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

// ═══════════════════════════════════════════════════════════════════════
// ENRICHMENT LAYER — Industry Licensing Databases + Buyer Intent
// ═══════════════════════════════════════════════════════════════════════

// ── Data Source Config (auto-enable rules) ──

export type EnrichmentSource = 'doh' | 'dmv' | 'ocfs' | 'dob_permits';

export interface EnrichmentSourceConfig {
    id: EnrichmentSource;
    label: string;
    description: string;
    autoEnableClasses: string[];          // NY State property codes that auto-enable
    autoEnablePlutoClasses: string[];     // PLUTO building codes that auto-enable
    availableFor: ('nystate' | 'pluto')[]; // Which county types this source works for
}

export const ENRICHMENT_SOURCES: EnrichmentSourceConfig[] = [
    {
        id: 'doh',
        label: 'Health Facilities (DOH)',
        description: 'Licensed medical facilities — clinic names, operators',
        autoEnableClasses: ['464', '465', '642'],
        autoEnablePlutoClasses: ['I1', 'I4', 'I5', 'I7', 'I9', 'K4'],
        availableFor: ['nystate'],
    },
    {
        id: 'dmv',
        label: 'Auto Dealers (DMV)',
        description: 'Licensed auto facilities — business names, owners',
        autoEnableClasses: ['431', '432', '433'],
        autoEnablePlutoClasses: ['G', 'G1', 'G2', 'G3', 'G5'],
        availableFor: ['nystate'],
    },
    {
        id: 'ocfs',
        label: 'Daycares (OCFS)',
        description: 'Licensed childcare — provider names, phone numbers',
        autoEnableClasses: ['612'],
        autoEnablePlutoClasses: ['W1', 'W3'],
        availableFor: ['nystate'],
    },
    {
        id: 'dob_permits',
        label: 'Building Permits (DOB)',
        description: 'Recent commercial permits — buyer intent signals',
        autoEnableClasses: [],
        autoEnablePlutoClasses: [],
        availableFor: ['pluto'],
    },
];

// ── Enrichment Result ──

export interface EnrichmentMatch {
    source: EnrichmentSource;
    facilityName: string;
    operatorName?: string;
    phone?: string;
    description?: string;
    licenseId?: string;
    matchType: 'address' | 'proximity';
    rawData: Record<string, any>;
}

export interface IntentSignal {
    type: 'permit_filed' | 'permit_issued' | 'new_co';
    label: string;
    date: string;
    details: string;
    ownerPhone?: string;
    ownerBusinessName?: string;
}

// ── DOH Health Facilities ──

const DOH_URL = 'https://health.data.ny.gov/resource/vn5v-hh5r.json';

export async function searchDOHFacilities(counties: string[]): Promise<EnrichmentMatch[]> {
    const nyCounties = counties.filter(c =>
        AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'nystate')
    );
    if (nyCounties.length === 0) return [];

    const countyFilter = nyCounties.length === 1
        ? `county='${nyCounties[0]}'`
        : `county in(${nyCounties.map(c => `'${c}'`).join(',')})`;

    const url = `${DOH_URL}?$limit=5000&$where=${encodeURIComponent(countyFilter)}&$order=facility_name`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((r: any) => ({
        source: 'doh' as const,
        facilityName: r.facility_name || '',
        operatorName: r.operator_name || '',
        description: r.description || r.fac_desc_short || '',
        licenseId: r.opcert_num || r.fac_id || '',
        matchType: 'address' as const,
        // Normalize address for matching
        _address: (r.address1 || '').toUpperCase().trim(),
        _city: (r.city || '').toUpperCase().trim(),
        _lat: parseFloat(r.latitude) || 0,
        _lng: parseFloat(r.longitude) || 0,
        rawData: {
            facilityType: r.fac_desc_short,
            openDate: r.fac_opn_dat,
            ownershipType: r.ownership_type,
            operatorAddress: [r.operator_address1, r.operator_city, r.operator_state, r.operator_zip].filter(Boolean).join(', '),
        },
    }));
}

// ── DMV Licensed Facilities ──

const DMV_URL = 'https://data.ny.gov/resource/nhjr-rpi2.json';

export async function searchDMVDealers(counties: string[]): Promise<EnrichmentMatch[]> {
    // DMV uses abbreviated county codes
    const dmvCountyMap: Record<string, string> = {
        Nassau: 'NASS', Suffolk: 'SUFF',
        QN: 'QUEE', BK: 'KING', MN: 'NEWY', BX: 'BRON', SI: 'RICH',
    };

    const dmvCounties = counties.map(c => dmvCountyMap[c]).filter(Boolean);
    if (dmvCounties.length === 0) return [];

    const countyFilter = dmvCounties.length === 1
        ? `facility_county='${dmvCounties[0]}'`
        : `facility_county in(${dmvCounties.map(c => `'${c}'`).join(',')})`;

    const url = `${DMV_URL}?$limit=5000&$where=${encodeURIComponent(countyFilter)}&$order=facility_name`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((r: any) => ({
        source: 'dmv' as const,
        facilityName: [r.facility_name, r.facility_name_overflow].filter(Boolean).join(' ').trim(),
        operatorName: r.owner_name || '',
        description: `DMV ${r.business_type || 'Licensed Facility'}`,
        licenseId: r.facility || '',
        matchType: 'address' as const,
        _address: (r.facility_street || '').toUpperCase().trim(),
        _city: (r.facility_city || '').toUpperCase().trim(),
        _lat: r.georeference?.coordinates?.[1] || 0,
        _lng: r.georeference?.coordinates?.[0] || 0,
        rawData: {
            businessType: r.business_type,
            issuanceDate: r.origional_issuance_date,
            expirationDate: r.expiration_date,
            lastRenewal: r.last_renewal_date,
        },
    }));
}

// ── OCFS Childcare Programs ──

const OCFS_URL = 'https://data.ny.gov/resource/ktam-ytxy.json';

export async function searchOCFSChildcare(counties: string[]): Promise<EnrichmentMatch[]> {
    const nyCounties = counties.filter(c =>
        AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'nystate')
    );
    if (nyCounties.length === 0) return [];

    const countyFilter = nyCounties.length === 1
        ? `county='${nyCounties[0]}'`
        : `county in(${nyCounties.map(c => `'${c}'`).join(',')})`;

    const url = `${OCFS_URL}?$limit=5000&$where=${encodeURIComponent(countyFilter)}&$order=facility_name`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((r: any) => ({
        source: 'ocfs' as const,
        facilityName: r.facility_name || '',
        operatorName: r.provider_name || '',
        phone: r.phone_number || '',
        description: `${r.program_type || 'Childcare'} — ${r.capacity_description || `Capacity: ${r.total_capacity || '?'}`}`,
        licenseId: r.facility_id || '',
        matchType: 'address' as const,
        _address: [r.street_number, r.street_name].filter(Boolean).join(' ').toUpperCase().trim(),
        _city: (r.city || '').toUpperCase().trim(),
        _lat: parseFloat(r.latitude) || 0,
        _lng: parseFloat(r.longitude) || 0,
        rawData: {
            programType: r.program_type,
            facilityStatus: r.facility_status,
            schoolDistrict: r.school_district_name,
            totalCapacity: r.total_capacity,
            infantCapacity: r.infant_capacity,
            toddlerCapacity: r.toddler_capacity,
            preschoolCapacity: r.preschool_capacity,
        },
    }));
}

// ── NYC DOB Building Permits (Buyer Intent) ──

const DOB_URL = 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json';

export async function searchDOBPermits(boroughs: string[]): Promise<IntentSignal[]> {
    const boroughMap: Record<string, string> = {
        QN: 'QUEENS', BK: 'BROOKLYN', MN: 'MANHATTAN', BX: 'BRONX', SI: 'STATEN ISLAND',
    };

    const dobBoroughs = boroughs.map(b => boroughMap[b]).filter(Boolean);
    if (dobBoroughs.length === 0) return [];

    // Look for commercial A2 (alteration) permits filed in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = `${(ninetyDaysAgo.getMonth() + 1).toString().padStart(2, '0')}/${ninetyDaysAgo.getDate().toString().padStart(2, '0')}/${ninetyDaysAgo.getFullYear()}`;

    const boroughFilter = dobBoroughs.length === 1
        ? `borough='${dobBoroughs[0]}'`
        : `borough in(${dobBoroughs.map(b => `'${b}'`).join(',')})`;

    const where = `${boroughFilter} AND job_type='A2' AND filing_date>='${dateStr}'`;
    const url = `${DOB_URL}?$limit=500&$where=${encodeURIComponent(where)}&$order=filing_date DESC`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((r: any) => ({
        type: 'permit_filed' as const,
        label: `🔥 Permit Filed ${r.filing_date || ''}`,
        date: r.filing_date || '',
        details: `${r.job_type} ${r.work_type || ''} — ${r.permit_status || ''}`,
        ownerPhone: r.owner_s_phone__ || '',
        ownerBusinessName: r.owner_s_business_name || '',
        _address: `${r.house__ || ''} ${r.street_name || ''}`.toUpperCase().trim(),
        _borough: r.borough || '',
        _block: r.block || '',
        _lot: r.lot || '',
        _lat: parseFloat(r.gis_latitude) || 0,
        _lng: parseFloat(r.gis_longitude) || 0,
    }));
}

// ── Address Normalization ──

const STREET_ABBREVS: Record<string, string> = {
    HIGHWAY: 'HWY', HIGHWY: 'HWY',
    STREET: 'ST', AVENUE: 'AVE', BOULEVARD: 'BLVD',
    DRIVE: 'DR', COURT: 'CT', PLACE: 'PL', ROAD: 'RD',
    LANE: 'LN', CIRCLE: 'CIR', TERRACE: 'TER', PARKWAY: 'PKWY',
    TURNPIKE: 'TPKE', EXPRESSWAY: 'EXPY', NORTH: 'N', SOUTH: 'S',
    EAST: 'E', WEST: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW',
    SOUTHEAST: 'SE', SOUTHWEST: 'SW', EXTENSION: 'EXT',
};

function normalizeAddress(addr: string): string {
    let normalized = addr.toUpperCase().trim();
    // Replace full words with abbreviations
    for (const [full, abbrev] of Object.entries(STREET_ABBREVS)) {
        normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbrev);
    }
    // Strip all non-alphanumeric
    return normalized.replace(/[^A-Z0-9]/g, '');
}

/** Extract just the street number for loose matching */
function extractStreetNumber(addr: string): string {
    const match = addr.match(/^(\d+[-]?\d*)/);
    return match ? match[1] : '';
}

/** Haversine distance in meters between two lat/lng points */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Address Matching ──

const PROXIMITY_THRESHOLD_M = 150; // 150 meters

export function matchEnrichmentToProperty(
    property: PreviewProperty,
    enrichments: EnrichmentMatch[],
): EnrichmentMatch | undefined {
    if (!property.address) return undefined;

    const propNorm = normalizeAddress(property.address);
    const propCity = (property.city || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const propNum = extractStreetNumber(property.address);
    const propLat = (property as any).rawData?.latitude || 0;
    const propLng = (property as any).rawData?.longitude || 0;

    // Tier 1: Exact normalized address + city
    const exactMatch = enrichments.find((e: any) => {
        const eNorm = normalizeAddress(e._address || '');
        const eCity = (e._city || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return eNorm && propNorm && eNorm === propNorm && eCity === propCity;
    });
    if (exactMatch) return exactMatch;

    // Tier 2: Same street number + same city (catches HWY vs HIGHWAY etc.)
    if (propNum) {
        const numMatch = enrichments.find((e: any) => {
            const eNum = extractStreetNumber(e._address || '');
            const eCity = (e._city || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return eNum === propNum && eCity === propCity && eNum.length > 0;
        });
        if (numMatch) return numMatch;
    }

    // Tier 3: Lat/lng proximity (within 150m)
    if (propLat && propLng) {
        let closest: { match: EnrichmentMatch; dist: number } | null = null;
        for (const e of enrichments as any[]) {
            if (!e._lat || !e._lng) continue;
            const dist = distanceMeters(propLat, propLng, e._lat, e._lng);
            if (dist < PROXIMITY_THRESHOLD_M && (!closest || dist < closest.dist)) {
                closest = { match: e, dist };
            }
        }
        if (closest) return closest.match;
    }

    return undefined;
}

export function matchIntentToProperty(
    property: PreviewProperty,
    intents: IntentSignal[],
): IntentSignal | undefined {
    if (!property.address) return undefined;

    const propNorm = normalizeAddress(property.address);
    const propNum = extractStreetNumber(property.address);

    // Exact match
    const exact = intents.find((i: any) => {
        return normalizeAddress(i._address || '') === propNorm;
    });
    if (exact) return exact;

    // Street number match
    if (propNum) {
        return intents.find((i: any) => {
            return extractStreetNumber(i._address || '') === propNum;
        });
    }

    return undefined;
}

