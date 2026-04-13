/**
 * Daily Vendor Prospector — Automated Contractor Discovery Pipeline
 *
 * Runs daily at 7 AM ET (offset from lead prospector at 6 AM). Discovers
 * potential subcontractors/vendors across all canonical service capabilities,
 * enriches them with the full waterfall + Facebook layer, and writes them
 * to `vendor_prospect_queue` for human review.
 *
 * Deduplicates against:
 *   1. Previous vendor_prospect_queue entries (by normalizedName + phone)
 *   2. Existing vendors collection (already onboarded)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { db } from "../utils/firebase";
import { vendorProspectAndEnrich, generateQueriesForCapability } from "../agents/vendorProspector";
import { DASHBOARD_CORS } from "../utils/cors";
import { SERVICE_REGIONS } from "../utils/prospectingTargets";
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
 * Same approach as the lead prospector — makes writes idempotent.
 */
function vendorProspectDocId(prospect: {
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    facebookUrl?: string | null;
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
    if (prospect.facebookUrl) {
        // Facebook URLs are very stable identifiers for businesses
        const fbPath = prospect.facebookUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').split('?')[0].toLowerCase();
        parts.push(`fb:${fbPath}`);
    }
    if (parts.length === 0) {
        parts.push(normalizeName(prospect.businessName));
    }

    const composite = parts.join('|');
    return crypto.createHash('sha256').update(composite).digest('hex').slice(0, 20);
}

// ── Config ──────────────────────────────────────────────────────────

interface VendorProspectingConfig {
    /** Capability values from VENDOR_CAPABILITIES (e.g. 'plumbing', 'hvac') */
    capabilities: Array<{ value: string; label: string; group: string }>;
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
        capabilityYield?: Record<string, { discovered: number; qualified: number }>;
        locationYield?: Record<string, { discovered: number; qualified: number }>;
    };
}

/** Auto-generate town-level locations from the ICP service region list */
function generateVendorLocations(): string[] {
    const locations: string[] = [];
    for (const region of SERVICE_REGIONS) {
        for (const town of region.towns) {
            locations.push(`${town}, ${region.state}`);
        }
    }
    return locations;
}

const DEFAULT_CONFIG: VendorProspectingConfig = {
    capabilities: [
        { value: 'janitorial', label: 'Janitorial / Commercial Cleaning', group: 'cleaning' },
        { value: 'plumbing', label: 'Plumbing', group: 'facility' },
        { value: 'hvac', label: 'HVAC', group: 'facility' },
        { value: 'electrical', label: 'Electrical', group: 'facility' },
        { value: 'landscaping', label: 'Landscaping & Grounds', group: 'facility' },
        { value: 'snow_removal', label: 'Snow & Ice Management', group: 'facility' },
    ],
    locations: generateVendorLocations(),
    dailyTarget: 50,
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

// ── Load seen set (names + phones + emails we've already queued or imported) ──

async function loadVendorSeenSet(): Promise<Set<string>> {
    const seen = new Set<string>();

    // 1. All vendor_prospect_queue entries (any status)
    const queueSnap = await db.collection("vendor_prospect_queue")
        .select("normalizedName", "phone", "contactEmail", "genericEmail", "website", "facebookUrl", "address").get();
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
        if (d.facebookUrl) {
            const fbPath = d.facebookUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').split('?')[0].toLowerCase();
            if (fbPath) seen.add(`fb:${fbPath}`);
        }
        if (d.address) {
            const addrNorm = d.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
            if (addrNorm.length >= 10) seen.add(`addr:${addrNorm}`);
        }
    }

    // 2. All existing vendors (already onboarded)
    const vendorsSnap = await db.collection("vendors")
        .select("businessName", "phone", "email", "website", "address").get();
    for (const doc of vendorsSnap.docs) {
        const d = doc.data();
        if (d.businessName) seen.add(normalizeName(d.businessName));
        if (d.phone) {
            const cleaned = d.phone.replace(/[^0-9]/g, '');
            if (cleaned.length >= 7) seen.add(`phone:${cleaned}`);
        }
        if (d.email) seen.add(`email:${d.email.toLowerCase()}`);
        if (d.website) {
            const domain = d.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            if (domain) seen.add(`domain:${domain}`);
        }
        if (d.address) {
            const addrNorm = d.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
            if (addrNorm.length >= 10) seen.add(`addr:${addrNorm}`);
        }
    }

    logger.info(`[DailyVendorProspector] Seen set loaded: ${seen.size} entries (queue + vendors)`);
    return seen;
}

