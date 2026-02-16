"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplate = getTemplate;
exports.replaceVariables = replaceVariables;
exports.generatePersonalizedEmail = generatePersonalizedEmail;
exports.sendTemplatedEmail = sendTemplatedEmail;
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const resend_1 = require("resend");
const db = admin.firestore();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
/**
 * Fetch a template from Firestore
 */
async function getTemplate(templateId) {
    try {
        const doc = await db.collection("templates").doc(templateId).get();
        if (!doc.exists) {
            console.error(`Template ${templateId} not found`);
            return null;
        }
        return doc.data();
    }
    catch (error) {
        console.error("Error fetching template:", error);
        return null;
    }
}
/**
 * Replace variables in template content
 */
function replaceVariables(content, variables) {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}
/**
 * Generate personalized email using AI
 */
async function generatePersonalizedEmail(templateId, variables) {
    try {
        const template = await getTemplate(templateId);
        if (!template)
            return null;
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
    }
    catch (error) {
        console.error("Error generating email:", error);
        return null;
    }
}
/**
 * Extract ZIP code from address string
 */
function extractZipFromAddress(address) {
    if (!address)
        return null;
    const zipMatch = address.match(/\b\d{5}\b/);
    return zipMatch ? zipMatch[0] : null;
}
/**
 * Send templated email (mock for now)
 */
async function sendTemplatedEmail(vendorId, templateId, customVariables) {
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
            vendorName: (vendor === null || vendor === void 0 ? void 0 : vendor.businessName) || "Vendor",
            zipCode: (vendor === null || vendor === void 0 ? void 0 : vendor.zipCode) || extractZipFromAddress(vendor === null || vendor === void 0 ? void 0 : vendor.address) || "your area",
            specialty: (vendor === null || vendor === void 0 ? void 0 : vendor.specialty) || "your trade",
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
        let resendId;
        try {
            const { data } = await resend.emails.send({
                from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
                to: (vendor === null || vendor === void 0 ? void 0 : vendor.email) || '',
                subject: email.subject,
                html: email.body,
            });
            resendId = data === null || data === void 0 ? void 0 : data.id;
            console.log(`✅ Email sent to ${vendor === null || vendor === void 0 ? void 0 : vendor.companyName}: ${email.subject} (Resend ID: ${data === null || data === void 0 ? void 0 : data.id})`);
        }
        catch (error) {
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
                    to: (vendor === null || vendor === void 0 ? void 0 : vendor.email) || "unknown",
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
                to: (vendor === null || vendor === void 0 ? void 0 : vendor.email) || "unknown",
                resendId // NEW: Track Resend email ID
            }
        });
    }
    catch (error) {
        console.error("Error sending email:", error);
    }
}
//# sourceMappingURL=emailUtils.js.map