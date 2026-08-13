
import { Vendor } from "@xiri-facility-solutions/shared";

export const getStatusColor = (status: Vendor['status'], outreachStatus?: string) => {
    switch (status) {
        case 'active':
            return "bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-600 dark:border-emerald-700";
        case 'rejected':
        case 'dismissed':
        case 'suspended':
            return "bg-red-600 text-white dark:bg-red-500/20 dark:text-red-400 border-red-600 dark:border-red-700";
        case 'qualified':
            return "bg-sky-600 text-white dark:bg-sky-500/20 dark:text-sky-400 border-sky-600 dark:border-sky-700";
        case 'outreach_sent':
        case 'awaiting_onboarding':
            return "bg-indigo-600 text-white dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-600 dark:border-indigo-700";
        case 'compliance_review':
            return "bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-400 border-amber-600 dark:border-amber-700";
        case 'pending_verification':
            return "bg-orange-600 text-white dark:bg-orange-500/20 dark:text-orange-400 border-orange-600 dark:border-orange-700";
        case 'onboarding_scheduled':
            return "bg-violet-600 text-white dark:bg-violet-500/20 dark:text-violet-400 border-violet-600 dark:border-violet-700";
        case 'ready_for_assignment':
            return "bg-teal-600 text-white dark:bg-teal-500/20 dark:text-teal-400 border-teal-600 dark:border-teal-700";
        case 'pending_review':
        default:
            if (outreachStatus === 'SENT') return "bg-indigo-600 text-white dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-600 dark:border-indigo-700";
            if (outreachStatus === 'NEEDS_CONTACT') return "bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-400 border-rose-600 dark:border-rose-700";
            if (outreachStatus === 'ENRICHING') return "bg-cyan-600 text-white dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-600 dark:border-cyan-700";
            if (outreachStatus === 'FAILED') return "bg-red-700 text-white dark:bg-red-600/20 dark:text-red-400 border-red-700 dark:border-red-800";
            if (outreachStatus === 'PROFILE_INCOMPLETE') return "bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-400 border-amber-600 dark:border-amber-700";
            return "bg-slate-500 text-white dark:bg-slate-500/20 dark:text-slate-400 border-slate-500 dark:border-slate-700";
    }
};

export const getScoreColor = (score?: number) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-700 dark:text-green-400 font-semibold";
    if (score >= 60) return "text-yellow-700 dark:text-yellow-400 font-semibold";
    return "text-red-700 dark:text-red-400 font-semibold";
};

export const getStatusLabel = (status: string, outreachStatus?: string) => {
    switch (status) {
        case 'pending_review':
            if (outreachStatus === 'NEEDS_CONTACT') return 'Needs Contact';
            if (outreachStatus === 'ENRICHING') return 'Enriching';
            if (outreachStatus === 'SENT') return 'Outreach Sent';
            if (outreachStatus === 'FAILED') return '⚠ Outreach Failed';
            if (outreachStatus === 'PROFILE_INCOMPLETE') return '⚠ Incomplete Profile';
            return 'Review';
        case 'qualified': return 'Qualified';
        case 'outreach_sent': return 'Outreach Sent';
        case 'awaiting_onboarding': return 'Awaiting Form';
        case 'compliance_review': return 'Compliance';
        case 'pending_verification': return 'Verifying Docs';
        case 'onboarding_scheduled': return 'Onboarding';
        case 'ready_for_assignment': return 'Ready';
        case 'active': return 'Active';
        case 'suspended': return 'Suspended';
        case 'rejected':
        case 'dismissed': return 'Dismissed';
        default: return status.replace(/_/g, ' ');
    }
};

/**
 * Title-case a capability string.
 * Handles underscores, hyphens, and camelCase:
 *   "janitorial"        → "Janitorial"
 *   "floor-care"        → "Floor Care"
 *   "post_construction" → "Post Construction"
 *   "HVAC"              → "HVAC"
 */
export const formatCapability = (cap: string): string => {
    if (!cap) return '';
    // If it's all uppercase and short (like HVAC), keep as-is
    if (cap === cap.toUpperCase() && cap.length <= 5) return cap;
    return cap
        .replace(/[_-]/g, ' ')          // underscores/hyphens → spaces
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → spaces
        .replace(/\b\w/g, c => c.toUpperCase()); // capitalize first letter of each word
};

export type VendorInsuranceState = 'BLOCKED' | 'FULLY_INSURED' | 'EXPIRED' | 'PENDING' | 'UNINSURED';

export interface InsuranceStatusInfo {
    state: VendorInsuranceState;
    label: string;
    badgeClass: string;
    icon: string;
    description: string;
    isFullyInsured: boolean;
    isExpired: boolean;
    isBlocked: boolean;
    expirationDate?: string;
}

