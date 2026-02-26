import { GoogleGenerativeAI } from "@google/generative-ai";
import { admin, db } from "../utils/firebase";
import { Vendor, RecruitmentAnalysisResult } from "../utils/types";
import { parseAddress } from "../utils/emailUtils";
import { batchEnrichVendors, calculatePlacesSubScores } from "../utils/googlePlacesEnrichment";

// Normalize URL for comparison (strip protocol, www, trailing slash)
function normalizeUrl(url: string): string {
    if (!url) return '';
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').trim();
}

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export const analyzeVendorLeads = async (rawVendors: any[], jobQuery: string, hasActiveContract: boolean = false, previewOnly: boolean = false): Promise<RecruitmentAnalysisResult> => {
    console.log("!!! RECRUITER AGENT UPDATED - V4 (Robust Dedup + Blacklist) !!!");
    let analyzed = 0;
    let qualified = 0;
    const errors: string[] = [];
    const batch = db.batch();
    const previewVendors: Vendor[] = [];

    // We process in chunks if rawVendors is huge, but per prompt "db.batch() ... processing 50+ vendors"
    // Firestore batch limit is 500. We'll assume rawVendors length < 500 for this iteration or just one batch.

    // Construct the prompt
    // We will send vendors in a batch to Gemini to save tokens/time if possible, 
    // or iterate. The prompt implies "The function should accept a raw list... and use Gemini to Classify".
    // Doing it one by one might be slow, doing all at once might hit token limits. 
    // Let's do a simple loop for now as it's safer for "Classify: Identify if the vendor...". 
    // Actually, passing the whole list is better for 50 items.

    if (rawVendors.length === 0) return { analyzed, qualified, errors };

    // Determine strictness based on contract status
    // Building Supply (hasActiveContract = false) -> Accept All (0 threshold)
    // Urgent (hasActiveContract = true) -> Strict (50 threshold)
    const threshold = hasActiveContract ? 50 : 0;
    const modeDescription = hasActiveContract
        ? "URGENT FULFILLMENT: We need high-quality vendors ready to deploy. Be strict."
        : "DATABASE BUILDING: We are building a supply list. ACCEPT ALL VENDORS. Do not filter. Score is for reference only.";

    // List to process, defaults to rawVendors if deduplication fails or isn't run
    let vendorsToAnalyze = rawVendors;
    let prompt = "";

    try {
        // Build dismissed vendor identifiers (name, phone, website) for robust blacklist matching
        let dismissedNames = new Set<string>();
        let dismissedPhones = new Set<string>();
        let dismissedWebsites = new Set<string>();
        try {
            const dismissedSnapshot = await db.collection('dismissed_vendors').get();
            if (!dismissedSnapshot.empty) {
                for (const doc of dismissedSnapshot.docs) {
                    const d = doc.data();
                    if (d.businessName) dismissedNames.add(d.businessName.toLowerCase().trim());
                    if (d.phone) dismissedPhones.add(d.phone.replace(/\D/g, '')); // digits only
                    if (d.website) dismissedWebsites.add(normalizeUrl(d.website));
                }
                console.log(`Loaded ${dismissedNames.size} dismissed vendor names, ${dismissedPhones.size} phones, ${dismissedWebsites.size} websites.`);
            }
        } catch (dismissErr: any) {
            console.warn("Could not check dismissed_vendors:", dismissErr.message);
        }

        // ─── Pre-process: Dedup against existing vendors + Blacklist ─────────────
        // We check by: (1) case-insensitive name, (2) phone number, (3) website
        const vendorsToProcess: any[] = [];
        const duplicateUpdates: Promise<any>[] = [];

        // Pre-load ALL existing vendor identifiers for fast matching
        let existingByNameLower = new Map<string, string>(); // normalized name -> docId
        let existingByPhone = new Map<string, string>();     // digits-only phone -> docId
        let existingByWebsite = new Map<string, string>();   // normalized url -> docId
        try {
            const existingSnap = await db.collection('vendors').select('businessName', 'businessNameLower', 'phone', 'website').get();
            for (const doc of existingSnap.docs) {
                const data = doc.data();
                const nameLower = (data.businessNameLower || data.businessName || '').toLowerCase().trim();
                if (nameLower) existingByNameLower.set(nameLower, doc.id);
                if (data.phone) existingByPhone.set(data.phone.replace(/\D/g, ''), doc.id);
                if (data.website) existingByWebsite.set(normalizeUrl(data.website), doc.id);
            }
            console.log(`Loaded ${existingByNameLower.size} existing vendors for dedup (names: ${existingByNameLower.size}, phones: ${existingByPhone.size}, websites: ${existingByWebsite.size}).`);
        } catch (err: any) {
            console.warn("Could not pre-load vendors for dedup:", err.message);
        }

        console.log(`Checking ${rawVendors.length} vendors for duplicates and blacklist...`);

        for (const vendor of rawVendors) {
            const bName = vendor.name || vendor.companyName || vendor.title || '';
            const bNameLower = bName.toLowerCase().trim();
            const bPhone = (vendor.phone || '').replace(/\D/g, '');
            const bWebsite = normalizeUrl(vendor.website || '');

            // ── Blacklist check (name, phone, or website) ──
            const isBlacklisted =
                (bNameLower && dismissedNames.has(bNameLower)) ||
                (bPhone && bPhone.length >= 7 && dismissedPhones.has(bPhone)) ||
                (bWebsite && dismissedWebsites.has(bWebsite));

            if (isBlacklisted) {
                console.log(`⛔ Blacklisted vendor skipped: ${bName}`);
                continue; // Completely skip blacklisted vendors
            }

            // ── Dedup check (case-insensitive name, phone, or website) ──
            const existingDocId =
                (bNameLower && existingByNameLower.get(bNameLower)) ||
                (bPhone && bPhone.length >= 7 && existingByPhone.get(bPhone)) ||
                (bWebsite && existingByWebsite.get(bWebsite)) ||
                null;

            if (existingDocId) {
                console.log(`🔁 Duplicate vendor skipped: ${bName} (matches ${existingDocId})`);
                duplicateUpdates.push(
                    db.collection('vendors').doc(existingDocId).update({
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    })
                );
            } else {
                vendorsToProcess.push(vendor);
            }
        }

        // Execute duplicate updates
        if (duplicateUpdates.length > 0) {
            await Promise.all(duplicateUpdates);
            console.log(`Updated ${duplicateUpdates.length} existing vendors.`);
        }

        if (vendorsToProcess.length === 0) {
            console.log("All vendors were duplicates or blacklisted. Sourcing complete.");
            return { analyzed, qualified, errors };
        }

        // Continue with unique vendors
        vendorsToAnalyze = vendorsToProcess;

        // Fetch prompt from database
        const templateDoc = await db.collection("prompts").doc("recruiter_analysis_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Recruiter analysis prompt not found in database (prompts/recruiter_analysis_prompt)");
        }

        const template = templateDoc.data();
        // ─── Google Places Enrichment ─────────────────────────────
        const vendorsForEnrichment = vendorsToAnalyze.map((v, i) => ({
            name: v.name || v.companyName || v.title || '',
            address: v.location || v.address || v.vicinity || '',
            index: i,
        }));

        console.log(`Starting Google Places enrichment for ${vendorsForEnrichment.length} vendors...`);
        const placesData = await batchEnrichVendors(vendorsForEnrichment);
        console.log(`Google Places enrichment complete: ${placesData.size}/${vendorsForEnrichment.length} matched.`);

        const vendorList = JSON.stringify(vendorsToAnalyze.map((v, i) => {
            const places = placesData.get(i);
            return {
                index: i,
                name: v.name || v.companyName,
                description: v.description || v.services,
                address: v.location || v.address || v.vicinity,
                website: v.website,
                phone: v.phone,
                // Google Places enrichment
                googleRating: places?.rating || null,
                googleReviewCount: places?.ratingCount || null,
                googleTypes: places?.types?.slice(0, 5) || [],
                isEstablished: places?.isEstablished || false,
                isHighlyRated: places?.isHighlyRated || false,
            };
        }));

        // Replace variables
        prompt = template?.content
            .replace(/\{\{query\}\}/g, jobQuery)
            .replace(/\{\{modeDescription\}\}/g, modeDescription)
            .replace(/\{\{threshold\}\}/g, threshold.toString())
            .replace(/\{\{vendorList\}\}/g, vendorList);

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log("Gemini Raw Response:", text); // Debug log

        // Naive JSON clean up
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonStr) as any[];

        analyzed = analysis.length;

        for (const item of analysis) {
            if (item.isQualified || threshold === 0) {
                qualified++;
                // Ensure index matches the filtered list
                const originalVendor = vendorsToAnalyze[item.index];
                if (!originalVendor) {
                    console.warn(`Analysis returned index ${item.index} but we only have ${vendorsToAnalyze.length} vendors.`);
                    continue;
                }

                // Fallback for business name
                const bName = originalVendor.name || originalVendor.companyName || originalVendor.title || "Unknown Vendor";

                const vendorRef = db.collection('vendors').doc(); // Auto-ID
                const rawAddr = originalVendor.location || item.address || "Unknown";
                const parsed = parseAddress(rawAddr);
                // Build Google Places data for persistence
                const placesEnrichment = placesData.get(item.index);
                const placesSubScores = calculatePlacesSubScores(placesEnrichment || null);

                const newVendor: Vendor = {
                    id: vendorRef.id,
                    businessName: bName,
                    businessNameLower: bName.toLowerCase().trim(),
                    capabilities: item.services || (item.primarySpecialty ? [item.primarySpecialty] : (item.specialty ? [item.specialty] : [])),
                    specialty: item.primarySpecialty || item.specialty || item.services?.[0] || undefined,
                    contactName: item.contactName || undefined,
                    address: rawAddr,
                    streetAddress: parsed.streetAddress || undefined,
                    city: item.city || parsed.city || undefined,
                    state: item.state || parsed.state || undefined,
                    zip: item.zip || parsed.zip || undefined,
                    country: item.country || "USA",
                    phone: placesEnrichment?.phone || originalVendor.phone || item.phone || undefined,
                    email: originalVendor.email || item.email || undefined,
                    website: placesEnrichment?.website || originalVendor.website || item.website || undefined,
                    dcaCategory: originalVendor.dcaCategory || undefined,
                    fitScore: item.fitScore,
                    aiReasoning: item.reasoning || undefined,
                    hasActiveContract: hasActiveContract,
                    onboardingTrack: hasActiveContract ? 'FAST_TRACK' : 'STANDARD',
                    status: 'pending_review',
                    // Google Places enrichment (persisted)
                    googlePlaces: placesEnrichment ? {
                        placeId: placesEnrichment.placeId,
                        name: placesEnrichment.name,
                        rating: placesEnrichment.rating,
                        ratingCount: placesEnrichment.ratingCount,
                        phone: placesEnrichment.phone,
                        website: placesEnrichment.website,
                        types: placesEnrichment.types,
                        openNow: placesEnrichment.openNow,
                        googleMapsUrl: placesEnrichment.googleMapsUrl,
                        enrichedAt: admin.firestore.FieldValue.serverTimestamp(),
                    } : undefined,
                    // Fit score breakdown
                    fitScoreBreakdown: {
                        googleReputation: placesSubScores.googleReputation,
                        serviceAlignment: item.serviceAlignmentScore || 50,
                        locationScore: item.locationScore || 50,
                        businessMaturity: placesSubScores.businessMaturity,
                        websiteQuality: placesSubScores.websiteQuality,
                    },
                    rating: placesEnrichment?.rating || undefined,
                    totalRatings: placesEnrichment?.ratingCount || undefined,
                    createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp() as any
                };

                console.log(`Adding qualified vendor to batch: ${newVendor.businessName}`);
                if (previewOnly) {
                    // Tag as dismissed if in blacklist
                    const isDismissed = dismissedNames.has((newVendor.businessName || '').toLowerCase().trim());
                    previewVendors.push({ ...newVendor, isDismissed } as any);
                } else {
                    batch.set(vendorRef, newVendor);
                }
            }
        }

        if (qualified > 0 && !previewOnly) {
            console.log(`Committing batch of ${qualified} vendors...`);
            await batch.commit();
            console.log("Batch commit successful.");
        } else if (previewOnly) {
            console.log(`Preview mode: ${qualified} vendors ready for review (not saved).`);
        } else {
            console.log("No qualified vendors to commit.");
        }

    } catch (err: any) {
        console.error("AI Analysis Failed:", err.message);
        console.error("Prompt used:", prompt); // Log the prompt to debug formatting issues
        errors.push(err.message);

        // Fallback: Save vendors without analysis if AI fails
        console.log("Saving raw vendors with 'pending_review' status due to AI failure...");

        for (const originalVendor of vendorsToAnalyze) {
            const vendorRef = db.collection('vendors').doc();
            // Fallback for business name: Use 'name' or 'companyName' or 'title' from raw source
            const bName = originalVendor.name || originalVendor.companyName || originalVendor.title || "Unknown Vendor";

            const rawAddr = originalVendor.location || originalVendor.address || "Unknown";
            const parsed = parseAddress(rawAddr);
            const newVendor: Vendor = {
                id: vendorRef.id,
                businessName: bName,
                capabilities: [],
                address: rawAddr,
                streetAddress: parsed.streetAddress || undefined,
                city: parsed.city || undefined,
                state: parsed.state || undefined,
                zip: parsed.zip || undefined,
                phone: originalVendor.phone || undefined,
                email: originalVendor.email || undefined,
                website: originalVendor.website || undefined,
                dcaCategory: originalVendor.dcaCategory || undefined,
                fitScore: 0,
                status: 'pending_review',
                hasActiveContract: hasActiveContract,
                onboardingTrack: hasActiveContract ? 'FAST_TRACK' : 'STANDARD',
                aiReasoning: `AI Analysis Failed: ${err.message}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
                updatedAt: admin.firestore.FieldValue.serverTimestamp() as any
            };
            batch.set(vendorRef, newVendor);
            if (previewOnly) {
                previewVendors.push(newVendor);
            }
            qualified++;
        }

        if (qualified > 0 && !previewOnly) {
            console.log(`Committing batch of ${qualified} fallback vendors...`);
            await batch.commit();
        }
    }

    return { analyzed, qualified, errors, vendors: previewOnly ? previewVendors : undefined };
};
