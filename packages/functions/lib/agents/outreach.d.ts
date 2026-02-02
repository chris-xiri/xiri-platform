import { Vendor } from '../utils/types';
/**
 * Main entry point for the Outreach Agent.
 * Triggered when a vendor is APPROVED.
 */
export declare const performOutreach: (vendorId: string) => Promise<void>;
/**
 * Generates Email Content using Gemini with Best Practices
 */
export declare function generateEmailContent(vendor: Vendor): Promise<{
    subject: string;
    body: string;
}>;
/**
 * Generates SMS Content using Gemini with Best Practices
 */
export declare function generateSMSContent(vendor: Vendor): Promise<string>;
//# sourceMappingURL=outreach.d.ts.map