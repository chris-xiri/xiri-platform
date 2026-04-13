/**
 * Daily Prospector — Automated Lead Discovery Pipeline
 *
 * Runs daily at 6 AM ET. Discovers commercial prospects via Serper Places,
 * enriches them with the full waterfall (scrape → web search → Hunter),
 * and writes them to `prospect_queue` for human review.
 *
 * Deduplicates against:
 *   1. Previous prospect_queue entries (by normalizedName + phone)
 *   2. Existing companies collection (already in CRM)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { db } from "../utils/firebase";
import { prospectAndEnrich } from "../agents/prospector";
import { DASHBOARD_CORS } from "../utils/cors";
import { generateProspectingConfig, getConfigSummary } from "../utils/prospectingTargets";
import type { EnrichedProspect } from "@xiri/shared";

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Create a deterministic document ID from prospect identifiers.
 * This makes writes idempotent — writing the same business twice
 * simply overwrites the same Firestore doc rather than creating a dupe.
 */
function prospectDocId(prospect: {
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    businessName: string;
}): string {
    // Build a composite key from the most stable identifiers
    const parts: string[] = [];

    // Prefer address (most unique per physical business)
    if (prospect.address) {
        parts.push(prospect.address.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    // Phone as secondary
    if (prospect.phone) {
        parts.push(prospect.phone.replace(/[^0-9]/g, ''));
    }
    // Website domain as tertiary
    if (prospect.website) {
        const domain = prospect.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        parts.push(domain);
    }
    // Fall back to normalized name if no other identifiers
    if (parts.length === 0) {
        parts.push(normalizeName(prospect.businessName));
    }

    const composite = parts.join('|');
    // Hash to create a valid Firestore doc ID (max 1500 bytes)
    return crypto.createHash('sha256').update(composite).digest('hex').slice(0, 20);
}

interface ProspectingConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    enabled: boolean;
    excludePatterns: string[];
    lastRunAt?: FirebaseFirestore.Timestamp;
    lastRunStats?: {
        discovered: number;
        withEmail: number;
        added: number;
        duplicatesSkipped: number;
        queryYield?: Record<string, { discovered: number; qualified: number }>;
        locationYield?: Record<string, { discovered: number; qualified: number }>;
    };
}

/**
 * Auto-generated from ICP engine. Covers 75+ queries × 76 towns = 5,700+ combos.
 * All facility types are single-tenant or self-managed cleaning.
 * @see prospectingTargets.ts for the ICP definition
 */
const AUTO_CONFIG = generateProspectingConfig({ dailyTarget: 100 });
const DEFAULT_CONFIG: ProspectingConfig = {
    queries: AUTO_CONFIG.queries,
    locations: AUTO_CONFIG.locations,
    dailyTarget: AUTO_CONFIG.dailyTarget,
    enabled: true,
    excludePatterns: [],
};

/** Fisher-Yates shuffle — randomize combo order each run */
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── PIC (Person In Charge) Inference ─────────────────────────────────
// Maps search query terms → the most likely decision-maker for commercial
// cleaning contracts at that facility type.
//
// Used when the enrichment pipeline doesn't find a real contact name/title,
// so outreach sequences can still address the right person by role.
// Source: https://www.bls.gov/ooh + industry convention

const FACILITY_PIC_MAP: Record<string, { title: string; dept?: string }> = {
    // ── DENTAL ──
    'dental office':            { title: 'Practice Manager',         dept: 'Administration' },
    'orthodontist':             { title: 'Office Manager',            dept: 'Administration' },
    'pediatric dentist':        { title: 'Practice Manager',         dept: 'Administration' },
    'oral surgeon office':      { title: 'Practice Administrator',   dept: 'Administration' },
    'endodontist':              { title: 'Office Manager',            dept: 'Administration' },

    // ── MEDICAL OFFICES ──
    'medical office':           { title: 'Practice Manager',         dept: 'Administration' },
    'doctor office':            { title: 'Practice Manager',         dept: 'Administration' },
    'family medicine practice': { title: 'Practice Manager',         dept: 'Administration' },
    'pediatrician office':      { title: 'Office Manager',            dept: 'Administration' },
    'internal medicine office': { title: 'Practice Administrator',   dept: 'Administration' },

    // ── SPECIALIST MEDICAL ──
    'dermatologist office':     { title: 'Office Manager',            dept: 'Administration' },
    'eye doctor optometrist':   { title: 'Practice Manager',         dept: 'Operations' },
    'ENT doctor office':        { title: 'Practice Manager',         dept: 'Administration' },
    'allergist office':         { title: 'Office Manager',            dept: 'Administration' },
    'podiatrist office':        { title: 'Practice Manager',         dept: 'Administration' },

    // ── URGENT CARE & SURGERY ──
    'urgent care clinic':       { title: 'Clinic Manager',           dept: 'Operations' },
    'outpatient surgery center':{ title: 'Facility Administrator',   dept: 'Facilities' },
    'walk-in clinic':           { title: 'Clinic Manager',           dept: 'Operations' },

    // ── VETERINARY ──
    'veterinary clinic':        { title: 'Practice Manager',         dept: 'Operations' },
    'animal hospital':          { title: 'Hospital Manager',         dept: 'Operations' },
    'pet emergency vet':        { title: 'Practice Manager',         dept: 'Operations' },

    // ── PHYSICAL THERAPY & REHAB ──
    'physical therapy center':  { title: 'Center Director',          dept: 'Operations' },
    'chiropractor office':      { title: 'Office Manager',            dept: 'Administration' },
    'rehabilitation center':    { title: 'Facility Manager',         dept: 'Facilities' },

    // ── DIALYSIS ──
    'dialysis center':          { title: 'Facility Administrator',   dept: 'Facilities' },

    // ── AUTOMOTIVE ──
    'car dealership':           { title: 'General Manager',          dept: 'Management' },
    'auto repair shop':         { title: 'Shop Owner',               dept: 'Management' },
    'auto body shop':           { title: 'Shop Manager',             dept: 'Operations' },
    'tire shop':                { title: 'Store Manager',            dept: 'Management' },

    // ── CHILDCARE & EDUCATION ──
    'daycare center':           { title: 'Director',                 dept: 'Administration' },
    'preschool':                { title: 'Director',                 dept: 'Administration' },
    'childcare center':         { title: 'Center Director',          dept: 'Administration' },
    'Montessori school':        { title: 'Head of School',           dept: 'Administration' },

    // ── TUTORING & LEARNING ──
    'tutoring center':          { title: 'Center Director',          dept: 'Operations' },
    'learning center':          { title: 'Center Director',          dept: 'Operations' },
    'test prep center':         { title: 'Center Manager',           dept: 'Operations' },

    // ── FITNESS & WELLNESS ──
    'gym fitness center':       { title: 'General Manager',          dept: 'Operations' },
    'CrossFit gym':             { title: 'Head Coach / Owner',       dept: 'Management' },
    'yoga studio':              { title: 'Studio Owner',             dept: 'Management' },
    'pilates studio':           { title: 'Studio Manager',           dept: 'Operations' },
    'martial arts studio':      { title: 'Studio Owner',             dept: 'Management' },

    // ── RETAIL ──
    'retail store':             { title: 'Store Manager',            dept: 'Operations' },
    'boutique shop':            { title: 'Store Owner',              dept: 'Management' },
    'bridal shop':              { title: 'Owner',                    dept: 'Management' },
    'furniture store':          { title: 'Store Manager',            dept: 'Operations' },

    // ── SALON & PERSONAL CARE ──
    'hair salon':               { title: 'Salon Owner',              dept: 'Management' },
    'barbershop':               { title: 'Owner',                    dept: 'Management' },
    'nail salon':               { title: 'Owner',                    dept: 'Management' },
    'spa day spa':              { title: 'Spa Director',             dept: 'Management' },
    'med spa':                  { title: 'Medical Director',         dept: 'Management' },

    // ── RELIGIOUS CENTERS ──
    'church':                   { title: 'Office Administrator',     dept: 'Administration' },
    'synagogue':                { title: 'Executive Director',       dept: 'Administration' },
    'mosque':                   { title: 'Administrator',            dept: 'Administration' },
    'temple':                   { title: 'Executive Director',       dept: 'Administration' },

    // ── FUNERAL HOMES ──
    'funeral home':             { title: 'Funeral Director',         dept: 'Management' },
    'funeral parlor':           { title: 'Funeral Director',         dept: 'Management' },

    // ── PET SERVICES ──
    'pet grooming':             { title: 'Owner',                    dept: 'Management' },
    'doggy daycare':            { title: 'Facility Manager',         dept: 'Operations' },
    'pet boarding kennel':      { title: 'Owner',                    dept: 'Management' },

    // ── LEGAL ──
    'law firm office':          { title: 'Office Manager',            dept: 'Administration' },
    'attorney office':          { title: 'Office Administrator',     dept: 'Administration' },

    // ── INSURANCE & FINANCE ──
    'insurance agency office':  { title: 'Agency Manager',           dept: 'Operations' },
    'accounting firm office':   { title: 'Office Manager',            dept: 'Administration' },
    'tax preparation office':   { title: 'Office Manager',            dept: 'Administration' },

    // ── REAL ESTATE ──
    'real estate office':       { title: 'Broker / Office Manager',  dept: 'Management' },

    // ── PHARMACY ──
    'pharmacy':                 { title: 'Pharmacy Manager',         dept: 'Operations' },
    'compounding pharmacy':     { title: 'Pharmacy Owner',           dept: 'Management' },

    // ── DANCE & PERFORMING ARTS ──
    'dance studio':             { title: 'Studio Director',          dept: 'Management' },
    'music school':             { title: 'School Director',          dept: 'Management' },
    'performing arts studio':   { title: 'Studio Director',          dept: 'Management' },

    // ── PRIVATE SCHOOLS ──
    'private school':           { title: 'Principal',                dept: 'Administration' },
    'preparatory school':       { title: 'Head of School',           dept: 'Administration' },
    'charter schools':          { title: 'Principal',                dept: 'Administration' },

    // ── LIGHT INDUSTRIAL ──
    'warehouse':                { title: 'Facilities Manager',       dept: 'Facilities' },
    'light manufacturing facility': { title: 'Operations Manager',   dept: 'Operations' },
};

/**
 * Resolve the most likely PIC title for a given search query term.
 * Returns null if the term isn't in the map.
 */
function inferPicTitle(queryTerm: string): { title: string; dept?: string } | null {
    return FACILITY_PIC_MAP[queryTerm] ?? null;
}

// ── Load seen set (names + phones + emails we've already queued or imported) ──

async function loadSeenSet(): Promise<Set<string>> {
    const seen = new Set<string>();

    // 1. All prospect_queue entries (any status)
    const queueSnap = await db.collection("prospect_queue")
        .select("normalizedName", "phone", "contactEmail", "genericEmail", "website", "address").get();
    for (const doc of queueSnap.docs) {
        const d = doc.data();
        if (d.normalizedName) seen.add(d.normalizedName);
        if (d.phone) {
            const cleaned = d.phone.replace(/[^0-9]/g, '');
            if (cleaned.length >= 7) seen.add(`phone:${cleaned}`);
        }
        if (d.contactEmail) seen.add(`email:${d.contactEmail.toLowerCase()}`);
        if (d.genericEmail) seen.add(`email:${d.genericEmail.toLowerCase()}`);
        if (d.website) {
            const domain = d.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            if (domain) seen.add(`domain:${domain}`);
        }
        if (d.address) {
            const addrNorm = d.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
            if (addrNorm.length >= 10) seen.add(`addr:${addrNorm}`);
        }
    }

    // 2. All CRM companies
    const companiesSnap = await db.collection("companies").select("name", "phone", "website", "address").get();
    for (const doc of companiesSnap.docs) {
        const d = doc.data();
        if (d.name) seen.add(normalizeName(d.name));
        if (d.phone) {
            const cleaned = d.phone.replace(/[^0-9]/g, '');
            if (cleaned.length >= 7) seen.add(`phone:${cleaned}`);
        }
        if (d.website) {
            const domain = d.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            if (domain) seen.add(`domain:${domain}`);
        }
        if (d.address) {
            const addrNorm = d.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
            if (addrNorm.length >= 10) seen.add(`addr:${addrNorm}`);
        }
    }

    // 3. All CRM contacts (by email) — skip prospects with emails already in CRM
    const contactsSnap = await db.collection("contacts").select("email").get();
    for (const doc of contactsSnap.docs) {
        const d = doc.data();
        if (d.email) seen.add(`email:${d.email.toLowerCase()}`);
    }

    logger.info(`[DailyProspector] Seen set loaded: ${seen.size} entries (queue + companies + contacts)`);
    return seen;
}

// ── Core pipeline ───────────────────────────────────────────────────

async function runDailyPipeline() {
    // Load config
    const configDoc = await db.collection("prospecting_config").doc("default").get();
    const config: ProspectingConfig = configDoc.exists
        ? { ...DEFAULT_CONFIG, ...(configDoc.data() as Partial<ProspectingConfig>) }
        : DEFAULT_CONFIG;

    if (!config.enabled) {
        logger.info("[DailyProspector] Disabled via config. Skipping.");
        return;
    }

    const secrets = {
        geminiApiKey: process.env.GEMINI_API_KEY!,
        serperApiKey: process.env.SERPER_API_KEY!,
        hunterApiKey: process.env.HUNTER_API_KEY,
    };

    const seen = await loadSeenSet();
    const batchDate = new Date().toISOString().split("T")[0]; // "2026-04-09"
    const newProspects: Array<{ prospect: EnrichedProspect; query: string; location: string }> = [];
    let totalDiscovered = 0;
    let duplicatesSkipped = 0;
    
    const queryYield: Record<string, { discovered: number; qualified: number }> = {};
    const locationYield: Record<string, { discovered: number; qualified: number }> = {};

    // Progress doc for live UI updates
    const statusRef = db.collection("prospecting_config").doc("run_status");
    const startedAt = new Date();
    const updateProgress = async (currentQuery?: string) => {
        await statusRef.set({
            running: true,
            startedAt,
            discovered: totalDiscovered,
            qualified: newProspects.length,
            duplicatesSkipped,
            target: config.dailyTarget,
            currentQuery: currentQuery || null,
            updatedAt: new Date(),
        }, { merge: true });
    };

    // Mark as running
    await updateProgress("Initializing...");

    try {
        // Build all combos and shuffle — ensures each run processes different
        // corners of the search space instead of always starting from position 0
        const combos: Array<{ query: string; location: string }> = [];
        for (const location of config.locations) {
            for (const queryTerm of config.queries) {
                combos.push({ query: queryTerm, location });
            }
        }
        const shuffled = shuffle(combos);
        logger.info(`[DailyProspector] ${shuffled.length} combos shuffled. Target: ${config.dailyTarget}`);

        // Iterate shuffled combos until we hit dailyTarget
        for (const { query: queryTerm, location } of shuffled) {
            if (newProspects.length >= config.dailyTarget) break;

                const remaining = config.dailyTarget - newProspects.length;
                const batchSize = Math.min(remaining + 10, 20); // request a few extra to account for dedup

                logger.info(`[DailyProspector] Searching: "${queryTerm}" in "${location}" (need ${remaining} more)`);
                await updateProgress(`${queryTerm} in ${location}`);

                try {
                    const result = await prospectAndEnrich(
                        { query: queryTerm, location, maxResults: batchSize, skipPaidApis: false },
                        secrets
                    );

                    totalDiscovered += result.prospects.length;

                    queryYield[queryTerm] = queryYield[queryTerm] || { discovered: 0, qualified: 0 };
                    queryYield[queryTerm].discovered += result.prospects.length;
                    
                    locationYield[location] = locationYield[location] || { discovered: 0, qualified: 0 };
                    locationYield[location].discovered += result.prospects.length;

                    let batchCount = 0;
                    const batch = db.batch();

                    for (const prospect of result.prospects) {
                        if (newProspects.length >= config.dailyTarget) break;

                        const normalized = normalizeName(prospect.businessName);
                        const emailLower = prospect.contactEmail?.toLowerCase();
                        const genericLower = prospect.genericEmail?.toLowerCase();
                        const phoneCleaned = prospect.phone?.replace(/[^0-9]/g, '');
                        const addressNorm = prospect.address
                            ? prospect.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
                            : undefined;
                        const websiteDomain = prospect.website
                            ? prospect.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
                            : undefined;

                        // Dedup check: name, phone, email, address, or website domain
                        const matchedKey =
                            seen.has(normalized) ? `name:${normalized}` :
                            (phoneCleaned && phoneCleaned.length >= 7 && seen.has(`phone:${phoneCleaned}`)) ? `phone:${phoneCleaned}` :
                            (emailLower && seen.has(`email:${emailLower}`)) ? `email:${emailLower}` :
                            (genericLower && seen.has(`email:${genericLower}`)) ? `email:${genericLower}` :
                            (websiteDomain && seen.has(`domain:${websiteDomain}`)) ? `domain:${websiteDomain}` :
                            (addressNorm && addressNorm.length >= 10 && seen.has(`addr:${addressNorm}`)) ? `addr:${addressNorm}` :
                            null;

                        if (matchedKey) {
                            logger.info(`[DailyProspector] Skipping dupe: "${prospect.businessName}" matched on ${matchedKey}`);
                            duplicatesSkipped++;
                            continue;
                        }

                        // Exclude patterns check
                        if (config.excludePatterns.some(p =>
                            normalized.includes(p.toLowerCase())
                        )) {
                            duplicatesSkipped++;
                            continue;
                        }

                        // Only add prospects that have at least some email
                        if (!prospect.contactEmail && !prospect.genericEmail) {
                            continue;
                        }

                        // Add ALL identifiers to seen set to prevent within-batch dupes
                        seen.add(normalized);
                        if (phoneCleaned && phoneCleaned.length >= 7) seen.add(`phone:${phoneCleaned}`);
                        if (emailLower) seen.add(`email:${emailLower}`);
                        if (genericLower) seen.add(`email:${genericLower}`);
                        if (websiteDomain) seen.add(`domain:${websiteDomain}`);
                        if (addressNorm && addressNorm.length >= 10) seen.add(`addr:${addressNorm}`);

                        // Incrementally add to batch — use deterministic ID to prevent dupes
                        const docId = prospectDocId(prospect);
                        const ref = db.collection("prospect_queue").doc(docId);
                        batch.set(ref, {
                            businessName: prospect.businessName,
                            normalizedName: normalizeName(prospect.businessName),
                            address: prospect.address || null,
                            phone: prospect.phone || null,
                            website: prospect.website || null,
                            rating: prospect.rating || null,

                            contactEmail: prospect.contactEmail || null,
                            genericEmail: prospect.genericEmail || null,
                            contactName: prospect.contactName || null,
                            contactTitle: prospect.contactTitle || null,

                            // Inferred PIC — who likely manages cleaning decisions at this facility type.
                            // Set from query term when scraping doesn't find a real contact title.
                            inferredTitle: prospect.contactTitle ? null : (inferPicTitle(queryTerm)?.title ?? null),
                            inferredDept: prospect.contactTitle ? null : (inferPicTitle(queryTerm)?.dept ?? null),

                            emailSource: prospect.emailSource || 'none',
                            emailConfidence: prospect.emailConfidence || 'low',
                            facebookUrl: prospect.facebookUrl || null,
                            linkedinUrl: prospect.linkedinUrl || null,
                            enrichmentLog: prospect.enrichmentLog || [],

                            allContacts: prospect.allContacts || [],

                            status: "pending_review",
                            batchDate,
                            searchQuery: queryTerm,
                            searchLocation: location,

                            createdAt: new Date(),
                        });

                        newProspects.push({ prospect, query: queryTerm, location });
                        batchCount++;

                        queryYield[queryTerm].qualified++;
                        locationYield[location].qualified++;
                    }

                    if (batchCount > 0) {
                        await batch.commit();
                        logger.info(`[DailyProspector] Wrote incremental batch of ${batchCount} prospects.`);
                    }

                    // Update progress after each query batch
                    await updateProgress(`${queryTerm} in ${location}`);
                    
                    const elapsedSecs = (Date.now() - startedAt.getTime()) / 1000;
                    if (elapsedSecs > 480) { // 8 minutes
                        logger.warn("[DailyProspector] Approaching 9-minute execution limit. Stopping early to save state.");
                        break; 
                    }
                } catch (err: any) {
                    logger.error(`[DailyProspector] Error for "${queryTerm}" in "${location}":`, err.message);
                    // Continue with next query
                }
        }

        // Prospects are now incrementally saved during the loops, so we don't need a final batch write here!

        // Update config with run stats
        const stats = {
            discovered: totalDiscovered,
            withEmail: newProspects.length,
            added: newProspects.length,
            duplicatesSkipped,
            queryYield,
            locationYield
        };

        await db.collection("prospecting_config").doc("default").set({
            ...config,
            lastRunAt: new Date(),
            lastRunStats: stats,
        }, { merge: true });

        // Mark run as complete for UI
        await statusRef.set({
            running: false,
            discovered: totalDiscovered,
            qualified: newProspects.length,
            duplicatesSkipped,
            target: config.dailyTarget,
            currentQuery: null,
            completedAt: new Date(),
            updatedAt: new Date(),
        });

        logger.info(`[DailyProspector] Done. Added ${newProspects.length} prospects (${duplicatesSkipped} dupes skipped, ${totalDiscovered} discovered).`);
    } catch (err: any) {
        // Pipeline crashed — log the error and mark as failed
        logger.error(`[DailyProspector] Pipeline crashed:`, err.message || err);

        await statusRef.set({
            running: false,
            discovered: totalDiscovered,
            qualified: newProspects.length,
            duplicatesSkipped,
            target: config.dailyTarget,
            currentQuery: null,
            error: err.message || "Unknown error",
            failedAt: new Date(),
            updatedAt: new Date(),
        }).catch((e: any) => logger.error("[DailyProspector] Failed to write error status:", e.message));

        throw err; // Re-throw so Cloud Functions marks the invocation as failed
    }
}

// ── Scheduled trigger: 6 AM ET daily ────────────────────────────────

export const dailyProspector = onSchedule({
    schedule: "0 6 * * *",  // 6:00 AM ET daily
    timeZone: "America/New_York",
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[DailyProspector] Starting scheduled run...");
    await runDailyPipeline();
});

// ── Manual trigger (onCall) for testing / on-demand runs ────────────

export const triggerDailyProspector = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[DailyProspector] Manual trigger invoked.");
    await runDailyPipeline();
    return { message: "Daily prospector pipeline completed." };
});

