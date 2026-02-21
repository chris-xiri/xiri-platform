/**
 * Clean Slate Script — Delete all test data from production Firestore
 * Run: node scripts/clean-slate.js
 * 
 * Deletes: vendors, vendor_activities, outreach_queue, leads, quotes, 
 *          contracts, work_orders, invoices, vendor_remittances, 
 *          dismissed_vendors, commissions
 * 
 * IMPORTANT: Does NOT delete users, staff, templates, or system config.
 */

const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

const COLLECTIONS_TO_DELETE = [
    'vendors',
    'vendor_activities',
    'outreach_queue',
    'leads',
    'quotes',
    'contracts',
    'work_orders',
    'invoices',
    'vendor_remittances',
    'dismissed_vendors',
    'commissions',
    'mail_queue',
    'activity_logs',
];

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.limit(500).get();

    if (snapshot.empty) {
        console.log(`  ⏭  ${collectionPath}: already empty`);
        return 0;
    }

    let deleted = 0;
    const batchSize = 500;

    while (true) {
        const batch = db.batch();
        const snap = await collectionRef.limit(batchSize).get();

        if (snap.empty) break;

        snap.docs.forEach(doc => {
            batch.delete(doc.ref);
            deleted++;
        });

        await batch.commit();
    }

    console.log(`  🗑  ${collectionPath}: deleted ${deleted} documents`);
    return deleted;
}

async function cleanSlate() {
    console.log('\n🧹 CLEAN SLATE — Deleting all test data from production Firestore\n');
    console.log('Collections to clear:', COLLECTIONS_TO_DELETE.join(', '));
    console.log('');

    let totalDeleted = 0;

    for (const collection of COLLECTIONS_TO_DELETE) {
        const count = await deleteCollection(collection);
        totalDeleted += count;
    }

    console.log(`\n✅ Clean slate complete. ${totalDeleted} total documents deleted.`);
    console.log('⚠  Templates, users, and staff documents were preserved.\n');
    process.exit(0);
}

cleanSlate().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
