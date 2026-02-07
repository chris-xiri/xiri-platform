const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-platform" });
}
const db = admin.firestore();

async function checkQueue() {
    console.log("Monitoring Outreach Queue (30s)...");

    for (let i = 0; i < 6; i++) {
        const snapshot = await db.collection('outreach_queue').get();

        if (!snapshot.empty) {
            console.log("\n--- Queue Found Items ---");
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`\nTask ID: ${doc.id}`);
                console.log(`Type: ${data.type}`);
                console.log(`Status: ${data.status}`);
                console.log(`Scheduled At: ${data.scheduledAt.toDate().toISOString()}`);
                if (data.retryCount) console.log(`Retry Count: ${data.retryCount}`);
                if (data.error) console.log(`Error: ${data.error}`);
            });
            // Don't break, keep monitoring to see status changes (e.g. GENERATE -> COMPLETED -> SEND)
        } else {
            process.stdout.write(".");
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log("\nDone monitoring.");
}

checkQueue();