// ── Update prospecting config (onCall) ──────────────────────────────

export const updateProspectingConfig = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const data = request.data as Partial<ProspectingConfig>;

    // Only allow updating safe fields
    const update: Record<string, any> = {};
    if (data.queries) update.queries = data.queries;
    if (data.locations) update.locations = data.locations;
    if (data.dailyTarget !== undefined) update.dailyTarget = data.dailyTarget;
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.excludePatterns) update.excludePatterns = data.excludePatterns;

    if (Object.keys(update).length === 0) {
        throw new HttpsError("invalid-argument", "No valid fields to update.");
    }

    await db.collection("prospecting_config").doc("default").set(update, { merge: true });
    logger.info("[updateProspectingConfig] Config updated:", update);

    return { message: "Prospecting config updated.", updated: update };
});

// ── Get prospecting config (onCall) ─────────────────────────────────

export const getProspectingConfig = onCall({
    cors: DASHBOARD_CORS,
}, async () => {
    const doc = await db.collection("prospecting_config").doc("default").get();
    if (doc.exists) {
        return doc.data();
    }
    // Seed with ICP-generated config on first read
    await db.collection("prospecting_config").doc("default").set(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
});

// ── Regenerate config from ICP engine (onCall) ──────────────────────

export const regenerateProspectingConfig = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const data = request.data as { tiers?: (1 | 2 | 3)[]; dailyTarget?: number } | undefined;
    const generated = generateProspectingConfig({
        tiers: data?.tiers ?? [1, 2, 3],
        dailyTarget: data?.dailyTarget ?? 100,
    });

    const config: ProspectingConfig = {
        queries: generated.queries,
        locations: generated.locations,
        dailyTarget: generated.dailyTarget,
        enabled: true,
        excludePatterns: [],
    };

    await db.collection("prospecting_config").doc("default").set(config, { merge: true });

    const summary = getConfigSummary(generated);
    logger.info(`[regenerateProspectingConfig] ${summary}`);

    return {
        message: "Prospecting config regenerated from ICP engine.",
        queries: generated.queries.length,
        locations: generated.locations.length,
        totalCombos: generated._generatorMeta.totalCombos,
        estimatedWeeksOfFreshData: generated._generatorMeta.estimatedWeeksOfFreshData,
    };
});
