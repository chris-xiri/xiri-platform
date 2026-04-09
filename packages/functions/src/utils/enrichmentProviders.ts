/**
 * Enrichment Provider Abstraction
 * 
 * Multi-provider waterfall for email enrichment.
 * Each provider is tried in order; if one is out of credits or fails,
 * we fall through to the next. This keeps costs near-zero by using
 * free tiers across multiple services.
 * 
 * Currently supported:
 *   1. Hunter.io  — 50 free credits/month (Domain Search)
 *   2. Snov.io    — 50 free credits/month (Domain Search)
 */

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

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async findEmailsByDomain(domain: string): Promise<ProviderResult> {
        try {
            // Domain Search — 1 credit per email found, 0 if none found
            const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${this.apiKey}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                if (response.status === 429 || response.status === 402) {
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
// SNOV.IO PROVIDER
// ═══════════════════════════════════════════════════════

class SnovProvider implements EnrichmentProvider {
    name = 'snov';
    private userId: string;
    private apiSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry = 0;

    constructor(userId: string, apiSecret: string) {
        this.userId = userId;
        this.apiSecret = apiSecret;
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        const response = await fetch('https://api.snov.io/v1/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: this.userId,
                client_secret: this.apiSecret,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Snov auth failed: HTTP ${response.status}`);
        }

        const data = await response.json() as any;
        this.accessToken = data.access_token;
        // Token is valid for ~1 hour, refresh at 50 min
        this.tokenExpiry = Date.now() + 50 * 60 * 1000;
        return this.accessToken!;
    }

    /** Poll a Snov v2 task until it returns status:"completed" or we give up */
    private async pollResult(url: string, token: string, maxAttempts = 5): Promise<any> {
        for (let i = 0; i < maxAttempts; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 2000));
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`Snov poll failed: HTTP ${res.status}`);
            const data = await res.json() as any;
            if (data.status === 'completed') return data;
        }
        throw new Error('Snov task timed out after polling');
    }

    async findEmailsByDomain(domain: string): Promise<ProviderResult> {
        try {
            const token = await this.getAccessToken();

            // Step 1: Start domain search (returns task_hash)
            const startRes = await fetch('https://api.snov.io/v2/domain-search/domain-emails/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ domain }),
                signal: AbortSignal.timeout(10000),
            });

            if (!startRes.ok) {
                const errorBody = await startRes.text();
                if (startRes.status === 402 || startRes.status === 429) {
                    return { emails: [], creditsUsed: 0, error: 'credits_exhausted' };
                }
                return { emails: [], creditsUsed: 0, error: `HTTP ${startRes.status}: ${errorBody}` };
            }

            const startData = await startRes.json() as any;
            const taskHash = startData?.meta?.task_hash || startData?.data?.task_hash;
            if (!taskHash) {
                // If the response contains data directly (legacy format), handle it
                const directEmails = startData?.data || startData?.emails || [];
                if (Array.isArray(directEmails) && directEmails.length > 0) {
                    return this.parseEmails(directEmails);
                }
                return { emails: [], creditsUsed: 0, error: 'No task_hash returned' };
            }

            // Step 2: Poll for results
            const resultUrl = `https://api.snov.io/v2/domain-search/domain-emails/result/${taskHash}`;
            const resultData = await this.pollResult(resultUrl, token);
            const snovEmails = resultData?.data || [];

            return this.parseEmails(snovEmails);
        } catch (error: any) {
            console.error(`[Snov] Error searching ${domain}:`, error.message);
            return { emails: [], creditsUsed: 0, error: error.message };
        }
    }

    private parseEmails(snovEmails: any[]): ProviderResult {
        const emails: EnrichedEmail[] = snovEmails
            .filter((e: any) => e.email)
            .map((e: any) => {
                const isGeneric = /^(info|contact|hello|office|admin|support|sales|team|service|services)@/i.test(e.email || '');
                return {
                    email: (e.email || '').toLowerCase(),
                    firstName: e.firstName || e.first_name || undefined,
                    lastName: e.lastName || e.last_name || undefined,
                    position: e.position || undefined,
                    confidence: e.score || 0,
                    type: isGeneric ? 'generic' as const : 'personal' as const,
                    provider: 'snov',
                };
            });

        // Sort: personal first, then by confidence descending
        emails.sort((a, b) => {
            if (a.type === 'personal' && b.type !== 'personal') return -1;
            if (a.type !== 'personal' && b.type === 'personal') return 1;
            return (b.confidence || 0) - (a.confidence || 0);
        });

        return {
            emails,
            creditsUsed: 1,  // Snov charges 1 credit per domain search
        };
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
 * Tries each provider in order, stops when a personal email is found.
 * Falls through to next provider if credits exhausted or no results.
 */
export async function runEnrichmentWaterfall(
    domain: string,
    secrets: {
        hunterApiKey?: string;
        snovUserId?: string;
        snovApiSecret?: string;
    }
): Promise<WaterfallResult> {
    const providers: EnrichmentProvider[] = [];
    const log: string[] = [];

    // Build provider list based on available credentials
    if (secrets.hunterApiKey) {
        providers.push(new HunterProvider(secrets.hunterApiKey));
    }
    if (secrets.snovUserId && secrets.snovApiSecret) {
        providers.push(new SnovProvider(secrets.snovUserId, secrets.snovApiSecret));
    }

    if (providers.length === 0) {
        log.push('No enrichment providers configured — skipping API waterfall');
        return { type: 'none', provider: 'none', allEmails: [], log };
    }

    const allEmails: EnrichedEmail[] = [];

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

        allEmails.push(...result.emails);

        // Check for personal email — if found, we're done
        const personalEmail = result.emails.find(e => e.type === 'personal');
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

    // No personal email found across all providers — return best generic
    const bestGeneric = allEmails[0];
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
