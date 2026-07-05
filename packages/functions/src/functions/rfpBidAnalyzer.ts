import { onCall } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DASHBOARD_CORS } from "../utils/cors";
import { db } from "../utils/firebase";
import { resolveGeminiModel } from "../utils/gemini";
import {
    buildRfpDraft,
    normalizeBidExtraction,
    scoreBids,
    type BidExtractionCandidate,
    type BidRow,
    type RfpLeadPayload,
    type RfpInput,
} from "@xiri-facility-solutions/shared";

interface ParseRfpBriefRequest {
    brief: string;
}

interface GenerateRfpRequest {
    input: RfpInput;
}

interface ExtractBidDataRequest {
    content: string;
}

interface SubmitRfpLeadRequest {
    payload: RfpLeadPayload;
}

function safeJsonParse<T>(text: string, fallback: T): T {
    try {
        const trimmed = text.trim();
        const codeFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        const candidate = codeFence?.[1] ?? trimmed;
        return (JSON.parse(candidate) as T) || fallback;
    } catch {
        return fallback;
    }
}

function sanitizeRfpInput(input: Partial<RfpInput>): RfpInput {
    return {
        facilityName: input.facilityName?.trim() || undefined,
        picName: input.picName?.trim() || undefined,
        picEmail: input.picEmail?.trim() || undefined,
        zipCode: input.zipCode?.trim() || undefined,
        facilityType: input.facilityType?.trim() || "Commercial Office",
        location: input.location?.trim() || "Queens, NY",
        estimatedSqft: Math.max(500, Math.round(input.estimatedSqft || 10000)),
        cleaningFrequency: input.cleaningFrequency || "weekdays",
        serviceWindow: input.serviceWindow?.trim() || "After-hours",
        requiredServices: Array.isArray(input.requiredServices) ? input.requiredServices.filter(Boolean).slice(0, 20) : [],
        complianceRequirements: Array.isArray(input.complianceRequirements) ? input.complianceRequirements.filter(Boolean).slice(0, 20) : [],
        slaRequirements: Array.isArray(input.slaRequirements) ? input.slaRequirements.filter(Boolean).slice(0, 20) : [],
        transitionDate: input.transitionDate?.trim() || undefined,
        incumbentPainPoints: Array.isArray(input.incumbentPainPoints) ? input.incumbentPainPoints.filter(Boolean).slice(0, 20) : [],
    };
}

function sanitizeRfpLeadPayload(payload: Partial<RfpLeadPayload>): RfpLeadPayload {
    return {
        source: "janitorial_rfp_tool",
        idempotencyKey: payload.idempotencyKey?.trim() || "",
        requestedXiri: Boolean(payload.requestedXiri),
        facilityName: payload.facilityName?.trim() || undefined,
        facilityType: payload.facilityType?.trim() || "Commercial Office",
        location: payload.location?.trim() || "Queens, NY",
        zipCode: payload.zipCode?.trim() || "",
        estimatedSqft: Math.max(500, Math.round(payload.estimatedSqft || 10000)),
        serviceWindow: payload.serviceWindow?.trim() || "After-hours",
        transitionDate: payload.transitionDate?.trim() || undefined,
        picName: payload.picName?.trim() || "",
        picEmail: payload.picEmail?.trim() || "",
        scopeBrief: payload.scopeBrief?.trim() || undefined,
    };
}

export const parseRfpBrief = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (request) => {
    const data = request.data as ParseRfpBriefRequest;
    const brief = data?.brief?.trim();
    if (!brief) return { parsed: null };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { parsed: sanitizeRfpInput({}) };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolveGeminiModel("gemini-2.5-flash") });
    const prompt = `
Extract janitorial RFP fields from this brief and return ONLY valid JSON.
Use keys:
- facilityName (string)
- facilityType (string)
- location (string)
- estimatedSqft (number)
- cleaningFrequency ("daily"|"weekdays"|"3x_week"|"2x_week"|"weekly"|"custom")
- serviceWindow (string)
- requiredServices (string[])
- complianceRequirements (string[])
- slaRequirements (string[])
- transitionDate (string, optional)
- incumbentPainPoints (string[])

If unknown, use reasonable defaults for a Queens facility manager.
Input:
${brief}
`.trim();

    try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const parsed = safeJsonParse<Partial<RfpInput>>(raw, {});
        return { parsed: sanitizeRfpInput(parsed) };
    } catch {
        return { parsed: sanitizeRfpInput({}) };
    }
});

