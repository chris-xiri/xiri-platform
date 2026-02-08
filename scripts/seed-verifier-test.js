const admin = require("firebase-admin");

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "xiri-platform" // Try without "dev-" prefix
    });
}

const db = admin.firestore();

async function seed() {
    const vendorId = "test-verifier";

    try {
        // First, delete if exists
        await db.collection("vendors").doc(vendorId).delete().catch(() => { });

        // Then create fresh
        await db.collection("vendors").doc(vendorId).set({
            companyName: "Apex Roofing Specialists",
            phone: "5125550199",
            email: "contact@apexroofing.com",
            specialty: "Commercial Roofing",
            location: "Austin, TX",
            status: "QUALIFIED", // Changed to QUALIFIED so it shows in CRM
            onboardingStep: 3,
            speedTrack: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Seeded Vendor Successfully!`);
        console.log(`Vendor ID: ${vendorId}`);
        console.log(`Portal URL: http://localhost:3000/vendor/onboarding/${vendorId}`);
        console.log(`CRM URL: http://localhost:3000/crm/${vendorId}`);
        console.log(`\n🔍 Check CRM Dashboard: http://localhost:3000/crm`);

        // Verify it was created
        const doc = await db.collection("vendors").doc(vendorId).get();
        if (doc.exists) {
            console.log(`\n✅ Verified: Document exists in Firestore`);
            console.log(`Data:`, doc.data());
        } else {
            console.log(`\n❌ ERROR: Document was not created!`);
        }
    } catch (error) {
        console.error("❌ Seeding failed:", error);
    }
}

seed().catch(console.error);
