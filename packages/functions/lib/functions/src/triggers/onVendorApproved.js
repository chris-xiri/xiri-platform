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
exports.onVendorApproved = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
console.log("Loading onVendorApproved trigger...");
exports.onVendorApproved = (0, firestore_1.onDocumentUpdated)("vendors/{vendorId}", async (event) => {
    var _a;
    console.log("onVendorApproved triggered!");
    if (!event.data) {
        console.log("No event data.");
        return;
    }
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const vendorId = event.params.vendorId;
    if (!newData || !oldData)
        return;
    // Check if status changed to qualified (Human Approval)
    if (newData.status === 'qualified' && oldData.status !== 'qualified') {
        logger.info(`Vendor ${vendorId} approved. Triggering CRM workflow.`);
        try {
            // 1. Log Activity: "Vendor Approved"
            await db.collection("vendor_activities").add({
                vendorId: vendorId,
                type: "STATUS_CHANGE",
                description: "Vendor status updated to APPROVED by user.",
                createdAt: new Date(),
                metadata: {
                    oldStatus: oldData.status,
                    newStatus: newData.status
                }
            });
            // 1b. Update Vendor Document with Outreach Status
            await event.data.after.ref.update({
                outreachStatus: 'PENDING',
                statusUpdatedAt: new Date()
            });
            // 2. Enqueue Outreach Generation Task
            // Decoupled for resilience (429 retries) and smart scheduling
            const { enqueueTask } = await Promise.resolve().then(() => __importStar(require("../utils/queueUtils")));
            await enqueueTask(db, {
                vendorId: vendorId,
                type: 'GENERATE',
                scheduledAt: new Date(), // Process immediately
                metadata: {
                    status: newData.status,
                    hasActiveContract: newData.hasActiveContract,
                    phone: newData.phone,
                    companyName: newData.businessName, // Updated to match schema
                    specialty: newData.specialty || ((_a = newData.capabilities) === null || _a === void 0 ? void 0 : _a[0])
                }
            });
            logger.info(`Outreach generation task enqueued for vendor ${vendorId}`);
        }
        catch (error) {
            logger.error("Error in onVendorApproved workflow:", error);
        }
    }
});
//# sourceMappingURL=onVendorApproved.js.map