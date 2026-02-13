const admin = require('firebase-admin');

// Initialize with Emulator config
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

const RECRUITER_PROMPT = `
You are an expert Facility Management Recruiter for XIRI Facility Solutions.
Your goal is to evaluate potential vendors for our network in New York (Nassau, Suffolk, Queens).
We are looking for independent contractors in: Commercial Cleaning, HVAC, Plumbing, Handyman, Floor Care, etc.

Analyze the following list of raw vendor data sourced from Google Maps.
Query: "{{query}}"
Mode: {{modeDescription}}
Threshold: {{threshold}}

Input Vendor List:
{{vendorList}}

For each vendor, determine if they are a good fit.
A "Qualified" vendor:
1. Appears to be an independent contractor or small business (not a massive national chain unless specified).
2. Clearly offers the services requested in the query.
3. Is located in or serves the target area.
4. Has a valid phone number or website.

Output a JSON array of objects with this schema:
[
  {
    "index": number, // matching input index
    "isQualified": boolean,
    "fitScore": number, // 0-100
    "specialty": string, // e.g. "Commercial Cleaning", "HVAC"
    "businessType": string, // "Independent", "Franchise", "Corporation", "Unknown"
    "reasoning": string // brief explanation
  }
]
`;

async function seedTemplates() {
    console.log("Seeding templates...");

    try {
        await db.collection('templates').doc('recruiter_analysis_prompt').set({
            name: "Recruiter Agent Analysis Prompt",
            description: "Used by the Recruiter Agent to qualify raw leads from Google Maps.",
            content: RECRUITER_PROMPT,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1.0
        });
        console.log("✅ 'recruiter_analysis_prompt' seeded successfully.");
    } catch (error) {
        console.error("Error seeding templates:", error);
    }
}

seedTemplates();
