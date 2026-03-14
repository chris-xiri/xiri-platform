/**
 * Google Chat Integration — Thread-per-Job Notifications
 *
 * Format B: Cards for key events, inline text for zone scans.
 * Posts to #XIRI-Ops-Center via incoming webhook.
 * One thread per site per night (threadKey = siteLocationId_YYYY-MM-DD).
 */

import { db } from "./firebase";
import { defineSecret } from "firebase-functions/params";

// ─── Config ──────────────────────────────────────────────────────────

const TIMEZONE = "America/New_York";
const COMMAND_CENTER_URL = "https://app.xiri.ai/operations/command-center";

const googleChatWebhookSecret = defineSecret("GOOGLE_CHAT_WEBHOOK_URL");

function getWebhookUrl(): string {
    return googleChatWebhookSecret.value()
        || process.env.GOOGLE_CHAT_WEBHOOK_URL
        || "";
}

// ─── Thread Key ──────────────────────────────────────────────────────

export function makeThreadKey(siteLocationId: string, date?: Date): string {
    const d = date || new Date();
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    return `shift_${siteLocationId}_${dateStr}`;
}

// ─── User Resolution & Mentions ──────────────────────────────────────

interface UserInfo {
    name: string | null;
    googleUserId: string | null;
}

async function getUserInfo(uid: string): Promise<UserInfo> {
    if (!uid) return { name: null, googleUserId: null };
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return { name: null, googleUserId: null };
        const data = userDoc.data()!;
        return {
            name: data.displayName || data.email || null,
            googleUserId: data.googleUserId || null,
        };
    } catch { return { name: null, googleUserId: null }; }
}

/** Format a @mention — returns `<users/ID>` or bold name if no ID */
function mention(user: UserInfo): string {
    if (user.googleUserId) return `<users/${user.googleUserId}>`;
    if (user.name) return `*@${user.name}*`;
    return "";
}

/** Build labeled mention text like "FSM: @name\nNight Manager: @name" */
function buildMentionText(users: TaggedUsers): string {
    const lines: string[] = [];
    const nmTag = mention(users.nightManager);
    const fmTag = mention(users.fm);
    if (fmTag) lines.push(`FSM: ${fmTag}`);
    if (nmTag) lines.push(`Night Manager: ${nmTag}`);
    return lines.join("\n");
}

export interface TaggedUsers {
    nightManager: UserInfo;
    fm: UserInfo;
}

export async function resolveTaggedUsers(workOrderId: string): Promise<TaggedUsers> {
    const result: TaggedUsers = {
        nightManager: { name: null, googleUserId: null },
        fm: { name: null, googleUserId: null },
    };
    if (!workOrderId) return result;
    try {
        const woDoc = await db.collection("work_orders").doc(workOrderId).get();
        if (!woDoc.exists) return result;
        const wo = woDoc.data()!;
        if (wo.assignedNightManagerId) {
            result.nightManager = await getUserInfo(wo.assignedNightManagerId);
            // Prefer work order name if available
            if (wo.assignedNightManagerName) result.nightManager.name = wo.assignedNightManagerName;
        }
        if (wo.assignedFsmId) {
            result.fm = await getUserInfo(wo.assignedFsmId);
        }
    } catch (err) { console.error("resolveTaggedUsers error:", err); }
    return result;
}

// ─── Core Send Functions ─────────────────────────────────────────────

/** Send a plain text message into a thread — used for zone scans & reminders */
export async function sendText(threadKey: string, text: string): Promise<void> {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) { console.log("⚠️ Chat webhook not configured"); return; }

    try {
        const resp = await fetch(
            `${webhookUrl}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, thread: { threadKey } }),
            }
        );
        if (!resp.ok) console.error(`Chat webhook failed (${resp.status}):`, await resp.text());
    } catch (err) { console.error("Chat webhook error:", err); }
}

async function sendCard(threadKey: string, card: any, fallbackText?: string): Promise<void> {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) { console.log("⚠️ Chat webhook not configured"); return; }

    try {
        const resp = await fetch(
            `${webhookUrl}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: fallbackText || "",
                    cardsV2: [{ cardId: `xiri-${Date.now()}`, card }],
                    thread: { threadKey },
                }),
            }
        );
        if (!resp.ok) console.error(`Chat card failed (${resp.status}):`, await resp.text());
    } catch (err) { console.error("Chat card error:", err); }
}

/** Format time like "7:02 PM" */
function fmtTime(date?: Date): string {
    return (date || new Date()).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIMEZONE,
    });
}

/** Format date like "Friday, March 13" */
function fmtDate(date?: Date): string {
    return (date || new Date()).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", timeZone: TIMEZONE,
    });
}

// ─── CARD Messages (Key Events) ──────────────────────────────────────

/**
 * 🏁 Shift Started — CARD. Tags NM + FM.
 */
