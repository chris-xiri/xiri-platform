
import { Vendor } from "@xiri/shared";

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
