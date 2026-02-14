
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

const OUTREACH_PROMPT_CONTENT = `
You are an expert copywriter for Xiri Facility Solutions.
Your goal is to write a personalized outreach message to a facility service vendor.

**Context:**
{{campaignContext}}

**Vendor:**
Name: {{vendorName}}
Specialty: {{specialty}}

**Instructions:**
1.  Write a short, professional SMS (max 160 chars). Include a placeholder for the link: [Link].
2.  Write a professional Email (Subject + Body). The tone should be authoritative yet inviting.

**Format:**
Return ONLY JSON:
{
  "sms": "string",
  "email": {
    "subject": "string",
    "body": "string"
  }
}
`;

async function seedTemplate() {
    console.log("Seeding templates...");
    try {
        await db.collection('templates').doc('recruiter_analysis_prompt').set({
            name: "Recruiter Analysis Agent",
            content: PROMPT_CONTENT,
            version: "1.0",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Successfully seeded 'recruiter_analysis_prompt'.");

        await db.collection('templates').doc('outreach_generation_prompt').set({
            name: "Outreach Generation Agent",
            content: OUTREACH_PROMPT_CONTENT,
            version: "1.0",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Successfully seeded 'outreach_generation_prompt'.");

    } catch (error) {
        console.error("❌ Error seeding templates:", error);
    }
}

seedTemplate();
