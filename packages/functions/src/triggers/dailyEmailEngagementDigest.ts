/**
 * Daily Email Engagement Digest — Google Chat Notification
 *
 * Scans lead activities from the last 24 hours and posts a structured
 * executive digest to Google Chat via incoming webhook at 5:00 PM ET daily.
 * Highlights high-intent actions (link clicks, multiple opens) so human sales
 * can follow up immediately.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { db } from "../utils/firebase";
import { getWebhookUrl, googleChatWebhookSecret } from "../utils/googleChatUtils";

interface DigestMetrics {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    engagedLeads: Map<string, {
        leadId: string;
        businessName: string;
        email: string;
        facilityType?: string;
        openCount: number;
        clickCount: number;
        lastClickUrl?: string;
        lastEventAt: Date;
    }>;
}

export async function generateEngagementDigest(hoursBack = 24): Promise<{ text: string; hasActivity: boolean }> {
    const sinceDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    logger.info(`[EmailDigest] Gathering outreach engagement since ${sinceDate.toISOString()}`);

    // Query recent lead activities
    const activitiesSnap = await db.collection("lead_activities")
        .where("createdAt", ">=", sinceDate)
        .orderBy("createdAt", "desc")
        .limit(500)
        .get();

    const metrics: DigestMetrics = {
        sent: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        engagedLeads: new Map(),
    };

    const leadIdsToFetch = new Set<string>();

    activitiesSnap.forEach(doc => {
        const d = doc.data();
        const type = (d.type || "").toUpperCase();
        const meta = d.metadata || {};
        const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now());

        if (type.includes("SENT")) metrics.sent++;
        if (type.includes("BOUNCE") || d.description?.includes("bounced")) metrics.bounced++;
        if (type.includes("UNSUBSCRIBE") || d.description?.includes("unsubscribed")) metrics.unsubscribed++;

        const isClick = type.includes("CLICK") || d.description?.includes("clicked");
        const isOpen = type.includes("OPEN") || d.description?.includes("opened");

        if (isOpen) metrics.opened++;
        if (isClick) metrics.clicked++;

        if (d.leadId && (isOpen || isClick)) {
            leadIdsToFetch.add(d.leadId);
            if (!metrics.engagedLeads.has(d.leadId)) {
                metrics.engagedLeads.set(d.leadId, {
                    leadId: d.leadId,
                    businessName: "Prospect",
                    email: meta.to || meta.email || "",
                    openCount: 0,
                    clickCount: 0,
                    lastEventAt: createdAt,
                });
            }

            const record = metrics.engagedLeads.get(d.leadId)!;
            if (isOpen) record.openCount++;
            if (isClick) {
                record.clickCount++;
                if (meta.url || meta.link) record.lastClickUrl = meta.url || meta.link;
            }
            if (createdAt > record.lastEventAt) {
                record.lastEventAt = createdAt;
            }
        }
    });

    // Populate company names for engaged leads
    if (leadIdsToFetch.size > 0) {
        const leadDocs = await Promise.all(
            Array.from(leadIdsToFetch).slice(0, 30).map(id => db.collection("companies").doc(id).get())
        );

        leadDocs.forEach(docSnap => {
            if (docSnap.exists) {
                const data = docSnap.data()!;
                const record = metrics.engagedLeads.get(docSnap.id);
                if (record) {
                    record.businessName = data.businessName || "Unknown Business";
                    record.facilityType = data.facilityType;
                }
            }
        });
    }

    const hasActivity = metrics.sent > 0 || metrics.opened > 0 || metrics.clicked > 0;

    // Build formatted message for Google Chat
    const lines: string[] = [
        `📬 *Daily Prospect Outreach & Engagement Digest*`,
        `_Activity over the last ${hoursBack} hours (as of ${new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true })} ET)_`,
        ``,
        `📊 *Summary Metrics*:`,
        `• *Emails Sent*: ${metrics.sent}`,
        `• *Opens*: ${metrics.opened}`,
        `• *Clicks*: ${metrics.clicked}`,
        `• *Unsubscribes*: ${metrics.unsubscribed}`,
        `• *Bounces*: ${metrics.bounced}`,
        ``,
    ];

    // High Intent Clicks Section
    const clickedLeads = Array.from(metrics.engagedLeads.values()).filter(l => l.clickCount > 0);
    if (clickedLeads.length > 0) {
        lines.push(`🔥 *HIGH INTENT: Prospect Clicks (Hand-off to Human)*:`);
        clickedLeads.forEach(l => {
            const timeStr = l.lastEventAt.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
            lines.push(`• *${l.businessName}* (${l.email || "No email"})`);
            lines.push(`  🖱️ Clicked ${l.clickCount} time(s) at ${timeStr}`);
            lines.push(`  🔗 <https://app.xiri.ai/sales/crm/${l.leadId}|Open Lead in CRM>`);
        });
        lines.push(``);
    }

    // Opens Section
    const openedOnlyLeads = Array.from(metrics.engagedLeads.values()).filter(l => l.clickCount === 0 && l.openCount > 0);
    if (openedOnlyLeads.length > 0) {
        lines.push(`👀 *Prospect Opens*:`);
        openedOnlyLeads.slice(0, 15).forEach(l => {
            const timeStr = l.lastEventAt.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
            lines.push(`• *${l.businessName}* ${l.facilityType ? `_(${l.facilityType})_` : ""}: ${l.openCount} open(s) — Last at ${timeStr}`);
        });
        if (openedOnlyLeads.length > 15) {
            lines.push(`  _...and ${openedOnlyLeads.length - 15} more opens._`);
        }
        lines.push(``);
    }

    if (!hasActivity) {
        lines.push(`_No email activity recorded in the last ${hoursBack} hours._`);
    }

    return { text: lines.join("\n"), hasActivity };
}

/**
 * Send digest directly to Google Chat
 */
export async function sendDigestToGoogleChat(hoursBack = 24): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
        logger.warn("[EmailDigest] GOOGLE_CHAT_WEBHOOK_URL is not configured.");
        return { success: false, error: "Webhook not configured" };
    }

    try {
        const { text } = await generateEngagementDigest(hoursBack);
        const resp = await fetch(
            `${webhookUrl}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    thread: { threadKey: `email_engagement_${new Date().toISOString().split("T")[0]}` },
                }),
            }
        );

        if (!resp.ok) {
            const errText = await resp.text();
            logger.error(`[EmailDigest] Google Chat webhook failed (${resp.status}): ${errText}`);
            return { success: false, error: errText };
        }

        logger.info("[EmailDigest] Digest posted successfully to Google Chat.");
        return { success: true };
    } catch (err: any) {
        logger.error("[EmailDigest] Error posting digest to Google Chat:", err);
        return { success: false, error: err.message };
    }
}

// ── Scheduled Trigger: Runs daily at 5:00 PM ET ───────────────────────
export const dailyEmailEngagementDigest = onSchedule({
    schedule: "every day 17:00",
    timeZone: "America/New_York",
    secrets: [googleChatWebhookSecret],
}, async () => {
    logger.info("[EmailDigest] Starting daily 5:00 PM ET email engagement digest...");
    await sendDigestToGoogleChat(24);
});

// ── Callable Trigger: Run on demand from Dashboard / CLI ──────────────
export const triggerDailyEngagementDigest = onCall({
    secrets: [googleChatWebhookSecret],
}, async (request) => {
    const hoursBack = request.data?.hoursBack || 24;
    logger.info(`[EmailDigest] Manual trigger requested for last ${hoursBack} hours.`);
    return await sendDigestToGoogleChat(hoursBack);
});
