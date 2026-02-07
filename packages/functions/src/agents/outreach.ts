import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export const generateOutreachContent = async (vendor: any, preferredChannel: 'SMS' | 'EMAIL') => {
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
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const jsonContent = JSON.parse(text);

        return {
            channel,
            sms: jsonContent.sms,
            email: jsonContent.email,
            generatedAt: new Date()
        };
    } catch (error) {
        console.error("Error generating outreach content:", error);
        return {
            channel,
            sms: "Error generating SMS.",
            email: { subject: "Error", body: "Error generating content. Please draft manually." },
            error: true
        };
    }
};
