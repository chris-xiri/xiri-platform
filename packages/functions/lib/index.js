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
exports.testNotification = exports.runRecruiterAgent = exports.clearPipeline = exports.generateLeads = exports.onIncomingMessage = exports.processOutreachQueue = exports.onVendorApproved = exports.onVendorCreated = exports.autoApproveVendor = exports.telegramWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const recruiter_1 = require("./agents/recruiter");
const sourcer_1 = require("./agents/sourcer");
const telegramBot_1 = require("./triggers/telegramBot");
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramBot_1.telegramWebhook; } });
Object.defineProperty(exports, "autoApproveVendor", { enumerable: true, get: function () { return telegramBot_1.autoApproveVendor; } });
Object.defineProperty(exports, "onVendorCreated", { enumerable: true, get: function () { return telegramBot_1.onVendorCreated; } });
const onVendorApproved_1 = require("./triggers/onVendorApproved");
Object.defineProperty(exports, "onVendorApproved", { enumerable: true, get: function () { return onVendorApproved_1.onVendorApproved; } });
const outreachWorker_1 = require("./triggers/outreachWorker");
Object.defineProperty(exports, "processOutreachQueue", { enumerable: true, get: function () { return outreachWorker_1.processOutreachQueue; } });
const onIncomingMessage_1 = require("./triggers/onIncomingMessage");
Object.defineProperty(exports, "onIncomingMessage", { enumerable: true, get: function () { return onIncomingMessage_1.onIncomingMessage; } });
// Initialize Admin only once
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// 1. Lead Sourcing Agent Trigger
exports.generateLeads = (0, https_1.onCall)({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"],
    cors: true,
    timeoutSeconds: 540
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)
    if (!query || !location) {
        throw new https_1.HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }
    try {
        console.log(`Analyzing leads for query: ${query}, location: ${location}`);
        // 1. Source Leads
        const rawVendors = await (0, sourcer_1.searchVendors)(query, location);
        console.log(`Sourced ${rawVendors.length} vendors.`);
        // 2. Analyze & Qualify (Recruiter Agent)
        // This function automatically saves qualified vendors to Firestore
        const result = await (0, recruiter_1.analyzeVendorLeads)(rawVendors, query, hasActiveContract);
        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result
        };
    }
    catch (error) {
        console.error("Error in generateLeads:", error);
        throw new https_1.HttpsError("internal", error.message || "An internal error occurred.");
    }
});
// 2. Clear Pipeline Tool
exports.clearPipeline = (0, https_1.onCall)({ cors: true }, async (request) => {
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
    }
    catch (error) {
        throw new https_1.HttpsError("internal", error.message);
    }
});
// Test Function to manually trigger recruiter agent
exports.runRecruiterAgent = (0, https_1.onRequest)({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
    // Mock data for testing
    const rawVendors = req.body.vendors || [
        { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
        { name: "Joe's Pizza", services: "Best pizza in town" },
        { name: "Elite HVAC", services: "Commercial HVAC systems" }
    ];
    const result = await (0, recruiter_1.analyzeVendorLeads)(rawVendors, "Commercial Cleaning");
    res.json(result);
});
// Test Function to manually trigger notification (since we don't have a live scraped list trigger yet)
exports.testNotification = (0, https_1.onRequest)(async (req, res) => {
    const vendorId = req.query.vendorId;
    if (vendorId) {
        await (0, telegramBot_1.notifyHumanReview)(vendorId);
        res.send(`Notification sent for ${vendorId}`);
    }
    else {
        res.status(400).send("Provide vendorId query param");
    }
});
//# sourceMappingURL=index.js.map