/**
 * Preview NY Open Data (SODA API) — Property Assessment rolls
 * Dataset: 7vem-aaz7
 * Run: node scripts/preview-opendata.js
 */

const DATASET = '7vem-aaz7';
const BASE = `https://data.ny.gov/resource/${DATASET}.json`;

const PROPERTY_CLASSES = ['465', '484', '483', '461', '471', '472'];
const COUNTY = 'Nassau';
const LIMIT = 10;

async function main() {
    const classFilter = PROPERTY_CLASSES.map(c => `'${c}'`).join(',');
    const where = `county_name='${COUNTY}' AND property_class in(${classFilter})`;
    const url = `${BASE}?$limit=${LIMIT}&$where=${encodeURIComponent(where)}`;

    console.log('Fetching:', url, '\n');

    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        console.error('API Error:', res.status, text);
        return;
    }

    const data = await res.json();
    console.log(`Got ${data.length} records:\n`);

    // Show all field names from first record
    if (data.length > 0) {
        console.log('=== ALL FIELDS ===');
        console.log(Object.keys(data[0]).join(', '));
        console.log('');
    }

    data.forEach((r, i) => {
        console.log(`--- Record ${i + 1} ---`);
        console.log(`  Property Class: ${r.property_class} - ${r.property_class_description || 'N/A'}`);
        console.log(`  Address: ${[r.parcel_address_number, r.parcel_address_street, r.parcel_address_suff].filter(Boolean).join(' ')}`);
        console.log(`  Municipality: ${r.municipality_name}`);
        console.log(`  Owner: ${[r.primary_owner_first_name, r.primary_owner_last_name].filter(Boolean).join(' ')}`);
        console.log(`  Mailing: ${[r.mailing_address_number, r.mailing_address_street, r.mailing_address_suff, r.mailing_address_city, r.mailing_address_state, r.mailing_address_zip].filter(Boolean).join(' ')}`);
        console.log(`  Market Value: $${Number(r.full_market_value || 0).toLocaleString()}`);
        console.log(`  Front x Depth: ${r.front || '?'} x ${r.depth || '?'}`);
        console.log(`  Sq Ft fields: total_sq_ft=${r.total_sq_ft || 'N/A'}, sq_ft=${r.sq_ft || 'N/A'}, land_sq_ft=${r.land_sq_ft || 'N/A'}`);
        console.log(`  Roll Year: ${r.roll_year}`);
        console.log('');
    });

    // Also show count
    const countUrl = `${BASE}?$select=count(*)&$where=${encodeURIComponent(where)}`;
    const countRes = await fetch(countUrl);
    const countData = await countRes.json();
    console.log(`\nTotal matching records: ${countData[0]?.count || 'unknown'}`);
}

main().catch(console.error);
