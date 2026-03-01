/**
 * Reel Outro Frame Generator
 * 
 * Generates branded 1080×1920 (9:16) PNG "outro" frames for Facebook Reels.
 * Supports multiple CTA presets — each with different call-to-action text.
 * Uses sharp + SVG rendering — same approach as brandOverlay.ts.
 * 
 * Brand Colors (from BRAND_KIT.md):
 *   - Primary: #0369a1
 *   - Primary Light: #0284c7
 *   - Primary Dark: #0c4a6e
 *   - Accent: #38bdf8
 *   - Fonts: Arial/Helvetica (system-safe equivalent of Inter)
 */

import sharp from "sharp";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

const WIDTH = 1080;
const HEIGHT = 1920;

/**
 * Available outro presets — each has a unique CTA.
 * Add new presets here to make them available in the UI.
 */
export interface OutroPreset {
    id: string;
    label: string;       // Shown in the UI dropdown
    headline: string;    // Large text on the frame
    subline: string;     // Smaller text below
    ctaText: string;     // Call-to-action at the bottom
    accentColor?: string; // Override accent color (default #38bdf8)
}

export const OUTRO_PRESETS: OutroPreset[] = [
    {
        id: "hiring",
        label: "🧹 We're Hiring",
        headline: "Join the XIRI Team",
        subline: "Cleaning & Maintenance Contractors Needed",
        ctaText: "Apply Now → xiri.ai/careers",
    },
    {
        id: "quote",
        label: "💼 Get a Quote",
        headline: "Need Facility Services?",
        subline: "One Call. One Invoice. Total Coverage.",
        ctaText: "Free Quote → xiri.ai",
    },
    {
        id: "coverage",
        label: "📍 Service Areas",
        headline: "Serving Queens · Nassau · Suffolk",
        subline: "Medical • Dealerships • Daycare • Commercial",
        ctaText: "Book Now → xiri.ai",
    },
    {
        id: "partner",
        label: "🤝 Become a Partner",
        headline: "Grow Your Business with XIRI",
        subline: "Steady Work • Weekly Pay • Full Support",
        ctaText: "Sign Up → xiri.ai/partner",
    },
    {
        id: "brand",
        label: "✨ Brand Only",
        headline: "XIRI Facility Solutions",
        subline: "One Call. One Invoice. Total Facility Coverage.",
        ctaText: "xiri.ai",
    },
];

/**
 * Escape XML special characters for SVG text content
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Create the branded outro SVG frame for a given preset.
 */
