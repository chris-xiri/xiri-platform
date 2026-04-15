/**
 * Vendor Prospector Agent — Multi-Trade Contractor Discovery & Enrichment
 *
 * Discovers potential subcontractors across all canonical service capabilities
 * (janitorial, plumbing, HVAC, roofing, landscaping, etc.) and enriches each
 * with contact info using the same multi-layer waterfall as the lead prospector.
 *
 * Key differences from the lead prospector:
 *   - Search queries derived from VENDOR_CAPABILITIES (not facility types)
 *   - Layer 0.5: Facebook-specific discovery (many trades lack websites)
 *   - Outputs to `vendor_prospect_queue` (not `prospect_queue`)
 *   - Stores detected capabilities normalized to canonical values
 *
 * Waterfall:
 *   Layer 0:   Discovery via Serper Places
 *   Layer 0.5: Facebook page discovery via Serper (site:facebook.com)
 *   Layer 1:   Website scraping (when site exists)
 *   Layer 2:   Serper web search (Facebook, directories, Instagram)
 *   Layer 3:   Enrichment waterfall (email pattern guesser + optional Hunter.io)
 */

import { searchVendors, RawVendor } from './sourcer';
import { scrapeWebsite, searchWebForEmail } from '../utils/websiteScraper';
import { runEnrichmentWaterfall } from '../utils/enrichmentProviders';
import { enrichFromFacebook } from '../utils/facebookEnricher';
import type { EnrichedProspect, EmailSource, ProspectContact } from '@xiri/shared';

// ── Reuse validation logic from lead prospector ──────────────────────

const GENERIC_PREFIXES = /^(info|contact|hello|office|admin|sales|team|service|services|marketing|support|billing|accounting|bookkeeping|inquiries|front|manager)@/i;

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

const FREE_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'msn.com', 'live.com',
    'verizon.net', 'comcast.net', 'att.net', 'sbcglobal.net',
    'optonline.net', 'optimum.net', 'cox.net', 'charter.net',
    'earthlink.net', 'juno.com', 'protonmail.com', 'proton.me',
    'zoho.com', 'yandex.com', 'mail.com', 'inbox.com',
    'atlanticbbn.net',
]);

// ── Query generation from capabilities ──────────────────────────────

/**
 * Suffixes appended to capability labels to form search queries.
 * Grouped by capability group for more natural results.
 */
const QUERY_SUFFIXES: Record<string, string[]> = {
    cleaning:  ['company', 'service', 'contractor'],
    facility:  ['contractor', 'company', 'service'],
    specialty: ['contractor', 'company', 'specialist'],
};

/**
 * Generate search queries from a capability label and its group.
 * e.g. ("Plumbing", "facility") → ["plumbing contractor", "plumbing company", "plumbing service"]
 */
export function generateQueriesForCapability(
    capabilityLabel: string,
    group: string
): string[] {
    const suffixes = QUERY_SUFFIXES[group] || QUERY_SUFFIXES.facility;
    const base = capabilityLabel.toLowerCase();
    return suffixes.map(suffix => `${base} ${suffix}`);
}

// ── Email validation (identical to lead prospector) ─────────────────

function stripDomainNoise(root: string): string {
    return root
        .replace(/[-_]/g, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, '');
}

