import { onCall } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DASHBOARD_CORS } from "../utils/cors";

interface ParseCalculatorPromptRequest {
    prompt: string;
}

interface ParsedCalculatorPrompt {
    buildingTypeId?: string;
    stateCode?: string;
    county?: "nassau" | "suffolk" | "queens" | "other" | "unknown";
    sqft?: number;
    frequency?: "once" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
    productionRate?: number;
    replaceRooms?: boolean;
    rooms?: Array<{
        roomTypeId?: string;
        sqft?: number;
        tasks?: string[];
    }>;
    taskMinutesPer1kOverrides?: Record<string, number>;
}

const BUILDING_TYPE_IDS = [
    "office",
    "medical",
    "school",
    "retail",
    "restaurant",
    "warehouse",
    "church",
    "gym",
    "bank",
    "daycare",
    "hotel",
    "auto-dealer",
    "salon",
    "movie-theater",
    "residential",
] as const;

const ROOM_TYPE_IDS = [
    "lobby",
    "offices",
    "restrooms",
    "hallways",
    "kitchen",
    "conference",
    "patient",
    "common",
    "warehouse",
    "exterior",
    "custom",
] as const;

const TASK_IDS = [
    "trash",
    "dust",
    "wipe",
    "glass-entry",
    "high-touch-disinfect",
    "restroom-clean",
    "restroom-restock",
    "restroom-fixture-detail",
    "vacuum",
    "mop",
    "sweep",
    "dust-mop",
    "auto-scrub",
    "dust-treated",
    "wipe-disinfect-surfaces",
    "detail-crevice",
    "glass-panel-clean",
    "handrail-wipe",
    "mat-vacuum",
    "stair-damp-mop",
    "elevator-spot-clean",
    "solution-fill-1gal",
    "solution-fill-5gal",
    "solution-fill-20gal",
    "sprayer-empty-rinse",
    "dustmop-cleanup",
    "mopbucket-cleanup",
    "vacuum-cleanup",
    "change-dustmop",
    "change-wetmop",
    "cord-wrap",
    "travel-walk-slow",
    "travel-walk-standard",
    "travel-machine-rider",
    "breakroom",
    "glass-interior",
    "high-dust",
    "floor-wax",
    "carpet-extract",
    "pressure-wash",
] as const;

function safeJsonParse(text: string): ParsedCalculatorPrompt {
    const trimmed = text.trim();
    const codeFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = codeFence?.[1] ?? trimmed;
    const parsed = JSON.parse(candidate) as ParsedCalculatorPrompt;
    return parsed || {};
}

