export type CleaningFrequency = "daily" | "weekdays" | "3x_week" | "2x_week" | "weekly" | "custom";

export interface RfpInput {
    facilityName?: string;
    picName?: string;
    picEmail?: string;
    zipCode?: string;
    facilityType: string;
    location: string;
    estimatedSqft: number;
    cleaningFrequency: CleaningFrequency;
    serviceWindow: string;
    requiredServices: string[];
    complianceRequirements: string[];
    slaRequirements: string[];
    transitionDate?: string;
    incumbentPainPoints: string[];
}

export interface AttachmentRequirement {
    key: string;
    label: string;
    required: boolean;
}

export interface ProposalSubmissionInstructions {
    submitToEmail: string;
    dueDate?: string;
    subjectFormat: string;
    requiredAttachments: AttachmentRequirement[];
}

export interface RfpLeadPayload {
    source: "janitorial_rfp_tool";
    idempotencyKey: string;
    requestedXiri?: boolean;
    facilityName?: string;
    facilityType: string;
    location: string;
    zipCode: string;
    estimatedSqft: number;
    serviceWindow: string;
    transitionDate?: string;
    picName: string;
    picEmail: string;
    scopeBrief?: string;
}

export interface VendorSubmission {
    vendorName: string;
    submittedAt: string;
    source: "email";
    response: {
        monthlyPrice?: number | null;
        staffingSummary?: string;
        qaReportingSummary?: string;
        complianceSummary?: string;
        transitionSummary?: string;
        assumptions?: string;
    };
    attachmentsReceived: Record<string, boolean>;
}

export interface RfpSection {
    id: string;
    title: string;
    body: string;
}

export interface RfpDocument {
    title: string;
    summary: string;
    sections: RfpSection[];
    generatedAt: string;
}

export interface BidRow {
    vendorName: string;
    monthlyPrice: number | null;
    scopeCompleteness: number;
    staffingPlanQuality: number;
    qaReportingQuality: number;
    complianceConfidence: number;
    transitionPlanQuality: number;
    notes?: string;
}

export interface BidExtractionCandidate {
    vendorName?: string;
    monthlyPrice?: number | string | null;
    scopeCompleteness?: number;
    staffingPlanQuality?: number;
    qaReportingQuality?: number;
    complianceConfidence?: number;
    transitionPlanQuality?: number;
    notes?: string;
}

export interface ScoreWeights {
    priceRealism: number;
    scopeCompleteness: number;
    staffingPlan: number;
    qaReporting: number;
    complianceDocs: number;
    transitionReadiness: number;
}

export interface ScoredBid {
    vendorName: string;
    totalScore: number;
    rank: number;
    rationale: string;
    missingCriticalItems: string[];
    raw: BidRow;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
    priceRealism: 20,
    scopeCompleteness: 20,
    staffingPlan: 15,
    qaReporting: 15,
    complianceDocs: 15,
    transitionReadiness: 15,
};

