/**
 * Prospector Agent — Waterfall Enrichment Orchestrator
 *
 * Discovers local businesses and enriches each with owner/decision-maker
 * contact info using a multi-layer waterfall:
 *
 *   Layer 1: Website scraping (mailto, structured data, AI owner extraction)
 *   Layer 2: Serper web search (Facebook, person+business, directories)
 *   Layer 3: Enrichment waterfall (email pattern guesser + optional Hunter.io)
 *
 * Each layer stops early if a personal email is found.
 */

import { searchVendors, RawVendor } from './sourcer';
import { scrapeWebsite, searchWebForEmail } from '../utils/websiteScraper';
import { runEnrichmentWaterfall } from '../utils/enrichmentProviders';
import { classifyFacilityType } from '../utils/facilityClassifier';
import type { EnrichedProspect, EmailSource, ProspectContact } from '@xiri/shared';
import { inferFacilityType, type FacilityType } from '@xiri/shared';

const GENERIC_PREFIXES = /^(info|contact|hello|office|admin|sales|team|service|services|marketing|support|billing|accounting|bookkeeping|inquiries|front|manager)@/i;

// Domains that are never a valid business email — library credits, tracking, platform junk
const JUNK_EMAIL_DOMAINS = new Set([
    'example.com', 'domain.com', 'test.com', 'sentry.io', 'wixpress.com',
    'wordpress.org', 'wordpress.com', 'squarespace.com', 'weebly.com',
    'godaddy.com', 'namecheap.com', 'cloudflare.com', 'netlify.com',
    'vercel.com', 'heroku.com', 'amazonaws.com', 'google.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'broofa.com', 'uab.edu', 'w3.org', 'schema.org', 'jquery.com',
    'bootstrapcdn.com', 'cdnjs.com', 'unpkg.com', 'jsdelivr.net',
    'fontawesome.com', 'typekit.net', 'googleusercontent.com',
    'gstatic.com', 'googleapis.com', 'fbcdn.net', 'twimg.com',
    'linkedinusercontent.com', 'mysite.com',
]);

// Free email providers — valid for small businesses that use personal email
const FREE_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'msn.com', 'live.com',
    'verizon.net', 'comcast.net', 'att.net', 'sbcglobal.net',
    'optonline.net', 'optimum.net', 'cox.net', 'charter.net',
    'earthlink.net', 'juno.com', 'protonmail.com', 'proton.me',
    'zoho.com', 'yandex.com', 'mail.com', 'inbox.com',
    'atlanticbbn.net', // regional ISP
]);

/**
 * Strip common suffixes/noise words from a domain root for better matching.
 * e.g. "exceedlearningcenterny" → "exceedlearning"
 */
function stripDomainNoise(root: string): string {
    return root
        .replace(/[-_]/g, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, ''); // run twice for stacked suffixes
}

/**
 * Validate whether an email plausibly belongs to a business.
 * Returns 'domain_match' | 'free_provider' | 'junk' | 'mismatch'
 */