export async function notifyShiftStarted(params: {
    siteLocationId: string;
    locationName: string;
    crewName: string;
    crewPhone?: string | null;
    workOrderId?: string;
}): Promise<void> {
    const threadKey = makeThreadKey(params.siteLocationId);
    let nmWidget: any = null;

    let users: TaggedUsers | null = null;
    if (params.workOrderId) {
        users = await resolveTaggedUsers(params.workOrderId);
        if (users.nightManager.name) {
            nmWidget = {
                decoratedText: {
                    topLabel: "NIGHT MANAGER",
                    text: users.nightManager.name,
                    startIcon: { knownIcon: "MEMBERSHIP" },
                },
            };
        }
    }

    const crewText = params.crewPhone
        ? `${params.crewName}  •  ${params.crewPhone}`
        : params.crewName;

    const widgets: any[] = [
        {
            decoratedText: {
                topLabel: "CREW",
                text: crewText,
                startIcon: { knownIcon: "PERSON" },
            },
        },
        {
            decoratedText: {
                topLabel: "CLOCKED IN",
                text: fmtTime(),
                startIcon: { knownIcon: "CLOCK" },
            },
        },
    ];
    if (nmWidget) widgets.push(nmWidget);

    const sections: any[] = [{ widgets }];

    // Add Call Crew button if phone is available
    if (params.crewPhone) {
        sections.push({
            widgets: [{
                buttonList: {
                    buttons: [
                        {
                            text: "📞 Call Crew",
                            onClick: { openLink: { url: `tel:${params.crewPhone}` } },
                        },
                        {
                            text: "💬 Text Crew",
                            onClick: { openLink: { url: `sms:${params.crewPhone}` } },
                        },
                    ],
                },
            }],
        });
    }

    sections.push({
        widgets: [{
            textParagraph: {
                text: "<i>This thread tracks all compliance alerts for tonight's shift.</i>",
            },
        }],
    });

    const card = {
        header: {
            title: "🏁  Shift Started",
            subtitle: `${params.locationName}  •  ${fmtDate()}`,
        },
        sections,
    };

    sendCard(threadKey, card, users ? buildMentionText(users) : "").catch(console.error);
}

/**
 * ✅ Shift Verified — CARD. Tags FM.
 */
export async function notifyShiftVerified(params: {
    siteLocationId: string;
    locationName: string;
    managerName: string;
    auditScore?: number;
    workOrderId?: string;
}): Promise<void> {
    const threadKey = makeThreadKey(params.siteLocationId);
    let users: TaggedUsers | null = null;

    if (params.workOrderId) {
        users = await resolveTaggedUsers(params.workOrderId);
    }

    const scoreStr = params.auditScore ? `Score: ${params.auditScore}/5 ⭐` : "";
    const widgets: any[] = [
        {
            decoratedText: {
                topLabel: "REVIEWED BY",
                text: `${params.managerName} (Night Manager)`,
                startIcon: { knownIcon: "PERSON" },
            },
        },
        {
            decoratedText: {
                topLabel: "VERIFIED AT",
                text: fmtTime(),
                startIcon: { knownIcon: "CLOCK" },
            },
        },
    ];

    const card = {
        header: {
            title: "✅  Shift Verified",
            subtitle: `${params.locationName}  •  ${fmtDate()}  •  ${scoreStr}`,
        },
        sections: [
            { widgets },
            {
                widgets: [{
                    buttonList: {
                        buttons: [{
                            text: "View in Command Center",
                            onClick: { openLink: { url: COMMAND_CENTER_URL } },
                        }],
                    },
                }],
            },
        ],
    };

    sendCard(threadKey, card, users ? buildMentionText(users) : "").catch(console.error);
}

/**
 * ⚠️ Late Warning — CARD. Tags NM + FM.
 */
export async function notifyLateWarning(params: {
    siteLocationId: string;
    locationName: string;
    expectedTime: string;
    workOrderId: string;
    vendorName?: string;
    vendorPhone?: string;
}): Promise<void> {
    const threadKey = makeThreadKey(params.siteLocationId);
    const users = await resolveTaggedUsers(params.workOrderId);

    const widgets: any[] = [
        {
            decoratedText: {
                topLabel: "EXPECTED BY",
                text: params.expectedTime,
                startIcon: { knownIcon: "CLOCK" },
            },
        },
        {
            decoratedText: {
                topLabel: "CURRENT TIME",
                text: fmtTime(),
                startIcon: { knownIcon: "CLOCK" },
            },
        },
    ];

    // Add vendor info if available
    if (params.vendorName) {
        widgets.push({
            decoratedText: {
                topLabel: "VENDOR",
                text: params.vendorName,
                startIcon: { knownIcon: "PERSON" },
            },
        });
    }

    if (users.nightManager.name) {
        widgets.push({
            decoratedText: {
                topLabel: "NIGHT MANAGER",
                text: users.nightManager.name,
                startIcon: { knownIcon: "MEMBERSHIP" },
            },
        });
    }

    const sections: any[] = [{ widgets }];

    // Add Call/Text buttons if vendor phone is available
    if (params.vendorPhone) {
        sections.push({
            widgets: [{
                buttonList: {
                    buttons: [
                        {
                            text: "\ud83d\udcde Call Vendor",
                            onClick: { openLink: { url: `tel:${params.vendorPhone}` } },
                        },
                        {
                            text: "\ud83d\udcac Text Vendor",
                            onClick: { openLink: { url: `sms:${params.vendorPhone}` } },
                        },
                    ],
                },
            }],
        });
    }

    const card = {
        header: {
            title: "\u26a0\ufe0f  No Check-In Yet",
            subtitle: `${params.locationName}  \u2022  ${fmtDate()}`,
        },
        sections,
    };

    sendCard(threadKey, card, buildMentionText(users)).catch(console.error);
}

