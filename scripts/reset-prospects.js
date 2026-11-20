/**
 * Reset Sales Prospects Database (Safe, Dry-Run by Default)
 *
 * Clears out all sales prospects & CRM records so the rebuilt Dental & Orthodontic
 * Metro NY autonomous SDR engine can start from a completely clean slate.
 *
 * STRICTLY PRESERVED (never touched):
 *   - vendors, vendor_activities, vendor_prospect_queue, vendor_prospecting_config
 *   - vendor outreach_queue tasks (only tasks with a leadId are deleted)
 *   - templates, sequences, email_senders, settings, config, prompts, users
 *
 * Usage:
 *   node scripts/reset-prospects.js                           # Dry-run preview (default)
 *   node scripts/reset-prospects.js --confirm                 # Full sales CRM wipe
 *   node scripts/reset-prospects.js --confirm --seed          # Full wipe + seed Dental/Ortho SDR funnel
 *   node scripts/reset-prospects.js --mode=queue-only --confirm
 */

const admin = require('firebase-admin');
const { seedDentalSdrFunnel } = require('./seed-dental-sdr-funnel');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

const args = process.argv.slice(2);
const isConfirmed = args.includes('--confirm');
const shouldSeed = args.includes('--seed');
const modeArg = args.find((a) => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'full-sales'; // 'full-sales' | 'queue-only'

const QUEUE_COLLECTIONS = [
    'prospect_queue',
    'serper_places_cache',
    'serper_job_cache',
];

const FULL_SALES_COLLECTIONS = [
    ...QUEUE_COLLECTIONS,
    'companies',
    'contacts',
    'leads',
    'lead_activities',
    'crm_contact_rows',
    'crm_company_rows',
    'scheduled_activities',
    'lead_magnet_downloads',
];

async function countCollection(name) {
    const agg = await db.collection(name).count().get();
    return agg.data().count;
}

async function deleteCollectionInBatches(name, batchSize = 400) {
    let totalDeleted = 0;
    while (true) {
        const snap = await db.collection(name).limit(batchSize).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snap.size;
        process.stdout.write(`   ... deleted ${totalDeleted} from ${name}\r`);
    }
    if (totalDeleted > 0) {
        console.log(`   ✓ Deleted ${totalDeleted} docs from ${name}          `);
    } else {
        console.log(`   • ${name}: already empty`);
    }
    return totalDeleted;
}

async function countLeadOutreachTasks() {
    const snap = await db.collection('outreach_queue').select('leadId').get();
    let count = 0;
    snap.docs.forEach((d) => {
        if (d.data().leadId) count++;
    });
    return count;
}

async function deleteLeadOutreachTasks() {
    const snap = await db.collection('outreach_queue').select('leadId').get();
    const leadDocs = snap.docs.filter((d) => !!d.data().leadId);
    let deleted = 0;
    for (let i = 0; i < leadDocs.length; i += 400) {
        const chunk = leadDocs.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
    }
    console.log(`   ✓ Deleted ${deleted} lead tasks from outreach_queue (vendor tasks preserved)`);
    return deleted;
}

async function main() {
    const collections = mode === 'queue-only' ? QUEUE_COLLECTIONS : FULL_SALES_COLLECTIONS;

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`  XIRI Sales Prospects Database Reset`);
    console.log(`  Project:  xiri-facility-solutions`);
    console.log(`  Mode:     ${mode}`);
    console.log(`  Action:   ${isConfirmed ? '⚠️  LIVE DELETE' : '🔍 DRY RUN (no data deleted)'}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    let grandTotal = 0;
    for (const col of collections) {
        const count = await countCollection(col);
        grandTotal += count;
        console.log(`  ${col.padEnd(26)} ${String(count).padStart(7)} docs`);
    }

    const leadTaskCount = await countLeadOutreachTasks();
    grandTotal += leadTaskCount;
    console.log(`  ${'outreach_queue (leads)'.padEnd(26)} ${String(leadTaskCount).padStart(7)} docs`);

    console.log(`\n  TOTAL TARGETED FOR DELETION: ${grandTotal} documents`);
    console.log(`  PRESERVED: vendors, vendor_activities, vendor_prospect_queue, templates, sequences, email_senders, users\n`);

    if (!isConfirmed) {
        console.log(`ℹ️  Dry run complete. Nothing was deleted.`);
        console.log(`👉 To execute the wipe and seed the Dental & Ortho Metro NY funnel, run:`);
        console.log(`   node scripts/reset-prospects.js --mode=${mode} --confirm --seed\n`);
        return;
    }

    console.log(`🗑️  Executing wipe...`);
    for (const col of collections) {
        await deleteCollectionInBatches(col);
    }
    await deleteLeadOutreachTasks();

    // Reset daily outreach stats & prospector run status
    await db.collection('prospecting_config').doc('run_status').delete().catch(() => {});
    await db.collection('prospecting_config').doc('outreach_daily_stats').delete().catch(() => {});
    console.log(`   ✓ Reset prospecting_config/run_status & outreach_daily_stats`);

    if (shouldSeed) {
        await seedDentalSdrFunnel();
    }

    console.log(`\n🎉 Reset complete!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Reset failed:', err.message || err);
        if (String(err.message || err).includes('credential') || String(err.message || err).includes('UNAUTHENTICATED')) {
            console.error('👉 Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS and try again.');
        }
        process.exit(1);
    });
