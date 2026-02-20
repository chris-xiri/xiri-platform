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

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'walkthrough' | 'proposal' | 'quoted' | 'won' | 'lost' | 'churned';

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

    // Operations linkage
    locations?: ClientLocation[];
    assignedFsmId?: string;
    contractId?: string;
    wonAt?: any;

    // Property Sourcing Enrichment (populated when attribution.source = 'property_sourcing')
    propertySourcing?: {
        sourceProvider: string;     // "attom", "reonomy", "mock"
        sourcePropertyId?: string;  // Provider's unique ID
        squareFootage?: number;
        yearBuilt?: number;
        ownerName?: string;
        tenantName?: string;
        tenantCount?: number;
        lastSalePrice?: number;
        lastSaleDate?: string;
        sourcedAt: Date;
    };

    // Sales Outreach Sequence
    outreachStatus?: 'PENDING' | 'SENT' | 'REPLIED' | 'NEEDS_MANUAL';
    outreachSentAt?: Date;

    // Sales → FSM Handoff (auto-set on first work order assignment)
    handedOffToFsm?: string;     // FSM staffId
    handoffDate?: Date;
}

export type VendorStatus =
    | 'PENDING_REVIEW'        // Legacy uppercase (deprecated)
    | 'pending_review'        // Sourced, not yet reviewed
    | 'QUALIFIED'             // Legacy uppercase (deprecated)
    | 'qualified'             // Approved, pipeline started
    | 'outreach_sent'         // Outreach email sent, awaiting delivery
    | 'awaiting_onboarding'   // Delivered, waiting for onboarding form
    | 'compliance_review'     // Form submitted, reviewing attestation
    | 'pending_verification'  // Docs uploaded, AI review in progress
    | 'onboarding_scheduled'  // Call booked (hand-holding path)
    | 'ready_for_assignment'  // Verified & compliant, no active job
    | 'active'                // Deployed to a client site
    | 'suspended'             // Temporary hold
    | 'dismissed'             // Unsubscribed / rejected / blacklisted
    | 'rejected';             // Legacy (use 'dismissed')

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
    onboardingCallTime?: string; // ISO date string for scheduled onboarding call
    campaignId?: string;

    // Contact Info
    contactName?: string;
    website?: string;
    websiteScreenshotUrl?: string; // For visual qualification
    address: string; // Full address (legacy/concatenated)
    streetAddress?: string; // Street only (new)
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
        salesTaxId?: string; // Vendor's Certificate of Authority / sales tax ID — required for ST-120.1
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

        // ACORD 25 (Single Upload)
        acord25?: ComplianceDoc & {
            extractedData?: AcordExtracted;
        };

        // ST-120.1 Exempt Purchase Certificate (XIRI holds this)
        st1201?: {
            issueDate: string;           // ISO date — when XIRI issued the cert to this vendor
            expiryDate: string;          // ISO date — 3 years from issueDate
            pdfUrl?: string;             // Firebase Storage URL of the generated PDF
            vendorSalesTaxId: string;    // The vendor's Certificate of Authority ID used on the form
            issuedBy?: string;           // Staff who triggered generation
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

    // Pipeline Scoring
    complianceScore?: number;  // 0-100
    complianceBreakdown?: {
        attestation: number;   // 0-50
        docsUploaded: number;  // 0-30
        docsVerified: number;  // 0-20
    };
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
    status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'FLAGGED' | 'MISSING';
    url?: string;
    uploadedAt?: any;
    verifiedAt?: any;
    aiAnalysis?: {
        valid: boolean;
        reasoning: string;
        extracted?: Record<string, any>;
    };
}

export interface AcordExtracted {
    insuredName?: string;
    glPerOccurrence?: number;   // e.g. 1000000
    glAggregate?: number;       // e.g. 2000000
    wcActive?: boolean;
    wcPolicyNumber?: string;
    autoActive?: boolean;
    expirationDates?: Array<{ policy: string; expires: string }>;
    certificateHolder?: string;
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

// --- INVOICING & ACCOUNTING ---

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export type PaymentMethod = 'ach' | 'check' | 'zelle' | 'venmo' | 'paypal' | 'wire' | 'credit_card' | 'cash' | 'other';

export interface InvoiceLineItem {
    workOrderId: string;
    locationName: string;
    locationAddress?: string;
    locationZip?: string;
    serviceType: string;
    frequency: string;
    amount: number;
    taxRate?: number;
    taxAmount?: number;
    taxExempt?: boolean;
}

export interface VendorPayout {
    vendorId: string;
    vendorName: string;
    workOrderId: string;
    serviceType: string;
    amount: number;
    status: 'pending' | 'approved' | 'paid';
    remittanceId?: string; // links to vendor_remittances doc
}

export interface Invoice {
    id?: string;
    leadId: string;
    clientBusinessName: string;
    clientEmail?: string;
    clientContactName?: string;
    contractId?: string;

