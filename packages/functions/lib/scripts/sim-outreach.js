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
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });
// Init Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-facility-solutions-485813"
    });
}
const db = admin.firestore();
async function simulateRealOutreach() {
    console.log("Creating test vendor 'Chris' Cleaning'...");
    // 1. Create the Vendor as "PENDING_REVIEW"
    const vendorData = {
        companyName: "Chris' Cleaning",
        location: "New Hyde Park, NY 11040",
        specialty: "Commercial Cleaning",
        status: "PENDING_REVIEW",
        email: "clungz@gmail.com",
        phone: "+15550109999",
        website: "https://chriscleaning.mock",
        businessType: "Independent",
        fitScore: 88,
        createdAt: new Date()
    };
    const ref = await db.collection('vendors').add(vendorData);
    console.log(`Vendor Created: ${ref.id}`);
    // Allow some time for the "onCreated" trigger (Telegram Notif) to supposedly fire/finish
    await new Promise(r => setTimeout(r, 2000));
    console.log("Simulating Approval (Triggering Outreach Agent)...");
    // 2. Approve the Vendor
    // This should trigger 'onVendorApproved' -> 'performOutreach' -> 'sendEmailOutreach'
    await ref.update({ status: 'APPROVED' });
    console.log("Vendor Approved. Check your inbox (clungz@gmail.com) in a few seconds!");
}
simulateRealOutreach().catch(console.error);
//# sourceMappingURL=sim-outreach.js.map