export interface Vendor {
    id: string; // Firestore Document ID
    companyName: string;
    specialty?: string; // e.g., 'Commercial Cleaning', 'HVAC'
    location?: string;
    phone?: string;
    email?: string;
    website?: string;
    businessType?: string; // e.g. 'Franchise', 'Small Business', 'Unknown'
    fitScore?: number; // 0-100
    aiScore?: number; // Alias for fitScore in some contexts
    status: 'SCRAPED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AI_AUTO_APPROVED' | 'CONTACTED' | 'NEGOTIATING' | 'CONTRACTED';
    outreachStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'REPLIED';
    outreachChannel?: 'SMS' | 'EMAIL' | 'NONE';
    outreachTime?: any;
    hasActiveContract?: boolean; // New field to tailor outreach
    createdAt: any;
    statusUpdatedAt?: any;
    telegramMessageId?: number; // For editing the message later
    aiReasoning?: string;

    // Onboarding State
    onboarding?: {
        status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISQUALIFIED';
        currentStep: 'WELCOME' | 'ENTITY_CHECK' | 'INSURANCE_CHECK' | 'DONE';
        disqualificationReason?: string;
        [key: string]: any;
    };
}

export interface OutreachEvent {
    vendorId: string;
    type: 'STATUS_CHANGE' | 'OUTREACH_QUEUED' | 'OUTREACH_SENT' | 'NOTE';
    description: string;
    metadata?: Record<string, any>;
    createdAt: any;
}

export interface RecruitmentAnalysisResult {
    analyzed: number;
    qualified: number;
    errors: string[];
}
