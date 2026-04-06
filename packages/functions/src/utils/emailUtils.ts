import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resend } from 'resend';
import { getPrompt } from './promptUtils';

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
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => key in variables ? variables[key] : '');
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

        const FALLBACK = `You are a professional email writer for XIRI Facility Solutions.

Take this email template and personalize it while maintaining the core message:

Subject: {{templateSubject}}
Body:
{{templateBody}}

Variables to use:
{{variablesList}}

Instructions:
1. Replace all variables with the actual values
2. Make the tone warm and professional
3. Keep it concise (under 150 words)
4. Output ONLY the email in this format:
SUBJECT: [subject line]
BODY:
[email body]`;

        const prompt = await getPrompt('email_personalizer', FALLBACK, {
            templateSubject: template.subject,
            templateBody: template.content,
            variablesList: Object.entries(variables).map(([key, val]) => `- ${key}: ${val}`).join('\n'),
        });

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
 * Parse a raw US address string into structured components.
 * Handles formats like:
 * - "123 Main St, New Hyde Park, NY 11040"
 * - "123 Main St, New Hyde Park, NY"
 * - "New Hyde Park, NY 11040"
 */
export function parseAddress(raw?: string): {
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
} {
    const empty = { streetAddress: '', city: '', state: '', zip: '' };
    if (!raw || raw === 'Unknown') return empty;

    // Extract ZIP first
    const zipMatch = raw.match(/\b(\d{5})(-\d{4})?\b/);
    const zip = zipMatch ? zipMatch[1] : '';

    // Remove ZIP from string for easier parsing
    let cleaned = raw.replace(/\b\d{5}(-\d{4})?\b/, '').trim().replace(/,\s*$/, '');

    // Split by commas
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length >= 3) {
        // "123 Main St, New Hyde Park, NY"
        return {
            streetAddress: parts[0],
            city: parts[1],
            state: parts[2].replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase(),
            zip
        };
    } else if (parts.length === 2) {
        // Could be "123 Main St, New Hyde Park" or "New Hyde Park, NY"
        const stateMatch = parts[1].match(/^([A-Z]{2})\b/);
        if (stateMatch) {
            // "New Hyde Park, NY" — no street
            return { streetAddress: '', city: parts[0], state: stateMatch[1], zip };
        }
        // "123 Main St, New Hyde Park" — no state
        return { streetAddress: parts[0], city: parts[1], state: '', zip };
    } else if (parts.length === 1) {
        // Single string — try to extract state
        const stateMatch = parts[0].match(/\b([A-Z]{2})\b/);
        if (stateMatch) {
            const beforeState = parts[0].substring(0, parts[0].indexOf(stateMatch[1])).trim();
            return { streetAddress: '', city: beforeState, state: stateMatch[1], zip };
        }
        return { streetAddress: '', city: parts[0], state: '', zip };
    }

    return empty;
}

/**
 * Extract ZIP code from address string (legacy wrapper)
 */
function extractZipFromAddress(address?: string): string | null {
    return parseAddress(address).zip || null;
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
                from: 'XIRI Facility Solutions <onboarding@xiri.ai>',
                replyTo: 'chris@xiri.ai',
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
                from: 'XIRI Facility Solutions <onboarding@xiri.ai>',
                replyTo: 'chris@xiri.ai',
                resendId // NEW: Track Resend email ID
            }
        });
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

const FUNCTIONS_BASE_URL = 'https://us-central1-xiri-facility-solutions.cloudfunctions.net';

/* ─── Single source of truth for company email branding ──────── */
export const COMPANY_NAME = 'XIRI Group LLC';
export const COMPANY_ADDRESS = '418 Broadway, Ste N · Albany, NY 12207';
export const SERVICE_AREA = 'Serving Queens, Nassau & Suffolk Counties';
export const LOGO_URL = 'https://xiri.ai/logo-vertical.svg';

/**
 * Centered logo header for all outgoing emails.
 */
