export type IndustryVertical = 'medical' | 'auto' | 'education' | 'general';
export type FacilityType = 'medical_urgent_care' | 'medical_private' | 'medical_surgery' | 'medical_dialysis' | 'auto_dealer_showroom' | 'auto_service_center' | 'edu_daycare' | 'edu_private_school' | 'office_general' | 'fitness_gym' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'walkthrough' | 'proposal' | 'won' | 'lost';
export interface Lead {
    id?: string;
    businessName: string;
    facilityType: FacilityType;
    contactName: string;
    contactPhone: string;
    email: string;
    zipCode: string;
    attribution: {
        source: string;
        medium: string;
        campaign: string;
        landingPage: string;
    };
    createdAt: Date;
    status: LeadStatus;
}
export type VendorStatus = 'PENDING_REVIEW' | 'pending_review' | 'QUALIFIED' | 'qualified' | 'compliance_review' | 'onboarding_scheduled' | 'ready_for_assignment' | 'active' | 'suspended' | 'rejected';
export interface Vendor {
    id?: string;
    businessName: string;
    status: VendorStatus;
    capabilities: IndustryVertical[];
    aiScore?: number;
    fitScore?: number;
    aiReasoning?: string;
    outreachStatus?: 'PENDING' | 'SENT' | 'NONE';
    preferredLanguage?: 'en' | 'es';
    hasActiveContract?: boolean;
    onboardingTrack?: 'FAST_TRACK' | 'STANDARD';
    campaignId?: string;
    contactName?: string;
    website?: string;
    websiteScreenshotUrl?: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    email?: string;
    contacts?: VendorContact[];
    rating?: number;
    totalRatings?: number;
    compliance?: {
        insuranceExp?: Date;
        backgroundCheck?: boolean;
        hipaaTrained?: boolean;
        w9Collected?: boolean;
        coi?: ComplianceDoc;
        w9?: ComplianceDoc;
        hasBusinessEntity?: boolean;
        generalLiability?: {
            hasInsurance: boolean;
            verified: boolean;
        };
        workersComp?: {
            hasInsurance: boolean;
            verified: boolean;
        };
        autoInsurance?: {
            hasInsurance: boolean;
            verified: boolean;
        };
        additionalInsurance?: Array<{
            type: string;
            hasInsurance: boolean;
            verified: boolean;
        }>;
        uploadedDocs?: {
            coi?: string;
            llc?: string;
            w9?: string;
        };
    };
    location?: string;
    specialty?: string;
    createdAt?: any;
    updatedAt?: any;
    onboardingStep?: number;
    speedTrack?: boolean;
    qualification?: Record<string, boolean | null>;
    businessType?: string;
    onboarding?: {
        status: string;
        currentStep: string;
        disqualificationReason?: string;
        [key: string]: any;
    };
    description?: string;
    notes?: string;
}
export interface ComplianceDoc {
    status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MISSING';
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
    type: 'STATUS_CHANGE' | 'OUTREACH_QUEUED' | 'OUTREACH_SENT' | 'NOTE' | 'INBOUND_REPLY' | 'AI_REPLY';
    description: string;
    metadata?: Record<string, any>;
    createdAt: any;
}
export interface VendorActivityMetadata {
    templateId?: string;
    subject?: string;
    body?: string;
    to?: string;
    resendId?: string;
    error?: string;
}
export interface OnboardingAnalytics {
    vendorId: string;
    track: 'STANDARD' | 'FAST_TRACK';
    trackToggled?: boolean;
    steps: {
        step1_contact_info?: {
            startedAt: any;
            completedAt?: any;
        };
        step2_business_info?: {
            startedAt: any;
            completedAt?: any;
        };
        step3_compliance?: {
            startedAt: any;
            completedAt?: any;
        };
        step4_submission?: {
            startedAt: any;
            completedAt?: any;
        };
    };
    lastActiveStep?: string;
    abandonedAt?: any;
    completedAt?: any;
    createdAt: any;
    userAgent?: string;
    referrer?: string;
}
export interface SeoLocation {
    slug: string;
    name: string;
    state: string;
    region: string;
    zipCodes: string[];
    landmarks?: string[];
    nearbyCities?: string[];
}
export interface SeoService {
    slug: string;
    targetFacilityType: FacilityType;
    name: string;
    shortDescription: string;
    heroTitle?: string;
    heroSubtitle?: string;
    benefits: string[];
    valueProps?: {
        icon: string;
        title: string;
        description: string;
    }[];
    features?: {
        icon: string;
        title: string;
        description: string;
    }[];
    faqs?: {
        question: string;
        answer: string;
    }[];
}
export interface SeoIndustry {
    slug: string;
    name: string;
    heroTitle: string;
    heroSubtitle: string;
    coreServices: string[];
    specializedServices: string[];
    benefits?: {
        title: string;
        description: string;
        icon: string;
    }[];
    faqs?: {
        question: string;
        answer: string;
    }[];
}
export interface VendorContact {
    id: string;
    firstName: string;
    lastName: string;
    role: 'Owner' | 'Dispatch' | 'Billing' | 'Sales' | 'Other';
    phone?: string;
    email?: string;
}
export type JobStatus = 'draft' | 'posted' | 'assigned' | 'scheduled' | 'in_progress' | 'completed' | 'verified' | 'invoiced' | 'paid';
export interface Client {
    id: string;
    businessName: string;
    facilityType: FacilityType;
    status: 'active' | 'churned' | 'lead';
    billingAddress: string;
    primaryContact: {
        name: string;
        email: string;
        phone: string;
    };
    createdAt: any;
}
export interface ClientLocation {
    id: string;
    clientId: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    managerName?: string;
    managerPhone?: string;
}
export interface Job {
    id: string;
    clientId: string;
    locationId: string;
    vendorId?: string;
    title: string;
    description: string;
    serviceDate: Date;
    status: JobStatus;
    clientRate: number;
    vendorRate: number;
    margin: number;
    createdAt: any;
}
export interface Invoice {
    id: string;
    clientId: string;
    jobIds: string[];
    totalAmount: number;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    dueDate: Date;
    createdAt: any;
}
//# sourceMappingURL=index.d.ts.map