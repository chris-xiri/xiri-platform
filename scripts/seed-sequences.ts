/**
 * Seed the `sequences` Firestore collection with existing hardcoded sequences.
 * Run: npx ts-node scripts/seed-sequences.ts
 */
import * as admin from "firebase-admin";

const serviceAccount = require("../packages/functions/service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

interface SequenceStep {
    templateId: string;
    dayOffset: number;
    label: string;
}

interface SequenceSeed {
    id: string;
    name: string;
    description: string;
    category: 'lead' | 'vendor' | 'referral' | 'custom';
    steps: SequenceStep[];
}

const SEQUENCES: SequenceSeed[] = [
    {
        id: 'tenant_lead_sequence',
        name: 'Tenant / Direct Lead Outreach',
        description: '4-step sequence for tenant and direct facility leads (Day 0, 3, 7, 14)',
        category: 'lead',
        steps: [
            { templateId: 'tenant_lead_1', dayOffset: 0, label: 'Initial Contact' },
            { templateId: 'tenant_lead_2', dayOffset: 3, label: 'Value Proposition' },
            { templateId: 'tenant_lead_3', dayOffset: 7, label: 'Social Proof' },
            { templateId: 'tenant_lead_4', dayOffset: 14, label: 'Final Follow-Up' },
        ],
    },
    {
        id: 'enterprise_lead_sequence',
        name: 'Enterprise Lead Outreach',
        description: '5-step sequence for enterprise/multi-site leads (Day 0, 4, 8, 14, 21)',
        category: 'lead',
        steps: [
            { templateId: 'enterprise_lead_1', dayOffset: 0, label: 'Executive Intro' },
            { templateId: 'enterprise_lead_2', dayOffset: 4, label: 'Portfolio Approach' },
            { templateId: 'enterprise_lead_3', dayOffset: 8, label: 'Case Study' },
            { templateId: 'enterprise_lead_4', dayOffset: 14, label: 'ROI Analysis' },
            { templateId: 'enterprise_lead_5', dayOffset: 21, label: 'Final Follow-Up' },
        ],
    },
    {
        id: 'referral_partnership_sequence',
        name: 'Referral Partnership Outreach',
        description: '3-step sequence for CRE broker referral partnerships (Day 0, 4, 10)',
        category: 'referral',
        steps: [
            { templateId: 'referral_partnership_1', dayOffset: 0, label: 'Partnership Intro' },
            { templateId: 'referral_partnership_2', dayOffset: 4, label: 'Mutual Benefits' },
            { templateId: 'referral_partnership_3', dayOffset: 10, label: 'Final Follow-Up' },
        ],
    },
    {
        id: 'vendor_onboarding_sequence',
        name: 'Contractor Onboarding Follow-Up',
        description: '4-step follow-up sequence for vendors awaiting onboarding (Day 3, 7, 14, 21)',
        category: 'vendor',
        steps: [
            { templateId: 'vendor_outreach_1', dayOffset: 3, label: 'Reminder — Complete Profile' },
            { templateId: 'vendor_outreach_2', dayOffset: 7, label: 'Check-In' },
            { templateId: 'vendor_outreach_3', dayOffset: 14, label: 'Final Follow-Up' },
            { templateId: 'vendor_outreach_4', dayOffset: 21, label: 'Last Chance' },
        ],
    },
];

async function seed() {
    for (const seq of SEQUENCES) {
        const { id, ...data } = seq;
        await db.collection('sequences').doc(id).set({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'seed-script',
        }, { merge: true });
        console.log(`✅ Seeded sequence: ${seq.name} (${seq.steps.length} steps)`);
    }
    console.log('\nDone! Seeded', SEQUENCES.length, 'sequences.');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
