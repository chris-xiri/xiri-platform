/**
 * Email verification utilities
 */

interface EmailVerificationResult {
    valid: boolean;
    deliverable?: boolean;
    reason?: string;
}

/**
 * Verify email deliverability using DNS MX record lookup
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return { valid: false, reason: 'Invalid email format' };
    }

    // Extract domain
    const domain = email.split('@')[1];

    try {
        // Check if domain has MX records (indicates it can receive email)
        const mxRecords = await resolveMX(domain);

        if (mxRecords && mxRecords.length > 0) {
            return { valid: true, deliverable: true };
        } else {
            return { valid: true, deliverable: false, reason: 'No MX records found' };
        }
    } catch (error) {
        // DNS lookup failed - domain might not exist
        return { valid: true, deliverable: false, reason: 'Domain not found' };
    }
}

/**
 * Resolve MX records for a domain
 * Note: This uses Node.js dns module which is available in Cloud Functions
 */
async function resolveMX(domain: string): Promise<any[]> {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const resolveMx = promisify(dns.resolveMx);

    try {
        return await resolveMx(domain);
    } catch (error) {
        return [];
    }
}

/**
 * Check if email is a disposable/temporary email service
 */
export function isDisposableEmail(email: string): boolean {
    const disposableDomains = [
        'tempmail.com',
        'guerrillamail.com',
        '10minutemail.com',
        'mailinator.com',
        'throwaway.email',
        'temp-mail.org',
    ];

    const domain = email.split('@')[1].toLowerCase();
    return disposableDomains.includes(domain);
}

/**
 * Check if email is a role-based email (not a personal contact)
 */
export function isRoleBasedEmail(email: string): boolean {
    const roleBasedPrefixes = [
        'info', 'admin', 'support', 'sales', 'contact',
        'hello', 'help', 'noreply', 'no-reply', 'webmaster',
        'postmaster', 'hostmaster', 'abuse',
    ];

    const prefix = email.split('@')[0].toLowerCase();
    return roleBasedPrefixes.includes(prefix);
}
