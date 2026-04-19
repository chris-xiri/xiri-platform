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
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY", "HUNTER_API_KEY"],
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
// Now creates multiple contacts per company from allContacts (Hunter).
export const addProspectsToCrm = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 60,
}, async (request) => {
    const { prospects, searchQuery: batchSearchQuery } = request.data as { prospects: (EnrichedProspect & { searchQuery?: string; facilityType?: string })[]; searchQuery?: string };

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
        throw new HttpsError("invalid-argument", "No prospects provided.");
    }

    try {
        const results: { companyId: string; contactId?: string; contactIds: string[]; businessName: string }[] = [];
        const batch = db.batch();

        for (const prospect of prospects) {
            // Use explicitly-set facilityType first, then infer from searchQuery
            const facilityType = prospect.facilityType || inferFacilityType(prospect.searchQuery || batchSearchQuery) || null;

            // 1. Create Company
            const companyRef = db.collection("companies").doc();
            batch.set(companyRef, {
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

            // Additional contacts from Hunter enrichment
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
            for (let index = 0; index < contactsToCreate.length; index++) {
                const contact = contactsToCreate[index];
                const contactRef = db.collection("contacts").doc();
                contactIds.push(contactRef.id);
                const parsedName = contact.name ? contact.name.trim().split(/\s+/) : [];
                const firstName = parsedName[0] || '';
                const lastName = parsedName.length > 1 ? parsedName.slice(1).join(' ') : '';
                const shouldActivate = index === 0 || (!!contact.confidence && contact.confidence >= 85 && !contact.isGeneric);
                const lifecycleStatus = shouldActivate ? 'active' : 'review';

                batch.set(contactRef, {
                    name: contact.name || prospect.businessName,
                    firstName,
                    lastName,
                    email: contact.email,
                    phone: prospect.phone || null,
                    title: contact.title || null,
                    role: contact.title || null,
                    companyId: companyRef.id,
                    companyName: prospect.businessName,
                    isGenericEmail: contact.isGeneric,
                    isPrimary: index === 0,
                    lifecycleStatus,
                    lifecycleReason: lifecycleStatus === 'review' ? 'prospector_additional_contact' : null,
                    reviewReasons: lifecycleStatus === 'review' ? ['prospector_additional_contact'] : [],
                    emailStatus: 'unknown',
                    suppressionReason: null,
                    validationSource: 'import',
                    lastValidatedAt: new Date(),
                    duplicateOfContactId: null,
                    unsubscribed: false,
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

// ── Auto-Expand County to Towns ──
// Uses Gemini to break a county or region into a list of specific towns/cities.
export const expandLocation = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 30,
}, async (request) => {
    const data = request.data || {};
    const location = data.location as string;

    if (!location) {
        throw new HttpsError("invalid-argument", "Missing 'location'.");
    }

    try {
        console.log(`[expandLocation] Bursting location: "${location}"...`);

        const prompt = `List the 25 most prominent and populated towns or cities inside: ${location}. Return ONLY a JSON array of strings formatted exactly like ["Mineola, NY", "Garden City, NY"]. Do not return markdown, do not return backticks. Just the raw array. Ensure the state abbreviation is included.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const resData = await response.json();
        let textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
        
        // Strip markdown backticks if any
        textResponse = textResponse.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();

        const towns = JSON.parse(textResponse);
        return { towns };
    } catch (error: any) {
        console.error("[expandLocation] Error:", error);
        throw new HttpsError("internal", error.message || "Failed to expand location.");
    }
});
