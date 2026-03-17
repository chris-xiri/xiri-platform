/**
 * Clarity AI Agent — UX Friction Analyzer
 *
 * Analyzes Clarity metrics, detects spikes in frustration signals,
 * and uses Gemini to classify issues as code-fixable vs behavioral.
 *
 * Phase 1: Recommendations posted to Google Chat (no auto-commit).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "firebase-functions/v2";
import type { ClarityMetrics, ClarityPageMetric } from "./clarityUtils";

// ─── Types ───────────────────────────────────────────────────────────

export type IssueClassification = "code_fix" | "behavioral" | "edge_case" | "insufficient_data";

export interface FrictionSpike {
    signal: string;           // e.g. "dead_clicks", "rage_clicks"
    page?: string;            // URL if page-specific
    current: number;
    baseline: number;
    changePercent: number;    // +50 means 50% increase
}

export interface AIAnalysisResult {
    issues: AIClassifiedIssue[];
    summary: string;
    analyzedAt: string;
}

export interface AIClassifiedIssue {
    classification: IssueClassification;
    signal: string;
    page: string;
    description: string;
    suggestedFix?: string;   // Only for code_fix
    affectedFiles?: string[]; // Only for code_fix
    confidence: "high" | "medium" | "low";
}

// ─── Page → Component Map ────────────────────────────────────────────

import pageComponentMap from "../data/page-component-map.json";

/**
 * Given a Clarity page URL, find matching source files from the map.
 */
export function getComponentsForPage(pageUrl: string): string[] {
    // Normalize: remove domain, trailing slash
    let path = pageUrl
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/\/$/, "") || "/";

    // Exact match first
    const map = pageComponentMap as Record<string, string[]>;
    if (map[path]) return map[path];

    // Wildcard match: try parent/* patterns
    const segments = path.split("/").filter(Boolean);
    for (let i = segments.length; i > 0; i--) {
        const pattern = "/" + segments.slice(0, i).join("/") + "/*";
        if (map[pattern]) return map[pattern];
    }

    return [];
}

// ─── Spike Detection ─────────────────────────────────────────────────

interface SpikeThresholds {
    deadClicks: number;       // % increase to trigger
    rageClicks: number;
    quickbacks: number;
    excessiveScroll: number;
    minSessions: number;      // Don't flag if < N sessions
}

const DEFAULT_THRESHOLDS: SpikeThresholds = {
    deadClicks: 50,       // 50% increase
    rageClicks: 30,       // 30% increase
    quickbacks: 100,      // 2x increase
    excessiveScroll: 50,
    minSessions: 10,
};

/**
 * Compare current metrics against a baseline and detect spikes.
 */
export function detectFrictionSpikes(
    current: ClarityMetrics,
    baseline: ClarityMetrics,
    thresholds: SpikeThresholds = DEFAULT_THRESHOLDS
): FrictionSpike[] {
    const spikes: FrictionSpike[] = [];

    // Don't analyze if traffic is too low
    if (current.totalSessions < thresholds.minSessions) {
        logger.info(`Skipping spike detection: only ${current.totalSessions} sessions (min: ${thresholds.minSessions})`);
        return spikes;
    }

    // Check aggregate signals
    const checks: Array<{
        signal: string;
        current: number;
        baseline: number;
        threshold: number;
    }> = [
        { signal: "dead_clicks", current: current.deadClickCount, baseline: baseline.deadClickCount, threshold: thresholds.deadClicks },
        { signal: "rage_clicks", current: current.rageClickCount, baseline: baseline.rageClickCount, threshold: thresholds.rageClicks },
        { signal: "quickbacks", current: current.quickbackCount, baseline: baseline.quickbackCount, threshold: thresholds.quickbacks },
        { signal: "excessive_scroll", current: current.excessiveScrollCount, baseline: baseline.excessiveScrollCount, threshold: thresholds.excessiveScroll },
    ];

    for (const check of checks) {
        // Avoid division by zero; if baseline was 0 and current > 0, it's a spike
        if (check.baseline === 0 && check.current > 0) {
            spikes.push({
                signal: check.signal,
                current: check.current,
                baseline: 0,
                changePercent: 100,
            });
        } else if (check.baseline > 0) {
            const changePct = ((check.current - check.baseline) / check.baseline) * 100;
            if (changePct >= check.threshold) {
                spikes.push({
                    signal: check.signal,
                    current: check.current,
                    baseline: check.baseline,
                    changePercent: Math.round(changePct),
                });
            }
        }
    }

    // Check scroll depth drop (inverted: lower is worse)
    if (baseline.scrollDepth > 0 && current.scrollDepth > 0) {
        const scrollDrop = ((baseline.scrollDepth - current.scrollDepth) / baseline.scrollDepth) * 100;
        if (scrollDrop >= 20) { // 20% drop in scroll depth
            spikes.push({
                signal: "scroll_depth_drop",
                current: Math.round(current.scrollDepth),
                baseline: Math.round(baseline.scrollDepth),
                changePercent: -Math.round(scrollDrop),
            });
        }
    }

    return spikes;
}

