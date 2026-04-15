/**
 * ─── pSEO Analysis Engine ─────────────────────────────────────────────────────
 *
 * Weekly (+ manual "Run Now") analysis pipeline:
 *   1. Fetch GSC performance data for pSEO pages (28-day window)
 *   2. Fetch GA4 engagement metrics (bounce rate, engagement time)
 *   3. Fetch operational trust signals (NFC sessions, work orders)
 *   4. Run heuristic rules R01-R10 to detect optimization opportunities
 *   5. Generate Gemini Flash copy suggestions for each nudge
 *   6. Write a capped 50-nudge batch to Firestore for inbox review
 *
 * Pattern: Same core pipeline function called by both onSchedule and onCall.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../utils/firebase";
import { getValidAccessToken } from "../functions/pseoAuth";
import { DASHBOARD_CORS } from "../utils/cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
    NudgeSegment, NudgeScope, NudgePriority, HeuristicRuleId,
    NudgeDataPoints, PseoNudge, PseoBatch,
} from "@xiri/shared";
import { PSEO_BATCH_SIZE, isPathInSegment, normalizeTargetSlug, targetSlugToPath } from "../pseo/config";

// ── Constants ────────────────────────────────────────────────────────────────

const GSC_SITE_URL = "https://xiri.ai/"; // URL-prefix property (OAuth tokens see this, not sc-domain:)
const GA4_PROPERTY_ID = "properties/468338270"; // Xiri GA4 property

// Commenting about scope targets for documentation purposes
// Fields per scope: template → metaTitle/metaDescription/heroTitle/heroSubtitle
// instance → shortDescription/localContext/ctaText
// expansion → newPage
// trust-refresh → trustBadge/proofStatement/lastVerified


// ── Types ────────────────────────────────────────────────────────────────────

interface GscRow {
    keys: string[]; // [page, query]
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

interface PageMetrics {
    page: string;
    slug: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    clicksPrior?: number; // Prior period for MoM
    queries: string[];
    // GA4
    bounceRate?: number;
    avgEngagementTime?: number;
    scrollDepth?: number;
    // Trust
    nfcSessionsMonth?: number;
    workOrdersMonth?: number;
}

interface DetectedNudge {
    ruleId: HeuristicRuleId;
    scope: NudgeScope;
    priority: NudgePriority;
    targetSlug: string;
    targetField: string;
    reasoning: string;
    dataPoints: NudgeDataPoints;
    currentValue: string;
}

interface RunStatus {
    running: boolean;
    segment: NudgeSegment;
    phase: string;
    pagesAnalyzed: number;
    nudgesDetected: number;
    startedAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    error?: string;
    reliability?: Record<string, any>;
}

type RuleCounter = Record<HeuristicRuleId, number>;

interface HeuristicObservability {
    triggered: RuleCounter;
    notTriggered: RuleCounter;
    dataUnavailable: RuleCounter;
}

function initRuleCounter(): RuleCounter {
    return {
        R01: 0,
        R02: 0,
        R03: 0,
        R04: 0,
        R05: 0,
        R06: 0,
        R07: 0,
        R08: 0,
        R09: 0,
        R10: 0,
    };
}

function initHeuristicObservability(): HeuristicObservability {
    return {
        triggered: initRuleCounter(),
        notTriggered: initRuleCounter(),
        dataUnavailable: initRuleCounter(),
    };
}

// ── GSC Data Fetching ────────────────────────────────────────────────────────

async function fetchGscData(
    accessToken: string,
    segment: NudgeSegment,
    startDate: string,
    endDate: string,
): Promise<GscRow[]> {
    const allRows: GscRow[] = [];
    let startRow = 0;
    const ROW_LIMIT = 25000;

    while (true) {
        const response = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    dimensions: ["page", "query"],
                    rowLimit: ROW_LIMIT,
                    startRow,
                    dataState: "final",
                }),
            }
        );

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`GSC API error ${response.status}: ${text}`);
        }

        const data = await response.json();
        const rows = (data.rows || []) as GscRow[];

        if (rows.length === 0) break;
        // Filter to only pSEO segment pages
        const filteredRows = rows.filter((r) => {
            try {
                const path = new URL(r.keys[0]).pathname;
                return isPathInSegment(path, segment);
            } catch {
                return false;
            }
        });

        allRows.push(...filteredRows);
        startRow += rows.length;

        // GSC API stops returning at some point
        if (rows.length < ROW_LIMIT) break;
    }

    logger.info(`[pSEO] Fetched ${allRows.length} GSC rows for segment "${segment}" (${startDate} → ${endDate})`);
    return allRows;
}

// ── Aggregate GSC rows into per-page metrics ────────────────────────────────

function aggregateByPage(rows: GscRow[]): Map<string, PageMetrics> {
    const map = new Map<string, PageMetrics>();

    for (const row of rows) {
        const page = row.keys[0];
        const queryTerm = row.keys[1];

        let pm = map.get(page);
        if (!pm) {
            let slug = page;
            try { slug = normalizeTargetSlug(new URL(page).pathname); } catch { slug = normalizeTargetSlug(page); }
            pm = {
                page,
                slug,
                clicks: 0,
                impressions: 0,
                ctr: 0,
                position: 0,
                queries: [],
            };
            map.set(page, pm);
        }

        pm.clicks += row.clicks;
        pm.impressions += row.impressions;
        if (queryTerm && !pm.queries.includes(queryTerm)) {
            pm.queries.push(queryTerm);
        }
    }

    // Compute weighted averages for ctr and position
    for (const pm of map.values()) {
        if (pm.impressions > 0) {
            pm.ctr = pm.clicks / pm.impressions;
        }

        // Weighted position from per-query rows
        let posSum = 0;
        let impSum = 0;
        for (const row of rows) {
            if (row.keys[0] === pm.page) {
                posSum += row.position * row.impressions;
                impSum += row.impressions;
            }
        }
        pm.position = impSum > 0 ? posSum / impSum : 0;
    }

    return map;
}

// ── GA4 Data Fetching ────────────────────────────────────────────────────────

async function fetchGa4Engagement(
    accessToken: string,
    pages: string[],
    startDate: string,
    endDate: string,
): Promise<Map<string, { bounceRate: number; avgEngagementTime: number; scrollDepth?: number }>> {
    const result = new Map<string, { bounceRate: number; avgEngagementTime: number; scrollDepth?: number }>();

    if (pages.length === 0) return result;

    try {
        const response = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/${GA4_PROPERTY_ID}:runReport`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    dateRanges: [{ startDate, endDate }],
                    dimensions: [{ name: "pagePath" }],
                    metrics: [
                        { name: "bounceRate" },
                        { name: "averageSessionDuration" },
                        { name: "screenPageViews" },
                    ],
                    dimensionFilter: {
                        filter: {
                            fieldName: "pagePath",
                            inListFilter: {
                                values: pages.map(p => {
                                    try { return new URL(p).pathname; } catch { return p; }
                                }),
                            },
                        },
                    },
                    limit: 10000,
                }),
            }
        );

        if (!response.ok) {
            logger.warn(`[pSEO] GA4 API error: ${response.status}`);
            return result;
        }

        const data = await response.json();

        for (const row of data.rows || []) {
            const pagePath = row.dimensionValues?.[0]?.value;
            const bounceRate = parseFloat(row.metricValues?.[0]?.value || "0") * 100;
            const avgEngagementTime = parseFloat(row.metricValues?.[1]?.value || "0");

            if (pagePath) {
                // Match back to full URL
                const matchPage = pages.find(p => {
                    try { return new URL(p).pathname === pagePath; } catch { return false; }
                });
                if (matchPage) {
                    result.set(matchPage, { bounceRate, avgEngagementTime });
                }
            }
        }
    } catch (err: any) {
        logger.warn("[pSEO] GA4 fetch failed (non-critical):", err.message);
    }

    return result;
}

// ── Trust Signal Fetching ────────────────────────────────────────────────────

async function fetchTrustSignals(): Promise<Map<string, { nfc: number; wo: number }>> {
    const result = new Map<string, { nfc: number; wo: number }>();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
        // NFC sessions by city (from nfc_sessions collection)
        const nfcSnap = await db.collection("nfc_sessions")
            .where("completedAt", ">=", thirtyDaysAgo)
            .get();

        const nfcByCity = new Map<string, number>();
        for (const doc of nfcSnap.docs) {
            const data = doc.data();
            const city = (data.city || data.locationCity || "").toLowerCase().trim();
            if (city) {
                nfcByCity.set(city, (nfcByCity.get(city) || 0) + 1);
            }
        }

        // Work orders by city
        const woSnap = await db.collection("work_orders")
            .where("status", "==", "completed")
            .where("completedAt", ">=", thirtyDaysAgo)
            .get();

        const woByCity = new Map<string, number>();
        for (const doc of woSnap.docs) {
            const data = doc.data();
            const city = (data.city || data.locationCity || "").toLowerCase().trim();
            if (city) {
                woByCity.set(city, (woByCity.get(city) || 0) + 1);
            }
        }

        // Merge by city
        const allCities = new Set([...nfcByCity.keys(), ...woByCity.keys()]);
        for (const city of allCities) {
            result.set(city, {
                nfc: nfcByCity.get(city) || 0,
                wo: woByCity.get(city) || 0,
            });
        }
    } catch (err: any) {
        logger.warn("[pSEO] Trust signal fetch failed (non-critical):", err.message);
    }

    logger.info(`[pSEO] Trust signals loaded for ${result.size} cities`);
    return result;
}

/** Fetched meta for a live page */
interface LivePageMeta {
    title: string;
    description: string;
    h1: string;
}

