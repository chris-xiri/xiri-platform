"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeIncomingMessage = exports.generateOutreachContent = void 0;
const generative_ai_1 = require("@google/generative-ai");
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const generateOutreachContent = async (vendor, preferredChannel) => {
    const isUrgent = vendor.hasActiveContract;
    const channel = preferredChannel; // Could refine logic here (e.g. if SMS fails validation, swap to Email)
    const prompt = `
    You are an AI assistant for Xiri Facility Solutions, drafting introductory messages to a vendor.
    
    Vendor: ${vendor.companyName}
    Industry: ${vendor.specialty || "Services"}
    Campaign Context: ${isUrgent ? "URGENT JOB OPPORTUNITY (We have a contract ready)" : "Building Supply Network (Partnership Opportunity)"}

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
    }
    `;
    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        // Sanitize code blocks if present
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
        const jsonContent = JSON.parse(text);
        return {
            channel,
            sms: jsonContent.sms,
            email: jsonContent.email,
            generatedAt: new Date()
        };
    }
    catch (error) {
        console.error("Error generating outreach content:", error);
        return {
            channel,
            sms: "Error generating SMS.",
            email: { subject: "Error", body: "Error generating content. Please draft manually." },
            error: true
        };
    }
};
exports.generateOutreachContent = generateOutreachContent;
const analyzeIncomingMessage = async (vendor, messageContent, previousContext) => {
    const prompt = `
    You are an AI assistant for Xiri Facility Solutions. You are analyzing a reply from a vendor.

    Vendor: ${vendor.companyName}
    Message: "${messageContent}"
    Previous Context (What we sent them): "${previousContext}"

    Task:
    1. Classify the intent:
        - INTERESTED (Positive reply, wants to proceed)
        - NOT_INTERESTED (Negative, stop, unsubscribe)
        - QUESTION (Asking for more info, pricing, etc.)
        - OTHER (Spam, unclear)

    2. Generate a response based on the intent:
        - If INTERESTED: Reply warmly and ask them to click the onboarding link: https://xiri.com/vendor/onboarding/${vendor.id}
        - If NOT_INTERESTED: Acknowledge and confirm removal.
        - If QUESTION: Draft a helpful, concise answer.
        - If OTHER: Ask for clarification.

    Output strictly in JSON format:
    {
        "intent": "INTERESTED" | "NOT_INTERESTED" | "QUESTION" | "OTHER",
        "reply": "string"
    }
    `;
    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
        const jsonContent = JSON.parse(text);
        return jsonContent;
    }
    catch (error) {
        console.error("Error analyzing message:", error);
        return { intent: "OTHER", reply: "Error analyzing message." };
    }
};
exports.analyzeIncomingMessage = analyzeIncomingMessage;
//# sourceMappingURL=outreach.js.map