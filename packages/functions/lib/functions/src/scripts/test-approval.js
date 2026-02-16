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
async function approveFirstPendingVendor() {
    console.log("Looking for PENDING_REVIEW vendors...");
    // In emulator, we might need to point to localhost if not set automatically
    // But usually admin SDK picks up if FIRESTORE_EMULATOR_HOST is set.
    // If running this script outside of triggered functions context, we need to ensure it connects to emulator if desired.
    // For now, let's assume it connects to whatever the environment is pointing to. 
    // If I run `FIREBASE_EMULATOR_HOST=localhost:8080 npx ts-node ...`
    const snapshot = await db.collection('vendors')
        .where('status', '==', 'PENDING_REVIEW')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snapshot.empty) {
        console.log("No pending vendors found. Creating a defined test vendor.");
        const ref = await db.collection('vendors').add({
            companyName: "Test Outreach Corp",
            location: "New Hyde Park, NY 11040",
            specialty: "Commercial Cleaning",
            status: "PENDING_REVIEW",
            phone: "+15550109999",
            website: "https://example.com", // Mock website
            email: "contact@testoutreach.com", // Direct email for testing
            createdAt: new Date()
        });
        console.log(`Created test vendor ${ref.id}`);
        console.log("Approving now...");
        await ref.update({ status: 'APPROVED' });
        console.log("Approved.");
    }
    else {
        const doc = snapshot.docs[0];
        console.log(`Found pending vendor: ${doc.id} (${doc.data().companyName})`);
        console.log("Approving...");
        await doc.ref.update({ status: 'APPROVED' });
        console.log("Approved.");
    }
}
approveFirstPendingVendor().catch(console.error);
//# sourceMappingURL=test-approval.js.map