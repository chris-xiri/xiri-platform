/**
 * Cleanup Duplicate Commission Records
 * 
 * Finds commissions that share the same quoteId (duplicates) and deletes
 * the newer ones, keeping only the oldest record per quoteId.
 * Also cleans up their commission_ledger entries.
 * 
 * Usage:
 *   DRY RUN:  node scripts/cleanup-duplicate-commissions.js
 *   EXECUTE:  node scripts/cleanup-duplicate-commissions.js --execute
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
    const execute = process.argv.includes('--execute');
    console.log(`\n🔍 Scanning for duplicate commissions... (${execute ? '⚡ EXECUTE MODE' : '👀 DRY RUN'})\n`);

    // Fetch all commissions
    const commSnap = await db.collection('commissions').get();
    console.log(`Total commission records: ${commSnap.size}`);

    // Group by quoteId
    const byQuote = {};
    commSnap.forEach(doc => {
        const data = doc.data();
        const quoteId = data.quoteId;
        if (!quoteId) return; // Skip retention bonuses (no quoteId)
        if (!byQuote[quoteId]) byQuote[quoteId] = [];
        byQuote[quoteId].push({
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || 0),
            status: data.status,
            totalCommission: data.totalCommission,
            staffId: data.staffId,
        });
    });

    // Find duplicates
    let dupeCount = 0;
    let toDelete = [];

    for (const [quoteId, records] of Object.entries(byQuote)) {
        if (records.length <= 1) continue;

        // Sort oldest first
        records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const keep = records[0];
        const dupes = records.slice(1);

        console.log(`\n⚠️  Quote ${quoteId}: ${records.length} records (keeping ${keep.id})`);
        console.log(`   KEEP: ${keep.id} | status=${keep.status} | $${keep.totalCommission} | ${keep.createdAt.toISOString()}`);
        for (const d of dupes) {
            console.log(`   DEL:  ${d.id} | status=${d.status} | $${d.totalCommission} | ${d.createdAt.toISOString()}`);
            toDelete.push(d.id);
        }
        dupeCount += dupes.length;
    }

    if (dupeCount === 0) {
        console.log('\n✅ No duplicates found. Database is clean!\n');
        process.exit(0);
    }

    console.log(`\n📊 Found ${dupeCount} duplicate commission(s) to delete`);

    if (!execute) {
        console.log('\n👀 DRY RUN — no changes made. Run with --execute to delete duplicates.\n');
        process.exit(0);
    }

    // Delete duplicates
    console.log('\n🗑️  Deleting duplicates...');
    let deleted = 0;
    let ledgerDeleted = 0;

    for (const commId of toDelete) {
        // Delete associated ledger entries
        const ledgerSnap = await db.collection('commission_ledger')
            .where('commissionId', '==', commId)
            .get();
        for (const ledgerDoc of ledgerSnap.docs) {
            await ledgerDoc.ref.delete();
            ledgerDeleted++;
        }

        // Delete the commission
        await db.collection('commissions').doc(commId).delete();
        deleted++;
        console.log(`   ✓ Deleted commission ${commId} + ${ledgerSnap.size} ledger entries`);
    }

    console.log(`\n✅ Done: ${deleted} commissions deleted, ${ledgerDeleted} ledger entries cleaned up.\n`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
