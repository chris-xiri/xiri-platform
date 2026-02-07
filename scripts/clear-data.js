const admin = require("firebase-admin");

// Try to load service account, but don't crash if missing
let serviceAccount;
try {
    serviceAccount = require("../service-account-key.json");
} catch (e) {
    console.log("⚠️ Service account key not found. Expecting Emulator...");
}

if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(`🔌 Connecting to Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
        admin.initializeApp({ projectId: "xiri-platform" });
    } else if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error("❌ No service account and no Emulator host. Exiting.");
        process.exit(1);
    }
}

const db = admin.firestore();

async function clearData() {
    console.log("🧹 Clearing Data...");

    const collections = ["vendors", "vendor_activities"];

    for (const col of collections) {
        const snapshot = await db.collection(col).get();
        if (snapshot.empty) {
            console.log(`- ${col} is already empty.`);
            continue;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`- Cleared ${snapshot.size} docs from ${col}.`);
    }

    console.log("✨ Done.");
}

clearData().catch(console.error);
