import fetch from 'node-fetch';

async function run() {
    console.log("Waiting for emulators to start...");
    await new Promise(r => setTimeout(r, 10000)); // Wait 10s

    console.log("Triggering Recruiter Agent...");
    const response = await fetch('http://127.0.0.1:5001/xiri-facility-solutions-485813/us-central1/runRecruiterAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vendors: [
                { name: "MediClean Pro", services: "Specialized in Terminal Cleaning for ICU and Medical Centers." },
                { name: "Joe's Plumbing", services: "Residential plumbing and leak fixes." },
                { name: "Omni Corp", services: "High-End Office maintenance and janitorial services." }
            ]
        })
    });

    if (!response.ok) {
        console.error("Error triggering agent:", response.statusText);
        const text = await response.text();
        console.error(text);
        return;
    }

    const result = await response.json();
    console.log("Agent Result:", JSON.stringify(result, null, 2));

    if (result.qualified > 0) {
        console.log("SUCCESS: Vendors qualified and written to Firestore.");
    } else {
        console.log("WARNING: No vendors qualified?");
    }
}

run();
