const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-platform" });
}
const db = admin.firestore();

async function seedVendor() {
    console.log("Seeding dummy vendor...");

    const newVendor = {
        companyName: "Advanced Plumbing",
        specialty: "Plumbing",
        location: "Austin, TX",
        phone: "+15125550500",
        email: "service@advancedplumbing.com",
        website: "https://advancedplumbing.com",
        businessType: "Contractor",
        fitScore: 87,
        status: "PENDING_REVIEW",
        hasActiveContract: true,
        createdAt: new Date(),
        aiReasoning: "Experienced plumbing team."
    };

    const res = await db.collection('vendors').add(newVendor);
    console.log(`Seeded vendor: ${newVendor.companyName} (ID: ${res.id})`);
}

seedVendor();