// ─── AI Analysis with Gemini ─────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a UX analyst for xiri.ai, a B2B commercial cleaning platform.

Your job is to analyze user behavior signals from Microsoft Clarity and classify each friction point.

TARGET USER: Facility managers looking for commercial cleaning services (NOT contractors, NOT bots).

CLASSIFY each issue as one of:
- "code_fix" — A UI/UX issue in our code that we can fix (e.g., dead click on non-interactive element, confusing layout, buried CTA)
- "behavioral" — Normal user behavior we cannot control (e.g., hesitation, comparison shopping, reading carefully)
- "edge_case" — Rare scenario not worth fixing (e.g., unusual browser, bot traffic, tiny segment)
- "insufficient_data" — Not enough info to determine the cause

For "code_fix" issues, provide:
1. A clear description of what's wrong
2. A specific suggested fix
3. Which files are likely affected (use the component list provided)
4. Confidence level (high/medium/low)

For non-code issues, explain WHY it's not code-fixable so we can skip it confidently.

IMPORTANT: Be conservative. Only classify as "code_fix" if you're reasonably sure code can help.
Most friction signals have innocent explanations. Default to "behavioral" when unsure.

Respond in JSON format:
{
    "summary": "One-line overall assessment",
    "issues": [
        {
            "classification": "code_fix" | "behavioral" | "edge_case" | "insufficient_data",
            "signal": "dead_clicks" | "rage_clicks" | "quickbacks" | "excessive_scroll" | "scroll_depth_drop",
            "page": "/path or 'site-wide'",
            "description": "What's happening and why",
            "suggestedFix": "Specific code change (only for code_fix)",
            "affectedFiles": ["file.tsx"] ,
            "confidence": "high" | "medium" | "low"
        }
    ]
}`;

/**
 * Run AI analysis on friction spikes using Gemini.
 */
export async function analyzeWithAI(
    spikes: FrictionSpike[],
    currentMetrics: ClarityMetrics,
    geminiApiKey: string
): Promise<AIAnalysisResult> {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build context about pages with friction
    const pageContext = currentMetrics.topPages
        .slice(0, 8)
        .map((p: ClarityPageMetric) => {
            const components = getComponentsForPage(p.url);
            return `  - ${p.url} (${p.sessions} sessions) → Components: [${components.join(", ") || "unknown"}]`;
        })
        .join("\n");

    const spikeDetails = spikes
        .map(s => `  - ${s.signal}: ${s.current} (was ${s.baseline}, ${s.changePercent > 0 ? "+" : ""}${s.changePercent}%)${s.page ? ` on ${s.page}` : " (site-wide)"}`)
        .join("\n");

    const userPrompt = `Analyze these UX friction spikes from yesterday on xiri.ai:

SPIKES DETECTED:
${spikeDetails}

OVERALL METRICS:
- Sessions: ${currentMetrics.totalSessions}
- Dead clicks: ${currentMetrics.deadClickCount} (${currentMetrics.deadClickSessionPct.toFixed(1)}% of sessions)
- Rage clicks: ${currentMetrics.rageClickCount} (${currentMetrics.rageClickSessionPct.toFixed(1)}% of sessions)
- Quick-backs: ${currentMetrics.quickbackCount}
- Excessive scrolls: ${currentMetrics.excessiveScrollCount}
- Scroll depth: ${Math.round(currentMetrics.scrollDepth)}%
- Error clicks: ${currentMetrics.errorClickCount}

