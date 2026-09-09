/**
 * Test Daily Google Chat Engagement Digest
 *
 * Runs the daily engagement digest generator and displays the output.
 * If --send flag is passed, posts it to GOOGLE_CHAT_WEBHOOK_URL.
 *
 * Usage:
 *   npx tsx scripts/test-chat-engagement-digest.ts [--hours=24] [--send]
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

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

import { generateEngagementDigest, sendDigestToGoogleChat } from '../packages/functions/src/triggers/dailyEmailEngagementDigest';

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const hoursArg = args.find(a => a.startsWith('--hours='));
const hours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 72; // default to 72 hours for preview

async function run() {
    console.log(`🔍 Generating engagement digest for the past ${hours} hours...\n`);

    const digest = await generateEngagementDigest(hours);
    console.log('───────────────────────────────────────────────────────');
    console.log(digest.text);
    console.log('───────────────────────────────────────────────────────\n');

    if (shouldSend) {
        console.log('🚀 Sending to Google Chat via webhook...');
        const result = await sendDigestToGoogleChat(hours);
        if (result.success) {
            console.log('✅ Sent successfully to Google Chat!');
        } else {
            console.log(`⚠️ Send failed: ${result.error}`);
        }
    } else {
        console.log('💡 Pass --send to deliver this message directly to Google Chat.');
    }
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
