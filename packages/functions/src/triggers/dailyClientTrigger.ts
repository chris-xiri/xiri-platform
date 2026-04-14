/**
 * Daily Client Trigger — Job Board Monitoring Pipeline
 *
 * Runs daily at 6:30 AM ET. Searches Serper for facilities actively posting
 * job listings for in-house cleaning roles (janitors, custodians, etc.).
 * These "trigger events" indicate the facility currently handles cleaning
 * in-house — a prime outsourcing pitch opportunity.
 *
 * Writes results to `prospect_queue` with `source: 'job_board_trigger'`
 * and associated `triggerData` containing job posting metadata.
 *
 * Uses the same dedup engine, prospect_queue, and Firestore patterns as
 * the existing dailyProspector — these appear together in the Prospects
 * page, differentiated by a `source` badge.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { db } from "../utils/firebase";
import { searchJobPostings, JOB_TRIGGER_QUERIES, DEFAULT_EXCLUDED_EMPLOYERS } from "../agents/clientTriggerSourcer";
import { runEnrichmentWaterfall } from "../utils/enrichmentProviders";
import { DASHBOARD_CORS } from "../utils/cors";

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function prospectDocId(prospect: {
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    businessName: string;
}): string {
    const parts: string[] = [];
    if (prospect.address) {
        parts.push(prospect.address.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    if (prospect.phone) {
        parts.push(prospect.phone.replace(/[^0-9]/g, ''));
    }
    if (prospect.website) {
        const domain = prospect.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        parts.push(domain);
    }
    if (parts.length === 0) {
        parts.push(normalizeName(prospect.businessName));
    }
    const composite = parts.join('|');
    return crypto.createHash('sha256').update(composite).digest('hex').slice(0, 20);
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Dedup: Load seen set (mirrors dailyProspector) ───────────────────

async function loadSeenSet(): Promise<Set<string>> {
    const seen = new Set<string>();

    // 1. All existing prospect_queue docs
    const queueSnap = await db.collection("prospect_queue")
        .select("businessName", "normalizedName", "phone", "contactEmail", "genericEmail", "website", "address")
        .get();
    for (const doc of queueSnap.docs) {
        const d = doc.data();
        if (d.normalizedName) seen.add(d.normalizedName);
        else if (d.businessName) seen.add(normalizeName(d.businessName));
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
    const companiesSnap = await db.collection("companies")
        .select("name", "phone", "website", "address")
        .get();
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
    }

    // 3. All CRM contacts (by email)
    const contactsSnap = await db.collection("contacts").select("email").get();
    for (const doc of contactsSnap.docs) {
        const d = doc.data();
        if (d.email) seen.add(`email:${d.email.toLowerCase()}`);
    }

    logger.info(`[ClientTrigger] Seen set loaded: ${seen.size} entries`);
    return seen;
}

// ── Config ───────────────────────────────────────────────────────────

interface ClientTriggerConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    enabled: boolean;
    /** Employer name patterns to skip (cleaning companies, PM firms, staffing agencies) */
    excludePatterns: string[];
}

const DEFAULT_CONFIG: ClientTriggerConfig = {
    queries: JOB_TRIGGER_QUERIES,
    locations: [
        // NJ/NY tri-state target market
        'New York, NY', 'Brooklyn, NY', 'Manhattan, NY', 'Queens, NY', 'Bronx, NY',
        'Jersey City, NJ', 'Newark, NJ', 'Hoboken, NJ', 'Edison, NJ', 'New Brunswick, NJ',
        'Piscataway, NJ', 'Woodbridge, NJ', 'Elizabeth, NJ', 'Paterson, NJ', 'Clifton, NJ',
        'Hackensack, NJ', 'Paramus, NJ', 'Fort Lee, NJ', 'Morristown, NJ', 'Parsippany, NJ',
    ],
    dailyTarget: 30,
    enabled: true,
    excludePatterns: DEFAULT_EXCLUDED_EMPLOYERS,
};

// ── Core pipeline ───────────────────────────────────────────────────

