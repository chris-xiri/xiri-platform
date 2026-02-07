const admin = require("firebase-admin");

// Try to load service account, but don't crash if missing
let serviceAccount;
try {
    serviceAccount = require("../service-account-key.json");
} catch (e) {
    console.log("⚠️ Service account key not found. Expecting Emulator...");
}

if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(`🔌 Connecting to Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
        admin.initializeApp({ projectId: "xiri-platform" });
    } else if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error("❌ No service account and no Emulator host. Exiting.");
        process.exit(1);
    }
}

const db = admin.firestore();

async function seedNegotiation() {
    console.log("🌱 Seeding Negotiation...");

    // 1. Create Vendor
    const res = await db.collection("vendors").add({
        companyName: "Seed Plumbing Co.",
        specialty: "Plumbing",
        phone: "555-0199",
        email: "owner@seedplumbing.com",
        status: "NEGOTIATING",
        createdAt: new Date(),
        statusUpdatedAt: new Date(),
        location: "New York, NY",
        website: "https://seedplumbing.com"
    });

    const vendorId = res.id;
    console.log(`Created new vendor: Seed Plumbing Co. (${vendorId})`);

    // 2. Add Inbound Reply
    await db.collection("vendor_activities").add({
        vendorId: vendorId,
        type: "INBOUND_REPLY",
        description: "That sounds great, I'm interested in joining the network.",
        createdAt: new Date(Date.now() - 5000), // 5 secs ago
        metadata: { channel: "SMS", simulation: true }
    });

    // 3. Add AI Reply with LINK
    const link = `http://localhost:3000/vendor/onboarding/${vendorId}`;
    await db.collection("vendor_activities").add({
        vendorId: vendorId,
        type: "AI_REPLY",
        description: `Fantastic! We'd love to have you. \n\nPlease complete your registration here: ${link}`,
        createdAt: new Date(),
        metadata: { intent: "INTERESTED" }
    });

    console.log(`✅ Seeded negotiation for ${vendorId}`);
    console.log(`🔗 Link: ${link}`);
}

seedNegotiation().catch(console.error);
