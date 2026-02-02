import fetch from 'node-fetch';
import admin from 'firebase-admin';

// Initialize Admin to read from Emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "xiri-facility-solutions-485813";

if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-facility-solutions-485813" });
}

const db = admin.firestore();

async function run() {
    console.log("Looking for a pending vendor in Firestore...");

    // Get a vendor
    const snapshot = await db.collection('vendors')
        .where('status', '==', 'PENDING_REVIEW')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.error("No pending vendors found! Did the simulation run?");
        return;
    }

    const doc = snapshot.docs[0];
    const vendorId = doc.id;
    const data = doc.data();
    console.log(`Found Vendor: ${data.companyName} (ID: ${vendorId})`);

    console.log("Triggering Telegram Notification...");
    const url = `http://127.0.0.1:5001/xiri-facility-solutions-485813/us-central1/testNotification?vendorId=${vendorId}`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        console.log("Response:", text);

        if (response.ok) {
            console.log("\n✅ SUCCESS: Telegram notification trigger sent!");
            console.log("Check your Telegram for a message from the bot.");
        } else {
            console.error("❌ FAILED: Server returned error.");
        }
    } catch (e: any) {
        console.error("❌ ERROR calling function:", e.message);
    }
}

run();
