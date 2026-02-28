/**
 * Brand Overlay — Composite branded text onto AI-generated photos
 * 
 * Uses `sharp` to overlay an SVG layer containing brand elements
 * (logo text, headline, CTA, gradient bars) onto a clean photo.
 * 
 * Brand Colors (from BRAND_KIT.md):
 *   - Primary: #0369a1
 *   - Primary Dark: #0c4a6e
 *   - Accent: #38bdf8
 *   - Fonts: Arial/Helvetica (system-safe equivalent of Inter)
 */

import sharp from "sharp";

// ─── Text Helpers ────────────────────────────────────────────────────────

/**
 * Extract a short headline from the post message.
 * Takes the first sentence, emoji line, or first ~80 chars.
 */
export function extractHeadline(postMessage: string): string {
    // Remove hashtags
    const cleaned = postMessage
        .replace(/#\w+/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();

    // Split into lines and find the first meaningful one
    const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return "Professional Facility Solutions";

    // Use first line as headline (usually the hook)
    let headline = lines[0];

    // Remove leading emojis for cleaner text but keep trailing ones
    headline = headline.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\s]+/u, "");

    // Truncate to ~70 chars max at word boundary
    if (headline.length > 70) {
        headline = headline.slice(0, 70).replace(/\s+\S*$/, "") + "…";
    }

    return headline || "Professional Facility Solutions";
}

/**
 * Wrap text into lines that fit a max character width.
 * Returns array of line strings.
 */
function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxChars) {
            currentLine += (currentLine ? " " : "") + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines max
    if (lines.length > 3) {
        lines.length = 3;
        lines[2] = lines[2].replace(/\s+\S*$/, "") + "…";
    }

    return lines;
}

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

// ─── SVG Overlay Builder ─────────────────────────────────────────────────

/**
 * Create the branded SVG overlay string.
 * 
 * Layout (1024×1024):
 * - Top: gradient bar + XIRI wordmark
 * - Middle: clean photo shows through
 * - Bottom: semi-transparent text box with headline + gradient bar with CTA
 */
function createBrandOverlaySvg(
    width: number,
    height: number,
    headline: string,
): string {
    const headlineLines = wrapText(headline, 32);
    const lineHeight = 38;
    const headlineBlockHeight = headlineLines.length * lineHeight + 50;

    // Position headline block in the lower third
    const headlineY = height * 0.58;

    const headlineTexts = headlineLines.map((line, i) => {
        const y = headlineY + 45 + (i * lineHeight);
        return `<text x="${width * 0.08}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="white" letter-spacing="0.5">${escapeXml(line)}</text>`;
    }).join("\n        ");

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <!-- Top gradient: navy fading to transparent -->
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0c4a6e" stop-opacity="0.85"/>
            <stop offset="70%" stop-color="#0c4a6e" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0"/>
        </linearGradient>
        <!-- Bottom gradient: transparent fading to navy -->
        <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0c4a6e" stop-opacity="0"/>
            <stop offset="30%" stop-color="#0c4a6e" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0.95"/>
        </linearGradient>
        <!-- Brand gradient for accent elements -->
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
    </defs>

    <!-- ═══ TOP GRADIENT BAR ═══ -->
    <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.18)}" fill="url(#topGrad)"/>

    <!-- XIRI Icon Badge (simplified) -->
    <rect x="${Math.round(width * 0.05)}" y="${Math.round(height * 0.03)}" width="42" height="42" rx="9" fill="url(#brandGrad)"/>
    <text x="${Math.round(width * 0.05 + 21)}" y="${Math.round(height * 0.03 + 29)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="22" fill="white" text-anchor="middle" letter-spacing="-0.5">X</text>

    <!-- XIRI Wordmark -->
    <text x="${Math.round(width * 0.05 + 52)}" y="${Math.round(height * 0.03 + 22)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="24" fill="white" letter-spacing="-1">XIRI</text>
    <text x="${Math.round(width * 0.05 + 52)}" y="${Math.round(height * 0.03 + 37)}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="8.5" fill="rgba(255,255,255,0.65)" letter-spacing="3">FACILITY SOLUTIONS</text>

    <!-- ═══ BOTTOM GRADIENT BAR ═══ -->
    <rect x="0" y="${Math.round(height * 0.55)}" width="${width}" height="${Math.round(height * 0.45)}" fill="url(#bottomGrad)"/>

    <!-- Headline text box background -->
    <rect x="${Math.round(width * 0.05)}" y="${Math.round(headlineY)}" width="${Math.round(width * 0.9)}" height="${headlineBlockHeight}" rx="12" fill="rgba(12, 74, 110, 0.65)" stroke="rgba(56, 189, 248, 0.25)" stroke-width="1"/>

    <!-- Headline text lines -->
    ${headlineTexts}

    <!-- ═══ BOTTOM BAR ═══ -->
    <!-- Accent stripe -->
    <rect x="0" y="${height - 6}" width="${width}" height="6" fill="#38bdf8" opacity="0.85"/>

    <!-- Website URL -->
    <text x="${Math.round(width * 0.08)}" y="${height - 25}" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="16" fill="rgba(255,255,255,0.9)" letter-spacing="0.5">xiri.ai</text>

    <!-- Separator dot -->
    <circle cx="${Math.round(width * 0.25)}" cy="${height - 30}" r="2.5" fill="rgba(56, 189, 248, 0.7)"/>

    <!-- Tagline -->
    <text x="${Math.round(width * 0.28)}" y="${height - 25}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="13" fill="rgba(255,255,255,0.6)" letter-spacing="1">Facility Solutions</text>
</svg>`;
}

// ─── Compositing ─────────────────────────────────────────────────────────

/**
 * Composite the branded SVG overlay onto a photo buffer.
 * Returns the final branded image as a PNG buffer.
 */
export async function compositeImage(
    photoBuffer: Buffer,
    postMessage: string,
): Promise<Buffer> {
    // Get photo dimensions
    const metadata = await sharp(photoBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Extract headline from post
    const headline = extractHeadline(postMessage);
    console.log(`[BrandOverlay] Compositing headline: "${headline}" onto ${width}x${height} photo`);

    // Create the SVG overlay
    const overlaySvg = createBrandOverlaySvg(width, height, headline);
    const svgBuffer = Buffer.from(overlaySvg);

    // Composite using sharp
    const result = await sharp(photoBuffer)
        .composite([
            {
                input: svgBuffer,
                top: 0,
                left: 0,
            },
        ])
        .png({ quality: 90 })
        .toBuffer();

    console.log(`[BrandOverlay] Composited image size: ${(result.length / 1024).toFixed(0)}KB`);
    return result;
}
