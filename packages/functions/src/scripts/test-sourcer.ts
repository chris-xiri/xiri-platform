import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the .env file in the functions package
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { searchVendors } from '../agents/sourcer';

async function testSourcer() {
    const query = "Commercial Cleaning";
    const location = "Williston Park, NY";

    console.log(`Testing Serper integration for: "${query}" in "${location}"...`);
    console.log(`API Key present: ${!!process.env.SERPER_API_KEY}`);

    try {
        const vendors = await searchVendors(query, location);
        console.log("\n--- Sourcing Results ---");
        console.log(`Found ${vendors.length} vendors.`);

        vendors.forEach((v, i) => {
            console.log(`\n[${i + 1}] ${v.name}`);
            console.log(`    Address: ${v.location}`);
            console.log(`    Source: ${v.source}`);
            if (v.phone) console.log(`    Phone: ${v.phone}`);
            if (v.website) console.log(`    Website: ${v.website}`);
        });

    } catch (error) {
        console.error("Error during sourcing:", error);
    }
}

testSourcer();