function validateEmailForBusiness(
    email: string,
    businessWebsite?: string | null
): 'domain_match' | 'free_provider' | 'junk' | 'mismatch' {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) return 'junk';

    // Block known junk domains
    if (JUNK_EMAIL_DOMAINS.has(emailDomain)) return 'junk';

    // Allow free email providers (common for small biz owners)
    if (FREE_EMAIL_PROVIDERS.has(emailDomain)) return 'free_provider';

    // If we have a business website, check domain match
    if (businessWebsite) {
        const bizDomain = extractDomain(businessWebsite);
        if (bizDomain) {
            // 1. Exact match or subdomain match
            if (emailDomain === bizDomain || emailDomain.endsWith('.' + bizDomain)) {
                return 'domain_match';
            }

            const bizRoot = bizDomain.split('.')[0].replace(/[-_]/g, '');
            const emailRoot = emailDomain.split('.')[0].replace(/[-_]/g, '');

            // 2. Simple substring match (one contains the other)
            // Require at least 5 chars to avoid false positives with short abbreviations
            // e.g. 'umc' (3 chars) must NOT match 'umcom' even though 'umcom'.includes('umc')
            if (bizRoot.length >= 5 && emailRoot.length >= 5 &&
                (bizRoot.includes(emailRoot) || emailRoot.includes(bizRoot))) {
                return 'domain_match';
            }

            // 3. Stripped match (remove common suffixes like 'center', 'ny', 'mail')
            const bizStripped = stripDomainNoise(bizRoot);
            const emailStripped = stripDomainNoise(emailRoot);
            if (bizStripped.length >= 5 && emailStripped.length >= 5 &&
                (bizStripped.includes(emailStripped) || emailStripped.includes(bizStripped))) {
                return 'domain_match';
            }

            // 4. TLD-swapped check (same root, different TLD)
            const bizBase = bizDomain.split('.').slice(0, -1).join('.');
            const emailBase = emailDomain.split('.').slice(0, -1).join('.');
            if (bizBase === emailBase) {
                return 'domain_match';
            }

            // Email domain doesn't match website — suspicious
            return 'mismatch';
        }
    }

    // No website to compare against — can't validate, assume ok
    return 'free_provider';
}

function getDecisionMakerTitles(facilityType?: FacilityType | null, fallbackQuery?: string): string[] {
    const resolved = facilityType || inferFacilityType(fallbackQuery) || 'other';
    return FACILITY_DECISION_MAKERS[resolved] || FACILITY_DECISION_MAKERS.other;
}

interface ProspectorInput {
    query: string;
    location: string;
    maxResults?: number;
    skipPaidApis?: boolean;
}

interface ProspectorOutput {
    prospects: EnrichedProspect[];
    stats: {
        discovered: number;
        withPersonalEmail: number;
        withGenericEmail: number;
        noEmail: number;
        skippedNoWebsite: number;
    };
}

const FACILITY_DECISION_MAKERS: Record<string, string[]> = {
    medical_dental: ['practice manager', 'office manager', 'practice administrator', 'owner', 'dentist'],
    medical_private: ['practice manager', 'office manager', 'practice administrator', 'administrator', 'owner'],
    medical_urgent_care: ['clinic manager', 'operations manager', 'facility administrator', 'administrator'],
    medical_surgery: ['facility administrator', 'practice administrator', 'director of operations', 'administrator'],
    medical_dialysis: ['facility administrator', 'clinic manager', 'operations manager', 'administrator'],
    medical_veterinary: ['practice manager', 'hospital manager', 'office manager', 'owner'],
    medical_physical_therapy: ['center director', 'practice manager', 'office manager', 'owner'],
    edu_daycare: ['director', 'center director', 'owner', 'administrator'],
    edu_tutoring: ['center director', 'center manager', 'director', 'owner'],
    edu_private_school: ['head of school', 'principal', 'director of operations', 'administrator'],
    auto_dealer_showroom: ['general manager', 'dealer principal', 'operations manager', 'owner'],
    auto_service_center: ['shop owner', 'owner', 'service manager', 'general manager', 'operations manager'],
    lab_cleanroom: ['facilities manager', 'operations manager', 'facility manager'],
    lab_bsl: ['facilities manager', 'operations manager', 'facility manager'],
    manufacturing_light: ['facilities manager', 'operations manager', 'plant manager', 'facility manager'],
    fitness_gym: ['general manager', 'owner', 'studio manager', 'operations manager'],
    retail_storefront: ['store manager', 'owner', 'general manager', 'operations manager'],
    religious_center: ['executive director', 'administrator', 'office administrator'],
    funeral_home: ['funeral director', 'owner', 'manager'],
    office_general: ['office manager', 'facilities manager', 'operations manager', 'property manager'],
    other: ['office manager', 'operations manager', 'owner', 'administrator'],
};

/**
 * Run the full prospecting pipeline.
 */
