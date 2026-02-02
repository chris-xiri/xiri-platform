import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import the generators
import { generateEmailContent, generateSMSContent } from "../agents/outreach";
import { Vendor } from "../utils/types";

async function testGeneration() {
    console.log("--- Testing Outreach Content Generation ---\n");

    const vendor: Vendor = {
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

async function runScenario(vendor: Vendor) {
    console.log(`Vendor: ${vendor.companyName}`);

    // Test Email
    try {
        const email = await generateEmailContent(vendor);
        console.log("\n[Email]");
        console.log("Subject:", email.subject);
        console.log("Body:\n", email.body);
    } catch (e) {
        console.error("Email Gen Failed:", e);
    }

    // Test SMS
    try {
        const sms = await generateSMSContent(vendor);
        console.log("\n[SMS]");
        console.log("Message:", sms);
    } catch (e) {
        console.error("SMS Gen Failed:", e);
    }
}

testGeneration();
