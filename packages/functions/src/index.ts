import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./utils/firebase";
import { analyzeVendorLeads } from "./agents/recruiter";
import { searchVendors } from "./agents/sourcer";
import { searchProperties } from "./agents/propertySourcer";
// import { telegramWebhook, autoApproveVendor, notifyHumanReview, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved, onVendorCreated } from "./triggers/onVendorApproved";
import { processOutreachQueue } from "./triggers/outreachWorker";
import { onIncomingMessage } from "./triggers/onIncomingMessage";
import { onDocumentUploaded } from "./triggers/onDocumentUploaded";
import { sendBookingConfirmation } from "./triggers/sendBookingConfirmation";
import { enrichFromWebsite } from "./triggers/enrichFromWebsite";
import { onOnboardingComplete } from "./triggers/onOnboardingComplete";
import { onAwaitingOnboarding } from "./triggers/dripScheduler";
import { handleUnsubscribe } from "./triggers/handleUnsubscribe";
import { sendOnboardingInvite } from "./triggers/sendOnboardingInvite";
import { sendQuoteEmail, respondToQuote } from "./triggers/sendQuoteEmail";
import { processMailQueue } from "./triggers/processMailQueue";
import { onWorkOrderAssigned } from "./triggers/onVendorReady";
import { onLeadQualified } from "./triggers/onLeadQualified";
import { onQuoteAccepted, onInvoicePaid, onWorkOrderHandoff, onClientCancelled } from "./triggers/commissionTriggers";
import { processCommissionPayouts, calculateNrr } from "./triggers/commissionScheduled";
import { onAuditSubmitted } from "./triggers/onAuditSubmitted";
import { onAuditFailed } from "./triggers/onAuditFailed";
import { generateMonthlyInvoices } from "./triggers/generateMonthlyInvoices";
import { resendWebhook } from "./triggers/resendWebhook";

// Export Bot Functions (Telegram disabled for now)
// export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved, processOutreachQueue, onIncomingMessage, onDocumentUploaded };
export { onVendorApproved, onVendorCreated, processOutreachQueue, onIncomingMessage, onDocumentUploaded, sendBookingConfirmation, enrichFromWebsite, onOnboardingComplete, onAwaitingOnboarding, handleUnsubscribe, sendOnboardingInvite, sendQuoteEmail, respondToQuote, processMailQueue, onWorkOrderAssigned, onLeadQualified, onQuoteAccepted, onInvoicePaid, onWorkOrderHandoff, onClientCancelled, processCommissionPayouts, calculateNrr, onAuditSubmitted, onAuditFailed, generateMonthlyInvoices, resendWebhook };

// 1. Lead Sourcing Agent Trigger
export const generateLeads = onCall({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"],
    cors: [
        "http://localhost:3001", // Dashboard Dev
        "http://localhost:3000", // Public Site Dev
        "https://xiri.ai", // Public Site Production
        "https://www.xiri.ai", // Public Site WWW
        "https://app.xiri.ai", // Dashboard Production
        "https://xiri-dashboard.vercel.app", // Dashboard Vercel
        "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app", // Vercel develop branch
        /https:\/\/xiri-dashboard-.*\.vercel\.app$/, // All Vercel preview deployments
        "https://xiri-facility-solutions.web.app", // Firebase Hosting
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
    timeoutSeconds: 540
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)
    const previewOnly = data.previewOnly || false; // Preview mode: don't save to Firestore

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }

    try {
        console.log(`Analyzing leads for query: ${query}, location: ${location}${previewOnly ? ' (PREVIEW MODE)' : ''}`);

        // 1. Source Leads
        const rawVendors = await searchVendors(query, location);
        console.log(`Sourced ${rawVendors.length} vendors.`);

        // 2. Analyze & Qualify (Recruiter Agent)
        // When previewOnly=true, vendors are NOT saved to Firestore
        const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract, previewOnly);

        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result,
            // Include vendor data in response for preview mode
            vendors: previewOnly ? result.vendors : undefined
        };
    } catch (error: any) {
        console.error("Error in generateLeads:", error);
        throw new HttpsError("internal", error.message || "An internal error occurred.");
    }
});

// 2. Clear Pipeline Tool
export const clearPipeline = onCall({
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app"
    ]
}, async (request) => {
    try {
        const snapshot = await db.collection('vendors').get();

        if (snapshot.empty) {
            return { message: "Pipeline already empty." };
        }

        // Firestore batch max is 500. If we have more, we need multiple batches.
        // For safe deletion, we'll do chunks of 500.
        let count = 0;
        const chunks = [];
        let currentBatch = db.batch(); // We can't reuse the outer batch easily if we chunk

        snapshot.docs.forEach((doc, index) => {
            currentBatch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                chunks.push(currentBatch.commit());
                currentBatch = db.batch();
            }
        });

        chunks.push(currentBatch.commit());
        await Promise.all(chunks);

        return { message: `Cleared ${count} vendors from pipeline.` };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

// Test Function to manually trigger recruiter agent
export const runRecruiterAgent = onRequest({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
    // Mock data for testing
    const rawVendors = req.body.vendors || [
        { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
        { name: "Joe's Pizza", services: "Best pizza in town" },
        { name: "Elite HVAC", services: "Commercial HVAC systems" }
    ];

    const result = await analyzeVendorLeads(rawVendors, "Commercial Cleaning");
    res.json(result);
});


// Test Function to manually trigger notification (Telegram disabled for now)
/* export const testNotification = onRequest(async (req, res) => {
    const vendorId = req.query.vendorId as any;
    if (vendorId) {
        await notifyHumanReview(vendorId);
        res.send(`Notification sent for ${vendorId}`);
    } else {
        res.status(400).send("Provide vendorId query param");
    }
}); */

export const testSendEmail = onCall({
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app"
    ]
}, async (request) => {
    const { sendTemplatedEmail } = await import("./utils/emailUtils");
    const { vendorId, templateId } = request.data;

    if (!vendorId || !templateId) {
        throw new HttpsError("invalid-argument", "Missing vendorId or templateId");
    }

    try {
        await sendTemplatedEmail(vendorId, templateId);
        return { success: true, message: `Email sent to vendor ${vendorId}` };
    } catch (error: any) {
        console.error("Error sending test email:", error);
        throw new HttpsError("internal", error.message || "Failed to send email");
    }
});

// ── Property Sourcing Agent ──
export const sourceProperties = onCall({
    cors: [
        "http://localhost:3001",
        "http://localhost:3000",
        "https://xiri.ai",
        "https://www.xiri.ai",
        "https://app.xiri.ai",
        "https://xiri-dashboard.vercel.app",
        /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
        "https://xiri-facility-solutions.web.app",
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
    timeoutSeconds: 120
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const providerName = data.provider || 'mock';

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }

    try {
        console.log(`[sourceProperties] query="${query}", location="${location}", provider=${providerName}`);
        const properties = await searchProperties(query, location, providerName);

        return {
            message: 'Property sourcing completed.',
            sourced: properties.length,
            properties,
        };
    } catch (error: any) {
        console.error('[sourceProperties] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to source properties.');
    }
});
