/**
 * Clarity Analytics Utilities
 *
 * Fetches data from Microsoft Clarity Data Export API and
 * posts a summary with filtered links to Google Chat.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface ClarityMetrics {
    totalSessions: number;
    distinctUsers: number;
    pagesPerSession: number;
    scrollDepth: number;
    activeTime: number;        // seconds
    deadClickCount: number;
    deadClickSessionPct: number;
    rageClickCount: number;
    rageClickSessionPct: number;
    quickbackCount: number;
    excessiveScrollCount: number;
    errorClickCount: number;
    topPages: ClarityPageMetric[];
    fetchedAt: string;
    daysQueried: number;
}

export interface ClarityPageMetric {
    url: string;
    sessions: number;
    deadClicks: number;
    rageClicks: number;
    scrollDepth: number;
}

// ─── Clarity Data Export API ─────────────────────────────────────────

const CLARITY_API_BASE = "https://www.clarity.ms/export-data/api/v1";
const CLARITY_PROJECT_ID = "vtpukex31u";
const CLARITY_DASHBOARD = `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}`;

/**
 * Fetch live insights from Clarity Data Export API.
 *
 * The API returns an array of metric objects, each with:
 *   { metricName: string, information: [{ ...fields }] }
 */
export async function fetchClarityInsights(
    apiToken: string,
    days: 1 | 2 | 3 = 3
): Promise<ClarityMetrics> {
    const url = `${CLARITY_API_BASE}/project-live-insights?numOfDays=${days}&projectId=${CLARITY_PROJECT_ID}`;

    const resp = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
        },
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Clarity API error (${resp.status}): ${errText}`);
    }

    const data: Array<{ metricName: string; information: any[] }> = await resp.json();

    // Helper to extract first info entry for a metric
    const getInfo = (name: string): any => {
        const metric = data.find(m => m.metricName === name);
        return metric?.information?.[0] ?? {};
    };

    const traffic = getInfo("Traffic");
    const scroll = getInfo("ScrollDepth");
    const engagement = getInfo("EngagementTime");
    const deadClicks = getInfo("DeadClickCount");
    const rageClicks = getInfo("RageClickCount");
    const quickbacks = getInfo("QuickbackClick");
    const excessiveScroll = getInfo("ExcessiveScroll");
    const errorClicks = getInfo("ErrorClickCount");

    // Extract popular pages with their visit counts
    const popularPagesMetric = data.find(m => m.metricName === "PopularPages");
    const topPages: ClarityPageMetric[] = (popularPagesMetric?.information ?? [])
        .slice(0, 10)
        .map((p: any) => ({
            url: p.url || "unknown",
            sessions: parseInt(p.visitsCount || "0", 10),
            deadClicks: 0,
            rageClicks: 0,
            scrollDepth: 0,
        }));

    return {
        totalSessions: parseInt(traffic.totalSessionCount || "0", 10),
        distinctUsers: parseInt(traffic.distinctUserCount || "0", 10),
        pagesPerSession: parseFloat(traffic.pagesPerSessionPercentage || "0"),
        scrollDepth: parseFloat(scroll.averageScrollDepth || "0"),
        activeTime: parseInt(engagement.activeTime || "0", 10),
        deadClickCount: parseInt(deadClicks.subTotal || "0", 10),
        deadClickSessionPct: parseFloat(deadClicks.sessionsWithMetricPercentage || "0"),
        rageClickCount: parseInt(rageClicks.subTotal || "0", 10),
        rageClickSessionPct: parseFloat(rageClicks.sessionsWithMetricPercentage || "0"),
        quickbackCount: parseInt(quickbacks.subTotal || "0", 10),
        excessiveScrollCount: parseInt(excessiveScroll.subTotal || "0", 10),
        errorClickCount: parseInt(errorClicks.subTotal || "0", 10),
        topPages,
        fetchedAt: new Date().toISOString(),
        daysQueried: days,
    };
}

// ─── Clarity Filtered Links ──────────────────────────────────────────

function clarityDateParam(days: number): string {
    return `Last%20${days === 1 ? "24%20hours" : `${days}%20days`}`;
}

export function getClarityLinks(days: number) {
    const date = clarityDateParam(days);
    return {
        dashboard: `${CLARITY_DASHBOARD}/dashboard?date=${date}`,
        deadClicks: `${CLARITY_DASHBOARD}/impressions?date=${date}&deadClickCount=1`,
        rageClicks: `${CLARITY_DASHBOARD}/impressions?date=${date}&rageClickCount=1`,
        quickbacks: `${CLARITY_DASHBOARD}/impressions?date=${date}&quickbackCount=1`,
        recordings: `${CLARITY_DASHBOARD}/impressions?date=${date}`,
    };
}

// ─── Google Chat Card Builder ────────────────────────────────────────

export function buildClarityChatCard(metrics: ClarityMetrics): any {
    const m = metrics;
    const links = getClarityLinks(m.daysQueried);

    const sections: any[] = [];

    // ── Header metrics ──
    sections.push({
        widgets: [{
            decoratedText: {
                topLabel: `LAST ${m.daysQueried} DAYS`,
                text: `<b>${m.totalSessions}</b> sessions  •  <b>${m.distinctUsers}</b> users  •  <b>${m.pagesPerSession.toFixed(1)}</b> pages/session`,
                startIcon: { knownIcon: "BOOKMARK" },
            },
        }, {
            columns: {
                columnItems: [
                    {
                        horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                        horizontalAlignment: "CENTER",
                        verticalAlignment: "CENTER",
                        widgets: [{
                            decoratedText: {
                                topLabel: "DEAD CLICKS",
                                text: `<font color="#dc2626"><b>${m.deadClickCount}</b></font> (${m.deadClickSessionPct.toFixed(1)}%)`,
                            },
                        }],
                    },
                    {
                        horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                        horizontalAlignment: "CENTER",
                        verticalAlignment: "CENTER",
                        widgets: [{
                            decoratedText: {
                                topLabel: "RAGE CLICKS",
                                text: `<font color="#ea580c"><b>${m.rageClickCount}</b></font> (${m.rageClickSessionPct.toFixed(1)}%)`,
                            },
                        }],
                    },
                    {
                        horizontalSizeStyle: "FILL_AVAILABLE_SPACE",
                        horizontalAlignment: "CENTER",
                        verticalAlignment: "CENTER",
                        widgets: [{
                            decoratedText: {
                                topLabel: "SCROLL DEPTH",
                                text: `<b>${Math.round(m.scrollDepth)}%</b>`,
                            },
                        }],
                    },
                ],
            },
        }],
    });

    // ── Extra metrics ──
    const extras: string[] = [];
    if (m.quickbackCount > 0) extras.push(`Quick-backs: <b>${m.quickbackCount}</b>`);
    if (m.excessiveScrollCount > 0) extras.push(`Excessive scrolls: <b>${m.excessiveScrollCount}</b>`);
    if (m.errorClickCount > 0) extras.push(`Error clicks: <b>${m.errorClickCount}</b>`);
    extras.push(`Active time: <b>${m.activeTime}s</b>`);

    sections.push({
        widgets: [{
            textParagraph: { text: extras.join("  •  ") },
        }],
    });

    // ── Top pages ──
    if (m.topPages.length > 0) {
        const pageLines = m.topPages
            .slice(0, 5)
            .map(p => {
                const shortUrl = p.url.replace("https://xiri.ai", "");
                return `• <b>${p.sessions}</b> visits — ${shortUrl || "/"}`;
            })
            .join("\n");

        sections.push({
            header: "📄 Top Pages",
            widgets: [{
                textParagraph: { text: pageLines },
            }],
        });
    }

    // ── Action links (filtered Clarity views) ──
    sections.push({
        header: "🔗 Investigate in Clarity",
        widgets: [{
            buttonList: {
                buttons: [
                    {
                        text: `🔴 Dead Clicks (${m.deadClickCount})`,
                        onClick: { openLink: { url: links.deadClicks } },
                    },
                    {
                        text: `🟠 Rage Clicks (${m.rageClickCount})`,
                        onClick: { openLink: { url: links.rageClicks } },
                    },
                    {
                        text: `⚡ Quick-backs (${m.quickbackCount})`,
                        onClick: { openLink: { url: links.quickbacks } },
                    },
                    {
                        text: "📊 Full Dashboard",
                        onClick: { openLink: { url: links.dashboard } },
                    },
                ],
            },
        }],
    });

    // ── Shareable links as text (for pasting into IDE) ──
    sections.push({
        header: "📋 Paste-ready links",
        widgets: [{
            textParagraph: {
                text: [
                    `Dead clicks: ${links.deadClicks}`,
                    `Rage clicks: ${links.rageClicks}`,
                    `Quick-backs: ${links.quickbacks}`,
                    `All recordings: ${links.recordings}`,
                ].join("\n"),
            },
        }],
    });

    return {
        header: {
            title: "📊  Daily UX Report — xiri.ai",
            subtitle: new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "America/New_York",
            }),
        },
        sections,
    };
}

/**
 * Post a Clarity metrics card to Google Chat via webhook.
 */
export async function postClarityReportToChat(
    metrics: ClarityMetrics,
    webhookUrl: string
): Promise<void> {
    const card = buildClarityChatCard(metrics);
    const links = getClarityLinks(metrics.daysQueried);

    const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: `📊 Daily UX: ${metrics.totalSessions} sessions, ${metrics.deadClickCount} dead clicks, ${metrics.rageClickCount} rage clicks — ${links.dashboard}`,
            cardsV2: [{ cardId: `clarity-${Date.now()}`, card }],
        }),
    });

    if (!resp.ok) {
        console.error(`Chat webhook failed (${resp.status}):`, await resp.text());
    }
}
