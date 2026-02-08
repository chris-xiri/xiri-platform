import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";
import { Vendor, RecruitmentAnalysisResult } from "../utils/types";

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const analyzeVendorLeads = async (rawVendors: any[], jobQuery: string, hasActiveContract: boolean = false): Promise<RecruitmentAnalysisResult> => {
    let analyzed = 0;
    let qualified = 0;
    const errors: string[] = [];
    const batch = db.batch();

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

    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("recruiter_analysis_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Recruiter analysis prompt not found in database");
        }

        const template = templateDoc.data();
        const vendorList = JSON.stringify(rawVendors.map((v, i) => ({
            index: i,
            name: v.name || v.companyName,
            description: v.description || v.services,
            website: v.website,
            phone: v.phone
        })));

        // Replace variables
        const prompt = template?.content
            .replace(/\{\{query\}\}/g, jobQuery)
            .replace(/\{\{modeDescription\}\}/g, modeDescription)
            .replace(/\{\{threshold\}\}/g, threshold.toString())
            .replace(/\{\{vendorList\}\}/g, vendorList);

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Naive JSON clean up
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonStr) as any[];

        analyzed = analysis.length;

        for (const item of analysis) {
            if (item.isQualified) {
                qualified++;
                const originalVendor = rawVendors[item.index];

                const vendorRef = db.collection('vendors').doc(); // Auto-ID
                const newVendor: Vendor = {
                    id: vendorRef.id,
                    companyName: originalVendor.name || originalVendor.companyName,
                    specialty: item.specialty,
                    location: originalVendor.location || "Unknown",
                    phone: originalVendor.phone || null,
                    email: originalVendor.email || null, // Ensure email is passed if sourced
                    website: originalVendor.website || null,
                    businessType: item.businessType || "Unknown",
                    fitScore: item.fitScore,
                    hasActiveContract: hasActiveContract, // Use the passed parameter
                    status: 'PENDING_REVIEW', // or 'SCRAPED' depending on workflow
                    createdAt: new Date()
                };

                console.log(`Adding qualified vendor to batch: ${newVendor.companyName}`);
                batch.set(vendorRef, newVendor);
            }
        }

        if (qualified > 0) {
            console.log(`Committing batch of ${qualified} vendors...`);
            await batch.commit();
            console.log("Batch commit successful.");
        } else {
            console.log("No qualified vendors to commit.");
        }

    } catch (err: any) {
        errors.push(err.message);
    }

    return { analyzed, qualified, errors };
};
