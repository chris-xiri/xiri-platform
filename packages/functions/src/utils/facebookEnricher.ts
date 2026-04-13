/**
 * Facebook Page Enricher — Contact Extraction Without Graph API
 *
 * Facebook's Graph API requires each business to grant OAuth access,
 * which is useless for cold prospecting.  Instead we:
 *
 *   1. Fetch the **public HTML** of the Facebook business page.
 *   2. Run regex/Cheerio pattern extraction for phone, email, hours, address.
 *   3. Feed the visible text to Gemini 2.0 Flash for deeper owner/contact
 *      extraction and commercial qualification.
 *
 * Key limitation:  Facebook's public page rendering is JS-heavy,
 * so the HTML we get from a simple fetch() is a stripped-down server-
 * rendered shell.  Many pages still expose phone, address, and
 * "About" text in this shell — enough for prospecting.
 *
 * If the shell is too thin (< 500 chars of useful text), we fall back
 * to Serper cache/snippet as a secondary source.
 */

import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt } from './promptUtils';

// ── Types ───────────────────────────────────────────────────────────

export interface FacebookEnrichmentResult {
    success: boolean;
    data?: FacebookPageData;
    error?: string;
}

export interface FacebookPageData {
    /** Name of the business as shown on FB */
    businessName?: string;
    /** Phone number found on the page */
    phone?: string;
    /** Email found on the page */
    email?: string;
    /** Physical address */
    address?: string;
    /** Business category from Facebook (e.g. "Plumber", "Cleaning Service") */
    category?: string;
    /** External website URL linked from the FB page */
    externalWebsite?: string;
    /** Owner / decision maker name */
    ownerName?: string;
    /** Owner title */
    ownerTitle?: string;
    /** Operating hours summary */
    hours?: string;
    /** Service area if mentioned */
    serviceArea?: string;
    /** Whether the business seems commercial (vs residential-only) */
    appearsCommercial?: boolean;
    /** Commercial qualification signals found */
    commercialSignals?: string[];
    /** Raw description / about text */
    aboutText?: string;
    /** Year established (if found in About) */
    yearEstablished?: string;
    /** Data quality: how much useful info we got */
    quality: 'rich' | 'partial' | 'thin';
}

// ── Constants ───────────────────────────────────────────────────────

const TIMEOUT_MS = 12_000; // FB pages can be slow
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Mobile user agent often returns simpler, more data-rich HTML
const MOBILE_USER_AGENT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

// Patterns for contact extraction in raw HTML / text
const PHONE_REGEX = /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

// Commercial qualification keywords
const COMMERCIAL_KEYWORDS = [
    'commercial', 'business', 'office', 'corporate', 'industrial',
    'warehouse', 'facility', 'facilities', 'building', 'property management',
    'retail', 'restaurant', 'school', 'hospital', 'medical', 'healthcare',
    'hotel', 'bank', 'church', 'multi-unit', 'apartment', 'condo',
    'hoa', 'government', 'municipal', 'institutional',
    'contractor', 'subcontractor', 'licensed', 'insured', 'bonded',
    'free estimate', 'service area', 'serving', 'we serve',
    'contract', 'bid', 'proposal',
];

// Junk email domains to filter out
const FB_JUNK_DOMAINS = new Set([
    'facebook.com', 'fb.com', 'meta.com', 'instagram.com',
    'example.com', 'test.com', 'domain.com', 'sentry.io',
    'wixpress.com', 'wordpress.org', 'googleusercontent.com',
]);

// ── Main Function ───────────────────────────────────────────────────

/**
 * Enrich a vendor prospect from their Facebook page URL.
 *
 * Strategy:
 *   1. Fetch public page HTML (try mobile UA first, fallback to desktop)
 *   2. Extract structured patterns (phone, email, address, category)
 *   3. Feed page text to Gemini for deeper extraction (owner, commercial signals)
 *   4. Merge results and assess data quality
 */
