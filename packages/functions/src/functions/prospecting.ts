import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { prospectAndEnrich } from "../agents/prospector";
import type { EnrichedProspect } from "@xiri/shared";

// ── Prospect & Enrich ──
// Runs the full multi-source enrichment pipeline:
//   Discovery → Scraping → Web Search → Paid API Waterfall
export const runProspector = onCall({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY", "SNOV_USER_ID", "SNOV_API_SECRET"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 540,  // 9 minutes — some enrichment steps are slow
    memory: "512MiB",
}, async (request) => {
    const data = request.data || {};
    const query = data.query as string;
    const location = data.location as string;
    const maxResults = data.maxResults as number || 20;
    const skipPaidApis = data.skipPaidApis as boolean || false;

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location'.");
    }

    try {
        console.log(`[runProspector] query="${query}", location="${location}", max=${maxResults}, skipPaid=${skipPaidApis}`);

        const result = await prospectAndEnrich(
            { query, location, maxResults, skipPaidApis },
            {
                geminiApiKey: process.env.GEMINI_API_KEY!,
                serperApiKey: process.env.SERPER_API_KEY!,
                hunterApiKey: process.env.HUNTER_API_KEY,
                snovUserId: process.env.SNOV_USER_ID,
                snovApiSecret: process.env.SNOV_API_SECRET,
            }
        );

        return {
            message: `Found ${result.prospects.length} prospects.`,
            prospects: result.prospects,
            stats: result.stats,
        };
    } catch (error: any) {
        console.error("[runProspector] Error:", error);
        throw new HttpsError("internal", error.message || "Pipeline failed.");
    }
});

// ── Add Prospects to CRM ──
// Creates Company + Contact records for selected prospects.
export const addProspectsToCrm = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const { prospects } = request.data as { prospects: EnrichedProspect[] };

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
        throw new HttpsError("invalid-argument", "No prospects provided.");
    }

    try {
        const results: { companyId: string; contactId?: string; businessName: string }[] = [];
        const batch = db.batch();

        for (const prospect of prospects) {
            // 1. Create Company
            const companyRef = db.collection("companies").doc();
            batch.set(companyRef, {
                name: prospect.businessName,
                address: prospect.address || null,
                phone: prospect.phone || null,
                website: prospect.website || null,
                facebookUrl: prospect.facebookUrl || null,
                linkedinUrl: prospect.linkedinUrl || null,
                rating: prospect.rating || null,
                source: 'prospector',
                emailSource: prospect.emailSource,
                emailConfidence: prospect.emailConfidence,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // 2. Create Contact (if we have any email)
            const email = prospect.contactEmail || prospect.genericEmail;
            let contactId: string | undefined;

            if (email) {
                const contactRef = db.collection("contacts").doc();
                contactId = contactRef.id;

                const isGeneric = !prospect.contactEmail ||
                    /^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i.test(prospect.contactEmail);

                batch.set(contactRef, {
                    name: prospect.contactName || prospect.businessName,
                    email: email,
                    phone: prospect.phone || null,
                    title: prospect.contactTitle || null,
                    companyId: companyRef.id,
                    companyName: prospect.businessName,
                    isGenericEmail: isGeneric,
                    source: 'prospector',
                    status: 'new',
                    stage: 'lead',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            results.push({
                companyId: companyRef.id,
                contactId,
                businessName: prospect.businessName,
            });
        }

        await batch.commit();
        console.log(`[addProspectsToCrm] Created ${results.length} companies + contacts.`);

        return {
            message: `Successfully imported ${results.length} prospects to CRM.`,
            imported: results.length,
            results,
        };
    } catch (error: any) {
        console.error("[addProspectsToCrm] Error:", error);
        throw new HttpsError("internal", error.message || "CRM import failed.");
    }
});
