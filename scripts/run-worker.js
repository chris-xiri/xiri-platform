const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GEMINI_API_KEY = "AIza..."; // Will inherit from env if set, else might fail. Using placeholder.

if (!admin.apps.length) {
    admin.initializeApp({ projectId: "xiri-platform" });
}
const db = admin.firestore();

// Mock imports since we can't easily import TS files in JS script without compiling
// We will implement the logic directly here, mimicking the worker.

async function runWorker() {
    console.log("Running Manual Worker...");

    // 1. Fetch
    const snapshot = await db.collection('outreach_queue')
        .where('status', 'in', ['PENDING', 'RETRY'])
        .limit(10)
        .get();

    if (snapshot.empty) {
        console.log("No pending tasks.");
        return;
    }

    console.log(`Found ${snapshot.docs.length} tasks.`);

    for (const doc of snapshot.docs) {
        const task = { id: doc.id, ...doc.data() };
        console.log(`Processing ${task.type} task: ${task.id}`);

        try {
            if (task.type === 'GENERATE') {
                // Simulate Generation (mocking the AI call to avoid API issues in this script)
                console.log("Simulating AI Generation...");
                const sms = `Hey ${task.metadata.companyName}, Xiri here. Urgent contract avail.`;
                const email = { subject: "Partnership", body: "Hello..." };

                // Save Activity
                await db.collection("vendor_activities").add({
                    vendorId: task.vendorId,
                    type: "OUTREACH_QUEUED",
                    description: `Outreach drafts generated (Worker).`,
                    createdAt: new Date(),
                    metadata: {
                        sms, email, preferredChannel: 'SMS', campaignUrgency: "URGENT"
                    }
                });

                // Calculate Schedule (Next Business Day)
                // Hardcoding logic for test: Monday 9am
                const now = new Date();
                const nextBusinessDay = new Date(now);
                nextBusinessDay.setDate(now.getDate() + 3); // Fri -> Mon
                nextBusinessDay.setHours(9, 0, 0, 0);

                // Enqueue SEND
                await db.collection('outreach_queue').add({
                    vendorId: task.vendorId,
                    type: 'SEND',
                    status: 'PENDING',
                    retryCount: 0,
                    createdAt: new Date(),
                    scheduledAt: nextBusinessDay,
                    metadata: { sms, email, channel: 'SMS' }
                });

                // Complete Task
                await db.collection('outreach_queue').doc(task.id).update({ status: 'COMPLETED' });
                console.log("Task Completed. SEND task enqueued.");
            }
        } catch (e) {
            console.error(e);
        }
    }
}

runWorker();
