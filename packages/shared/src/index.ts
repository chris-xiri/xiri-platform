// --- SHARED DOMAIN TYPES ---

export type IndustryVertical = 'medical' | 'auto' | 'education' | 'general';

// The "Medical First" Facility List
export type FacilityType =
    | 'medical_urgent_care'      // High priority
    | 'medical_private'          // Aesthetic focus
    | 'medical_surgery'          // High margin/Terminal cleaning
    | 'medical_dialysis'
    | 'auto_dealer_showroom'
    | 'auto_service_center'
    | 'edu_daycare'
    | 'edu_private_school'
    | 'office_general'
    | 'fitness_gym'
    | 'other';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'walkthrough' | 'proposal' | 'won' | 'lost';

export interface Lead {
    id?: string;
    businessName: string;
    facilityType: FacilityType; // MUST use the enum above
    contactName: string;
    contactPhone: string;
    email: string;
    zipCode: string;

    // Growth Engine Attribution
    attribution: {
        source: string;        // e.g. "google", "linkedin"
        medium: string;        // e.g. "cpc", "qr_code"
        campaign: string;
        landingPage: string;
    };

    createdAt: Date;
    status: LeadStatus;
}

export type VendorStatus =
    | 'pending_review'      // New/Scraped
    | 'qualified'           // AI or Human verified fit
    | 'compliance_review'   // Collecting COI/W9
    | 'onboarding'          // Scheduling setup
    | 'active'              // Ready for jobs
    | 'suspended'           // Temporary hold
    | 'rejected';           // Not a fit

export interface Vendor {
    id?: string;
    businessName: string;
    status: VendorStatus;
    capabilities: IndustryVertical[];

    // AI & Recruiting Fields
    aiScore?: number;
    fitScore?: number;
    aiReasoning?: string;
    outreachStatus?: 'PENDING' | 'SENT' | 'NONE';

    // Campaign & Onboarding
    hasActiveContract?: boolean;
    onboardingTrack?: 'FAST_TRACK' | 'STANDARD';
    campaignId?: string;

    // Contact Info
    contactName?: string;
    website?: string;
    websiteScreenshotUrl?: string; // For visual qualification
    address: string; // Mapped from location
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    email?: string;

    // Structured Contacts (CRM)
    contacts?: VendorContact[];

    // Ratings (Legacy/External)
    rating?: number;
    totalRatings?: number;

    // Compliance
    compliance?: {
        insuranceExp?: Date;
        backgroundCheck?: boolean;
        hipaaTrained?: boolean;
        w9Collected?: boolean;

        // Detailed Compliance (Supply Engine)
        coi?: ComplianceDoc;
        w9?: ComplianceDoc;
    };

    // Legacy Fields (Optional)
    location?: string;
    specialty?: string;

    // Metadata
    createdAt?: any;
    updatedAt?: any;
    onboardingStep?: number;
    speedTrack?: boolean;
    qualification?: Record<string, boolean | null>;

    // Legacy / Agent Fields
    businessType?: string;
    onboarding?: {
        status: string;
        currentStep: string;
        disqualificationReason?: string;
        [key: string]: any;
    };
    description?: string; // Legacy or scraped description
    notes?: string;       // Internal Notes
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

// --- SEO & CONTENT ENGINE TYPES ---

export interface SeoLocation {
    slug: string;        // e.g. "garden-city-ny"
    name: string;        // e.g. "Garden City"
    state: string;       // e.g. "NY"
    region: string;      // e.g. "Nassau County"
    zipCodes: string[];  // e.g. ["11530"]

    // Hyper-Local Injection
    landmarks?: string[];    // e.g. ["Roosevelt Field Mall", "Adelphi University"]
    nearbyCities?: string[]; // e.g. ["Hempstead", "Mineola"] - For interlinking
}

export interface SeoService {
    slug: string;        // e.g. "medical-office-cleaning"
    targetFacilityType: FacilityType; // Mapped to the immutable FacilityType enum
    name: string;
    shortDescription: string;

    // Content Injection
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
    slug: string;          // e.g., "medical-offices"
    name: string;          // e.g., "Medical Offices"
    heroTitle: string;
    heroSubtitle: string;
    coreServices: string[];       // slugs of core services
    specializedServices: string[]; // slugs of add-on services

    // CRO & Content Fields
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

// --- BROKERAGE CORE (CRM) ---

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
    name: string; // e.g. "Garden City Branch"
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
    vendorId?: string; // Assigned vendor

    title: string; // e.g. "Nightly Cleaning"
    description: string;
    serviceDate: Date;
    status: JobStatus;

    // Financials
    clientRate: number; // What we charge
    vendorRate: number; // What we pay
    margin: number;     // clientRate - vendorRate

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

