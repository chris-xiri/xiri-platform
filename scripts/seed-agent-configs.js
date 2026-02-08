const admin = require("firebase-admin");

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-platform"
    });
}

const db = admin.firestore();

async function seedAgentConfigs() {
    const agents = [
        {
            id: "recruiter_agent",
            name: "Recruiter Agent",
            description: "Analyzes vendor leads from web scraping and assigns fit scores based on relevance, contact quality, and business type.",
            promptTemplateId: "recruiter_analysis_prompt",
            model: "gemini-2.0-flash",
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "outreach_agent",
            name: "Outreach Agent",
            description: "Generates personalized SMS and email content for vendor outreach campaigns, adapting tone based on urgency.",
            promptTemplateId: "outreach_generation_prompt",
            model: "gemini-2.0-flash",
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "message_analyzer_agent",
            name: "Message Analyzer Agent",
            description: "Classifies incoming vendor replies (interested, not interested, question) and generates appropriate responses.",
            promptTemplateId: "message_analysis_prompt",
            model: "gemini-2.0-flash",
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: "document_verifier_agent",
            name: "Document Verifier Agent",
            description: "Analyzes COI and W9 documents using OCR, verifies compliance requirements, and extracts key data.",
            promptTemplateId: "document_verifier_prompt",
            model: "gemini-2.0-flash",
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
    ];

    for (const agent of agents) {
        await db.collection("agent_configs").doc(agent.id).set(agent);
        console.log(`✅ Seeded agent: ${agent.name}`);
    }

    console.log(`\n🎉 All agent configs seeded successfully!`);
}

seedAgentConfigs().catch(console.error);
