/**
 * Radar & Intent Triage Agent
 *
 * Evaluates inbound email replies and high-intent engagement signals using Gemini.
 *
 * 🛑 STRICT HUMAN BOUNDARY:
 * When positive interest, inquiry, or meeting request is detected:
 * 1. Immediately cancels all queued `outreach_queue` tasks + any Resend scheduled emails.
 * 2. Promotes the company to `qualified` in the active sales pipeline & marks contact `replied`.
 * 3. Sends a priority alert card directly to Google Chat with 1-click app.xiri.ai CRM link.
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { resolveGeminiModel } from "../utils/gemini";
import { getPrompt, DEFAULT_SDR_INTENT_TRIAGE_PROMPT } from "../utils/promptUtils";
import { sendCard, googleChatWebhookSecret } from "../utils/googleChatUtils";
import { cancelLeadTasks, cancelLeadScheduledEmails } from "../utils/queueUtils";
import { addToResendSuppression } from "../utils/suppressionUtils";

export interface IntentTriageResult {
    intent: string;
    isHotLead: boolean;
    confidence: number;
    summary: string;
    action: "hand_off_to_human" | "continue_drip" | "suppress_contact";
}

export async function classifyProspectIntent(params: {
    businessName: string;
    contactName?: string;
    contactTitle?: string;
    leadEmail: string;
    inboundContent: string;
    geminiApiKey: string;
}): Promise<IntentTriageResult> {
    try {
        const genAI = new GoogleGenerativeAI(params.geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: resolveGeminiModel("gemini-2.5-flash"),
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        });

        const prompt = await getPrompt("sdr_intent_triage", DEFAULT_SDR_INTENT_TRIAGE_PROMPT, {
            businessName: params.businessName,
            contactName: params.contactName || "Contact",
            contactTitle: params.contactTitle || "Office Manager",
            leadEmail: params.leadEmail,
            inboundContent: params.inboundContent,
        });

        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

        return {
            intent: parsed.intent || "ambiguous",
            isHotLead: !!parsed.isHotLead,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
            summary: parsed.summary || "Inbound prospect interaction recorded",
            action: parsed.action || (parsed.isHotLead ? "hand_off_to_human" : "continue_drip"),
        };
    } catch (err: any) {
        logger.error("[IntentTriage] Gemini classification error:", err);
        return {
            intent: "ambiguous",
            isHotLead: true,
            confidence: 0.5,
            summary: "Prospect replied — human review recommended.",
            action: "hand_off_to_human",
        };
    }
}

export async function executeHumanHandoff(params: {
    leadId: string;
    contactId?: string | null;
    businessName: string;
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    intentSummary: string;
    rawMessage?: string;
}): Promise<void> {
    logger.info(`[HumanHandoff] Executing handoff for lead ${params.leadId} (${params.businessName})...`);

    const now = new Date();

    // 1. Cancel all queued cold outreach tasks + legacy Resend scheduled emails
    const [cancelledQueue, cancelledResend] = await Promise.all([
        cancelLeadTasks(db, params.leadId),
        cancelLeadScheduledEmails(db, params.leadId, "companies"),
    ]);
    logger.info(`[HumanHandoff] Halted cold funnel: ${cancelledQueue} queue tasks + ${cancelledResend} Resend emails cancelled.`);

    // 2. Promote company to 'qualified' in canonical CRM
    await db.collection("companies").doc(params.leadId).set({
        status: "qualified",
        outreachStatus: "REPLIED",
        hotLeadHandoff: true,
        handoffSummary: params.intentSummary,
        handoffAt: now,
        updatedAt: now,
    }, { merge: true });

    // 3. Mark contact engagement as replied
    if (params.contactId) {
        await db.collection("contacts").doc(params.contactId).set({
            emailEngagement: {
                replied: true,
                repliedAt: now,
                lastEvent: "replied",
                lastEventAt: now,
            },
            updatedAt: now,
        }, { merge: true });
    }

    // 4. Log activity
    await db.collection("lead_activities").add({
        leadId: params.leadId,
        contactId: params.contactId || null,
        type: "HUMAN_HANDOFF",
        description: `Inbound reply triaged as HOT LEAD: ${params.intentSummary}`,
        createdAt: now,
        metadata: {
            summary: params.intentSummary,
            rawMessage: params.rawMessage || null,
            cancelledQueue,
            cancelledResend,
        },
    });

    // 5. Send priority Google Chat card linking to app.xiri.ai
    const crmUrl = `https://app.xiri.ai/sales/crm/${params.leadId}`;
    const card = {
        header: {
            title: "🚨 HOT LEAD — Dental/Ortho Reply",
            subtitle: `${params.businessName} • Promoted to Qualified`,
        },
        sections: [
            {
                widgets: [
                    {
                        decoratedText: {
                            topLabel: "DECISION MAKER",
                            text: `${params.contactName || "Office Manager"}${params.contactTitle ? ` (${params.contactTitle})` : ""}`,
                            startIcon: { knownIcon: "PERSON" },
                        },
                    },
                    ...(params.contactEmail ? [{
                        decoratedText: {
                            topLabel: "EMAIL",
                            text: params.contactEmail,
                            startIcon: { knownIcon: "EMAIL" },
                        },
                    }] : []),
                    {
                        decoratedText: {
                            topLabel: "INTENT SUMMARY",
                            text: params.intentSummary,
                            startIcon: { knownIcon: "STAR" },
                        },
                    },
                    ...(params.rawMessage ? [{
                        textParagraph: {
                            text: `<b>Reply Excerpt:</b> <i>"${params.rawMessage.slice(0, 260)}"</i>`,
                        },
                    }] : []),
                    {
                        buttonList: {
                            buttons: [
                                {
                                    text: "👉 Open Practice in app.xiri.ai",
                                    onClick: { openLink: { url: crmUrl } },
                                },
                            ],
                        },
                    },
                ],
            },
        ],
    };

    await sendCard(
        `lead_handoff_${params.leadId}`,
        card,
        `🚨 Hot Lead: ${params.businessName} (${params.contactName || "Decision Maker"}) replied: ${params.intentSummary} — ${crmUrl}`
    );
}

/**
 * Callable: Triage lead interaction on-demand from the dashboard
 */