export async function prospectAndEnrich(
    input: ProspectorInput,
    secrets: {
        geminiApiKey: string;
        serperApiKey: string;
        hunterApiKey?: string;
    }
): Promise<ProspectorOutput> {
    const maxResults = input.maxResults || 20;

    // ═══════════════════════════════════════════════════════
    // LAYER 0: Discovery via Serper Places
    // ═══════════════════════════════════════════════════════
    console.log(`[Prospector] Discovering: "${input.query}" in "${input.location}"...`);
    const rawVendors = await searchVendors(input.query, input.location, 'google_maps');
    console.log(`[Prospector] Discovered ${rawVendors.length} businesses.`);

    const prospects: EnrichedProspect[] = [];
    const stats = {
        discovered: rawVendors.length,
        withPersonalEmail: 0,
        withGenericEmail: 0,
        noEmail: 0,
        skippedNoWebsite: 0,
    };

    // Process up to maxResults businesses
    const toProcess = rawVendors.slice(0, maxResults);

    // Pipeline-level time guard — stop at 7 min to leave 2 min for cleanup/writes
    const PIPELINE_TIME_BUDGET_MS = 7 * 60 * 1000; // 420s
    const PER_BUSINESS_TIMEOUT_MS = 8_000;  // 8s per business (was 30s — parallel batches make this safe)
    const CONCURRENCY = 5;                  // Process 5 businesses concurrently
    const pipelineStart = Date.now();

    // ── Parallel batch processing ──
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
        // ── Pipeline time guard ──
        const elapsed = Date.now() - pipelineStart;
        if (elapsed > PIPELINE_TIME_BUDGET_MS) {
            console.log(`[Prospector] ⏱️ Pipeline time budget exhausted (${Math.round(elapsed / 1000)}s). Processed ${prospects.length}/${toProcess.length} businesses.`);
            break;
        }

        const chunk = toProcess.slice(i, i + CONCURRENCY);
        console.log(`[Prospector] 🔄 Processing batch ${Math.floor(i / CONCURRENCY) + 1} (${chunk.length} businesses in parallel)...`);

        const results = await Promise.allSettled(
            chunk.map(vendor =>
                Promise.race([
                    enrichSingleBusiness(vendor, secrets, input),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error(`Enrichment timed out after ${PER_BUSINESS_TIMEOUT_MS / 1000}s`)), PER_BUSINESS_TIMEOUT_MS)
                    ),
                ])
            )
        );

        for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const vendor = chunk[j];
            let prospect: EnrichedProspect;

            if (result.status === 'fulfilled') {
                prospect = result.value;
            } else {
                console.warn(`[Prospector] ⚠️ Skipping "${vendor.name}": ${result.reason?.message}`);
                prospect = {
                    businessName: vendor.name,
                    address: vendor.location,
                    phone: vendor.phone,
                    website: vendor.website,
                    rating: vendor.rating,
                    userRatingsTotal: vendor.user_ratings_total,
                    emailSource: 'none' as EmailSource,
                    emailConfidence: 'low' as const,
                    enrichmentLog: [`Skipped: ${result.reason?.message}`],
                };
            }

            prospects.push(prospect);

            if (prospect.contactEmail && !GENERIC_PREFIXES.test(prospect.contactEmail)) {
                stats.withPersonalEmail++;
            } else if (prospect.genericEmail || prospect.contactEmail) {
                stats.withGenericEmail++;
            } else {
                stats.noEmail++;
            }

            if (!vendor.website) {
                stats.skippedNoWebsite++;
            }
        }
    }

    // Sort: personal emails first, then generic, then none
    prospects.sort((a, b) => {
        const scoreA = a.contactEmail ? 2 : a.genericEmail ? 1 : 0;
        const scoreB = b.contactEmail ? 2 : b.genericEmail ? 1 : 0;
        return scoreB - scoreA;
    });

    console.log(`[Prospector] Done. Results: ${stats.withPersonalEmail} personal, ${stats.withGenericEmail} generic, ${stats.noEmail} none.`);
    return { prospects, stats };
}

