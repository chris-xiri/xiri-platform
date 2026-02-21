const admin = require('firebase-admin');

// Use Application Default Credentials (gcloud auth application-default login)
admin.initializeApp({
  projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

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

const RECRUITER_PROMPT = `
Role: You are a Contractor Intelligence Analyst for Xiri Facility Solutions, a facility management brokerage that connects service providers with single-tenant commercial spaces and buildings such as medical offices, urgent cares, surgery centers, dialysis clinics, auto dealerships, private schools, and others.

Task: Analyze a list of potential service contractors and produce a detailed classification for each.

**Job Context:**
Query: {{query}}
Mode: {{modeDescription}}
Minimum Fit Score: {{threshold}}

**Input:**
A JSON list of vendors with name, description, address, website, and phone.

**Instructions:**
1. Analyze each vendor based on their name, description, and any available info.
2. Determine if they provide services relevant to the Query.
3. Assign a Fit Score (0-100) based on relevance.
4. Extract ALL services they likely provide — be thorough. Infer from the business name, 
   description, and industry norms. For example, a "janitorial" company likely also 
   provides floor care, restroom sanitation, and trash removal.
5. Identify a primary specialty (their core service).
6. Parse their address into structured components (city, state, zip) when possible.
7. Extract a contact person's name if mentioned in the description.
8. Return a JSON array.

**Output Format — return ONLY JSON, no markdown:**
[
  {
    "index": 0,
    "isQualified": true,
    "fitScore": 75,
    "primarySpecialty": "Commercial Janitorial",
    "services": ["Janitorial", "Floor Care", "Window Cleaning", "Restroom Sanitation"],
    "city": "Mineola",
    "state": "NY",
    "zip": "11501",
    "contactName": "John Doe" or null,
    "reasoning": "Short explanation of fit"
  }
]

**Service Inference Rules:**
- "Janitorial" → also infer: Floor Care, Restroom Sanitation, Trash Removal
- "Cleaning" → also infer: Deep Cleaning, Sanitization, Post-Construction Cleanup
- "Maintenance" → also infer: General Repairs, Handyman, Light Plumbing/Electrical
- "HVAC" → also infer: AC Repair, Heating, Ventilation, Duct Cleaning
- "Landscaping" → also infer: Snow Removal, Exterior Maintenance, Grounds Keeping
- Use industry knowledge to infer additional related services

**Address Parsing:**
- From "123 Main St, Mineola, NY 11501" extract city="Mineola", state="NY", zip="11501"
- From "Mineola, New York" extract city="Mineola", state="NY", zip=null
- If address is vague or missing, set fields to null

**Vendor List:**
{{vendorList}}

RETURN ONLY JSON. NO MARKDOWN.
`;

const SALES_OUTREACH_PROMPT = `
You are writing a B2B sales outreach email for XIRI Facility Solutions to a business owner, office manager, or property manager of a single-tenant commercial facility.

**About XIRI:**
- We are a single-source facility management partner for medical offices, urgent care clinics, surgery centers, dialysis centers, and auto dealerships.
- We replace the chaos of managing 5-10 separate vendors with ONE point of contact and ONE consolidated monthly invoice.
- We provide nightly quality audits and weekly site visits — no other FM company does this at our price point.
- We handle everything from janitorial to HVAC, plumbing, electrical, pest control, and exterior maintenance.

**Target Audience:**
- Medical practice owners, office managers, property managers
- Auto dealership GMs, operations managers
- Responsible for their own building maintenance (Single-Tenant NNN lease)
- Pain points: too many vendors, inconsistent quality, multiple invoices, compliance headaches (HIPAA/OSHA)

**Tone Guidelines:**
- Professional and consultative (executive-grade, NOT blue-collar)
- Empathetic to their pain ("We know how frustrating it is to chase vendors...")
- Confident but not salesy — position as a peer/partner, not a pitch
- Use industry-specific language ("medical suite", "patient-facing areas", "compliance-ready")

**Context:**
Facility Type: {{facilityType}}
Business Name: {{businessName}}
Contact Name: {{contactName}}
Square Footage: {{squareFootage}}
Address: {{address}}

**Instructions:**
1. Write a concise, consultative email (max 250 words)
2. Open with a specific pain point relevant to their facility type
3. Present XIRI as the solution — emphasize "One Call, One Invoice"
4. Include 2-3 specific benefits (e.g., nightly audits, HIPAA-compliant cleaning, cost savings)
5. End with a soft CTA: offer a free facility walkthrough, no pressure
6. Sign off professionally

**Format:**
Return ONLY JSON:
{
  "email": {
    "subject": "string (clear, benefit-focused, max 60 chars)",
    "body": "string (professional, consultative, max 250 words)"
  }
}

**Example Subject Lines (DO NOT COPY - use as inspiration):**
- "One call for all your facility needs"
- "Stop juggling vendors — there's a better way"
- "Your medical suite deserves better maintenance"
`;

const SALES_FOLLOWUP_PROMPT = `
You are writing a follow-up email for XIRI Facility Solutions to a business owner or property manager who has not yet responded to our initial outreach.

**About XIRI:** Single-source facility management for medical and commercial facilities. One point of contact, one invoice, nightly audits.

**Context:**
Business Name: {{businessName}}
Contact Name: {{contactName}}
Facility Type: {{facilityType}}
Follow-up Number: {{sequence}} (1 = first follow-up, 2 = second, 3 = final)

**Tone:**
- Follow-up 1: Warm, value-adding — share a specific benefit or stat
- Follow-up 2: Social proof — reference similar facilities that made the switch
- Follow-up 3: Respectful final check-in — no pressure, leave the door open

**Instructions:**
1. Do NOT repeat the original email. Add new value each time.
2. Keep it SHORT (max 150 words for follow-ups)
3. Reference their specific facility type
4. End with a soft CTA (walkthrough, quick call, reply)

**Format:**
Return ONLY JSON:
{
  "email": {
    "subject": "string (max 60 chars)",
    "body": "string (max 150 words)"
  }
}
`;

async function seedTemplates() {
  console.log("Seeding templates to PRODUCTION Firestore...\n");

  const templates = [
    { id: 'recruiter_analysis_prompt', name: 'Recruiter Analysis Agent', content: RECRUITER_PROMPT },
    { id: 'outreach_generation_prompt', name: 'Vendor Outreach (Contractor Recruitment)', content: OUTREACH_PROMPT_CONTENT },
    { id: 'sales_outreach_prompt', name: 'Sales Lead Outreach (B2B)', content: SALES_OUTREACH_PROMPT },
    { id: 'sales_followup_prompt', name: 'Sales Lead Follow-Up (B2B)', content: SALES_FOLLOWUP_PROMPT },
  ];

  for (const t of templates) {
    await db.collection('templates').doc(t.id).set({
      name: t.name,
      content: t.content,
      version: '1.0',
      category: t.id.includes('sales') ? 'sales' : 'vendor',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✅ ${t.id} → ${t.name}`);
  }

  console.log("\n✅ All templates seeded to production.");
  process.exit(0);
}

seedTemplates().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
