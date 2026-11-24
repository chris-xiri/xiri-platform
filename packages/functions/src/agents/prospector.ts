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
import { scrapeWebsite, deepMailtoScan, searchWebForEmail, type DecisionMakerCandidate } from '../utils/websiteScraper';
import * as dns from 'dns';

const MAX_CONTACTS_PER_COMPANY = 3;

function splitPersonName(fullName?: string | null): { firstName?: string; lastName?: string } {
    if (!fullName) return {};
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { firstName: parts[0] };
    // Preserve "Dr." with first name if present
    if (/^dr\.?$/i.test(parts[0]) && parts.length >= 2) {
        return {
            firstName: `${parts[0]} ${parts[1]}`,
            lastName: parts.slice(2).join(' ') || undefined,
        };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

function isSharedOrLocationInbox(email: string, website?: string): boolean {
    const local = email.split('@')[0].toLowerCase().trim();
    if (GENERIC_PREFIXES.test(email)) return true;
    // Explicit personal doctor emails like "drdelia@", "dr.mao@", "drmark@" are NOT shared inboxes
    if (extractDoctorNameFromEmail(email)) return false;
    // Shared clinical/location/office inbox keywords (safe to default to Practice Manager)
    if (/(?:office|clinic|dental|dentist|ortho|smile|smiles|tooth|teeth|kids|pediatric|endo|perio|implant|care|patient|frontdesk|reception|appt|appointment|schedule|booking|desk|queens|bronx|brooklyn|manhattan|westchester|staten|deerpark|roslyn|huntington|williamsburg|dumbo|astoria|flushing|scarsdale|mineola|massapequa|smithtown|melville|syosset|greatneck|manhasset|whiteplains|yonkers|nofo|soho|tribeca|chelsea|midtown|uptown|downtown)/i.test(local)) {
        return true;
    }
    if (/^(?:ny|nj|li|bk|nyc|east|west|north|south|pia|staff)[._-]?(?:office|desk|team|admin|info)?$/i.test(local)) {
        return true;
    }
    // Matches website domain root (e.g. hiddensmilesortho@gmail.com for hiddensmiles.com)
    const domainRoot = website ? extractDomain(website)?.split('.')[0]?.replace(/[^a-z0-9]/g, '') : '';
    const normLocal = local.replace(/[^a-z0-9]/g, '');
    if (domainRoot && domainRoot.length >= 5 && (normLocal.includes(domainRoot.slice(0, 6)) || domainRoot.includes(normLocal))) {
        return true;
    }
    return false;
}

function extractDoctorNameFromEmail(email: string): string | null {
    const local = email.split('@')[0].toLowerCase().trim();
    const m = local.match(/^dr[._-]?([a-z]{3,18})$/i);
    if (!m) return null;
    const rawSurname = m[1];
    // Exclude non-surname tokens like "dental", "office", "info"
    if (/^(dental|dentist|ortho|office|info|smile|smiles|care|clinic|team|admin)$/i.test(rawSurname)) return null;
    return `Dr. ${rawSurname.charAt(0).toUpperCase()}${rawSurname.slice(1).toLowerCase()}`;
}

/**
 * Pair up to MAX_CONTACTS_PER_COMPANY (3) distinct website-scraped emails
 * with the top-ranked cleaning decision-makers (Office Manager, Practice Manager,
 * Operations/Facilities Manager, Owner/Operator, Principal Doctor).
 * STRICT RULE:
 * - Only accepts emails actually scraped from the practice website (zero guessing).
 * - NEVER assigns an unrelated person's name onto a personal/doctor email
 *   (e.g., never pair "Dr. Timothy Leung" with "drdelia@deliadentistry.com").
 */
function buildTopWebsiteContacts(
    rawEmails: Array<{ email: string; source: EmailSource }>,
    decisionMakers: DecisionMakerCandidate[],
    website: string | undefined
): ProspectContact[] {
    const seenEmails = new Set<string>();
    const rankedEmails: Array<{
        email: string;
        validation: 'domain_match' | 'free_provider';
        isGeneric: boolean;
        isShared: boolean;
        score: number;
        source: EmailSource;
    }> = [];

    for (const item of rawEmails) {
        const cleaned = item.email?.trim().toLowerCase();
        if (!cleaned || !cleaned.includes('@') || seenEmails.has(cleaned)) continue;
        const validation = validateEmailForBusiness(cleaned, website);
        if (validation !== 'domain_match' && validation !== 'free_provider') continue;
        seenEmails.add(cleaned);

        const isGeneric = GENERIC_PREFIXES.test(cleaned);
        const isShared = isSharedOrLocationInbox(cleaned, website);
        let score = validation === 'domain_match' ? 100 : 60;
        if (!isGeneric) score += 20;
        // Boost manager/office prefixes over generic info@
        if (/^(manager|officemanager|practicemanager|admin|office)@/i.test(cleaned)) score += 10;
        rankedEmails.push({ email: cleaned, validation, isGeneric, isShared, score, source: item.source });
    }

    // Track which decision-makers have been paired with an email
    const usedDmIdx = new Set<number>();
    const matchDmForEmail = (email: string): { dm?: DecisionMakerCandidate; bonus: number } => {
        const local = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');

        // 1. Exact card-scraped email match
        for (let i = 0; i < decisionMakers.length; i++) {
            if (usedDmIdx.has(i)) continue;
            if (decisionMakers[i].email?.toLowerCase() === email) {
                usedDmIdx.add(i);
                return { dm: decisionMakers[i], bonus: 40 };
            }
        }

        // 2. First/last name token match in the email local-part (e.g. "maryann@" or "drdelia@")
        for (let i = 0; i < decisionMakers.length; i++) {
            if (usedDmIdx.has(i)) continue;
            const tokens = decisionMakers[i].name
                .toLowerCase()
                .replace(/^dr\.?\s+/, '')
                .split(/\s+/)
                .map(t => t.replace(/[^a-z]/g, ''))
                .filter(t => t.length >= 3);
            if (tokens.some(t => local.includes(t))) {
                usedDmIdx.add(i);
                return { dm: decisionMakers[i], bonus: 35 };
            }
        }
        return { bonus: 0 };
    };

    const paired = rankedEmails.map(entry => {
        const match = matchDmForEmail(entry.email);
        return { ...entry, dm: match.dm, totalScore: entry.score + match.bonus };
    });

    // Sort highest-confidence / best-matched decision-maker emails first, cap at top 3
    paired.sort((a, b) => b.totalScore - a.totalScore);
    const top = paired.slice(0, MAX_CONTACTS_PER_COMPANY);

    // STRICT CONFIDENCE RULE:
    // - ONLY attach a person's name when we are CONFIDENT the email belongs to them
    //   (exact DOM-card email match, first/last name token match in the email local-part,
    //   or an explicit "dr<surname>@" mailbox like drdelia@ / dr.mao@).
    // - For ALL general/shared/location/clinic inboxes (info@, hello@, receptionist@,
    //   officename@gmail.com, queens@, etc.) OR any email where we aren't confident,
    //   default cleanly to "Practice Manager" (no person name attached -> "Hi there,").
    for (const entry of top) {
        // Never attach a person's name to a general/shared/location inbox even if a token accidentally overlapped
        if (entry.isShared || entry.isGeneric) {
            entry.dm = undefined;
            continue;
        }
        if (entry.dm) continue;

        const drFromEmail = extractDoctorNameFromEmail(entry.email);
        if (drFromEmail) {
            entry.dm = { name: drFromEmail, title: 'Practice Owner / Doctor', priority: 82 };
        }
        // Otherwise leave entry.dm = undefined -> defaults to "Practice Manager"
    }

    return top.map(entry => {
        const { firstName, lastName } = splitPersonName(entry.dm?.name);
        return {
            email: entry.email,
            firstName,
            lastName,
            position: entry.dm?.title || 'Practice Manager',
            type: (entry.isGeneric || entry.isShared || !entry.dm) ? 'generic' : 'personal',
            confidence: entry.validation === 'domain_match' ? 95 : 80,
            provider: 'website_scrape',
        };
    });
}

const mxCache = new Map<string, boolean>();

/**
 * Validate that a scraped email's domain has live MX records (can actually receive mail).
 * Cached in-memory per domain; uses 0 external API credits.
 */
async function verifyEmailMx(email: string): Promise<boolean> {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain || !domain.includes('.')) return false;
    if (mxCache.has(domain)) return mxCache.get(domain)!;
    try {
        const records = await Promise.race([
            dns.promises.resolveMx(domain),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MX timeout')), 3000)),
        ]);
        const valid = Array.isArray(records) && records.length > 0;
        mxCache.set(domain, valid);
        return valid;
    } catch {
        mxCache.set(domain, false);
        return false;
    }
}
import { classifyFacilityType, isKnownDsoChain } from '../utils/facilityClassifier';
import { generateOutreachDraft } from '../utils/promptUtils';
import type { EnrichedProspect, EmailSource, ProspectContact } from '@xiri/shared';
import { inferFacilityType, type FacilityType } from '@xiri/shared';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveGeminiModel } from '../utils/gemini';

