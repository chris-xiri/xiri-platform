import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
    } else {
        const doc = snapshot.docs[0];
        console.log(`Found pending vendor: ${doc.id} (${doc.data().companyName})`);
        console.log("Approving...");
        await doc.ref.update({ status: 'APPROVED' });
        console.log("Approved.");
    }
}

approveFirstPendingVendor().catch(console.error);
