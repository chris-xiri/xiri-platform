import type { NudgeSegment } from "@xiri/shared";

export const PSEO_BATCH_SIZE = 50;

export const PSEO_ROUTE_PREFIXES: Record<NudgeSegment, string[]> = {
    leads: ["/services/", "/industries/", "/guides/", "/compare/"],
    contractors: ["/contractors/"],
};

export const PSEO_DEPLOYABLE_FIELDS = {
    industries: new Set([
        "heroTitle",
        "heroSubtitle",
        "metaTitle",
        "metaDescription",
    ]),
    services: new Set([
        "heroTitle",
        "heroSubtitle",
        "shortDescription",
        "metaTitle",
        "metaDescription",
    ]),
    locations: new Set([
        "shortDescription",
        "localContext",
        "ctaText",
        "metaTitle",
        "metaDescription",
        "trustBadge",
        "proofStatement",
        "lastVerified",
    ]),
} as const;

export type PseoSkipReasonCode =
    | "expansion_queued"
    | "empty_value"
    | "unsupported_field"
    | "target_not_found";

export interface PseoSkipReason {
    nudgeId: string;
    code: PseoSkipReasonCode;
    message: string;
    targetSlug: string;
    targetField: string;
}

export function toPagePath(input: string): string {
    const candidate = (input || "").trim();
    if (!candidate) return "/";
    try {
        return new URL(candidate).pathname || "/";
    } catch {
        return candidate.startsWith("/") ? candidate : `/${candidate}`;
    }
}

export function normalizeTargetSlug(input: string): string {
    return toPagePath(input).replace(/^\/+/, "").replace(/\/+$/, "");
}

export function targetSlugToPath(targetSlug: string): string {
    return `/${normalizeTargetSlug(targetSlug)}`;
}

export function isPathInSegment(path: string, segment: NudgeSegment): boolean {
    const normalized = toPagePath(path);
    return PSEO_ROUTE_PREFIXES[segment].some((prefix) => normalized.startsWith(prefix));
}
