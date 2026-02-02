
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "xiri-facility-solutions-485813";

admin.initializeApp({
    projectId: "xiri-facility-solutions-485813"
});

const db = admin.firestore();

async function seed() {
    console.log("Seeding test vendor to Firestore...");

    const vendorRef = db.collection('vendors').doc();
    await vendorRef.set({
        id: vendorRef.id,
        companyName: "Empire State Plumbing",
        specialty: "Plumbing",
        location: "New York, NY",
        phone: "555-0199",
        email: "contact@empireplumbing.test",
        website: "https://empireplumbing.test",
        businessType: "Independent",
        fitScore: 95,
        hasActiveContract: true,
        status: "PENDING_REVIEW",
        createdAt: admin.firestore.Timestamp.now()
    });

    console.log("Seeded vendor:", vendorRef.id);
}

seed().catch(console.error);