export interface VendorDocRef {
    title: string;
    url: string;
    type: 'ACORD25' | 'COI' | 'WORKERS_COMP' | 'GENERAL_LIABILITY' | 'OTHER';
    uploadedAt?: string;
    status?: string;
}

/**
 * Extracts all valid insurance policy PDF/image URLs for a vendor across all Firestore fields.
 */
export function getVendorInsuranceDocs(vendor: Vendor): VendorDocRef[] {
    if (!vendor) return [];
    const docs: VendorDocRef[] = [];
    const seen = new Set<string>();

    const addDoc = (url: string | undefined, title: string, type: VendorDocRef['type'], uploadedAt?: string, status?: string) => {
        if (!url || typeof url !== 'string' || !url.startsWith('http') || seen.has(url)) return;
        seen.add(url);
        docs.push({ title, url, type, uploadedAt, status });
    };

    const comp = (vendor.compliance as any) || {};

    // 1. Primary ACORD 25 Document
    if (comp.acord25?.url) {
        addDoc(
            comp.acord25.url,
            comp.acord25.fileName || 'ACORD 25 Certificate of Insurance',
            'ACORD25',
            comp.acord25.uploadedAt?.toDate ? comp.acord25.uploadedAt.toDate().toISOString() : undefined,
            comp.acord25.status || 'VERIFIED'
        );
    }

    // 2. Compliance Document History Array
    if (Array.isArray(comp.documentsHistory)) {
        comp.documentsHistory.forEach((d: any, idx: number) => {
            addDoc(
                d.url,
                d.fileName || `Insurance Document #${comp.documentsHistory.length - idx}`,
                'COI',
                d.uploadedAt,
                d.status
            );
        });
    }

    // 3. Specific Coverage Policy URLs
    addDoc(comp.generalLiability?.policyUrl || comp.generalLiability?.url, 'General Liability Policy (COI)', 'GENERAL_LIABILITY');
    addDoc(comp.workersComp?.policyUrl || comp.workersComp?.url, 'Workers Comp Policy (COI)', 'WORKERS_COMP');
    addDoc(comp.autoInsurance?.policyUrl || comp.autoInsurance?.url, 'Auto Insurance Policy', 'OTHER');

    // 4. Standalone vendor level URL fields
    addDoc((vendor as any).coiUrl || (vendor as any).insuranceUrl || (vendor as any).coiFile, 'Certificate of Insurance (COI)', 'COI');

    // 5. Onboarding responses COI URL
    const ob = (vendor as any).onboardingAnswers || (vendor as any).onboarding || {};
    addDoc(ob.coiUrl || ob.insuranceUrl || ob.insuranceDocumentUrl, 'Onboarding COI Document', 'COI');

    // 6. Generic vendor.documents array or map
    const genericDocs = (vendor as any).documents;
    if (Array.isArray(genericDocs)) {
        genericDocs.forEach((d: any, idx: number) => {
            if (typeof d === 'string') {
                addDoc(d, `Document #${idx + 1}`, 'OTHER');
            } else if (d?.url) {
                addDoc(d.url, d.name || d.fileName || `Document #${idx + 1}`, 'OTHER', d.uploadedAt, d.status);
            }
        });
    }

    return docs;
}

/**
 * Derives comprehensive insurance compliance status for a vendor.
 * Categories:
 * - BLOCKED: Explicitly blocked or rejected/flagged ACORD 25
 * - EXPIRED: Formerly insured, but COI policy expiration date has passed
 * - FULLY_INSURED: Active, verified insurance coverage (Emerald Green)
 * - PENDING: COI uploaded and pending verification
 * - UNINSURED: No COI policy on file
 */