    lineItems: InvoiceLineItem[];

    subtotal: number;
    totalTax?: number;
    adjustments?: number;
    totalAmount: number;       // subtotal + totalTax + adjustments

    vendorPayouts: VendorPayout[];
    totalPayouts: number;
    grossMargin: number;

    billingPeriod: { start: string; end: string };
    dueDate: any;

    sentAt?: any;
    paidAt?: any;
    paymentMethod?: PaymentMethod;
    paymentReference?: string; // check #, transaction ID, confirmation #
    paymentToken?: string;     // for public payment page: /invoice/pay/[token]

    status: InvoiceStatus;
    createdBy: string;
    createdAt: any;
    updatedAt: any;
}

// --- VENDOR REMITTANCE (auto-generated statement for vendors) ---

export type VendorRemittanceStatus = 'pending' | 'sent' | 'paid' | 'void';

export interface VendorRemittanceLineItem {
    workOrderId: string;
    locationName: string;
    locationAddress?: string;
    locationZip?: string;
    serviceType: string;
    serviceCategory?: 'janitorial' | 'specialized' | 'consumables' | 'exterior';
    frequency: string;
    amount: number; // vendorRate
    taxRate?: number;
    taxAmount?: number;
    taxExempt?: boolean;
    taxExemptCertificate?: string; // e.g. "ST-120.1"
}

export interface VendorRemittance {
    id?: string;
    invoiceId: string;         // parent client invoice
    vendorId: string;
    vendorName: string;
    vendorEmail?: string;

    lineItems: VendorRemittanceLineItem[];
    totalAmount: number;
    totalTax?: number;                 // tax on non-exempt items
    xiriAbsorbedTax?: number;          // tax Xiri pays when vendor has no exemption
    vendorTaxExemptionStatus?: 'none' | 'pending' | 'on_file';

    billingPeriod: { start: string; end: string };
    dueDate: any;

    sentAt?: any;
    paidAt?: any;
    paymentMethod?: PaymentMethod;
    paymentReference?: string;

    status: VendorRemittanceStatus;
    createdBy: string;
    createdAt: any;
    updatedAt: any;
}

// --- NIGHT MANAGER AUDITS ---

export interface CheckInTask {
    taskId: string;
    taskName: string;
    completed: boolean;
    photoUrl?: string;
    notes?: string;
}

export interface CheckIn {
    id?: string;
    workOrderId: string;
    locationName: string;
    serviceType: string;

    qrScannedAt: any;
    qrValid: boolean;

    tasksCompleted: CheckInTask[];
    completionRate: number; // 0-100

    auditScore: number; // 1-5
    auditNotes?: string;
    photoUrls?: string[];

    nightManagerId: string;
    nightManagerName: string;
    vendorId?: string;
    vendorName?: string;
    checkInDate: string; // YYYY-MM-DD

    createdAt: any;
}

// --- OPERATIONS BACKBONE ---

// Quotes
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuoteLineItem {
    id: string;
    locationId: string;
    locationName: string;
    locationAddress?: string;
    locationCity?: string;
    locationState?: string;
    locationZip?: string;
    serviceType: string;
    serviceCategory?: 'janitorial' | 'specialized' | 'consumables' | 'exterior';
    scopeTemplateId?: string;
    description?: string;
    frequency: 'one_time' | 'custom_days' | 'nightly' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    daysOfWeek?: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    monthlyPattern?: {
        type: 'day_of_month';    // e.g. "every 7th"
        day: number;             // 1-31
    } | {
        type: 'nth_weekday';     // e.g. "1st Monday"
        week: 1 | 2 | 3 | 4;    // which week
        dayOfWeek: number;       // 0=Sun, 1=Mon, ..., 6=Sat
    };
    clientRate: number;
    taxRate?: number;           // combined rate from zip lookup
    taxAmount?: number;         // clientRate * taxRate
    taxExempt?: boolean;        // manually override if exempt
    taxExemptReason?: string;   // e.g. "ST-120.1"
    isConsumable?: boolean;
    estimatedCost?: number; // Quoted cost; actualCost set later by FSM
    sqft?: number;
    serviceDate?: string;  // ISO date — start date (recurring) or service date (one-off)

    // Versioning & acceptance tracking
    lineItemStatus?: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'modified';
    acceptedInVersion?: number;  // which quote version this was accepted in
    cancelledInVersion?: number; // which version this was cancelled in
    modifiedInVersion?: number;  // which version this was modified in
    previousValues?: {           // snapshot before modification for audit trail
        frequency?: string;
        daysOfWeek?: boolean[];
        clientRate?: number;
        serviceDate?: string;
    };

    // Upsell attribution
    addedBy?: string;            // staffId who added this item
    addedByRole?: 'sales' | 'fsm'; // drives commission attribution
    isUpsell?: boolean;          // true if added after initial acceptance
}


export interface QuoteRevision {
    version: number;
    totalMonthlyRate: number;
    lineItems: QuoteLineItem[];
    changedBy: string;
    changedAt: any;
    notes?: string;
}

export interface Quote {
    id?: string;
    leadId: string;
    leadBusinessName: string;
    lineItems: QuoteLineItem[];
    totalMonthlyRate: number;
    oneTimeCharges?: number;
    subtotalBeforeTax?: number;
    totalTax?: number;

