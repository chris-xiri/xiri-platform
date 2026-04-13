/**
 * Vendor Prospecting — Cloud Functions Endpoints
 *
 * Counterpart to functions/prospecting.ts but for vendor/contractor discovery.
 * Provides:
 *   - runVendorProspector:      On-demand vendor search + enrichment
 *   - addVendorProspectsToCrm:  Import selected vendor prospects to vendors collection
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { vendorProspectAndEnrich } from "../agents/vendorProspector";
import type { EnrichedProspect } from "@xiri/shared";

// ── Run Vendor Prospector (on-demand) ──
// Runs the full multi-source vendor enrichment pipeline for a single query.
export const runVendorProspector = onCall({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 540,
    memory: "512MiB",
}, async (request) => {
    const data = request.data || {};
    const query = data.query as string;
    const location = data.location as string;
    const capability = data.capability as string;
    const maxResults = data.maxResults as number || 20;
    const skipPaidApis = data.skipPaidApis as boolean || false;

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location'.");
    }

    if (!capability) {
        throw new HttpsError("invalid-argument", "Missing 'capability' (e.g. 'plumbing', 'hvac').");
    }

    try {
        console.log(`[runVendorProspector] query="${query}", location="${location}", capability="${capability}", max=${maxResults}`);

        const result = await vendorProspectAndEnrich(
            { query, location, capability, maxResults, skipPaidApis },
            {
                geminiApiKey: process.env.GEMINI_API_KEY!,
                serperApiKey: process.env.SERPER_API_KEY!,
                hunterApiKey: process.env.HUNTER_API_KEY,
            }
        );

        return {
            message: `Found ${result.prospects.length} vendor prospects.`,
            prospects: result.prospects,
            stats: result.stats,
        };
    } catch (error: any) {
        console.error("[runVendorProspector] Error:", error);
        throw new HttpsError("internal", error.message || "Vendor prospecting pipeline failed.");
    }
});

// ── Add Vendor Prospects to CRM ──
// Creates Vendor records for selected prospects with capability tagging.
export const addVendorProspectsToCrm = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const { prospects, searchCapability } = request.data as {
        prospects: (EnrichedProspect & {
            searchQuery?: string;
            searchCapability?: string;
            detectedCapabilities?: string[];
            facebookUrl?: string;
        })[];
        searchCapability?: string;
    };

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
        throw new HttpsError("invalid-argument", "No vendor prospects provided.");
    }

    try {
        const results: { vendorId: string; businessName: string }[] = [];
        const batch = db.batch();

        for (const prospect of prospects) {
            const capability = prospect.searchCapability || searchCapability || 'other';

            // Create Vendor record
            const vendorRef = db.collection("vendors").doc();
            batch.set(vendorRef, {
                businessName: prospect.businessName,
                address: prospect.address || null,
                city: null,  // Can be parsed from address later
                state: null, // Can be parsed from address later
                phone: prospect.phone || null,
                email: prospect.contactEmail || prospect.genericEmail || null,
                website: prospect.website || null,
                facebookUrl: prospect.facebookUrl || null,
                linkedinUrl: prospect.linkedinUrl || null,
                rating: prospect.rating || null,

                // Capability data
                capabilities: prospect.detectedCapabilities || [capability],
                primaryCapability: capability,

                // Enrichment metadata
                emailSource: prospect.emailSource,
                emailConfidence: prospect.emailConfidence,

                // Contact info
                contactName: prospect.contactName || null,
                contactTitle: prospect.contactTitle || null,

                // All discovered contacts
                allContacts: prospect.allContacts || [],

                // Pipeline
                source: 'vendor_prospector',
                status: 'new',
                onboardingComplete: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            results.push({
                vendorId: vendorRef.id,
                businessName: prospect.businessName,
            });

            // Also update the prospect_queue entry to mark as approved (if it exists)
            // We search by businessName since we don't have the docId
            // This is best-effort — the queue entry may have been created by the daily pipeline
        }

        await batch.commit();

        console.log(`[addVendorProspectsToCrm] Created ${results.length} vendor records.`);

        return {
            message: `Successfully imported ${results.length} vendor prospects.`,
            imported: results.length,
            results,
        };
    } catch (error: any) {
        console.error("[addVendorProspectsToCrm] Error:", error);
        throw new HttpsError("internal", error.message || "Vendor CRM import failed.");
    }
});
