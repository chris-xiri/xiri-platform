/**
 * Backfill Template Stats
 * 
 * Scans vendor_activities for OUTREACH_SENT, FOLLOW_UP_SENT, EMAIL_SENT events
 * and increments template stats based on:
 *   - metadata.templateId  → stats.sent
 * 
 * Then scans for delivery events (EMAIL_DELIVERED, EMAIL_OPENED, EMAIL_CLICKED, EMAIL_BOUNCED)
 * and increments corresponding stats.
 * 
 * Usage:
 *   node scripts/backfill-template-stats.js
 * 
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin initialized.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or default)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function backfill() {
    console.log('🔄 Backfilling template stats from vendor_activities...\n');

    // Step 1: Count all sent events per template
    const sentTypes = ['OUTREACH_SENT', 'FOLLOW_UP_SENT', 'EMAIL_SENT'];
    const stats = {}; // { templateId: { sent, delivered, opened, clicked, bounced } }

    for (const type of sentTypes) {
        console.log(`  Scanning ${type} activities...`);
        const snap = await db.collection('vendor_activities')
            .where('type', '==', type)
            .get();

        let count = 0;
        snap.docs.forEach(doc => {
            const data = doc.data();
            const templateId = data.metadata?.templateId;
            if (templateId) {
                if (!stats[templateId]) {
                    stats[templateId] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
                }
                stats[templateId].sent++;
                count++;
            }
        });
        console.log(`    → Found ${count} with templateId out of ${snap.size} total`);
    }

    // Step 2: Count delivery events — try to match via resendId to a sent activity
    const deliveryTypes = [
        { activityType: 'EMAIL_DELIVERED', statsField: 'delivered' },
        { activityType: 'EMAIL_OPENED', statsField: 'opened' },
        { activityType: 'EMAIL_CLICKED', statsField: 'clicked' },
        { activityType: 'EMAIL_BOUNCED', statsField: 'bounced' },
    ];

    // Build resendId → templateId lookup from all sent activities
    console.log('\n  Building resendId → templateId lookup...');
    const resendToTemplate = {};
    const allSentSnap = await db.collection('vendor_activities')
        .where('type', 'in', sentTypes)
        .get();

    allSentSnap.docs.forEach(doc => {
        const data = doc.data();
        const resendId = data.metadata?.resendId;
        const templateId = data.metadata?.templateId;
        if (resendId && templateId) {
            resendToTemplate[resendId] = templateId;
        }
    });
    console.log(`    → Built lookup with ${Object.keys(resendToTemplate).length} entries`);

    for (const { activityType, statsField } of deliveryTypes) {
        console.log(`\n  Scanning ${activityType} activities...`);
        const snap = await db.collection('vendor_activities')
            .where('type', '==', activityType)
            .get();

        let matched = 0;
        snap.docs.forEach(doc => {
            const data = doc.data();
            const resendId = data.metadata?.resendId;

            // Try direct templateId on the delivery event
            let templateId = data.metadata?.templateId;

            // Fallback: lookup via resendId
            if (!templateId && resendId) {
                templateId = resendToTemplate[resendId];
            }

            if (templateId) {
                if (!stats[templateId]) {
                    stats[templateId] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
                }
                stats[templateId][statsField]++;
                matched++;
            }
        });
        console.log(`    → Matched ${matched} out of ${snap.size} to a template`);
    }

    // Step 3: Write stats to Firestore
    console.log('\n📊 Final stats per template:');
    console.log('─'.repeat(80));

    const templateIds = Object.keys(stats).sort();
    for (const templateId of templateIds) {
        const s = stats[templateId];
        console.log(`  ${templateId.padEnd(35)} sent=${s.sent} delivered=${s.delivered} opened=${s.opened} clicked=${s.clicked} bounced=${s.bounced}`);
    }

    console.log(`\n✅ Writing to ${templateIds.length} template docs...`);

    let written = 0;
    let skipped = 0;
    for (const templateId of templateIds) {
        const templateRef = db.collection('templates').doc(templateId);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            console.log(`  ⚠ Template ${templateId} not found in Firestore — skipping`);
            skipped++;
            continue;
        }

        await templateRef.update({
            stats: {
                ...stats[templateId],
                lastUpdated: new Date(),
            },
        });
        written++;
    }

    console.log(`\n🎉 Done! Wrote stats to ${written} templates (${skipped} skipped).`);
}

backfill().catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