export function buildEmailHeader(): string {
    return `
<div style="text-align: center; padding: 24px 0 16px;">
    <img src="${LOGO_URL}" alt="XIRI Facility Solutions" style="height: 80px;" />
</div>`;
}

/** Signature config shape stored in Firestore: settings/emailSignature */
export interface EmailSignatureConfig {
    closing: string;
    name: string;
    title: string;
    email: string;
    phone: string;
}

/** Hardcoded fallback when Firestore doc doesn't exist yet */
const DEFAULT_SIGNATURE: EmailSignatureConfig = {
    closing: 'Best',
    name: 'Chris Leung',
    title: 'XIRI Facility Solutions',
    email: 'chris@xiri.ai',
    phone: '516-399-0350',
};

/**
 * Fetch email signature config from Firestore with hardcoded fallback.
 * Cached per cold-start (module-level variable).
 */
let _signatureCache: EmailSignatureConfig | null = null;
export async function getEmailSignatureConfig(): Promise<EmailSignatureConfig> {
    if (_signatureCache) return _signatureCache;
    try {
        const snap = await db.collection('settings').doc('emailSignature').get();
        if (snap.exists) {
            _signatureCache = { ...DEFAULT_SIGNATURE, ...(snap.data() as Partial<EmailSignatureConfig>) };
        } else {
            _signatureCache = DEFAULT_SIGNATURE;
        }
    } catch (err) {
        console.warn('⚠️ Failed to fetch email signature from Firestore, using fallback:', err);
        _signatureCache = DEFAULT_SIGNATURE;
    }
    return _signatureCache;
}

/** Clear the module-level cache (useful after admin updates) */
export function clearSignatureCache(): void {
    _signatureCache = null;
}

/**
 * Standard email signature block.
 * Auto-appended by sendEmail() and sendBatchEmails() before the footer.
 * Accepts an optional config (pre-fetched from Firestore); falls back to DEFAULT_SIGNATURE.
 */
export function buildEmailSignature(config?: EmailSignatureConfig): string {
    const c = config || DEFAULT_SIGNATURE;
    return `
<div style="margin-top: 28px; font-size: 14px; color: #1e293b; line-height: 1.6;">
    <p style="margin: 0;">${c.closing},</p>
    <p style="margin: 4px 0 0 0; font-weight: 600;">${c.name}  |  ${c.title}</p>
    <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">
        <a href="mailto:${c.email}" style="color: #64748b; text-decoration: none;">${c.email}</a>
        &nbsp;|&nbsp;
        <a href="tel:${c.phone.replace(/\D/g, '')}" style="color: #64748b; text-decoration: none;">${c.phone}</a>
    </p>
</div>`;
}

/**
 * Build a simple company footer (no unsubscribe link).
 * Use this in internal emails, reports, and templates that don't need CAN-SPAM.
 */
export function buildSimpleFooter(extraLine?: string): string {
    return `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
    <p style="margin: 0;">${SERVICE_AREA}</p>
    <p style="margin: 4px 0 0 0;">${COMPANY_NAME} · ${COMPANY_ADDRESS}</p>
    ${extraLine ? `<p style="margin: 4px 0 0 0;">${extraLine}</p>` : ''}
    <p style="margin: 8px 0 0 0;">
        <a href="mailto:chris@xiri.ai" style="color: #64748b; text-decoration: underline;">Contact Us</a>
    </p>
</div>`;
}

/**
 * Build CAN-SPAM compliant email footer with unsubscribe link.
 */
function buildEmailFooter(entityId?: string, entityType?: 'vendor' | 'lead'): string {
    if (!entityId || !entityType) return '';

    const unsubscribeUrl = `${FUNCTIONS_BASE_URL}/handleUnsubscribe?id=${entityId}&type=${entityType}`;

    return `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
    <p style="margin: 0;">${SERVICE_AREA}</p>
    <p style="margin: 4px 0 0 0;">${COMPANY_NAME} · ${COMPANY_ADDRESS}</p>
    <p style="margin: 8px 0 0 0;">
        <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="mailto:chris@xiri.ai" style="color: #64748b; text-decoration: underline;">Contact Us</a>
    </p>
</div>`;
}

