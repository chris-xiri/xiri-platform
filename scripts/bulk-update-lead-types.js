/**
 * Bulk update all leads that don't have a leadType field.
 * Sets them to 'tenant' (as requested by the user).
 * 
 * Usage: node scripts/bulk-update-lead-types.js [leadType]
 *   leadType: 'direct' | 'tenant' | 'referral_partnership' (default: 'tenant')
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function bulkUpdateLeadTypes() {
    const targetType = process.argv[2] || 'tenant';
    const validTypes = ['direct', 'tenant', 'referral_partnership'];

    if (!validTypes.includes(targetType)) {
        console.error(`Invalid lead type "${targetType}". Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
    }

    console.log(`\nBulk updating all leads without leadType to "${targetType}"...\n`);

    const leadsRef = db.collection('leads');
    const snapshot = await leadsRef.get();

    if (snapshot.empty) {
        console.log('No leads found.');
        return;
    }

    let updated = 0;
    let skipped = 0;
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.leadType) {
            batch.update(doc.ref, { leadType: targetType });
            updated++;
            batchCount++;

            // Firestore batch limit is 500
            if (batchCount >= batchSize) {
                await batch.commit();
                console.log(`  Committed batch of ${batchCount} updates...`);
                batch = db.batch();
                batchCount = 0;
            }
        } else {
            skipped++;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`\nDone!`);
    console.log(`  ✅ Updated: ${updated} leads → "${targetType}"`);
    console.log(`  ⏭️  Skipped: ${skipped} leads (already had a leadType)`);
    console.log(`  📊 Total: ${snapshot.size} leads\n`);
}

bulkUpdateLeadTypes().catch(console.error);