// ── Core pipeline ───────────────────────────────────────────────────

async function runDailyVendorPipeline() {
    // Load config
    const configDoc = await db.collection("vendor_prospecting_config").doc("default").get();
    const config: VendorProspectingConfig = configDoc.exists
        ? { ...DEFAULT_CONFIG, ...(configDoc.data() as Partial<VendorProspectingConfig>) }
        : DEFAULT_CONFIG;

    if (!config.enabled) {
        logger.info("[DailyVendorProspector] Disabled via config. Skipping.");
        return;
    }

    const secrets = {
        geminiApiKey: process.env.GEMINI_API_KEY!,
        serperApiKey: process.env.SERPER_API_KEY!,
        hunterApiKey: process.env.HUNTER_API_KEY,
    };

    const seen = await loadVendorSeenSet();
    const batchDate = new Date().toISOString().split("T")[0];
    const newProspects: Array<{ prospect: EnrichedProspect; query: string; location: string; capability: string }> = [];
    let totalDiscovered = 0;
    let duplicatesSkipped = 0;

    const capabilityYield: Record<string, { discovered: number; qualified: number }> = {};
    const locationYield: Record<string, { discovered: number; qualified: number }> = {};

    // Progress doc for live UI updates
    const statusRef = db.collection("vendor_prospecting_config").doc("run_status");
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
        // Build all combos (location × capability × query) and shuffle
        const combos: Array<{ query: string; location: string; capability: typeof config.capabilities[0] }> = [];
        for (const location of config.locations) {
            for (const capability of config.capabilities) {
                const queries = generateQueriesForCapability(capability.label, capability.group);
                for (const queryTerm of queries) {
                    combos.push({ query: queryTerm, location, capability });
                }
            }
        }
        const shuffled = shuffle(combos);
        logger.info(`[DailyVendorProspector] ${shuffled.length} combos shuffled. Target: ${config.dailyTarget}`);

        // Iterate shuffled combos until we hit dailyTarget
        for (const { query: queryTerm, location, capability } of shuffled) {
            if (newProspects.length >= config.dailyTarget) break;

            const remaining = config.dailyTarget - newProspects.length;
            const batchSize = Math.min(remaining + 10, 20);

            logger.info(`[DailyVendorProspector] Searching: "${queryTerm}" in "${location}" (capability: ${capability.value}, need ${remaining} more)`);
            await updateProgress(`${capability.label} in ${location}`);

            try {
                const result = await vendorProspectAndEnrich(
                    {
                        query: queryTerm,
                        location,
                        capability: capability.value,
                        maxResults: batchSize,
                        skipPaidApis: false,
                    },
                    secrets
                );

                totalDiscovered += result.prospects.length;

                capabilityYield[capability.value] = capabilityYield[capability.value] || { discovered: 0, qualified: 0 };
                capabilityYield[capability.value].discovered += result.prospects.length;

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
                    const fbPath = prospect.facebookUrl
                        ? prospect.facebookUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').split('?')[0].toLowerCase()
                        : undefined;

                    // Dedup check: name, phone, email, address, website domain, or Facebook URL
                    const matchedKey =
                        seen.has(normalized) ? `name:${normalized}` :
                        (phoneCleaned && phoneCleaned.length >= 7 && seen.has(`phone:${phoneCleaned}`)) ? `phone:${phoneCleaned}` :
                        (emailLower && seen.has(`email:${emailLower}`)) ? `email:${emailLower}` :
                        (genericLower && seen.has(`email:${genericLower}`)) ? `email:${genericLower}` :
                        (websiteDomain && seen.has(`domain:${websiteDomain}`)) ? `domain:${websiteDomain}` :
                        (fbPath && seen.has(`fb:${fbPath}`)) ? `fb:${fbPath}` :
                        (addressNorm && addressNorm.length >= 10 && seen.has(`addr:${addressNorm}`)) ? `addr:${addressNorm}` :
                        null;

                    if (matchedKey) {
                        logger.info(`[DailyVendorProspector] Skipping dupe: "${prospect.businessName}" matched on ${matchedKey}`);
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

                    // For vendors, we're more lenient — accept even without email  
                    // (phone-only or Facebook-only contractors are still valuable)
                    if (!prospect.contactEmail && !prospect.genericEmail && !prospect.phone && !prospect.facebookUrl) {
                        continue;
                    }

                    // Add ALL identifiers to seen set to prevent within-batch dupes
                    seen.add(normalized);
                    if (phoneCleaned && phoneCleaned.length >= 7) seen.add(`phone:${phoneCleaned}`);
                    if (emailLower) seen.add(`email:${emailLower}`);
                    if (genericLower) seen.add(`email:${genericLower}`);
                    if (websiteDomain) seen.add(`domain:${websiteDomain}`);
                    if (fbPath) seen.add(`fb:${fbPath}`);
                    if (addressNorm && addressNorm.length >= 10) seen.add(`addr:${addressNorm}`);

                    // Write to vendor_prospect_queue with capability metadata
                    const docId = vendorProspectDocId(prospect);
                    const ref = db.collection("vendor_prospect_queue").doc(docId);
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

                        allContacts: prospect.allContacts || [],

                        // Vendor-specific fields
                        searchCapability: capability.value,
                        detectedCapabilities: [capability.value],
                        isCommercial: null, // To be determined by AI or manual review

                        status: "pending_review",
                        batchDate,
                        searchQuery: queryTerm,
                        searchLocation: location,

                        createdAt: new Date(),
                    });

                    newProspects.push({ prospect, query: queryTerm, location, capability: capability.value });
                    batchCount++;

                    capabilityYield[capability.value].qualified++;
                    locationYield[location].qualified++;
                }

                if (batchCount > 0) {
                    await batch.commit();
                    logger.info(`[DailyVendorProspector] Wrote batch of ${batchCount} vendor prospects.`);
                }

                await updateProgress(`${capability.label} in ${location}`);

                const elapsedSecs = (Date.now() - startedAt.getTime()) / 1000;
                if (elapsedSecs > 480) {
                    logger.warn("[DailyVendorProspector] Approaching 9-minute limit. Stopping early.");
                    break;
                }
            } catch (err: any) {
                logger.error(`[DailyVendorProspector] Error for "${queryTerm}" in "${location}":`, err.message);
            }
        }

        // Update config with run stats
        const stats = {
            discovered: totalDiscovered,
            withEmail: newProspects.filter(p => p.prospect.contactEmail || p.prospect.genericEmail).length,
            added: newProspects.length,
            duplicatesSkipped,
            capabilityYield,
            locationYield,
        };

        await db.collection("vendor_prospecting_config").doc("default").set({
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

        logger.info(`[DailyVendorProspector] Done. Added ${newProspects.length} vendor prospects (${duplicatesSkipped} dupes skipped, ${totalDiscovered} discovered).`);
    } catch (err: any) {
        logger.error(`[DailyVendorProspector] Pipeline crashed:`, err.message || err);

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
        }).catch((e: any) => logger.error("[DailyVendorProspector] Failed to write error status:", e.message));

        throw err;
    }
}

