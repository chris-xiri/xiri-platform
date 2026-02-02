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
exports.testNotification = exports.runRecruiterAgent = exports.generateLeads = exports.onVendorApproved = exports.onVendorCreated = exports.autoApproveVendor = exports.telegramWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const recruiter_1 = require("./agents/recruiter");
const sourcer_1 = require("./agents/sourcer");
const telegramBot_1 = require("./triggers/telegramBot");
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramBot_1.telegramWebhook; } });
Object.defineProperty(exports, "autoApproveVendor", { enumerable: true, get: function () { return telegramBot_1.autoApproveVendor; } });
Object.defineProperty(exports, "onVendorCreated", { enumerable: true, get: function () { return telegramBot_1.onVendorCreated; } });
const outreachTriggers_1 = require("./triggers/outreachTriggers");
Object.defineProperty(exports, "onVendorApproved", { enumerable: true, get: function () { return outreachTriggers_1.onVendorApproved; } });
// Initialize Admin only once
if (!admin.apps.length) {
    admin.initializeApp();
}
// 1. Lead Sourcing Agent Trigger
exports.generateLeads = functions.https.onCall(async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false; // Default to false (Building Supply)
    if (!query || !location) {
        throw new functions.https.HttpsError('invalid-argument', "Missing 'query' or 'location' in request.");
    }
    try {
        // 1. Source Leads
        const rawVendors = await (0, sourcer_1.searchVendors)(query, location);
        console.log(`Sourced ${rawVendors.length} vendors.`);
        // 2. Analyze & Qualify (Recruiter Agent)
        // This function automatically saves qualified vendors to Firestore
        const result = await (0, recruiter_1.analyzeVendorLeads)(rawVendors, hasActiveContract);
        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result
        };
    }
    catch (error) {
        console.error("Error in generateLeads:", error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : "Internal error");
    }
});
// Test Function to manually trigger recruiter agent
exports.runRecruiterAgent = functions.https.onRequest(async (req, res) => {
    // Mock data for testing
    const rawVendors = req.body.vendors || [
        { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
        { name: "Joe's Pizza", services: "Best pizza in town" },
        { name: "Elite HVAC", services: "Commercial HVAC systems" }
    ];
    const result = await (0, recruiter_1.analyzeVendorLeads)(rawVendors);
    res.json(result);
});
// Test Function to manually trigger notification (since we don't have a live scraped list trigger yet)
exports.testNotification = functions.https.onRequest(async (req, res) => {
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