const admin = require("firebase-admin");

// Try to load service account, but don't crash if missing
let serviceAccount;
try {
    serviceAccount = require("./serviceAccountKey.json");
} catch (e) {
    try {
        serviceAccount = require("../service-account-key.json");
    } catch (e2) {
        console.log("⚠️ Service account key not found. Expecting Emulator...");
    }
}

if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(`🔌 Connecting to Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
        admin.initializeApp({ projectId: "xiri-platform" });
    } else if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log(`🔥 Connected to PRODUCTION Firebase: ${serviceAccount.project_id}`);
    } else {
        console.error("❌ No service account and no Emulator host. Exiting.");
        process.exit(1);
    }
}

const db = admin.firestore();

// Collections to clear — "users" is intentionally NOT included
const COLLECTIONS_TO_CLEAR = [
    "leads",
    "vendors",
    "vendor_activities",
    "quotes",
    "contracts",
    "work_orders",
    "invoices",
    "check_ins",
    "activity_logs",
    "outreach_queue",
    "negotiation_threads",
];

async function clearCollection(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) {
        console.log(`  ⏭️  ${collectionName} — already empty`);
        return 0;
    }

    // Firestore batches limited to 500 ops
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 450) {
        chunks.push(snapshot.docs.slice(i, i + 450));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }

    console.log(`  🗑️  ${collectionName} — deleted ${snapshot.size} docs`);
    return snapshot.size;
}

async function clearData() {
    console.log("\n🧹 RESETTING DATABASE — Clearing all business data...\n");
    console.log("⚡ Preserved collections: users, scope_templates, agent_configs\n");

    let totalDeleted = 0;

    for (const col of COLLECTIONS_TO_CLEAR) {
        totalDeleted += await clearCollection(col);
    }

    console.log(`\n✨ Done. Deleted ${totalDeleted} total documents.`);
    console.log("👤 Users collection was preserved — logins still work.\n");
}

clearData().catch(console.error);

