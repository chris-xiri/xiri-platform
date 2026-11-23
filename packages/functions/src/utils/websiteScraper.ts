import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt, DEFAULT_SDR_PROFILER_PROMPT, DEFAULT_SDR_COPYWRITER_PROMPT } from './promptUtils';
import { resolveGeminiModel } from './gemini';
import type { ClinicDossier } from '@xiri/shared';

interface ScrapedData {
    email?: string;
    phone?: string;
    address?: string;
    businessName?: string;
    contactFormUrl?: string;
    socialMedia?: {
        linkedin?: string;
        facebook?: string;
        twitter?: string;
    };
    confidence: 'high' | 'medium' | 'low';
    source: string;
    // Owner/decision-maker info — extracted by AI
    ownerName?: string;
    ownerTitle?: string;
    ownerEmail?: string;
    allEmails?: { email: string; type: 'personal' | 'generic' }[];
    organizationScope?: 'single_location' | 'multi_location';
    dossier?: ClinicDossier;
}

interface EnrichmentResult {
    success: boolean;
    data?: ScrapedData;
    error?: string;
}

const TIMEOUT_MS = 15000; // 15s for slow small-biz sites
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch a page with error handling and timeout
 */
async function fetchPage(url: string): Promise<{ html: string; $: cheerio.CheerioAPI } | null> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const html = await response.text();
        return { html, $: cheerio.load(html) };
    } catch {
        return null;
    }
}

/**
 * Scrapes a website and extracts contact information using multi-page + AI extraction
 */
