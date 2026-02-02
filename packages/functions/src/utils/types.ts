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
    status: 'SCRAPED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AI_AUTO_APPROVED' | 'CONTACTED';
    outreachStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'REPLIED';
    outreachChannel?: 'SMS' | 'EMAIL' | 'NONE';
    outreachTime?: FirebaseFirestore.Timestamp | Date;
    hasActiveContract?: boolean; // New field to tailor outreach
    createdAt: FirebaseFirestore.Timestamp | Date; // Depending on where it's used
    telegramMessageId?: number; // For editing the message later
}

export interface RecruitmentAnalysisResult {
    analyzed: number;
    qualified: number;
    errors: string[];
}
