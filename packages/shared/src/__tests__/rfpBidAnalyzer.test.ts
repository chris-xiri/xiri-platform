import { describe, expect, it } from "vitest";
import {
    buildRfpDraft,
    normalizeBidExtraction,
    scoreBids,
    type BidExtractionCandidate,
    type BidRow,
} from "../rfp-bid-analyzer";

describe("rfp-bid-analyzer", () => {
    it("builds an rfp draft with core sections", () => {
        const draft = buildRfpDraft({
            facilityName: "Queens Medical Plaza",
            facilityType: "Medical / Clinic",
            location: "Queens, NY",
            estimatedSqft: 18000,
            cleaningFrequency: "weekdays",
            serviceWindow: "6pm-5am",
            requiredServices: ["Nightly janitorial", "Restroom disinfection", "Day porter"],
            complianceRequirements: ["OSHA BBP", "SDS binder"],
            slaRequirements: ["Issue response < 2 hours"],
            transitionDate: "2026-06-01",
            incumbentPainPoints: ["Missed restocks", "No proof-of-cleaning logs"],
        });

        expect(draft.title).toContain("Queens Medical Plaza");
        expect(draft.sections.length).toBeGreaterThanOrEqual(4);
        expect(draft.sections.some((s) => s.id === "transition-takeover")).toBe(true);
    });

    it("normalizes messy extraction candidate values", () => {
        const candidate: BidExtractionCandidate = {
            vendorName: "  Sparkle Ops  ",
            monthlyPrice: "$12,450/month",
            scopeCompleteness: 88.6,
            staffingPlanQuality: 74.2,
            qaReportingQuality: undefined,
            complianceConfidence: 67.4,
            transitionPlanQuality: 81.9,
        };
        const normalized = normalizeBidExtraction(candidate);
        expect(normalized.vendorName).toBe("Sparkle Ops");
        expect(normalized.monthlyPrice).toBe(12450);
        expect(normalized.qaReportingQuality).toBe(0);
    });

    it("scores and ranks bids deterministically with critical flags", () => {
        const bids: BidRow[] = [
            {
                vendorName: "Vendor A",
                monthlyPrice: 12000,
                scopeCompleteness: 88,
                staffingPlanQuality: 85,
                qaReportingQuality: 82,
                complianceConfidence: 90,
                transitionPlanQuality: 87,
            },
            {
                vendorName: "Vendor B",
                monthlyPrice: 7000,
                scopeCompleteness: 62,
                staffingPlanQuality: 58,
                qaReportingQuality: 61,
                complianceConfidence: 49,
                transitionPlanQuality: 43,
            },
        ];

        const scored = scoreBids(bids);
        expect(scored.length).toBe(2);
        expect(scored[0].rank).toBe(1);
        expect(scored[1].rank).toBe(2);
        expect(scored[1].missingCriticalItems.length).toBeGreaterThan(0);
    });
});
