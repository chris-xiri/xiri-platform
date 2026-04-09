/**
 * AI Sequence Generator
 * Uses Gemini 3.1 Pro to generate complete email sequences from a description.
 * The system prompt is stored in Firestore `prompts/sequence_generator`.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DASHBOARD_CORS } from "../utils/cors";
import { getPrompt } from "../utils/promptUtils";

const FALLBACK_SYSTEM_PROMPT = `You are an expert B2B email copywriter for XIRI Facility Solutions, a commercial cleaning and facility management platform based in New York.

Your job is to generate a complete multi-step email outreach sequence targeting a specific segment of businesses.

XIRI's value proposition:
- Commercial cleaning bidding platform that connects facilities with vetted janitorial vendors
- AI-powered vendor matching, quality assurance via NFC check-ins, and transparent pricing
- Serves medical offices, dialysis centers, religious centers, gyms, daycares, offices, and more

Available merge variables (use these in templates with {{variable}} syntax):
- {{contactName}} — The contact's full name
- {{contactFirstName}} — The contact's first name
- {{businessName}} — The business/facility name
- {{facilityType}} — Type of facility (e.g., "Medical Office", "Religious Center")
- {{address}} — Facility address
- {{squareFootage}} — Facility size

Guidelines:
1. Write professional but warm emails — not overly salesy
2. Keep emails concise (3-5 short paragraphs max)
3. Each email should have a clear, specific call to action
4. Later emails in the sequence should reference the previous ones (e.g., "I wanted to follow up...")
5. Use merge variables naturally — don't force them where they don't fit
6. Subject lines should be compelling but not clickbaity
7. First email is an intro, middle emails add value/social proof, final email is a breakup/last-chance

Return your response as valid JSON with this exact structure:
{
  "name": "Sequence name",
  "description": "Brief description of the sequence",
  "steps": [
    {
      "label": "Step 1 — Introduction",
      "dayOffset": 0,
      "subject": "Email subject line with optional {{variables}}",
      "body": "Full email body text with optional {{variables}}"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code fences, no explanation.`;

interface GenerateRequest {
    prompt: string;
    category: "lead" | "vendor" | "referral" | "custom";
    numSteps: number;
    tone: "professional" | "friendly" | "direct";
}

interface GeneratedStep {
    label: string;
    dayOffset: number;
    subject: string;
    body: string;
}

interface GeneratedSequence {
    name: string;
    description: string;
    steps: GeneratedStep[];
}

export const generateAISequence = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 120,
}, async (request) => {
    const data = request.data as GenerateRequest;

    if (!data.prompt || !data.prompt.trim()) {
        throw new HttpsError("invalid-argument", "A prompt describing the target segment is required.");
    }

    const numSteps = data.numSteps || 4;
    const tone = data.tone || "professional";
    const category = data.category || "lead";

    // Get the system prompt from Firestore (with hardcoded fallback)
    const systemPrompt = await getPrompt("sequence_generator", FALLBACK_SYSTEM_PROMPT);

    const userPrompt = `Generate a ${numSteps}-step email sequence for the following segment:

Target: ${data.prompt}
Category: ${category}
Tone: ${tone}
Number of steps: ${numSteps}

Space the emails out naturally (e.g., Day 0, Day 3, Day 7, Day 14, etc.).`;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-pro-preview",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.8,
            },
        });

        const result = await model.generateContent([
            { text: systemPrompt },
            { text: userPrompt },
        ]);

        const responseText = result.response.text();

        // Parse the JSON response
        let parsed: GeneratedSequence;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            // Try to extract JSON from markdown code fences
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1].trim());
            } else {
                console.error("[generateAISequence] Failed to parse response:", responseText.slice(0, 500));
                throw new HttpsError("internal", "AI returned invalid JSON. Please try again.");
            }
        }

        // Validate structure
        if (!parsed.name || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
            throw new HttpsError("internal", "AI returned incomplete sequence data. Please try again.");
        }

        // Normalize step labels
        parsed.steps = parsed.steps.map((step, idx) => ({
            label: step.label || `Step ${idx + 1}`,
            dayOffset: typeof step.dayOffset === "number" ? step.dayOffset : idx * 3,
            subject: step.subject || "",
            body: step.body || "",
        }));

        return {
            sequence: {
                name: parsed.name,
                description: parsed.description || "",
                category,
                steps: parsed.steps,
            },
        };
    } catch (error: any) {
        if (error instanceof HttpsError) throw error;
        console.error("[generateAISequence] Error:", error);
        throw new HttpsError("internal", error.message || "Failed to generate sequence.");
    }
});