export const triageLeadEngagement = onCall({
    secrets: ["GEMINI_API_KEY", "RESEND_API_KEY", googleChatWebhookSecret],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const data = request.data || {};
    const { leadId, contactId, businessName, contactName, contactTitle, contactEmail, inboundContent } = data;

    if (!leadId || !businessName || !inboundContent) {
        throw new HttpsError("invalid-argument", "Missing required triage fields: leadId, businessName, inboundContent.");
    }

    const triage = await classifyProspectIntent({
        businessName,
        contactName,
        contactTitle,
        leadEmail: contactEmail || "unknown",
        inboundContent,
        geminiApiKey: process.env.GEMINI_API_KEY!,
    });

    if (triage.isHotLead || triage.action === "hand_off_to_human") {
        await executeHumanHandoff({
            leadId,
            contactId: contactId || null,
            businessName,
            contactName,
            contactTitle,
            contactEmail,
            intentSummary: triage.summary,
            rawMessage: inboundContent,
        });
    } else if (triage.action === "suppress_contact") {
        await cancelLeadTasks(db, leadId);
        await cancelLeadScheduledEmails(db, leadId, "companies");
        if (contactId) {
            await db.collection("contacts").doc(contactId).set({
                unsubscribed: true,
                unsubscribedAt: new Date(),
                lifecycleStatus: "suppressed",
                suppressionReason: "reply_opt_out",
            }, { merge: true });
        }
        await db.collection("companies").doc(leadId).set({
            status: "lost",
            lostReason: "reply_opt_out",
            unsubscribedAt: new Date(),
        }, { merge: true });
        if (contactEmail) {
            await addToResendSuppression(contactEmail, "unsubscribed", {
                entityId: leadId,
                entityType: "lead",
                contactId: contactId || undefined,
            });
        }
    }

    return triage;
});

