import * as admin from 'firebase-admin';

// Initialize Admin to read from Emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "xiri-facility-solutions-485813";

if (admin.apps && !admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-facility-solutions-485813" });
}

const db = admin.firestore();

async function run() {
    const vendorId = "mg0ZEH1mgBh3sie7uevi"; // From previous step
    console.log(`Checking status for Vendor ID: ${vendorId}...`);

    const doc = await db.collection('vendors').doc(vendorId).get();
    if (!doc.exists) {
        console.error("Vendor not found.");
        return;
    }

    const data = doc.data();
    console.log(`Vendor: ${data?.companyName}`);
    console.log(`Status: ${data?.status}`);

    if (data?.status === 'APPROVED' || data?.status === 'REJECTED') {
        console.log("✅ Check PASSED: Status was updated via Telegram!");
    } else {
        console.log("⏳ Status is still PENDING_REVIEW. Waiting for button click...");
    }
}

run();