function validateEmailForBusiness(
    email: string,
    businessWebsite?: string | null
): 'domain_match' | 'free_provider' | 'junk' | 'mismatch' {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) return 'junk';
    if (JUNK_EMAIL_DOMAINS.has(emailDomain)) return 'junk';
    if (FREE_EMAIL_PROVIDERS.has(emailDomain)) return 'free_provider';

    if (businessWebsite) {
        const bizDomain = extractDomain(businessWebsite);
        if (bizDomain) {
            if (emailDomain === bizDomain || emailDomain.endsWith('.' + bizDomain)) {
                return 'domain_match';
            }
            const bizRoot = bizDomain.split('.')[0].replace(/[-_]/g, '');
            const emailRoot = emailDomain.split('.')[0].replace(/[-_]/g, '');
            if (bizRoot.length > 2 && emailRoot.length > 2 &&
                (bizRoot.includes(emailRoot) || emailRoot.includes(bizRoot))) {
                return 'domain_match';
            }
            const bizStripped = stripDomainNoise(bizRoot);
            const emailStripped = stripDomainNoise(emailRoot);
            if (bizStripped.length > 2 && emailStripped.length > 2 &&
                (bizStripped.includes(emailStripped) || emailStripped.includes(bizStripped))) {
                return 'domain_match';
            }
            const bizBase = bizDomain.split('.').slice(0, -1).join('.');
            const emailBase = emailDomain.split('.').slice(0, -1).join('.');
            if (bizBase === emailBase) {
                return 'domain_match';
            }
            return 'mismatch';
        }
    }
    return 'free_provider';
}

// ── Types ───────────────────────────────────────────────────────────

export interface VendorProspectorInput {
    query: string;
    location: string;
    capability: string;       // Canonical capability value (e.g. 'plumbing')
    maxResults?: number;
    skipPaidApis?: boolean;
}

interface VendorProspectorOutput {
    prospects: EnrichedProspect[];
    stats: {
        discovered: number;
        withPersonalEmail: number;
        withGenericEmail: number;
        noEmail: number;
        skippedNoWebsite: number;
    };
}

// ── Main pipeline ───────────────────────────────────────────────────

/**
 * Run the full vendor prospecting pipeline.
 * Identical architecture to prospectAndEnrich() but parameterized for vendor discovery.
 */