export async function scrapeWebsite(
    url: string,
    geminiApiKey: string,
    metadata?: { businessName?: string; address?: string; website?: string }
): Promise<EnrichmentResult> {
    try {
        // ─── Step 1: Scrape homepage ───
        const homepage = await fetchPage(url);
        if (!homepage) {
            return { success: false, error: `Could not fetch ${url}` };
        }

        const structuredData = extractStructuredData(homepage.$);
        const patternData = extractFromPatterns(homepage.$, homepage.html);
        const linkData = extractMailtoAndTel(homepage.$);

        // ─── Step 2: Find and scrape prioritized pages (team/staff FIRST, then contact, about, locations) ───
        const additionalPages = findAdditionalPages(homepage.$, url);
        const contactPageResults: Partial<ScrapedData>[] = [];
        let allAdditionalHtml = '';
        const additionalPageCache: { url: string; $: cheerio.CheerioAPI; html: string }[] = [];

        const fetchedPages = await Promise.allSettled(
            additionalPages.slice(0, 4).map(async (pageUrl) => ({
                pageUrl,
                page: await fetchPage(pageUrl),
            }))
        );

        for (const res of fetchedPages) {
            if (res.status !== 'fulfilled' || !res.value.page) continue;
            const { pageUrl, page } = res.value;

            additionalPageCache.push({ url: pageUrl, $: page.$, html: page.html });

            const pagePatterns = extractFromPatterns(page.$, page.html);
            const pageLinks = extractMailtoAndTel(page.$);

            const hasForm = page.$('form').length > 0;
            if (hasForm) pagePatterns.contactFormUrl = pageUrl;

            contactPageResults.push({
                ...pagePatterns,
                email: pageLinks.email || pagePatterns.email,
                phone: pageLinks.phone || pagePatterns.phone,
            });

            allAdditionalHtml += `\n<!-- PAGE: ${pageUrl} -->\n` + page.html + '\n';
        }

        // ─── Step 2b: Deterministic Office Manager / Practice Manager DOM extraction ───
        // Runs on team/staff pages first, then homepage, so we reliably capture the
        // Office Manager (e.g. "Mary Ann — Office Manager" on /meet-the-team/) even if AI fails.
        const domDecisionMaker = extractDecisionMakerFromPages([
            ...additionalPageCache.map(p => ({ url: p.url, $: p.$ })),
            { url, $: homepage.$ },
        ]);

        // ─── Step 3: Merge all data (priority: structured > mailto/tel > contact pages > homepage patterns) ───
        const mergedContact = mergeContactPages(contactPageResults);

        const combinedData: ScrapedData = {
            email: structuredData.email || linkData.email || mergedContact.email || patternData.email,
            phone: structuredData.phone || linkData.phone || mergedContact.phone || patternData.phone,
            address: structuredData.address || patternData.address,
            businessName: structuredData.businessName || patternData.businessName,
            contactFormUrl: mergedContact.contactFormUrl || patternData.contactFormUrl,
            socialMedia: {
                ...structuredData.socialMedia,
                ...patternData.socialMedia,
            },
            confidence: 'low',
            source: structuredData.email ? 'structured_data' : linkData.email ? 'mailto' : 'pattern',
            allEmails: extractAllEmails(homepage.html + '\n' + allAdditionalHtml),
        };

        // ─── Step 3b: Fallback — scan cached contact pages if no email found yet ───
        if (!combinedData.email && additionalPageCache.length > 0) {
            for (const cached of additionalPageCache) {
                const mailtoData = extractMailtoAndTel(cached.$);
                if (mailtoData.email) {
                    combinedData.email = mailtoData.email;
                    combinedData.source = 'contact_page';
                    break;
                }
            }
        }

        // ─── Step 4: Fallback — use generic email from allEmails if primary email is empty ───
        if (!combinedData.email && combinedData.allEmails && combinedData.allEmails.length > 0) {
            const genericEmail = combinedData.allEmails.find(e => e.type === 'generic')?.email;
            if (genericEmail) {
                combinedData.email = genericEmail;
            }
        }

        // ─── Step 5: AI extraction on clean team/staff + homepage HTML ───
        const aiHtml = allAdditionalHtml.length > 500
            ? allAdditionalHtml + '\n' + homepage.html
            : homepage.html;
        const aiData = await extractWithAI(aiHtml, geminiApiKey, metadata);
        combinedData.email = combinedData.email || aiData.email;
        combinedData.phone = combinedData.phone || aiData.phone;
        combinedData.address = combinedData.address || aiData.address;
        combinedData.businessName = combinedData.businessName || aiData.businessName;
        // Prefer Office/Practice Manager over generic doctor/owner when both exist
        const aiIsManager = !!aiData.ownerTitle && /office manager|practice manager|administrator|director|operations/i.test(aiData.ownerTitle);
        if (domDecisionMaker && (!aiData.ownerName || (!aiIsManager && domDecisionMaker.priority >= 90))) {
            combinedData.ownerName = domDecisionMaker.name;
            combinedData.ownerTitle = domDecisionMaker.title;
        } else {
            combinedData.ownerName = aiData.ownerName || domDecisionMaker?.name;
            combinedData.ownerTitle = aiData.ownerTitle || domDecisionMaker?.title;
        }
        combinedData.ownerEmail = aiData.ownerEmail;
        combinedData.organizationScope = aiData.organizationScope;
        combinedData.dossier = aiData.dossier;

        // Merge AI-discovered staff emails into allEmails (deduped)
        if (aiData.allEmails && aiData.allEmails.length > 0) {
            const existingEmails = new Set(combinedData.allEmails?.map(e => e.email) || []);
            for (const aiEmail of aiData.allEmails) {
                if (!existingEmails.has(aiEmail.email)) {
                    combinedData.allEmails = combinedData.allEmails || [];
                    combinedData.allEmails.push(aiEmail);
                    existingEmails.add(aiEmail.email);
                }
            }
        }

        // ─── Step 6: Validate and format ───
        if (combinedData.email) {
            combinedData.email = validateEmail(combinedData.email);
        }
        if (combinedData.phone) {
            combinedData.phone = formatPhone(combinedData.phone);
        }

        combinedData.confidence = determineConfidence(structuredData, patternData, mergedContact, linkData);

        return { success: true, data: combinedData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ═══════════════════════════════════════════════════════
// EXTRACTION METHODS
// ═══════════════════════════════════════════════════════

/**
 * Extract mailto: and tel: links — the most reliable source of contact info
 */
function extractMailtoAndTel($: cheerio.CheerioAPI): { email?: string; phone?: string } {
    let email: string | undefined;
    let phone: string | undefined;

    // mailto: links — prefer personal over generic
    const allMailtos: { email: string; isPersonal: boolean }[] = [];
    $('a[href^="mailto:"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
            const addr = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
            if (!addr.match(/^(noreply|no-reply|support|webmaster|bounce|mailer-daemon)@/i) && addr.includes('@')) {
                const isPersonal = !addr.match(/^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i);
                allMailtos.push({ email: addr, isPersonal });
            }
        }
    });

    // Prefer personal email
    const personal = allMailtos.find(m => m.isPersonal);
    email = personal?.email || allMailtos[0]?.email;

    // tel: links
    $('a[href^="tel:"]').each((_, elem) => {
        if (phone) return;
        const href = $(elem).attr('href');
        if (href) {
            phone = href.replace('tel:', '').replace(/[^\d+]/g, '').trim();
        }
    });

    return { email, phone };
}

/**
 * Extract ALL mailto emails from a page, categorized as personal or generic.
 */
function extractAllMailtoEmails($: cheerio.CheerioAPI): { email: string; type: 'personal' | 'generic' }[] {
    const result: { email: string; type: 'personal' | 'generic' }[] = [];
    $('a[href^="mailto:"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
            const addr = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
            if (addr.includes('@') && !addr.match(/^(noreply|no-reply|bounce|mailer-daemon)@/i)) {
                const isGeneric = !!addr.match(/^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i);
                result.push({ email: addr, type: isGeneric ? 'generic' : 'personal' });
            }
        }
    });
    return result;
}

/**
 * Extract data from structured meta tags and schema.org JSON-LD
 */
