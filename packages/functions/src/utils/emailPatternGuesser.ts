/**
 * Email Pattern Guesser + MX Validation
 *
 * Replaces Hunter.io by:
 *   1. Generating common email patterns from contact name + domain
 *   2. Generating generic fallbacks (info@, office@, admin@)
 *   3. Validating the domain has working MX records (DNS only — no SMTP)
 *
 * Zero cost, zero domain risk.
 */

import { promises as dns } from 'dns';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface GuessedEmail {
    email: string;
    pattern: string;           // e.g. "firstname@" or "info@"
    type: 'personal' | 'generic';
    confidence: number;        // 0-100
}

export interface PatternGuessResult {
    emails: GuessedEmail[];
    mxValid: boolean;
    mxProvider?: string;       // e.g. "google", "microsoft", "other"
    log: string[];
}

// ═══════════════════════════════════════════════════════
// MX VALIDATION (DNS only — zero domain risk)
// ═══════════════════════════════════════════════════════

interface MxInfo {
    valid: boolean;
    provider?: 'google' | 'microsoft' | 'zoho' | 'other';
    records?: string[];
}

/**
 * Check if a domain has valid MX records.
 * This is a DNS-only check — no SMTP connections, no risk to our domain.
 */
async function checkMxRecords(domain: string): Promise<MxInfo> {
    try {
        const records = await dns.resolveMx(domain);
        if (!records || records.length === 0) {
            return { valid: false };
        }

        const exchanges = records
            .sort((a, b) => a.priority - b.priority)
            .map(r => r.exchange.toLowerCase());

        // Identify the mail provider
        let provider: MxInfo['provider'] = 'other';
        const primary = exchanges[0];

        if (primary.includes('google') || primary.includes('gmail') || primary.includes('googlemail')) {
            provider = 'google';
        } else if (primary.includes('outlook') || primary.includes('microsoft') || primary.includes('office365') || primary.includes('hotmail')) {
            provider = 'microsoft';
        } else if (primary.includes('zoho')) {
            provider = 'zoho';
        }

        return { valid: true, provider, records: exchanges };
    } catch (error: any) {
        // ENODATA / ENOTFOUND = domain doesn't have MX records
        if (error.code === 'ENODATA' || error.code === 'ENOTFOUND' || error.code === 'ESERVFAIL') {
            return { valid: false };
        }
        // DNS timeout or other transient error — be conservative, assume valid
        console.warn(`[PatternGuesser] MX lookup error for ${domain}: ${error.message}`);
        return { valid: true, provider: 'other' };
    }
}

// ═══════════════════════════════════════════════════════
// NAME PARSING
// ═══════════════════════════════════════════════════════

interface ParsedName {
    first: string;
    last: string;
    firstInitial: string;
    lastInitial: string;
}

function parseName(fullName: string): ParsedName | null {
    // Clean up the name
    const cleaned = fullName
        .replace(/\b(dr|mr|mrs|ms|prof|rev|sr|jr|ii|iii|iv)\b\.?/gi, '')
        .replace(/[^a-zA-Z\s-]/g, '')
        .trim();

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;

    const first = parts[0].toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();

    return {
        first,
        last,
        firstInitial: first[0],
        lastInitial: last[0],
    };
}

// ═══════════════════════════════════════════════════════
// PATTERN GENERATION
// ═══════════════════════════════════════════════════════

// Common small business email patterns, ordered by probability
const PERSONAL_PATTERNS: { pattern: string; build: (n: ParsedName) => string; baseConfidence: number }[] = [
    { pattern: 'firstname',          build: (n) => n.first,                              baseConfidence: 70 },
    { pattern: 'firstname.lastname', build: (n) => `${n.first}.${n.last}`,               baseConfidence: 65 },
    { pattern: 'firstnamelastname',  build: (n) => `${n.first}${n.last}`,                baseConfidence: 55 },
    { pattern: 'flastname',          build: (n) => `${n.firstInitial}${n.last}`,          baseConfidence: 50 },
    { pattern: 'firstname.l',        build: (n) => `${n.first}.${n.lastInitial}`,         baseConfidence: 45 },
    { pattern: 'firstl',             build: (n) => `${n.first}${n.lastInitial}`,          baseConfidence: 40 },
    { pattern: 'f.lastname',         build: (n) => `${n.firstInitial}.${n.last}`,         baseConfidence: 40 },
];

