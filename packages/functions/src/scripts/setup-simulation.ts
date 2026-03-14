/**
 * Clean up seeded Command Center data and ensure Leung test site is scheduled tonight.
 *
 * Usage: npx tsx packages/functions/src/scripts/setup-simulation.ts
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'xiri-facility-solutions-485813',
        credential: admin.credential.applicationDefault(),
    });
}
const db = admin.firestore();

// Seeded site IDs from the dashboard seed page
const SEEDED_SITE_IDS = ['gcmp_site', 'mot_site', 'hac_site', 'wdg_site', 'fslo_site'];
// Extended seeded site IDs from dashboard seed (scenarios)
const EXTENDED_SITE_IDS = [
    'bma_site', 'lcc_site', 'sds_site', 'nhpa_site',
    'fpv_site', 'fslo_site',
];
const ALL_SEED_SITES = [...new Set([...SEEDED_SITE_IDS, ...EXTENDED_SITE_IDS])];

async function cleanupSeededData() {
    console.log('🧹 Cleaning up seeded data...\n');

    // 1. Delete seeded work orders
    for (const siteId of ALL_SEED_SITES) {
        const woId = `wo_${siteId}`;
        try {
            await db.collection('work_orders').doc(woId).delete();
            console.log(`  🗑️  Deleted work_order: ${woId}`);
        } catch { /* doesn't exist */ }
    }

    // 2. Delete seeded NFC sites
    for (const siteId of ALL_SEED_SITES) {
        try {
            // Delete audit_feedback subcollection first
            const feedbackSnap = await db.collection('nfc_sites').doc(siteId).collection('audit_feedback').get();
            for (const doc of feedbackSnap.docs) {
                await doc.ref.delete();
            }
            await db.collection('nfc_sites').doc(siteId).delete();
            console.log(`  🗑️  Deleted nfc_site: ${siteId}`);
        } catch { /* doesn't exist */ }
    }

    // 3. Delete seeded NFC sessions (predictable IDs)
    for (const siteId of ALL_SEED_SITES) {
        for (const prefix of ['session_cleaner_tonight_', 'session_night_manager_tonight_']) {
            const docId = `${prefix}${siteId}`;
            try {
                await db.collection('nfc_sessions').doc(docId).delete();
                console.log(`  🗑️  Deleted nfc_session: ${docId}`);
            } catch { /* doesn't exist */ }
        }
    }

    // 4. Delete seeded morning_reports (based on clientEmail pattern)
    const mrSnap = await db.collection('morning_reports')
        .where('clientEmail', '>=', 'chris+')
        .where('clientEmail', '<=', 'chris+\uf8ff')
        .get();
    let mrCount = 0;
    const batch = db.batch();
    mrSnap.docs.forEach(doc => {
        const email = doc.data().clientEmail || '';
        if (ALL_SEED_SITES.some(id => email.includes(id))) {
            batch.delete(doc.ref);
            mrCount++;
        }
    });
    if (mrCount > 0) {
        await batch.commit();
        console.log(`  🗑️  Deleted ${mrCount} seeded morning_reports`);
    }

    console.log('\n✅ Cleanup complete!\n');
}

async function ensureLeungWorkOrder() {
    console.log('📋 Setting up Leung Urgent Care work order for tonight...\n');

    const woId = 'Dxc7jes8iij4whJ8kESa';
    const woDoc = await db.collection('work_orders').doc(woId).get();

    if (!woDoc.exists) {
        console.log('  ⚠️  Work order not found — creating one...');
        await db.collection('work_orders').doc(woId).set({
            locationName: 'Test Chris Leung Urgent Care',
            locationId: 'loc_1',
            nfcSiteId: 'loc_1',
            status: 'active',
            serviceType: 'Janitorial',
            schedule: {
                startTime: '19:00',
                daysOfWeek: [true, true, true, true, true, true, true], // every day
                frequency: 'daily',
            },
            monitoringGraceMinutes: 60,
            monitoringNoShowMinutes: 120,
            vendorHistory: [{ vendorName: 'Test Cleaner', assignedAt: admin.firestore.Timestamp.now() }],
            leadId: 'loc_1',
            createdAt: admin.firestore.Timestamp.now(),
        });
        console.log('  ✅ Created work order with schedule');
    } else {
        // Ensure it has the right fields for tonight
        const data = woDoc.data()!;
        const updates: Record<string, any> = {};

        if (data.status !== 'active') updates.status = 'active';
        if (!data.nfcSiteId) updates.nfcSiteId = 'loc_1';
        if (!data.schedule?.startTime) {
            updates.schedule = {
                startTime: '19:00',
                daysOfWeek: [true, true, true, true, true, true, true],
                frequency: 'daily',
            };
        }
        if (!data.schedule?.daysOfWeek) {
            updates['schedule.daysOfWeek'] = [true, true, true, true, true, true, true];
        }
        if (!data.monitoringGraceMinutes) updates.monitoringGraceMinutes = 60;
        if (!data.monitoringNoShowMinutes) updates.monitoringNoShowMinutes = 120;

        if (Object.keys(updates).length > 0) {
            await db.collection('work_orders').doc(woId).update(updates);
            console.log(`  ✅ Updated work order with: ${Object.keys(updates).join(', ')}`);
        } else {
            console.log('  ✅ Work order already configured correctly');
        }

        console.log(`  📍 Location: ${data.locationName || 'Test Chris Leung Urgent Care'}`);
        console.log(`  🕐 Schedule: ${data.schedule?.startTime || '19:00'}`);
        console.log(`  📡 NFC Site: ${data.nfcSiteId || 'loc_1'}`);
    }

    // Also clean any existing tonight sessions for loc_1 so we start fresh
    const cutoff = new Date();
    cutoff.setHours(12, 0, 0, 0);
    const sessSnap = await db.collection('nfc_sessions')
        .where('siteLocationId', '==', 'loc_1')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(cutoff))
        .get();
    if (!sessSnap.empty) {
        for (const doc of sessSnap.docs) {
            await doc.ref.delete();
        }
        console.log(`  🗑️  Cleared ${sessSnap.size} existing tonight sessions for loc_1`);
    }

    console.log('\n✅ Leung test site ready for simulation!\n');
}

async function main() {
    console.log('═'.repeat(50));
    await cleanupSeededData();
    await ensureLeungWorkOrder();
    console.log('═'.repeat(50));
    console.log('🎉 Done! Refresh the Command Center — you should see just the Leung test site.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