/**
 * Fetch the actual live meta title, description, and H1 from the rendered page.
 * This reads what Google actually sees, not a formula reconstruction.
 */
async function fetchLivePageMeta(slugs: string[]): Promise<Map<string, LivePageMeta>> {
    const result = new Map<string, LivePageMeta>();
    const CONCURRENCY = 5;
    const BASE_URL = "https://xiri.ai/"; // slug already includes "services/" prefix

    // Process in batches to avoid hammering the server
    for (let i = 0; i < slugs.length; i += CONCURRENCY) {
        const batch = slugs.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (slug) => {
            try {
                const res = await fetch(`${BASE_URL}${slug}`, {
                    headers: { "User-Agent": "XiriPseoBot/1.0" },
                    signal: AbortSignal.timeout(8000),
                });
                if (!res.ok) {
                    logger.warn(`[pSEO] Failed to fetch page for ${slug}: HTTP ${res.status}`);
                    return;
                }
                const html = await res.text();

                // Extract <title> ([\s\S]*? handles multiline/nested content)
                const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

                // Extract <meta name="description" content="...">
                const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
                    || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
                const description = descMatch ? descMatch[1].trim() : "";

                // Extract first <h1> (handle inline elements like <span> inside h1)
                const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

                result.set(slug, { title, description, h1 });
            } catch (err: any) {
                logger.warn(`[pSEO] Page fetch failed for ${slug}: ${err.message}`);
            }
        });
        await Promise.all(promises);
    }

    logger.info(`[pSEO] Fetched live meta for ${result.size}/${slugs.length} pages`);
    return result;
}

/** Map a targetField to the corresponding live meta field */
function getLiveValueForField(meta: LivePageMeta | undefined, field: string): string {
    if (!meta) return "[could not fetch live page]";
    switch (field) {
        case "metaTitle": return meta.title;
        case "metaDescription": return meta.description;
        case "heroTitle": return meta.h1;
        case "heroSubtitle": return "[live heroSubtitle extraction not supported]";
        default: return "";
    }
}

/** Try to extract city name from a pSEO slug like "medical-cleaning-in-garden-city-nassau-ny" */
function extractCityFromSlug(slug: string): string | null {
    const inMatch = slug.match(/-in-([\w-]+)$/);
    if (!inMatch) return null;

    const tail = inMatch[1]; // "garden-city-nassau-ny"
    // Remove county-state suffix: pattern is {city}-{county}-{state}
    const parts = tail.split("-");
    if (parts.length >= 3) {
        // Last part is state (ny), second-to-last is county
        // City is everything before county-state
        // Heuristic: known counties
        const counties = ["nassau", "suffolk", "queens", "kings", "bronx", "westchester"];
        for (let i = parts.length - 2; i >= 1; i--) {
            if (counties.includes(parts[i])) {
                return parts.slice(0, i).join(" ");
            }
        }
    }
    // Fallback: take all but last 2 parts (county-state)
    if (parts.length >= 3) {
        return parts.slice(0, -2).join(" ");
    }
    return tail.replace(/-/g, " ");
}

// ── Heuristic Detection Engine ───────────────────────────────────────────────

