const fetch = require('node-fetch');

async function triggerRecruiter() {
    console.log("Triggering runRecruiterAgent...");
    try {
        const response = await fetch('http://127.0.0.1:5001/xiri-platform/us-central1/runRecruiterAgent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendors: [
                    { name: "Debug Plumber", services: "Emergency Plumbing", location: "Localhost" }
                ]
            })
        });

        const text = await response.text();
        console.log("Raw Response:", text);
        try {
            const result = JSON.parse(text);
            console.log("Result:", JSON.stringify(result, null, 2));
        } catch (e) {
            console.log("Failed to parse JSON response.");
        }
    } catch (error) {
        console.error("Error calling function:", error);
    }
}

triggerRecruiter();