/**
 * 🔴 No-Show — CARD. Tags NM + FM.
 */
export async function notifyNoShow(params: {
    siteLocationId: string;
    locationName: string;
    vendorName: string;
    vendorPhone?: string;
    expectedTime: string;
    workOrderId: string;
}): Promise<void> {
    const threadKey = makeThreadKey(params.siteLocationId);
    const users = await resolveTaggedUsers(params.workOrderId);

    const widgets: any[] = [
        {
            decoratedText: {
                topLabel: "VENDOR",
                text: params.vendorName,
                startIcon: { knownIcon: "PERSON" },
            },
        },
        {
            decoratedText: {
                topLabel: "EXPECTED BY",
                text: params.expectedTime,
                startIcon: { knownIcon: "CLOCK" },
            },
        },
        {
            textParagraph: {
                text: "<b>Action needed:</b> Contact crew lead or dispatch backup.",
            },
        },
    ];

    const sections: any[] = [{ widgets }];

    // Add Call/Text buttons
    const buttons: any[] = [];
    if (params.vendorPhone) {
        buttons.push(
            {
                text: "\ud83d\udcde Call Vendor",
                onClick: { openLink: { url: `tel:${params.vendorPhone}` } },
            },
            {
                text: "\ud83d\udcac Text Vendor",
                onClick: { openLink: { url: `sms:${params.vendorPhone}` } },
            },
        );
    }
    buttons.push({
        text: "Open Command Center",
        onClick: { openLink: { url: COMMAND_CENTER_URL } },
    });
    sections.push({
        widgets: [{ buttonList: { buttons } }],
    });

    const card = {
        header: {
            title: "\ud83d\udd34  NO-SHOW",
            subtitle: `${params.locationName}  \u2022  ${fmtDate()}`,
        },
        sections,
    };

    sendCard(threadKey, card, buildMentionText(users)).catch(console.error);
}

// ─── INLINE TEXT Messages (Zone Scans & Clock-Outs) ──────────────────

/** ✅ Zone scanned — inline text */
export function notifyZoneScanned(params: {
    siteLocationId: string;
    zoneName: string;
    zonesCompleted: number;
    zonesTotal: number;
}): void {
    const threadKey = makeThreadKey(params.siteLocationId);
    sendText(threadKey, `✅ ${params.zoneName} _(${params.zonesCompleted}/${params.zonesTotal})_`).catch(console.error);
}

/** 🧹 All zones complete — inline text */
export function notifyAllZonesDone(params: {
    siteLocationId: string;
    locationName: string;
}): void {
    const threadKey = makeThreadKey(params.siteLocationId);
    sendText(threadKey, `🧹 *All zones complete* — ${params.locationName}`).catch(console.error);
}

/** 🕐 Cleaner clocked out — inline text */
export function notifyCleanerClockOut(params: {
    siteLocationId: string;
    locationName: string;
    crewName: string;
}): void {
    const threadKey = makeThreadKey(params.siteLocationId);
    sendText(threadKey, `🕐 Crew clocked out — ${params.crewName} at ${fmtTime()}`).catch(console.error);
}

/** 🔍 Night Manager on-site — inline text */
export function notifyManagerClockIn(params: {
    siteLocationId: string;
    locationName: string;
    managerName: string;
}): void {
    const threadKey = makeThreadKey(params.siteLocationId);
    sendText(threadKey, `🔍 Night Manager *${params.managerName}* on-site`).catch(console.error);
}

/** 📋 Manager audited a zone — inline text */
export function notifyManagerAuditZone(params: {
    siteLocationId: string;
    zoneName: string;
    zonesCompleted: number;
    zonesTotal: number;
}): void {
    const threadKey = makeThreadKey(params.siteLocationId);
    sendText(threadKey, `📋 Audit: *${params.zoneName}* reviewed _(${params.zonesCompleted}/${params.zonesTotal})_`).catch(console.error);
}

export { googleChatWebhookSecret };
