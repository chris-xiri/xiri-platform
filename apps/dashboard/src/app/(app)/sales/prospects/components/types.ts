/**
 * Shared types for the Prospect Queue feature.
 * Imported by both page.tsx and sub-components to avoid circular dependencies.
 */

export interface ProspectContact {
    email: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    confidence?: number;
    type: 'personal' | 'generic';
    provider: string;
}

export interface QueuedProspect {
    id: string;
    businessName: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    contactEmail?: string;
    genericEmail?: string;
    contactName?: string;
    contactTitle?: string;
    emailSource?: string;
    emailConfidence?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    enrichmentLog?: string[];
    allContacts?: ProspectContact[];
    facilityType?: string;
    status: string;
    batchDate: string;
    searchQuery: string;
    searchLocation: string;
    companyId?: string;
    contactId?: string;
    actionedAt?: any;
    createdAt?: any;
}

export interface ProspectingConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    enabled: boolean;
    excludePatterns: string[];
    dismissedRecommendations?: string[];
    lastRunAt?: any;
    lastRunStats?: {
        discovered: number;
        withEmail: number;
        added: number;
        duplicatesSkipped: number;
        queryYield?: Record<string, { discovered: number; qualified: number }>;
        locationYield?: Record<string, { discovered: number; qualified: number }>;
    };
}
