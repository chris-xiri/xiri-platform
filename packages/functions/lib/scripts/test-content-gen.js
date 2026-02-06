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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });
// Import the generators
const outreach_1 = require("../agents/outreach");
async function testGeneration() {
    console.log("--- Testing Outreach Content Generation ---\n");
    const vendor = {
        id: "test-id",
        companyName: "Chris' Cleaning",
        location: "New Hyde Park, NY",
        specialty: "Commercial Cleaning",
        email: "test@example.com",
        phone: "+15555555555",
        status: "APPROVED",
        createdAt: new Date()
    };
    // SCENARIO 1: Building Supply (Default)
    console.log(`\n=== SCENARIO 1: Building Supply (No Active Contract) ===`);
    vendor.hasActiveContract = false;
    await runScenario(vendor);
    // SCENARIO 2: Active Contract
    console.log(`\n=== SCENARIO 2: Active Contract (Immediate Need) ===`);
    vendor.hasActiveContract = true;
    await runScenario(vendor);
}
async function runScenario(vendor) {
    console.log(`Vendor: ${vendor.companyName}`);
    // Test Email
    try {
        const emailResult = await (0, outreach_1.generateOutreachContent)(vendor, 'EMAIL');
        console.log("\n[Email]");
        if (emailResult.error) {
            console.error(emailResult.content);
        }
        else {
            console.log("Body:\n", emailResult.content);
        }
    }
    catch (e) {
        console.error("Email Gen Failed:", e);
    }
    // Test SMS
    try {
        const smsResult = await (0, outreach_1.generateOutreachContent)(vendor, 'SMS');
        console.log("\n[SMS]");
        if (smsResult.error) {
            console.error(smsResult.content);
        }
        else {
            console.log("Message:", smsResult.content);
        }
    }
    catch (e) {
        console.error("SMS Gen Failed:", e);
    }
}
testGeneration();
//# sourceMappingURL=test-content-gen.js.map