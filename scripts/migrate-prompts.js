/**
 * Migrate agent prompts from `templates` to `prompts` collection.
 * Also fixes template stats where delivered > sent by setting sent = max(sent, delivered).
 *
 * Usage: $env:GOOGLE_APPLICATION_CREDENTIALS="scripts\serviceAccountKey.json"; node scripts/migrate-prompts.js
 */
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PROMPT_IDS = [
    'recruiter_analysis_prompt',
    'outreach_generation_prompt',
    'message_analysis_prompt',
    'document_verifier_prompt',
    'sales_outreach_prompt',
    'sales_followup_prompt',
];

async function migrate() {
    console.log('── Step 1: Migrate prompts from templates → prompts ──\n');

    let moved = 0, skipped = 0;
    for (const id of PROMPT_IDS) {
        const srcRef = db.collection('templates').doc(id);
        const srcDoc = await srcRef.get();
        if (!srcDoc.exists) {
            console.log(`  ⚠ ${id} not found in templates — skipping`);
            skipped++;
            continue;
        }

        const data = srcDoc.data();
        await db.collection('prompts').doc(id).set({
            ...data,
            migratedFrom: 'templates',
            migratedAt: new Date(),
        });
        await srcRef.delete();
        console.log(`  ✅ ${id} → prompts (deleted from templates)`);
        moved++;
    }

    console.log(`\n  Moved ${moved}, skipped ${skipped}\n`);

    // ── Step 2: Fix template stats where delivered > sent ──
    console.log('── Step 2: Fix template stats (delivered > sent) ──\n');

    const templateSnap = await db.collection('templates').get();
    let fixed = 0;
    for (const doc of templateSnap.docs) {
        const stats = doc.data().stats;
        if (!stats) continue;

        // The actual sent count should be at least as high as delivered
        const correctedSent = Math.max(stats.sent || 0, stats.delivered || 0);
        if (correctedSent !== (stats.sent || 0)) {
            await doc.ref.update({
                'stats.sent': correctedSent,
                'stats.lastUpdated': new Date(),
            });
            console.log(`  ✅ ${doc.id}: sent ${stats.sent} → ${correctedSent} (was < delivered: ${stats.delivered})`);
            fixed++;
        }
    }

    console.log(`\n  Fixed ${fixed} template(s)\n`);
    console.log('🎉 Migration complete!');
}

migrate().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
