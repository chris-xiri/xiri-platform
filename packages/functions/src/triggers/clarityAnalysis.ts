/**
 * Clarity UX Analysis — Daily Scheduled Report + AI Analysis
 *
 * Runs at 7:30 AM ET every day:
 *   1. Pulls yesterday's Clarity metrics + 3-day baseline
 *   2. Detects friction spikes (dead clicks, rage clicks, quickbacks, etc.)
 *   3. If spikes found → Gemini classifies as code-fixable vs behavioral
 *   4. Posts combined report to Google Chat
 *   5. Logs everything to Firestore
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { db } from "../utils/firebase";
import {
    fetchClarityInsights,
    getClarityLinks,
    buildClarityChatCard,
} from "../utils/clarityUtils";
import {
    detectFrictionSpikes,
    analyzeWithAI,
    buildAIAnalysisChatSection,
    type AIAnalysisResult,
} from "../utils/clarityAIAgent";

// ─── Secrets ─────────────────────────────────────────────────────────

const CLARITY_API_TOKEN = defineSecret("CLARITY_API_TOKEN");
const CLARITY_CHAT_WEBHOOK = defineSecret("CLARITY_CHAT_WEBHOOK_URL");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ─── Constants ───────────────────────────────────────────────────────

const TIMEZONE = "America/New_York";

// ─── Scheduled: Daily UX Report + AI Analysis ────────────────────────

export const dailyClarityReport = onSchedule({
    schedule: "30 7 * * *",   // 7:30 AM ET every day
    timeZone: TIMEZONE,
    region: "us-central1",
    secrets: [CLARITY_API_TOKEN, CLARITY_CHAT_WEBHOOK, GEMINI_API_KEY],
    timeoutSeconds: 120,      // Allow time for Gemini call
    memory: "512MiB",
}, async () => {
    logger.info("📊 Starting daily Clarity report + AI analysis...");

    try {
        // 1. Fetch yesterday's metrics
        const yesterday = await fetchClarityInsights(CLARITY_API_TOKEN.value(), 1);
        logger.info(`Clarity (yesterday): ${yesterday.totalSessions} sessions, ${yesterday.deadClickCount} dead clicks, ${yesterday.rageClickCount} rage clicks`);

        // 2. Fetch 3-day baseline for comparison
        const baseline = await fetchClarityInsights(CLARITY_API_TOKEN.value(), 3);
        // Normalize baseline to daily average
        const baselineDaily = {
            ...baseline,
            totalSessions: Math.round(baseline.totalSessions / 3),
            deadClickCount: Math.round(baseline.deadClickCount / 3),
            rageClickCount: Math.round(baseline.rageClickCount / 3),
            quickbackCount: Math.round(baseline.quickbackCount / 3),
            excessiveScrollCount: Math.round(baseline.excessiveScrollCount / 3),
            errorClickCount: Math.round(baseline.errorClickCount / 3),
        };

        // 3. Detect friction spikes
        const spikes = detectFrictionSpikes(yesterday, baselineDaily);
        logger.info(`Detected ${spikes.length} friction spike(s)`);

        // 4. AI analysis (only if spikes detected)
        let aiAnalysis: AIAnalysisResult | null = null;
        if (spikes.length > 0) {
            logger.info("🤖 Running Gemini AI analysis on spikes...");
            aiAnalysis = await analyzeWithAI(spikes, yesterday, GEMINI_API_KEY.value());
            logger.info(`AI classified ${aiAnalysis.issues.length} issues: ${aiAnalysis.summary}`);
        }

        // 5. Post enhanced report to Google Chat
        await postEnhancedReport(yesterday, aiAnalysis, CLARITY_CHAT_WEBHOOK.value());
        logger.info("✅ Posted to Google Chat");

        // 6. Log to Firestore
        await db.collection("clarity_reports").add({
            createdAt: new Date(),
            ...yesterday,
            spikes: spikes.length > 0 ? spikes : null,
            aiAnalysis: aiAnalysis ? {
                summary: aiAnalysis.summary,
                issueCount: aiAnalysis.issues.length,
                codeFixCount: aiAnalysis.issues.filter(i => i.classification === "code_fix").length,
                issues: aiAnalysis.issues,
                analyzedAt: aiAnalysis.analyzedAt,
            } : null,
        });
        logger.info("✅ Logged to Firestore");

    } catch (err) {
        logger.error("❌ Clarity report failed:", err);
        throw err;
    }
});

// ─── Manual trigger for testing ──────────────────────────────────────

export const triggerClarityReport = onCall({
    cors: true,
    secrets: [CLARITY_API_TOKEN, CLARITY_CHAT_WEBHOOK, GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (request) => {
    const days = (request.data?.days as 1 | 2 | 3) || 3;
    const postToChat = request.data?.postToChat !== false;
    const runAI = request.data?.aiAnalysis !== false;

    logger.info(`🧪 Manual Clarity report (${days} days, chat=${postToChat}, ai=${runAI})`);

    try {
        const metrics = await fetchClarityInsights(CLARITY_API_TOKEN.value(), days);

        let aiAnalysis: AIAnalysisResult | null = null;

        if (runAI) {
            // For manual trigger, use the metrics as both current and baseline
            // (no spike detection — analyze everything for testing)
            const syntheticSpikes = [
                { signal: "dead_clicks", current: metrics.deadClickCount, baseline: 0, changePercent: 100 },
                { signal: "rage_clicks", current: metrics.rageClickCount, baseline: 0, changePercent: 100 },
                { signal: "quickbacks", current: metrics.quickbackCount, baseline: 0, changePercent: 100 },
            ].filter(s => s.current > 0);

            if (syntheticSpikes.length > 0) {
                logger.info("🤖 Running AI analysis...");
                aiAnalysis = await analyzeWithAI(syntheticSpikes, metrics, GEMINI_API_KEY.value());
            }
        }

        if (postToChat) {
            await postEnhancedReport(metrics, aiAnalysis, CLARITY_CHAT_WEBHOOK.value());
        }

        // Log to Firestore
        await db.collection("clarity_reports").add({
            createdAt: new Date(),
            manual: true,
            ...metrics,
            aiAnalysis: aiAnalysis ? {
                summary: aiAnalysis.summary,
                issueCount: aiAnalysis.issues.length,
                codeFixCount: aiAnalysis.issues.filter(i => i.classification === "code_fix").length,
                issues: aiAnalysis.issues,
            } : null,
        });

        const links = getClarityLinks(days);

        return {
            success: true,
            metrics: {
                sessions: metrics.totalSessions,
                users: metrics.distinctUsers,
                deadClicks: metrics.deadClickCount,
                rageClicks: metrics.rageClickCount,
                scrollDepth: Math.round(metrics.scrollDepth),
                quickbacks: metrics.quickbackCount,
            },
            aiAnalysis: aiAnalysis ? {
                summary: aiAnalysis.summary,
                issueCount: aiAnalysis.issues.length,
                codeFixIssues: aiAnalysis.issues.filter(i => i.classification === "code_fix"),
                skippedIssues: aiAnalysis.issues.filter(i => i.classification !== "code_fix"),
            } : null,
            links,
        };
    } catch (err: any) {
        logger.error("❌ Manual Clarity report failed:", err);
        throw new HttpsError("internal", err.message || "Clarity report failed");
    }
});

// ─── Enhanced Chat Report (metrics + AI analysis) ────────────────────

async function postEnhancedReport(
    metrics: any,
    aiAnalysis: AIAnalysisResult | null,
    webhookUrl: string
): Promise<void> {
    const card = buildClarityChatCard(metrics);
    const links = getClarityLinks(metrics.daysQueried);

    // Append AI analysis sections to the existing card
    if (aiAnalysis && aiAnalysis.issues.length > 0) {
        const aiSections = buildAIAnalysisChatSection(aiAnalysis);
        card.sections.push(...aiSections);
    } else {
        // No spikes — add a clean bill of health
        card.sections.push({
            header: "🤖 AI Analysis",
            widgets: [{
                decoratedText: {
                    text: "No significant friction spikes detected — metrics within normal range ✅",
                    startIcon: { knownIcon: "INVITE" },
                },
            }],
        });
    }

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