/**
 * Send a raw email with optional attachments.
 * Returns { success, resendId } so callers can store the ID for webhook tracking.
 *
 * If entityId + entityType are provided, a CAN-SPAM unsubscribe footer is appended.
 */
export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: any[],
    from?: string,
    vendorId?: string,
    templateId?: string,
    entityType?: 'vendor' | 'lead',
): Promise<{ success: boolean; resendId?: string }> {
    try {
        // Determine entity ID for unsubscribe link
        const entityId = vendorId; // vendorId param is actually entityId (vendor or lead)
        const header = buildEmailHeader();
        const sigConfig = await getEmailSignatureConfig();
        const signature = buildEmailSignature(sigConfig);
        const footer = buildEmailFooter(entityId, entityType);
        const htmlWithFooter = header + html + signature + (footer || '');

        // Build tags array for webhook tracking
        const tags: { name: string; value: string }[] = [];
        if (vendorId) {
            // Tag with correct entity type for webhook resolution
            const tagName = entityType === 'lead' ? 'leadId' : 'vendorId';
            tags.push({ name: tagName, value: vendorId });
        }
        if (templateId) tags.push({ name: 'templateId', value: templateId });

        // Build Resend List-Unsubscribe header for one-click unsubscribe
        const headers: Record<string, string> = {};
        if (entityId && entityType) {
            const unsubscribeUrl = `${FUNCTIONS_BASE_URL}/handleUnsubscribe?id=${entityId}&type=${entityType}`;
            headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
            headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
        }

        const { data, error } = await resend.emails.send({
            from: from || 'XIRI Facility Solutions <onboarding@xiri.ai>',
            replyTo: 'chris@xiri.ai',
            to,
            subject,
            html: htmlWithFooter,
            attachments,
            headers,
            ...(tags.length > 0 ? { tags } : {}),
        });

        if (error) {
            console.error('❌ Resend API error:', error);
            return { success: false };
        }

        console.log(`✅ Email sent to ${to}: ${subject} (ID: ${data?.id})`);
        return { success: true, resendId: data?.id };
    } catch (err) {
        console.error('Error sending raw email:', err);
        return { success: false };
    }
}

/**
 * Send multiple emails in a single API call (Resend Batch API).
 * Accepts up to 100 emails per call. Avoids rate-limit issues (2 req/s on free tier).
 *
 * Returns an array of { id } for each sent email, or an error.
 */
export async function sendBatchEmails(
    emails: {
        to: string;
        subject: string;
        html: string;
        from?: string;
        replyTo?: string;
    }[]
): Promise<{ success: boolean; ids?: string[]; error?: string }> {
    if (emails.length === 0) return { success: true, ids: [] };

    try {
        const header = buildEmailHeader();
        const sigConfig = await getEmailSignatureConfig();
        const signature = buildEmailSignature(sigConfig);
        const payload = emails.map(e => ({
            from: e.from || 'XIRI Facility Solutions <reports@xiri.ai>',
            replyTo: e.replyTo || 'chris@xiri.ai',
            to: e.to,
            subject: e.subject,
            html: header + e.html + signature,
        }));

        const { data, error } = await resend.batch.send(payload);

        if (error) {
            console.error('❌ Batch send error:', error);
            return { success: false, error: (error as any).message || String(error) };
        }

        const ids = (data as any)?.data?.map((d: any) => d.id) || [];
        console.log(`✅ Batch sent ${emails.length} emails (IDs: ${ids.join(', ')})`);
        return { success: true, ids };
    } catch (err: any) {
        console.error('❌ Batch send error:', err);
        return { success: false, error: err.message };
    }
}