function runHeuristics(
    metrics: PageMetrics,
    trustSignals: Map<string, { nfc: number; wo: number }>,
    segment: NudgeSegment,
    observability?: HeuristicObservability,
): DetectedNudge[] {
    const nudges: DetectedNudge[] = [];
    const slug = metrics.slug;
    const city = extractCityFromSlug(slug);
    const trust = city ? trustSignals.get(city) : undefined;

    // ── Data points shared by all nudges for this page
    const baseDataPoints: NudgeDataPoints = {
        gscClicks: metrics.clicks,
        gscImpressions: metrics.impressions,
        gscCtr: metrics.ctr,
        gscPosition: metrics.position,
        bounceRate: metrics.bounceRate,
        avgEngagementTime: metrics.avgEngagementTime,
        scrollDepth: metrics.scrollDepth,
        queryCluster: metrics.queries.slice(0, 10),
        nfcSessionsMonth: trust?.nfc,
        workOrdersMonth: trust?.wo,
    };

    // R01: CTR < 2% at Position < 10 → meta title/desc not compelling
    if (metrics.position < 10 && metrics.ctr < 0.02 && metrics.impressions > 50) {
        observability && (observability.triggered.R01 += 1);
        nudges.push({
            ruleId: "R01",
            scope: "template",
            priority: "critical",
            targetSlug: slug,
            targetField: "metaTitle",
            reasoning: `Position ${metrics.position.toFixed(1)} but only ${(metrics.ctr * 100).toFixed(1)}% CTR — title/description not converting impressions to clicks`,
            dataPoints: baseDataPoints,
            currentValue: "",
        });
    } else {
        observability && (observability.notTriggered.R01 += 1);
    }

    // R02: Position 11-20 with >100 impressions → close to page 1
    if (metrics.position >= 11 && metrics.position <= 20 && metrics.impressions > 100) {
        observability && (observability.triggered.R02 += 1);
        nudges.push({
            ruleId: "R02",
            scope: "instance",
            priority: "high",
            targetSlug: slug,
            targetField: "shortDescription",
            reasoning: `Position ${metrics.position.toFixed(1)} with ${metrics.impressions} impressions — strengthening local content could push to page 1`,
            dataPoints: baseDataPoints,
            currentValue: "",
        });
    } else {
        observability && (observability.notTriggered.R02 += 1);
    }

    // R03: Position > 20 with >500 impressions → major gap
    if (metrics.position > 20 && metrics.impressions > 500) {
        observability && (observability.triggered.R03 += 1);
        nudges.push({
            ruleId: "R03",
            scope: "template",
            priority: "high",
            targetSlug: slug,
            targetField: "heroTitle",
            reasoning: `Position ${metrics.position.toFixed(1)} despite ${metrics.impressions} impressions — page content significantly misaligned with search intent`,
            dataPoints: baseDataPoints,
            currentValue: "",
        });
    } else {
        observability && (observability.notTriggered.R03 += 1);
    }

    // R04: Clicks declining MoM > 30%
    if (metrics.clicksPrior && metrics.clicksPrior > 10) {
        const decline = (metrics.clicksPrior - metrics.clicks) / metrics.clicksPrior;
        if (decline > 0.30) {
            observability && (observability.triggered.R04 += 1);
            nudges.push({
                ruleId: "R04",
                scope: "trust-refresh",
                priority: "high",
                targetSlug: slug,
                targetField: "lastVerified",
                reasoning: `Clicks dropped ${(decline * 100).toFixed(0)}% month-over-month (${metrics.clicksPrior} → ${metrics.clicks}) — content may be stale`,
                dataPoints: { ...baseDataPoints, gscClicksMoM: -decline },
                currentValue: "",
            });
        } else {
            observability && (observability.notTriggered.R04 += 1);
        }
    } else {
        observability && (observability.dataUnavailable.R04 += 1);
    }

    // R05: Bounce rate > 70% + engagement < 30s
    if (metrics.bounceRate != null && metrics.avgEngagementTime != null) {
        if (metrics.bounceRate > 70 && metrics.avgEngagementTime < 30) {
            observability && (observability.triggered.R05 += 1);
            nudges.push({
                ruleId: "R05",
                scope: "instance",
                priority: "high",
                targetSlug: slug,
                targetField: "ctaText",
                reasoning: `${metrics.bounceRate.toFixed(0)}% bounce rate with only ${metrics.avgEngagementTime.toFixed(0)}s engagement — visitors leaving immediately`,
                dataPoints: baseDataPoints,
                currentValue: "",
            });
        } else {
            observability && (observability.notTriggered.R05 += 1);
        }
    } else {
        observability && (observability.dataUnavailable.R05 += 1);
    }

    // R06: Scroll depth < 40%
    if (metrics.scrollDepth != null && metrics.scrollDepth < 40 && metrics.impressions > 30) {
        observability && (observability.triggered.R06 += 1);
        nudges.push({
            ruleId: "R06",
            scope: "template",
            priority: "medium",
            targetSlug: slug,
            targetField: "heroSubtitle",
            reasoning: `Average scroll depth only ${metrics.scrollDepth.toFixed(0)}% — above-the-fold content not engaging enough to scroll`,
            dataPoints: baseDataPoints,
            currentValue: "",
        });
    } else if (metrics.scrollDepth == null) {
        observability && (observability.dataUnavailable.R06 += 1);
    } else {
        observability && (observability.notTriggered.R06 += 1);
    }

    // R07: High impressions, 0 clicks
    if (metrics.impressions > 200 && metrics.clicks === 0) {
        observability && (observability.triggered.R07 += 1);
        nudges.push({
            ruleId: "R07",
            scope: "template",
            priority: "critical",
            targetSlug: slug,
            targetField: "metaDescription",
            reasoning: `${metrics.impressions} impressions but zero clicks — wrong intent match or terrible snippet`,
            dataPoints: baseDataPoints,
            currentValue: "",
        });
    } else {
        observability && (observability.notTriggered.R07 += 1);
    }

    // R09: NFC sessions > 10/mo in a city → trust signal not on page
    if (trust && trust.nfc > 10) {
        observability && (observability.triggered.R09 += 1);
        nudges.push({
            ruleId: "R09",
            scope: "trust-refresh",
            priority: "medium",
            targetSlug: slug,
            targetField: "trustBadge",
            reasoning: `${trust.nfc} verified NFC check-ins this month in ${city} — operational proof not surfaced on page`,
            dataPoints: {
                ...baseDataPoints,
                trustSignal: `${trust.nfc} verified cleaning sessions this month`,
            },
            currentValue: "",
        });
    } else if (!trust) {
        observability && (observability.dataUnavailable.R09 += 1);
    } else {
        observability && (observability.notTriggered.R09 += 1);
    }

    // R10: Work orders > 5/mo, not reflected in content
    if (trust && trust.wo > 5) {
        observability && (observability.triggered.R10 += 1);
        nudges.push({
            ruleId: "R10",
            scope: "trust-refresh",
            priority: "medium",
            targetSlug: slug,
            targetField: "proofStatement",
            reasoning: `${trust.wo} completed work orders this month in ${city} — operational data not reflected in content`,
            dataPoints: {
                ...baseDataPoints,
                trustSignal: `${trust.wo} work orders completed this month in ${city}`,
            },
            currentValue: "",
        });
    } else if (!trust) {
        observability && (observability.dataUnavailable.R10 += 1);
    } else {
        observability && (observability.notTriggered.R10 += 1);
    }

    return nudges;
}

