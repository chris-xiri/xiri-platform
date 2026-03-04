/**
 * Clean duplicate outreach_queue tasks for Flagstar Bank.
 * 
 * Finds all pending/completed tasks for Flagstar's leadId,
 * identifies duplicates (same sequence number), and cancels the extras.
 * 
 * Usage: node scripts/clean-flagstar-duplicates.js
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

async function main() {
    // Find Flagstar lead
    const leadsSnap = await db.collection('leads')
        .where('businessName', '==', 'Flagstar Bank')
        .get();

    if (leadsSnap.empty) {
        console.log('❌ Flagstar Bank lead not found');
        process.exit(1);
    }

    const leadId = leadsSnap.docs[0].id;
    console.log(`\n📋 Flagstar Bank lead ID: ${leadId}\n`);

    // Get all outreach_queue tasks for this lead
    const tasksSnap = await db.collection('outreach_queue')
        .where('leadId', '==', leadId)
        .get();

    console.log(`Found ${tasksSnap.size} total outreach tasks:\n`);

    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Group by sequence number
    const bySequence = {};
    for (const t of tasks) {
        const seq = t.metadata?.sequence ?? 'unknown';
        const key = `${seq}_${t.metadata?.templateId || 'no-template'}`;
        if (!bySequence[key]) bySequence[key] = [];
        bySequence[key].push(t);
    }

    // Print summary
    for (const [key, group] of Object.entries(bySequence)) {
        console.log(`  Sequence ${key}: ${group.length} task(s)`);
        for (const t of group) {
            const scheduled = t.scheduledAt?.toDate?.()?.toISOString?.() || '—';
            console.log(`    - ${t.id} | status: ${t.status} | template: ${t.metadata?.templateId || '?'} | scheduled: ${scheduled}`);
        }
    }

    // Find duplicates to cancel — for each sequence+template combo, keep the newest one and cancel the rest
    const toCancel = [];
    for (const [key, group] of Object.entries(bySequence)) {
        if (group.length <= 1) continue;

        // Sort by scheduledAt descending — keep the most recent
        group.sort((a, b) => {
            const aTime = a.scheduledAt?.toDate?.()?.getTime?.() || 0;
            const bTime = b.scheduledAt?.toDate?.()?.getTime?.() || 0;
            return bTime - aTime;
        });

        // Cancel all but the first (most recent)
        for (let i = 1; i < group.length; i++) {
            if (group[i].status === 'PENDING' || group[i].status === 'RETRY') {
                toCancel.push(group[i]);
            }
        }
    }

    // Also cancel any PENDING tenant_lead_ tasks if the lead is now enterprise
    const lead = leadsSnap.docs[0].data();
    if (lead.leadType === 'enterprise') {
        for (const t of tasks) {
            if (t.metadata?.templateId?.startsWith('tenant_lead_') &&
                (t.status === 'PENDING' || t.status === 'RETRY') &&
                !toCancel.find(c => c.id === t.id)) {
                toCancel.push(t);
                console.log(`\n  ⚠️  Found tenant template on enterprise lead: ${t.metadata.templateId}`);
            }
        }
    }

    if (toCancel.length === 0) {
        console.log('\n✅ No duplicates or mismatched tasks to clean up.');
        process.exit(0);
    }

    console.log(`\n🧹 Cancelling ${toCancel.length} duplicate/mismatched task(s):\n`);

    const batch = db.batch();
    for (const t of toCancel) {
        console.log(`  ❌ Cancelling: ${t.id} (${t.metadata?.templateId}, status: ${t.status})`);
        batch.update(db.collection('outreach_queue').doc(t.id), {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: 'duplicate_cleanup',
        });
    }

    await batch.commit();
    console.log(`\n✅ Done! ${toCancel.length} tasks cancelled.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
