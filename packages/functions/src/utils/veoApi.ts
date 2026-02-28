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

        const videoPrompt = `Cinematic short-form vertical video, shot on professional camera with smooth gimbal movement.

${audienceScene}

${locationContext}

Audio: Upbeat, motivational background music with a modern corporate feel. Include ambient sound effects matching the scene.

Style: Professional b-roll footage, warm color grading with cool blue shadows, clean and polished look. Vertical 9:16 format.
Duration: 8 seconds. Smooth tracking shots. Professional quality. No text, no titles, no graphics — pure visual storytelling with audio.`;

        console.log(`[Veo] Starting video generation for ${audience} reel${location ? ` in ${location}` : ""}...`);

        // Start the video generation
        let operation = await client.models.generateVideos({
            model: "veo-3.0-generate-001",
            prompt: videoPrompt,
            config: {
                aspectRatio: "9:16",
                numberOfVideos: 1,
            },
        });

        // Poll until complete using the correct SDK method
        let pollCount = 0;
        const maxPolls = 30; // 30 * 15s = 7.5 min max wait
        while (!operation.done && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 15000));
            operation = await client.operations.getVideosOperation({ operation });
            pollCount++;
            console.log(`[Veo] Poll ${pollCount}/${maxPolls} — ${operation.done ? "DONE" : "generating..."}`);
        }

        if (!operation.done) {
            console.error("[Veo] Video generation timed out after 7.5 minutes");
            return null;
        }

        // Debug: log the full response structure
        console.log("[Veo] Response keys:", JSON.stringify(Object.keys(operation.response || {})));
        const generatedVideos = operation.response?.generatedVideos;
        console.log("[Veo] generatedVideos count:", generatedVideos?.length || 0);
        if (generatedVideos?.[0]) {
            console.log("[Veo] First video keys:", JSON.stringify(Object.keys(generatedVideos[0])));
            if (generatedVideos[0].video) {
                console.log("[Veo] Video object keys:", JSON.stringify(Object.keys(generatedVideos[0].video)));
            }
        }

        if (!generatedVideos?.[0]?.video) {
            console.error("[Veo] No video generated in response");
            console.error("[Veo] Full response:", JSON.stringify(operation.response, null, 2).slice(0, 2000));
            return null;
        }

        const video = generatedVideos[0].video;

        // Try to get video via URI (Vertex AI with outputGcsUri)
        if (video.uri) {
            console.log(`[Veo] Video URI: ${video.uri}`);
            const storageBucket = getStorage().bucket();
            const bucketName = storageBucket.name;
            const gcsPath = video.uri.replace(`gs://${bucketName}/`, "");
            const file = storageBucket.file(gcsPath);
            await file.makePublic();
            const videoUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
            console.log(`[Veo] Video publicly available at: ${videoUrl}`);
            return { videoUrl, storagePath: gcsPath, durationSeconds: 8 };
        }

        // Fallback: download via SDK and upload to our bucket
        if (video.videoBytes) {
            console.log("[Veo] Using videoBytes fallback (downloading from SDK)...");
            const videoBuffer = Buffer.from(video.videoBytes, "base64");
            const fileName = `social-videos/${uuidv4()}.mp4`;
            const storageBucket = getStorage().bucket();
            const bucketName = storageBucket.name;
            const file = storageBucket.file(fileName);
            await file.save(videoBuffer, {
                metadata: {
                    contentType: "video/mp4",
                    metadata: { firebaseStorageDownloadTokens: uuidv4() },
                },
            });
            await file.makePublic();
            const videoUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            console.log(`[Veo] Video uploaded via bytes fallback: ${videoUrl}`);
            return { videoUrl, storagePath: fileName, durationSeconds: 8 };
        }


        console.error("[Veo] No usable video data found in response (no uri or videoBytes)");
        return null;
    } catch (err: any) {
        console.error("[Veo] Error generating video:", err.message);
        console.error("[Veo] Full error:", JSON.stringify(err, null, 2).slice(0, 1000));
        return null;
    }
}
