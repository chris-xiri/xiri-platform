import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
export async function scrapeWebsite(url: string, geminiApiKey: string): Promise<EnrichmentResult> {
    try {
        // ─── Step 1: Scrape homepage ───
        const homepage = await fetchPage(url);
        if (!homepage) {
            return { success: false, error: `Could not fetch ${url}` };
        }

        const structuredData = extractStructuredData(homepage.$);
        const patternData = extractFromPatterns(homepage.$, homepage.html);
        const linkData = extractMailtoAndTel(homepage.$);

        // ─── Step 2: Find and scrape additional pages (contact, about, team) ───
        const additionalPages = findAdditionalPages(homepage.$, url);
        const contactPageResults: Partial<ScrapedData>[] = [];
        let allAdditionalHtml = '';

        for (const pageUrl of additionalPages.slice(0, 3)) { // max 3 extra pages
            const page = await fetchPage(pageUrl);
            if (!page) continue;

            const pagePatterns = extractFromPatterns(page.$, page.html);
            const pageLinks = extractMailtoAndTel(page.$);

            // Detect contact form
            const hasForm = page.$('form').length > 0;
            if (hasForm) pagePatterns.contactFormUrl = pageUrl;

            contactPageResults.push({
                ...pagePatterns,
                email: pageLinks.email || pagePatterns.email,
                phone: pageLinks.phone || pagePatterns.phone,
            });

            allAdditionalHtml += page.html + '\n';
        }

        // ─── Step 3: Merge all data (priority: structured > mailto/tel > contact pages > homepage patterns) ───
        const mergedContact = mergeContactPages(contactPageResults);

        const combinedData: ScrapedData = {
            email: structuredData.email || linkData.email || mergedContact.email || patternData.email,
            phone: structuredData.phone || linkData.phone || mergedContact.phone || patternData.phone,
            address: structuredData.address || mergedContact.address || patternData.address,
            businessName: structuredData.businessName || patternData.businessName,
            contactFormUrl: mergedContact.contactFormUrl,
            socialMedia: {
                linkedin: patternData.socialMedia?.linkedin || mergedContact.socialMedia?.linkedin,
                facebook: patternData.socialMedia?.facebook || mergedContact.socialMedia?.facebook,
                twitter: patternData.socialMedia?.twitter || mergedContact.socialMedia?.twitter,
            },
            confidence: 'low',
            source: 'web-scraper',
        };

        // ─── Step 4: Generic email fallback (info@, contact@) if no personal email found ───
        if (!combinedData.email) {
            const genericEmail = findGenericEmail(homepage.html, allAdditionalHtml);
            if (genericEmail) {
                combinedData.email = genericEmail;
            }
        }

        // ─── Step 5: AI extraction on the best available HTML ───
        if (!combinedData.email || !combinedData.phone) {
            // Feed AI the contact/about page if available, otherwise homepage
            const aiHtml = allAdditionalHtml.length > 500 ? allAdditionalHtml : homepage.html;
            const aiData = await extractWithAI(aiHtml, geminiApiKey);
            combinedData.email = combinedData.email || aiData.email;
            combinedData.phone = combinedData.phone || aiData.phone;
            combinedData.address = combinedData.address || aiData.address;
            combinedData.businessName = combinedData.businessName || aiData.businessName;
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

    // mailto: links
    $('a[href^="mailto:"]').each((_, elem) => {
        if (email) return;
        const href = $(elem).attr('href');
        if (href) {
            const addr = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
            // Prefer personal emails over generic
            if (!addr.match(/^(noreply|no-reply|support|webmaster)@/i)) {
                email = addr;
            }
        }
    });

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

    // Email regex — exclude common junk but keep business-relevant emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
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

/**
 * Find all relevant pages to scrape (contact, about, team, locations)
 */
function findAdditionalPages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const keywords = [
        'contact', 'about', 'about-us', 'our-team', 'team',
        'location', 'locations', 'reach-us', 'get-in-touch',
        'connect', 'find-us', 'staff', 'leadership'
    ];

    const found = new Set<string>();

    $('a').each((_, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase().trim();
        if (!href) return;

        // Skip external, anchor, tel, mailto links
        if (href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return;

        const lowerHref = href.toLowerCase();
        const isMatch = keywords.some(kw => lowerHref.includes(kw) || text.includes(kw));
        if (!isMatch) return;

        try {
            const fullUrl = new URL(href, baseUrl).href;
            // Only same-domain pages
            if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
                found.add(fullUrl);
            }
        } catch {
            // Invalid URL
        }
    });

    return Array.from(found);
}

/**
 * Find generic emails (info@, contact@) as fallback when no personal email found
 */
function findGenericEmail(...htmlSources: string[]): string | undefined {
    const combined = htmlSources.join(' ');
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
async function extractWithAI(html: string, geminiApiKey: string): Promise<Partial<ScrapedData>> {
    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Strip HTML to plain text and limit size (use more content for better results)
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 15000);

        const prompt = `Extract business contact information from this website content. 
This is a commercial cleaning or janitorial company. Find the owner/manager's direct contact info if possible.

Return ONLY a JSON object with these fields (use null if not found):
{
  "email": "email address (prefer personal/owner email over generic info@)",
  "phone": "primary phone number in format (xxx) xxx-xxxx",
  "address": "full physical address if available",
  "businessName": "official business name"
}

Website content:
${text}`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return {
                email: data.email && data.email !== 'null' && data.email !== null ? data.email : undefined,
                phone: data.phone && data.phone !== 'null' && data.phone !== null ? data.phone : undefined,
                address: data.address && data.address !== 'null' && data.address !== null ? data.address : undefined,
                businessName: data.businessName && data.businessName !== 'null' && data.businessName !== null ? data.businessName : undefined,
            };
        }

        return {};
    } catch (error) {
        console.error('AI extraction error:', error);
        return {};
    }
}

// ═══════════════════════════════════════════════════════
// VALIDATION & HELPERS
// ═══════════════════════════════════════════════════════

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
                if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
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
    serperApiKey?: string
): Promise<{ email?: string; phone?: string; source: string }> {
    const apiKey = serperApiKey || process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('No SERPER_API_KEY available for web email search.');
        return { source: 'serper_skipped' };
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g;

    const queries: string[] = [];

    // Strategy 1: site-specific search (most targeted)
    if (domain) {
        queries.push(`site:${domain} email OR contact`);
    }

    // Strategy 2: business name + location search
    queries.push(`"${businessName}" ${location} email contact`);

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
                        source: 'serper_web_search'
                    };
                }
            }

            // Check knowledge graph if present
            if (data.knowledgeGraph) {
                const kg = data.knowledgeGraph;
                if (kg.email) {
                    return { email: kg.email.toLowerCase(), phone: kg.phone, source: 'serper_knowledge_graph' };
                }
                if (kg.phone && !data.organic?.length) {
                    return { phone: kg.phone, source: 'serper_knowledge_graph' };
                }
            }

        } catch (error) {
            console.error(`Serper search error for query "${query}":`, error);
        }
    }

    return { source: 'serper_exhausted' };
}

