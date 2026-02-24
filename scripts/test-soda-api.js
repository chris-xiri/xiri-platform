// Quick test of NY State dataset
async function test() {
    // Unfiltered first to get field names
    const url1 = new URL('https://data.ny.gov/resource/n9v6-gdp6.json');
    url1.searchParams.set('$limit', '2');
    const r1 = await fetch(url1);
    const d1 = await r1.json();
    console.log('=== NY State Fields ===');
    console.log('Fields:', Object.keys(d1[0] || {}).join(', '));
    console.log(JSON.stringify(d1[0], null, 2));

    // Search cleaning companies
    const url2 = new URL('https://data.ny.gov/resource/n9v6-gdp6.json');
    url2.searchParams.set('$limit', '5');
    url2.searchParams.set('$where', "current_entity_name like '%CLEAN%'");
    url2.searchParams.set('$order', 'initial_dos_filing_date DESC');
    const r2 = await fetch(url2);
    const d2 = await r2.json();
    console.log('\n=== Cleaning companies ===');
    console.log(`Found ${Array.isArray(d2) ? d2.length : 0} results`);
    if (Array.isArray(d2)) d2.forEach(b => console.log(`  ${b.current_entity_name} | ${b.dos_process_city || b.county || ''}`));
    else console.log(JSON.stringify(d2).substring(0, 300));

    // Search Nassau
    const url3 = new URL('https://data.ny.gov/resource/n9v6-gdp6.json');
    url3.searchParams.set('$limit', '5');
    url3.searchParams.set('$where', "current_entity_name like '%CLEAN%' AND upper(dos_process_city) like '%GARDEN CITY%'");
    const r3 = await fetch(url3);
    const d3 = await r3.json();
    console.log('\n=== Cleaning in Garden City (Nassau) ===');
    if (Array.isArray(d3)) d3.forEach(b => console.log(`  ${b.current_entity_name} | ${b.dos_process_city}`));
    else console.log(JSON.stringify(d3).substring(0, 300));
}
test();
