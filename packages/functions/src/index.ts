import { onCall, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { analyzeVendorLeads } from "./agents/recruiter";
import { searchVendors } from "./agents/sourcer";
import { telegramWebhook, autoApproveVendor, notifyHumanReview, onVendorCreated } from "./triggers/telegramBot";
import { onVendorApproved } from "./triggers/outreachTriggers";

// Initialize Admin only once
if (!admin.apps.length) {
    admin.initializeApp();
}

// Export Bot Functions
export { telegramWebhook, autoApproveVendor, onVendorCreated, onVendorApproved };

// 1. Lead Sourcing Agent Trigger
export const generateLeads = onCall({ secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"] }, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)

    if (!query || !location) {
        throw new Error("Missing 'query' or 'location' in request.");
    }

    try {
        // 1. Source Leads
        const rawVendors = await searchVendors(query, location);
        console.log(`Sourced ${rawVendors.length} vendors.`);

        // 2. Analyze & Qualify (Recruiter Agent)
        // This function automatically saves qualified vendors to Firestore
        const result = await analyzeVendorLeads(rawVendors, hasActiveContract);

        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result
        };
    } catch (error: any) {
        console.error("Error in generateLeads:", error);
        throw new Error(error instanceof Error ? error.message : "Internal error");
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

    const result = await analyzeVendorLeads(rawVendors);
    res.json(result);
});

// Test Function to manually trigger notification (since we don't have a live scraped list trigger yet)
export const testNotification = onRequest(async (req, res) => {
    const vendorId = req.query.vendorId as any;
    if (vendorId) {
        await notifyHumanReview(vendorId);
        res.send(`Notification sent for ${vendorId}`);
    } else {
        res.status(400).send("Provide vendorId query param");
    }
});