function extractStructuredData($: cheerio.CheerioAPI): Partial<ScrapedData> {
    const data: Partial<ScrapedData> = {};

    // Meta tags
    data.email = $('meta[property="og:email"]').attr('content') ||
        $('meta[name="contact:email"]').attr('content');

    data.phone = $('meta[property="og:phone_number"]').attr('content') ||
        $('meta[name="contact:phone"]').attr('content');

    // Schema.org structured data (check for arrays too)
    $('script[type="application/ld+json"]').each((_, elem) => {
        try {
            let jsonItems = JSON.parse($(elem).html() || '{}');
            // Handle @graph arrays
            if (jsonItems['@graph']) jsonItems = jsonItems['@graph'];
            if (!Array.isArray(jsonItems)) jsonItems = [jsonItems];

            for (const json of jsonItems) {
                const type = json['@type'];
                if (type === 'Organization' || type === 'LocalBusiness' ||
                    type === 'CleaningService' || type === 'ProfessionalService' ||
                    type === 'HomeAndConstructionBusiness') {
                    data.email = data.email || json.email;
                    data.phone = data.phone || json.telephone;
                    data.businessName = data.businessName || json.name;
                    if (json.address) {
                        data.address = typeof json.address === 'string'
                            ? json.address
                            : [json.address.streetAddress, json.address.addressLocality,
                            json.address.addressRegion, json.address.postalCode]
                                .filter(Boolean).join(', ');
                    }
                }
            }
        } catch {
            // Invalid JSON, skip
        }
    });

    // Business name fallback from title/h1
    data.businessName = data.businessName ||
        $('meta[property="og:site_name"]').attr('content') ||
        $('title').text().split('|')[0].split('-')[0].split('–')[0].trim() ||
        $('h1').first().text().trim();

    return data;
}

/**
 * Extract data using regex patterns from HTML
 */
function extractFromPatterns($: cheerio.CheerioAPI, html: string): Partial<ScrapedData> {
    const data: Partial<ScrapedData> = { socialMedia: {} };

    // Strip non-visible content (scripts, styles, comments) to avoid scraping
    // emails from font licenses, JS library credits, and CSS metadata
    const visibleHtml = stripNonVisibleContent(html);

    // Email regex — exclude common junk but keep business-relevant emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = visibleHtml.match(emailRegex) || [];
    const personalEmails = emails.filter(email =>
        !email.match(/^(info|admin|noreply|no-reply|support|hello|contact|webmaster|sales|marketing)@/i) &&
        !email.includes('example.com') &&
        !email.includes('domain.com') &&
        !email.includes('sentry.io') &&
        !email.includes('wixpress.com') &&
        !email.includes('wordpress.') &&
        !email.includes('@e.') // tracking pixels
    );
    data.email = personalEmails[0];

    // Phone regex (US format) — also check tel: attributes
    const phoneRegex = /(\+1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g;
    const phones = html.match(phoneRegex) || [];
    data.phone = phones[0];

    // Address — look in footer and common containers
    const footerText = $('footer, [class*="footer"], [class*="contact"], [class*="address"], [itemtype*="PostalAddress"]').text();
    const addressRegex = /\d{1,5}\s[\w\s.]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway)[.,]?\s[\w\s]+,\s*[A-Z]{2}\s*\d{5}/gi;
    const addresses = footerText.match(addressRegex) || html.match(addressRegex) || [];
    data.address = data.address || addresses[0]?.trim();

    // Social media links
    $('a[href*="linkedin.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && (href.includes('/company/') || href.includes('/in/'))) {
            data.socialMedia!.linkedin = href;
        }
    });

    $('a[href*="facebook.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.includes('sharer') && !href.includes('share.php')) {
            data.socialMedia!.facebook = href;
        }
    });

    $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.includes('intent/tweet')) {
            data.socialMedia!.twitter = href;
        }
    });

    return data;
}

function normalizeHost(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Find and prioritize relevant pages to scrape:
 *   Priority 1 (100): Team / Staff / Meet the Team / Leadership (where Office Managers live!)
 *   Priority 2 (80):  Contact / Reach Us (where direct emails live)
 *   Priority 3 (60):  About / Practice Overview (where operatory/specialty context lives)
 *   Priority 4 (30):  Locations / Office pages
 */
function findAdditionalPages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const scored = new Map<string, number>();
    let baseHost = '';
    try {
        baseHost = normalizeHost(new URL(baseUrl).hostname);
    } catch {
        return [];
    }

    const scoreCandidate = (hrefLower: string, textLower: string): number => {
        const combined = `${hrefLower} ${textLower}`;
        if (/\b(meet[- ]the[- ]team|meet[- ]our[- ]team|our[- ]team|staff|leadership|management|team)\b/.test(combined)) {
            return 100;
        }
        if (/\b(contact|contact-us|reach-us|get-in-touch|find-us)\b/.test(combined)) {
            return 80;
        }
        if (/\b(about|about-us|our-practice|our-office)\b/.test(combined)) {
            return 60;
        }
        if (/\b(location|locations)\b/.test(combined)) {
            return 30;
        }
        return 0;
    };

    $('a[href]').each((_, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase().trim();
        if (!href) return;

        if (href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

        const lowerHref = href.toLowerCase();
        const score = scoreCandidate(lowerHref, text);
        if (score === 0) return;

        try {
            const parsed = new URL(href, baseUrl);
            if (normalizeHost(parsed.hostname) !== baseHost) return;
            // Skip image/pdf/binary links
            if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip)$/i.test(parsed.pathname)) return;
            // Canonicalize without hash
            parsed.hash = '';
            const canonical = parsed.href;
            const prev = scored.get(canonical) || 0;
            if (score > prev) scored.set(canonical, score);
        } catch {
            // Invalid URL
        }
    });

    return Array.from(scored.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([u]) => u);
}