// ── R08: Query-level expansion detection (cross-page) ────────────────────────

function detectExpansionOpportunities(
    rows: GscRow[],
    existingPages: Set<string>,
    segment: NudgeSegment,
    observability?: HeuristicObservability,
): DetectedNudge[] {
    const nudges: DetectedNudge[] = [];

    // Group queries not matching any existing page
    const queryImpressions = new Map<string, { impressions: number; clicks: number; position: number }>();

    for (const row of rows) {
        const q = row.keys[1];
        if (!q) continue;
        const current = queryImpressions.get(q) || { impressions: 0, clicks: 0, position: 0 };
        current.impressions += row.impressions;
        current.clicks += row.clicks;
        // Weighted position
        current.position = current.impressions > 0
            ? (current.position * (current.impressions - row.impressions) + row.position * row.impressions) / current.impressions
            : row.position;
        queryImpressions.set(q, current);
    }

    // Find high-impression queries that don't have a dedicated page
    for (const [queryTerm, stats] of queryImpressions) {
        if (stats.impressions < 100) continue;

        // Check if query suggests a location not currently served
        const locationMatch = queryTerm.match(/in\s+([\w\s]+)$/i);
        if (locationMatch) {
            const location = locationMatch[1].toLowerCase().trim();
            // Check if we have a page for this location
            const hasPage = Array.from(existingPages).some(p =>
                p.toLowerCase().includes(location.replace(/\s+/g, "-"))
            );
            if (!hasPage) {
                observability && (observability.triggered.R08 += 1);
                nudges.push({
                    ruleId: "R08",
                    scope: "expansion",
                    priority: stats.impressions > 500 ? "high" : "medium",
                    targetSlug: `new-${segment}-page-${location.replace(/\s+/g, "-")}`,
                    targetField: "newPage",
                    reasoning: `Query "${queryTerm}" has ${stats.impressions} impressions but no dedicated page exists for "${location}"`,
                    dataPoints: {
                        gscImpressions: stats.impressions,
                        gscClicks: stats.clicks,
                        gscPosition: stats.position,
                        queryCluster: [queryTerm],
                    },
                    currentValue: "",
                });
            } else {
                observability && (observability.notTriggered.R08 += 1);
            }
        } else {
            observability && (observability.dataUnavailable.R08 += 1);
        }
    }

    return nudges;
}

// ── Dedup: Fetch existing pending nudges to avoid duplicates ─────────────────

interface PendingNudgeKey { slug: string; field: string }

async function fetchExistingPendingNudges(): Promise<Set<string>> {
    const snap = await db.collection("pseo_nudges")
        .where("status", "==", "pending")
        .select("targetSlug", "targetField")
        .get();

    const keys = new Set<string>();
    for (const doc of snap.docs) {
        const d = doc.data();
        const slug = normalizeTargetSlug(d.targetSlug || "");
        const field = String(d.targetField || "").trim();
        keys.add(`${slug}::${field}`);
    }
    logger.info(`[pSEO] Found ${keys.size} existing pending nudges for dedup`);
    return keys;
}

function deduplicateNudges(
    nudges: DetectedNudge[],
    existingKeys: Set<string>,
): { filtered: DetectedNudge[]; removed: number } {
    const before = nudges.length;
    const filtered = nudges.filter((n) => {
        const slug = normalizeTargetSlug(n.targetSlug);
        const field = String(n.targetField || "").trim();
        return !existingKeys.has(`${slug}::${field}`);
    });
    const removed = before - filtered.length;
    if (removed > 0) {
        logger.info(`[pSEO] Dedup removed ${removed} nudges (already pending in inbox)`);
    }
    return { filtered, removed };
}

// ── Cross-Page Learning: Extract winning patterns from approved nudges ───────

interface WinningPattern {
    field: string;
    before: string;
    after: string;
    slug: string;
}

async function fetchWinningPatterns(segment: NudgeSegment): Promise<WinningPattern[]> {
    // Query recently approved nudges (last 90 days) to find patterns that were accepted
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const snap = await db.collection("pseo_nudges")
        .where("status", "==", "approved")
        .where("segment", "==", segment)
        .where("createdAt", ">=", ninetyDaysAgo)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

    const patterns: WinningPattern[] = [];
    for (const doc of snap.docs) {
        const d = doc.data();
        if (d.suggestedValue && d.currentValue && d.currentValue !== "[could not fetch live page]") {
            patterns.push({
                field: d.targetField,
                before: d.currentValue,
                after: d.suggestedValue,
                slug: d.targetSlug,
            });
        }
    }
    logger.info(`[pSEO] Found ${patterns.length} winning patterns from approved nudges`);
    return patterns;
}

// ── Top Performer Benchmarking: Learn from pages with high CTR ──────────────

interface TopPerformer {
    slug: string;
    ctr: number;
    position: number;
    impressions: number;
    clicks: number;
    title: string;
    description: string;
}

/**
 * Extract the top-performing pages from current GSC data.
 * A "top performer" is a page that's earning higher-than-expected CTR
 * given its position — meaning its title/description copy is working.
 */
function identifyTopPerformers(
    pages: Map<string, PageMetrics>,
    liveMetaMap: Map<string, { title: string; description: string; h1: string }>,
): TopPerformer[] {
    // Expected CTR benchmarks by position bucket (from industry data)
    const expectedCtr: Record<string, number> = {
        "1-3": 0.08,    // positions 1-3 → expect ~8% CTR
        "4-6": 0.04,    // positions 4-6 → expect ~4% CTR
        "7-10": 0.02,   // positions 7-10 → expect ~2% CTR
        "11-20": 0.01,  // positions 11-20 → expect ~1% CTR
    };

    function getExpectedCtr(pos: number): number {
        if (pos <= 3) return expectedCtr["1-3"];
        if (pos <= 6) return expectedCtr["4-6"];
        if (pos <= 10) return expectedCtr["7-10"];
        if (pos <= 20) return expectedCtr["11-20"];
        return 0.005;
    }

    const candidates: TopPerformer[] = [];

    for (const [, pm] of pages) {
        // Only consider pages with meaningful traffic
        if (pm.impressions < 30 || pm.clicks < 3) continue;

        const expected = getExpectedCtr(pm.position);
        const overperformRatio = pm.ctr / expected;

        // Page CTR is 1.5x or higher than expected for its position = outperformer
        if (overperformRatio >= 1.5) {
            const meta = liveMetaMap.get(pm.slug);
            const title = meta?.title || "";
            const desc = meta?.description || "";

            // Only include if we actually have the title to learn from
            if (title && title !== "[could not fetch live page]") {
                candidates.push({
                    slug: pm.slug,
                    ctr: pm.ctr,
                    position: pm.position,
                    impressions: pm.impressions,
                    clicks: pm.clicks,
                    title,
                    description: desc,
                });
            }
        }
    }

    // Sort by CTR overperformance and take top 10
    candidates.sort((a, b) => b.ctr - a.ctr);
    const top = candidates.slice(0, 10);
    logger.info(`[pSEO] Identified ${top.length} top-performing pages (high CTR vs position benchmark)`);
    return top;
}

