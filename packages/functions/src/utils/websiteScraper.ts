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

/**
 * Scrapes a website and extracts contact information using AI-powered extraction
 */
export async function scrapeWebsite(url: string, geminiApiKey: string): Promise<EnrichmentResult> {
    try {
        // 1. Fetch website HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; XiriBot/1.0; +https://xiri.ai/bot)',
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 2. Extract structured data first (fastest, most reliable)
        const structuredData = extractStructuredData($);

        // 3. Extract from common patterns
        const patternData = extractFromPatterns($, html);

        // 4. Find and scrape contact page if needed
        let contactPageData: Partial<ScrapedData> = {};
        if (!structuredData.email || !structuredData.phone) {
            const contactUrl = findContactPage($, url);
            if (contactUrl) {
                contactPageData = await scrapeContactPage(contactUrl);
            }
        }

        // 5. Combine all data sources
        const combinedData: ScrapedData = {
            email: structuredData.email || patternData.email || contactPageData.email,
            phone: structuredData.phone || patternData.phone || contactPageData.phone,
            address: structuredData.address || patternData.address || contactPageData.address,
            businessName: structuredData.businessName || patternData.businessName,
            contactFormUrl: contactPageData.contactFormUrl,
            socialMedia: {
                linkedin: patternData.socialMedia?.linkedin,
                facebook: patternData.socialMedia?.facebook,
                twitter: patternData.socialMedia?.twitter,
            },
            confidence: determineConfidence(structuredData, patternData, contactPageData),
            source: 'web-scraper',
        };

        // 6. If still missing critical data, use AI extraction
        if (!combinedData.email || !combinedData.phone) {
            const aiData = await extractWithAI(html, geminiApiKey);
            combinedData.email = combinedData.email || aiData.email;
            combinedData.phone = combinedData.phone || aiData.phone;
            combinedData.address = combinedData.address || aiData.address;
        }

        // 7. Validate and format data
        if (combinedData.email) {
            combinedData.email = validateEmail(combinedData.email);
        }
        if (combinedData.phone) {
            combinedData.phone = formatPhone(combinedData.phone);
        }

        return { success: true, data: combinedData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Extract data from structured meta tags and schema.org
 */
function extractStructuredData($: cheerio.CheerioAPI): Partial<ScrapedData> {
    const data: Partial<ScrapedData> = {};

    // Meta tags
    data.email = $('meta[property="og:email"]').attr('content') ||
        $('meta[name="contact:email"]').attr('content');

    data.phone = $('meta[property="og:phone_number"]').attr('content') ||
        $('meta[name="contact:phone"]').attr('content');

    // Schema.org structured data
    $('script[type="application/ld+json"]').each((_, elem) => {
        try {
            const json = JSON.parse($(elem).html() || '{}');
            if (json['@type'] === 'Organization' || json['@type'] === 'LocalBusiness') {
                data.email = data.email || json.email;
                data.phone = data.phone || json.telephone;
                data.businessName = data.businessName || json.name;
                if (json.address) {
                    data.address = typeof json.address === 'string'
                        ? json.address
                        : `${json.address.streetAddress}, ${json.address.addressLocality}, ${json.address.addressRegion} ${json.address.postalCode}`;
                }
            }
        } catch (e) {
            // Invalid JSON, skip
        }
    });

    // Business name from title/h1
    data.businessName = data.businessName ||
        $('meta[property="og:site_name"]').attr('content') ||
        $('title').text().split('|')[0].trim() ||
        $('h1').first().text().trim();

    return data;
}

/**
 * Extract data using regex patterns
 */
function extractFromPatterns($: cheerio.CheerioAPI, html: string): Partial<ScrapedData> {
    const data: Partial<ScrapedData> = {
        socialMedia: {},
    };

    // Email regex - exclude common generic/spam emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    const validEmails = emails.filter(email =>
        !email.match(/^(info|admin|noreply|no-reply|support|hello|contact)@/i) &&
        !email.includes('example.com') &&
        !email.includes('domain.com')
    );
    data.email = validEmails[0];

    // Phone regex (US format)
    const phoneRegex = /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = html.match(phoneRegex) || [];
    data.phone = phones[0];

    // Social media links
    $('a[href*="linkedin.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && href.includes('/company/')) {
            data.socialMedia!.linkedin = href;
        }
    });

    $('a[href*="facebook.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
            data.socialMedia!.facebook = href;
        }
    });

    $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
            data.socialMedia!.twitter = href;
        }
    });

    return data;
}

/**
 * Find contact page URL
 */
function findContactPage($: cheerio.CheerioAPI, baseUrl: string): string | null {
    const contactKeywords = ['contact', 'about', 'location', 'reach-us', 'get-in-touch'];

    let contactUrl: string | null = null;
    $('a').each((_, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase();

        if (href && contactKeywords.some(keyword =>
            href.toLowerCase().includes(keyword) || text.includes(keyword)
        )) {
            contactUrl = new URL(href, baseUrl).href;
            return false; // break
        }
        return; // continue
    });

    return contactUrl;
}

/**
 * Scrape contact page
 */
async function scrapeContactPage(url: string): Promise<Partial<ScrapedData>> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; XiriBot/1.0; +https://xiri.ai/bot)',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return {};

        const html = await response.text();
        const $ = cheerio.load(html);

        const data = extractFromPatterns($, html);

        // Detect contact form on the page
        const hasForm = $('form').length > 0;
        if (hasForm) {
            data.contactFormUrl = url;
        }

        return data;
    } catch (error) {
        return {};
    }
}

/**
 * Extract contact info using Gemini AI
 */
async function extractWithAI(html: string, geminiApiKey: string): Promise<Partial<ScrapedData>> {
    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Strip HTML to plain text and limit size
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 10000);

        const prompt = `Extract business contact information from this website content. Return ONLY a JSON object with these fields (use null if not found):
{
  "email": "primary business email (not info@, admin@, noreply@)",
  "phone": "primary phone number in format (xxx) xxx-xxxx",
  "address": "full physical address if available",
  "businessName": "official business name"
}

Website content:
${text}`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return {
                email: data.email !== 'null' ? data.email : undefined,
                phone: data.phone !== 'null' ? data.phone : undefined,
                address: data.address !== 'null' ? data.address : undefined,
                businessName: data.businessName !== 'null' ? data.businessName : undefined,
            };
        }

        return {};
    } catch (error) {
        console.error('AI extraction error:', error);
        return {};
    }
}

/**
 * Determine confidence level based on data sources
 */
function determineConfidence(
    structured: Partial<ScrapedData>,
    pattern: Partial<ScrapedData>,
    contact: Partial<ScrapedData>
): 'high' | 'medium' | 'low' {
    if (structured.email || structured.phone) return 'high';
    if (contact.email || contact.phone) return 'medium';
    if (pattern.email || pattern.phone) return 'low';
    return 'low';
}

/**
 * Validate email format and exclude common invalid patterns
 */
function validateEmail(email: string): string | undefined {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return undefined;

    // Exclude generic emails
    if (email.match(/^(info|admin|noreply|no-reply|support|hello|contact|webmaster)@/i)) {
        return undefined;
    }

    return email.toLowerCase();
}

/**
 * Format phone number to (xxx) xxx-xxxx
 */
function formatPhone(phone: string): string | undefined {
    const digits = phone.replace(/\D/g, '');

    // Handle US numbers (10 or 11 digits)
    if (digits.length === 10) {
        return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
        return `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
    }

    return undefined;
}
