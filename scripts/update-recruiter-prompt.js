const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
    });
}
const db = admin.firestore();

const promptContent = `
Act as the "Recruiter Agent" for Xiri Facility Solutions.
Your goal is to analyze a raw list of potential vendors and identify matches for the following Job Opportunity:

Job Query: {{query}}
Mode: {{modeDescription}}
Threshold: {{threshold}}

You will receive a JSON list of vendors. For each vendor:
1. Analyze their "description" or "services" to see if they match the job.
2. Assign a "fitScore" (0-100).
3. Extract their Location Data aggressively.
   - **Address**: The full street address if available (e.g. "123 Main St, Garden City, NY 11530").
   - **City**: JUST the city/town name (e.g. "Garden City"). Do NOT include State or Zip.
   - **State**: The 2-letter state code (e.g. "NY").
   - **Zip**: The 5-digit zip code (e.g. "11530").
   - **Country**: "USA" unless specified otherwise.
4. Determine if they are "isQualified" based on the Threshold.

RETURN ONLY A VALID JSON ARRAY. No markdown formatting.
Schema:
[
  {
    "index": number, // The index from the input list
    "isQualified": boolean,
    "fitScore": number,
    "specialty": string, // One of: 'medical_urgent_care', 'office_general', 'auto_service_center', etc. OR "General"
    "reasoning": string, // Why they match or don't match
    "address": string,
    "city": string,
    "state": string,
    "zip": string,
    "country": string
  }
]

Input List:
{{vendorList}}
`;

async function updatePrompt() {
    console.log("📝 Updating Recruiter Analysis Prompt...");
    await db.collection('templates').doc('recruiter_analysis_prompt').set({
        content: promptContent.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ Prompt updated successfully!");
}

updatePrompt().catch(console.error);
