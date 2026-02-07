const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-platform" });
}
const db = admin.firestore();

async function seedVendor() {
    console.log("Seeding dummy vendor...");

    const newVendor = {
        companyName: "Acme HVAC Services",
        specialty: "HVAC",
        location: "Austin, TX",
        phone: "+15125550199", // Fake but valid format for SMS logic
        email: "contact@acmehvac.com",
        website: "https://acmehvac.com",
        businessType: "Independent",
        fitScore: 85,
        status: "PENDING_REVIEW",
        hasActiveContract: false,
        createdAt: new Date(),
        aiReasoning: "Strong match for HVAC queries. Valid contact info."
    };

    const res = await db.collection('vendors').add(newVendor);
    console.log(`Seeded vendor: ${newVendor.companyName} (ID: ${res.id})`);
}

seedVendor();
