import { unstable_noStore as noStore } from 'next/cache';

// Mock types for the CRM
export interface LeadData {
    name: string;
    email: string;
    phone: string;
    companyName: string;
    service: string;
    location: string;
    message?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Mocks submitting a lead to the internal CRM.
 * In production, this would make a fetch() call to the XIRI internal API.
 */
export async function submitLead(data: LeadData): Promise<ApiResponse<{ id: string }>> {
    noStore(); // OPTIONAL: Prevent caching if this were a real GET request, but it's a POST usually.

    console.log('[MOCK CRM] Submitting lead:', data);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate basic validation
    if (!data.email || !data.phone) {
        return {
            success: false,
            error: 'Email and phone are required.',
        };
    }

    // Success response
    return {
        success: true,
        data: {
            id: `lead_${Math.random().toString(36).substr(2, 9)}`,
        },
    };
}

/**
 * Helper to fetch service details (simulating a database lookup)
 */
export async function getServiceDetails(slug: string) {
    // In a real app, this might fetch from an API. 
    // For now, we import the JSON directly in the server components that need it, 
    // but this function could abstract that if we move to a CMS.
    return null;
}
