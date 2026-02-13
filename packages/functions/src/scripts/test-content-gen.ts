import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import the generators
import { generateOutreachContent } from "../agents/outreach";
import { Vendor } from "../utils/types";

async function testGeneration() {
    console.log("--- Testing Outreach Content Generation ---\n");

    const vendor: Vendor = {
        id: "test-id",
        businessName: "Chris' Cleaning",
        address: "New Hyde Park, NY",
        capabilities: ["general"],
        email: "test@example.com",
        phone: "+15555555555",
        status: "active",
        createdAt: new Date()
    };

    // SCENARIO 1: Building Supply (Default)
    console.log(`\n=== SCENARIO 1: Building Supply (No Active Contract) ===`);
    // vendor.hasActiveContract = false; // Removed from type
    await runScenario(vendor);

    // SCENARIO 2: Active Contract
    console.log(`\n=== SCENARIO 2: Active Contract (Immediate Need) ===`);
    // vendor.hasActiveContract = true; // Removed from type
    await runScenario(vendor);
}

async function runScenario(vendor: Vendor) {
    console.log(`Vendor: ${vendor.businessName}`);

    // Test Email
    try {
        const emailResult = await generateOutreachContent(vendor, 'EMAIL');
        console.log("\n[Email]");
        if (emailResult.error) {
            console.error(emailResult.email);
        } else {
            console.log("Body:\n", emailResult.email);
        }
    } catch (e) {
        console.error("Email Gen Failed:", e);
    }

    // Test SMS
    try {
        const smsResult = await generateOutreachContent(vendor, 'SMS');
        console.log("\n[SMS]");
        if (smsResult.error) {
            console.error(smsResult.sms);
        } else {
            console.log("Message:", smsResult.sms);
        }
    } catch (e) {
        console.error("SMS Gen Failed:", e);
    }
}

testGeneration();
