const admin = require('firebase-admin');

if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';
    admin.initializeApp({ projectId: 'xiri-facility-solutions' });
}

const db = admin.firestore();

async function check() {
    console.log("Checking templates...");
    try {
        const doc = await db.collection('templates').doc('recruiter_analysis_prompt').get();
        if (doc.exists) {
            console.log("✅ Recruiter Prompt exists.");
        } else {
            console.log("❌ Recruiter Prompt MISSING.");
        }
    } catch (e) {
        console.error("Error checking templates:", e);
    }
}

check();