async function runClientTriggerPipeline() {
    const configDoc = await db.collection("client_trigger_config").doc("default").get();
    const config: ClientTriggerConfig = configDoc.exists
        ? { ...DEFAULT_CONFIG, ...(configDoc.data() as Partial<ClientTriggerConfig>) }
        : DEFAULT_CONFIG;

    if (!config.enabled) {
        logger.info("[ClientTrigger] Disabled via config. Skipping.");
        return;
    }

    const seen = await loadSeenSet();
    const batchDate = new Date().toISOString().split("T")[0];
    let totalDiscovered = 0;
    let duplicatesSkipped = 0;
    let newProspectsCount = 0;

    // Progress doc for UI
    const statusRef = db.collection("client_trigger_config").doc("run_status");
    const startedAt = new Date();
    await statusRef.set({
        running: true,
        startedAt,
        discovered: 0,
        qualified: 0,
        duplicatesSkipped: 0,
        target: config.dailyTarget,
        currentQuery: "Initializing...",
        updatedAt: new Date(),
    });

    try {
        // Build combos and shuffle
        const combos: Array<{ query: string; location: string }> = [];
        for (const location of config.locations) {
            for (const queryTerm of config.queries) {
                combos.push({ query: queryTerm, location });
            }
        }
        const shuffled = shuffle(combos);
        logger.info(`[ClientTrigger] ${shuffled.length} combos. Target: ${config.dailyTarget}`);

        for (const { query: queryTerm, location } of shuffled) {
            if (newProspectsCount >= config.dailyTarget) break;

            logger.info(`[ClientTrigger] Searching: "${queryTerm}" in "${location}"`);
            await statusRef.set({
                currentQuery: `${queryTerm} in ${location}`,
                updatedAt: new Date(),
            }, { merge: true });

            try {
                const jobResults = await searchJobPostings(queryTerm, location, 15, config.excludePatterns);
                totalDiscovered += jobResults.length;

                const batch = db.batch();
                let batchCount = 0;

                for (const job of jobResults) {
                    if (newProspectsCount >= config.dailyTarget) break;

                    const normalized = normalizeName(job.employerName);

                    // Dedup check
                    if (seen.has(normalized)) {
                        duplicatesSkipped++;
                        continue;
                    }

                    // Try to enrich with website + email
                    let enrichedData: any = {};
                    try {
                        const enrichResult = await runEnrichmentWaterfall(
                            job.employerName,
                            job.location,
                            undefined, // no website yet
                            { serperApiKey: process.env.SERPER_API_KEY!, hunterApiKey: process.env.HUNTER_API_KEY }
                        );
                        enrichedData = enrichResult;
                    } catch (err: any) {
                        logger.warn(`[ClientTrigger] Enrichment failed for "${job.employerName}": ${err.message}`);
                    }

                    // Only keep prospects with at least some email
                    const hasEmail = enrichedData.contactEmail || enrichedData.genericEmail;
                    if (!hasEmail) continue;

                    // Mark as seen
                    seen.add(normalized);
                    if (enrichedData.contactEmail) seen.add(`email:${enrichedData.contactEmail.toLowerCase()}`);
                    if (enrichedData.genericEmail) seen.add(`email:${enrichedData.genericEmail.toLowerCase()}`);
                    if (enrichedData.website) {
                        const domain = enrichedData.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
                        if (domain) seen.add(`domain:${domain}`);
                    }

                    const docId = prospectDocId({
                        businessName: job.employerName,
                        address: enrichedData.address || job.location || null,
                        phone: enrichedData.phone || null,
                        website: enrichedData.website || null,
                    });

                    const ref = db.collection("prospect_queue").doc(docId);
                    batch.set(ref, {
                        businessName: job.employerName,
                        normalizedName: normalized,
                        address: enrichedData.address || job.location || null,
                        phone: enrichedData.phone || null,
                        website: enrichedData.website || null,
                        rating: enrichedData.rating || null,

                        contactEmail: enrichedData.contactEmail || null,
                        genericEmail: enrichedData.genericEmail || null,
                        contactName: enrichedData.contactName || null,
                        contactTitle: enrichedData.contactTitle || null,

                        emailSource: enrichedData.emailSource || 'none',
                        emailConfidence: enrichedData.emailConfidence || 'low',
                        facebookUrl: enrichedData.facebookUrl || null,
                        linkedinUrl: enrichedData.linkedinUrl || null,
                        enrichmentLog: enrichedData.enrichmentLog || [],

                        allContacts: enrichedData.allContacts || [],

                        // ── Source differentiation ──
                        source: 'job_board_trigger',
                        triggerData: {
                            jobTitle: job.jobTitle,
                            sourcePlatform: job.sourcePlatform,
                            sourceUrl: job.sourceUrl,
                            snippet: job.snippet,
                            datePosted: job.datePosted || null,
                        },

                        status: "pending_review",
                        batchDate,
                        searchQuery: queryTerm,
                        searchLocation: location,

                        createdAt: new Date(),
                    });

                    newProspectsCount++;
                    batchCount++;
                }

                if (batchCount > 0) {
                    await batch.commit();
                    logger.info(`[ClientTrigger] Wrote ${batchCount} prospects for "${queryTerm}" in "${location}"`);
                }

                // Time guard
                const elapsedSecs = (Date.now() - startedAt.getTime()) / 1000;
                if (elapsedSecs > 420) {
                    logger.warn("[ClientTrigger] Approaching timeout. Stopping early.");
                    break;
                }
            } catch (err: any) {
                logger.error(`[ClientTrigger] Error for "${queryTerm}" in "${location}":`, err.message);
            }
        }

        // Save run stats
        await db.collection("client_trigger_config").doc("default").set({
            ...config,
            lastRunAt: new Date(),
            lastRunStats: {
                discovered: totalDiscovered,
                added: newProspectsCount,
                duplicatesSkipped,
            },
        }, { merge: true });

        // Mark complete
        await statusRef.set({
            running: false,
            discovered: totalDiscovered,
            qualified: newProspectsCount,
            duplicatesSkipped,
            target: config.dailyTarget,
            currentQuery: null,
            completedAt: new Date(),
            updatedAt: new Date(),
        });

        logger.info(`[ClientTrigger] Done. Added ${newProspectsCount} (${duplicatesSkipped} dupes, ${totalDiscovered} discovered).`);

    } catch (err: any) {
        logger.error(`[ClientTrigger] Pipeline crashed:`, err.message || err);
        await statusRef.set({
            running: false,
            error: err.message || "Unknown error",
            failedAt: new Date(),
            updatedAt: new Date(),
        }).catch(() => { });
        throw err;
    }
}

// ── Scheduled trigger: 6:30 AM ET daily ─────────────────────────────

export const dailyClientTrigger = onSchedule({
    schedule: "30 6 * * *",  // 6:30 AM ET daily (30 min after lead prospector)
    timeZone: "America/New_York",
    secrets: ["SERPER_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[ClientTrigger] Starting scheduled job board scan...");
    await runClientTriggerPipeline();
});

// ── Manual trigger (onCall) ────────────────────────────────────────

export const triggerDailyClientTrigger = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["SERPER_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[ClientTrigger] Manual trigger invoked.");
    await runClientTriggerPipeline();
    return { message: "Client trigger pipeline completed." };
});