// Generic patterns for when we don't have a contact name
const GENERIC_PATTERNS: { pattern: string; prefix: string; baseConfidence: number }[] = [
    { pattern: 'info@',        prefix: 'info',        baseConfidence: 60 },
    { pattern: 'office@',      prefix: 'office',      baseConfidence: 55 },
    { pattern: 'admin@',       prefix: 'admin',       baseConfidence: 50 },
    { pattern: 'contact@',     prefix: 'contact',     baseConfidence: 45 },
    { pattern: 'hello@',       prefix: 'hello',       baseConfidence: 40 },
    { pattern: 'sales@',       prefix: 'sales',       baseConfidence: 40 },
    { pattern: 'service@',     prefix: 'service',     baseConfidence: 38 },
    { pattern: 'billing@',     prefix: 'billing',     baseConfidence: 35 },
    { pattern: 'accounting@',  prefix: 'accounting',  baseConfidence: 35 },
    { pattern: 'bookkeeping@', prefix: 'bookkeeping', baseConfidence: 33 },
    { pattern: 'inquiries@',   prefix: 'inquiries',   baseConfidence: 33 },
    { pattern: 'front@',       prefix: 'front',       baseConfidence: 30 },
    { pattern: 'manager@',     prefix: 'manager',     baseConfidence: 30 },
];

// ═══════════════════════════════════════════════════════
// MAIN GUESSER
// ═══════════════════════════════════════════════════════

/**
 * Generate email pattern guesses for a domain.
 *
 * @param domain       - The business domain (e.g. "joesDaycare.com")
 * @param contactName  - Optional owner/contact name from AI extraction
 * @param knownGeneric - Optional known generic email (e.g. info@domain.com found on website)
 *                       If provided, confirms the domain accepts email and boosts confidence.
 */
export async function guessEmails(
    domain: string,
    contactName?: string,
    knownGeneric?: string,
): Promise<PatternGuessResult> {
    const log: string[] = [];
    const emails: GuessedEmail[] = [];

    log.push(`[PatternGuesser] Starting for domain: ${domain}`);

    // Step 1: MX validation
    const mx = await checkMxRecords(domain);
    if (!mx.valid) {
        log.push(`[PatternGuesser] ❌ Domain ${domain} has no MX records — skipping`);
        return { emails: [], mxValid: false, log };
    }
    log.push(`[PatternGuesser] ✅ MX valid (provider: ${mx.provider || 'unknown'}, records: ${mx.records?.slice(0, 2).join(', ')})`);

    // Confidence boost if we already know a working email on this domain
    const domainProven = !!knownGeneric;
    if (domainProven) {
        log.push(`[PatternGuesser] Domain confirmed via known email: ${knownGeneric}`);
    }

    // Provider-specific confidence boost
    // Google Workspace and Microsoft 365 are more predictable with firstname@ patterns
    const providerBoost = (mx.provider === 'google' || mx.provider === 'microsoft') ? 10 : 0;

    // Step 2: Generate personal email guesses (if we have a name)
    if (contactName) {
        const parsed = parseName(contactName);
        if (parsed) {
            log.push(`[PatternGuesser] Parsed name: "${contactName}" → first="${parsed.first}", last="${parsed.last}"`);

            for (const p of PERSONAL_PATTERNS) {
                const localPart = p.build(parsed);
                const email = `${localPart}@${domain}`;
                const confidence = Math.min(100, p.baseConfidence + providerBoost + (domainProven ? 10 : 0));

                emails.push({
                    email: email.toLowerCase(),
                    pattern: `${p.pattern}@`,
                    type: 'personal',
                    confidence,
                });
            }
            log.push(`[PatternGuesser] Generated ${emails.length} personal pattern guesses`);
        } else {
            log.push(`[PatternGuesser] Could not parse name: "${contactName}" — falling back to generic`);
        }
    }

    // Step 3: Generate generic email guesses
    // Skip if we already know this generic email from scraping
    const knownPrefix = knownGeneric?.split('@')[0]?.toLowerCase();
    for (const g of GENERIC_PATTERNS) {
        if (knownPrefix === g.prefix) {
            // We already have this one from scraping — skip the guess
            continue;
        }
        const email = `${g.prefix}@${domain}`;
        const confidence = Math.min(100, g.baseConfidence + (domainProven ? 15 : 0));

        emails.push({
            email: email.toLowerCase(),
            pattern: g.pattern,
            type: 'generic',
            confidence,
        });
    }
    log.push(`[PatternGuesser] Generated ${emails.filter(e => e.type === 'generic').length} generic pattern guesses`);

    // Sort: personal first (by confidence), then generic (by confidence)
    emails.sort((a, b) => {
        if (a.type === 'personal' && b.type !== 'personal') return -1;
        if (a.type !== 'personal' && b.type === 'personal') return 1;
        return b.confidence - a.confidence;
    });

    return {
        emails,
        mxValid: true,
        mxProvider: mx.provider,
        log,
    };
}
