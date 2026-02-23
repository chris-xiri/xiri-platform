/**
 * NY Open Data — SODA API client for Property Assessment Rolls
 * Dataset: 7vem-aaz7 (Property Assessment Data from Local Assessment Rolls)
 *
 * This queries the free public SODA API directly from the browser.
 * No API key required (unauthenticated gets 1,000 req/hr throttle).
 * Data only enters Firestore when user clicks "Approve".
 */

import type { PreviewProperty } from '@xiri/shared';

// ── Constants ──

const DATASET_ID = '7vem-aaz7';
const BASE_URL = `https://data.ny.gov/resource/${DATASET_ID}.json`;

export const AVAILABLE_COUNTIES = [
    { value: 'Nassau', label: 'Nassau County' },
    { value: 'Suffolk', label: 'Suffolk County' },
] as const;

export const PROPERTY_CLASS_OPTIONS = [
    { code: '465', label: 'Professional Building (Medical/Legal)', facilityType: 'medical_private' },
    { code: '484', label: 'One Story Small Structure', facilityType: 'office_general' },
    { code: '483', label: 'Converted Residence (Commercial)', facilityType: 'office_general' },
    { code: '461', label: 'Bank / Single Occupant', facilityType: 'office_general' },
    { code: '471', label: 'Funeral Home', facilityType: 'office_general' },
    { code: '472', label: 'Dog Kennel / Veterinary', facilityType: 'office_general' },
] as const;

export interface OpenDataSearchParams {
    counties: string[];           // e.g. ['Nassau', 'Suffolk']
    propertyClasses: string[];    // e.g. ['465', '484']
    minLotSqFt?: number;          // front × depth minimum
    maxLotSqFt?: number;          // front × depth maximum
    minMarketValue?: number;
    maxMarketValue?: number;
    municipality?: string;        // optional town filter
    limit?: number;               // default 50
    offset?: number;              // for pagination
}

export interface OpenDataSearchResult {
    properties: PreviewProperty[];
    totalCount: number;
    offset: number;
    hasMore: boolean;
}

// ── SODA Query Builder ──

function buildSodaQuery(params: OpenDataSearchParams): string {
    const conditions: string[] = [];

    // County filter
    if (params.counties.length === 1) {
        conditions.push(`county_name='${params.counties[0]}'`);
    } else if (params.counties.length > 1) {
        const list = params.counties.map(c => `'${c}'`).join(',');
        conditions.push(`county_name in(${list})`);
    }

    // Property class filter
    if (params.propertyClasses.length === 1) {
        conditions.push(`property_class='${params.propertyClasses[0]}'`);
    } else if (params.propertyClasses.length > 1) {
        const list = params.propertyClasses.map(c => `'${c}'`).join(',');
        conditions.push(`property_class in(${list})`);
    }

    // Lot size filter (front × depth)
    if (params.minLotSqFt) {
        conditions.push(`front * depth >= ${params.minLotSqFt}`);
    }
    if (params.maxLotSqFt) {
        conditions.push(`front * depth <= ${params.maxLotSqFt}`);
    }

    // Market value filter
    if (params.minMarketValue) {
        conditions.push(`full_market_value >= ${params.minMarketValue}`);
    }
    if (params.maxMarketValue) {
        conditions.push(`full_market_value <= ${params.maxMarketValue}`);
    }

    // Municipality filter
    if (params.municipality?.trim()) {
        conditions.push(`upper(municipality_name)='${params.municipality.trim().toUpperCase()}'`);
    }

    return conditions.join(' AND ');
}

// ── Main Search Function ──

export async function searchOpenData(params: OpenDataSearchParams): Promise<OpenDataSearchResult> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const where = buildSodaQuery(params);

    if (!where) {
        throw new Error('At least one filter is required (county or property class)');
    }

    // Fetch data + count in parallel
    const dataUrl = `${BASE_URL}?$limit=${limit}&$offset=${offset}&$where=${encodeURIComponent(where)}&$order=municipality_name,parcel_address_street`;
    const countUrl = `${BASE_URL}?$select=count(*)&$where=${encodeURIComponent(where)}`;

    const [dataRes, countRes] = await Promise.all([
        fetch(dataUrl),
        fetch(countUrl),
    ]);

    if (!dataRes.ok) {
        const errText = await dataRes.text();
        throw new Error(`SODA API error ${dataRes.status}: ${errText}`);
    }

    const [data, countData] = await Promise.all([
        dataRes.json(),
        countRes.ok ? countRes.json() : [{ count: '0' }],
    ]);

    const totalCount = parseInt(countData[0]?.count || '0', 10);

    // Map SODA records → PreviewProperty
    const properties: PreviewProperty[] = data.map((record: any, i: number) => {
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

        // Map property class to XIRI facility type
        const classConfig = PROPERTY_CLASS_OPTIONS.find(p => p.code === record.property_class);

        return {
            id: `opendata_${record.swis_code || ''}_${record.print_key_code || ''}_${offset + i}`,
            name: ownerName || record.municipality_name || 'Unknown Property',
            address: addressParts || 'No address',
            city: record.municipality_name || '',
            state: 'NY',
            zip: record.mailing_address_zip?.substring(0, 5) || '',
            propertyType: record.property_class_description || '',
            squareFootage: lotSqFt > 0 ? Math.round(lotSqFt) : undefined,
            ownerName: ownerName,
            source: 'ny_opendata',
            sourceId: `${record.swis_code}_${record.print_key_code}`,
            lastSalePrice: parseFloat(record.full_market_value) || undefined,
            facilityType: classConfig?.facilityType || 'office_general',
            isDismissed: false,
            // Store raw data for the detail panel
            rawData: {
                propertyClass: record.property_class,
                propertyClassDescription: record.property_class_description,
                rollYear: record.roll_year,
                front,
                depth,
                lotSqFt,
                mailingAddress,
                assessmentTotal: record.assessment_total,
                countyTaxable: record.county_taxable_value,
                townTaxable: record.town_taxable_value,
                schoolTaxable: record.school_taxable,
                printKeyCode: record.print_key_code,
                municipalityCode: record.municipality_code,
            },
        };
    });

    return {
        properties,
        totalCount,
        offset,
        hasMore: offset + limit < totalCount,
    };
}
