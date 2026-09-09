/**
 * Seed Autonomous SDR Prompts into Firestore `prompts` collection
 * 
 * Seeds:
 * 1. sdr_profiler (Clinic Profiler & Decision Maker Intelligence)
 * 2. sdr_copywriter (Personalized 1st-Touch Copywriter & Pitch Hook)
 * 3. sdr_intent_triage (Radar Engagement & Human Handoff Gate)
 * 
 * Usage:
 *   npx tsx scripts/seed-sdr-prompts.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

import {
    DEFAULT_SDR_PROFILER_PROMPT,
    DEFAULT_SDR_COPYWRITER_PROMPT,
    DEFAULT_SDR_INTENT_TRIAGE_PROMPT,
} from '../packages/functions/src/utils/promptUtils';

const SDR_PROMPTS = [
    {
        id: 'sdr_profiler',
        name: 'SDR Clinic Profiler & Decision Maker',
        agent: 'sdrProspector',
        description: 'Analyzes dental office digital footprint, evaluates ICP fit (chairs, private vs DSO), and identifies the Office Manager / Practice Administrator.',
        model: 'gemini-2.5-flash',
        content: DEFAULT_SDR_PROFILER_PROMPT,
        variables: ['businessName', 'address', 'website', 'websiteText'],
    },
    {
        id: 'sdr_copywriter',
        name: 'SDR 1-to-1 Pitch Personalizer',
        agent: 'sdrProspector',
        description: 'Generates hyper-personalized Step 1 cold outreach grounded in practice observations (operatory bays, morning inspection pain, OSHA protocols).',
        model: 'gemini-2.5-flash',
        content: DEFAULT_SDR_COPYWRITER_PROMPT,
        variables: ['cleanBizName', 'contactName', 'contactTitle', 'city', 'clinicType', 'keyObservation'],
    },
    {
        id: 'sdr_intent_triage',
        name: 'SDR Radar & Human Handoff Triage',
        agent: 'sdrProspector',
        description: 'Monitors lead replies and clicks. Immediately halts automated outreach and routes hot leads to Chris with 1-click CRM links.',
        model: 'gemini-2.5-flash',
        content: DEFAULT_SDR_INTENT_TRIAGE_PROMPT,
        variables: ['businessName', 'contactName', 'contactTitle', 'leadEmail', 'inboundContent'],
    },
];

async function seedSdrPrompts() {
    console.log(`🤖 Seeding ${SDR_PROMPTS.length} Autonomous SDR Prompts into Firestore...\n`);

    for (const p of SDR_PROMPTS) {
        const docRef = db.collection('prompts').doc(p.id);
        await docRef.set({
            ...p,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'seed-sdr-prompts-script',
        }, { merge: true });
        console.log(`  ✅ ${p.id} — "${p.name}"`);
    }

    // Also update prospecting_config/default with the prompt references
    await db.collection('prospecting_config').doc('default').set({
        sdrPrompts: {
            profilerPromptId: 'sdr_profiler',
            copywriterPromptId: 'sdr_copywriter',
            intentTriagePromptId: 'sdr_intent_triage',
        },
        activeIcp: 'dental',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('\n🎉 Successfully seeded SDR Prompts and linked to `prospecting_config/default`!');
}

seedSdrPrompts().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