const MANAGER_TITLE_PATTERNS: Array<{ regex: RegExp; label: string; priority: number }> = [
    { regex: /\boffice\s+manager\b/i, label: 'Office Manager', priority: 100 },
    { regex: /\bpractice\s+manager\b/i, label: 'Practice Manager', priority: 100 },
    { regex: /\bpractice\s+administrator\b/i, label: 'Practice Administrator', priority: 98 },
    { regex: /\bpractice\s+director\b/i, label: 'Practice Director', priority: 95 },
    { regex: /\boperations\s+manager\b/i, label: 'Operations Manager', priority: 95 },
    { regex: /\bclinic\s+manager\b/i, label: 'Clinic Manager', priority: 92 },
    { regex: /\bbusiness\s+manager\b/i, label: 'Business Manager', priority: 90 },
    { regex: /\bclinical\s+coordinator\b/i, label: 'Clinical Coordinator', priority: 75 },
    { regex: /\btreatment\s+coordinator\b/i, label: 'Treatment Coordinator', priority: 70 },
];

function looksLikePersonName(raw: string): string | null {
    const cleaned = raw.replace(/\s+/g, ' ').replace(/^[\-–—:|•,.\s]+|[\-–—:|•,.\s]+$/g, '').trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 42) return null;
    if (/\d|@|http|www\.|office|manager|coordinator|assistant|hygienist|doctor|team|staff|location|dental|ortho|clinic|practice|meet\s+our|about/i.test(cleaned)) {
        return null;
    }
    const words = cleaned.split(/\s+/);
    if (words.length < 1 || words.length > 4) return null;
    // Must start with a capital letter and contain mostly letters
    if (!/^[A-Z][a-zA-Z'.-]+(\s+[A-Z][a-zA-Z'.-]+){0,3}$/.test(cleaned)) return null;
    return cleaned;
}

/**
 * Deterministically extract Office Manager / Practice Manager name + title from
 * scraped team/staff DOM cards (e.g. <h3>Mary Ann</h3><p>Office Manager</p>).
 */
function extractDecisionMakerFromPages(
    pages: Array<{ url: string; $: cheerio.CheerioAPI }>
): { name: string; title: string; priority: number } | null {
    let best: { name: string; title: string; priority: number } | null = null;

    for (const { $ } of pages) {
        $('p, span, div, h1, h2, h3, h4, h5, h6, strong, b, em, small, li').each((_, el) => {
            const $el = $(el);
            // Only inspect leaf-ish text nodes (avoid huge wrapper containers)
            if ($el.children('div, section, article, ul').length > 0) return;
            const text = $el.text().replace(/\s+/g, ' ').trim();
            if (!text || text.length > 80) return;

            for (const pat of MANAGER_TITLE_PATTERNS) {
                if (!pat.regex.test(text)) continue;
                if (best && best.priority >= pat.priority) continue;

                // Case 1: Inline "Mary Ann - Office Manager" or "Mary Ann, Office Manager"
                const beforeTitle = text.split(pat.regex)[0];
                const inlineName = looksLikePersonName(beforeTitle);
                if (inlineName) {
                    best = { name: inlineName, title: pat.label, priority: pat.priority };
                    return;
                }

                // Case 2: Previous sibling heading or element (e.g. <h3>Mary Ann</h3><p>Office Manager</p>)
                const prevText = $el.prev('h1, h2, h3, h4, h5, h6, strong, b, p, span, div').text();
                const prevName = looksLikePersonName(prevText);
                if (prevName) {
                    best = { name: prevName, title: pat.label, priority: pat.priority };
                    return;
                }

                // Case 3: Parent's heading (e.g. <div class="card"><h3>Mary Ann</h3><div><span>Office Manager</span></div></div>)
                const parentHeading = $el.parent().prev('h1, h2, h3, h4, h5, h6, strong, p').text()
                    || $el.closest('div, li, article, figure').find('h1, h2, h3, h4, h5, h6, strong').first().text();
                const parentName = looksLikePersonName(parentHeading);
                if (parentName) {
                    best = { name: parentName, title: pat.label, priority: pat.priority };
                    return;
                }
            }
        });
    }

    return best;
}

/**
 * Extract all unique visible/mailto emails from combined HTML pages, classified
 * as 'personal' vs 'generic'. Filters out framework/asset/junk addresses.
 */
