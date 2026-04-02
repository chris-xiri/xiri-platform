/**
 * seedSequences.ts — One-time script to seed the existing hardcoded
 * email sequences into the `sequences` Firestore collection.
 *
 * Run:  npx ts-node packages/functions/src/scripts/seedSequences.ts
 *
 * Safe to re-run — uses setDoc with merge:false, so it will overwrite
 * if docs already exist with these IDs.
 */

import * as admin from "firebase-admin";

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud default)
if (!admin.apps.length) {
    admin.initializeApp();
}

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
    category: "lead" | "vendor" | "referral" | "custom";
    steps: SequenceStep[];
}

const SEQUENCES_TO_SEED: SequenceSeed[] = [
    {
        id: "tenant_lead_sequence",
        name: "Tenant/Direct Lead Outreach",
        description: "4 emails over 14 days (Day 0, 3, 7, 14)",
        category: "lead",
        steps: [
            { templateId: "tenant_lead_1", dayOffset: 0, label: "Introduction" },
            { templateId: "tenant_lead_2", dayOffset: 3, label: "Follow Up #1" },
            { templateId: "tenant_lead_3", dayOffset: 7, label: "Follow Up #2" },
            { templateId: "tenant_lead_4", dayOffset: 14, label: "Final Follow Up" },
        ],
    },
    {
        id: "referral_partnership_sequence",
        name: "Referral Partnership Outreach",
        description: "3 emails over 10 days (Day 0, 4, 10)",
        category: "referral",
        steps: [
            { templateId: "referral_partnership_1", dayOffset: 0, label: "Partner Introduction" },
            { templateId: "referral_partnership_2", dayOffset: 4, label: "Follow Up" },
            { templateId: "referral_partnership_3", dayOffset: 10, label: "Final Check-In" },
        ],
    },
    {
        id: "enterprise_lead_sequence",
        name: "Enterprise Lead Outreach",
        description: "5 emails over 21 days (Day 0, 4, 8, 14, 21)",
        category: "lead",
        steps: [
            { templateId: "enterprise_lead_1", dayOffset: 0, label: "Enterprise Introduction" },
            { templateId: "enterprise_lead_2", dayOffset: 4, label: "Value Proposition" },
            { templateId: "enterprise_lead_3", dayOffset: 8, label: "Case Study" },
            { templateId: "enterprise_lead_4", dayOffset: 14, label: "ROI Follow Up" },
            { templateId: "enterprise_lead_5", dayOffset: 21, label: "Final Outreach" },
        ],
    },
];

async function seed() {
    console.log("🌱 Seeding sequences collection...\n");

    for (const seq of SEQUENCES_TO_SEED) {
        const { id, ...data } = seq;
        await db.collection("sequences").doc(id).set({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "seed_script",
        });
        console.log(`  ✅ ${id} — ${data.name} (${data.steps.length} steps)`);
    }

    console.log(`\n🎉 Done! Seeded ${SEQUENCES_TO_SEED.length} sequences.`);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