TOP PAGES (with their source components):
${pageContext}

Classify each spike and provide actionable recommendations.`;

    try {
        const result = await model.generateContent([
            { text: ANALYSIS_PROMPT },
            { text: userPrompt },
        ]);

        const responseText = result.response.text();

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                          responseText.match(/(\{[\s\S]*\})/);

        if (!jsonMatch?.[1]) {
            logger.warn("Gemini returned non-JSON response:", responseText.slice(0, 200));
            return {
                summary: "AI analysis returned unstructured response — manual review needed.",
                issues: [],
                analyzedAt: new Date().toISOString(),
            };
        }

        const parsed = JSON.parse(jsonMatch[1]);

        return {
            summary: parsed.summary || "Analysis complete.",
            issues: (parsed.issues || []).map((issue: any) => ({
                classification: issue.classification || "insufficient_data",
                signal: issue.signal || "unknown",
                page: issue.page || "site-wide",
                description: issue.description || "",
                suggestedFix: issue.suggestedFix,
                affectedFiles: issue.affectedFiles,
                confidence: issue.confidence || "low",
            })),
            analyzedAt: new Date().toISOString(),
        };

    } catch (err: any) {
        logger.error("Gemini analysis failed:", err);
        return {
            summary: `AI analysis error: ${err.message}`,
            issues: [],
            analyzedAt: new Date().toISOString(),
        };
    }
}

// ─── Google Chat Card Builder for AI Analysis ────────────────────────

const CLASSIFICATION_EMOJI: Record<IssueClassification, string> = {
    code_fix: "🔧",
    behavioral: "👤",
    edge_case: "🔍",
    insufficient_data: "❓",
};

const CONFIDENCE_EMOJI: Record<string, string> = {
    high: "🟢",
    medium: "🟡",
    low: "🔴",
};

/**
 * Build a Google Chat card section for AI analysis results.
 */
export function buildAIAnalysisChatSection(analysis: AIAnalysisResult): any[] {
    const sections: any[] = [];

    // Summary
    sections.push({
        header: "🤖 AI UX Analysis",
        widgets: [{
            decoratedText: {
                text: `<b>${analysis.summary}</b>`,
                startIcon: { knownIcon: "STAR" },
            },
        }],
    });

    // Code-fixable issues first
    const codeFixIssues = analysis.issues.filter(i => i.classification === "code_fix");
    const otherIssues = analysis.issues.filter(i => i.classification !== "code_fix");

    if (codeFixIssues.length > 0) {
        const fixWidgets = codeFixIssues.map(issue => ({
            decoratedText: {
                topLabel: `${CONFIDENCE_EMOJI[issue.confidence]} ${issue.signal.toUpperCase()} — ${issue.page}`,
                text: `<b>🔧 FIX:</b> ${issue.description}`,
                bottomLabel: issue.suggestedFix ? `💡 ${issue.suggestedFix.slice(0, 120)}` : undefined,
                wrapText: true,
            },
        }));

        sections.push({
            header: `🔧 Code-Fixable Issues (${codeFixIssues.length})`,
            widgets: fixWidgets,
        });
    }

    // Non-actionable issues
    if (otherIssues.length > 0) {
        const skipLines = otherIssues
            .map(i => `${CLASSIFICATION_EMOJI[i.classification]} <b>${i.signal}</b> (${i.page}): ${i.description.slice(0, 80)}`)
            .join("\n");

        sections.push({
            header: `📋 Skipped — Not Code-Fixable (${otherIssues.length})`,
            collapsible: true,
            widgets: [{
                textParagraph: { text: skipLines },
            }],
        });
    }

    // If no issues at all
    if (analysis.issues.length === 0) {
        sections.push({
            widgets: [{
                decoratedText: {
                    text: "No spikes detected — all metrics within normal range ✅",
                    startIcon: { knownIcon: "INVITE" },
                },
            }],
        });
    }

    return sections;
}
