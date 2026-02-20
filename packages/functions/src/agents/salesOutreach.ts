import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const db = admin.firestore();

/**
 * Generate a sales outreach email for a business owner or property manager.
 * 
 * Unlike vendor outreach (blue-collar, simple language), this is B2B executive-grade:
 * - Professional, consultative tone
 * - Focuses on pain points: vendor chaos, multiple invoices, compliance burden
 * - Value prop: one point of contact, consolidated invoicing, quality audits
 * 
 * @param lead - The lead data from Firestore
 * @param sequence - Which email in the drip (0 = intro, 1-3 = follow-ups)
 */
export const generateSalesOutreachContent = async (lead: any, sequence: number = 0) => {
    try {
        // Fetch the appropriate prompt template
        const templateId = sequence === 0 ? 'sales_outreach_prompt' : 'sales_followup_prompt';
        const templateDoc = await db.collection("templates").doc(templateId).get();
        if (!templateDoc.exists) {
            throw new Error(`Template '${templateId}' not found in database`);
        }

        const template = templateDoc.data();

        // Build context for the prompt
        const facilityType = lead.facilityType || 'commercial facility';
        const prettyFacilityType = facilityType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        const sqft = lead.propertySourcing?.squareFootage;
        const sqftStr = sqft ? `${sqft.toLocaleString()} sq ft` : 'N/A';

        // Replace template variables
        const prompt = template?.content
            .replace(/\{\{businessName\}\}/g, lead.businessName || 'your practice')
            .replace(/\{\{contactName\}\}/g, lead.contactName || 'there')
            .replace(/\{\{facilityType\}\}/g, prettyFacilityType)
            .replace(/\{\{squareFootage\}\}/g, sqftStr)
            .replace(/\{\{address\}\}/g, lead.address || '')
            .replace(/\{\{sequence\}\}/g, String(sequence))
            .replace(/\{\{tenantName\}\}/g, lead.propertySourcing?.tenantName || lead.businessName || '')
            .replace(/\{\{ownerName\}\}/g, lead.propertySourcing?.ownerName || '');

        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Sanitize code blocks
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();

        const jsonContent = JSON.parse(text);

        return {
            email: jsonContent.email,
            generatedAt: new Date(),
        };
    } catch (error) {
        console.error("[SalesOutreach] Error generating content:", error);
        return {
            email: {
                subject: "Error",
                body: "Error generating content. Please draft manually."
            },
            error: true,
        };
    }
};
