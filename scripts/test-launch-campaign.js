
const fetch = require('node-fetch');

async function testLaunch() {
    const url = 'http://127.0.0.1:5001/xiri-facility-solutions/us-central1/generateLeads';
    const payload = {
        data: {
            query: 'Commercial Cleaning',
            location: '11040',
            hasActiveContract: false
        }
    };

    try {
        console.log("Calling Function:", url);
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        const text = await response.text();
        console.log("Response Status:", response.status);
        console.log("Response Body:", text);
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testLaunch();
