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
}

export interface OutreachEvent {
    vendorId: string;
    type: 'STATUS_CHANGE' | 'OUTREACH_QUEUED' | 'OUTREACH_SENT' | 'NOTE';
    description: string;
    metadata?: Record<string, any>;
    createdAt: any;
}
