/**
 * Radar & Intent Triage Agent
 * 
 * Listens for inbound email replies, high-intent link clicks, and engagement.
 * Evaluates prospect intent using Gemini.
 * 
 * 🛑 STRICT HUMAN BOUNDARY:
 * When positive interest, inquiry, or meeting request is detected:
 * 1. Immediately halts and cancels all automated cold sequence tasks.
 * 2. Promotes the lead to `qualified` in the active sales pipeline.
 * 3. Sends a priority alert card directly to Google Chat with 1-click CRM link for Chris.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { resolveGeminiModel } from "../utils/gemini";
import { getPrompt, DEFAULT_SDR_INTENT_TRIAGE_PROMPT } from "../utils/promptUtils";
import { sendCard, googleChatWebhookSecret } from "../utils/googleChatUtils";

export interface IntentTriageResult {
    intent: string;
    isHotLead: boolean;
    confidence: number;
    summary: string;
    action: "hand_off_to_human" | "continue_drip" | "suppress_contact";
}

/**
 * Classify prospect intent using Gemini 2.5 Flash
 */
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
        const parsed = JSON.parse(raw);

        return {
            intent: parsed.intent || "ambiguous",
            isHotLead: !!parsed.isHotLead,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
            summary: parsed.summary || "Inbound prospect interaction recorded",
            action: parsed.action || (parsed.isHotLead ? "hand_off_to_human" : "continue_drip"),
        };
    } catch (err: any) {
        logger.error("[IntentTriage] Gemini classification error:", err);
        // Fail-safe: if any error happens on incoming reply, treat as hot lead for human safety
        return {
            intent: "ambiguous",
            isHotLead: true,
            confidence: 0.5,
            summary: "Prospect replied — review recommended.",
            action: "hand_off_to_human",
        };
    }
}

/**
 * Execute the strict human handoff:
 * 1. Cancel pending cold drip tasks
 * 2. Promote lead to CRM pipeline 'qualified'
 * 3. Dispatch Google Chat priority alert
 */
export async function executeHumanHandoff(params: {
    leadId: string;
    businessName: string;
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    intentSummary: string;
    rawMessage?: string;
}): Promise<void> {
    logger.info(`[HumanHandoff] Executing handoff for lead ${params.leadId} (${params.businessName})...`);

    // 1. Cancel all queued cold outreach tasks for this lead
    const pendingTasksSnap = await db.collection("outreach_tasks")
        .where("leadId", "==", params.leadId)
        .where("status", "in", ["PENDING", "PROCESSING"])
        .get();

    if (!pendingTasksSnap.empty) {
        const batch = db.batch();
        pendingTasksSnap.forEach(taskDoc => {
            batch.update(taskDoc.ref, {
                status: "CANCELLED",
                cancelledReason: "human_handoff_promoted",
                cancelledAt: new Date(),
            });
        });
        await batch.commit();
        logger.info(`[HumanHandoff] Cancelled ${pendingTasksSnap.size} pending cold tasks for lead ${params.leadId}.`);
    }

    // 2. Promote lead in companies/leads collection
    await db.collection("companies").doc(params.leadId).set({
        status: "qualified",
        hotLeadHandoff: true,
        handoffSummary: params.intentSummary,
        handoffAt: new Date(),
        updatedAt: new Date(),
    }, { merge: true });

    // 3. Log activity
    await db.collection("lead_activities").add({
        leadId: params.leadId,
        type: "HUMAN_HANDOFF",
        description: `Autonomous SDR handed off lead: ${params.intentSummary}`,
        createdAt: new Date(),
        metadata: {
            summary: params.intentSummary,
            rawMessage: params.rawMessage || null,
        }
    });

    // 4. Send priority Google Chat card
    const crmUrl = `https://admin.xiri.com/crm/leads/${params.leadId}`;
    const card = {
        header: {
            title: "🚨  HOT LEAD — Human Handoff",
            subtitle: `${params.businessName} • Active Sales Pipeline`,
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
                    {
                        decoratedText: {
                            topLabel: "INTENT / SIGNAL",
                            text: params.intentSummary,
                            startIcon: { knownIcon: "STAR" },
                        },
                    },
                    ...(params.rawMessage ? [{
                        textParagraph: {
                            text: `<b>Prospect Note:</b> <i>"${params.rawMessage.slice(0, 200)}"</i>`,
                        }
                    }] : []),
                    {
                        buttonList: {
                            buttons: [
                                {
                                    text: "👉 Open Lead in CRM",
                                    onClick: { openLink: { url: crmUrl } },
                                },
                            ],
                        },
                    },
                ],
            },
        ],
    };

    await sendCard(`lead_handoff_${params.leadId}`, card, `🚨 Hot Lead: ${params.businessName} (${params.contactName || "Decision Maker"}) is interested: ${params.intentSummary} — ${crmUrl}`);
}

/**
 * Callable: Triage lead interaction on-demand or from webhooks
 */
export const triageLeadEngagement = onCall({
    secrets: ["GEMINI_API_KEY", googleChatWebhookSecret],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const data = request.data || {};
    const { leadId, businessName, contactName, contactTitle, contactEmail, inboundContent } = data;

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
            businessName,
            contactName,
            contactTitle,
            contactEmail,
            intentSummary: triage.summary,
            rawMessage: inboundContent,
        });
    }

    return triage;
});
