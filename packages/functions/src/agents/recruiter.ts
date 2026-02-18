import { GoogleGenerativeAI } from "@google/generative-ai";
import { admin, db } from "../utils/firebase";
import { Vendor, RecruitmentAnalysisResult } from "../utils/types";

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export const analyzeVendorLeads = async (rawVendors: any[], jobQuery: string, hasActiveContract: boolean = false, previewOnly: boolean = false): Promise<RecruitmentAnalysisResult> => {
    console.log("!!! RECRUITER AGENT UPDATED - V3 (Deduplication) !!!");
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
        // Build dismissed vendor name set (for tagging, not filtering)
        let dismissedNames = new Set<string>();
        try {
            const dismissedSnapshot = await db.collection('dismissed_vendors').get();
            if (!dismissedSnapshot.empty) {
                dismissedNames = new Set(
                    dismissedSnapshot.docs.map(doc => (doc.data().businessName || '').toLowerCase().trim())
                );
                console.log(`Loaded ${dismissedNames.size} dismissed vendor names for tagging.`);
            }
        } catch (dismissErr: any) {
            console.warn("Could not check dismissed_vendors:", dismissErr.message);
        }

        // Pre-process for duplicates (against existing vendors collection)
        const vendorsToProcess: any[] = [];
        const duplicateUpdates: Promise<any>[] = [];

        console.log(`Checking ${rawVendors.length} vendors for duplicates...`);

        for (const vendor of rawVendors) {
            const bName = vendor.name || vendor.companyName || vendor.title;
            if (!bName) {
                vendorsToProcess.push(vendor);
                continue;
            }

            // Check if exists
            const existingSnapshot = await db.collection('vendors')
                .where('businessName', '==', bName)
                .limit(1)
                .get();

            if (!existingSnapshot.empty) {
                const docId = existingSnapshot.docs[0].id;
                console.log(`Found existing vendor: ${bName} (${docId}). Updating timestamp.`);
                duplicateUpdates.push(
                    db.collection('vendors').doc(docId).update({
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
            console.log("All vendors were duplicates or dismissed. Sourcing complete.");
            return { analyzed, qualified, errors };
        }

        // Continue with unique vendors
        vendorsToAnalyze = vendorsToProcess;

        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("recruiter_analysis_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Recruiter analysis prompt not found in database");
        }

        const template = templateDoc.data();
        const vendorList = JSON.stringify(vendorsToAnalyze.map((v, i) => ({
            index: i,
            name: v.name || v.companyName,
            description: v.description || v.services,
            address: v.location || v.address || v.vicinity, // Google Places often uses 'vicinity'
            website: v.website,
            phone: v.phone
        })));

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
            if (item.isQualified) {
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
                const newVendor: Vendor = {
                    id: vendorRef.id,
                    businessName: bName,
                    capabilities: item.specialty ? [item.specialty] : [],
                    address: originalVendor.location || item.address || "Unknown",
                    city: item.city || undefined,
                    state: item.state || undefined,
                    zip: item.zip || undefined,
                    country: item.country || "USA",
                    phone: originalVendor.phone || item.phone || undefined,
                    email: originalVendor.email || item.email || undefined,
                    website: originalVendor.website || item.website || undefined,
                    // businessType: item.businessType || "Unknown", // Removing as it's not in shared Vendor? Wait, checking shared
                    fitScore: item.fitScore,
                    hasActiveContract: hasActiveContract,
                    onboardingTrack: hasActiveContract ? 'FAST_TRACK' : 'STANDARD',
                    status: 'pending_review',
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

            const newVendor: Vendor = {
                id: vendorRef.id,
                businessName: bName,
                capabilities: [],
                address: originalVendor.location || originalVendor.address || "Unknown",
                phone: originalVendor.phone || undefined,
                email: originalVendor.email || undefined,
                website: originalVendor.website || undefined,
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