export function getInsuranceStatusInfo(vendor: Vendor): InsuranceStatusInfo {
    const isBlocked = (vendor as any).dispatchBlocked || 
                      (vendor.compliance as any)?.acord25?.status === 'FLAGGED' || 
                      (vendor.compliance as any)?.acord25?.status === 'REJECTED';

    if (isBlocked) {
        return {
            state: 'BLOCKED',
            label: '⛔ Blocked',
            badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
            icon: '⛔',
            description: 'Vendor is blocked from dispatch due to compliance issues.',
            isFullyInsured: false,
            isExpired: false,
            isBlocked: true
        };
    }

    const acord = (vendor.compliance as any)?.acord25;
    const acordStatus = (acord?.status || '').toUpperCase();
    const extracted = acord?.extractedData;
    const expirationDate = acord?.policyExpirationDate || extracted?.expirationDate || (vendor.compliance as any)?.policyExpirationDate;

    // Check expiration: status is EXPIRED or expirationDate is in the past
    let isExpired = acordStatus === 'EXPIRED';
    if (!isExpired && expirationDate) {
        const exp = new Date(expirationDate);
        if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
            isExpired = true;
        }
    }

    if (isExpired) {
        return {
            state: 'EXPIRED',
            label: '⚠️ Insurance Expired',
            badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-semibold',
            icon: '⚠️',
            description: 'Insurance policy has expired. Upload updated COI policy to reactivate to Fully Insured status.',
            isFullyInsured: false,
            isExpired: true,
            isBlocked: false,
            expirationDate
        };
    }

    // Check Fully Insured (Green)
    const glActive = extracted?.glActive ?? vendor.compliance?.generalLiability?.hasInsurance;
    const wcActive = extracted?.wcActive ?? vendor.compliance?.workersComp?.hasInsurance;
    const hasActiveCoverage = (glActive || wcActive) && acordStatus !== 'REJECTED' && acordStatus !== 'FLAGGED';

    if (hasActiveCoverage || acordStatus === 'VERIFIED') {
        return {
            state: 'FULLY_INSURED',
            label: '🛡️ Fully Insured',
            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-semibold',
            icon: '🛡️',
            description: 'Vendor has verified, active insurance coverage.',
            isFullyInsured: true,
            isExpired: false,
            isBlocked: false,
            expirationDate
        };
    }

    if (acordStatus === 'PENDING' || vendor.compliance?.status === 'compliance_review') {
        return {
            state: 'PENDING',
            label: '⏳ Insurance Pending',
            badgeClass: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
            icon: '⏳',
            description: 'Insurance document uploaded and pending verification.',
            isFullyInsured: false,
            isExpired: false,
            isBlocked: false
        };
    }

    return {
        state: 'UNINSURED',
        label: 'Uninsured',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: '📄',
        description: 'No active COI policy on file.',
        isFullyInsured: false,
        isExpired: false,
        isBlocked: false
    };
}

export interface PolicySummary {
    hasPolicy: boolean;
    glLimit: string;
    wcLimit: string;
    autoLimit: string;
    aggregateLimit: string;
    expirationDateStr: string;
    isExpired: boolean;
    insuredName: string;
    statusLabel: string;
    statusBadgeClass: string;
}

/**
 * Extracts policy limits ($1M GL, $1M WC, etc.) and expiration date from a vendor record.
 */
export function getInsurancePolicySummary(vendor: Vendor): PolicySummary {
    if (!vendor) {
        return {
            hasPolicy: false,
            glLimit: 'Not Specified',
            wcLimit: 'Not Specified',
            autoLimit: 'Not Specified',
            aggregateLimit: 'Not Specified',
            expirationDateStr: 'N/A',
            isExpired: false,
            insuredName: 'Unknown',
            statusLabel: 'No Policy',
            statusBadgeClass: 'bg-slate-100 text-slate-700'
        };
    }

    const comp = (vendor.compliance as any) || {};
    const acord = comp.acord25 || {};
    const extracted = acord.extractedData || {};

    const glLimit = extracted.glLimit || comp.generalLiability?.limit || comp.generalLiabilityLimit || '$1,000,000';
    const wcLimit = extracted.wcLimit || comp.workersComp?.limit || comp.workersCompLimit || '$1,000,000';
    const autoLimit = extracted.autoLimit || comp.autoInsurance?.limit || '$1,000,000';
    const aggregateLimit = extracted.aggregateLimit || comp.generalLiability?.aggregateLimit || '$2,000,000';

    const expDate = acord.policyExpirationDate || extracted.expirationDate || comp.policyExpirationDate || comp.generalLiability?.expirationDate || comp.workersComp?.expirationDate;

    let isExpired = (acord.status || '').toUpperCase() === 'EXPIRED';
    let expirationDateStr = 'On File';

    if (expDate) {
        const d = new Date(expDate);
        if (!isNaN(d.getTime())) {
            expirationDateStr = d.toLocaleDateString();
            if (d.getTime() < Date.now()) {
                isExpired = true;
            }
        }
    }

    const hasDoc = !!(acord.url || comp.coiUrl || (Array.isArray(comp.documentsHistory) && comp.documentsHistory.length > 0) || (vendor as any).coiUrl);

    let statusLabel = 'Active Policy';
    let statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';

    if (isExpired) {
        statusLabel = `Expired (${expirationDateStr})`;
        statusBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    } else if (hasDoc) {
        statusLabel = `Active (Expires ${expirationDateStr})`;
        statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
    }

    return {
        hasPolicy: hasDoc,
        glLimit,
        wcLimit,
        autoLimit,
        aggregateLimit,
        expirationDateStr,
        isExpired,
        insuredName: extracted.insuredName || vendor.businessName || 'Insured Vendor',
        statusLabel,
        statusBadgeClass
    };
}