function extractAllEmails(html: string): { email: string; type: 'personal' | 'generic' }[] {
    const visible = stripNonVisibleContent(html);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const rawMatches = visible.match(emailRegex) || [];
    const seen = new Set<string>();
    const results: { email: string; type: 'personal' | 'generic' }[] = [];

    for (const raw of rawMatches) {
        const cleaned = raw.trim().toLowerCase();
        if (seen.has(cleaned)) continue;
        if (
            /^(noreply|no-reply|donotreply|bounce|mailer-daemon|postmaster|webmaster|support)@/i.test(cleaned) ||
            cleaned.includes('example.com') ||
            cleaned.includes('domain.com') ||
            cleaned.includes('sentry.io') ||
            cleaned.includes('wixpress.com') ||
            cleaned.includes('wordpress.') ||
            cleaned.includes('@e.') ||
            /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(cleaned)
        ) {
            continue;
        }
        seen.add(cleaned);
        const isGeneric = /^(info|contact|hello|office|admin|sales|team|service|services|marketing|frontdesk|appointments|scheduling|reception)@/i.test(cleaned);
        results.push({ email: cleaned, type: isGeneric ? 'generic' : 'personal' });
    }

    return results;
}

/**
 * Find generic emails (info@, contact@) as fallback when no personal email found
 */
function findGenericEmail(...htmlSources: string[]): string | undefined {
    // Strip non-visible content before scanning for emails
    const combined = htmlSources.map(stripNonVisibleContent).join(' ');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const allEmails = combined.match(emailRegex) || [];

    // Now accept generic business emails (info@, contact@, hello@)
    const genericEmails = allEmails.filter(email =>
        email.match(/^(info|contact|hello|office|service|services|team|admin)@/i) &&
        !email.includes('example.com') &&
        !email.includes('domain.com') &&
        !email.includes('wixpress.com')
    );

    return genericEmails[0]?.toLowerCase();
}

/**
 * Merge results from multiple contact pages
 */
function mergeContactPages(pages: Partial<ScrapedData>[]): Partial<ScrapedData> {
    const merged: Partial<ScrapedData> = { socialMedia: {} };
    for (const p of pages) {
        merged.email = merged.email || p.email;
        merged.phone = merged.phone || p.phone;
        merged.address = merged.address || p.address;
        merged.contactFormUrl = merged.contactFormUrl || p.contactFormUrl;
        if (p.socialMedia) {
            merged.socialMedia!.linkedin = merged.socialMedia!.linkedin || p.socialMedia.linkedin;
            merged.socialMedia!.facebook = merged.socialMedia!.facebook || p.socialMedia.facebook;
            merged.socialMedia!.twitter = merged.socialMedia!.twitter || p.socialMedia.twitter;
        }
    }
    return merged;
}

// ═══════════════════════════════════════════════════════
// AI EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Extract contact info using Gemini AI — runs on the best available HTML
 */
async function extractWithAI(
    html: string,
    geminiApiKey: string,
    metadata?: { businessName?: string; address?: string; website?: string }
): Promise<Partial<ScrapedData>> {
    if (!geminiApiKey?.trim()) return {};
    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: resolveGeminiModel('gemini-2.5-flash') });

        // Strip scripts/styles/svgs BEFORE converting HTML to plain text so WordPress CSS/JS
        // never crowds out /meet-the-team/ staff bios and Office Manager names.
        const visibleHtml = stripNonVisibleContent(html).replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
        const text = visibleHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 18000);

        const prompt = await getPrompt('sdr_profiler', DEFAULT_SDR_PROFILER_PROMPT, {
            businessName: metadata?.businessName || '',
            address: metadata?.address || '',
            website: metadata?.website || '',
            websiteText: text,
        });

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const clean = (v: any) => (v && v !== 'null' && v !== null && v !== 'N/A' && v !== 'n/a') ? v : undefined;

            // Handle structured decisionMaker object or flat legacy fields
            const dm = data.decisionMaker || {};
            const resolvedOwnerName = clean(dm.name) || clean(data.ownerName);
            const resolvedOwnerTitle = clean(dm.title) || clean(data.ownerTitle);
            const resolvedOwnerEmail = clean(dm.email) || clean(data.ownerEmail);
            const resolvedPhone = clean(dm.phone) || clean(data.phone);
            const resolvedEmail = resolvedOwnerEmail || clean(data.genericEmail) || clean(data.email);

            // Extract staff emails if present
            const aiStaffEmails: { email: string; type: 'personal' | 'generic' }[] = [];
            if (Array.isArray(data.allStaffEmails)) {
                for (const staffEmail of data.allStaffEmails) {
                    if (typeof staffEmail === 'string' && staffEmail.includes('@')) {
                        const cleaned = staffEmail.trim().toLowerCase();
                        const isGeneric = !!cleaned.match(/^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i);
                        aiStaffEmails.push({ email: cleaned, type: isGeneric ? 'generic' : 'personal' });
                    }
                }
            }

            // Build ClinicDossier
            let dossier: ClinicDossier | undefined;
            if (data.clinicType || data.keyObservation || typeof data.icpScore === 'number' || typeof data.isDsoChain === 'boolean') {
                dossier = {
                    clinicType: data.clinicType || undefined,
                    isDsoChain: typeof data.isDsoChain === 'boolean' ? data.isDsoChain : undefined,
                    dsoName: clean(data.dsoName) || null,
                    estimatedOperatories: Number(data.estimatedOperatories) || undefined,
                    doctorCount: Number(data.doctorCount) || undefined,
                    keyObservation: clean(data.keyObservation) || undefined,
                    icpScore: typeof data.icpScore === 'number' ? data.icpScore : undefined,
                    qualificationReason: clean(data.qualificationReason) || undefined,
                };
            }

            return {
                email: resolvedEmail,
                phone: resolvedPhone,
                address: clean(data.address),
                businessName: clean(data.businessName),
                ownerName: resolvedOwnerName,
                ownerTitle: resolvedOwnerTitle,
                ownerEmail: resolvedOwnerEmail,
                organizationScope: data.organizationScope === 'multi_location' ? 'multi_location' : data.organizationScope === 'single_location' ? 'single_location' : undefined,
                allEmails: aiStaffEmails.length > 0 ? aiStaffEmails : undefined,
                dossier,
            };
        }

        return {};
    } catch (error) {
        console.error('AI extraction error:', error);
        return {};
    }
}

