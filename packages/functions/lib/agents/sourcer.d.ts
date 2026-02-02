export interface RawVendor {
    name: string;
    description: string;
    location: string;
    phone?: string;
    website?: string;
    source: string;
}
/**
 * Lead Sourcing Agent
 * Uses Serper.dev (Google Maps) to find vendors.
 *
 * Requires: process.env.SERPER_API_KEY
 */
export declare const searchVendors: (query: string, location: string) => Promise<RawVendor[]>;
//# sourceMappingURL=sourcer.d.ts.map