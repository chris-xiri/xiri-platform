/**
 * Delete test referral data from Firestore.
 * Cleans referral_leads, related leads, and vendor records.
 * 
 * USAGE:
 *   node scripts/delete-test-referrals.js          # dry run (shows what would be deleted)
 *   node scripts/delete-test-referrals.js --delete  # actually deletes
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Use the service account or default credentials
try {
    initializeApp({ projectId: 'xiri-facility-solutions' });
} catch (e) {
    // Already initialized
}

const db = getFirestore();
const DRY_RUN = !process.argv.includes('--delete');

async function deleteCollection(collectionName, filterFn) {
    const snap = await db.collection(collectionName).get();
    const toDelete = snap.docs.filter(doc => filterFn(doc.data(), doc.id));

    console.log(`\n📋 ${collectionName}: ${toDelete.length} of ${snap.size} docs match`);

    for (const doc of toDelete) {
        const data = doc.data();
        const label = data.businessName || data.referrerName || data.contactName || data.email || doc.id;
        if (DRY_RUN) {
            console.log(`   [DRY RUN] Would delete: ${label} (${doc.id})`);
        } else {
            await doc.ref.delete();
            console.log(`   ✅ Deleted: ${label} (${doc.id})`);
        }
    }
    return toDelete.length;
}

async function main() {
    console.log(DRY_RUN
        ? '\n🔍 DRY RUN — showing what would be deleted. Use --delete to actually delete.'
        : '\n🗑️  DELETE MODE — removing records from Firestore.'
    );

    // 1. Delete all referral_leads (these are only created by the referral form)
    const refCount = await deleteCollection('referral_leads', () => true);

    // 2. Delete leads that came from the referral form
    const leadCount = await deleteCollection('leads', (data) => {
        return data.source === 'referral' || data.attribution?.source === 'referral';
    });

    // 3. Delete vendors tagged as referral partners
    const vendorCount = await deleteCollection('vendors', (data) => {
        return data.source === 'referral_partner';
    });

    console.log(`\n📊 Summary: ${refCount} referral_leads, ${leadCount} leads, ${vendorCount} vendors ${DRY_RUN ? 'would be deleted' : 'deleted'}`);

    if (DRY_RUN) {
        console.log('\n💡 Run with --delete flag to actually delete these records.\n');
    }
}

main().catch(console.error);
