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
    address?: string;      // Full address from Maps Autocomplete
    serviceInterest?: string; // e.g. "janitorial", "floor_care"
    preferredAuditTimes?: Date[]; // Array of 3 options
    notes?: string;

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
    | 'PENDING_REVIEW'        // New/Scraped (legacy uppercase)
    | 'pending_review'        // New/Scraped
    | 'QUALIFIED'             // AI or Human verified fit (legacy uppercase)
    | 'qualified'             // AI or Human verified fit
    | 'compliance_review'     // NEW: Form submitted, awaiting doc verification
    | 'onboarding_scheduled'  // NEW: Docs approved, intro call scheduled
    | 'ready_for_assignment'  // NEW: Call completed, ready for jobs
    | 'active'                // Ready for jobs / Working contracts
    | 'suspended'             // Temporary hold
    | 'rejected';             // Not a fit

export interface Vendor {
    id?: string;
    businessName: string;
    status: VendorStatus;
    capabilities: IndustryVertical[];

    // AI & Recruiting Fields
    aiScore?: number;
    fitScore?: number;
    aiReasoning?: string;
    outreachStatus?: 'PENDING' | 'SENT' | 'NONE' | 'ENRICHING' | 'NEEDS_CONTACT';
    preferredLanguage?: 'en' | 'es'; // 'en' (default) or 'es'

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
        // Legacy fields
        insuranceExp?: Date;
        backgroundCheck?: boolean;
        hipaaTrained?: boolean;
        w9Collected?: boolean;

        // Detailed Compliance (Supply Engine)
        coi?: ComplianceDoc;
        w9?: ComplianceDoc;

        // Onboarding Form Fields (New)
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

        // Document Upload URLs (Fast Track)
        uploadedDocs?: {
            coi?: string;        // Certificate of Insurance URL
            llc?: string;        // Business License/LLC URL
            w9?: string;         // W-9 Form URL
        };
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

// --- pSEO: PARTNER MARKETS ---

export type TradeType = 'janitorial' | 'hvac' | 'plumbing' | 'electrical' | 'landscaping' | 'snow_removal';

export interface PartnerMarket {
    slug: string; // e.g., "medical-cleaning-contracts-in-garden-city-nassau-ny"

    geography: {
        town: string;      // "Garden City"
        county: 'nassau' | 'suffolk' | 'queens';
        state: 'ny';
        zipCodes?: string[];
    };

    trade: TradeType;

    // Hyper-local context for AI content generation & credibility
    localContext: {
        corridor?: string; // e.g. "Medical Mile", "Northern Blvd"
        nearbyLandmarks?: string[]; // e.g. "Roosevelt Field Mall"
        painPoints?: string[]; // e.g. "High traffic inspections", "Salt damage in winter"
    };

    // Metadata
    metaTitle?: string;
    description?: string;

    // Localized Overrides (Optional)
    translations?: {
        es?: {
            metaTitle?: string;
            description?: string;
            hero: {
                headline: string;
                subheadline: string;
            };
            localContext: {
                corridor: string;
                painPoints: string[];
            }
        }
    }
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
    resendId?: string; // Resend email tracking ID
    error?: string; // For failed emails
}


export interface OnboardingAnalytics {
    vendorId: string;
    track: 'STANDARD' | 'FAST_TRACK';
    trackToggled?: boolean;

    steps: {
        step1_contact_info?: { startedAt: any; completedAt?: any };
        step2_business_info?: { startedAt: any; completedAt?: any };
        step3_compliance?: { startedAt: any; completedAt?: any };
        step4_submission?: { startedAt: any; completedAt?: any };
    };

    lastActiveStep?: string;
    abandonedAt?: any;
    completedAt?: any;

    createdAt: any;
    userAgent?: string;
    referrer?: string;
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

