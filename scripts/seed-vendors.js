const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions',
    });
}
const db = admin.firestore();

const vendors = [
    // PENDING (New Leads)
    {
        businessName: "Sparkle Cleaners Ltd",
        status: "pending_review",
        capabilities: ["Janitorial", "Deep Cleaning"],
        address: "123 Main St, New York, NY",
        city: "New York",
        state: "NY",
        zip: "10001",
        fitScore: 85,
        aiReasoning: "Strong match for office cleaning.",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },
    {
        businessName: "Fix-It Right Plumbing",
        status: "pending_review",
        capabilities: ["Plumbing", "HVAC"],
        address: "456 Oak Ave, Garden City, NY",
        city: "Garden City",
        state: "NY",
        zip: "11530",
        fitScore: 72,
        aiReasoning: "Good for emergency repairs.",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },
    {
        businessName: "Green Thumb Landscaping",
        status: "pending_review",
        capabilities: ["Landscaping", "Snow Removal"],
        address: "789 Pine Rd, Queens, NY",
        fitScore: 60,
        aiReasoning: "Seasonal services only.",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },

    // QUALIFIED (Processed - Should be hidden/collapsed)
    {
        businessName: "Elite Security Force",
        status: "qualified",
        capabilities: ["Security", "Access Control"],
        address: "101 High St, Manhattan, NY",
        fitScore: 95,
        aiReasoning: "Top tier security provider.",
        onboardingTrack: "FAST_TRACK",
        hasActiveContract: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },
    {
        businessName: "Citywide Waste Management",
        status: "qualified",
        capabilities: ["Waste Management", "Recycling"],
        address: "202 Industrial Pkwy, Bronx, NY",
        fitScore: 88,
        aiReasoning: "Reliable waste disposal.",
        onboardingTrack: "STANDARD",
        hasActiveContract: false,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },

    // REJECTED (Processed - Should be hidden/collapsed)
    {
        businessName: "Bob's Odd Jobs",
        status: "rejected",
        capabilities: ["Handyman"],
        address: "Unknown",
        fitScore: 20,
        aiReasoning: "No insurance, low reviews.",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    },
    {
        businessName: "Shady Electric",
        status: "rejected",
        capabilities: ["Electrical"],
        address: "Unknown",
        fitScore: 10,
        aiReasoning: "Unlicensed.",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    }
];

async function seedVendors() {
    console.log("🌱 Seeding vendors...");
    const batch = db.batch();

    for (const vendor of vendors) {
        const ref = db.collection('vendors').doc();
        batch.set(ref, vendor);
        console.log(`Prepared: ${vendor.businessName} (${vendor.status})`);
    }

    await batch.commit();
    console.log("✅ Successfully seeded vendors!");
}

seedVendors().catch(console.error);
