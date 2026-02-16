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
exports.verifyDocument = verifyDocument;
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const db = admin.firestore();
async function verifyDocument(docType, vendorName, specialty) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // Simulate OCR extraction based on the doc type
    // In a real app, this would be the output of a Vision API
    let simulatedOcrText = "";
    if (docType === 'COI') {
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);
        simulatedOcrText = `
            CERTIFICATE OF LIABILITY INSURANCE
            PRODUCER: State Farm Insurance
            INSURED: ${vendorName}
            
            COVERAGES:
            COMMERCIAL GENERAL LIABILITY
            EACH OCCURRENCE: $2,000,000
            DAMAGE TO RENTED PREMISES: $100,000
            MED EXP: $5,000
            PERSONAL & ADV INJURY: $2,000,000
            GENERAL AGGREGATE: $4,000,000
            
            WORKERS COMPENSATION
            STATUTORY LIMITS: YES
            E.L. EACH ACCIDENT: $1,000,000
            
            POLICY EFF: 01/01/2024
            POLICY EXP: ${nextYear.toLocaleDateString()}
        `;
    }
    else if (docType === 'W9') {
        simulatedOcrText = `
            Form W-9
            Name: ${vendorName}
            Business Name: ${vendorName} LLC
            Federal Tax Classification: Limited Liability Company
            Address: 123 Main St
            TIN: XX-XXX1234
            Signed: JS
            Date: 01/15/2024
        `;
    }
    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("document_verifier_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Document verifier prompt not found in database");
        }
        const template = templateDoc.data();
        const requirements = docType === 'COI'
            ? 'Must have General Liability > $1,000,000 and valid dates.'
            : 'Must be signed and have a TIN.';
        // Replace variables
        const prompt = template === null || template === void 0 ? void 0 : template.content.replace(/\{\{documentType\}\}/g, docType).replace(/\{\{vendorName\}\}/g, vendorName).replace(/\{\{specialty\}\}/g, specialty).replace(/\{\{requirements\}\}/g, requirements).replace(/\{\{ocrText\}\}/g, simulatedOcrText);
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("No JSON found in response");
        return JSON.parse(jsonMatch[0]);
    }
    catch (error) {
        console.error("AI Verification Failed:", error);
        return {
            valid: false,
            reasoning: "AI Verification Failed: " + error,
            extracted: {}
        };
    }
}
//# sourceMappingURL=documentVerifier.js.map