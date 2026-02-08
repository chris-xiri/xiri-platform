const admin = require("firebase-admin");

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-platform"
    });
}

const db = admin.firestore();

async function seedTemplates() {
    const templates = [
        {
            id: "doc_upload_notification",
            type: "email",
            name: "Document Upload Notification",
            category: "onboarding",
            subject: "We're Reviewing Your Documents",
            content: `Hi {{vendorName}},

Thank you for uploading your {{documentType}} to our vendor portal. Our compliance team is currently reviewing your submission.

We're excited to potentially partner with you and appreciate your prompt response. If everything looks good, we'll reach out within 24 hours to schedule your onboarding call.

In the meantime, you can track your progress here:
{{portalLink}}

Best regards,
The Xiri Team`,
            variables: ["vendorName", "documentType", "portalLink"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "welcome_email",
            type: "email",
            name: "Welcome Email",
            category: "onboarding",
            subject: "Welcome to Xiri Facility Solutions",
            content: `Hi {{vendorName}},

Welcome to Xiri Facility Solutions! We're thrilled to have {{specialty}} experts like you in our network.

We connect qualified vendors with facility managers who need reliable, professional services. As a member of our network, you'll have access to:

• Qualified job opportunities in your area
• Fast payment processing
• Dedicated vendor support

We'll be in touch soon with next steps.

Best regards,
The Xiri Team`,
            variables: ["vendorName", "specialty"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "recruiter_prompt",
            type: "prompt",
            name: "Recruiter Agent System Prompt",
            category: "agents",
            content: `You are a vendor recruitment specialist for Xiri Facility Solutions.

Your task is to analyze vendor leads and determine their fit for our network.

Context:
- Search Query: {{query}}
- Contract Status: {{hasActiveContract}}

Scoring Criteria:
1. Relevance to search query (0-40 points)
2. Business legitimacy indicators (0-30 points)
3. Contact information quality (0-30 points)

Output strict JSON with: fitScore, reasoning, recommended status.`,
            variables: ["query", "hasActiveContract"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "document_verifier_prompt",
            type: "prompt",
            name: "Document Verifier System Prompt",
            category: "agents",
            content: `You are an expert Insurance Compliance Officer.

Analyze the following OCR text extracted from a {{documentType}} document for vendor "{{vendorName}}" ({{specialty}}).

Requirements:
1. Name must match "{{vendorName}}" (fuzzy match ok).
2. {{requirements}}

OCR Text:
"""
{{ocrText}}
"""

Output strictly JSON:
{
    "valid": boolean,
    "reasoning": "string (concise summary for admin)",
    "extracted": {
        // key fields found
    }
}`,
            variables: ["documentType", "vendorName", "specialty", "requirements", "ocrText"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "recruiter_analysis_prompt",
            type: "prompt",
            name: "Recruiter Vendor Analysis Prompt",
            category: "agents",
            content: `You are an expert procurement officer. Analyze the following list of vendors for the job query: "{{query}}".

Context: {{modeDescription}}

For each vendor, calculate a Fit Score (0-100) based on these weighted factors:
1. **Relevance (30%)**: Does the vendor explicitly offer services matching "{{query}}"?
2. **Contact Info (30%)**: +15 points if Phone is present. +15 points if Email/Website indicates reachable contact.
3. **Confidence (40%)**: How certain are you that they operate in the target service area and industry?

Identify:
- **Industry**: Specific category (e.g. Commercial Cleaning, HVAC).
- **Business Type**: "Franchise" or "Independent". Favor "Independent" slightly in scoring if equal relevance.

Return a JSON array where each object contains:
- index: (original index)
- specialty: (classified category)
- businessType: ("Franchise" or "Independent")
- fitScore: (calculated 0-100)
- isQualified: (boolean, true if fitScore >= {{threshold}})
- reasoning: (short string explaining the score)

Input List:
{{vendorList}}`,
            variables: ["query", "modeDescription", "threshold", "vendorList"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "outreach_generation_prompt",
            type: "prompt",
            name: "Outreach Content Generation Prompt",
            category: "agents",
            content: `You are an AI assistant for Xiri Facility Solutions, drafting introductory messages to a vendor.

Vendor: {{vendorName}}
Industry: {{specialty}}
Campaign Context: {{campaignContext}}

Goal: Persuade them to reply or sign up.
Tone: Professional, direct, and valuable.

Constraints:
- SMS: Max 160 characters. No fluff. Clear CTA.
- Email: Subject line + Body. Concise (< 150 words).

Output strictly in JSON format:
{
    "sms": "string",
    "email": {
        "subject": "string",
        "body": "string"
    }
}`,
            variables: ["vendorName", "specialty", "campaignContext"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "message_analysis_prompt",
            type: "prompt",
            name: "Incoming Message Analysis Prompt",
            category: "agents",
            content: `You are an AI assistant for Xiri Facility Solutions. You are analyzing a reply from a vendor.

Vendor: {{vendorName}}
Message: "{{messageContent}}"
Previous Context (What we sent them): "{{previousContext}}"

Task:
1. Classify the intent:
    - INTERESTED (Positive reply, wants to proceed)
    - NOT_INTERESTED (Negative, stop, unsubscribe)
    - QUESTION (Asking for more info, pricing, etc.)
    - OTHER (Spam, unclear)

2. Generate a response based on the intent:
    - If INTERESTED: Reply warmly and ask them to click the onboarding link: https://xiri.com/vendor/onboarding/{{vendorId}}
    - If NOT_INTERESTED: Acknowledge and confirm removal.
    - If QUESTION: Draft a helpful, concise answer.
    - If OTHER: Ask for clarification.

Output strictly in JSON format:
{
    "intent": "INTERESTED" | "NOT_INTERESTED" | "QUESTION" | "OTHER",
    "reply": "string"
}`,
            variables: ["vendorName", "messageContent", "previousContext", "vendorId"],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
    ];

    for (const template of templates) {
        await db.collection("templates").doc(template.id).set(template);
        console.log(`✅ Seeded template: ${template.name}`);
    }

    console.log(`\n🎉 All templates seeded successfully!`);
}

seedTemplates().catch(console.error);
