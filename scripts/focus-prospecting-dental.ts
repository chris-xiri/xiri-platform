/**
 * Focus Prospecting Pipeline on Dental Practices
 *
 * Configures the daily prospector (`prospecting_config/default` in Firestore)
 * to exclusively search for and enrich dental offices across Nassau, Suffolk,
 * and Queens counties.
 *
 * Usage:
 *   npx tsx scripts/focus-prospecting-dental.ts [--dry-run] [--target=50]
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { generateProspectingConfig, getConfigSummary } from '../packages/functions/src/utils/prospectingTargets';

const isDryRun = process.argv.includes('--dry-run');
const targetArg = process.argv.find(a => a.startsWith('--target='));
const dailyTarget = targetArg ? parseInt(targetArg.split('=')[1], 10) : 50;

// Initialize Firebase Admin
if (!admin.apps.length) {
    const candidates = [
        path.resolve(__dirname, 'serviceAccountKey.json'),
        path.resolve(__dirname, '../service-account.json'),
        path.resolve(__dirname, '../packages/functions/service-account.json'),
    ];
    let cred = admin.credential.applicationDefault();
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                const sa = require(p);
                cred = admin.credential.cert(sa);
                break;
            } catch (e) {}
        }
    }
    admin.initializeApp({
        credential: cred,
        projectId: 'xiri-facility-solutions',
    });
}

const db = admin.firestore();

async function main() {
    console.log(`🎯 Generating Dental ICP Prospecting Configuration (Daily Target: ${dailyTarget})...\n`);

    const dentalConfig = generateProspectingConfig({
        categories: ['Dental'],
        dailyTarget,
    });

    console.log(getConfigSummary(dentalConfig));
    console.log('\nDental Queries:');
    dentalConfig.queries.forEach(q => console.log(`  • "${q}"`));
    console.log(`\nCoverage: ${dentalConfig.locations.length} towns across Nassau, Suffolk, and Queens.`);

    if (isDryRun) {
        console.log('\n[DRY RUN] No changes written to Firestore.');
        return;
    }

    const updatePayload = {
        queries: dentalConfig.queries,
        locations: dentalConfig.locations,
        dailyTarget: dentalConfig.dailyTarget,
        enabled: true,
        activeIcp: 'dental',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'focus-prospecting-dental-script',
    };

    await db.collection('prospecting_config').doc('default').set(updatePayload, { merge: true });
    console.log('\n✅ Firestore document `prospecting_config/default` updated successfully!');
    console.log('🚀 Daily prospector is now focused on dental practices.');
}

main().catch(err => {
    console.error('❌ Error configuring dental prospecting:', err);
    process.exit(1);
});