const GENERIC_PREFIXES = /^(info|contact|hello|office|admin|sales|team|service|services|marketing|support|billing|accounting|bookkeeping|inquiries|front|frontdesk|reception|receptionist|appointments|appt|scheduling|manager|staff|patients?|care|smiles?|dental|ortho)@/i;

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
            model: resolveGeminiModel('gemini-2.5-flash'),
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
    const PER_BUSINESS_TIMEOUT_MS = 20_000; // 20s per business for scrape + Gemini profiler + copywriter
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

    if (isKnownDsoChain(vendor.name, vendor.website)) {
        prospect.dossier = {
            isDsoChain: true,
            icpScore: 0,
            qualificationReason: `Pre-filtered corporate DSO chain or non-ICP entity (${vendor.name})`,
        };
        log.push(`Skipped: Known corporate DSO chain (${vendor.name}) — pre-filtered before scraping`);
        return prospect;
    }

    if (!vendor.website) {
        log.push('Skipped: No website listed on Google Places — website-only mode uses 0 extra Serper credits and never guesses emails');
        return prospect;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 1: Website Scraping + AI Owner Extraction
    // ═══════════════════════════════════════════════════════
    log.push(`Layer 1: Scraping ${vendor.website}...`);

    const rawWebsiteEmails: Array<{ email: string; source: EmailSource }> = [];
    let scrapedDecisionMakers: DecisionMakerCandidate[] = [];

    try {
        prospect.facilityType = await classifyFacilityType(vendor.website, vendor.name, input.query, secrets.geminiApiKey, log);
        targetTitles = getDecisionMakerTitles(prospect.facilityType, input.query);

        const scrapeResult = await scrapeWebsite(vendor.website, secrets.geminiApiKey, {
            businessName: vendor.name,
            address: vendor.location,
            website: vendor.website,
        });

        if (scrapeResult.success && scrapeResult.data) {
            const data = scrapeResult.data;
            if (data.dossier) {
                prospect.dossier = data.dossier;
                log.push(`SDR Profiler Dossier: clinicType=${data.dossier.clinicType || 'unknown'}, icpScore=${data.dossier.icpScore ?? 'n/a'}, ops=${data.dossier.estimatedOperatories ?? '?'}, isDso=${!!data.dossier.isDsoChain}`);
                if (data.dossier.isDsoChain) {
                    log.push(`Disqualified by SDR Profiler: Corporate DSO (${data.dossier.dsoName || vendor.name})`);
                    return prospect;
                }
            }
            const multiLocation = looksLikeMultiLocationBrand(vendor.name, vendor.website, data.organizationScope);
            if (multiLocation) {
                avoidTitles = CORPORATE_ONLY_TITLES;
                targetTitles = getBranchAwareDecisionMakerTitles(prospect.facilityType, input.query, true);
                log.push('Detected multi-location/branch business — prioritizing local branch operators over founders/corporate leadership');
            }

            // Capture ranked top 2-3 decision-makers (Office Manager -> Practice Manager -> Owner/Operator)
            if (data.decisionMakers && data.decisionMakers.length > 0) {
                scrapedDecisionMakers = data.decisionMakers.filter(dm => !(multiLocation && hasCorporateOnlyTitle(dm.title)));
                log.push(`Website decision-makers found (${scrapedDecisionMakers.length}): ${scrapedDecisionMakers.map(d => `${d.name} (${d.title})`).join(', ')}`);
                for (const dm of scrapedDecisionMakers) {
                    if (dm.email) rawWebsiteEmails.push({ email: dm.email, source: 'mailto' });
                }
            }

            // Capture primary owner/manager info
            if (data.ownerName) {
                if (multiLocation && hasCorporateOnlyTitle(data.ownerTitle)) {
                    log.push(`AI found corporate contact ${data.ownerName} (${data.ownerTitle || 'unknown title'}) — continuing search for local branch lead`);
                } else {
                    prospect.contactName = data.ownerName;
                    prospect.contactTitle = data.ownerTitle;
                    log.push(`Primary decision-maker: ${data.ownerName} (${data.ownerTitle || 'unknown title'})`);
                }
            }

            // Capture social links
            if (data.socialMedia?.facebook) {
                prospect.facebookUrl = data.socialMedia.facebook;
            }
            if (data.socialMedia?.linkedin) {
                prospect.linkedinUrl = data.socialMedia.linkedin;
            }

            // Collect ALL real website-scraped emails so we can build up to top 3 verified contacts
            if (data.ownerEmail) rawWebsiteEmails.push({ email: data.ownerEmail, source: 'ai_extraction' });
            if (data.email) rawWebsiteEmails.push({ email: data.email, source: data.source === 'structured_data' ? 'structured_data' : 'mailto' });
            if (data.allEmails) {
                for (const e of data.allEmails) {
                    if (e.email) rawWebsiteEmails.push({ email: e.email, source: 'mailto' });
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
    // LAYER 1b: Deep Website Mailto Scan (0 Serper credits, zero guessing)
    // Crawl up to 5 additional internal pages if Layer 1 found no valid email yet.
    // ═══════════════════════════════════════════════════════
    let topContacts = buildTopWebsiteContacts(rawWebsiteEmails, scrapedDecisionMakers, vendor.website);
    if (topContacts.length === 0 && vendor.website) {
        try {
            const deepScan = await deepMailtoScan(vendor.website);
            if (deepScan.email) {
                rawWebsiteEmails.push({ email: deepScan.email, source: 'mailto' });
                topContacts = buildTopWebsiteContacts(rawWebsiteEmails, scrapedDecisionMakers, vendor.website);
                log.push(`Deep mailto scan (${deepScan.pagesScanned} pages): Found ${deepScan.email}`);
            }
            if (!prospect.phone && deepScan.phone) {
                prospect.phone = deepScan.phone;
            }
        } catch (deepErr: any) {
            log.push(`Deep mailto scan error: ${deepErr?.message || deepErr}`);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FINAL: Populate Top 1–3 Website-Scraped Contacts (ZERO Guessing)
    // ═══════════════════════════════════════════════════════
    if (topContacts.length > 0) {
        prospect.allContacts = topContacts;
        const primary = topContacts[0];
        prospect.contactEmail = primary.email;
        prospect.emailSource = 'mailto';
        prospect.emailConfidence = (primary.confidence || 0) >= 90 ? 'high' : 'medium';
        const fullPrimaryName = [primary.firstName, primary.lastName].filter(Boolean).join(' ').trim();
        // Only keep a named contact if the primary email confidently matched that person;
        // otherwise clear contactName so general/unconfident inboxes default to "Practice Manager".
        prospect.contactName = fullPrimaryName || undefined;
        prospect.contactTitle = primary.position || 'Practice Manager';
        const genericMatch = topContacts.find(c => c.type === 'generic');
        if (genericMatch) prospect.genericEmail = genericMatch.email;
        log.push(`Selected top ${topContacts.length} website-scraped contact(s): ${topContacts.map(c => `${[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Practice Manager'} <${c.email}>`).join(', ')}`);
    } else {
        log.push('No email published on practice website (zero guessing / zero extra Serper credits).');
    }

    return await finalizeProspect(prospect, secrets.geminiApiKey, input.location, log);
}

function inferPreferredDecisionMakerTitles(searchQuery?: string): string[] {
    return getDecisionMakerTitles(undefined, searchQuery);
}

async function finalizeProspect(
    prospect: EnrichedProspect,
    geminiApiKey: string | undefined,
    location: string,
    log: string[]
): Promise<EnrichedProspect> {
    // ── Mandatory DNS MX validation on EVERY website-scraped email (top 1–3 contacts) ──
    if (prospect.allContacts && prospect.allContacts.length > 0) {
        const verifiedContacts: ProspectContact[] = [];
        for (const c of prospect.allContacts) {
            const mxValid = await verifyEmailMx(c.email);
            if (mxValid) {
                verifiedContacts.push(c);
                log.push(`✅ DNS MX verified: ${c.email}`);
            } else {
                log.push(`❌ DNS MX validation failed for ${c.email} — rejecting undeliverable email`);
            }
        }
        prospect.allContacts = verifiedContacts.slice(0, MAX_CONTACTS_PER_COMPANY);
        if (prospect.allContacts.length > 0) {
            const top = prospect.allContacts[0];
            prospect.contactEmail = top.email;
            prospect.emailConfidence = (top.confidence || 0) >= 90 ? 'high' : 'medium';
            const topName = [top.firstName, top.lastName].filter(Boolean).join(' ').trim();
            prospect.contactName = topName || undefined;
            prospect.contactTitle = top.position || 'Practice Manager';
            const gen = prospect.allContacts.find(c => c.type === 'generic');
            prospect.genericEmail = gen?.email;
        } else {
            prospect.contactEmail = undefined;
            prospect.genericEmail = undefined;
            prospect.emailSource = 'none';
            prospect.emailConfidence = 'low';
            return prospect;
        }
    } else {
        const primaryCandidate = prospect.contactEmail || prospect.genericEmail;
        if (primaryCandidate) {
            const mxValid = await verifyEmailMx(primaryCandidate);
            if (!mxValid) {
                log.push(`❌ DNS MX validation failed for ${primaryCandidate} — rejecting undeliverable email`);
                if (prospect.contactEmail === primaryCandidate) prospect.contactEmail = undefined;
                if (prospect.genericEmail === primaryCandidate) prospect.genericEmail = undefined;
                prospect.emailSource = 'none';
                prospect.emailConfidence = 'low';
                return prospect;
            }
            log.push(`✅ DNS MX verified for website-scraped email: ${primaryCandidate}`);
        }
    }

    if ((prospect.contactEmail || prospect.genericEmail) && !(prospect as any).outreachDraft) {
        try {
            const draft = await generateOutreachDraft({
                businessName: prospect.businessName,
                contactName: prospect.contactName,
                contactTitle: prospect.contactTitle,
                location: prospect.address || location,
                clinicType: prospect.dossier?.clinicType || prospect.facilityType,
                keyObservation: prospect.dossier?.keyObservation,
                geminiApiKey,
            });
            (prospect as any).outreachDraft = draft;
            log.push(`Generated Agent 2 outreach draft (Subject: "${draft.subject}")`);
        } catch (err: any) {
            log.push(`Draft generation notice: ${err?.message || err}`);
        }
    }
    return prospect;
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
