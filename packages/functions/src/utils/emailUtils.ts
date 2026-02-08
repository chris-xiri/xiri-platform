import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface EmailTemplate {
    subject: string;
    content: string;
    variables: string[];
}

/**
 * Fetch a template from Firestore
 */
export async function getTemplate(templateId: string): Promise<EmailTemplate | null> {
    try {
        const doc = await db.collection("templates").doc(templateId).get();
        if (!doc.exists) {
            console.error(`Template ${templateId} not found`);
            return null;
        }
        return doc.data() as EmailTemplate;
    } catch (error) {
        console.error("Error fetching template:", error);
        return null;
    }
}

/**
 * Replace variables in template content
 */
export function replaceVariables(content: string, variables: Record<string, string>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

/**
 * Generate personalized email using AI
 */
export async function generatePersonalizedEmail(
    templateId: string,
    variables: Record<string, string>
): Promise<{ subject: string; body: string } | null> {
    try {
        const template = await getTemplate(templateId);
        if (!template) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are a professional email writer for Xiri Facility Solutions.

Take this email template and personalize it while maintaining the core message:

Subject: ${template.subject}
Body:
${template.content}

Variables to use:
${Object.entries(variables).map(([key, val]) => `- ${key}: ${val}`).join('\n')}

Instructions:
1. Replace all {{variables}} with the actual values
2. Make the tone warm and professional
3. Keep it concise (under 150 words)
4. Output ONLY the email in this format:
SUBJECT: [subject line]
BODY:
[email body]`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const response = result.response.text();
        const subjectMatch = response.match(/SUBJECT:\s*(.+)/);
        const bodyMatch = response.match(/BODY:\s*([\s\S]+)/);

        if (!subjectMatch || !bodyMatch) {
            // Fallback to simple variable replacement
            return {
                subject: replaceVariables(template.subject, variables),
                body: replaceVariables(template.content, variables)
            };
        }

        return {
            subject: subjectMatch[1].trim(),
            body: bodyMatch[1].trim()
        };
    } catch (error) {
        console.error("Error generating email:", error);
        return null;
    }
}

/**
 * Send templated email (mock for now)
 */
export async function sendTemplatedEmail(
    vendorId: string,
    templateId: string,
    customVariables?: Record<string, string>
): Promise<void> {
    try {
        // Fetch vendor data
        const vendorDoc = await db.collection("vendors").doc(vendorId).get();
        if (!vendorDoc.exists) {
            console.error(`Vendor ${vendorId} not found`);
            return;
        }

        const vendor = vendorDoc.data();

        // Build variables
        const variables = {
            vendorName: vendor?.companyName || "Vendor",
            specialty: vendor?.specialty || "your trade",
            portalLink: `https://xiri.app/vendor/onboarding/${vendorId}`,
            ...customVariables
        };

        // Generate email
        const email = await generatePersonalizedEmail(templateId, variables);
        if (!email) {
            console.error("Failed to generate email");
            return;
        }

        // Log to vendor_activities (mock send)
        await db.collection("vendor_activities").add({
            vendorId,
            type: "EMAIL_SENT",
            description: `Email sent: ${email.subject}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                templateId,
                subject: email.subject,
                body: email.body,
                to: vendor?.email || "unknown"
            }
        });

        console.log(`✅ Email sent to ${vendor?.companyName}: ${email.subject}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
