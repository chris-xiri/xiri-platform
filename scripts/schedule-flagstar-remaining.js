/**
 * Schedule Flagstar enterprise sequence from step 2 onwards.
 * Step 1 already sent — this queues steps 2-5.
 *
 * Enterprise schedule (from startLeadSequence.ts):
 *   Step 1: Day 0  — enterprise_lead_1 (SKIP — already sent)
 *   Step 2: Day 4  — enterprise_lead_2
 *   Step 3: Day 8  — enterprise_lead_3
 *   Step 4: Day 14 — enterprise_lead_4
 *   Step 5: Day 21 — enterprise_lead_5
 *
 * Usage: node scripts/schedule-flagstar-remaining.js
 */

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'xiri-facility-solutions',
});
const db = admin.firestore();

async function main() {
    // Find Flagstar
    const snap = await db.collection('leads')
        .where('businessName', '==', 'Flagstar Bank')
        .get();

    if (snap.empty) { console.log('❌ Flagstar not found'); process.exit(1); }

    const leadDoc = snap.docs[0];
    const lead = leadDoc.data();
    const leadId = leadDoc.id;

    console.log(`\n📋 Flagstar Bank (${leadId})`);
    console.log(`   Type: ${lead.leadType}`);
    console.log(`   Email: ${lead.email}`);

    const now = new Date();

    // Steps 2–5 (sequence index 1–4), offset from today
    const steps = [
        { dayOffset: 4, sequence: 1, templateId: 'enterprise_lead_2' },
        { dayOffset: 8, sequence: 2, templateId: 'enterprise_lead_3' },
        { dayOffset: 14, sequence: 3, templateId: 'enterprise_lead_4' },
        { dayOffset: 21, sequence: 4, templateId: 'enterprise_lead_5' },
    ];

    console.log(`\n📬 Scheduling ${steps.length} emails:\n`);

    for (const step of steps) {
        const scheduled = new Date(now);
        scheduled.setDate(scheduled.getDate() + step.dayOffset);
        scheduled.setHours(14, 0, 0, 0); // 9am ET = 14:00 UTC

        console.log(`  ✉️  ${step.templateId} → ${scheduled.toISOString()} (Day +${step.dayOffset})`);

        await db.collection('outreach_queue').add({
            leadId,
            type: 'SEND',
            status: 'PENDING',
            scheduledAt: admin.firestore.Timestamp.fromDate(scheduled),
            createdAt: admin.firestore.Timestamp.fromDate(now),
            metadata: {
                sequence: step.sequence,
                businessName: lead.businessName,
                email: lead.email,
                contactName: lead.contactName || '',
                facilityType: lead.facilityType || '',
                address: lead.address || '',
                squareFootage: lead.squareFootage || '',
                leadType: 'enterprise',
                templateId: step.templateId,
            },
        });
    }

    // Update lead outreach status
    await db.collection('leads').doc(leadId).update({
        outreachStatus: 'PENDING',
        sequenceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    await db.collection('lead_activities').add({
        leadId,
        type: 'SEQUENCE_STARTED',
        description: `Enterprise sequence resumed from step 2 for Flagstar Bank. Schedule: Day 4/8/14/21 (steps 2-5).`,
        createdAt: new Date(),
        metadata: { leadType: 'enterprise', stepCount: 4, schedule: 'Day 4/8/14/21', resumedFrom: 2 },
    });

    console.log(`\n✅ Done! 4 enterprise emails scheduled for Flagstar.`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
