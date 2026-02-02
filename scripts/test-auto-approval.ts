import fetch from 'node-fetch';
import admin from 'firebase-admin';

// Initialize Admin to read from Emulator
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "xiri-facility-solutions-485813";

if (admin.apps && !admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-facility-solutions-485813" });
}

const db = admin.firestore();

async function run() {
    console.log("Looking for a PENDING_REVIEW vendor...");

    const snapshot = await db.collection('vendors')
        .where('status', '==', 'PENDING_REVIEW')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.error("No PENDING_REVIEW vendors found. Please run simulation first.");
        return;
    }

    const doc = snapshot.docs[0];
    const vendorId = doc.id;
    console.log(`Found Vendor: ${doc.data().companyName} (${vendorId})`);

    console.log("Simulating Cloud Task Trigger (Auto-Approval)...");

    const url = `http://127.0.0.1:5001/xiri-facility-solutions-485813/us-central1/autoApproveVendor`;

    // Cloud Tasks sends the payload as JSON body
    const payload = { vendorId };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log("Response:", text);

        if (response.ok) {
            console.log("✅ Auto-approve function triggered successfully.");

            // Verify Firestore Update
            const updated = await db.collection('vendors').doc(vendorId).get();
            const status = updated.data()?.status;
            console.log(`New Status: ${status}`);

            if (status === 'AI_AUTO_APPROVED') {
                console.log("🚀 VERIFIED: Vendor was auto-approved!");
            } else {
                console.error("❌ FAILED: Status did not change.");
            }
        } else {
            console.error("❌ Function failed.");
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

run();