export async function enrichFromFacebook(
    facebookUrl: string,
    geminiApiKey: string,
): Promise<FacebookEnrichmentResult> {
    try {
        console.log(`[FacebookEnricher] Enriching: ${facebookUrl}`);

        // Normalize URL — ensure we hit the About tab (most data-rich)
        const normalizedUrl = normalizeFacebookUrl(facebookUrl);
        const aboutUrl = normalizedUrl.replace(/\/?$/, '/about');

        // ─── Step 1: Fetch HTML ───
        // Try mobile UA first — FB serves more data in the mobile shell
        let page = await fetchFacebookPage(aboutUrl, MOBILE_USER_AGENT);
        if (!page) {
            // Fallback to desktop
            page = await fetchFacebookPage(aboutUrl, USER_AGENT);
        }
        if (!page) {
            // Last resort — try the main page (not /about)
            page = await fetchFacebookPage(normalizedUrl, MOBILE_USER_AGENT);
        }
        if (!page) {
            return { success: false, error: `Could not fetch Facebook page: ${facebookUrl}` };
        }

        console.log(`[FacebookEnricher] Fetched ${page.html.length} bytes of HTML`);

        // ─── Step 2: Pattern extraction (Cheerio + regex) ───
        const patternData = extractFromPatterns(page.$, page.html);
        console.log(`[FacebookEnricher] Pattern extraction: phone=${!!patternData.phone}, email=${!!patternData.email}, category=${!!patternData.category}`);

        // ─── Step 3: AI extraction (Gemini) ───
        const visibleText = extractVisibleText(page.$, page.html);
        let aiData: Partial<FacebookPageData> = {};

        if (visibleText.length > 200) {
            aiData = await extractWithAI(visibleText, geminiApiKey);
            console.log(`[FacebookEnricher] AI extraction: owner=${!!aiData.ownerName}, commercial=${aiData.appearsCommercial}`);
        } else {
            console.log(`[FacebookEnricher] Visible text too thin (${visibleText.length} chars) — skipping AI`);
        }

        // ─── Step 4: Merge and assess quality ───
        const merged = mergeResults(patternData, aiData);

        // Assess quality
        const signals = [merged.phone, merged.email, merged.address, merged.ownerName, merged.category].filter(Boolean).length;
        merged.quality = signals >= 3 ? 'rich' : signals >= 1 ? 'partial' : 'thin';

        console.log(`[FacebookEnricher] Result quality: ${merged.quality} (${signals} signals)`);

        return { success: true, data: merged };
    } catch (error: any) {
        console.error(`[FacebookEnricher] Error enriching ${facebookUrl}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ── HTML Fetching ───────────────────────────────────────────────────

async function fetchFacebookPage(
    url: string,
    userAgent: string,
): Promise<{ html: string; $: cheerio.CheerioAPI } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
                // Don't send cookies — we want the public/logged-out view
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            redirect: 'follow',
        });

        if (!response.ok) {
            console.log(`[FacebookEnricher] HTTP ${response.status} for ${url}`);
            return null;
        }

        const html = await response.text();

        // Facebook login walls — detect and bail
        if (html.includes('You must log in to continue') ||
            html.includes('login_form') ||
            (html.includes('/login/') && html.length < 5000)) {
            console.log(`[FacebookEnricher] Login wall detected for ${url}`);
            return null;
        }

        return { html, $: cheerio.load(html) };
    } catch (error: any) {
        console.log(`[FacebookEnricher] Fetch error for ${url}: ${error.message}`);
        return null;
    }
}

// ── Pattern Extraction (Cheerio + Regex) ────────────────────────────

function extractFromPatterns(
    $: cheerio.CheerioAPI,
    html: string,
): Partial<FacebookPageData> {
    const result: Partial<FacebookPageData> = {};

    // ── Business name ──
    // FB pages typically have <title>Business Name | Facebook</title>
    const title = $('title').text();
    if (title) {
        result.businessName = title
            .replace(/\s*[|–-]\s*(Facebook|Meta|Log in or sign up).*$/i, '')
            .trim();
    }

    // Also try og:title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle && !result.businessName) {
        result.businessName = ogTitle.replace(/\s*[|–-]\s*Facebook.*$/i, '').trim();
    }

    // ── Description / About ──
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    result.aboutText = ogDesc || metaDesc || undefined;

    // ── Category ──
    // Facebook pages often embed category in structured data or specific elements
    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, elem) => {
        try {
            const json = JSON.parse($(elem).html() || '');
            if (json['@type']) result.category = result.category || json['@type'];
            if (json.address) {
                const addr = json.address;
                if (typeof addr === 'string') result.address = addr;
                else if (addr.streetAddress) {
                    result.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
                        .filter(Boolean).join(', ');
                }
            }
            if (json.telephone) result.phone = json.telephone;
            if (json.email) result.email = json.email;
            if (json.url && !json.url.includes('facebook.com')) {
                result.externalWebsite = json.url;
            }
        } catch { /* ignore malformed JSON-LD */ }
    });

    // ── Phone from raw HTML ──
    // Facebook embeds phone in spans/divs with data attributes or specific classes
    if (!result.phone) {
        const strippedHtml = stripScriptStyle(html);
        const phones = strippedHtml.match(PHONE_REGEX) || [];
        // Filter out obviously fake/test numbers
        const validPhones = phones.filter(p => {
            const digits = p.replace(/\D/g, '');
            return digits.length === 10 &&
                !digits.startsWith('000') &&
                !digits.startsWith('123') &&
                !digits.startsWith('555');
        });
        result.phone = validPhones[0];
    }

    // ── Email from raw HTML ──
    if (!result.email) {
        const strippedHtml = stripScriptStyle(html);
        const emails = strippedHtml.match(EMAIL_REGEX) || [];
        const validEmails = emails.filter(e => {
            const domain = e.split('@')[1]?.toLowerCase();
            return domain && !FB_JUNK_DOMAINS.has(domain);
        });
        result.email = validEmails[0];
    }

    // ── External website ──
    if (!result.externalWebsite) {
        // Facebook pages with websites often have them in the About section HTML
        // Look for links that aren't facebook.com
        $('a[href]').each((_, elem) => {
            if (result.externalWebsite) return;
            const href = $(elem).attr('href') || '';
            // Facebook wraps external links in l.facebook.com redirects
            if (href.includes('l.facebook.com/l.php')) {
                try {
                    const url = new URL(href);
                    const actualUrl = url.searchParams.get('u');
                    if (actualUrl && !actualUrl.includes('facebook.com') && !actualUrl.includes('instagram.com')) {
                        result.externalWebsite = actualUrl;
                    }
                } catch { /* ignore */ }
            }
        });
    }

    // ── Commercial signals ──
    const lowerHtml = stripScriptStyle(html).toLowerCase();
    const signals: string[] = [];
    for (const kw of COMMERCIAL_KEYWORDS) {
        if (lowerHtml.includes(kw)) {
            signals.push(kw);
        }
    }
    if (signals.length > 0) {
        result.commercialSignals = signals;
        result.appearsCommercial = signals.length >= 2;
    }

    return result;
}

// ── AI Extraction via Gemini ────────────────────────────────────────

async function extractWithAI(
    pageText: string,
    geminiApiKey: string,
): Promise<Partial<FacebookPageData>> {
    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Limit input to save tokens
        const truncated = pageText.substring(0, 12_000);

        const FALLBACK = `You are extracting business information from a Facebook business page.
This is a contractor/service business. Extract all available contact and qualification information.

Return ONLY a valid JSON object with these fields (use null if not found):
{
  "businessName": "official business name",
  "phone": "phone number in format (xxx) xxx-xxxx",
  "email": "email address if visible",
  "address": "full physical address or service area",
  "category": "business category (e.g. 'Plumbing Service', 'Commercial Cleaning')",
  "ownerName": "owner or operator name if mentioned",
  "ownerTitle": "their title (Owner, CEO, Operator, etc.)",
  "externalWebsite": "any non-Facebook website URL mentioned",
  "hours": "operating hours summary if shown",
  "serviceArea": "cities/areas served if mentioned",
  "yearEstablished": "year founded/established if mentioned",
  "appearsCommercial": true/false (does this business serve commercial/business clients vs only residential?),
  "commercialSignals": ["list", "of", "phrases", "that", "indicate", "commercial", "work"]
}

Facebook page content:
{{pageText}}`;

        const prompt = await getPrompt('facebook_page_extractor', FALLBACK, {
            pageText: truncated,
        });

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const clean = (v: any) =>
                v && v !== 'null' && v !== null && v !== 'N/A' && v !== 'n/a' && v !== 'Not found'
                    ? v
                    : undefined;

            return {
                businessName: clean(data.businessName),
                phone: clean(data.phone),
                email: clean(data.email),
                address: clean(data.address),
                category: clean(data.category),
                ownerName: clean(data.ownerName),
                ownerTitle: clean(data.ownerTitle),
                externalWebsite: clean(data.externalWebsite),
                hours: clean(data.hours),
                serviceArea: clean(data.serviceArea),
                yearEstablished: clean(data.yearEstablished),
                appearsCommercial: data.appearsCommercial === true,
                commercialSignals: Array.isArray(data.commercialSignals) ? data.commercialSignals : undefined,
            };
        }

        return {};
    } catch (error: any) {
        console.error(`[FacebookEnricher] AI extraction error:`, error.message);
        return {};
    }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a Facebook URL to a clean page URL.
 * Handles:  facebook.com/pagename, fb.me/pagename, m.facebook.com, etc.
 */
function normalizeFacebookUrl(url: string): string {
    let clean = url.trim();
    if (!clean.startsWith('http')) clean = 'https://' + clean;

    try {
        const parsed = new URL(clean);
        // Ensure we use www.facebook.com (not m. or mobile.)
        const host = parsed.hostname
            .replace(/^m\./, 'www.')
            .replace(/^mobile\./, 'www.')
            .replace(/^touch\./, 'www.')
            .replace(/^mbasic\./, 'www.');

        // If it's fb.me, convert to facebook.com
        if (host.includes('fb.me')) {
            return `https://www.facebook.com${parsed.pathname}`;
        }

        return `https://${host}${parsed.pathname}`.replace(/\/+$/, '');
    } catch {
        return clean;
    }
}