    contractTenure: number;
    paymentTerms: string;
    exitClause?: string;

    // Versioning
    version: number;
    revisionHistory?: QuoteRevision[];

    // Email flow
    reviewToken?: string;
    clientEmail?: string;
    sentAt?: any;
    viewedAt?: any;
    clientResponseAt?: any;
    clientResponseNotes?: string;

    // Assignment
    assignedFsmId?: string;
    assignedFsmName?: string;

    // Assignment & Commission
    assignedTo?: string;          // staffId who gets commission (defaults to createdBy)
    isUpsell?: boolean;           // true if created after Sales→FSM handoff
    originalQuoteId?: string;     // links upsell to original quote

    status: QuoteStatus;
    createdBy: string;
    expiresAt?: any;
    acceptedAt?: any;
    notes?: string;
    createdAt: any;
    updatedAt: any;
}


// Contracts
export type ContractStatus = 'draft' | 'sent' | 'active' | 'amended' | 'terminated' | 'expired';

export interface Contract {
    id?: string;
    leadId: string;
    quoteId: string;
    quoteIds?: string[];          // all quotes that contributed services

    clientBusinessName: string;
    clientAddress: string;
    signerName: string;
    signerTitle: string;

    lineItems?: QuoteLineItem[];  // aggregated accepted line items
    totalMonthlyRate: number;
    oneTimeCharges?: number;
    contractTenure: number;
    startDate: any;
    endDate: any;
    paymentTerms: string;
    exitClause: string;

    pdfUrl?: string;
    signedPdfUrl?: string;

    assignedFsmId?: string;
    status: ContractStatus;
    createdBy: string;
    signedAt?: any;
    createdAt: any;
    updatedAt: any;
}

// Work Orders
export type WorkOrderStatus =
    | 'pending_assignment'
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled';

export interface WorkOrderTask {
    id: string;
    name: string;
    description?: string;
    required: boolean;
    verifiedAt?: any;
    verifiedBy?: string;
}

export interface VendorAssignment {
    vendorId: string;
    vendorName: string;
    vendorRate: number;
    assignedAt: any;
    removedAt?: any;
    removalReason?: string;
}

export interface WorkOrder {
    id?: string;

    leadId: string;
    contractId: string;
    quoteLineItemId: string;
    locationId: string;
    locationName: string;
    locationAddress?: string;
    locationCity?: string;
    locationState?: string;
    locationZip?: string;

    serviceType: string;
    scopeTemplateId?: string;
    tasks: WorkOrderTask[];

    vendorId?: string;
    vendorRate?: number;
    vendorHistory: VendorAssignment[];

    schedule: {
        daysOfWeek: boolean[];
        startTime: string;
        endTime?: string;
        frequency: 'one_time' | 'custom_days' | 'nightly' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    };


    clientRate: number;
    margin?: number;

    status: WorkOrderStatus;
    assignedFsmId?: string;
    assignedBy?: string;
    notes?: string;
    createdAt: any;
    updatedAt: any;
}

// Scope Templates
export interface ScopeTemplateTask {
    name: string;
    description?: string;
    required: boolean;
}

export interface ScopeTemplate {
    id?: string;
    name: string;
    facilityType: FacilityType;
    tasks: ScopeTemplateTask[];
    defaultFrequency: 'nightly' | 'weekly' | 'biweekly' | 'monthly';
    defaultStartTime: string;
    createdAt: any;
}

// ─── FSM Site Visit System ─────────────────────────────
export interface AreaRating {
    area: string;
    rating: number; // 1-5
    notes?: string;
    photoUrl?: string;
}

export interface SiteVisitActionItem {
    id: string;
    description: string;
    assignedTo: 'vendor' | 'client' | 'xiri';
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'completed';
    dueDate?: string;
}

export interface SiteVisit {
    id?: string;
    workOrderId: string;
    contractId?: string;
    leadId: string;
    locationName: string;
    clientBusinessName: string;

