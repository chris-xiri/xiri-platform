/**
 * Imagen API (Vertex AI) — AI Image Generation for Social Media Posts
 * 
 * Generates branded images using Google's Imagen model via Vertex AI.
 * Images are stored in Cloud Storage and the URL is attached to the post.
 * 
 * Brand Colors:
 *   - Primary: #075985 (sky-800)
 *   - Accent: #0ea5e9 (sky-500)  
 *   - Dark BG: #0C4A6E (sky-900)
 *   - White text on dark backgrounds
 */

import { GoogleAuth } from "google-auth-library";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

const PROJECT_ID = "xiri-facility-solutions";
const LOCATION = "us-central1";

interface ImagenResult {
    imageUrl: string;        // Public URL
    storagePath: string;     // GCS path
}

/**
 * Generate a branded social media image using Imagen
 */
export async function generatePostImage(
    postMessage: string,
    audience: "client" | "contractor",
): Promise<ImagenResult | null> {
    try {
        console.log(`[Imagen] Starting image generation for ${audience} post...`);

        const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();

        // Build the image prompt based on audience and post content
        const brandContext = audience === "client"
            ? "Clean, modern commercial building interior, professional medical office or auto dealership, well-maintained facility, bright lighting, organized workspace"
            : "Professional contractor team at work, commercial cleaning crew, facility maintenance, safety gear, blue-collar pride, teamwork";

        const imagePrompt = `Professional social media graphic for a facility management company.
Style: Modern, corporate, high-quality photography look. 
Color palette: Deep navy blue (#075985), bright sky blue (#0ea5e9), white, with clean design.
Scene: ${brandContext}.
Context from post: ${postMessage.slice(0, 200)}
Requirements: NO text overlays, NO logos, NO watermarks. Photorealistic, 1:1 square aspect ratio. Professional, premium feel.`;

        const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagen-3.0-generate-002:predict`;

        console.log(`[Imagen] Calling endpoint: ${endpoint}`);

        const response = await client.request({
            url: endpoint,
            method: "POST",
            data: {
                instances: [{ prompt: imagePrompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1",
                    safetyFilterLevel: "block_few",
                },
            },
        });

        console.log(`[Imagen] API response status: ${(response as any).status}`);
        const predictions = (response.data as any)?.predictions;
        console.log(`[Imagen] Predictions count: ${predictions?.length || 0}`);

        if (!predictions || predictions.length === 0) {
            console.error("[Imagen] No predictions returned");
            console.error("[Imagen] Response data keys:", JSON.stringify(Object.keys(response.data as any || {})));
            return null;
        }

        const imageBase64 = predictions[0].bytesBase64Encoded;
        if (!imageBase64) {
            console.error("[Imagen] No image data in prediction");
            console.error("[Imagen] Prediction keys:", JSON.stringify(Object.keys(predictions[0])));
            return null;
        }

        // Upload to Cloud Storage
        const imageBuffer = Buffer.from(imageBase64, "base64");
        const fileName = `social-images/${uuidv4()}.png`;
        const storageBucket = getStorage().bucket();
        const bucketName = storageBucket.name;
        const file = storageBucket.file(fileName);

        await file.save(imageBuffer, {
            metadata: {
                contentType: "image/png",
                metadata: {
                    firebaseStorageDownloadTokens: uuidv4(),
                },
            },
        });

        // Make file publicly readable
        await file.makePublic();
        const imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

        console.log(`[Imagen] Image generated and uploaded: ${imageUrl}`);
        return { imageUrl, storagePath: fileName };
    } catch (err: any) {
        console.error("[Imagen] Error generating image:", err.message);
        if (err.response?.data) {
            console.error("[Imagen] API error details:", JSON.stringify(err.response.data).slice(0, 1000));
        }
        return null;
    }
}
