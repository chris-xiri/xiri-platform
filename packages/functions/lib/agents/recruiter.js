"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeVendorLeads = void 0;
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const analyzeVendorLeads = async (rawVendors, hasActiveContract = false) => {
    let analyzed = 0;
    let qualified = 0;
    const errors = [];
    const batch = db.batch();
    // We process in chunks if rawVendors is huge, but per prompt "db.batch() ... processing 50+ vendors"
    // Firestore batch limit is 500. We'll assume rawVendors length < 500 for this iteration or just one batch.
    // Construct the prompt
    // We will send vendors in a batch to Gemini to save tokens/time if possible, 
    // or iterate. The prompt implies "The function should accept a raw list... and use Gemini to Classify".
    // Doing it one by one might be slow, doing all at once might hit token limits. 
    // Let's do a simple loop for now as it's safer for "Classify: Identify if the vendor...". 
    // Actually, passing the whole list is better for 50 items.
    if (rawVendors.length === 0)
        return { analyzed, qualified, errors };
    const prompt = `
    You are an expert procurement officer. Analyze the following list of vendors.
    
    For each vendor, identify:
    1. Industry/Category (e.g. Commercial Cleaning, HVAC, Plumbing)
    2. Fit Score (0-100) based on relevance to "Commercial Cleaning", "Medical Cleaning", "Terminal Cleaning", "High-End Office".
    3. Business Type: Infer if it is a "Franchise" (e.g. Jan-Pro, Jani-King, ServiceMaster, Vanguard) or "Independent" (LLC, Inc, Mom & Pop). Favor "Independent".
    
    Target Keywords for High Score: "Medical", "Terminal Cleaning", "High-End Office".
    Franchises should have a slightly lower score unless they explicitly mention medical specialization.
    
    Return a JSON array where each object contains:
    - index: (original index in the list)
    - specialty: (classified category)
    - businessType: ("Franchise" or "Independent")
    - fitScore: (number 0-100)
    - isQualified: (boolean, true if fitScore >= 40)
    
    Input List:
    ${JSON.stringify(rawVendors.map((v, i) => ({
        index: i,
        name: v.name || v.companyName,
        description: v.description || v.services,
        website: v.website
    })))}
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        // Naive JSON clean up
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonStr);
        analyzed = analysis.length;
        for (const item of analysis) {
            if (item.isQualified) {
                qualified++;
                const originalVendor = rawVendors[item.index];
                const vendorRef = db.collection('vendors').doc(); // Auto-ID
                const newVendor = {
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
    }
    catch (err) {
        errors.push(err.message);
    }
    return { analyzed, qualified, errors };
};
exports.analyzeVendorLeads = analyzeVendorLeads;
//# sourceMappingURL=recruiter.js.map