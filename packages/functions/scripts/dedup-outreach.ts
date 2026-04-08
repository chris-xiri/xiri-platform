/**
 * Detect and cancel duplicate outreach tasks in the queue.
 * Duplicates = same leadId + same sequence number + PENDING/RETRY status.
 * Keeps the newest task (or the one with contactId) and cancels the rest.
 *
 * Usage: npx ts-node scripts/dedup-outreach.ts [--dry-run]
 */
import * as admin from "firebase-admin";

// Initialize Firebase Admin
const app = admin.initializeApp({
    projectId: "xiri-facility-solutions",
});
const db = admin.firestore();

interface Task {
    id: string;
    leadId: string;
    sequence: number;
    email: string;
    businessName: string;
    contactId?: string;
    createdAt: admin.firestore.Timestamp;
    status: string;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN — no changes will be made\n" : "🚀 LIVE RUN — duplicates will be cancelled\n");

    // Fetch all PENDING and RETRY tasks
    const snapshot = await db.collection("outreach_queue")
        .where("status", "in", ["PENDING", "RETRY"])
        .get();

    console.log(`Found ${snapshot.size} pending/retry tasks total.\n`);

    // Parse tasks
    const tasks: Task[] = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            leadId: d.leadId || "",
            sequence: d.metadata?.sequence || 0,
            email: d.metadata?.email || "",
            businessName: d.metadata?.businessName || "",
            contactId: d.contactId || d.metadata?.contactId || "",
            createdAt: d.createdAt,
            status: d.status,
        };
    });

    // Group by leadId + sequence
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
        const key = `${task.leadId}__seq${task.sequence}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(task);
    }

    // Find groups with duplicates
    const duplicateGroups = [...groups.entries()].filter(([, v]) => v.length > 1);

    if (duplicateGroups.length === 0) {
        console.log("✅ No duplicate tasks found! Queue is clean.");
        process.exit(0);
    }

    console.log(`⚠️  Found ${duplicateGroups.length} duplicate groups:\n`);

    const toCancelIds: string[] = [];

    for (const [key, dupes] of duplicateGroups) {
        // Sort: prefer tasks WITH contactId first, then newest createdAt
        dupes.sort((a, b) => {
            // Prefer tasks with contactId
            if (a.contactId && !b.contactId) return -1;
            if (!a.contactId && b.contactId) return 1;
            // Then prefer newest
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        const keeper = dupes[0];
        const extras = dupes.slice(1);

        console.log(`── ${keeper.businessName} (${key}) ──`);
        console.log(`   KEEP:   ${keeper.id} (seq ${keeper.sequence}, contactId: ${keeper.contactId || "none"})`);
        for (const extra of extras) {
            console.log(`   CANCEL: ${extra.id} (seq ${extra.sequence}, contactId: ${extra.contactId || "none"})`);
            toCancelIds.push(extra.id);
        }
        console.log();
    }

    console.log(`\nTotal tasks to cancel: ${toCancelIds.length}\n`);

    if (!dryRun && toCancelIds.length > 0) {
        // Batch cancel
        const batches: admin.firestore.WriteBatch[] = [];
        let currentBatch = db.batch();
        let count = 0;

        for (const id of toCancelIds) {
            currentBatch.update(db.collection("outreach_queue").doc(id), {
                status: "CANCELLED",
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                cancelReason: "duplicate_cleanup",
            });
            count++;
            if (count % 400 === 0) {
                batches.push(currentBatch);
                currentBatch = db.batch();
            }
        }
        batches.push(currentBatch);

        for (const batch of batches) {
            await batch.commit();
        }
        console.log(`✅ Cancelled ${toCancelIds.length} duplicate tasks.`);
    } else if (dryRun) {
        console.log("ℹ️  Run without --dry-run to cancel these tasks.");
    }

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
