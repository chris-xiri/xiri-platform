
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Vendor } from '../utils/types';

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Main entry point for the Web Chat Agent.
 * Handles user message, updates state, and returns AI reply.
 */
export async function processVendorMessage(vendorId: string, userMessage: string): Promise<{ reply: string, status: string }> {
    const vendorRef = db.collection('vendors').doc(vendorId);
    const doc = await vendorRef.get();

    if (!doc.exists) {
        throw new Error("Vendor not found");
    }

    const vendor = doc.data() as Vendor;
    let onboarding = vendor.onboarding || {
        status: 'NOT_STARTED',
        currentStep: 'WELCOME'
    };

    // Cast to ensure TS knows it matches the structure
    type OnboardingState = NonNullable<Vendor['onboarding']>;
    onboarding = onboarding as OnboardingState;

    // Save User Message
    await saveMessage(vendorId, 'user', userMessage);

    let reply = "";
    let nextStep: OnboardingState['currentStep'] = onboarding.currentStep;
    let nextStatus: OnboardingState['status'] = onboarding.status;
    let updates: any = {};

    // --- STATE MACHINE ---

    if (onboarding.status === 'NOT_STARTED' || onboarding.currentStep === 'WELCOME') {
        // TRANSITION: WELCOME -> ENTITY_CHECK
        nextStatus = 'onboarding'; // Use valid status
        nextStep = 'ENTITY_CHECK';
        reply = `Hi ${vendor.businessName}. To verify eligibility for ${vendor.address || 'contracts'}, are you a registered LLC or Inc?`;

    } else if (onboarding.currentStep === 'ENTITY_CHECK') {
        // CLASSIFY ANSWER
        const classification = await classifyResponse(userMessage, "Is the user confirming they are an LLC or Inc? Answer YES_CORRECT_ENTITY or NO.");

        if (classification.includes('YES')) {
            // SUCCESS: ENTITY -> INSURANCE
            nextStep = 'INSURANCE_CHECK';
            updates['onboarding.entityType'] = 'LLC/Inc';
            reply = "Great. Do you carry at least $2M General Liability Insurance?";
        } else {
            // FAIL
            nextStatus = 'DISQUALIFIED'; // This is onboarding status, fine
            nextStep = 'DONE';
            updates['onboarding.disqualificationReason'] = 'Entity Type (Not LLC/Inc)';
            reply = "We currently require vendors to be incorporated (LLC or Inc) to join our network.";
        }

    } else if (onboarding.currentStep === 'INSURANCE_CHECK') {
        // CLASSIFY ANSWER
        const classification = await classifyResponse(userMessage, "Is the user confirming they have at least $2M in liability insurance? Answer YES or NO.");

        if (classification.includes('YES')) {
            // SUCCESS: INSURANCE -> DONE
            nextStatus = 'COMPLETED';
            nextStep = 'DONE';
            updates['onboarding.hasInsurance'] = true;
            updates['status'] = 'active'; // Global Vendor Status
            reply = "✅ Verified. You are now in our Preferred Network. We will contact you via SMS when a job matches your profile.";
        } else {
            // FAIL
            nextStatus = 'DISQUALIFIED';
            nextStep = 'DONE';
            updates['onboarding.hasInsurance'] = false;
            updates['onboarding.disqualificationReason'] = 'Insufficient Insurance';
            reply = "We currently require $2M General Liability coverage for our commercial contracts.";
        }

    } else if (onboarding.currentStep === 'DONE') {
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

async function saveMessage(vendorId: string, sender: 'user' | 'ai', text: string) {
    await db.collection(`vendors/${vendorId}/messages`).add({
        sender,
        text,
        timestamp: Date.now() // Using number as requested
    });
}

async function classifyResponse(text: string, instructions: string): Promise<string> {
    const prompt = `
    Analyze this user response: "${text}".
    Instruction: ${instructions}
    
    Return ONLY the classification label (e.g., YES, NO, YES_CORRECT_ENTITY).
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim().toUpperCase();
    } catch (e) {
        console.error("AI Classification failed", e);
        return "NO"; // Conservative default
    }
}
