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
    status: 'SCRAPED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AI_AUTO_APPROVED' | 'CONTACTED';
    outreachStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'REPLIED';
    outreachChannel?: 'SMS' | 'EMAIL' | 'NONE';
    outreachTime?: FirebaseFirestore.Timestamp | Date;
    hasActiveContract?: boolean;
    createdAt: FirebaseFirestore.Timestamp | Date;
    telegramMessageId?: number;
}
export interface RecruitmentAnalysisResult {
    analyzed: number;
    qualified: number;
    errors: string[];
}
//# sourceMappingURL=types.d.ts.map