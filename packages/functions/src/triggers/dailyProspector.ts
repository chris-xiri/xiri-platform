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
import { db } from "../utils/firebase";
import { prospectAndEnrich } from "../agents/prospector";
import { DASHBOARD_CORS } from "../utils/cors";
import type { EnrichedProspect } from "@xiri/shared";

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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
    };
}

const DEFAULT_CONFIG: ProspectingConfig = {
    queries: [
        "office building",
        "dental office",
        "veterinary clinic",
        "gym fitness center",
        "retail store",
        "medical suite",
        "urgent care center",
        "car dealership",
        "insurance office",
    ],
    locations: [
        "Nassau County, NY",
        "Suffolk County, NY",
        "Queens, NY",
    ],
    dailyTarget: 100,
    enabled: true,
    excludePatterns: [],
};

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
        // Iterate queries × locations until we hit dailyTarget
        for (const location of config.locations) {
            if (newProspects.length >= config.dailyTarget) break;

            for (const queryTerm of config.queries) {
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
                        if (
                            seen.has(normalized) ||
                            (phoneCleaned && phoneCleaned.length >= 7 && seen.has(`phone:${phoneCleaned}`)) ||
                            (emailLower && seen.has(`email:${emailLower}`)) ||
                            (genericLower && seen.has(`email:${genericLower}`)) ||
                            (websiteDomain && seen.has(`domain:${websiteDomain}`)) ||
                            (addressNorm && addressNorm.length >= 10 && seen.has(`addr:${addressNorm}`))
                        ) {
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

                        newProspects.push({ prospect, query: queryTerm, location });
                    }

                    // Update progress after each query batch
                    await updateProgress(`${queryTerm} in ${location}`);
                } catch (err: any) {
                    logger.error(`[DailyProspector] Error for "${queryTerm}" in "${location}":`, err.message);
                    // Continue with next query
                }
            }
        }

        // Write to prospect_queue in batches of 500 (Firestore limit)
        const BATCH_LIMIT = 450;
        for (let i = 0; i < newProspects.length; i += BATCH_LIMIT) {
            const chunk = newProspects.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();

            for (const { prospect, query, location } of chunk) {
                const ref = db.collection("prospect_queue").doc();
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
                    emailSource: prospect.emailSource || 'none',
                    emailConfidence: prospect.emailConfidence || 'low',
                    facebookUrl: prospect.facebookUrl || null,
                    linkedinUrl: prospect.linkedinUrl || null,
                    enrichmentLog: prospect.enrichmentLog || [],

                    // All contacts discovered via Hunter enrichment
                    allContacts: prospect.allContacts || [],

                    status: "pending_review",
                    batchDate,
                    searchQuery: query,
                    searchLocation: location,

                    createdAt: new Date(),
                });
            }

            await batch.commit();
            logger.info(`[DailyProspector] Wrote batch of ${chunk.length} prospects.`);
        }

        // Update config with run stats
        const stats = {
            discovered: totalDiscovered,
            withEmail: newProspects.length,
            added: newProspects.length,
            duplicatesSkipped,
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
    // Seed default config
    await db.collection("prospecting_config").doc("default").set(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
});