/**
 * Extract visible text from HTML, stripping scripts/styles/tags.
 * Returns a clean text blob suitable for AI analysis.
 */
function extractVisibleText($: cheerio.CheerioAPI, html: string): string {
    // Remove non-visible content
    $('script, style, noscript, iframe, link, meta').remove();

    // Get text content
    let text = $.root().text();

    // Clean up whitespace
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // If Cheerio text is too thin, try raw HTML stripping
    if (text.length < 200) {
        const rawText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (rawText.length > text.length) text = rawText;
    }

    return text;
}

/**
 * Strip <script> and <style> blocks from HTML for cleaner regex matching.
 */
function stripScriptStyle(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Merge pattern-extracted data with AI-extracted data.
 * Pattern data takes priority for phones/emails (more reliable),
 * AI takes priority for owner info and commercial analysis.
 */
function mergeResults(
    patterns: Partial<FacebookPageData>,
    ai: Partial<FacebookPageData>,
): FacebookPageData {
    // Merge commercial signals
    const allSignals = new Set([
        ...(patterns.commercialSignals || []),
        ...(ai.commercialSignals || []),
    ]);

    return {
        businessName: patterns.businessName || ai.businessName,
        phone: patterns.phone || ai.phone,
        email: patterns.email || ai.email,
        address: patterns.address || ai.address,
        category: ai.category || patterns.category, // AI is better at category
        externalWebsite: patterns.externalWebsite || ai.externalWebsite,
        ownerName: ai.ownerName, // AI is the only source for owner
        ownerTitle: ai.ownerTitle,
        hours: ai.hours || patterns.hours,
        serviceArea: ai.serviceArea,
        appearsCommercial: ai.appearsCommercial || (patterns.appearsCommercial ?? false),
        commercialSignals: allSignals.size > 0 ? [...allSignals] : undefined,
        aboutText: patterns.aboutText,
        yearEstablished: ai.yearEstablished,
        quality: 'thin', // Will be overridden by caller
    };
}