/**
 * Enrich a single business through the full waterfall.
 */
async function enrichSingleBusiness(
    vendor: RawVendor,
    secrets: {
        geminiApiKey: string;
        serperApiKey: string;
        hunterApiKey?: string;
    },
    input: ProspectorInput
): Promise<EnrichedProspect> {
    const log: string[] = [];
    let targetTitles = inferPreferredDecisionMakerTitles(input.query);
    const prospect: EnrichedProspect = {
        businessName: vendor.name,
        address: vendor.location,
        phone: vendor.phone,
        website: vendor.website,
        rating: vendor.rating,
        userRatingsTotal: vendor.user_ratings_total,
        emailSource: 'none',
        emailConfidence: 'low',
        enrichmentLog: log,
    };

    log.push(`Starting enrichment for "${vendor.name}"`);

    if (!vendor.website) {
        log.push('No website available — skipping to Layer 2 (web search)');

        // Still try web search even without a website
        await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log);

        // Try paid APIs only if we have a domain from somewhere
        if (!prospect.contactEmail && !input.skipPaidApis) {
            log.push('Skipping Layer 3 — no domain available for enrichment APIs');
        }

        return prospect;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 1: Website Scraping + AI Owner Extraction
    // ═══════════════════════════════════════════════════════
    log.push(`Layer 1: Scraping ${vendor.website}...`);

    try {
        prospect.facilityType = await classifyFacilityType(vendor.website, vendor.name, input.query, secrets.geminiApiKey, log);
        targetTitles = getDecisionMakerTitles(prospect.facilityType, input.query);

        const scrapeResult = await scrapeWebsite(vendor.website, secrets.geminiApiKey);

        if (scrapeResult.success && scrapeResult.data) {
            const data = scrapeResult.data;

            // Capture owner info from AI extraction
            if (data.ownerName) {
                prospect.contactName = data.ownerName;
                prospect.contactTitle = data.ownerTitle;
                log.push(`AI found owner: ${data.ownerName} (${data.ownerTitle || 'unknown title'})`);
            }

            // Capture social links
            if (data.socialMedia?.facebook) {
                prospect.facebookUrl = data.socialMedia.facebook;
            }
            if (data.socialMedia?.linkedin) {
                prospect.linkedinUrl = data.socialMedia.linkedin;
            }

            // Check if we got a personal email (owner-specific or from mailto)
            const bestEmail = data.ownerEmail || data.email;
            if (bestEmail && !GENERIC_PREFIXES.test(bestEmail)) {
                // ── EMAIL-DOMAIN VALIDATION ──
                const emailValid = validateEmailForBusiness(bestEmail, vendor.website);
                if (emailValid === 'junk') {
                    log.push(`⚠️ Rejected junk email: ${bestEmail} (domain is blocklisted)`);
                } else if (emailValid === 'mismatch') {
                    log.push(`⚠️ Email domain mismatch: ${bestEmail} doesn't match website ${vendor.website} — skipping`);
                    log.push(`Skipping off-domain email from website scrape: ${bestEmail}`);
                } else {
                    prospect.contactEmail = bestEmail;
                    prospect.emailSource = data.ownerEmail ? 'ai_extraction' : 'mailto';
                    prospect.emailConfidence = emailValid === 'domain_match' ? 'high' : 'medium';
                    log.push(`Found personal email: ${bestEmail} (source: ${prospect.emailSource}, validation: ${emailValid})`);

                    // Also store generic if we have one separately
                    if (data.allEmails) {
                        const generic = data.allEmails.find(e => e.type === 'generic');
                        if (generic) prospect.genericEmail = generic.email;
                    }

                    return prospect; // Done — personal email found and validated
                }
            }

            // Only generic email found
            if (bestEmail && GENERIC_PREFIXES.test(bestEmail)) {
                prospect.genericEmail = bestEmail;
                log.push(`Found generic email: ${bestEmail} — continuing search for personal...`);
            }

            // Check classified allEmails for personal ones we might have missed
            if (data.allEmails) {
                // Filter out junk/mismatch emails before considering them
                const validPersonals = data.allEmails.filter(e => {
                    if (e.type !== 'personal') return false;
                    const v = validateEmailForBusiness(e.email, vendor.website);
                    if (v === 'junk') {
                        log.push(`⚠️ Filtered junk mailto: ${e.email}`);
                        return false;
                    }
                    if (v === 'mismatch') {
                        log.push(`⚠️ Filtered mismatched mailto: ${e.email} (doesn't match ${vendor.website})`);
                        return false;
                    }
                    return true;
                });
                const personalFromMailto = validPersonals[0];
                if (personalFromMailto) {
                    prospect.contactEmail = personalFromMailto.email;
                    prospect.emailSource = 'mailto';
                    prospect.emailConfidence = 'high';
                    log.push(`Found personal email from mailto scan: ${personalFromMailto.email}`);
                    return prospect;
                }

                const genericFromMailto = data.allEmails.find(e => e.type === 'generic');
                if (genericFromMailto && !prospect.genericEmail) {
                    prospect.genericEmail = genericFromMailto.email;
                }
            }

            // Update phone/address if not already set
            prospect.phone = prospect.phone || data.phone;
            prospect.address = prospect.address || data.address;
        } else {
            log.push(`Scraping failed: ${scrapeResult.error || 'unknown error'}`);
        }
    } catch (error: any) {
        log.push(`Layer 1 error: ${error.message}`);
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 2: Serper Web Search (Facebook + directories)
    // ═══════════════════════════════════════════════════════
    await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log);
    if (prospect.contactEmail) return prospect;

    // ═══════════════════════════════════════════════════════
    // LAYER 2.5: LinkedIn Decision-Maker Discovery
    // If we don't have a contact name, search LinkedIn to find one.
    // This name feeds the pattern guesser in Layer 3.
    // ═══════════════════════════════════════════════════════
    if (!prospect.contactName && secrets.serperApiKey) {
        try {
            const linkedinName = await searchLinkedInForDecisionMaker(
                vendor.name,
                input.location,
                secrets.serperApiKey,
                log,
                targetTitles
            );
            if (linkedinName) {
                prospect.contactName = linkedinName.name;
                prospect.contactTitle = prospect.contactTitle || linkedinName.title;
                log.push(`LinkedIn discovery: Found ${linkedinName.name} (${linkedinName.title})`);
            }
        } catch (error: any) {
            log.push(`LinkedIn discovery error: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 3: Enrichment Waterfall (Pattern Guesser + optional APIs)
    // ═══════════════════════════════════════════════════════
    if (!input.skipPaidApis) {
        const domain = extractDomain(vendor.website);
        if (domain) {
            log.push(`Layer 3: Running enrichment waterfall for ${domain}...`);

            const waterfallResult = await runEnrichmentWaterfall(
                domain,
                { hunterApiKey: secrets.hunterApiKey },
                {
                    contactName: prospect.contactName,
                    knownGenericEmail: prospect.genericEmail,
                    preferredTitles: targetTitles,
                },
            );

            log.push(...waterfallResult.log);

            // Persist ALL discovered contacts
            if (waterfallResult.allEmails.length > 0) {
                const apiContacts: ProspectContact[] = waterfallResult.allEmails
                    .filter(e => validateEmailForBusiness(e.email, vendor.website) === 'domain_match')
                    .map(e => ({
                        email: e.email,
                        firstName: e.firstName,
                        lastName: e.lastName,
                        position: e.position,
                        confidence: e.confidence,
                        type: e.type,
                        provider: e.provider,
                    }));
                // Merge with any contacts already found from scraping
                prospect.allContacts = [...(prospect.allContacts || []), ...apiContacts];
                log.push(`Stored ${apiContacts.length} total contacts from enrichment waterfall`);
            }

            if (waterfallResult.email) {
                const waterfallEmailValid = validateEmailForBusiness(waterfallResult.email, vendor.website);
                if (waterfallEmailValid !== 'domain_match') {
                    log.push(`Skipping non-company email from waterfall: ${waterfallResult.email} (validation: ${waterfallEmailValid})`);
                } else if (waterfallResult.type === 'personal') {
                    prospect.contactEmail = waterfallResult.email;
                    prospect.contactName = prospect.contactName ||
                        (waterfallResult.firstName && waterfallResult.lastName
                            ? `${waterfallResult.firstName} ${waterfallResult.lastName}`
                            : undefined);
                    prospect.contactTitle = prospect.contactTitle || waterfallResult.position;
                    prospect.emailSource = waterfallResult.provider as EmailSource;
                    prospect.emailConfidence = 'medium';
                    return prospect;
                } else {
                    // Generic from waterfall (pattern guess or API)
                    prospect.genericEmail = prospect.genericEmail || waterfallResult.email;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FINAL: Use best available email
    // ═══════════════════════════════════════════════════════
    if (!prospect.contactEmail) {
        // Strategy: prefer pattern-guessed personal email over generic
        // If we have a contact name AND a proven domain (generic email found),
        // a pattern guess like firstname@domain.com is far more actionable
        // than info@domain.com for cold outreach.
        const bestPatternGuess = prospect.allContacts?.find(
            c => c.type === 'personal' && c.provider === 'pattern_guess' && (c.confidence || 0) >= 60
        );

        if (bestPatternGuess && prospect.contactName && prospect.genericEmail) {
            // Domain is proven (generic exists), contact name is known → trust the guess
            prospect.contactEmail = bestPatternGuess.email;
            prospect.emailSource = 'pattern_guess';
            prospect.emailConfidence = 'medium';
            // Keep generic as fallback for the outreach system
            log.push(`Using pattern-guessed personal email: ${bestPatternGuess.email} (confidence: ${bestPatternGuess.confidence}, fallback: ${prospect.genericEmail})`);
        } else if (prospect.genericEmail) {
            prospect.contactEmail = prospect.genericEmail;
            prospect.emailSource = 'none'; // It's generic
            prospect.emailConfidence = 'low';
            log.push(`No personal email found — using generic: ${prospect.genericEmail}`);
        } else {
            log.push('No email found across all layers.');
        }
    }

    return prospect;
}

function inferPreferredDecisionMakerTitles(searchQuery?: string): string[] {
    return getDecisionMakerTitles(undefined, searchQuery);
}

/**
 * Layer 2 helper: targeted web searches via Serper
 */
async function trySerperSearch(
    prospect: EnrichedProspect,
    vendor: RawVendor,
    serperApiKey: string,
    location: string,
    log: string[]
): Promise<void> {
    log.push('Layer 2: Searching web (Facebook, directories, person search)...');

    try {
        const domain = vendor.website ? extractDomain(vendor.website) : undefined;
        const searchResult = await searchWebForEmail(
            vendor.name,
            location,
            domain,
            serperApiKey,
            prospect.contactName // If AI found an owner name, use it for targeted search
        );

        // Capture Facebook URL
        if (searchResult.facebookUrl && !prospect.facebookUrl) {
            prospect.facebookUrl = searchResult.facebookUrl;
            log.push(`Found Facebook: ${searchResult.facebookUrl}`);
        }

        if (searchResult.email) {
            // ── EMAIL-DOMAIN VALIDATION for web search results ──
            const webEmailValid = validateEmailForBusiness(searchResult.email, vendor.website);
            if (webEmailValid === 'junk') {
                log.push(`⚠️ Rejected junk email from web search: ${searchResult.email}`);
            } else if (webEmailValid === 'free_provider' && !!vendor.website) {
                log.push(`⚠️ Rejected off-domain web email: ${searchResult.email} (published off-site and not tied to ${vendor.website})`);
            } else if (webEmailValid === 'mismatch') {
                log.push(`⚠️ Web search email mismatch: ${searchResult.email} doesn't match ${vendor.website} — skipping`);
                // Don't accept mismatched emails from web search — too unreliable
            } else {
                const isPersonal = !GENERIC_PREFIXES.test(searchResult.email);
                if (isPersonal) {
                    prospect.contactEmail = searchResult.email;
                    prospect.emailSource = searchResult.source.includes('facebook')
                        ? 'serper_facebook'
                        : 'serper_search';
                    prospect.emailConfidence = webEmailValid === 'domain_match' ? 'high' : 'medium';
                    log.push(`Found personal email via web search: ${searchResult.email} (${searchResult.source}, validation: ${webEmailValid})`);
                } else {
                    prospect.genericEmail = prospect.genericEmail || searchResult.email;
                    log.push(`Found generic email via web search: ${searchResult.email} — continuing...`);
                }
            }
        } else {
            log.push(`No email found via web search (source: ${searchResult.source})`);
        }

        // Phone fallback
        if (!prospect.phone && searchResult.phone) {
            prospect.phone = searchResult.phone;
        }
    } catch (error: any) {
        log.push(`Layer 2 error: ${error.message}`);
    }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | undefined {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return undefined;
    }
}

