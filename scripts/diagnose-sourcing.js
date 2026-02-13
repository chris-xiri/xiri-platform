const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

async function diagnose() {
    console.log("Diagnosing Sourcing Dependencies...");

    // 1. Check Template
    const templateRef = db.collection('templates').doc('recruiter_analysis_prompt');
    const doc = await templateRef.get();

    if (!doc.exists) {
        console.error("❌ CRITICAL: 'recruiter_analysis_prompt' template is MISSING in Firestore.");
        console.log("   This will cause the recruiter agent to fail.");
    } else {
        console.log("✅ 'recruiter_analysis_prompt' template exists.");
    }

    // 2. Check Vendors
    const vendorsSnapshot = await db.collection('vendors').limit(5).get();
    console.log(`ℹ️ Vendor count (sample): ${vendorsSnapshot.size}`);
    if (vendorsSnapshot.size > 0) {
        vendorsSnapshot.forEach(v => console.log(`   - ${v.data().companyName} (${v.data().status})`));
    }
}

diagnose();