// ── Gemini Copy Generation ───────────────────────────────────────────────────

async function generateCopySuggestion(
    nudge: DetectedNudge,
    segment: NudgeSegment,
    winningPatterns: WinningPattern[] = [],
    topPerformers: TopPerformer[] = [],
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return `[GEMINI_API_KEY not configured — manual suggestion needed for ${nudge.targetField}]`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const audienceContext = segment === "leads"
        ? "facility managers, office managers, and property managers evaluating commercial cleaning partners. They are B2B decision-makers who prioritize compliance documentation, verified quality, and operational reliability over price."
        : "independent janitorial contractors and cleaning company owners seeking commercial cleaning contracts and subcontracting opportunities in the Long Island/NYC market.";

    const trustContext = nudge.dataPoints.trustSignal
        ? `\nTRUST SIGNAL: ${nudge.dataPoints.trustSignal} — weave this verified operational data naturally into the copy as social proof.`
        : "";

    const fieldLengths: Record<string, number> = {
        metaTitle: 60,
        metaDescription: 155,
        heroTitle: 70,
        heroSubtitle: 120,
        shortDescription: 200,
        ctaText: 50,
        trustBadge: 80,
        proofStatement: 150,
        localContext: 200,
    };

    const maxLength = fieldLengths[nudge.targetField] || 160;

    // Extract location and service from slug for context
    const slugParts = nudge.targetSlug.match(/^(.+)-in-(.+)$/);
    const serviceFromSlug = slugParts ? slugParts[1].replace(/-/g, " ") : nudge.targetSlug.replace(/-/g, " ");
    const locationFromSlug = slugParts ? slugParts[2].replace(/-/g, " ").replace(/ ny$/, ", NY") : "";

    // Determine search intent from query cluster
    const queries = nudge.dataPoints.queryCluster || [];
    const intentSignals: string[] = [];
    if (queries.some((q: string) => /near me|in |around/.test(q))) intentSignals.push("local-intent");
    if (queries.some((q: string) => /cost|price|quote|estimate|how much/.test(q))) intentSignals.push("transactional");
    if (queries.some((q: string) => /best|top|review|compare/.test(q))) intentSignals.push("comparison-shopping");
    if (queries.some((q: string) => /how to|what is|guide/.test(q))) intentSignals.push("informational");
    if (queries.some((q: string) => /hire|need|looking for|find/.test(q))) intentSignals.push("high-intent");

    // Build field-specific optimization guidance
    const fieldGuidance: Record<string, string> = {
        metaTitle: `FIELD GUIDANCE (Meta Title — SERP Blue Link):
CTR RESEARCH (proven impact on click-through rates):
- Power words like "verified", "certified", "insured" boost CTR +10-15%
- Numbers/stats boost CTR +20-30% (e.g., "$1M Insured", "365 Nights/Yr")
- Brackets/parentheses boost CTR +10% (e.g., "[Verified Nightly]")

TITLE TAG FORMULA (pick the best fit for intent):
1. Differentiator-First: "[Differentiator] [Service] in [City], [ST] | XIRI"
   Example: "Nightly-Verified Commercial Cleaning in Atlantic Beach, NY | XIRI"
2. Proof-Point: "[Service] with [Proof] in [City], [ST] | XIRI"
   Example: "Commercial Cleaning with Proof-of-Work in Atlantic Beach, NY | XIRI"
3. Outcome-Driven: "[Service] [City] — [Outcome] | XIRI"
   Example: "Office Cleaning Atlantic Beach — Documented & Insured | XIRI"

XIRI DIFFERENTIATORS (use these — they are real operational advantages):
- Nightly-verified (NFC proof-of-service tokens)
- Proof-of-work documentation
- $1M+ insured
- Shift-level audit logs
- Real-time inspection reports

RULES:
- Hard limit: 50-60 characters (count carefully — Google truncates after 60)
- Front-load the primary keyword (service + city)
- The brand "| XIRI" should appear at the end
- NEVER use generic pattern "[Service] in [City] | [Brand]" without a differentiator hook
- Every title must contain at least ONE element that a competitor cannot also claim`,

        metaDescription: `FIELD GUIDANCE (Meta Description — SERP Snippet):
CTR RESEARCH:
- Descriptions with a clear CTA get +15% more clicks
- Specific numbers/stats in descriptions boost CTR +20%
- Action verbs at the start outperform passive voice

META DESCRIPTION FORMULA:
[What you get] + [Proof/differentiator] + [Call-to-action]
Example: "XIRI delivers nightly-verified commercial cleaning in Atlantic Beach with documented proof-of-service. $1M insured, real-time inspection reports. Request a free walkthrough."

POWER ELEMENTS TO INCLUDE:
- Quantified proof (insured amount, verification frequency, years in operation)
- Operational trust signals (NFC tokens, audit logs, shift reports)
- Specific CTA: "Free walkthrough", "Same-week start", "Get a scope", "Request a quote"
- Match intent: ${intentSignals.join(", ") || "unknown"}

RULES:
- Hard limit: 150-160 characters (Google truncates after 160)
- Lead with a concrete benefit or proof — never "We offer..." or "Our company provides..."
- Include exactly ONE call-to-action
- The description must answer: "Why should I click THIS result over the others?"`,

        heroTitle: `FIELD GUIDANCE (H1 Hero Title):
- This is the first thing visitors see after clicking — must validate their click decision
- Reinforce the keyword from the meta title but expand with specificity
- Include a quantified claim or compliance credential where possible
- Can be longer than the meta title — use the space to add detail`,

        heroSubtitle: `FIELD GUIDANCE (Hero Subtitle):
- Sits below the H1 — must quickly explain the value proposition
- Use specific operational language: "nightly verified", "365 nights/yr", "documented shift logs"
- Address the primary pain point evident in the query cluster`,

        ctaText: `FIELD GUIDANCE (CTA Text):
- Action-oriented, specific next step — not generic "Contact Us" or "Learn More"
- Match search intent: transactional → "Get Your Free Scope" / informational → "See How It Works"`,

        trustBadge: `FIELD GUIDANCE (Trust Badge):
- Short, punchy proof statement for a badge/chip component
- Format: "[Number] [Metric] [Timeframe]" or "[Certification] Compliant"`,

        proofStatement: `FIELD GUIDANCE (Proof Statement):
- Specific, verifiable claim using operational data
- Include timeframe, location, and metric where possible`,
    };

    const currentValueBlock = nudge.currentValue && nudge.currentValue !== "[could not fetch live page]"
        ? `\nCURRENT LIVE VALUE: "${nudge.currentValue}"\nThis is what is currently live on the page. Analyze why it may be underperforming and write a meaningfully improved version. Do NOT simply rephrase it — identify the specific weakness and fix it.`
        : `\nCURRENT VALUE: Not available — write optimized copy from scratch for this field.`;

    // Build cross-page learning block from approved nudges
    const relevantPatterns = winningPatterns.filter(p => p.field === nudge.targetField);
    let learningBlock = "";
    if (relevantPatterns.length > 0) {
        const examples = relevantPatterns.slice(0, 5).map((p, i) =>
            `  ${i + 1}. Page: /${p.slug}\n     Before: "${p.before}"\n     After (approved): "${p.after}"`
        ).join("\n");
        learningBlock = `\nCROSS-PAGE LEARNING (these patterns were approved on similar pages — adapt the winning style):
${examples}
Use these as inspiration for the tone, structure, and differentiator placement. Do NOT copy them verbatim — adapt for this specific page's service and location.`;
    }

    // Build top performer benchmark block from current GSC data
    let benchmarkBlock = "";
    if (topPerformers.length > 0) {
        const benchmarks = topPerformers.slice(0, 5).map((tp, i) =>
            `  ${i + 1}. /${tp.slug} — CTR: ${(tp.ctr * 100).toFixed(1)}% at position ${tp.position.toFixed(0)} (${tp.clicks} clicks from ${tp.impressions} impressions)\n     Title: "${tp.title}"${tp.description ? `\n     Description: "${tp.description}"` : ""}`
        ).join("\n");
        benchmarkBlock = `\nTOP PERFORMING PAGES IN THIS SEGMENT (these are currently earning the highest CTR in ${segment === "leads" ? "lead" : "contractor"} search — study what makes them click-worthy):
${benchmarks}
Analyze the patterns: what differentiators, structures, or proof points are making these titles win? Adapt those winning elements for the target page.`;
    }

    const prompt = `You are a senior B2B SEO strategist for Xiri Facility Solutions, a commercial cleaning company serving Long Island and NYC. You specialize in writing high-CTR meta content for local service pages.

AUDIENCE: ${audienceContext}

TASK: Write an optimized "${nudge.targetField}" for the page: ${targetSlugToPath(nudge.targetSlug)}
${serviceFromSlug ? `SERVICE: ${serviceFromSlug}` : ""}
${locationFromSlug ? `LOCATION: ${locationFromSlug}` : ""}

PERFORMANCE DATA:
- Google Search Position: ${nudge.dataPoints.gscPosition?.toFixed(1) || "unknown"}
- Click-Through Rate: ${nudge.dataPoints.gscCtr ? (nudge.dataPoints.gscCtr * 100).toFixed(2) + "%" : "unknown"}
- Monthly Impressions: ${nudge.dataPoints.gscImpressions || "unknown"}
- Monthly Clicks: ${nudge.dataPoints.gscClicks || "unknown"}
${queries.length ? `- Top search queries driving impressions:\n${queries.slice(0, 8).map((q: string, i: number) => `  ${i + 1}. "${q}"`).join("\n")}` : ""}
${intentSignals.length ? `- Detected search intent: ${intentSignals.join(", ")}` : ""}

DIAGNOSIS: ${nudge.ruleId} — ${nudge.reasoning}
${currentValueBlock}${trustContext}

${fieldGuidance[nudge.targetField] || ""}
${learningBlock}
${benchmarkBlock}

STRICT RULES:
- Maximum ${maxLength} characters (hard limit — count carefully)
- Write for B2B facility managers, never B2C/residential
- Never use: "cheap", "affordable", "best", "#1", "top-rated", exclamation marks, emojis
- Include quantified proof when available (e.g., "$1M insured", "365 nights/yr", "nightly audited")
- Match the dominant search intent from the query cluster
- Make every word earn its place — no filler phrases
- Output ONLY the final copy text. No quotes, no labels, no explanation.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response?.text()?.trim() || "";
        // Strip any quotes the model might add
        return text.replace(/^["']|["']$/g, "").trim();
    } catch (err: any) {
        logger.warn(`[pSEO] Gemini generation failed for ${nudge.targetSlug}/${nudge.targetField}:`, err.message);
        return `[Auto-generation failed — please write manually. Reason: ${nudge.reasoning}]`;
    }
}

// ── Core Analysis Pipeline ───────────────────────────────────────────────────

async function runAnalysisPipeline(segment: NudgeSegment) {
    const statusRef = db.collection("pseo_config").doc("run_status");
    const startedAt = new Date();
    let phase = "Initializing";
    const heuristicObservability = initHeuristicObservability();
    const reliability = {
        generated: 0,
        deduped: 0,
        applied: 0,
        skipped_by_reason: {
            expansion_queued: 0,
        },
        unsupported_fields: 0,
        missing_metrics: {
            bounceRate: 0,
            avgEngagementTime: 0,
            scrollDepth: 0,
            trustSignals: 0,
        },
        heuristics: heuristicObservability,
    };

    const updateStatus = async (updates: Partial<RunStatus>) => {
        await statusRef.set({
            running: true,
            segment,
            phase,
            startedAt,
            updatedAt: new Date(),
            ...updates,
        }, { merge: true });
    };

    try {
        await updateStatus({ phase: "Connecting to GSC" });

        // 1. Get access token
        const accessToken = await getValidAccessToken();
        logger.info(`[pSEO] Access token acquired for segment "${segment}"`);

        // ── Diagnostic: verify token identity & GSC access ──
        try {
            const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
            const tokenInfo = await tokenInfoRes.json();
            logger.info(`[pSEO] Token belongs to: ${tokenInfo.email || "unknown"}, scopes: ${tokenInfo.scope || "unknown"}`);

            // Also verify the token can list sites
            const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const sitesData = await sitesRes.json();
            const siteUrls = (sitesData.siteEntry || []).map((s: any) => s.siteUrl);
            logger.info(`[pSEO] GSC accessible sites: ${JSON.stringify(siteUrls)}`);

            if (!siteUrls.includes(GSC_SITE_URL)) {
                throw new Error(
                    `Token email "${tokenInfo.email}" does not have access to "${GSC_SITE_URL}". ` +
                    `Accessible sites: ${JSON.stringify(siteUrls)}. Please disconnect and reconnect GSC with the correct Google account.`
                );
            }
        } catch (diagErr: any) {
            if (diagErr.message?.includes("does not have access")) throw diagErr;
            logger.warn(`[pSEO] Diagnostic check failed (non-fatal): ${diagErr.message}`);
        }

        // 2. Determine date ranges
        const today = new Date();
        const endDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (data delay)
        const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000); // 28-day window
        const priorEnd = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);
        const priorStart = new Date(priorEnd.getTime() - 28 * 24 * 60 * 60 * 1000);

        const fmt = (d: Date) => d.toISOString().split("T")[0];

        // 3. Fetch GSC data (current + prior period for MoM)
        phase = "Fetching GSC data";
        await updateStatus({ phase });
        const currentRows = await fetchGscData(accessToken, segment, fmt(startDate), fmt(endDate));
        const priorRows = await fetchGscData(accessToken, segment, fmt(priorStart), fmt(priorEnd));

        // 4. Aggregate by page
        phase = "Aggregating metrics";
        await updateStatus({ phase });
        const currentPages = aggregateByPage(currentRows);
        const priorPages = aggregateByPage(priorRows);

        // Inject prior period clicks for MoM comparison
        for (const [page, pm] of currentPages) {
            const prior = priorPages.get(page);
            if (prior) {
                pm.clicksPrior = prior.clicks;
            }
        }

        logger.info(`[pSEO] Aggregated ${currentPages.size} pages for segment "${segment}"`);

        // 5. Fetch GA4 engagement data
        phase = "Fetching GA4 engagement";
        await updateStatus({ phase, pagesAnalyzed: currentPages.size });
        const ga4Data = await fetchGa4Engagement(
            accessToken,
            Array.from(currentPages.keys()),
            fmt(startDate),
            fmt(endDate),
        );

        // Merge GA4 into page metrics
        for (const [page, ga] of ga4Data) {
            const pm = currentPages.get(page);
            if (pm) {
                pm.bounceRate = ga.bounceRate;
                pm.avgEngagementTime = ga.avgEngagementTime;
                pm.scrollDepth = ga.scrollDepth;
            }
        }

        // 6. Fetch trust signals
        phase = "Fetching trust signals";
        await updateStatus({ phase });
        const trustSignals = await fetchTrustSignals();

        // Merge trust into page metrics
        for (const pm of currentPages.values()) {
            const city = extractCityFromSlug(pm.slug);
            if (city) {
                const trust = trustSignals.get(city);
                if (trust) {
                    pm.nfcSessionsMonth = trust.nfc;
                    pm.workOrdersMonth = trust.wo;
                }
            }
        }

        // 7. Run heuristic detection
        phase = "Running heuristics";
        await updateStatus({ phase });
        let allNudges: DetectedNudge[] = [];

        for (const pm of currentPages.values()) {
            const pageNudges = runHeuristics(pm, trustSignals, segment, heuristicObservability);
            allNudges.push(...pageNudges);
        }

        // R08: Expansion opportunities
        const existingPages = new Set(Array.from(currentPages.keys()));
        const expansionNudges = detectExpansionOpportunities(currentRows, existingPages, segment, heuristicObservability);
        reliability.skipped_by_reason.expansion_queued += expansionNudges.length;
        allNudges.push(...expansionNudges);
        reliability.generated = allNudges.length;

        for (const pm of currentPages.values()) {
            if (pm.bounceRate == null) reliability.missing_metrics.bounceRate += 1;
            if (pm.avgEngagementTime == null) reliability.missing_metrics.avgEngagementTime += 1;
            if (pm.scrollDepth == null) reliability.missing_metrics.scrollDepth += 1;
            if (pm.nfcSessionsMonth == null && pm.workOrdersMonth == null) reliability.missing_metrics.trustSignals += 1;
        }

        logger.info(`[pSEO] Detected ${allNudges.length} raw nudges across ${currentPages.size} pages`);

        // 7.5. Dedup: remove nudges that already have a pending entry in the inbox
        phase = "Deduplicating against inbox";
        await updateStatus({ phase });
        const existingPending = await fetchExistingPendingNudges();
        const dedup = deduplicateNudges(allNudges, existingPending);
        allNudges = dedup.filtered;
        reliability.deduped = dedup.removed;

        logger.info(`[pSEO] ${allNudges.length} nudges after dedup`);

        // 7.6. Fetch winning patterns from approved nudges (cross-page learning)
        phase = "Loading winning patterns";
        await updateStatus({ phase });
        const winningPatterns = await fetchWinningPatterns(segment);

        // 8. Prioritize and cap at configured batch size
        const priorityOrder: Record<NudgePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        allNudges.sort((a, b) => {
            const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (pDiff !== 0) return pDiff;
            // Break ties by impressions (higher = more impactful)
            return (b.dataPoints.gscImpressions || 0) - (a.dataPoints.gscImpressions || 0);
        });

        const cappedNudges = allNudges.slice(0, PSEO_BATCH_SIZE);

        // 8.5. Fetch live page content for nudge pages + top CTR candidates
        phase = "Fetching live page content";
        await updateStatus({ phase });

        // Identify candidate top performers (pages with high CTR) to also fetch their meta
        const topCtrCandidates: string[] = [];
        for (const [, pm] of currentPages) {
            if (pm.impressions >= 30 && pm.clicks >= 3 && pm.ctr > 0.03) {
                topCtrCandidates.push(pm.slug);
            }
        }

        // Merge nudge slugs + top CTR candidates for a single batch fetch
        const nudgeSlugs = [...new Set(cappedNudges.map(n => n.targetSlug))];
        const allSlugsToFetch = [...new Set([...nudgeSlugs, ...topCtrCandidates])];
        const liveMetaMap = await fetchLivePageMeta(allSlugsToFetch);

        // Enrich each nudge with actual current content from the live page
        for (const nudge of cappedNudges) {
            const meta = liveMetaMap.get(nudge.targetSlug);
            nudge.currentValue = getLiveValueForField(meta, nudge.targetField);
        }

        // 8.6. Identify top performers from GSC data (pages currently winning)
        phase = "Identifying top performers";
        await updateStatus({ phase });
        const topPerformers = identifyTopPerformers(currentPages, liveMetaMap);

        // 9. Generate Gemini copy suggestions (with cross-page learning + benchmarks)
        phase = "Generating copy suggestions";
        await updateStatus({ phase, nudgesDetected: cappedNudges.length });

        const nudgesWithCopy: Array<DetectedNudge & { suggestedValue: string }> = [];
        for (let i = 0; i < cappedNudges.length; i++) {
            const nudge = cappedNudges[i];
            phase = `Generating copy (${i + 1}/${cappedNudges.length})`;
            await updateStatus({ phase });

            const suggestedValue = await generateCopySuggestion(nudge, segment, winningPatterns, topPerformers);
            nudgesWithCopy.push({ ...nudge, suggestedValue });

            // Rate limit Gemini calls (avoid burst)
            if (i < cappedNudges.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        // 10. Write batch + nudges to Firestore
        phase = "Writing to Firestore";
        await updateStatus({ phase });

        const now = new Date();
        const weekNum = getISOWeek(now);
        const weekId = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
        const batchId = `${weekId}-${segment}`;

        // Count by scope and priority
        const breakdown: Record<string, number> = {};
        const priorityBreakdown: Record<string, number> = {};
        for (const n of nudgesWithCopy) {
            breakdown[n.scope] = (breakdown[n.scope] || 0) + 1;
            priorityBreakdown[n.priority] = (priorityBreakdown[n.priority] || 0) + 1;
        }

        // Write batch doc
        const batchDoc: Omit<PseoBatch, "id"> = {
            segment,
            weekId,
            totalNudges: nudgesWithCopy.length,
            breakdown: breakdown as any,
            priorityBreakdown: priorityBreakdown as any,
            approvedCount: 0,
            rejectedCount: 0,
            deferredCount: 0,
            pendingCount: nudgesWithCopy.length,
            createdAt: now,
            gscDataRange: {
                startDate: fmt(startDate),
                endDate: fmt(endDate),
            },
        };

        await db.collection("pseo_batches").doc(batchId).set(batchDoc);

        // Persist non-destructive expansion backlog as an explicit queue artifact.
        const expansionQueue = nudgesWithCopy
            .filter((n) => n.scope === "expansion")
            .map((n) => ({
                targetSlug: n.targetSlug,
                reasoning: n.reasoning,
                dataPoints: n.dataPoints,
                suggestedValue: n.suggestedValue,
                createdAt: now,
            }));
        if (expansionQueue.length > 0) {
            await db.collection("pseo_expansion_queue").doc(batchId).set({
                batchId,
                segment,
                createdAt: now,
                count: expansionQueue.length,
                items: expansionQueue,
            }, { merge: true });
        }

        // Write individual nudge docs in batches of 500
        const FIRESTORE_BATCH_LIMIT = 490;
        for (let batchStart = 0; batchStart < nudgesWithCopy.length; batchStart += FIRESTORE_BATCH_LIMIT) {
            const chunk = nudgesWithCopy.slice(batchStart, batchStart + FIRESTORE_BATCH_LIMIT);
            const writeBatch = db.batch();

            for (const nudge of chunk) {
                const nudgeRef = db.collection("pseo_nudges").doc();
                const nudgeDoc: Omit<PseoNudge, "id"> = {
                    segment,
                    scope: nudge.scope,
                    priority: nudge.priority,
                    status: "pending",
                    targetSlug: normalizeTargetSlug(nudge.targetSlug),
                    targetField: nudge.targetField,
                    currentValue: nudge.currentValue,
                    suggestedValue: nudge.suggestedValue,
                    reasoning: nudge.reasoning,
                    ruleTriggered: nudge.ruleId,
                    dataPoints: nudge.dataPoints,
                    batchId,
                    createdAt: now,
                };
                writeBatch.set(nudgeRef, nudgeDoc);
            }

            await writeBatch.commit();
        }

        // 11. Done!
        await statusRef.set({
            running: false,
            segment,
            phase: "Complete",
            pagesAnalyzed: currentPages.size,
            nudgesDetected: nudgesWithCopy.length,
            startedAt,
            completedAt: new Date(),
            updatedAt: new Date(),
            batchId,
            reliability,
        });

        logger.info(`[pSEO] Analysis complete. Batch "${batchId}" — ${nudgesWithCopy.length} nudges written.`);

        return {
            batchId,
            totalNudges: nudgesWithCopy.length,
            pagesAnalyzed: currentPages.size,
            breakdown,
            reliability,
        };

    } catch (err: any) {
        logger.error("[pSEO] Analysis pipeline failed:", err.message || err);

        await statusRef.set({
            running: false,
            segment,
            phase: "Failed",
            error: err.message || "Unknown error",
            startedAt,
            updatedAt: new Date(),
            reliability,
        }).catch(e => logger.error("[pSEO] Failed to write error status:", e.message));

        throw err;
    }
}

// ── ISO Week Number ──────────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Scheduled: Every Sunday at 11 PM ET ──────────────────────────────────────

export const weeklyPseoAnalysis = onSchedule({
    schedule: "0 23 * * 0", // Sunday 11 PM
    timeZone: "America/New_York",
    secrets: ["GEMINI_API_KEY", "GSC_CLIENT_ID", "GSC_CLIENT_SECRET"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[pSEO] Starting scheduled weekly analysis...");

    // Run both segments sequentially
    await runAnalysisPipeline("leads");
    await runAnalysisPipeline("contractors");
});

// ── Manual trigger: "Run Now" button in dashboard ────────────────────────────

export const triggerPseoAnalysis = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["GEMINI_API_KEY", "GSC_CLIENT_ID", "GSC_CLIENT_SECRET"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (request) => {
    const segment = (request.data?.segment as NudgeSegment) || "leads";

    if (!["leads", "contractors"].includes(segment)) {
        throw new HttpsError("invalid-argument", "Invalid segment. Use 'leads' or 'contractors'.");
    }

    // Check if already running
    const statusDoc = await db.collection("pseo_config").doc("run_status").get();
    if (statusDoc.exists && statusDoc.data()?.running) {
        throw new HttpsError("already-exists", "Analysis is already running. Please wait for it to complete.");
    }

    logger.info(`[pSEO] Manual trigger invoked for segment "${segment}"`);
    const result = await runAnalysisPipeline(segment);

    return {
        message: `Analysis complete for "${segment}"`,
        ...result,
    };
});

// ── Get run status (polled by UI for progress) ──────────────────────────────

export const getPseoRunStatus = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 10,
}, async () => {
    const doc = await db.collection("pseo_config").doc("run_status").get();
    if (!doc.exists) {
        return { running: false, phase: "Never run" };
    }

    const data = doc.data()!;
    return {
        running: data.running || false,
        segment: data.segment || null,
        phase: data.phase || null,
        pagesAnalyzed: data.pagesAnalyzed || 0,
        nudgesDetected: data.nudgesDetected || 0,
        startedAt: data.startedAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        error: data.error || null,
        batchId: data.batchId || null,
        reliability: data.reliability || null,
    };
});
