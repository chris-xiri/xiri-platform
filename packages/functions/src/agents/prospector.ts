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
import { GoogleGenerativeAI } from '@google/generative-ai';

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

const CORPORATE_ONLY_TITLES = [
    'founder', 'co-founder', 'ceo', 'chief executive', 'president', 'owner',
    'managing director', 'executive chairman', 'chief operating officer',
];

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
    const isFreeProvider = FREE_EMAIL_PROVIDERS.has(emailDomain);

    // If we have a business website, check domain match
    if (businessWebsite) {
        const bizDomain = extractDomain(businessWebsite);
        if (bizDomain) {
            // 1. Exact match or subdomain match
            if (emailDomain === bizDomain || emailDomain.endsWith('.' + bizDomain)) {
                return 'domain_match';
            }

            // 2. Same registrable domain (safe TLD swap / sub-brand handling)
            if (getRegistrableDomain(emailDomain) === getRegistrableDomain(bizDomain)) {
                return 'domain_match';
            }

            // 3. Free-provider addresses are only accepted as explicit low-confidence fallback
            if (isFreeProvider) return 'free_provider';

            // Email domain doesn't match website — suspicious
            return 'mismatch';
        }
    }

    // No website to compare against — allow non-junk domains but flag free providers
    return isFreeProvider ? 'free_provider' : 'domain_match';
}

async function llmAssociationGuard(params: {
    geminiApiKey?: string;
    businessName: string;
    businessWebsite?: string;
    businessAddress?: string;
    candidateEmail: string;
    candidateName?: string;
    candidateTitle?: string;
    source: string;
    evidenceTitle?: string;
    evidenceSnippet?: string;
    evidenceUrl?: string;
    deterministicValidation: 'domain_match' | 'free_provider' | 'junk' | 'mismatch';
}): Promise<{ accept: boolean; confidence: number; reason: string }> {
    if (!params.geminiApiKey) {
        return { accept: params.deterministicValidation === 'domain_match', confidence: params.deterministicValidation === 'domain_match' ? 0.9 : 0.2, reason: 'no_model_key' };
    }

    const prompt = `
You are validating whether a candidate email likely belongs to a real person working at the target business.
Return ONLY valid JSON: {"accept":boolean,"confidence":number,"reason":string}

Rules:
- Be strict. Reject if evidence is weak or ambiguous.
- Accept only if there is clear association between email/contact and target business.
- Prefer evidence from same website/domain or explicit profile mentioning the business.
- Generic/free emails are allowed only if evidence strongly ties person to business.
- Confidence is 0 to 1.

Target business:
- Name: ${params.businessName}
- Website: ${params.businessWebsite || 'unknown'}
- Address: ${params.businessAddress || 'unknown'}

Candidate:
- Email: ${params.candidateEmail}
- Name: ${params.candidateName || 'unknown'}
- Title: ${params.candidateTitle || 'unknown'}
- Source: ${params.source}
- Deterministic validation: ${params.deterministicValidation}

Search evidence:
- Title: ${params.evidenceTitle || 'none'}
- Snippet: ${params.evidenceSnippet || 'none'}
- URL: ${params.evidenceUrl || 'none'}
`.trim();

    try {
        const genAI = new GoogleGenerativeAI(params.geminiApiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { temperature: 0, maxOutputTokens: 180 },
        });
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { accept: false, confidence: 0, reason: 'non_json_response' };
        const parsed = JSON.parse(jsonMatch[0]) as { accept?: boolean; confidence?: number; reason?: string };
        return {
            accept: !!parsed.accept,
            confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0,
            reason: parsed.reason || 'no_reason',
        };
    } catch (error: any) {
        return { accept: params.deterministicValidation === 'domain_match', confidence: 0.1, reason: `guard_error:${error?.message || 'unknown'}` };
    }
}

function getDecisionMakerTitles(facilityType?: FacilityType | null, fallbackQuery?: string): string[] {
    const resolved = facilityType || inferFacilityType(fallbackQuery) || 'other';
    return FACILITY_DECISION_MAKERS[resolved] || FACILITY_DECISION_MAKERS.other;
}

function uniqStrings(values: string[]): string[] {
    return [...new Set(values.map(v => v.toLowerCase()))];
}

function hasCorporateOnlyTitle(title?: string | null): boolean {
    const lower = title?.toLowerCase() || '';
    return !!lower && CORPORATE_ONLY_TITLES.some(t => lower.includes(t));
}

