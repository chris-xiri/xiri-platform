import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resend } from 'resend';

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

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
 * Extract ZIP code from address string
 */
function extractZipFromAddress(address?: string): string | null {
    if (!address) return null;
    const zipMatch = address.match(/\b\d{5}\b/);
    return zipMatch ? zipMatch[0] : null;
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
            vendorName: vendor?.businessName || "Vendor",
            zipCode: vendor?.zipCode || extractZipFromAddress(vendor?.address) || "your area",
            specialty: vendor?.specialty || "your trade",
            portalLink: `https://xiri.ai/vendor/onboarding/${vendorId}`,
            ...customVariables
        };

        // Generate email
        const email = await generatePersonalizedEmail(templateId, variables);
        if (!email) {
            console.error("Failed to generate email");
            return;
        }

        // Send email via Resend
        let resendId: string | undefined;
        try {
            const { data } = await resend.emails.send({
                from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
                to: vendor?.email || '',
                subject: email.subject,
                html: email.body,
            });
            resendId = data?.id;
            console.log(`✅ Email sent to ${vendor?.companyName}: ${email.subject} (Resend ID: ${data?.id})`);
        } catch (error) {
            console.error('❌ Resend API error:', error);
            // Log failure but don't throw - non-blocking
            await db.collection("vendor_activities").add({
                vendorId,
                type: "EMAIL_FAILED",
                description: `Failed to send email: ${email.subject}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    templateId,
                    subject: email.subject,
                    to: vendor?.email || "unknown",
                    error: String(error)
                }
            });
            return;
        }

        // Log successful send to vendor_activities
        await db.collection("vendor_activities").add({
            vendorId,
            type: "EMAIL_SENT",
            description: `Email sent: ${email.subject}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                templateId,
                subject: email.subject,
                body: email.body,
                to: vendor?.email || "unknown",
                resendId // NEW: Track Resend email ID
            }
        });
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

/**
 * Send a raw email with optional attachments
 */
export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: any[]
): Promise<boolean> {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
            to,
            subject,
            html,
            attachments
        });

        if (error) {
            console.error('❌ Resend API error:', error);
            return false;
        }

        console.log(`✅ Email sent to ${to}: ${subject} (ID: ${data?.id})`);
        return true;
    } catch (err) {
        console.error('Error sending raw email:', err);
        return false;
    }
}
