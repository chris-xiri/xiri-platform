/**
 * Client Trigger Sourcer — Job Board Scraper
 *
 * Searches Serper (Google Search) for active job postings that signal
 * a facility is hiring in-house cleaning staff (janitors, custodians,
 * facility coordinators). These are "trigger events" indicating the
 * business might be a candidate for outsourcing.
 *
 * Returns enriched results with job posting metadata.
 */

import axios from 'axios';
import * as crypto from 'crypto';
import { db } from '../utils/firebase';
import * as logger from 'firebase-functions/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface JobPostingResult {
    /** Business or employer name from the job posting */
    employerName: string;
    /** Job title as posted */
    jobTitle: string;
    /** Source URL (Indeed, LinkedIn, ZipRecruiter, etc.) */
    sourceUrl: string;
    /** Source platform name */
    sourcePlatform: string;
    /** Location from the posting */
    location: string;
    /** Snippet / description excerpt */
    snippet: string;
    /** Date string as displayed in search results */
    datePosted?: string;
}

// ── Job search queries ───────────────────────────────────────────────

/** Search queries that surface in-house cleaning hiring activity */
export const JOB_TRIGGER_QUERIES = [
    'hiring night custodian',
    'hiring janitor',
    'hiring facilities coordinator',
    'hiring cleaning staff',
    'hiring janitorial worker',
    'hiring building maintenance',
    'hiring custodial worker',
    'hiring housekeeping',
    'hiring facility maintenance',
    'hiring porter',
];

/** Job board site filters for more targeted results */
const JOB_BOARD_SITES = [
    'indeed.com',
    'ziprecruiter.com',
    'glassdoor.com',
    'linkedin.com/jobs',
    'simplyhired.com',
];

// ── Serper search cache (7-day TTL) ──────────────────────────────────

const CACHE_COLLECTION = 'serper_job_cache';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days for job postings (they move fast)

