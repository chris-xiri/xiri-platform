/**
 * Backfill Script: Create individual scheduled vendor_activities
 * from pending FOLLOW_UP tasks in outreach_queue.
 *
 * Also converts any old consolidated "3 follow-ups" DRIP_SCHEDULED
 * entries into individual ones.
 *
 * Usage: node scripts/backfill-scheduled-activities.js
 */

const admin = require('firebase-admin');

// Use Application Default Credentials (gcloud auth application-default login)
admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

async function backfill() {
    console.log('=== Backfill Scheduled Activities ===\n');

    // 1. Find all pending/retry FOLLOW_UP tasks in outreach_queue
    const queueSnap = await db.collection('outreach_queue')
        .where('type', '==', 'FOLLOW_UP')
        .where('status', 'in', ['PENDING', 'RETRY'])
        .get();

    console.log(`Found ${queueSnap.size} pending FOLLOW_UP tasks in outreach_queue\n`);

    let created = 0;
    let skipped = 0;

    for (const taskDoc of queueSnap.docs) {
        const task = taskDoc.data();
        const vendorId = task.vendorId;
        const scheduledAt = task.scheduledAt?.toDate?.() || new Date(task.scheduledAt);
        const sequence = task.metadata?.sequence || 0;
        const subject = task.metadata?.subject || `Follow-up #${sequence}`;

        // Check if we already have a matching scheduled activity
        const existing = await db.collection('vendor_activities')
            .where('vendorId', '==', vendorId)
            .where('type', '==', 'DRIP_SCHEDULED')
            .where('metadata.sequence', '==', sequence)
            .get();

        // Only check for individual entries (not the old consolidated ones)
        const hasIndividual = existing.docs.some(d => d.data().scheduledFor);

        if (hasIndividual) {
            skipped++;
            continue;
        }

        // Create the individual scheduled activity
        await db.collection('vendor_activities').add({
            vendorId,
            type: 'DRIP_SCHEDULED',
            description: `Follow-up #${sequence} scheduled: "${subject}"`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            scheduledFor: scheduledAt,
            metadata: {
                sequence,
                subject,
                backfilled: true,
            },
        });

        console.log(`  ✅ Created: Vendor ${vendorId} — Follow-up #${sequence} → ${scheduledAt.toLocaleDateString()}`);
        created++;
    }

    // 2. Remove old consolidated "3 follow-ups" entries
    const oldConsolidated = await db.collection('vendor_activities')
        .where('type', '==', 'DRIP_SCHEDULED')
        .where('metadata.followUpCount', '==', 3)
        .get();

    let removed = 0;
    for (const oldDoc of oldConsolidated.docs) {
        await oldDoc.ref.delete();
        removed++;
        console.log(`  🗑️  Removed old consolidated entry: ${oldDoc.id}`);
    }

    console.log(`\n=== Done ===`);
    console.log(`Created: ${created} individual scheduled activities`);
    console.log(`Skipped: ${skipped} (already existed)`);
    console.log(`Removed: ${removed} old consolidated entries`);
}

backfill().then(() => process.exit(0)).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
