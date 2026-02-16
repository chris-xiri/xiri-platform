
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin for PRODUCTION
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
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
You are writing an outreach email for XIRI Facility Solutions to recruit blue-collar service contractors (cleaning, janitorial, maintenance).

**Target Audience:**
- Small business owners (1-10 employees)
- Many are Spanish-speaking or bilingual
- Blue-collar, hands-on workers
- May not be tech-savvy
- Value: Steady work, fair pay, simple processes

**Tone Guidelines:**
- Respectful and professional, but NOT corporate
- Use simple, direct language (8th grade reading level)
- Avoid jargon like "synergy," "leverage," "ecosystem"
- Be warm and encouraging
- Emphasize PRACTICAL benefits (money, time, ease)

**Context:**
{{campaignContext}}

**Vendor:**
Name: {{vendorName}}
Specialty: {{specialty}}

**Instructions:**
1. Write a SHORT, friendly email (max 200 words)
2. Use simple sentences and everyday words
3. Lead with the benefit: "More work, less hassle"
4. Include a clear call-to-action with the link placeholder: [Link]
5. Add a Spanish translation note at the bottom: "¿Habla español? Nuestro formulario está disponible en español."
6. Sign off warmly (not "Best regards" - use "Thanks" or "Talk soon")

**Format:**
Return ONLY JSON:
{
  "sms": "string (max 160 chars, friendly tone)",
  "email": {
    "subject": "string (clear, benefit-focused, max 50 chars)",
    "body": "string (simple, warm, max 200 words)"
  }
}

**Example Subject Lines (DO NOT COPY - use as inspiration):**
- "Need more cleaning jobs? We can help"
- "Steady work for [Specialty] contractors"
- "Join our contractor network - get more clients"

**Example Email Tone (DO NOT COPY - use as inspiration):**
"Hi [Name], we work with medical offices and auto dealerships who need reliable contractors like you. We handle the sales and paperwork - you just do the work and get paid. Interested? Click here to learn more."
`;


async function seedTemplate() {
    console.log("Seeding templates to PRODUCTION...");
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
        console.log("Production seeding complete.");

    } catch (error) {
        console.error("❌ Error seeding templates:", error);
    }
}

seedTemplate();