/**
 * Search LinkedIn via Serper to discover decision-maker names.
 * Uses 1 Serper credit. Only called when we don't already have a contactName.
 * LinkedIn titles follow the format: "Name - Title - Company | LinkedIn"
 */
async function searchLinkedInForDecisionMaker(
    businessName: string,
    location: string,
    serperApiKey: string,
    log: string[],
    preferredTitles: string[]
): Promise<{ name: string; title: string } | null> {
    const DECISION_MAKER_TITLES = [
        ...preferredTitles,
        'owner', 'CEO', 'president', 'founder', 'managing director',
        'office manager', 'facilities manager', 'operations manager',
        'general manager', 'administrator', 'practice manager',
        'director of operations', 'principal',
    ];

    const dedupedTitles = [...new Set(DECISION_MAKER_TITLES)];
    const titleQuery = dedupedTitles.slice(0, 8).map(t => `"${t}"`).join(' OR ');
    const query = `site:linkedin.com/in "${businessName}" "${location}" (${titleQuery})`;
    log.push(`Layer 2.5: LinkedIn search for decision-maker at "${businessName}"...`);

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': serperApiKey.trim(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: query, num: 3 }),
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            log.push(`LinkedIn search failed: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json() as any;
        const organic = data.organic || [];

        for (const result of organic) {
            const link: string = result.link || '';
            const title: string = result.title || '';

            // Only process actual LinkedIn profile pages
            if (!link.includes('linkedin.com/in/')) continue;

            // LinkedIn titles are typically: "Name - Title - Company | LinkedIn"
            // or "Name – Title – Company | LinkedIn"
            const parts = title.split(/\s[-–|]\s/);
            if (parts.length >= 2) {
                const candidateName = parts[0].trim();
                const candidateTitle = parts[1].trim();

                // Validate: must look like a real name (2+ words, not a company name)
                const nameWords = candidateName.split(/\s+/);
                if (nameWords.length >= 2 && nameWords.length <= 4 && candidateName.length < 40) {
                    // Check that title matches one of our decision-maker roles
                    const titleLower = candidateTitle.toLowerCase();
                    const isDecisionMaker = dedupedTitles.some(t => titleLower.includes(t));
                    if (isDecisionMaker) {
                        return { name: candidateName, title: candidateTitle };
                    }
                }
            }
        }

        log.push('LinkedIn search: No matching decision-maker found');
        return null;
    } catch (error: any) {
        log.push(`LinkedIn search error: ${error.message}`);
        return null;
    }
}
