import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const db = admin.firestore();

export const generateOutreachContent = async (vendor: any, preferredChannel: 'SMS' | 'EMAIL') => {
    const channel = preferredChannel;

    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("outreach_generation_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Outreach generation prompt not found in database");
        }

        const template = templateDoc.data();

        // Build location string from available data
        const locationParts = [vendor.city, vendor.state].filter(Boolean);
        const location = locationParts.length > 0 ? locationParts.join(', ') : 'your area';

        // Build services string from capabilities array
        const services = Array.isArray(vendor.capabilities) && vendor.capabilities.length > 0
            ? vendor.capabilities.join(', ')
            : vendor.specialty || 'Facility Services';

        // Replace template variables
        const prompt = template?.content
            .replace(/\{\{vendorName\}\}/g, vendor.companyName || vendor.businessName || 'your company')
            .replace(/\{\{specialty\}\}/g, vendor.specialty || vendor.capabilities?.[0] || 'Services')
            .replace(/\{\{services\}\}/g, services)
            .replace(/\{\{contactName\}\}/g, vendor.contactName || 'not available')
            .replace(/\{\{location\}\}/g, location)
            // Legacy variable fallback (in case old prompt is still in Firestore)
            .replace(/\{\{campaignContext\}\}/g, vendor.hasActiveContract
                ? "URGENT JOB OPPORTUNITY (We have a contract ready)"
                : "Building Supply Network (Partnership Opportunity)");

        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Sanitize code blocks if present
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();

        const jsonContent = JSON.parse(text);

        return {
            channel,
            email: jsonContent.email,
            generatedAt: new Date()
        };
    } catch (error) {
        console.error("Error generating outreach content:", error);
        return {
            channel,
            email: { subject: "Error", body: "Error generating content. Please draft manually." },
            error: true
        };
    }
};


export const analyzeIncomingMessage = async (vendor: any, messageContent: string, previousContext: string) => {
    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("message_analysis_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Message analysis prompt not found in database");
        }

        const template = templateDoc.data();

        // Replace variables
        const prompt = template?.content
            .replace(/\{\{vendorName\}\}/g, vendor.companyName)
            .replace(/\{\{messageContent\}\}/g, messageContent)
            .replace(/\{\{previousContext\}\}/g, previousContext)
            .replace(/\{\{vendorId\}\}/g, vendor.id);

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
        const jsonContent = JSON.parse(text);
        return jsonContent;
    } catch (error) {
        console.error("Error analyzing message:", error);
        return { intent: "OTHER", reply: "Error analyzing message." };
    }
};
