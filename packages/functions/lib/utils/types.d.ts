export interface Vendor {
    id: string;
    companyName: string;
    specialty?: string;
    location?: string;
    phone?: string;
    email?: string;
    website?: string;
    businessType?: string;
    fitScore?: number;
    aiScore?: number;
    status: 'SCRAPED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AI_AUTO_APPROVED' | 'CONTACTED' | 'NEGOTIATING' | 'CONTRACTED';
    outreachStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'REPLIED';
    outreachChannel?: 'SMS' | 'EMAIL' | 'NONE';
    outreachTime?: any;
    hasActiveContract?: boolean;
    createdAt: any;
    statusUpdatedAt?: any;
    telegramMessageId?: number;
    aiReasoning?: string;
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
//# sourceMappingURL=types.d.ts.map