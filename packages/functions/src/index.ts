import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./utils/firebase";
import { analyzeVendorLeads } from "./agents/recruiter";
import { searchVendors } from "./agents/sourcer";
// import { telegramWebhook, autoApproveVendor, notifyHumanReview, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved } from "./triggers/onVendorApproved";
import { processOutreachQueue } from "./triggers/outreachWorker";
import { onIncomingMessage } from "./triggers/onIncomingMessage";
import { onDocumentUploaded } from "./triggers/onDocumentUploaded";

// Export Bot Functions (Telegram disabled for now)
// export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved, processOutreachQueue, onIncomingMessage, onDocumentUploaded };
export { onVendorApproved, processOutreachQueue, onIncomingMessage, onDocumentUploaded };

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
        "https://xiri-facility-solutions.web.app", // Firebase Hosting
        "https://xiri-facility-solutions.firebaseapp.com"
    ],
    timeoutSeconds: 540
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }

    try {
        console.log(`Analyzing leads for query: ${query}, location: ${location}`);

        // 1. Source Leads
        const rawVendors = await searchVendors(query, location);
        console.log(`Sourced ${rawVendors.length} vendors.`);

        // 2. Analyze & Qualify (Recruiter Agent)
        // This function automatically saves qualified vendors to Firestore
        const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract);

        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result
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
