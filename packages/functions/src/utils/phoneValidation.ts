/**
 * Phone number validation and formatting utilities
 */

interface PhoneVerificationResult {
    valid: boolean;
    formatted?: string;
    type?: 'mobile' | 'landline' | 'voip' | 'unknown';
    reason?: string;
}

/**
 * Validate and format US phone number
 */
export function validatePhone(phone: string): PhoneVerificationResult {
    // Extract digits only
    const digits = phone.replace(/\D/g, '');

    // Check length
    if (digits.length === 10) {
        // Valid 10-digit US number
        const formatted = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
        return {
            valid: true,
            formatted,
            type: determinePhoneType(digits),
        };
    } else if (digits.length === 11 && digits[0] === '1') {
        // Valid 11-digit US number with country code
        const formatted = `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
        return {
            valid: true,
            formatted,
            type: determinePhoneType(digits.substring(1)),
        };
    } else {
        return {
            valid: false,
            reason: `Invalid phone number length: ${digits.length} digits`,
        };
    }
}

/**
 * Determine phone type based on area code and prefix
 * Note: This is a simplified heuristic. For production, consider using a service like Twilio Lookup API
 */
function determinePhoneType(digits: string): 'mobile' | 'landline' | 'voip' | 'unknown' {
    const areaCode = digits.substring(0, 3);
    const prefix = digits.substring(3, 6);

    // Common VoIP area codes
    const voipAreaCodes = ['800', '888', '877', '866', '855', '844', '833'];
    if (voipAreaCodes.includes(areaCode)) {
        return 'voip';
    }

    // This is a simplified check - in reality, you'd need a comprehensive database
    // or use Twilio Lookup API for accurate mobile vs landline detection
    return 'unknown';
}

/**
 * Check if phone number is likely a valid business number
 */
export function isBusinessPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');

    // Toll-free numbers are typically business
    const tollFreeAreaCodes = ['800', '888', '877', '866', '855', '844', '833'];
    const areaCode = digits.substring(0, 3);

    return tollFreeAreaCodes.includes(areaCode);
}

/**
 * Format phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
    const result = validatePhone(phone);
    return result.formatted || phone;
}

/**
 * Format phone number for storage (E.164 format)
 */
export function formatPhoneForStorage(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) {
        return `+1${digits}`;
    } else if (digits.length === 11 && digits[0] === '1') {
        return `+${digits}`;
    }

    return phone; // Return original if can't format
}
