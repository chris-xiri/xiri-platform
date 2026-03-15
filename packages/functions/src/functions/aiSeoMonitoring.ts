/**
 * AI SEO Monitoring — Weekly Bot Activity Digest
 *
 * Scheduled Cloud Function that runs every Monday at 9 AM ET.
 * Queries the `aiBotVisits` Firestore collection for the past 7 days,
 * aggregates by bot/org and page, then posts a rich card to Google Chat.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { db } from "../utils/firebase";

// ─── Config ──────────────────────────────────────────────────────────

const TIMEZONE = "America/New_York";
const AI_SEO_CHAT_WEBHOOK = defineSecret("AI_SEO_CHAT_WEBHOOK_URL");

/** Send a card to the AI & SEO Monitoring Google Chat space */
async function sendAISeoCard(card: any, fallbackText: string): Promise<void> {
    const webhookUrl = AI_SEO_CHAT_WEBHOOK.value();
    if (!webhookUrl) {
        console.log("⚠️ AI SEO Chat webhook not configured");
        return;
    }

    try {
        const resp = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: fallbackText,
                cardsV2: [{ cardId: `ai-seo-${Date.now()}`, card }],
            }),
        });
        if (!resp.ok) console.error(`AI SEO Chat webhook failed (${resp.status}):`, await resp.text());
    } catch (err) {
        console.error("AI SEO Chat webhook error:", err);
    }
}

/** Send plain text to the AI & SEO Monitoring space */
async function sendAISeoText(text: string): Promise<void> {
    const webhookUrl = AI_SEO_CHAT_WEBHOOK.value();
    if (!webhookUrl) {
        console.log("⚠️ AI SEO Chat webhook not configured");
        return;
    }

    try {
        const resp = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (!resp.ok) console.error(`AI SEO Chat text failed (${resp.status}):`, await resp.text());
    } catch (err) {
        console.error("AI SEO Chat text error:", err);
    }
}

// ─── Weekly Bot Activity Digest ──────────────────────────────────────

interface BotVisit {
    bot: string;
    org: string;
    path: string;
    timestamp: string;
    userAgent: string;
}

/**
 * Runs every Monday at 9:00 AM ET.
 * Aggregates AI bot visits from the past 7 days and posts a digest card.
 */
export const weeklyAIBotDigest = onSchedule({
    schedule: "0 9 * * 1",  // Every Monday at 9 AM
    timeZone: TIMEZONE,
    region: "us-central1",
    secrets: [AI_SEO_CHAT_WEBHOOK],
}, async () => {
    console.log("📊 Generating weekly AI bot activity digest...");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    // Query all bot visits from the past 7 days
    const visitsSnap = await db.collection("aiBotVisits")
        .where("timestamp", ">=", cutoff)
        .orderBy("timestamp", "desc")
        .get();

    if (visitsSnap.empty) {
        await sendAISeoText("📊 *Weekly AI Bot Report*\nNo AI bot activity detected in the past 7 days. Bots may not yet be crawling, or the middleware isn't deployed.");
        return;
    }

    const visits: BotVisit[] = visitsSnap.docs.map(d => d.data() as BotVisit);

    // ── Aggregate by bot/org ──
    const byOrg: Record<string, { bot: string; org: string; count: number; pages: Set<string> }> = {};
    const byPage: Record<string, number> = {};

    for (const v of visits) {
        const key = v.org || v.bot;
        if (!byOrg[key]) {
            byOrg[key] = { bot: v.bot, org: v.org, count: 0, pages: new Set() };
        }
        byOrg[key].count++;
        byOrg[key].pages.add(v.path);

        byPage[v.path] = (byPage[v.path] || 0) + 1;
    }

    // Sort by visit count
    const topBots = Object.values(byOrg).sort((a, b) => b.count - a.count);
    const topPages = Object.entries(byPage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    // ── Build Google Chat card ──
    const botLines = topBots
        .map(b => `<b>${b.bot}</b> (${b.org}): ${b.count.toLocaleString()} visits, ${b.pages.size} pages`)
        .join("<br>");

    const pageLines = topPages
        .map(([path, count]) => `• <b>${path}</b> — ${count}`)
        .join("<br>");

    const weekStart = sevenDaysAgo.toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: TIMEZONE,
    });
    const weekEnd = new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: TIMEZONE,
    });

    const card = {
        header: {
            title: "📊 Weekly AI Bot Report",
            subtitle: `${weekStart} – ${weekEnd}  •  ${visits.length.toLocaleString()} total visits`,
        },
        sections: [
            {
                header: "Bot Activity by Organization",
                widgets: [{
                    textParagraph: { text: botLines },
                }],
            },
            {
                header: "Most Crawled Pages",
                widgets: [{
                    textParagraph: { text: pageLines },
                }],
            },
            {
                widgets: [{
                    textParagraph: {
                        text: `<i>Data from ${visits.length} bot visits recorded in Firestore.</i>`,
                    },
                }],
            },
        ],
    };

    const fallback = `📊 Weekly AI Bot Report (${weekStart}–${weekEnd}): ${visits.length} visits from ${topBots.length} bots`;
    await sendAISeoCard(card, fallback);

    console.log(`✅ Weekly AI bot digest sent. ${visits.length} visits, ${topBots.length} bots.`);
});
