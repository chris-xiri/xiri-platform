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

    const prompt = `
    You are an expert procurement officer. Analyze the following list of vendors for the job query: "${jobQuery}".
    
    Context: ${modeDescription}
    
    For each vendor, calculate a Fit Score (0-100) based on these weighted factors:
    1. **Relevance (30%)**: Does the vendor explicitly offer services matching "${jobQuery}"?
    2. **Contact Info (30%)**: +15 points if Phone is present. +15 points if Email/Website indicates reachable contact.
    3. **Confidence (40%)**: How certain are you that they operate in the target service area and industry?
    
    Identify:
    - **Industry**: Specific category (e.g. Commercial Cleaning, HVAC).
    - **Business Type**: "Franchise" or "Independent". Favor "Independent" slightly in scoring if equal relevance.
    
    Return a JSON array where each object contains:
    - index: (original index)
    - specialty: (classified category)
    - businessType: ("Franchise" or "Independent")
    - fitScore: (calculated 0-100)
    - isQualified: (boolean, true if fitScore >= ${threshold})
    - reasoning: (short string explaining the score)
    
    Input List:
    ${JSON.stringify(rawVendors.map((v, i) => ({
        index: i,
        name: v.name || v.companyName,
        description: v.description || v.services,
        website: v.website,
        phone: v.phone
    })))}
    `;

    try {
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

                batch.set(vendorRef, newVendor);
            }
        }

        if (qualified > 0) {
            await batch.commit();
        }

    } catch (err: any) {
        errors.push(err.message);
    }

    return { analyzed, qualified, errors };
};
