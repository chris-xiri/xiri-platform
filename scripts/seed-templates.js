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

Output strict JSON:
{
    "valid": boolean,
    "reasoning": "string (concise summary for admin)",
    "extracted": {
        // key fields found
    }
}`,
            variables: ["documentType", "vendorName", "specialty", "requirements"],
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