function looksLikeMultiLocationBrand(
    businessName: string,
    website?: string | null,
    organizationScope?: 'single_location' | 'multi_location'
): boolean {
    if (organizationScope === 'multi_location') return true;
    if (organizationScope === 'single_location') return false;

    const name = businessName.toLowerCase();
    const domainRoot = website ? extractDomain(website)?.split('.')[0].replace(/[^a-z0-9]/g, '') : '';
    const normalizedName = name.replace(/[^a-z0-9]/g, '');

    const franchiseBrandCues = [
        'orangetheory', 'planet fitness', 'anytime fitness', 'crunch',
        'burn boot camp', 'mathnasium', 'kumon', 'sylvan', 'the learning experience',
    ];

    if (franchiseBrandCues.some(cue => name.includes(cue) || domainRoot?.includes(cue.replace(/[^a-z0-9]/g, '')))) {
        return true;
    }

    return !!domainRoot && !normalizedName.includes(domainRoot) &&
        /(fitness|studio|club|academy|school|clinic|care|center|dealership)/i.test(businessName);
}

function getBranchAwareDecisionMakerTitles(
    facilityType?: FacilityType | null,
    fallbackQuery?: string,
    multiLocation?: boolean
): string[] {
    const base = getDecisionMakerTitles(facilityType, fallbackQuery);
    if (!multiLocation) return base;

    const resolved = facilityType || inferFacilityType(fallbackQuery) || 'other';
    const localOverrides: Record<string, string[]> = {
        fitness_gym: ['studio manager', 'general manager', 'operations manager', 'regional manager'],
        retail_storefront: ['store manager', 'general manager', 'operations manager', 'district manager'],
        medical_dental: ['practice manager', 'office manager', 'clinic manager', 'administrator'],
        medical_private: ['practice manager', 'office manager', 'clinic manager', 'administrator'],
        medical_urgent_care: ['clinic manager', 'operations manager', 'administrator'],
        edu_tutoring: ['center director', 'center manager', 'operations manager'],
        edu_private_school: ['principal', 'director of operations', 'administrator'],
        auto_dealer_showroom: ['general manager', 'service manager', 'operations manager'],
        office_general: ['office manager', 'facilities manager', 'operations manager', 'site manager'],
        other: ['general manager', 'operations manager', 'office manager', 'site manager'],
    };

    return uniqStrings([
        ...(localOverrides[resolved] || localOverrides.other),
        ...base.filter(title => !hasCorporateOnlyTitle(title)),
    ]);
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
    let avoidTitles: string[] = [];
    let fallbackPersonalEmail: { email: string; source: EmailSource; reason: string } | undefined;
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
        await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log, false, targetTitles, secrets.geminiApiKey);
        if (!prospect.contactEmail) {
            await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log, true, targetTitles, secrets.geminiApiKey);
        }

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
            const multiLocation = looksLikeMultiLocationBrand(vendor.name, vendor.website, data.organizationScope);
            if (multiLocation) {
                avoidTitles = CORPORATE_ONLY_TITLES;
                targetTitles = getBranchAwareDecisionMakerTitles(prospect.facilityType, input.query, true);
                log.push('Detected multi-location/branch business — prioritizing local branch operators over founders/corporate leadership');
            }

            // Capture owner info from AI extraction
            if (data.ownerName) {
                if (multiLocation && hasCorporateOnlyTitle(data.ownerTitle)) {
                    log.push(`AI found corporate contact ${data.ownerName} (${data.ownerTitle || 'unknown title'}) — continuing search for local branch lead`);
                } else {
                    prospect.contactName = data.ownerName;
                    prospect.contactTitle = data.ownerTitle;
                    log.push(`AI found decision-maker: ${data.ownerName} (${data.ownerTitle || 'unknown title'})`);
                }
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
                } else if (emailValid === 'free_provider') {
                    fallbackPersonalEmail = fallbackPersonalEmail || {
                        email: bestEmail,
                        source: data.ownerEmail ? 'ai_extraction' : 'mailto',
                        reason: 'website_free_provider',
                    };
                    log.push(`Holding free-provider personal email as fallback: ${bestEmail} (source: ${fallbackPersonalEmail.source})`);
                } else if (emailValid === 'mismatch') {
                    log.push(`⚠️ Email domain mismatch: ${bestEmail} doesn't match website ${vendor.website} — skipping`);
                    log.push(`Skipping off-domain email from website scrape: ${bestEmail}`);
                } else if (multiLocation && hasCorporateOnlyTitle(data.ownerTitle)) {
                    log.push(`Skipping corporate-level direct email for branch business: ${bestEmail} (${data.ownerTitle || 'unknown title'})`);
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
                    if (v === 'mismatch' || v === 'free_provider') {
                        log.push(`⚠️ Filtered non-company mailto: ${e.email} (${v})`);
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

                const freeProviderMailto = data.allEmails.find(e => e.type === 'personal' && validateEmailForBusiness(e.email, vendor.website) === 'free_provider');
                if (freeProviderMailto) {
                    fallbackPersonalEmail = fallbackPersonalEmail || {
                        email: freeProviderMailto.email,
                        source: 'mailto',
                        reason: 'mailto_free_provider',
                    };
                    log.push(`Holding free-provider mailto as fallback: ${freeProviderMailto.email}`);
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
    await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log, false, targetTitles, secrets.geminiApiKey);
    if (prospect.contactEmail) return prospect;
    await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log, true, targetTitles, secrets.geminiApiKey);
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
                targetTitles,
                avoidTitles
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
                    avoidTitles,
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
            c => c.type === 'personal' &&
                c.provider === 'pattern_guess' &&
                (c.confidence || 0) >= 60 &&
                validateEmailForBusiness(c.email, vendor.website) === 'domain_match'
        );

        if (bestPatternGuess && prospect.contactName && prospect.genericEmail) {
            // Domain is proven (generic exists), contact name is known → trust the guess
            prospect.contactEmail = bestPatternGuess.email;
            prospect.emailSource = 'pattern_guess';
            prospect.emailConfidence = 'medium';
            // Keep generic as fallback for the outreach system
            log.push(`Using pattern-guessed personal email: ${bestPatternGuess.email} (confidence: ${bestPatternGuess.confidence}, fallback: ${prospect.genericEmail})`);
        } else if (fallbackPersonalEmail) {
            prospect.contactEmail = fallbackPersonalEmail.email;
            prospect.emailSource = fallbackPersonalEmail.source;
            prospect.emailConfidence = 'low';
            log.push(`No validated company-domain personal email found — using website-linked fallback: ${fallbackPersonalEmail.email} (${fallbackPersonalEmail.reason})`);
        } else if (prospect.genericEmail) {
            const genericValidation = validateEmailForBusiness(prospect.genericEmail, vendor.website);
            if (genericValidation === 'domain_match' || (!vendor.website && genericValidation !== 'junk')) {
                prospect.contactEmail = prospect.genericEmail;
                prospect.emailSource = 'none'; // It's generic
                prospect.emailConfidence = 'low';
                log.push(`No personal email found — using generic: ${prospect.genericEmail}`);
            } else {
                log.push(`Generic email rejected (validation: ${genericValidation}): ${prospect.genericEmail}`);
            }
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
    log: string[],
    deepResearch = false,
    decisionMakerTitles: string[] = [],
    geminiApiKey?: string
): Promise<void> {
    log.push(deepResearch
        ? 'Layer 2 (deep): Running title-specific web research for non-generic contacts...'
        : 'Layer 2: Searching web (Facebook, directories, person search)...');

    try {
        const domain = vendor.website ? extractDomain(vendor.website) : undefined;
        const searchResult = await searchWebForEmail(
            vendor.name,
            location,
            domain,
            serperApiKey,
            prospect.contactName, // If AI found an owner name, use it for targeted search
            { deepResearch, decisionMakerTitles }
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
                    const shouldAdjudicate = webEmailValid !== 'domain_match' || deepResearch;
                    if (shouldAdjudicate) {
                        const guard = await llmAssociationGuard({
                            geminiApiKey,
                            businessName: vendor.name,
                            businessWebsite: vendor.website || undefined,
                            businessAddress: vendor.location || undefined,
                            candidateEmail: searchResult.email,
                            candidateName: prospect.contactName,
                            candidateTitle: prospect.contactTitle,
                            source: searchResult.source,
                            evidenceTitle: searchResult.evidenceTitle,
                            evidenceSnippet: searchResult.evidenceSnippet,
                            evidenceUrl: searchResult.evidenceUrl,
                            deterministicValidation: webEmailValid,
                        });
                        if (!guard.accept || guard.confidence < 0.55) {
                            log.push(`LLM guard rejected web-search email ${searchResult.email} (confidence=${guard.confidence.toFixed(2)}, reason=${guard.reason})`);
                            return;
                        }
                        log.push(`LLM guard accepted web-search email ${searchResult.email} (confidence=${guard.confidence.toFixed(2)}, reason=${guard.reason})`);
                    }

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
    preferredTitles: string[],
    avoidTitles: string[] = []
): Promise<{ name: string; title: string } | null> {
    const DECISION_MAKER_TITLES = [
        ...preferredTitles,
        'owner', 'CEO', 'president', 'founder', 'managing director',
        'office manager', 'facilities manager', 'operations manager',
        'general manager', 'administrator', 'practice manager',
        'director of operations', 'principal',
    ];

    const dedupedTitles = [...new Set(
        DECISION_MAKER_TITLES.filter(title =>
            !avoidTitles.some(avoid => title.toLowerCase().includes(avoid))
        )
    )];
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
                    if (avoidTitles.some(title => titleLower.includes(title))) continue;
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
