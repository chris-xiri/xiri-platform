
const admin = require('firebase-admin');

// Initialize Firebase Admin (reuse existing config if running in context, or init new)
if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

const PROMPT_CONTENT = `
You are an expert Facility Solutions Recruiter for Xiri.
Your goal is to analyze a raw list of potential vendors and identify which ones are a match for our network.

**Job Context:**
Query: {{query}}
Mode: {{modeDescription}}
Minimum Fit Score: {{threshold}}

**Input:**
A JSON list of vendors with name, description, website, and phone.

**Instructions:**
1. Analyze each vendor.
2. Determine if they offer services relevant to the Query.
3. Assign a "Fit Score" (0-100).
4. Extract their "Specialty" (e.g., "Medical Cleaning", "HVAC", "General Janitorial").
5. Return a JSON array of objects with:
   - index: (original index)
   - isQualified: (boolean, true if score >= threshold)
   - fitScore: (number)
   - specialty: (string)
   - reasoning: (short string)

**Vendor List:**
{{vendorList}}

RETURN ONLY JSON. NO MARKDOWN.
`;

async function seedTemplate() {
    console.log("Seeding recruiter_analysis_prompt...");
    try {
        await db.collection('templates').doc('recruiter_analysis_prompt').set({
            name: "Recruiter Analysis Agent",
            content: PROMPT_CONTENT,
            version: "1.0",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Successfully seeded 'recruiter_analysis_prompt'.");
    } catch (error) {
        console.error("❌ Error seeding template:", error);
    }
}

seedTemplate();