/**
 * Agent 2: Response-Optimized Copywriter Draft Generator
 */
export async function generateOutreachDraft(params: {
    cleanBizName: string;
    contactName?: string;
    contactTitle?: string;
    city?: string;
    clinicType?: string;
    keyObservation?: string;
    geminiApiKey: string;
}): Promise<{ subject: string; body: string } | undefined> {
    try {
        const genAI = new GoogleGenerativeAI(params.geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: resolveGeminiModel('gemini-2.5-flash'),
            generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
        });

        const prompt = await getPrompt('sdr_copywriter', DEFAULT_SDR_COPYWRITER_PROMPT, {
            cleanBizName: params.cleanBizName,
            contactName: params.contactName || 'there',
            contactTitle: params.contactTitle || 'Office Manager',
            city: params.city || 'your area',
            clinicType: params.clinicType || 'dental practice',
            keyObservation: params.keyObservation || 'private practice focused on patient care and clinical hygiene',
        });

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.subject && parsed.body) {
                return { subject: parsed.subject, body: parsed.body };
            }
        }
        return undefined;
    } catch (err) {
        console.error('[generateOutreachDraft] Error:', err);
        return undefined;
    }
}

// ═══════════════════════════════════════════════════════
// VALIDATION & HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Strip non-visible HTML content (scripts, styles, comments, noscript)
 * so that email regex doesn't pick up addresses from font licenses,
 * JS library credits, or CSS metadata.
 */
