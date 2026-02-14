const admin = require('firebase-admin');

// Initialize (Emulator)
if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';
    admin.initializeApp({ projectId: 'xiri-facility-solutions' });
}

const db = admin.firestore();

async function runTest() {
    console.log("🚀 Starting Vendor Onboarding Flow Test...");

    // 1. Create a Pending Vendor
    const vendorRef = db.collection('vendors').doc();
    const vendorId = vendorRef.id;
    const initialData = {
        businessName: "Test Cleaning Co " + Date.now(),
        status: "pending_review",
        email: "test@vendor.com",
        phone: "555-0123",
        specialty: "Medical Cleaning",
        createdAt: new Date()
    };
    await vendorRef.set(initialData);
    console.log(`✅ Created pending vendor: ${vendorId}`);

    // 2. Simulate Dashboard "Approve as Urgent"
    // This is what InviteVendorModal does
    console.log("👉 Simulating 'Urgent Contract' Invite...");
    await vendorRef.update({
        status: "qualified",
        hasActiveContract: true,
        onboardingTrack: "FAST_TRACK",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        outreachStatus: "PENDING"
    });

    // 3. Wait for Trigger (onVendorApproved)
    console.log("⏳ Waiting 15s for Cloud Function trigger...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 4. Verify Side Effects

    // Check Activity Log
    const logs = await db.collection('vendor_activities')
        .where('vendorId', '==', vendorId)
        .where('type', '==', 'STATUS_CHANGE')
        .get();

    if (!logs.empty) {
        console.log(`✅ STARTUS_CHANGE log found: ${logs.docs[0].data().description}`);
    } else {
        console.error("❌ MISSING STATUS_CHANGE log! Trigger might not have fired.");
    }

    // Check Outreach Queue
    const queue = await db.collection('outreach_queue')
        .where('vendorId', '==', vendorId)
        .where('type', '==', 'GENERATE')
        .get();

    if (!queue.empty) {
        const task = queue.docs[0].data();
        console.log(`✅ Outreach Task Enqueued!`);
        console.log(`   - Status: ${task.status}`);
        console.log(`   - HasActiveContract: ${task.metadata.hasActiveContract}`);

        if (task.metadata.hasActiveContract === true) {
            console.log("   ✅ Contract Status correctly passed to Task Metadata.");
        } else {
            console.error("   ❌ Contract Status missing/wrong in Task Metadata.");
        }
    } else {
        console.error("❌ MISSING Outreach Task! Trigger failed to enqueue.");
    }

    console.log("Test Complete.");
    if (!logs.empty && !queue.empty) process.exit(0);
    else process.exit(1);
}

runTest();
