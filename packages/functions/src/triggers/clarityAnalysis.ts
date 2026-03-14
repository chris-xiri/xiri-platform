/**
 * Clarity UX Analysis — Daily Scheduled Report
 *
 * Runs at 9:00 AM ET every day:
 *   1. Pulls last 3 days of Clarity metrics
 *   2. Posts a summary card with filtered Clarity links to Google Chat
 *   3. Logs the metrics to Firestore clarity_reports collection
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { db } from "../utils/firebase";
import {
    fetchClarityInsights,
    postClarityReportToChat,
    getClarityLinks,
} from "../utils/clarityUtils";

// ─── Secrets ─────────────────────────────────────────────────────────

const CLARITY_API_TOKEN = defineSecret("CLARITY_API_TOKEN");
const CLARITY_CHAT_WEBHOOK = defineSecret("CLARITY_CHAT_WEBHOOK_URL");

// ─── Constants ───────────────────────────────────────────────────────

const TIMEZONE = "America/New_York";

// ─── Scheduled: Daily UX Report ──────────────────────────────────────

export const dailyClarityReport = onSchedule({
    schedule: "0 9 * * *",   // 9:00 AM ET every day
    timeZone: TIMEZONE,
    region: "us-central1",
    secrets: [CLARITY_API_TOKEN, CLARITY_CHAT_WEBHOOK],
    timeoutSeconds: 60,
}, async () => {
    logger.info("📊 Starting daily Clarity report...");

    try {
        // 1. Fetch Clarity metrics (last 3 days)
        const metrics = await fetchClarityInsights(CLARITY_API_TOKEN.value(), 3);
        logger.info(`Clarity: ${metrics.totalSessions} sessions, ${metrics.deadClickCount} dead clicks, ${metrics.rageClickCount} rage clicks`);

        // 2. Post to Google Chat
        await postClarityReportToChat(metrics, CLARITY_CHAT_WEBHOOK.value());
        logger.info("✅ Posted to Google Chat");

        // 3. Log to Firestore
        await db.collection("clarity_reports").add({
            createdAt: new Date(),
            ...metrics,
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
    secrets: [CLARITY_API_TOKEN, CLARITY_CHAT_WEBHOOK],
    timeoutSeconds: 60,
}, async (request) => {
    const days = (request.data?.days as 1 | 2 | 3) || 3;
    const postToChat = request.data?.postToChat !== false;

    logger.info(`🧪 Manual Clarity report (${days} days, chat=${postToChat})`);

    try {
        const metrics = await fetchClarityInsights(CLARITY_API_TOKEN.value(), days);

        if (postToChat) {
            await postClarityReportToChat(metrics, CLARITY_CHAT_WEBHOOK.value());
        }

        // Log to Firestore
        await db.collection("clarity_reports").add({
            createdAt: new Date(),
            manual: true,
            ...metrics,
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
            links,
        };
    } catch (err: any) {
        logger.error("❌ Manual Clarity report failed:", err);
        throw new HttpsError("internal", err.message || "Clarity report failed");
    }
});
