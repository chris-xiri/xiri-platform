/**
 * Backfill emailEngagement on vendor docs
 * 
 * Reads all EMAIL_* entries from vendor_activities and computes
 * the engagement state (lastEvent, lastEventAt, openCount, clickCount)
 * for each vendor, then writes it to the vendor doc.
 * 
 * Run: node scripts/backfill-engagement.js
 * Safe to re-run — always overwrites with latest state.
 */

const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

// Maps vendor_activities type → deliveryStatus value
const TYPE_TO_STATUS = {
    'EMAIL_DELIVERED': 'delivered',
    'EMAIL_OPENED': 'opened',
    'EMAIL_CLICKED': 'clicked',
    'EMAIL_BOUNCED': 'bounced',
    'EMAIL_COMPLAINED': 'spam',
};

// Heat priority (higher = more engaged)
const HEAT = {
    'clicked': 4,
    'opened': 3,
    'delivered': 2,
    'spam': 1,
    'bounced': 1,
};

async function backfill() {
    console.log('🔍 Fetching email activity records...');

    const snapshot = await db.collection('vendor_activities')
        .where('type', 'in', Object.keys(TYPE_TO_STATUS))
        .get();

    if (snapshot.empty) {
        console.log('⚠️  No email activity records found. Nothing to backfill.');
        return;
    }

    console.log(`📊 Found ${snapshot.docs.length} email activity records`);

    // Group by vendorId
    const byVendor = {};
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const { vendorId, type, createdAt } = data;
        if (!vendorId || !type || !TYPE_TO_STATUS[type]) continue;

        const status = TYPE_TO_STATUS[type];

        if (!byVendor[vendorId]) {
            byVendor[vendorId] = {
                lastEvent: null,
                lastEventAt: null,
                lastEventHeat: -1,
                openCount: 0,
                clickCount: 0,
            };
        }

        const eng = byVendor[vendorId];

        // Track counts
        if (type === 'EMAIL_OPENED') eng.openCount++;
        if (type === 'EMAIL_CLICKED') eng.clickCount++;

        // Track latest event by heat (not just timestamp — prefer clicked over opened even if opened came later)
        const heat = HEAT[status] || 0;
        const ts = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt?._seconds * 1000 || 0);

        if (heat > eng.lastEventHeat || (heat === eng.lastEventHeat && ts > eng.lastEventAt)) {
            eng.lastEvent = status;
            eng.lastEventAt = ts;
            eng.lastEventHeat = heat;
        }
    }

    const vendorIds = Object.keys(byVendor);
    console.log(`👥 Backfilling ${vendorIds.length} vendors...`);

    let updated = 0;
    let skipped = 0;

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    for (const vendorId of vendorIds) {
        const eng = byVendor[vendorId];
        if (!eng.lastEvent) { skipped++; continue; }

        const vendorRef = db.collection('vendors').doc(vendorId);
        batch.update(vendorRef, {
            emailEngagement: {
                lastEvent: eng.lastEvent,
                lastEventAt: admin.firestore.Timestamp.fromDate(eng.lastEventAt),
                openCount: eng.openCount,
                clickCount: eng.clickCount,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;
        updated++;

        // Firestore batch limit is 500 — commit and start fresh
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  ✅ Committed batch of ${batchCount}`);
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`\n✅ Done!`);
    console.log(`   Updated: ${updated} vendors`);
    console.log(`   Skipped: ${skipped} vendors (no valid events)`);
}

backfill().catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
