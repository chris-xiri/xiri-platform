/**
 * Enrichment Provider Abstraction
 * 
 * Multi-provider waterfall for email enrichment.
 * Each provider is tried in order; if one is out of credits or fails,
 * we fall through to the next. This keeps costs near-zero by using
 * free tiers across multiple services.
 * 
 * Currently supported:
 *   1. Email Pattern Guesser — Free, generates common patterns + MX validation
 *   2. Hunter.io  — 50 free credits/month (Domain Search) [optional]
 */

import { guessEmails } from './emailPatternGuesser';

interface EnrichedEmail {
    email: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    confidence?: number;        // 0-100
    type: 'personal' | 'generic';
    provider: string;
}

interface ProviderResult {
    emails: EnrichedEmail[];
    creditsUsed: number;
    creditsRemaining?: number;
    error?: string;
}

interface EnrichmentProvider {
    name: string;
    findEmailsByDomain(domain: string): Promise<ProviderResult>;
}

// ═══════════════════════════════════════════════════════
// HUNTER.IO PROVIDER
// ═══════════════════════════════════════════════════════

class HunterProvider implements EnrichmentProvider {
    name = 'hunter';
    private apiKey: string;
    private exhausted = false;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async findEmailsByDomain(domain: string): Promise<ProviderResult> {
        if (this.exhausted) {
            return { emails: [], creditsUsed: 0, error: 'credits_exhausted' };
        }

        try {
            // Domain Search — 1 credit per email found, 0 if none found
            const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${this.apiKey}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                if (response.status === 429 || response.status === 402) {
                    this.exhausted = true;
                    return { emails: [], creditsUsed: 0, error: 'credits_exhausted' };
                }
                return { emails: [], creditsUsed: 0, error: `HTTP ${response.status}: ${errorBody}` };
            }

            const data = await response.json() as any;
            const hunterEmails = data.data?.emails || [];
            const meta = data.meta || {};

            const emails: EnrichedEmail[] = hunterEmails.map((e: any) => ({
                email: e.value?.toLowerCase(),
                firstName: e.first_name || undefined,
                lastName: e.last_name || undefined,
                position: e.position || undefined,
                confidence: e.confidence || 0,
                type: e.type === 'personal' ? 'personal' as const : 'generic' as const,
                provider: 'hunter',
            }));

            // Sort: personal first, then by confidence descending
            emails.sort((a, b) => {
                if (a.type === 'personal' && b.type !== 'personal') return -1;
                if (a.type !== 'personal' && b.type === 'personal') return 1;
                return (b.confidence || 0) - (a.confidence || 0);
            });

            return {
                emails,
                creditsUsed: hunterEmails.length,
                creditsRemaining: meta.available !== undefined
                    ? meta.available - meta.used
                    : undefined,
            };
        } catch (error: any) {
            console.error(`[Hunter] Error searching ${domain}:`, error.message);
            return { emails: [], creditsUsed: 0, error: error.message };
        }
    }
}

// ═══════════════════════════════════════════════════════
// WATERFALL ORCHESTRATOR
// ═══════════════════════════════════════════════════════

export interface WaterfallResult {
    email?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    confidence?: number;
    type: 'personal' | 'generic' | 'none';
    provider: string;
    allEmails: EnrichedEmail[];
    log: string[];
}

/**
 * Run the enrichment provider waterfall.
 * 
 * Order:
 *   1. Pattern Guesser (free) — generates candidates from contact name + domain
 *   2. Hunter.io (optional) — paid API, only if API key is configured
 * 
 * Stops when a personal email is found.
 * Falls through to next provider if credits exhausted or no results.
 */
