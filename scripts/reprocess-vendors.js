const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
    });
}
const db = admin.firestore();

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function reprocessVendors() {
    console.log("🔄 Starting Vendor Location Reprocessing...");

    // Fetch vendors that might need processing (naive check: missing city)
    // In a real app we might use a composite index or just process all
    const snapshot = await db.collection('vendors').get();

    if (snapshot.empty) {
        console.log("No vendors found.");
        return;
    }

    const vendorsToUpdate = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        // Check if address exists but city/state are missing
        if (data.address && (!data.city || !data.state || !data.zip)) {
            vendorsToUpdate.push({
                id: doc.id,
                address: data.address,
                businessName: data.businessName || "Unknown"
            });
        }
    });

    console.log(`Found ${vendorsToUpdate.length} vendors needing location parsing.`);

    if (vendorsToUpdate.length === 0) return;

    // Process in batches of 10 to avoid hitting rate limits too hard
    const BATCH_SIZE = 10;
    for (let i = 0; i < vendorsToUpdate.length; i += BATCH_SIZE) {
        const batch = vendorsToUpdate.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i + 1}-${Math.min(i + BATCH_SIZE, vendorsToUpdate.length)}...`);

        const prompt = `
        I have a list of vendor addresses. I need you to extract the City, State (2-letter code), Zip, and Country for each.
        
        Input List:
        ${JSON.stringify(batch)}

        Return a JSON ARRAY of objects with:
        - id: (keep original id)
        - city: string
        - state: string (2 chars)
        - zip: string (5 chars)
        - country: string (default "USA")
        
        If you cannot parse strictly, leave field as null.
        RETURN JSON ONLY. No markdown.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(text);

            const firestoreBatch = db.batch();
            let updateCount = 0;

            for (const item of parsedData) {
                if (item.id && (item.city || item.state || item.zip)) {
                    const updateDoc = {};
                    if (item.city) updateDoc.city = item.city;
                    if (item.state) updateDoc.state = item.state;
                    if (item.zip) updateDoc.zip = item.zip;
                    if (item.country) updateDoc.country = item.country;

                    if (Object.keys(updateDoc).length > 0) {
                        const ref = db.collection('vendors').doc(item.id);
                        firestoreBatch.update(ref, updateDoc);
                        updateCount++;
                        console.log(`  -> Scheduled update for ${item.id}: ${item.city}, ${item.state}`);
                    }
                }
            }

            if (updateCount > 0) {
                await firestoreBatch.commit();
                console.log(`  ✅ Committed ${updateCount} updates.`);
            }

        } catch (error) {
            console.error("  ❌ Batch failed:", error.message);
        }
    }

    console.log("🎉 Reprocessing complete.");
}

reprocessVendors().catch(console.error);