function clamp(value: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeScore(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return clamp(Math.round(value));
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string") {
        const parsed = Number(value.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
}

export function normalizeBidExtraction(candidate: BidExtractionCandidate): BidRow {
    return {
        vendorName: (candidate.vendorName || "Unknown Vendor").trim(),
        monthlyPrice: toNumber(candidate.monthlyPrice ?? null),
        scopeCompleteness: normalizeScore(candidate.scopeCompleteness),
        staffingPlanQuality: normalizeScore(candidate.staffingPlanQuality),
        qaReportingQuality: normalizeScore(candidate.qaReportingQuality),
        complianceConfidence: normalizeScore(candidate.complianceConfidence),
        transitionPlanQuality: normalizeScore(candidate.transitionPlanQuality),
        notes: candidate.notes?.trim() || undefined,
    };
}

function evaluatePriceRealism(current: BidRow, all: BidRow[]): number {
    const prices = all
        .map((b) => b.monthlyPrice)
        .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);

    if (typeof current.monthlyPrice !== "number" || prices.length < 2) return 50;
    const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
    const deltaPct = Math.abs(current.monthlyPrice - avg) / avg;
    if (deltaPct <= 0.1) return 95;
    if (deltaPct <= 0.2) return 80;
    if (deltaPct <= 0.35) return 60;
    return 35;
}

export function scoreBids(bids: BidRow[], weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): ScoredBid[] {
    if (bids.length === 0) return [];

    const scored = bids.map((bid) => {
        const priceRealism = evaluatePriceRealism(bid, bids);
        const total =
            priceRealism * weights.priceRealism +
            bid.scopeCompleteness * weights.scopeCompleteness +
            bid.staffingPlanQuality * weights.staffingPlan +
            bid.qaReportingQuality * weights.qaReporting +
            bid.complianceConfidence * weights.complianceDocs +
            bid.transitionPlanQuality * weights.transitionReadiness;

        const normalizedTotal = Math.round(total / 100);
        const missingCriticalItems: string[] = [];
        if (bid.complianceConfidence < 50) missingCriticalItems.push("Compliance documentation weak or missing");
        if (bid.transitionPlanQuality < 50) missingCriticalItems.push("Transition/takeover plan unclear");
        if (bid.scopeCompleteness < 60) missingCriticalItems.push("Scope appears incomplete");
        if (bid.monthlyPrice === null) missingCriticalItems.push("Pricing missing");

        const rationale =
            normalizedTotal >= 80
                ? "Strong operational fit with balanced pricing and execution confidence."
                : normalizedTotal >= 60
                    ? "Viable option, but review highlighted gaps before award."
                    : "Higher risk profile; requires substantial clarification.";

        return {
            vendorName: bid.vendorName,
            totalScore: normalizedTotal,
            rank: 0,
            rationale,
            missingCriticalItems,
            raw: bid,
        };
    });

    return scored
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((item, index) => ({ ...item, rank: index + 1 }));
}

function listToBullets(items: string[]): string {
    if (items.length === 0) return "- None specified";
    return items.map((item) => `- ${item}`).join("\n");
}

export function buildRfpDraft(input: RfpInput): RfpDocument {
    const title = `Janitorial Services RFP${input.facilityName ? ` - ${input.facilityName}` : ""}`;
    const summary = `Seeking a verified janitorial partner for ${input.location} (${input.estimatedSqft.toLocaleString()} sqft, ${input.facilityType}).`;

    const sections: RfpSection[] = [
        {
            id: "scope-overview",
            title: "Scope Overview",
            body: `Facility type: ${input.facilityType}\nLocation: ${input.location}\nEstimated square footage: ${input.estimatedSqft.toLocaleString()} sqft\nCleaning frequency: ${input.cleaningFrequency}\nService window: ${input.serviceWindow}`,
        },
        {
            id: "required-services",
            title: "Required Services",
            body: listToBullets(input.requiredServices),
        },
        {
            id: "compliance-sla",
            title: "Compliance and SLA Requirements",
            body: `${listToBullets(input.complianceRequirements)}\n\nSLA expectations:\n${listToBullets(input.slaRequirements)}`,
        },
        {
            id: "transition-takeover",
            title: "Transition and Takeover Expectations",
            body: `Target transition date: ${input.transitionDate || "TBD"}\nKnown incumbent pain points:\n${listToBullets(input.incumbentPainPoints)}\n\nVendors must provide a takeover plan with staffing continuity, QA cadence, and issue-escalation path.`,
        },
        {
            id: "submission-instructions",
            title: "Proposal Submission Instructions",
            body: `Submit proposals to: ${input.picEmail || "TBD"}\nAttention to: ${input.picName || "TBD"}\nService area ZIP: ${input.zipCode || "TBD"}\nDue date: ${input.transitionDate || "TBD"}\nSubject line format: RFP Response - ${input.facilityName || "Facility"} - [Vendor Name]\n\nRequired attachments:\n- Insurance COI\n- Business license/entity documentation\n- Sample QA report\n- Transition plan timeline\n- References`,
        },
    ];

    return {
        title,
        summary,
        sections,
        generatedAt: new Date().toISOString(),
    };
}
