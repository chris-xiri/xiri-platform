/**
 * ─── pSEO Recursive Engine — Shared Types ─────────────────────────────────────
 *
 * Types consumed by both the dashboard UI and Cloud Functions.
 * Defines the nudge lifecycle, batch metadata, and engine configuration.
 */

// ── Enums / Literal Unions ────────────────────────────────────────────────────

/** Which audience segment a nudge targets */
export type NudgeSegment = 'leads' | 'contractors';

/** Category of optimization */
export type NudgeScope = 'template' | 'instance' | 'expansion' | 'trust-refresh';

/** Impact tier — determines inbox sort order */
export type NudgePriority = 'critical' | 'high' | 'medium' | 'low';

/** Status lifecycle: pending → approved | rejected | deferred */
export type NudgeStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

/** The heuristic rule IDs that triggered the nudge */
export type HeuristicRuleId =
    | 'R01' // CTR < 2% at Position < 10
    | 'R02' // Position 11-20 with >100 impressions
    | 'R03' // Position > 20 with >500 impressions
    | 'R04' // Clicks declining MoM > 30%
    | 'R05' // Bounce rate > 70% + engagement < 30s
    | 'R06' // Scroll depth < 40% avg
    | 'R07' // High impressions, 0 clicks
    | 'R08' // Query exists, no page match
    | 'R09' // NFC sessions > 10/mo in a city
    | 'R10'; // Work orders completed > 5/mo, not on page

// ── Rule Metadata (for UI display) ───────────────────────────────────────────

export interface HeuristicRule {
    id: HeuristicRuleId;
    label: string;
    description: string;
    scope: NudgeScope;
    metricsUsed: string[];
}

export const HEURISTIC_RULES: HeuristicRule[] = [
    { id: 'R01', label: 'Low CTR at Good Position', description: 'CTR < 2% at Position < 10 — title/description isn\'t compelling', scope: 'template', metricsUsed: ['GSC CTR', 'GSC Position'] },
    { id: 'R02', label: 'Close to Page 1', description: 'Position 11-20 with >100 impressions — content quality gap', scope: 'instance', metricsUsed: ['GSC Position', 'GSC Impressions'] },
    { id: 'R03', label: 'Major Content Gap', description: 'Position > 20 with >500 impressions — wrong page or thin content', scope: 'template', metricsUsed: ['GSC Position', 'GSC Impressions'] },
    { id: 'R04', label: 'Traffic Decline', description: 'Clicks declining MoM > 30% — freshness issue', scope: 'trust-refresh', metricsUsed: ['GSC Clicks trend'] },
    { id: 'R05', label: 'High Bounce + Low Engagement', description: 'Bounce rate > 70% + engagement < 30s', scope: 'instance', metricsUsed: ['GA4 Bounce Rate', 'GA4 Engagement Time'] },
    { id: 'R06', label: 'Low Scroll Depth', description: 'Average scroll depth < 40% — content structure issue', scope: 'template', metricsUsed: ['GA4 Scroll Depth'] },
    { id: 'R07', label: 'Zero Clicks', description: 'High impressions but 0 clicks — wrong intent match', scope: 'template', metricsUsed: ['GSC Impressions', 'GSC CTR'] },
    { id: 'R08', label: 'Missing Page', description: 'Query exists with volume but no matching page', scope: 'expansion', metricsUsed: ['GSC Query mapping'] },
    { id: 'R09', label: 'NFC Trust Available', description: 'NFC sessions > 10/mo in a city — trust signal not on page', scope: 'trust-refresh', metricsUsed: ['NFC session data'] },
    { id: 'R10', label: 'Work Orders Not Surfaced', description: 'Work orders completed > 5/mo but not reflected in content', scope: 'trust-refresh', metricsUsed: ['Work order data'] },
];

// ── Nudge Data Points ────────────────────────────────────────────────────────

export interface NudgeDataPoints {
    // GSC metrics
    gscClicks?: number;
    gscImpressions?: number;
    gscCtr?: number;
    gscPosition?: number;
    gscClicksMoM?: number;         // Month-over-month change %
    queryCluster?: string[];       // Related search queries

    // GA4 engagement metrics
    bounceRate?: number;           // Page bounce rate %
    avgEngagementTime?: number;    // Seconds
    scrollDepth?: number;          // Avg scroll depth %

    // Competitive intelligence
    competitorGap?: string;

    // Trust moat signals
    nfcSessionsMonth?: number;     // NFC tap count this month
    workOrdersMonth?: number;      // Completed work orders this month
    trustSignal?: string;          // Formatted statement e.g. "147 verified cleanings this quarter"
}

