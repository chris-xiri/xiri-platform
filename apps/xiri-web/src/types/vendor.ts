export interface Vendor {
    id: string;
    companyName?: string;
    name?: string; // Fallback
    specialty?: string;
    location?: string;
    address?: string; // Fallback
    phone?: string;
    email?: string;
    website?: string;
    businessType?: string;
    fitScore?: number;
    aiScore?: number; // Fallback
    status?: string;
    hasActiveContract?: boolean;
    aiReasoning?: string;
    createdAt?: any;
    statusUpdatedAt?: any;
    rating?: number;
    totalRatings?: number;
    onboardingStep?: number;
    speedTrack?: boolean;
    qualification?: Record<string, boolean | null>;
    compliance?: {
        coi?: ComplianceDoc;
        w9?: ComplianceDoc;
    };
}

export interface ComplianceDoc {
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    url?: string;
    uploadedAt?: any;
    aiAnalysis?: {
        valid: boolean;
        reasoning: string;
        extracted?: Record<string, any>;
    };
}

export interface OutreachEvent {
    vendorId: string;
    type: 'STATUS_CHANGE' | 'OUTREACH_QUEUED' | 'OUTREACH_SENT' | 'NOTE';
    description: string;
    metadata?: Record<string, any>;
    createdAt: any;
}