export async function runEnrichmentWaterfall(
    domain: string,
    secrets: {
        hunterApiKey?: string;
    },
    context?: {
        contactName?: string;
        knownGenericEmail?: string;
        preferredTitles?: string[];
        avoidTitles?: string[];
    }
): Promise<WaterfallResult> {
    const log: string[] = [];
    const allEmails: EnrichedEmail[] = [];
    const preferredTitles = (context?.preferredTitles || []).map(t => t.toLowerCase());
    const avoidTitles = (context?.avoidTitles || []).map(t => t.toLowerCase());

    // ── Step 1: Pattern Guesser (always runs, free) ──
    try {
        log.push(`[PatternGuesser] Trying pattern guesses for ${domain}...`);
        const guessResult = await guessEmails(
            domain,
            context?.contactName,
            context?.knownGenericEmail,
        );
        log.push(...guessResult.log);

        if (!guessResult.mxValid) {
            log.push(`[PatternGuesser] Domain has no MX — skipping all providers`);
            // If domain has no MX, Hunter won't find anything either
            return { type: 'none', provider: 'none', allEmails: [], log };
        }

        if (guessResult.emails.length > 0) {
            // Convert guessed emails to EnrichedEmail format
            const guessedEnriched: EnrichedEmail[] = guessResult.emails.map(e => ({
                email: e.email,
                confidence: e.confidence,
                type: e.type,
                provider: 'pattern_guess',
            }));

            allEmails.push(...guessedEnriched);

            // Check for personal email guess
            const bestPersonal = guessResult.emails.find(e => e.type === 'personal');
            if (bestPersonal) {
                // Parse first/last name from contact name for the result
                const nameParts = context?.contactName?.split(/\s+/) || [];
                log.push(`[PatternGuesser] Best personal guess: ${bestPersonal.email} (${bestPersonal.pattern}, confidence: ${bestPersonal.confidence})`);

                // Don't return yet — if we have Hunter, let it verify/find real emails
                // But if no Hunter, this is our best bet
                if (!secrets.hunterApiKey) {
                    return {
                        email: bestPersonal.email,
                        firstName: nameParts[0],
                        lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
                        confidence: bestPersonal.confidence,
                        type: 'personal',
                        provider: 'pattern_guess',
                        allEmails,
                        log,
                    };
                }
            }

            // If only generic guesses and no Hunter, return best generic
            if (!secrets.hunterApiKey) {
                const bestGeneric = guessResult.emails.find(e => e.type === 'generic');
                if (bestGeneric) {
                    log.push(`[PatternGuesser] Best generic guess: ${bestGeneric.email} (confidence: ${bestGeneric.confidence})`);
                    return {
                        email: bestGeneric.email,
                        confidence: bestGeneric.confidence,
                        type: 'generic',
                        provider: 'pattern_guess',
                        allEmails,
                        log,
                    };
                }
            }
        }
    } catch (error: any) {
        log.push(`[PatternGuesser] Error: ${error.message}`);
    }

    // ── Step 2: Hunter.io (optional, paid) ──
    const providers: EnrichmentProvider[] = [];
    if (secrets.hunterApiKey) {
        providers.push(new HunterProvider(secrets.hunterApiKey));
    }

    for (const provider of providers) {
        log.push(`Trying ${provider.name} for ${domain}...`);

        const result = await provider.findEmailsByDomain(domain);

        if (result.error === 'credits_exhausted') {
            log.push(`${provider.name}: credits exhausted, skipping`);
            continue;
        }

        if (result.error) {
            log.push(`${provider.name}: error — ${result.error}`);
            continue;
        }

        if (result.emails.length === 0) {
            log.push(`${provider.name}: no emails found`);
            continue;
        }

        const rankedEmails = [...result.emails].sort((a, b) => {
            return scoreEnrichedEmail(b, preferredTitles, avoidTitles) - scoreEnrichedEmail(a, preferredTitles, avoidTitles);
        });

        allEmails.push(...rankedEmails);

        // Check for personal email — if found, we're done
        const personalEmail = rankedEmails.find(e => e.type === 'personal');
        if (personalEmail) {
            log.push(`${provider.name}: found personal email — ${personalEmail.email} (${personalEmail.position || 'unknown role'})`);
            return {
                email: personalEmail.email,
                firstName: personalEmail.firstName,
                lastName: personalEmail.lastName,
                position: personalEmail.position,
                confidence: personalEmail.confidence,
                type: 'personal',
                provider: provider.name,
                allEmails,
                log,
            };
        }

        // Only generic found — note it but keep trying
        log.push(`${provider.name}: found ${result.emails.length} emails (generic only)`);
    }

    // No personal email found across all providers — return best available
    // Prefer Hunter results over pattern guesses for generic emails
    const bestHunterGeneric = allEmails.find(e => e.provider === 'hunter');
    const bestGuessPersonal = allEmails.find(e => e.provider === 'pattern_guess' && e.type === 'personal');
    const bestGuessGeneric = allEmails.find(e => e.provider === 'pattern_guess' && e.type === 'generic');

    // If we have a pattern-guessed personal email and no Hunter found anything better, use the guess
    if (bestGuessPersonal) {
        const nameParts = context?.contactName?.split(/\s+/) || [];
        return {
            email: bestGuessPersonal.email,
            firstName: nameParts[0],
            lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
            confidence: bestGuessPersonal.confidence,
            type: 'personal',
            provider: 'pattern_guess',
            allEmails,
            log,
        };
    }

    const bestGeneric = bestHunterGeneric || bestGuessGeneric || allEmails[0];
    if (bestGeneric) {
        return {
            email: bestGeneric.email,
            type: 'generic',
            provider: bestGeneric.provider,
            allEmails,
            log,
        };
    }

    log.push('All enrichment providers exhausted — no emails found');
    return { type: 'none', provider: 'none', allEmails: [], log };
}

function scoreEnrichedEmail(email: EnrichedEmail, preferredTitles: string[], avoidTitles: string[]): number {
    let score = email.type === 'personal' ? 100 : 10;
    score += email.confidence || 0;

    const position = email.position?.toLowerCase() || '';
    if (position && preferredTitles.length > 0) {
        const matchIndex = preferredTitles.findIndex(title => position.includes(title));
        if (matchIndex >= 0) {
            score += 120 - (matchIndex * 10);
        }
    }

    if (position && avoidTitles.some(title => position.includes(title))) score -= 120;
    if (position.includes('owner') || position.includes('founder')) score += preferredTitles.length === 0 ? 25 : 5;
    if (position.includes('manager')) score += 20;
    if (position.includes('facilit')) score += 25;
    if (position.includes('operation')) score += 25;
    if (position.includes('admin')) score += 15;
    if (position.includes('director')) score += 15;
    if (position.includes('assistant')) score -= 20;
    if (position.includes('intern')) score -= 40;

    return score;
}
