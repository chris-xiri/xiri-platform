/**
 * Seed DENTAL LEAD outreach templates into Firestore.
 * 4-step sequence with standard, _warm, and _cold variants.
 * Specifically crafted for Dental Office Managers and Practice Administrators.
 *
 * Usage:  node scripts/seed-dental-templates.js
 */

const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');

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

const DENTAL_LEAD_TEMPLATES = [
    // ══════════════════════════════════════════════════════
    // Step 1: Morning Walkthrough Hook (Day 0)
    // ══════════════════════════════════════════════════════
    {
        id: 'dental_lead_1',
        name: 'Dental Intro — Morning Inspection Hook',
        sequence: 1,
        subject: 'cleaning for {{cleanBizName}}',
        body: `Hi {{contactName}},

I know you're busy getting ready for patients at {{cleanBizName}}, so I'll be brief.

Most dental office managers I speak with on Long Island tell me the same thing: they hate walking into the practice at 7:45 AM only to find that the night cleaners skipped an operatory, missed the baseboards, or didn't restock the patient restroom.

We built XIRI to eliminate the "morning inspection" headache for dental practices.

Every evening, our crews follow a dental-specific protocol (sterilization perimeter wipe-downs, operatory floors, waiting room presentation). You get a timestamped log on your phone before you open, so you know it was done right without having to check.

Are you open to taking a quick look at the operatory cleaning scope we use for practices in {{city}}?`,
    },

    // ══════════════════════════════════════════════════════
    // Step 2: OSHA & Cross-Contamination (Day 3)
    // ══════════════════════════════════════════════════════
    {
        id: 'dental_lead_2',
        name: 'Dental Value Prop — OSHA & Cross-Contamination',
        sequence: 2,
        subject: 'Re: cleaning for {{cleanBizName}}',
        body: `Hi {{contactName}},

One thing we hear frequently from practice managers when switching cleaners is cross-contamination concern: standard office janitors using the same microfiber mop or cloths across patient bathrooms and clinical operatories.

For our dental clients across Nassau and Queens, we use:
- Strict color-coded microfiber systems (restroom gear never touches an operatory)
- Hospital-grade, EPA List N disinfectants with proper dwell times
- Nightly verification logs you can pull up for OSHA records anytime

If you ever want an honest second opinion on your current cleaning scope—or just want to compare rates—I'd be glad to drop by for a 5-minute walkthrough.

Would that be helpful this week?`,
    },
    {
        id: 'dental_lead_2_warm',
        name: 'Dental Value Prop — Warm',
        sequence: 2,
        variant: 'warm',
        subject: "Here's what your operatory log looks like",
        body: `Hi {{contactName}},

Since you had a chance to read my previous note — here's what our operatory verification log looks like for a practice your size:

→ Clock-in: 8:45 PM | Clock-out: 10:15 PM
→ Zones serviced: Reception, Patient Restrooms, Operatories 1-4, Sterilization Bay
→ Tasks logged: High-touch disinfection, clinical floor care, waste removal, restroom restock
→ Viewable on your phone or desktop with zero login required

You can export or share these logs directly during an OSHA or compliance audit.

Want me to mock up a sample scope tailored to {{cleanBizName}}?`,
    },
    {
        id: 'dental_lead_2_cold',
        name: 'Dental Value Prop — Cold',
        sequence: 2,
        variant: 'cold',
        subject: 'The question to ask your current cleaner',
        body: `Hi {{contactName}},

Here's one quick question worth asking your current cleaning crew:

"Can you guarantee that the microfiber cloths or mop used in our patient restrooms are never used in our operatories?"

If the answer is hesitation or vague reassurance, that's the standard practice risk we eliminate with our color-coded clinical sanitation protocols.

If this is ever top of mind for {{cleanBizName}}, feel free to reply directly to this email.`,
    },

    // ══════════════════════════════════════════════════════
    // Step 3: Local Social Proof (Day 7)
    // ══════════════════════════════════════════════════════
    {
        id: 'dental_lead_3',
        name: 'Dental Social Proof — Garden City Practice',
        sequence: 3,
        subject: 'Re: cleaning for {{cleanBizName}}',
        body: `Hi {{contactName}},

A 5-chair practice in Garden City recently switched to us after their previous cleaner repeatedly missed dusting the operatory chair lights and left trash under the counter.

The office manager told us she was spending 20 minutes every morning fixing things before doctors arrived.

Since switching to XIRI, she has zero morning cleanup, verified nightly logs, and one direct phone number to text if anything is ever needed.

Could I send over a 1-page breakdown of how our pricing works for a practice your size?`,
    },
    {
        id: 'dental_lead_3_warm',
        name: 'Dental Social Proof — Warm',
        sequence: 3,
        variant: 'warm',
        subject: 'The cost of cleaning quality drift',
        body: `Hi {{contactName}},

Most dental practices tell us they change cleaners every 18-24 months because of "cleaning drift" — the crew starts great for the first 90 days, then slowly starts cutting corners until the office manager has to step in.

With XIRI, our team is audited nightly through digital checkpoints. When an area gets missed, our operations manager flags it before you walk in the door at 8:00 AM.

Would you be open to comparing your current monthly janitorial invoice against our transparent pricing?`,
    },
    {
        id: 'dental_lead_3_cold',
        name: 'Dental Social Proof — Cold',
        sequence: 3,
        variant: 'cold',
        subject: 'One quick takeaway for {{cleanBizName}}',
        body: `Hi {{contactName}},

You shouldn't have to inspect your dental clinic every morning to know if it was cleaned properly.

XIRI gives you timestamped, operatory-by-operatory proof every single night.

If your cleaning contracts ever come up for renewal, we'd welcome the chance to submit a competitive proposal.`,
    },

    // ══════════════════════════════════════════════════════
    // Step 4: Breakup / Low-Friction Close (Day 14)
    // ══════════════════════════════════════════════════════
    {
        id: 'dental_lead_4',
        name: 'Dental Final Check-in — Breakup',
        sequence: 4,
        subject: 'Should I close your file for {{cleanBizName}}?',
        body: `Hi {{contactName}},

I haven't heard back, which usually means one of two things:
1. You're completely happy with your current cleaning company (which is great!)
2. You're simply buried with patients and clinic operations right now

If your cleaning contracts ever come up for review, or if you ever walk in to a missed cleaning and need a reliable backup, feel free to keep my contact info handy.

Wishing {{cleanBizName}} a great rest of the month.`,
    },
];

async function seedDentalTemplates() {
    console.log(`🌱 Seeding ${DENTAL_LEAD_TEMPLATES.length} Dental Lead templates into Firestore...\n`);

    for (const tmpl of DENTAL_LEAD_TEMPLATES) {
        const docRef = db.collection('templates').doc(tmpl.id);
        const data = {
            ...tmpl,
            category: 'lead',
            facilityType: 'medical_dental',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.set(data, { merge: true });
        console.log(`  ✅ ${tmpl.id} — "${tmpl.name}"`);
    }

    console.log(`\n🎉 Done! Seeded ${DENTAL_LEAD_TEMPLATES.length} templates.`);
}

seedDentalTemplates().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