function sanitizeParsedOutput(input: ParsedCalculatorPrompt): ParsedCalculatorPrompt {
    const out: ParsedCalculatorPrompt = {};

    if (input.buildingTypeId && BUILDING_TYPE_IDS.includes(input.buildingTypeId as (typeof BUILDING_TYPE_IDS)[number])) {
        out.buildingTypeId = input.buildingTypeId;
    }
    if (input.stateCode && /^[A-Z]{2}$/.test(input.stateCode)) {
        out.stateCode = input.stateCode;
    }
    if (input.county && ["nassau", "suffolk", "queens", "other", "unknown"].includes(input.county)) {
        out.county = input.county;
    }
    if (typeof input.sqft === "number" && Number.isFinite(input.sqft) && input.sqft >= 100) {
        out.sqft = Math.round(input.sqft);
    }
    if (input.frequency && ["once", "1", "2", "3", "4", "5", "6", "7"].includes(input.frequency)) {
        out.frequency = input.frequency;
    }
    if (typeof input.productionRate === "number" && Number.isFinite(input.productionRate) && input.productionRate > 0) {
        out.productionRate = Math.round(input.productionRate);
    }
    if (typeof input.replaceRooms === "boolean") {
        out.replaceRooms = input.replaceRooms;
    }
    if (Array.isArray(input.rooms)) {
        const sanitizedRooms = input.rooms
            .map((room) => {
                const next: { roomTypeId?: string; sqft?: number; tasks?: string[] } = {};
                if (room?.roomTypeId && ROOM_TYPE_IDS.includes(room.roomTypeId as (typeof ROOM_TYPE_IDS)[number])) {
                    next.roomTypeId = room.roomTypeId;
                }
                if (typeof room?.sqft === "number" && Number.isFinite(room.sqft) && room.sqft >= 0) {
                    next.sqft = Math.round(room.sqft);
                }
                if (Array.isArray(room?.tasks)) {
                    const tasks = room.tasks.filter((t) => TASK_IDS.includes(t as (typeof TASK_IDS)[number]));
                    if (tasks.length > 0) next.tasks = tasks;
                }
                return next;
            })
            .filter((r) => r.roomTypeId || r.sqft || (r.tasks && r.tasks.length > 0));
        if (sanitizedRooms.length > 0) out.rooms = sanitizedRooms;
    }
    if (input.taskMinutesPer1kOverrides && typeof input.taskMinutesPer1kOverrides === "object") {
        const overrides: Record<string, number> = {};
        for (const [taskId, value] of Object.entries(input.taskMinutesPer1kOverrides)) {
            if (!TASK_IDS.includes(taskId as (typeof TASK_IDS)[number])) continue;
            if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
            overrides[taskId] = Math.round(value * 100) / 100;
        }
        if (Object.keys(overrides).length > 0) out.taskMinutesPer1kOverrides = overrides;
    }

    return out;
}

/**
 * Hybrid parser helper for calculator wizard:
 * Uses a low-cost Gemini model for structured extraction when deterministic parsing is insufficient.
 */
export const parseCalculatorPrompt = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
    memory: "256MiB",
}, async (request) => {
    const data = request.data as ParseCalculatorPromptRequest;
    const prompt = data?.prompt?.trim();
    if (!prompt) {
        return { parsed: {} as ParsedCalculatorPrompt };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("[parseCalculatorPrompt] GEMINI_API_KEY not set; returning empty parse");
        return { parsed: {} as ParsedCalculatorPrompt };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const extractionPrompt = `
Extract structured fields from this janitorial bid text and return ONLY valid JSON.

Allowed JSON keys:
- buildingTypeId: one of ${BUILDING_TYPE_IDS.join(", ")}
- stateCode: 2-letter US code (uppercase)
- county: one of nassau|suffolk|queens|other|unknown
- sqft: integer
- frequency: one of once|1|2|3|4|5|6|7
- productionRate: integer
- replaceRooms: boolean (true if user asks to rebuild/replace cleaning scope)
- rooms: array of { roomTypeId, sqft, tasks[] }
  - roomTypeId must be one of ${ROOM_TYPE_IDS.join(", ")}
  - tasks entries must be from ${TASK_IDS.join(", ")}
- taskMinutesPer1kOverrides: object of taskId -> minutesPer1k

Rules:
- Infer stateCode from clear full state names (e.g., "new jersey" -> "NJ").
- Infer county only when clearly mentioned.
- For "5x per week" map frequency to "5". For "daily" -> "7". For one-time/deep clean -> "once".
- If user asks to change/add/remove zones/rooms, express that in rooms (+ replaceRooms when appropriate).
- If user asks to tune ISSA task rates, return taskMinutesPer1kOverrides.
- If uncertain on any key, omit it.
- Return JSON object only; no markdown.

Input:
${prompt}
`.trim();

    const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
    ];

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 420,
                    topP: 0.8,
                },
            });

            const result = await model.generateContent(extractionPrompt);
            const text = result.response.text();
            const parsed = sanitizeParsedOutput(safeJsonParse(text));
            return { parsed };
        } catch (error: any) {
            console.error(`[parseCalculatorPrompt] ${modelName} failed:`, error?.message || error);
        }
    }

    return { parsed: {} as ParsedCalculatorPrompt };
});
