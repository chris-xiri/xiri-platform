function cleanString(value: unknown, maxLen = 300): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLen);
}

function cleanNullableString(value: unknown, maxLen = 300): string | null {
    const cleaned = cleanString(value, maxLen);
    return cleaned || null;
}

function cleanPositiveInt(value: unknown, max = 10000): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 1) return null;
    return Math.min(rounded, max);
}

function cleanPagesVisited(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 200))
        .slice(0, 25);
}

function cleanLastTouch(raw: unknown): Record<string, any> | null {
    if (!raw || typeof raw !== "object") return null;
    const lt = raw as Record<string, unknown>;
    const cleaned: Record<string, any> = {
        source: cleanString(lt.source, 150) || undefined,
        medium: cleanString(lt.medium, 100) || undefined,
        campaign: cleanString(lt.campaign, 150) || undefined,
        term: cleanNullableString(lt.term, 200),
        content: cleanNullableString(lt.content, 200),
        referrer: cleanString(lt.referrer, 500) || undefined,
        referrerDomain: cleanNullableString(lt.referrerDomain, 150),
        landingPage: cleanString(lt.landingPage, 300) || undefined,
        aiEngine: cleanNullableString(lt.aiEngine, 100),
        channel: cleanString(lt.channel, 60) || undefined,
        searchQuery: cleanNullableString(lt.searchQuery, 200),
        gclid: cleanNullableString(lt.gclid, 150),
        gbraid: cleanNullableString(lt.gbraid, 150),
        wbraid: cleanNullableString(lt.wbraid, 150),
        msclkid: cleanNullableString(lt.msclkid, 150),
        fbclid: cleanNullableString(lt.fbclid, 150),
        liFatId: cleanNullableString(lt.liFatId, 150),
        timestamp: cleanString(lt.timestamp, 60) || undefined,
    };

    // Strip undefined values so Firestore writes stay clean
    Object.keys(cleaned).forEach((k) => {
        if (cleaned[k] === undefined) delete cleaned[k];
    });

    return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function normalizeAttribution(
    rawInput: unknown,
    fallbackFormSource = "direct",
    clarityTag?: string | null
) {
    const raw = (rawInput && typeof rawInput === "object") ? (rawInput as Record<string, unknown>) : {};
    const formSource = cleanString(raw.formSource, 150) || cleanString(fallbackFormSource, 150) || "direct";
    const pagesVisited = cleanPagesVisited(raw.pagesVisited);
    const channel = cleanString(raw.channel, 60) || (cleanString(raw.aiEngine, 100) ? "ai_search" : "direct");

    return {
        source: cleanString(raw.source, 150) || "direct",
        formSource,
        medium: cleanString(raw.medium, 100) || "direct",
        campaign: cleanString(raw.campaign, 150) || "",
        landingPage: cleanString(raw.landingPage, 300) || "/",
        conversionPage: cleanString(raw.conversionPage, 300) || cleanString(raw.landingPage, 300) || "/",
        referrer: cleanString(raw.referrer, 500) || "direct",
        referrerDomain: cleanNullableString(raw.referrerDomain, 150),
        aiEngine: cleanNullableString(raw.aiEngine, 100),
        channel,
        utmSource: cleanNullableString(raw.utmSource, 150),
        utmMedium: cleanNullableString(raw.utmMedium, 100),
        utmCampaign: cleanNullableString(raw.utmCampaign, 150),
        utmTerm: cleanNullableString(raw.utmTerm, 200),
        utmContent: cleanNullableString(raw.utmContent, 200),
        searchQuery: cleanNullableString(raw.searchQuery, 200) || cleanNullableString(raw.utmTerm, 200),
        gclid: cleanNullableString(raw.gclid, 150),
        gbraid: cleanNullableString(raw.gbraid, 150),
        wbraid: cleanNullableString(raw.wbraid, 150),
        msclkid: cleanNullableString(raw.msclkid, 150),
        fbclid: cleanNullableString(raw.fbclid, 150),
        liFatId: cleanNullableString(raw.liFatId, 150),
        pagesVisited,
        pageCount: cleanPositiveInt(raw.pageCount, 500) ?? (pagesVisited.length > 0 ? pagesVisited.length : null),
        visitCount: cleanPositiveInt(raw.visitCount, 1000) ?? 1,
        firstTouchAt: cleanNullableString(raw.firstTouchAt, 60),
        convertedAt: cleanNullableString(raw.convertedAt, 60) || new Date().toISOString(),
        deviceType: cleanNullableString(raw.deviceType, 30),
        browser: cleanNullableString(raw.browser, 50),
        os: cleanNullableString(raw.os, 50),
        timezone: cleanNullableString(raw.timezone, 80),
        screenResolution: cleanNullableString(raw.screenResolution, 40),
        clarityTag: cleanNullableString(clarityTag, 150) || cleanNullableString(raw.clarityTag, 150),
        lastTouch: cleanLastTouch(raw.lastTouch),
    };
}

const CHANNEL_LABELS: Record<string, string> = {
    paid_search: "Paid Search",
    organic_search: "Organic Search",
    ai_search: "AI Search",
    paid_social: "Paid Social",
    organic_social: "Organic Social",
    email: "Email",
    referral: "Referral",
    direct: "Direct",
    campaign: "Campaign",
    manual: "Manual",
};

export function formatAttributionSummary(
    attr?: Record<string, any> | null,
    fallback = "audit_wizard"
): string {
    if (!attr || typeof attr !== "object") return fallback;
    const channelLabel = attr.channel ? (CHANNEL_LABELS[attr.channel] || attr.channel) : "";
    const sourcePart = attr.aiEngine || attr.source || attr.referrerDomain || attr.formSource || fallback;
    const keyword = attr.searchQuery || attr.utmTerm;
    const page = attr.conversionPage || attr.landingPage;

    const parts: string[] = [];
    if (channelLabel) parts.push(channelLabel);
    if (sourcePart && sourcePart.toLowerCase() !== channelLabel.toLowerCase()) {
        parts.push(keyword ? `${sourcePart} ("${keyword}")` : sourcePart);
    } else if (keyword) {
        parts.push(`"${keyword}"`);
    }
    if (page) parts.push(page);

    return parts.join(" · ") || fallback;
}
