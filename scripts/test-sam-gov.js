/**
 * Test SAM.gov API Connection
 * Run with: node scripts/test-sam-gov.js
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function testSam() {
    const apiKey = process.env.SAM_GOV_API_KEY;
    
    if (!apiKey) {
        console.error('❌ SAM_GOV_API_KEY not found in .env.local');
        return;
    }

    console.log(`🔍 Testing SAM.gov API with key: ${apiKey.substring(0,4)}...${apiKey.substring(apiKey.length-4)}`);

    const url = `https://api.sam.gov/opportunities/v1/search?api_key=${apiKey}&limit=1&nCode=561720&is_active=true`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Connection Successful!');
            console.log(`Found ${data.totalRecords} active janitorial opportunities.`);
            if (data.opportunitiesData && data.opportunitiesData.length > 0) {
                console.log('Sample Opportunity:', data.opportunitiesData[0].title);
            }
        } else {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
        }
    } catch (error) {
        console.error('❌ Network Error:', error.message);
    }
}

testSam();