// ── Scheduled trigger: 7 AM ET daily ────────────────────────────────

export const dailyVendorProspector = onSchedule({
    schedule: "0 7 * * *",  // 7:00 AM ET daily (1h after lead prospector)
    timeZone: "America/New_York",
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[DailyVendorProspector] Starting scheduled run...");
    await runDailyVendorPipeline();
});

// ── Manual trigger (onCall) for testing / on-demand runs ────────────

export const triggerDailyVendorProspector = onCall({
    cors: DASHBOARD_CORS,
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
}, async () => {
    logger.info("[DailyVendorProspector] Manual trigger invoked.");
    await runDailyVendorPipeline();
    return { message: "Daily vendor prospector pipeline completed." };
});

// ── Update vendor prospecting config (onCall) ───────────────────────

export const updateVendorProspectingConfig = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const data = request.data as Partial<VendorProspectingConfig>;

    const update: Record<string, any> = {};
    if (data.capabilities) update.capabilities = data.capabilities;
    if (data.locations) update.locations = data.locations;
    if (data.dailyTarget !== undefined) update.dailyTarget = data.dailyTarget;
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.excludePatterns) update.excludePatterns = data.excludePatterns;

    if (Object.keys(update).length === 0) {
        throw new HttpsError("invalid-argument", "No valid fields to update.");
    }

    await db.collection("vendor_prospecting_config").doc("default").set(update, { merge: true });
    logger.info("[updateVendorProspectingConfig] Config updated:", update);

    return { message: "Vendor prospecting config updated.", updated: update };
});

// ── Get vendor prospecting config (onCall) ──────────────────────────

export const getVendorProspectingConfig = onCall({
    cors: DASHBOARD_CORS,
}, async () => {
    const doc = await db.collection("vendor_prospecting_config").doc("default").get();
    if (doc.exists) {
        return doc.data();
    }
    // Seed default config
    await db.collection("vendor_prospecting_config").doc("default").set(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
});
