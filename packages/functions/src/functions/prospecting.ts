import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { prospectAndEnrich } from "../agents/prospector";
import type { EnrichedProspect } from "@xiri/shared";
import { inferFacilityType } from "@xiri/shared";

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
// Now creates multiple contacts per company from allContacts (Hunter/Snov).
export const addProspectsToCrm = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const { prospects, searchQuery: batchSearchQuery } = request.data as { prospects: (EnrichedProspect & { searchQuery?: string })[]; searchQuery?: string };

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
        throw new HttpsError("invalid-argument", "No prospects provided.");
    }

    try {
        const results: { companyId: string; contactId?: string; contactIds: string[]; businessName: string }[] = [];
        const batch = db.batch();

        for (const prospect of prospects) {
            // Infer facility type from the individual searchQuery or batch-level searchQuery
            const facilityType = inferFacilityType(prospect.searchQuery || batchSearchQuery) || null;

            // 1. Create Company
            const companyRef = db.collection("companies").doc();
            batch.set(companyRef, {
                name: prospect.businessName,
                businessName: prospect.businessName,
                address: prospect.address || null,
                phone: prospect.phone || null,
                website: prospect.website || null,
                facebookUrl: prospect.facebookUrl || null,
                linkedinUrl: prospect.linkedinUrl || null,
                rating: prospect.rating || null,
                facilityType,
                source: 'prospector',
                emailSource: prospect.emailSource,
                emailConfidence: prospect.emailConfidence,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // 2. Create Contacts — one per unique email from allContacts + primary
            const contactIds: string[] = [];
            const seenEmails = new Set<string>();

            // Build a merged contact list: primary first, then allContacts
            const contactsToCreate: Array<{
                email: string;
                name?: string;
                title?: string;
                isGeneric: boolean;
                confidence?: number;
                provider?: string;
            }> = [];

            // Primary contact email
            const primaryEmail = prospect.contactEmail || prospect.genericEmail;
            if (primaryEmail) {
                const isGeneric = !prospect.contactEmail ||
                    /^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i.test(prospect.contactEmail);
                contactsToCreate.push({
                    email: primaryEmail.toLowerCase(),
                    name: prospect.contactName || (isGeneric ? prospect.businessName : undefined),
                    title: prospect.contactTitle || undefined,
                    isGeneric,
                });
                seenEmails.add(primaryEmail.toLowerCase());
            }

            // Additional contacts from Hunter/Snov enrichment
            if (prospect.allContacts && Array.isArray(prospect.allContacts)) {
                for (const c of prospect.allContacts) {
                    if (!c.email || seenEmails.has(c.email.toLowerCase())) continue;
                    seenEmails.add(c.email.toLowerCase());

                    const isGeneric = c.type === 'generic' ||
                        /^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i.test(c.email);
                    const name = (c.firstName && c.lastName)
                        ? `${c.firstName} ${c.lastName}`
                        : c.firstName || undefined;

                    contactsToCreate.push({
                        email: c.email.toLowerCase(),
                        name: name || (isGeneric ? prospect.businessName : undefined),
                        title: c.position || undefined,
                        isGeneric,
                        confidence: c.confidence,
                        provider: c.provider,
                    });
                }
            }

            // Write all contacts to Firestore
            for (const contact of contactsToCreate) {
                const contactRef = db.collection("contacts").doc();
                contactIds.push(contactRef.id);

                batch.set(contactRef, {
                    name: contact.name || prospect.businessName,
                    email: contact.email,
                    phone: prospect.phone || null,
                    title: contact.title || null,
                    companyId: companyRef.id,
                    companyName: prospect.businessName,
                    isGenericEmail: contact.isGeneric,
                    source: 'prospector',
                    status: 'new',
                    stage: 'lead',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            results.push({
                companyId: companyRef.id,
                contactId: contactIds[0],  // Primary contact for backwards compat (email/sequence triggers)
                contactIds,                // All created contacts
                businessName: prospect.businessName,
            });
        }

        await batch.commit();

        const totalContacts = results.reduce((sum, r) => sum + r.contactIds.length, 0);
        console.log(`[addProspectsToCrm] Created ${results.length} companies + ${totalContacts} contacts.`);

        return {
            message: `Successfully imported ${results.length} prospects to CRM (${totalContacts} contacts total).`,
            imported: results.length,
            totalContacts,
            results,
        };
    } catch (error: any) {
        console.error("[addProspectsToCrm] Error:", error);
        throw new HttpsError("internal", error.message || "CRM import failed.");
    }
});
