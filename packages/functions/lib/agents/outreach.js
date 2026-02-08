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
exports.analyzeIncomingMessage = exports.generateOutreachContent = void 0;
const generative_ai_1 = require("@google/generative-ai");
const admin = __importStar(require("firebase-admin"));
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const db = admin.firestore();
const generateOutreachContent = async (vendor, preferredChannel) => {
    const isUrgent = vendor.hasActiveContract;
    const channel = preferredChannel;
    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("outreach_generation_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Outreach generation prompt not found in database");
        }
        const template = templateDoc.data();
        const campaignContext = isUrgent
            ? "URGENT JOB OPPORTUNITY (We have a contract ready)"
            : "Building Supply Network (Partnership Opportunity)";
        // Replace variables
        const prompt = template === null || template === void 0 ? void 0 : template.content.replace(/\{\{vendorName\}\}/g, vendor.companyName).replace(/\{\{specialty\}\}/g, vendor.specialty || "Services").replace(/\{\{campaignContext\}\}/g, campaignContext);
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        // Sanitize code blocks if present
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
        const jsonContent = JSON.parse(text);
        return {
            channel,
            sms: jsonContent.sms,
            email: jsonContent.email,
            generatedAt: new Date()
        };
    }
    catch (error) {
        console.error("Error generating outreach content:", error);
        return {
            channel,
            sms: "Error generating SMS.",
            email: { subject: "Error", body: "Error generating content. Please draft manually." },
            error: true
        };
    }
};
exports.generateOutreachContent = generateOutreachContent;
const analyzeIncomingMessage = async (vendor, messageContent, previousContext) => {
    try {
        // Fetch prompt from database
        const templateDoc = await db.collection("templates").doc("message_analysis_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Message analysis prompt not found in database");
        }
        const template = templateDoc.data();
        // Replace variables
        const prompt = template === null || template === void 0 ? void 0 : template.content.replace(/\{\{vendorName\}\}/g, vendor.companyName).replace(/\{\{messageContent\}\}/g, messageContent).replace(/\{\{previousContext\}\}/g, previousContext).replace(/\{\{vendorId\}\}/g, vendor.id);
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
        const jsonContent = JSON.parse(text);
        return jsonContent;
    }
    catch (error) {
        console.error("Error analyzing message:", error);
        return { intent: "OTHER", reply: "Error analyzing message." };
    }
};
exports.analyzeIncomingMessage = analyzeIncomingMessage;
//# sourceMappingURL=outreach.js.map