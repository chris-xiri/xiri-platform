/**
 * Imagen API (Vertex AI) — AI Image Generation for Social Media Posts
 * 
 * Generates branded images using Google's Imagen model via Vertex AI.
 * Images are stored in Cloud Storage and the URL is attached to the post.
 * 
 * Brand Colors (from BRAND_KIT.md):
 *   - Primary: #0369a1 (sky-700)
 *   - Primary Light: #0284c7 (sky-600)
 *   - Primary Dark: #0c4a6e (sky-900)
 *   - Accent: #38bdf8 (sky-400)
 *   - Tone: Professional, industrial, premium
 */

import { GoogleAuth } from "google-auth-library";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";
import { compositeImage } from "./brandOverlay";

const PROJECT_ID = "xiri-facility-solutions";
const LOCATION = "us-central1";

interface ImagenResult {
    imageUrl: string;        // Public URL
    storagePath: string;     // GCS path
}

// Diverse scene descriptions per audience — purely visual, no text references
const CLIENT_SCENES = [
    "Pristine modern medical office lobby with clean tile floors, polished reception desk, bright overhead lighting, potted plants, empty waiting area chairs neatly arranged",
    "Spotless auto dealership showroom floor, gleaming under bright lights, polished concrete, luxury vehicles visible in background, immaculate glass windows",
    "Modern commercial building hallway freshly cleaned, shining floors reflecting overhead lights, crisp white walls, professional maintenance",
    "Empty medical exam room, sanitized surfaces, organized supply cabinets, bright clinical lighting, freshly mopped floor",
    "Corporate office break room after professional cleaning, spotless countertops, organized cabinets, fresh flowers on table, warm natural light",
    "Aerial view of a well-maintained commercial building exterior, landscaped grounds, clean parking lot, blue sky",
    "Modern daycare facility interior, colorful but immaculate, organized toy shelves, clean play mats, bright cheerful lighting",
];

const CONTRACTOR_SCENES = [
    "Professional cleaning crew in matching blue uniforms working together in a commercial building hallway, pushing floor buffer machine, teamwork",
    "Close-up of janitorial equipment arranged neatly — mop bucket, floor buffer, cleaning supplies — professional grade tools ready for work",
    "Facility maintenance worker in blue safety gear inspecting HVAC system on commercial building rooftop, sunrise in background",
    "Team of contractors in hard hats and safety vests doing a walk-through inspection of a clean commercial space, clipboards in hand",
    "Professional floor technician operating an industrial floor scrubber in a large commercial space, shiny wet floor behind them",
    "Maintenance worker in blue uniform restocking supply closet in a commercial building, organized shelves, professional demeanor",
    "Night shift cleaning crew member vacuuming a darkened office space, overhead emergency lights creating dramatic lighting, dedication",
];

/**
 * Generate a branded social media image using Imagen
 */
export async function generatePostImage(
    postMessage: string,
    audience: "client" | "contractor",
    feedbackHint?: string,
): Promise<ImagenResult | null> {
    try {
        console.log(`[Imagen] Starting image generation for ${audience} post...`);

        const auth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();

        // Use feedback hint as scene description, or pick a random one
        let scene: string;
        if (feedbackHint) {
            scene = `${feedbackHint}. Professional commercial/facility setting`;
            console.log(`[Imagen] Using feedback hint: "${feedbackHint}"`);
        } else {
            const scenes = audience === "client" ? CLIENT_SCENES : CONTRACTOR_SCENES;
            scene = scenes[Math.floor(Math.random() * scenes.length)];
        }

        const imagePrompt = `Editorial photograph, shot on Canon EOS R5 with 35mm lens. ${scene}. Color grading: cool blue tones with deep navy shadows and bright sky blue highlights. Clean, sharp, professional corporate photography. Shallow depth of field. 1:1 square composition.`;

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
                    personGeneration: "allow_all",
                    negativePrompt: "text, letters, words, numbers, signs, signage, labels, captions, watermarks, logos, branding, graphic design, overlays, banners, typography, fonts, writing, handwriting, graffiti, posters, billboards, screen, monitor text, nametags, badges with text",
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
        const rawPhotoBuffer = Buffer.from(imageBase64, "base64");

        // Composite branded overlay onto the raw photo
        console.log(`[Imagen] Compositing branded overlay...`);
        const brandedBuffer = await compositeImage(rawPhotoBuffer, postMessage);

        const fileName = `social-images/${uuidv4()}.png`;
        const storageBucket = getStorage().bucket();
        const bucketName = storageBucket.name;
        const file = storageBucket.file(fileName);

        await file.save(brandedBuffer, {
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

        console.log(`[Imagen] Branded image generated and uploaded: ${imageUrl}`);
        return { imageUrl, storagePath: fileName };
    } catch (err: any) {
        console.error("[Imagen] Error generating image:", err.message);
        if (err.response?.data) {
            console.error("[Imagen] API error details:", JSON.stringify(err.response.data).slice(0, 1000));
        }
        return null;
    }
}