    checkedInAt: any;
    checkedInMethod: 'qr' | 'gps' | 'manual';

    areaRatings: AreaRating[];
    overallCondition: number; // 1-5 average

    clientContactMade: boolean;
    clientContactName?: string;
    clientSatisfaction?: number; // 1-5
    clientFeedback?: string;

    upsellOpportunities?: string[];

    actionItems: SiteVisitActionItem[];

    fsmId: string;
    fsmName: string;
    visitDate: string; // YYYY-MM-DD
    isFirstVisit?: boolean;
    photoUrls?: string[];
    createdAt: any;
}

// --- TAX RATE UTILITIES ---
export { getTaxRate, calculateTax, isEligibleForST120, type TaxRate } from './taxRates';

// --- TAX CERTIFICATE SERVICE ---
// NOTE: TaxCertificateService uses Node.js 'fs' & 'path' — NOT safe for client-side bundling.
// Server-side only: import { generateST1201 } from '@xiri/shared/src/TaxCertificateService';
// Types re-exported below so they remain available without triggering module resolution.
// (Do NOT use `export type ... from './TaxCertificateService'` — webpack may still resolve the file.)

// --- PROPERTY SOURCING ---

/** Provider-agnostic, normalized property record returned by any data provider */
export interface RawProperty {
    name: string;              // Building or business name
    address: string;           // Full street address
    city: string;
    state: string;
    zip: string;
    propertyType?: string;     // "medical_office", "retail", "auto_dealership", etc.
    squareFootage?: number;
    yearBuilt?: number;
    ownerName?: string;        // Building owner (for outreach)
    ownerPhone?: string;
    ownerEmail?: string;
    tenantName?: string;       // Current occupant (if single-tenant)
    tenantCount?: number;      // 1 = single-tenant
    lotSize?: number;          // In sq ft or acres
    lastSalePrice?: number;
    lastSaleDate?: string;
    source: string;            // "attom", "reonomy", "mock", etc.
    sourceId?: string;         // Provider's unique property ID
    rawData?: Record<string, any>; // Full provider response for debugging
}

/** Extended property with UI-specific state for the sourcing campaign table */
export interface PreviewProperty extends RawProperty {
    id: string;                // Client-generated unique ID
    isDismissed?: boolean;
    fitScore?: number;         // AI-assessed fit (0-100)
    aiReasoning?: string;      // AI explanation of the fit score
    facilityType?: string;     // Mapped XIRI facility type
}


// --- COMMISSION & COMPENSATION ---

export type CommissionType = 'SALES_NEW' | 'FSM_UPSELL' | 'FSM_RETENTION';
export type CommissionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'PARTIALLY_CANCELLED';
export type PayoutStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface PayoutEntry {
    month: number;                // 0, 1, 2
    amount: number;
    percentage: number;           // 50, 25, 25
    status: PayoutStatus;
    scheduledAt: Date;
    paidAt?: Date;
}

export interface Commission {
    id?: string;
    staffId: string;              // Who earns the commission
    staffRole: 'sales' | 'fsm';
    quoteId: string;              // Source quote
    leadId: string;               // Related lead/client
    type: CommissionType;

    // Financial
    mrr: number;                  // Monthly Recurring Revenue (for tier calc)
    acv: number;                  // Annual Contract Value (mrr × 12 or face value)
    rate: number;                 // 0.10, 0.15, or 0.05
    totalCommission: number;      // acv × rate

    // Payout schedule (Sales: 50/25/25 over 3 months)
    payoutSchedule: PayoutEntry[];

    // Clawback (6-month window — cancel unpaid portions only)
    clawbackWindowEnd: Date;      // 6 months from quote acceptance
    status: CommissionStatus;

    createdAt: Date;
    updatedAt: Date;
}

export interface CommissionLedgerEntry {
    id?: string;
    commissionId: string;
    type: 'PAYOUT_SCHEDULED' | 'PAYOUT_PAID' | 'PAYOUT_CANCELLED' | 'CLAWBACK';
    amount: number;
    staffId: string;
    description: string;
    createdAt: Date;
}

// NRR (Net Revenue Retention) for FSM quarterly bonus
export interface NrrSnapshot {
    id?: string;
    fsmId: string;                // FSM staffId
    quarter: string;              // e.g. "2026-Q1"
    startingMrr: number;
    endingMrr: number;
    upsells: number;
    downgrades: number;
    churn: number;
    nrr: number;                  // (start + upsells - downgrades - churn) / start
    bonusRate: number;            // 0, 0.005, 0.01, 0.02
    bonusAmount: number;
    calculatedAt: Date;
}