export const generateRfp = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 20,
    memory: "256MiB",
}, async (request) => {
    const data = request.data as GenerateRfpRequest;
    const input = sanitizeRfpInput(data?.input || {});
    const draft = buildRfpDraft(input);
    return { draft };
});

export const extractBidData = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (request) => {
    const data = request.data as ExtractBidDataRequest;
    const content = data?.content?.trim();
    if (!content) return { candidate: null };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const fallback = normalizeBidExtraction({ notes: content.slice(0, 300) });
        return { candidate: fallback, confidence: { overall: 0.35 } };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolveGeminiModel("gemini-2.5-flash") });
    const prompt = `
Extract bid details from this janitorial proposal text. Return ONLY valid JSON with:
- vendorName (string)
- monthlyPrice (number or null)
- scopeCompleteness (0-100)
- staffingPlanQuality (0-100)
- qaReportingQuality (0-100)
- complianceConfidence (0-100)
- transitionPlanQuality (0-100)
- notes (string)
- confidence (object with overall 0-1 and optional per-field)

Content:
${content}
`.trim();

    try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const parsed = safeJsonParse<{ confidence?: Record<string, number> } & BidExtractionCandidate>(raw, {});
        const candidate = normalizeBidExtraction(parsed);
        const confidence = parsed.confidence ?? { overall: 0.65 };
        return { candidate, confidence };
    } catch {
        const fallback = normalizeBidExtraction({ notes: content.slice(0, 300) });
        return { candidate: fallback, confidence: { overall: 0.4 } };
    }
});

export const scoreBidRows = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 20,
    memory: "256MiB",
}, async (request) => {
    const rows = (request.data?.rows || []) as BidRow[];
    const normalizedRows = rows.map((row) => normalizeBidExtraction(row));
    const scored = scoreBids(normalizedRows);
    return { scored };
});

export const submitRfpLead = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 20,
    memory: "256MiB",
}, async (request) => {
    const data = request.data as SubmitRfpLeadRequest;
    const payload = sanitizeRfpLeadPayload(data?.payload || {});
    if (!payload.idempotencyKey) return { success: false, error: "Missing idempotency key." };
    if (!payload.picName) return { success: false, error: "PIC name is required." };
    if (!payload.picEmail) return { success: false, error: "PIC email is required." };
    if (!payload.zipCode) return { success: false, error: "ZIP code is required." };

    const leadRef = db.collection("rfpLeads").doc(payload.idempotencyKey);
    const existing = await leadRef.get();
    if (existing.exists) {
        const existingData = existing.data() as { requestedXiri?: boolean } | undefined;
        if (payload.requestedXiri && !existingData?.requestedXiri) {
            await leadRef.set({
                requestedXiri: true,
                requestedXiriAt: new Date().toISOString(),
            }, { merge: true });
            return { success: true, deduped: false, upgraded: true, leadId: existing.id };
        }
        return { success: true, deduped: true, leadId: existing.id };
    }

    await leadRef.set({
        status: "new",
        source: payload.source,
        requestedXiri: Boolean(payload.requestedXiri),
        requestedXiriAt: payload.requestedXiri ? new Date().toISOString() : null,
        facilityName: payload.facilityName || null,
        facilityType: payload.facilityType,
        location: payload.location,
        zipCode: payload.zipCode,
        estimatedSqft: payload.estimatedSqft,
        serviceWindow: payload.serviceWindow,
        transitionDate: payload.transitionDate || null,
        picName: payload.picName,
        picEmail: payload.picEmail,
        scopeBrief: payload.scopeBrief || null,
        createdAt: new Date().toISOString(),
    });

    return { success: true, deduped: false, leadId: leadRef.id };
});
