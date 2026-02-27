/**
 * Veo 3 API (Vertex AI) — AI Video Generation for Social Media Reels
 * 
 * Generates short-form branded videos with audio using Google's Veo 3 model.
 * Videos are stored in Cloud Storage and the URL is attached to the draft.
 * 
 * Model: veo-3.0-generate-001 (full model with audio generation)
 * Output: 9:16 vertical video (Facebook/Instagram Reels format)
 * Audio: Includes generated background music, SFX, and ambient sound
 */

import { GoogleGenAI } from "@google/genai";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

const PROJECT_ID = "xiri-facility-solutions";
const LOCATION = "us-central1";
const BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const GCS_OUTPUT_PREFIX = `gs://${BUCKET}/social-videos`;

interface VeoResult {
    videoUrl: string;           // Public HTTPS URL
    storagePath: string;        // GCS path for reuse
    durationSeconds: number;    // Video duration
}

/**
 * Generate a branded reel video using Veo 3 (with audio)
 */
export async function generateReelVideo(
    caption: string,
    audience: "client" | "contractor",
    location?: string,
): Promise<VeoResult | null> {
    try {
        const client = new GoogleGenAI({
            vertexai: true,
            project: PROJECT_ID,
            location: LOCATION,
        });

        // Build the video prompt based on audience and location
        const locationContext = location
            ? `Location: ${location}, New York. Include visual cues of the local area — storefronts, streets, or building exteriors that feel authentic to ${location}.`
            : "Location: Long Island / Queens, New York. Include typical suburban commercial area visuals.";

        const audienceScene = audience === "client"
            ? `Scene: A well-maintained commercial building or medical office. Show clean, bright interiors —  
polished floors, organized reception areas, spotless exam rooms or waiting areas.
A confident facility manager walks through, inspecting the quality of work.
Mood: Professional, reassuring, "everything is handled." 
Details: Show before/after cleaning contrast, a clipboard check, or a manager shaking hands with a satisfied client.`
            : `Scene: A professional cleaning crew or maintenance team arriving at a commercial building at dawn or dusk.
Show them gearing up — putting on uniforms, loading equipment, working as a coordinated team.
Mood: Blue-collar pride, teamwork, steady reliable work.
Details: Show satisfying cleaning moments — buffing floors to a shine, organized supply carts, the team high-fiving after a job well done.`;

        const videoPrompt = `Short-form vertical video for a facility management company's social media reel.

Style: Cinematic, warm color grading, professional b-roll look. Vertical 9:16 format.
Brand: XIRI Facility Solutions — professional facility management for medical offices, auto dealerships, and commercial buildings.
Color palette: Navy blue (#075985) and sky blue (#0ea5e9) accents where natural (uniforms, signage, equipment).

${audienceScene}

${locationContext}

Audio: Upbeat, motivational background music suitable for a professional business reel. 
Confident, modern feel — not generic stock music.

Context from caption: ${caption.slice(0, 300)}

Important: NO text overlays, NO watermarks, NO logos. Pure visual storytelling with audio.
Duration: 8 seconds. Smooth camera movements. Professional quality.`;

        console.log(`[Veo] Starting video generation for ${audience} reel${location ? ` in ${location}` : ""}...`);

        const outputId = uuidv4();
        const outputGcsUri = `${GCS_OUTPUT_PREFIX}/${outputId}`;

        // Start the video generation
        let operation = await client.models.generateVideos({
            model: "veo-3.0-generate-001",
            prompt: videoPrompt,
            config: {
                aspectRatio: "9:16",
                outputGcsUri: outputGcsUri,
            },
        });

        // Poll until complete (Veo takes ~2-3 minutes)
        let pollCount = 0;
        const maxPolls = 30; // 30 * 15s = 7.5 min max wait
        while (!operation.done && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            operation = await client.operations.get({ operation });
            pollCount++;
            console.log(`[Veo] Poll ${pollCount}/${maxPolls} — ${operation.done ? "DONE" : "generating..."}`);
        }

        if (!operation.done) {
            console.error("[Veo] Video generation timed out after 7.5 minutes");
            return null;
        }

        if (!operation.response?.generatedVideos?.[0]?.video?.uri) {
            console.error("[Veo] No video generated in response");
            return null;
        }

        const videoGcsUri = operation.response.generatedVideos[0].video.uri;
        console.log(`[Veo] Video generated at: ${videoGcsUri}`);

        // The video is already in our GCS bucket — make it publicly accessible
        const gcsPath = videoGcsUri.replace(`gs://${BUCKET}/`, "");
        const bucket = getStorage().bucket(BUCKET);
        const file = bucket.file(gcsPath);

        await file.makePublic();
        const videoUrl = `https://storage.googleapis.com/${BUCKET}/${gcsPath}`;

        console.log(`[Veo] Video publicly available at: ${videoUrl}`);
        return {
            videoUrl,
            storagePath: gcsPath,
            durationSeconds: 8, // Veo default
        };
    } catch (err: any) {
        console.error("[Veo] Error generating video:", err.message);
        return null;
    }
}