export async function vendorProspectAndEnrich(
    input: VendorProspectorInput,
    secrets: {
        geminiApiKey: string;
        serperApiKey: string;
        hunterApiKey?: string;
    }
): Promise<VendorProspectorOutput> {
    const maxResults = input.maxResults || 20;

    // ═══════════════════════════════════════════════════════
    // LAYER 0: Discovery via Serper Places
    // ═══════════════════════════════════════════════════════
    console.log(`[VendorProspector] Discovering: "${input.query}" in "${input.location}" (capability: ${input.capability})...`);
    const rawVendors = await searchVendors(input.query, input.location, 'google_maps');
    console.log(`[VendorProspector] Discovered ${rawVendors.length} businesses via Google Maps.`);

    // ═══════════════════════════════════════════════════════
    // LAYER 0.5: Facebook-specific discovery (for no-website trades)
    // Searches site:facebook.com to find businesses that only have a Facebook page
    // ═══════════════════════════════════════════════════════
    let facebookDiscoveries: RawVendor[] = [];
    try {
        const fbQuery = `${input.query} ${input.location} site:facebook.com`;
        console.log(`[VendorProspector] Layer 0.5: Facebook search: "${fbQuery}"`);

        const fbResponse = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': secrets.serperApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: fbQuery, num: 10 }),
        });

        if (fbResponse.ok) {
            const fbData = await fbResponse.json();
            const fbResults = fbData.organic || [];

            // Convert Serper organic results to RawVendor format
            for (const r of fbResults) {
                const url = r.link as string;
                if (!url?.includes('facebook.com/')) continue;

                // Skip if it's a search, post, or group page
                if (url.includes('/posts/') || url.includes('/search/') ||
                    url.includes('/groups/') || url.includes('/marketplace/')) continue;

                // Extract business name from title (Facebook pages: "Business Name - Facebook")
                const title = (r.title || '').replace(/\s*[-–|]\s*(Facebook|Meta).*$/i, '').trim();
                if (!title) continue;

                // Check if this business was already found via Google Maps
                const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const alreadyFound = rawVendors.some(v => {
                    const normalizedName = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return normalizedName === normalizedTitle ||
                        normalizedName.includes(normalizedTitle) ||
                        normalizedTitle.includes(normalizedName);
                });

                if (alreadyFound) continue;

                facebookDiscoveries.push({
                    name: title,
                    description: r.snippet || '',
                    location: input.location,
                    phone: undefined,
                    website: url,  // Use Facebook URL as the "website" for scraping
                    source: 'facebook',
                    rating: undefined,
                    user_ratings_total: undefined,
                });
            }

            console.log(`[VendorProspector] Layer 0.5: Found ${facebookDiscoveries.length} additional businesses via Facebook.`);
        }
    } catch (error: any) {
        console.warn(`[VendorProspector] Layer 0.5 error: ${error.message}`);
    }

    // Merge discoveries: Google Maps first, then Facebook-only businesses
    const allVendors = [...rawVendors, ...facebookDiscoveries];

    const prospects: EnrichedProspect[] = [];
    const stats = {
        discovered: allVendors.length,
        withPersonalEmail: 0,
        withGenericEmail: 0,
        noEmail: 0,
        skippedNoWebsite: 0,
    };

    const toProcess = allVendors.slice(0, maxResults);

    // Pipeline-level time guard — stop at 7 min to leave 2 min for cleanup
    const PIPELINE_TIME_BUDGET_MS = 7 * 60 * 1000;
    const PER_BUSINESS_TIMEOUT_MS = 30_000;
    const pipelineStart = Date.now();

    for (const vendor of toProcess) {
        const elapsed = Date.now() - pipelineStart;
        if (elapsed > PIPELINE_TIME_BUDGET_MS) {
            console.log(`[VendorProspector] ⏱️ Time budget exhausted (${Math.round(elapsed / 1000)}s). Processed ${prospects.length}/${toProcess.length}.`);
            break;
        }

        let prospect: EnrichedProspect;
        try {
            prospect = await Promise.race([
                enrichSingleVendor(vendor, secrets, input),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Enrichment timed out after ${PER_BUSINESS_TIMEOUT_MS / 1000}s`)), PER_BUSINESS_TIMEOUT_MS)
                ),
            ]);
        } catch (error: any) {
            console.warn(`[VendorProspector] ⚠️ Skipping "${vendor.name}": ${error.message}`);
            prospect = {
                businessName: vendor.name,
                address: vendor.location,
                phone: vendor.phone,
                website: vendor.website,
                rating: vendor.rating,
                userRatingsTotal: vendor.user_ratings_total,
                emailSource: 'none' as EmailSource,
                emailConfidence: 'low' as const,
                enrichmentLog: [`Skipped: ${error.message}`],
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

    // Sort: personal emails first, then generic, then none
    prospects.sort((a, b) => {
        const scoreA = a.contactEmail ? 2 : a.genericEmail ? 1 : 0;
        const scoreB = b.contactEmail ? 2 : b.genericEmail ? 1 : 0;
        return scoreB - scoreA;
    });

    console.log(`[VendorProspector] Done. Results: ${stats.withPersonalEmail} personal, ${stats.withGenericEmail} generic, ${stats.noEmail} none.`);
    return { prospects, stats };
}

// ── Single vendor enrichment (mirrors enrichSingleBusiness) ─────────

async function enrichSingleVendor(
    vendor: RawVendor,
    secrets: {
        geminiApiKey: string;
        serperApiKey: string;
        hunterApiKey?: string;
    },
    input: VendorProspectorInput
): Promise<EnrichedProspect> {
    const log: string[] = [];
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

    log.push(`Starting enrichment for "${vendor.name}" (capability: ${input.capability})`);

    // Check if the "website" is actually a Facebook URL (from Layer 0.5 discovery)
    const isFacebookUrl = vendor.website?.includes('facebook.com/');

    if (!vendor.website || isFacebookUrl) {
        if (isFacebookUrl) {
            prospect.facebookUrl = vendor.website;
            prospect.website = undefined; // Don't treat Facebook as a website
            log.push(`Facebook-only business — URL: ${vendor.website}`);

            // ═══════════════════════════════════════════════════════
            // LAYER 0.5b: Deep Facebook page enrichment
            // Scrape the public FB page HTML + Gemini AI extraction.
            // No Graph API needed — works on public page shell.
            // ═══════════════════════════════════════════════════════
            log.push(`Layer 0.5b: Deep Facebook enrichment for ${vendor.website}`);
            try {
                const fbResult = await enrichFromFacebook(vendor.website!, secrets.geminiApiKey);

                if (fbResult.success && fbResult.data) {
                    const fb = fbResult.data;

                    // Merge contact data — FB data fills gaps
                    if (fb.phone && !prospect.phone) {
                        prospect.phone = fb.phone;
                        log.push(`📱 Phone from Facebook: ${fb.phone}`);
                    }
                    if (fb.email) {
                        const isPersonal = !GENERIC_PREFIXES.test(fb.email);
                        if (isPersonal && !prospect.contactEmail) {
                            prospect.contactEmail = fb.email;
                            prospect.emailSource = 'facebook_scrape' as EmailSource;
                            prospect.emailConfidence = 'medium';
                            log.push(`📧 Personal email from Facebook: ${fb.email}`);
                        } else if (!isPersonal && !prospect.genericEmail) {
                            prospect.genericEmail = fb.email;
                            log.push(`📧 Generic email from Facebook: ${fb.email}`);
                        }
                    }
                    if (fb.address && !prospect.address) {
                        prospect.address = fb.address;
                        log.push(`📍 Address from Facebook: ${fb.address}`);
                    }
                    if (fb.ownerName) {
                        prospect.contactName = fb.ownerName;
                        prospect.contactTitle = fb.ownerTitle;
                        log.push(`👤 Owner from Facebook: ${fb.ownerName} (${fb.ownerTitle || 'unknown title'})`);
                    }
                    if (fb.externalWebsite) {
                        prospect.website = fb.externalWebsite;
                        log.push(`🌐 External website from Facebook: ${fb.externalWebsite}`);
                    }

                    // Store enrichment metadata in the log
                    if (fb.category) log.push(`Category: ${fb.category}`);
                    if (fb.serviceArea) log.push(`Service area: ${fb.serviceArea}`);
                    if (fb.appearsCommercial) {
                        log.push(`✅ Appears commercial: ${(fb.commercialSignals || []).join(', ')}`);
                    }
                    if (fb.yearEstablished) log.push(`Est. ${fb.yearEstablished}`);

                    log.push(`Facebook enrichment quality: ${fb.quality}`);
                } else {
                    log.push(`Facebook enrichment failed: ${fbResult.error || 'unknown error'}`);
                }
            } catch (fbErr: any) {
                log.push(`Layer 0.5b error: ${fbErr.message}`);
            }

            // If Facebook found an external website, continue to Layer 1
            if (prospect.website) {
                log.push(`Facebook revealed external website — continuing to Layer 1...`);
                // Fall through to Layer 1 below (don't return here)
            } else {
                // No website found — try web search as last resort then return
                await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log);

                if (!prospect.contactEmail && prospect.genericEmail) {
                    prospect.contactEmail = prospect.genericEmail;
                    prospect.emailSource = 'none';
                    prospect.emailConfidence = 'low';
                    log.push(`No personal email found — using generic: ${prospect.genericEmail}`);
                }

                return prospect;
            }
        } else {
            log.push('No website available — skipping to Layer 2 (web search)');

            // Try web search even without a website
            await trySerperSearch(prospect, vendor, secrets.serperApiKey, input.location, log);

            if (!prospect.contactEmail && !input.skipPaidApis) {
                log.push('Skipping Layer 3 — no domain available for enrichment APIs');
            }

            return prospect;
        }
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 1: Website Scraping + AI Owner Extraction
    // ═══════════════════════════════════════════════════════
    log.push(`Layer 1: Scraping ${vendor.website}...`);

    try {
        const scrapeResult = await scrapeWebsite(vendor.website!, secrets.geminiApiKey);

        if (scrapeResult.success && scrapeResult.data) {
            const data = scrapeResult.data;

            if (data.ownerName) {
                prospect.contactName = data.ownerName;
                prospect.contactTitle = data.ownerTitle;
                log.push(`AI found owner: ${data.ownerName} (${data.ownerTitle || 'unknown title'})`);
            }

            if (data.socialMedia?.facebook) {
                prospect.facebookUrl = data.socialMedia.facebook;
            }
            if (data.socialMedia?.linkedin) {
                prospect.linkedinUrl = data.socialMedia.linkedin;
            }

            const bestEmail = data.ownerEmail || data.email;
            if (bestEmail && !GENERIC_PREFIXES.test(bestEmail)) {
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

                    if (data.allEmails) {
                        const generic = data.allEmails.find(e => e.type === 'generic');
                        if (generic) prospect.genericEmail = generic.email;
                    }

                    return prospect;
                }
            }

            if (bestEmail && GENERIC_PREFIXES.test(bestEmail)) {
                prospect.genericEmail = bestEmail;
                log.push(`Found generic email: ${bestEmail} — continuing search for personal...`);
            }

            if (data.allEmails) {
                const validPersonals = data.allEmails.filter(e => {
                    if (e.type !== 'personal') return false;
                    const v = validateEmailForBusiness(e.email, vendor.website);
                    if (v === 'junk') { log.push(`⚠️ Filtered junk mailto: ${e.email}`); return false; }
                    if (v === 'mismatch') { log.push(`⚠️ Filtered mismatched mailto: ${e.email}`); return false; }
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
    // LAYER 3: Enrichment Waterfall (Pattern Guesser + optional APIs)
    // ═══════════════════════════════════════════════════════
    if (!input.skipPaidApis) {
        const domain = extractDomain(vendor.website!);
        if (domain) {
            log.push(`Layer 3: Running enrichment waterfall for ${domain}...`);

            const waterfallResult = await runEnrichmentWaterfall(
                domain,
                { hunterApiKey: secrets.hunterApiKey },
                {
                    contactName: prospect.contactName,
                    knownGenericEmail: prospect.genericEmail,
                },
            );

            log.push(...waterfallResult.log);

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
                    prospect.genericEmail = prospect.genericEmail || waterfallResult.email;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FINAL: Use best available email
    // ═══════════════════════════════════════════════════════
    if (!prospect.contactEmail && prospect.genericEmail) {
        prospect.contactEmail = prospect.genericEmail;
        prospect.emailSource = 'none';
        prospect.emailConfidence = 'low';
        log.push(`No personal email found — using generic: ${prospect.genericEmail}`);
    } else if (!prospect.contactEmail) {
        log.push('No email found across all layers.');
    }

    return prospect;
}

// ── Layer 2 helper: targeted web searches via Serper ─────────────────

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
            prospect.contactName
        );

        if (searchResult.facebookUrl && !prospect.facebookUrl) {
            prospect.facebookUrl = searchResult.facebookUrl;
            log.push(`Found Facebook: ${searchResult.facebookUrl}`);
        }

        if (searchResult.email) {
            const webEmailValid = validateEmailForBusiness(searchResult.email, vendor.website);
            if (webEmailValid === 'junk') {
                log.push(`⚠️ Rejected junk email from web search: ${searchResult.email}`);
            } else if (webEmailValid === 'free_provider' && !!vendor.website) {
                log.push(`⚠️ Rejected off-domain web email: ${searchResult.email} (published off-site and not tied to ${vendor.website})`);
            } else if (webEmailValid === 'mismatch') {
                log.push(`⚠️ Web search email mismatch: ${searchResult.email} doesn't match ${vendor.website} — skipping`);
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

        if (!prospect.phone && searchResult.phone) {
            prospect.phone = searchResult.phone;
        }
    } catch (error: any) {
        log.push(`Layer 2 error: ${error.message}`);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractDomain(url: string): string | undefined {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return undefined;
    }
}