function stripNonVisibleContent(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Determine confidence level based on data sources
 */
function determineConfidence(
    structured: Partial<ScrapedData>,
    pattern: Partial<ScrapedData>,
    contact: Partial<ScrapedData>,
    links: { email?: string; phone?: string }
): 'high' | 'medium' | 'low' {
    if (structured.email || structured.phone) return 'high';
    if (links.email || links.phone) return 'high'; // mailto/tel are very reliable
    if (contact.email || contact.phone) return 'medium';
    if (pattern.email || pattern.phone) return 'low';
    return 'low';
}

/**
 * Validate email format
 */
function validateEmail(email: string): string | undefined {
    // Strip display name format: "Name <email@domain.com>" → "email@domain.com"
    const angleMatch = email.match(/<([^>]+)>/);
    if (angleMatch) email = angleMatch[1];
    email = email.trim();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return undefined;

    // Only exclude truly useless emails
    if (email.match(/^(noreply|no-reply|donotreply|bounce|mailer-daemon|postmaster)@/i)) {
        return undefined;
    }

    return email.toLowerCase();
}

/**
 * Format phone number to (xxx) xxx-xxxx
 */
function formatPhone(phone: string): string | undefined {
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) {
        return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
        return `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
    }

    return undefined;
}

// ═══════════════════════════════════════════════════════
// DEEP MAILTO SCAN
// ═══════════════════════════════════════════════════════

/**
 * Deep-crawl a website looking for mailto: links across all internal pages.
 * This catches emails that are only on sub-pages (e.g., /staff, /team, /careers)
 * and are the most reliable email source for small business sites.
 */
export async function deepMailtoScan(baseUrl: string): Promise<{ email?: string; phone?: string; pagesScanned: number }> {
    const visited = new Set<string>();
    let foundEmail: string | undefined;
    let foundPhone: string | undefined;

    try {
        // Fetch homepage first
        const homepage = await fetchPage(baseUrl);
        if (!homepage) return { pagesScanned: 0 };

        // Collect ALL internal links from homepage
        const internalLinks = new Set<string>();
        homepage.$('a').each((_, elem) => {
            const href = homepage.$(elem).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
            try {
                const fullUrl = new URL(href, baseUrl).href;
                if (normalizeHost(new URL(fullUrl).hostname) === normalizeHost(new URL(baseUrl).hostname)) {
                    internalLinks.add(fullUrl);
                }
            } catch {
                // Invalid URL
            }
        });

        // Check homepage for mailto/tel first
        const homeResult = extractMailtoAndTel(homepage.$);
        if (homeResult.email) foundEmail = homeResult.email;
        if (homeResult.phone) foundPhone = homeResult.phone;
        visited.add(baseUrl);

        if (foundEmail) return { email: foundEmail, phone: foundPhone, pagesScanned: 1 };

        // Crawl up to 5 additional internal pages looking for mailto
        const pagesToCheck = Array.from(internalLinks).slice(0, 5);
        for (const pageUrl of pagesToCheck) {
            if (visited.has(pageUrl)) continue;
            visited.add(pageUrl);

            const page = await fetchPage(pageUrl);
            if (!page) continue;

            const pageResult = extractMailtoAndTel(page.$);
            if (pageResult.email && !foundEmail) foundEmail = pageResult.email;
            if (pageResult.phone && !foundPhone) foundPhone = pageResult.phone;

            // Also check raw HTML for emails in href attributes (obfuscated mailto)
            const obfuscatedEmails = page.html.match(/href\s*=\s*["']mailto:([^"'?]+)/gi) || [];
            for (const match of obfuscatedEmails) {
                const email = match.replace(/href\s*=\s*["']mailto:/i, '').trim().toLowerCase();
                if (email && !email.match(/^(noreply|no-reply|support|webmaster)@/i)) {
                    foundEmail = foundEmail || email;
                }
            }

            if (foundEmail) break;
        }

        return { email: foundEmail, phone: foundPhone, pagesScanned: visited.size };
    } catch (error) {
        console.error('Deep mailto scan error:', error);
        return { pagesScanned: visited.size };
    }
}

function normalizeBusinessNameForSearch(name: string): string {
    const legalSuffixes = new Set([
        'inc', 'incorporated', 'llc', 'l.l.c', 'co', 'company', 'corp', 'corporation',
        'ltd', 'limited', 'pllc', 'llp', 'pc', 'p.c', 'group', 'holdings',
    ]);
    const normalized = name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = normalized.split(' ').filter(Boolean);
    while (parts.length > 1 && legalSuffixes.has(parts[parts.length - 1])) {
        parts.pop();
    }
    return parts.join(' ').trim();
}

function getMeaningfulTokens(text: string): string[] {
    const stop = new Set(['the', 'and', 'for', 'of', 'at', 'in', 'on', 'by', 'a', 'an', 'to', 'services', 'service']);
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !stop.has(t));
}

function getRegistrableDomain(domain: string): string {
    const parts = domain.toLowerCase().split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    const secondLevelTlds = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (tld.length === 2 && secondLevelTlds.has(sld) && parts.length >= 3) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
}

function extractHostname(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return undefined;
    }
}

function isSearchResultAssociatedWithBusiness(
    result: { title?: string; snippet?: string; link?: string },
    businessName: string,
    location?: string,
    domain?: string
): boolean {
    const normalizedBusiness = normalizeBusinessNameForSearch(businessName);
    if (!normalizedBusiness) return false;

    const businessTokens = getMeaningfulTokens(normalizedBusiness);
    if (businessTokens.length === 0) return false;

    const rawText = `${result.title || ''} ${result.snippet || ''} ${result.link || ''}`;
    const normalizedText = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const textTokens = new Set(getMeaningfulTokens(normalizedText));

    const overlap = businessTokens.filter(t => textTokens.has(t)).length;
    const tokenRatio = overlap / Math.min(Math.max(businessTokens.length, 1), 4);
    const exactPhraseMatch = normalizedText.includes(normalizedBusiness);

    const hostname = extractHostname(result.link);
    const domainMatch = !!hostname && !!domain && (
        hostname === domain.toLowerCase() ||
        hostname.endsWith(`.${domain.toLowerCase()}`) ||
        getRegistrableDomain(hostname) === getRegistrableDomain(domain.toLowerCase())
    );

    const locationHit = !!location && normalizedText.includes(location.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim());

    if (exactPhraseMatch) return true;
    if (domainMatch && overlap >= 1) return true;
    if (overlap >= 2 && tokenRatio >= 0.5) return true;
    if (locationHit && overlap >= 2) return true;
    return false;
}

// ═══════════════════════════════════════════════════════
// SERPER WEB EMAIL SEARCH
// ═══════════════════════════════════════════════════════

/**
 * Search the web for a business's email using Serper.dev.
 * This is the last-resort fallback when website scraping + deep mailto fails.
 * 
 * Strategies:
 * 1. Search `"businessName" "location" email` 
 * 2. Search `site:domain.com email` (if domain available)
 * 3. Extract emails from search result snippets and linked pages
 */
export async function searchWebForEmail(
    businessName: string,
    location: string,
    domain?: string,
    serperApiKey?: string,
    contactName?: string,
    options?: {
        deepResearch?: boolean;
        decisionMakerTitles?: string[];
    }
): Promise<{
    email?: string;
    phone?: string;
    facebookUrl?: string;
    source: string;
    evidenceTitle?: string;
    evidenceSnippet?: string;
    evidenceUrl?: string;
}> {
    const apiKey = serperApiKey || process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('No SERPER_API_KEY available for web email search.');
        return { source: 'serper_skipped' };
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g;

    const queries: string[] = [];
    const deepResearch = !!options?.deepResearch;
    const titleHints = (options?.decisionMakerTitles || []).slice(0, 4).map(t => `"${t}"`);
    const normalizedBusiness = normalizeBusinessNameForSearch(businessName) || businessName.trim();
    const strictBusinessPhrase = `"${normalizedBusiness}"`;
    const shortBusinessPhrase = `"${normalizedBusiness.split(' ').slice(0, 4).join(' ')}"`;

    // Strategy 1: site-specific search (most targeted) — only if we have a domain
    if (domain) {
        queries.push(`site:${domain} (${strictBusinessPhrase} OR ${shortBusinessPhrase}) (email OR contact)`);
    }

    // Strategy 2: Facebook page search — many small businesses list email here
    queries.push(`site:facebook.com ${strictBusinessPhrase} ${location} email`);

    // Strategy 3: Named person search (if we found an owner via AI)
    if (contactName) {
        queries.push(`"${contactName}" ${strictBusinessPhrase} email`);
    } else if (!domain) {
        // Fallback: General business + location search (only if no domain-specific search ran)
        queries.push(`${strictBusinessPhrase} ${location} (email OR contact)`);
    }

    // Strategy 4: Yelp — highest-yield directory for local business contact info
    queries.push(`site:yelp.com ${strictBusinessPhrase} ${location} email OR contact`);

    // Strategy 5 (optional): deeper, role-aware contact research
    if (deepResearch && domain) {
        const titleQuery = titleHints.length > 0 ? titleHints.join(' OR ') : '"operations manager" OR "general manager" OR "office manager"';
        queries.push(`site:${domain} (${strictBusinessPhrase} OR ${shortBusinessPhrase}) ("team" OR "staff" OR "about" OR "contact") (${titleQuery}) email`);
        queries.push(`${strictBusinessPhrase} "${location}" (${titleQuery}) ("email" OR "@${domain}")`);
    }

    // NOTE: BBB, Manta, YellowPages, Instagram removed — low email-in-snippet yield
    // was burning ~4 extra Serper calls per prospect with negligible return

    let facebookUrl: string | undefined;

    for (const query of queries) {
        try {
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey.trim(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ q: query, num: 5 }),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) continue;

            const data = await response.json() as any;
            const organic = data.organic || [];

            // Extract emails from snippets
            for (const result of organic) {
                const associated = isSearchResultAssociatedWithBusiness(result, businessName, location, domain);

                // Capture Facebook URL if found
                if (associated && !facebookUrl && result.link?.includes('facebook.com') && !result.link?.includes('sharer')) {
                    facebookUrl = result.link;
                }

                if (!associated) continue;

                const text = `${result.snippet || ''} ${result.title || ''}`;
                const emails = text.match(emailRegex) || [];
                const phones = text.match(phoneRegex) || [];

                // Filter junk emails
                const validEmails = emails.filter((e: string) =>
                    !e.includes('example.com') &&
                    !e.includes('domain.com') &&
                    !e.includes('sentry.io') &&
                    !e.includes('wixpress.com') &&
                    !e.includes('wordpress.') &&
                    !e.match(/^(noreply|no-reply|bounce|mailer-daemon)@/i)
                );

                if (validEmails.length > 0) {
                    return {
                        email: validEmails[0].toLowerCase(),
                        phone: phones[0],
                        facebookUrl,
                        source: query.includes('facebook.com') ? 'serper_facebook' : 'serper_web_search',
                        evidenceTitle: result.title || undefined,
                        evidenceSnippet: result.snippet || undefined,
                        evidenceUrl: result.link || undefined,
                    };
                }
            }

            // Check knowledge graph if present
            if (data.knowledgeGraph) {
                const kg = data.knowledgeGraph;
                const kgAssociated = isSearchResultAssociatedWithBusiness(
                    { title: kg.title || kg.name, snippet: kg.description, link: kg.website },
                    businessName,
                    location,
                    domain
                );
                if (!kgAssociated) continue;
                if (kg.email) {
                    return {
                        email: kg.email.toLowerCase(),
                        phone: kg.phone,
                        facebookUrl,
                        source: 'serper_knowledge_graph',
                        evidenceTitle: kg.title || kg.name || undefined,
                        evidenceSnippet: kg.description || undefined,
                        evidenceUrl: kg.website || undefined,
                    };
                }
                if (kg.phone && !data.organic?.length) {
                    return {
                        phone: kg.phone,
                        facebookUrl,
                        source: 'serper_knowledge_graph',
                        evidenceTitle: kg.title || kg.name || undefined,
                        evidenceSnippet: kg.description || undefined,
                        evidenceUrl: kg.website || undefined,
                    };
                }
            }

        } catch (error) {
            console.error(`Serper search error for query "${query}":`, error);
        }
    }

    return { facebookUrl, source: 'serper_exhausted' };
}

