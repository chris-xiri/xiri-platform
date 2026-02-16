interface EmailTemplate {
    subject: string;
    content: string;
    variables: string[];
}
/**
 * Fetch a template from Firestore
 */
export declare function getTemplate(templateId: string): Promise<EmailTemplate | null>;
/**
 * Replace variables in template content
 */
export declare function replaceVariables(content: string, variables: Record<string, string>): string;
/**
 * Generate personalized email using AI
 */
export declare function generatePersonalizedEmail(templateId: string, variables: Record<string, string>): Promise<{
    subject: string;
    body: string;
} | null>;
/**
 * Send templated email (mock for now)
 */
export declare function sendTemplatedEmail(vendorId: string, templateId: string, customVariables?: Record<string, string>): Promise<void>;
export {};
//# sourceMappingURL=emailUtils.d.ts.map