// ── Core Nudge Interface ─────────────────────────────────────────────────────

export interface PseoNudge {
    id: string;
    segment: NudgeSegment;
    scope: NudgeScope;
    priority: NudgePriority;
    status: NudgeStatus;

    // What to change
    targetSlug: string;            // e.g. 'medical-office-cleaning' or 'medical-office-cleaning-in-garden-city-nassau-ny'
    targetField: string;           // e.g. 'heroTitle', 'shortDescription', 'faqs[2].answer'
    currentValue: string;          // Current content
    suggestedValue: string;        // Gemini-generated replacement

    // Why (rule-based detection evidence)
    reasoning: string;             // Human-readable explanation
    ruleTriggered: HeuristicRuleId; // Which heuristic rule fired
    dataPoints: NudgeDataPoints;

    // Metadata
    batchId: string;               // Weekly batch identifier (e.g. '2026-W15-leads')
    createdAt: any;                // Firestore Timestamp
    reviewedAt?: any;
    reviewedBy?: string;           // staffId of reviewer
    editedValue?: string;          // If the reviewer edited the suggestion before approving
    deployedAt?: any;
    prUrl?: string;                // GitHub PR URL once created
}

// ── Batch Metadata ───────────────────────────────────────────────────────────

export interface PseoBatch {
    id: string;                    // e.g. '2026-W15-leads'
    segment: NudgeSegment;
    weekId: string;                // e.g. '2026-W15'
    totalNudges: number;
    breakdown: Record<NudgeScope, number>;
    priorityBreakdown: Record<NudgePriority, number>;
    approvedCount: number;
    rejectedCount: number;
    deferredCount: number;
    pendingCount: number;
    createdAt: any;                // Firestore Timestamp
    completedAt?: any;             // When all nudges are reviewed
    gscDataRange?: {               // Date range of GSC data used
        startDate: string;         // YYYY-MM-DD
        endDate: string;
    };
    // Deployment tracking
    prUrl?: string;                // GitHub PR URL
    prNumber?: number;             // GitHub PR number
    deployedCount?: number;        // Nudges successfully applied to seo-data.json
    lastDeployedAt?: any;          // Firestore Timestamp
}

// ── Engine Configuration ─────────────────────────────────────────────────────

export interface PseoGscCredentials {
    accessToken: string;
    refreshToken: string;
    tokenExpiry: any;              // Firestore Timestamp
    siteUrl: string;               // e.g. 'sc-domain:xiri.ai'
    propertyId?: string;           // GA4 property ID e.g. 'properties/123456789'
    connectedAt: any;
    connectedBy: string;           // staffId
}

export interface PseoEngineConfig {
    enabled: boolean;
    batchSize: number;             // Default 50
    schedule: string;              // Cron expression, default 'every sunday 23:00'
    segments: NudgeSegment[];      // Which segments to run
    negativeKeywords: string[];    // Words to never include in suggestions
    maxFieldLengths: Record<string, number>; // e.g. { heroTitle: 70, shortDescription: 160 }
}

// ── Priority Scoring Helpers ─────────────────────────────────────────────────

export const PRIORITY_SORT_ORDER: Record<NudgePriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

export const SCOPE_LABELS: Record<NudgeScope, string> = {
    template: 'Template',
    instance: 'Instance',
    expansion: 'Expansion',
    'trust-refresh': 'Trust Refresh',
};

export const SCOPE_DESCRIPTIONS: Record<NudgeScope, string> = {
    template: 'Affects the shared template used across all pages for this service type — changes apply site-wide (e.g., meta title formula, hero copy pattern).',
    instance: 'Affects a single specific page — localized copy improvements for one city/service combination.',
    expansion: 'Identifies a gap where no page exists yet — suggests creating a new page to capture untapped search demand.',
    'trust-refresh': 'Updates operational proof points (NFC sessions, work orders, insurance) on pages where fresh trust data is available.',
};

export const SCOPE_COLORS: Record<NudgeScope, string> = {
    template: '#8B5CF6',        // Purple
    instance: '#3B82F6',        // Blue
    expansion: '#10B981',       // Green
    'trust-refresh': '#F59E0B', // Amber
};

export const PRIORITY_COLORS: Record<NudgePriority, string> = {
    critical: '#EF4444',        // Red
    high: '#F97316',            // Orange
    medium: '#EAB308',          // Yellow
    low: '#6B7280',             // Gray
};

export const STATUS_LABELS: Record<NudgeStatus, string> = {
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    deferred: 'Deferred',
};