/**
 * HTTP Inbound Reply Webhook
 *
 * Accepts inbound email replies from Resend Inbound, Gmail/Workspace forwarding
 * webhooks, or Zapier/Make (`{ from, subject, text, html }`).
 * Matches the sender email against `contacts`, runs Gemini intent triage,
 * automatically halts active cold drips, promotes hot leads to `qualified`,
 * or suppresses opt-outs.
 */
export const inboundReplyWebhook = onRequest({
    cors: false,
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: ["GEMINI_API_KEY", "RESEND_API_KEY", googleChatWebhookSecret],
}, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }

    try {
        const payload = req.body?.data || req.body || {};
        const rawFrom: string = payload.from || payload.sender || payload.fromEmail || "";
        const emailMatch = rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const senderEmail = (emailMatch ? emailMatch[1] : rawFrom).trim().toLowerCase();
        const subject: string = payload.subject || "";
        const bodyText: string = payload.text || payload.body || payload.snippet ||
            (typeof payload.html === "string" ? payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

        if (!senderEmail || !bodyText) {
            res.status(400).json({ error: "Missing sender email or message body." });
            return;
        }

        // Look up matching contact by email
        const contactSnap = await db.collection("contacts")
            .where("email", "==", senderEmail)
            .limit(1)
            .get();

        if (contactSnap.empty) {
            logger.info(`[InboundReply] No CRM contact matched ${senderEmail} — ignoring.`);
            res.status(200).json({ ok: true, matched: false });
            return;
        }

        const contactDoc = contactSnap.docs[0];
        const contact = contactDoc.data();
        const companyId = contact.companyId;
        if (!companyId) {
            res.status(200).json({ ok: true, matched: false });
            return;
        }

        const companyDoc = await db.collection("companies").doc(companyId).get();
        const company = companyDoc.exists ? companyDoc.data()! : {};
        const businessName = company.businessName || contact.companyName || senderEmail;
        const contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name || "";

        // Log the raw inbound reply first
        await db.collection("lead_activities").add({
            leadId: companyId,
            contactId: contactDoc.id,
            type: "EMAIL_REPLIED",
            description: `Inbound email reply from ${senderEmail}: "${subject || "(no subject)"}"`,
            createdAt: new Date(),
            metadata: {
                from: senderEmail,
                subject,
                body: bodyText.slice(0, 2000),
            },
        });

        // Classify intent with Gemini
        const triage = await classifyProspectIntent({
            businessName,
            contactName,
            contactTitle: contact.title,
            leadEmail: senderEmail,
            inboundContent: `Subject: ${subject}\n\n${bodyText.slice(0, 2000)}`,
            geminiApiKey: process.env.GEMINI_API_KEY!,
        });

        if (triage.isHotLead || triage.action === "hand_off_to_human") {
            await executeHumanHandoff({
                leadId: companyId,
                contactId: contactDoc.id,
                businessName,
                contactName,
                contactTitle: contact.title,
                contactEmail: senderEmail,
                intentSummary: triage.summary,
                rawMessage: bodyText,
            });
        } else if (triage.action === "suppress_contact") {
            await cancelLeadTasks(db, companyId);
            await cancelLeadScheduledEmails(db, companyId, "companies");
            await db.collection("contacts").doc(contactDoc.id).set({
                unsubscribed: true,
                unsubscribedAt: new Date(),
                lifecycleStatus: "suppressed",
                suppressionReason: "reply_opt_out",
            }, { merge: true });
            await db.collection("companies").doc(companyId).set({
                status: "lost",
                lostReason: "reply_opt_out",
                unsubscribedAt: new Date(),
            }, { merge: true });
            await addToResendSuppression(senderEmail, "unsubscribed", {
                entityId: companyId,
                entityType: "lead",
                contactId: contactDoc.id,
            });
        } else {
            // Even for ambiguous / OOO replies, pause/cancel automated follow-up if needed or log clearly
            logger.info(`[InboundReply] ${senderEmail} triaged as ${triage.intent} (action=${triage.action}).`);
        }

        res.status(200).json({ ok: true, matched: true, companyId, contactId: contactDoc.id, triage });
    } catch (err: any) {
        logger.error("[InboundReply] Webhook error:", err);
        res.status(500).json({ error: err.message || "Internal error" });
    }
});