function createOutroSvg(preset: OutroPreset): string {
    const cx = WIDTH / 2;
    const accent = preset.accentColor || "#38bdf8";

    return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <!-- Three-stop brand gradient background -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0c4a6e"/>
            <stop offset="40%" stop-color="#0369a1"/>
            <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
        <!-- Icon badge gradient -->
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
        <!-- Frosted glass card -->
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="white" stop-opacity="0.10"/>
            <stop offset="100%" stop-color="white" stop-opacity="0.04"/>
        </linearGradient>
    </defs>

    <!-- ═══ BACKGROUND ═══ -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bgGrad)"/>

    <!-- Subtle accent glow ellipses -->
    <ellipse cx="${WIDTH * 0.3}" cy="${HEIGHT * 0.35}" rx="400" ry="300" fill="rgba(56,189,248,0.06)"/>
    <ellipse cx="${WIDTH * 0.75}" cy="${HEIGHT * 0.65}" rx="350" ry="250" fill="rgba(56,189,248,0.05)"/>

    <!-- Subtle grid lines (decorative) -->
    <line x1="0" y1="${HEIGHT * 0.3}" x2="${WIDTH}" y2="${HEIGHT * 0.3}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <line x1="0" y1="${HEIGHT * 0.5}" x2="${WIDTH}" y2="${HEIGHT * 0.5}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <line x1="0" y1="${HEIGHT * 0.7}" x2="${WIDTH}" y2="${HEIGHT * 0.7}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <line x1="${WIDTH * 0.25}" y1="0" x2="${WIDTH * 0.25}" y2="${HEIGHT}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    <line x1="${WIDTH * 0.75}" y1="0" x2="${WIDTH * 0.75}" y2="${HEIGHT}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

    <!-- ═══ CENTER CONTENT ═══ -->

    <!-- Frosted glass card -->
    <rect x="${cx - 220}" y="${HEIGHT * 0.32}" width="440" height="400" rx="24" fill="url(#glassGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

    <!-- XIRI Icon Badge (large, centered) -->
    <rect x="${cx - 50}" y="${HEIGHT * 0.35}" width="100" height="100" rx="20" fill="url(#badgeGrad)"/>
    <text x="${cx}" y="${HEIGHT * 0.35 + 70}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="56" fill="white" text-anchor="middle" letter-spacing="-1">${escapeXml("X")}</text>

    <!-- XIRI Wordmark -->
    <text x="${cx}" y="${HEIGHT * 0.35 + 150}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="white" text-anchor="middle" letter-spacing="-2">${escapeXml("XIRI")}</text>

    <!-- Tagline: FACILITY SOLUTIONS -->
    <text x="${cx}" y="${HEIGHT * 0.35 + 185}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="18" fill="rgba(255,255,255,0.65)" text-anchor="middle" letter-spacing="5">${escapeXml("FACILITY SOLUTIONS")}</text>

    <!-- Divider line -->
    <line x1="${cx - 100}" y1="${HEIGHT * 0.35 + 215}" x2="${cx + 100}" y2="${HEIGHT * 0.35 + 215}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>

    <!-- Preset Headline -->
    <text x="${cx}" y="${HEIGHT * 0.35 + 260}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="white" text-anchor="middle" letter-spacing="0.5">${escapeXml(preset.headline)}</text>

    <!-- Preset Subline -->
    <text x="${cx}" y="${HEIGHT * 0.35 + 300}" font-family="Arial, Helvetica, sans-serif" font-weight="300" font-size="22" fill="rgba(255,255,255,0.8)" text-anchor="middle" letter-spacing="0.5">${escapeXml(preset.subline)}</text>

    <!-- ═══ CTA SECTION ═══ -->

    <!-- CTA pill background -->
    <rect x="${cx - 200}" y="${HEIGHT * 0.72}" width="400" height="60" rx="30" fill="${accent}" opacity="0.9"/>

    <!-- CTA text -->
    <text x="${cx}" y="${HEIGHT * 0.72 + 38}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="white" text-anchor="middle" letter-spacing="0.5">${escapeXml(preset.ctaText)}</text>

    <!-- ═══ BOTTOM ═══ -->
    <!-- Accent stripe at bottom -->
    <rect x="0" y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="${accent}" opacity="0.85"/>
</svg>`;
}

/**
 * Generate a branded outro frame as a PNG buffer for a given preset.
 */
export async function generateOutroFrame(presetId: string = "brand"): Promise<Buffer> {
    const preset = OUTRO_PRESETS.find(p => p.id === presetId) || OUTRO_PRESETS[OUTRO_PRESETS.length - 1];
    console.log(`[ReelOutro] Generating outro frame: "${preset.label}" (${preset.id})`);

    const svg = createOutroSvg(preset);
    const svgBuffer = Buffer.from(svg);

    const pngBuffer = await sharp(svgBuffer)
        .resize(WIDTH, HEIGHT)
        .png({ quality: 90 })
        .toBuffer();

    console.log(`[ReelOutro] Outro frame generated: ${(pngBuffer.length / 1024).toFixed(0)}KB`);
    return pngBuffer;
}

/**
 * Generate and upload an outro frame to Cloud Storage.
 * Each preset is cached separately.
 */
export async function getOrCreateOutroFrameUrl(presetId: string = "brand"): Promise<string> {
    const storageBucket = getStorage().bucket();
    const bucketName = storageBucket.name;
    const outroPath = `social-assets/reel-outro-${presetId}.png`;
    const file = storageBucket.file(outroPath);

    const [exists] = await file.exists();
    if (exists) {
        console.log(`[ReelOutro] Using cached outro frame for preset: ${presetId}`);
        return `https://storage.googleapis.com/${bucketName}/${outroPath}`;
    }

    const pngBuffer = await generateOutroFrame(presetId);
    await file.save(pngBuffer, {
        metadata: {
            contentType: "image/png",
            metadata: {
                firebaseStorageDownloadTokens: uuidv4(),
            },
        },
    });
    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucketName}/${outroPath}`;
    console.log(`[ReelOutro] Outro frame uploaded: ${url}`);
    return url;
}

/**
 * Invalidate cached outro frames (e.g. when brand is updated).
 * Deletes all cached outro PNGs so they get regenerated on next use.
 */
export async function invalidateOutroCache(): Promise<void> {
    const storageBucket = getStorage().bucket();
    for (const preset of OUTRO_PRESETS) {
        const file = storageBucket.file(`social-assets/reel-outro-${preset.id}.png`);
        const [exists] = await file.exists();
        if (exists) {
            await file.delete();
            console.log(`[ReelOutro] Deleted cached outro: ${preset.id}`);
        }
    }
}
