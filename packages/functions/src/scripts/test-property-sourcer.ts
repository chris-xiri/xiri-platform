import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { searchProperties } from '../agents/propertySourcer';

async function testPropertySourcer() {
    const query = "urgent care";
    const location = "Williston Park, NY";
    const provider = process.argv[2] || 'mock';

    console.log(`Testing PropertySourcer: "${query}" in "${location}" via [${provider}]`);
    console.log('─'.repeat(50));

    try {
        const properties = await searchProperties(query, location, provider);
        console.log(`\n── Results: ${properties.length} properties ──\n`);

        properties.forEach((p, i) => {
            console.log(`[${i + 1}] ${p.name}`);
            console.log(`    Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
            console.log(`    Type: ${p.propertyType || 'N/A'} | Sq Ft: ${p.squareFootage?.toLocaleString() || 'N/A'}`);
            console.log(`    Owner: ${p.ownerName || 'N/A'} | Phone: ${p.ownerPhone || 'N/A'}`);
            console.log(`    Tenant: ${p.tenantName || 'N/A'} | Count: ${p.tenantCount || 'N/A'}`);
            console.log(`    Last Sale: $${p.lastSalePrice?.toLocaleString() || 'N/A'} (${p.lastSaleDate || 'N/A'})`);
            console.log(`    Source: ${p.source} | ID: ${p.sourceId || 'N/A'}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error during sourcing:', error);
    }
}

testPropertySourcer();