function cacheKey(query: string, location: string): string {
    const raw = `job|${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

async function getCachedResults(query: string, location: string): Promise<JobPostingResult[] | null> {
    try {
        const docId = cacheKey(query, location);
        const doc = await db.collection(CACHE_COLLECTION).doc(docId).get();
        if (!doc.exists) return null;

        const data = doc.data()!;
        const cachedAt = data.cachedAt?.toDate?.() || new Date(data.cachedAt);
        const age = Date.now() - cachedAt.getTime();

        if (age > CACHE_TTL_MS) {
            logger.info(`[JobCache] Expired for "${query}" in "${location}" (age: ${Math.round(age / 3600000)}h)`);
            return null;
        }

        logger.info(`[JobCache] HIT for "${query}" in "${location}" (${data.results?.length || 0} results)`);
        return data.results as JobPostingResult[];
    } catch (err: any) {
        logger.warn(`[JobCache] Read error: ${err.message}`);
        return null;
    }
}

async function setCachedResults(query: string, location: string, results: JobPostingResult[]): Promise<void> {
    try {
        const docId = cacheKey(query, location);
        await db.collection(CACHE_COLLECTION).doc(docId).set({
            query: query.toLowerCase().trim(),
            location: location.toLowerCase().trim(),
            results,
            resultCount: results.length,
            cachedAt: new Date(),
        });
    } catch (err: any) {
        logger.warn(`[JobCache] Write error: ${err.message}`);
    }
}

// ── Employer name extraction ─────────────────────────────────────────

/**
 * Extract the employer/business name from a job posting search result.
 * Serper organic results come back as title/snippet pairs from job boards.
 * 
 * Common title patterns:
 *   "Night Custodian - ABC Medical Center - New York, NY"
 *   "Janitor at XYZ Corp | Indeed.com"
 *   "Cleaning Staff — Brooklyn Hospital Center"
 */
function extractEmployerName(title: string, snippet: string): string {
    // Remove common suffixes
    let cleaned = title
        .replace(/\s*\|.*$/, '')          // |Indeed.com, |LinkedIn
        .replace(/\s*-\s*Indeed.*$/i, '')  // - Indeed
        .replace(/\s*-\s*ZipRecruiter.*$/i, '')
        .replace(/\s*-\s*Glassdoor.*$/i, '')
        .replace(/\s*-\s*LinkedIn.*$/i, '')
        .replace(/\s*-\s*SimplyHired.*$/i, '')
        .trim();

    // Try: "Job Title - Company Name - Location"
    const parts = cleaned.split(/\s+-\s+/);
    if (parts.length >= 3) {
        // Middle segment is usually the company
        return parts[1].trim();
    }
    if (parts.length === 2) {
        // Could be "Job Title - Company" or "Company - Location"
        // If second part looks like a city/state, first is company
        const second = parts[1].trim();
        if (/,\s*(NY|NJ|CT|PA|MA)/i.test(second)) {
            return parts[0].trim();
        }
        return second;
    }

    // Try snippet for "Company Name is hiring" or "at Company Name"
    const atMatch = snippet.match(/(?:at|for)\s+([A-Z][A-Za-z\s&'.,-]+?)(?:\s+in\s+|\s+is\s+|\s*\.|,)/);
    if (atMatch) return atMatch[1].trim();

    const hiringMatch = snippet.match(/([A-Z][A-Za-z\s&'.,-]+?)\s+is\s+(?:hiring|looking|seeking)/);
    if (hiringMatch) return hiringMatch[1].trim();

    // Fallback: use the whole cleaned title
    return cleaned;
}

/**
 * Detect which job board platform a URL points to.
 */
function detectPlatform(url: string): string {
    if (url.includes('indeed.com')) return 'Indeed';
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('ziprecruiter.com')) return 'ZipRecruiter';
    if (url.includes('glassdoor.com')) return 'Glassdoor';
    if (url.includes('simplyhired.com')) return 'SimplyHired';
    if (url.includes('monster.com')) return 'Monster';
    if (url.includes('careerbuilder.com')) return 'CareerBuilder';
    return 'Google';
}

// ── Employer exclusion patterns ──────────────────────────────────────
// Skip employers that are themselves cleaning companies, property managers,
// or staffing agencies — they're hiring for their own ops, NOT outsourcing targets.
// These defaults are exported so the trigger config can use them as a base.

export const DEFAULT_EXCLUDED_EMPLOYERS = [
    // Cleaning / janitorial / facility services companies (competitors)
    'cleaning', 'janitorial', 'custodial', 'sanitation',
    'maid', 'housekeeping', 'janitor', 'clean team',
    'facility solutions', 'facility services', 'building services',
    'maintenance solutions', 'maintenance services',
    'environmental services', 'building maintenance',
    'servicemaster', 'jani-king', 'coverall', 'stratus',
    'pritchard', 'marsden', 'abm ', 'iss facility',
    'cintas', 'aramark', 'sodexo', 'cushman',

    // Property management firms
    'property management', 'realty', 'real estate management',
    'greystar', 'related companies', 'brookfield properties',
    'cbre', 'jll', 'colliers', 'newmark',
    'cushman & wakefield', 'marcus & millichap',

    // Staffing agencies
    'staffing', 'temp agency', 'employment agency', 'workforce',
    'manpower', 'adecco', 'kelly services', 'randstad',
];

function isExcludedEmployer(name: string, patterns: string[]): boolean {
    const lower = name.toLowerCase();
    return patterns.some(p => lower.includes(p));
}

// ── Main search function ─────────────────────────────────────────────

/**
 * Search for job postings indicating in-house cleaning hiring.
 * Uses Serper Google Search API to find recent job listings.
 * 
 * @param query - Job search query (e.g., "hiring night custodian")
 * @param location - Geographic location to search
 * @param maxResults - Max results to return (default 20)
 * @param excludePatterns - Employer name patterns to skip (from config)
 */
export async function searchJobPostings(
    query: string,
    location: string,
    maxResults: number = 20,
    excludePatterns: string[] = DEFAULT_EXCLUDED_EMPLOYERS,
): Promise<JobPostingResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        logger.error('[ClientTriggerSourcer] SERPER_API_KEY not set');
        return [];
    }

    // Check cache first
    const cached = await getCachedResults(query, location);
    if (cached !== null) return cached.slice(0, maxResults);

    // Build the search query — target job board sites
    const siteFilter = JOB_BOARD_SITES.map(s => `site:${s}`).join(' OR ');
    const fullQuery = `${query} ${location} (${siteFilter})`;

    logger.info(`[ClientTriggerSourcer] Searching: "${fullQuery}"`);

    try {
        const response = await axios.post(
            'https://google.serper.dev/search',
            {
                q: fullQuery,
                num: 30, // request extra to account for filtering
            },
            {
                headers: {
                    'X-API-KEY': apiKey.trim(),
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );

        const organic = response.data.organic || [];
        logger.info(`[ClientTriggerSourcer] Serper returned ${organic.length} organic results`);

        const results: JobPostingResult[] = [];
        const seenEmployers = new Set<string>();

        for (const item of organic) {
            const title = item.title || '';
            const snippet = item.snippet || '';
            const link = item.link || '';

            // Skip non-job-board results
            if (!JOB_BOARD_SITES.some(site => link.includes(site.replace('/jobs', '')))) {
                continue;
            }

            const employerName = extractEmployerName(title, snippet);
            if (!employerName || employerName.length < 3) continue;

            // Skip cleaning companies, property managers, and staffing agencies
            if (isExcludedEmployer(employerName, excludePatterns)) {
                logger.info(`[ClientTriggerSourcer] Skipping excluded employer: "${employerName}"`);
                continue;
            }

            // Deduplicate by employer within this result set
            const normalizedEmployer = employerName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seenEmployers.has(normalizedEmployer)) continue;
            seenEmployers.add(normalizedEmployer);

            results.push({
                employerName,
                jobTitle: title.split(/\s+-\s+/)[0]?.trim() || title,
                sourceUrl: link,
                sourcePlatform: detectPlatform(link),
                location,
                snippet: snippet.slice(0, 300),
                datePosted: item.date || undefined,
            });

            if (results.length >= maxResults) break;
        }

        logger.info(`[ClientTriggerSourcer] Extracted ${results.length} unique employer job postings`);

        // Cache results
        await setCachedResults(query, location, results);

        return results;
    } catch (err: any) {
        logger.error(`[ClientTriggerSourcer] Search failed: ${err.message}`);
        return [];
    }
}
