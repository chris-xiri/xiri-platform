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
exports.processVendorMessage = processVendorMessage;
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
/**
 * Main entry point for the Web Chat Agent.
 * Handles user message, updates state, and returns AI reply.
 */
async function processVendorMessage(vendorId, userMessage) {
    const vendorRef = db.collection('vendors').doc(vendorId);
    const doc = await vendorRef.get();
    if (!doc.exists) {
        throw new Error("Vendor not found");
    }
    const vendor = doc.data();
    let onboarding = vendor.onboarding || {
        status: 'NOT_STARTED',
        currentStep: 'WELCOME'
    };
    onboarding = onboarding;
    // Save User Message
    await saveMessage(vendorId, 'user', userMessage);
    let reply = "";
    let nextStep = onboarding.currentStep;
    let nextStatus = onboarding.status;
    let updates = {};
    // --- STATE MACHINE ---
    if (onboarding.status === 'NOT_STARTED' || onboarding.currentStep === 'WELCOME') {
        // TRANSITION: WELCOME -> ENTITY_CHECK
        nextStatus = 'onboarding'; // Use valid status
        nextStep = 'ENTITY_CHECK';
        reply = `Hi ${vendor.businessName}. To verify eligibility for ${vendor.address || 'contracts'}, are you a registered LLC or Inc?`;
    }
    else if (onboarding.currentStep === 'ENTITY_CHECK') {
        // CLASSIFY ANSWER
        const classification = await classifyResponse(userMessage, "Is the user confirming they are an LLC or Inc? Answer YES_CORRECT_ENTITY or NO.");
        if (classification.includes('YES')) {
            // SUCCESS: ENTITY -> INSURANCE
            nextStep = 'INSURANCE_CHECK';
            updates['onboarding.entityType'] = 'LLC/Inc';
            reply = "Great. Do you carry at least $2M General Liability Insurance?";
        }
        else {
            // FAIL
            nextStatus = 'DISQUALIFIED'; // This is onboarding status, fine
            nextStep = 'DONE';
            updates['onboarding.disqualificationReason'] = 'Entity Type (Not LLC/Inc)';
            reply = "We currently require vendors to be incorporated (LLC or Inc) to join our network.";
        }
    }
    else if (onboarding.currentStep === 'INSURANCE_CHECK') {
        // CLASSIFY ANSWER
        const classification = await classifyResponse(userMessage, "Is the user confirming they have at least $2M in liability insurance? Answer YES or NO.");
        if (classification.includes('YES')) {
            // SUCCESS: INSURANCE -> DONE
            nextStatus = 'COMPLETED';
            nextStep = 'DONE';
            updates['onboarding.hasInsurance'] = true;
            updates['status'] = 'active'; // Global Vendor Status
            reply = "✅ Verified. You are now in our Preferred Network. We will contact you via SMS when a job matches your profile.";
        }
        else {
            // FAIL
            nextStatus = 'DISQUALIFIED';
            nextStep = 'DONE';
            updates['onboarding.hasInsurance'] = false;
            updates['onboarding.disqualificationReason'] = 'Insufficient Insurance';
            reply = "We currently require $2M General Liability coverage for our commercial contracts.";
        }
    }
    else if (onboarding.currentStep === 'DONE') {
        // Already done
        reply = "You have already completed the verification process. We will be in touch.";
    }
    // UPDATE STATE
    updates['onboarding.status'] = nextStatus;
    updates['onboarding.currentStep'] = nextStep;
    await vendorRef.update(updates);
    // SAVE AI REPLY
    await saveMessage(vendorId, 'ai', reply);
    return { reply, status: nextStatus };
}
// --- HELPERS ---
async function saveMessage(vendorId, sender, text) {
    await db.collection(`vendors/${vendorId}/messages`).add({
        sender,
        text,
        timestamp: Date.now() // Using number as requested
    });
}
async function classifyResponse(text, instructions) {
    const prompt = `
    Analyze this user response: "${text}".
    Instruction: ${instructions}
    
    Return ONLY the classification label (e.g., YES, NO, YES_CORRECT_ENTITY).
    `;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim().toUpperCase();
    }
    catch (e) {
        console.error("AI Classification failed", e);
        return "NO"; // Conservative default
    }
}
//# sourceMappingURL=onboardingChat.js.map