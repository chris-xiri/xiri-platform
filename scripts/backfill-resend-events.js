/**
 * Backfill script: Fetch email delivery/open status from Resend API
 * and update vendor emailEngagement + vendor_activities in Firestore.
 *
 * Usage: RESEND_API_KEY=re_xxx node scripts/backfill-resend-events.js
 *
 * What it does:
 * 1. Finds all vendor_activities with a resendId (outreach emails we sent)
 * 2. Calls Resend API to get each email's current status
 * 3. Creates missing activity entries (EMAIL_DELIVERED, EMAIL_OPENED, etc.)
 * 4. Updates vendor.emailEngagement cache
 */

const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
    console.error('❌ Set RESEND_API_KEY env var: RESEND_API_KEY=re_xxx node scripts/backfill-resend-events.js');
    process.exit(1);
}

// Rate limit: Resend allows ~10 req/s on free plan
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchResendEmail(emailId) {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
    });
    if (!res.ok) {
        if (res.status === 429) {
            console.log('  ⏳ Rate limited, waiting 5s...');
            await sleep(5000);
            return fetchResendEmail(emailId); // retry
        }
        return null;
    }
    return res.json();
}

async function backfill() {
    console.log('🔍 Finding all vendor activities with resendId...\n');

    // Get all activities that have a resendId (sent emails)
    // Types: OUTREACH_SENT, FOLLOW_UP_SENT
    const outreachSnap = await db.collection('vendor_activities')
        .where('type', '==', 'OUTREACH_SENT')
        .get();
    const followUpSnap = await db.collection('vendor_activities')
        .where('type', '==', 'FOLLOW_UP_SENT')
        .get();
    const activitiesSnap = { docs: [...outreachSnap.docs, ...followUpSnap.docs], size: outreachSnap.size + followUpSnap.size };

    console.log(`Found ${activitiesSnap.size} EMAIL_SENT activities\n`);

    // Group by vendorId for efficient updates
    const vendorEngagement = {}; // vendorId -> { lastEvent, openCount, clickCount, lastEventAt }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const actDoc of activitiesSnap.docs) {
        const activity = actDoc.data();
        const resendId = activity.metadata?.resendId;
        const vendorId = activity.vendorId;

        if (!resendId || !vendorId) {
            skipped++;
            continue;
        }

        processed++;
        process.stdout.write(`\r  Processing ${processed}/${activitiesSnap.size}...`);

        try {
            const email = await fetchResendEmail(resendId);
            if (!email) {
                errors++;
                continue;
            }

            // Resend email status: "sent", "delivered", "delivery_delayed", "bounced", "complained"
            // last_event can be: "delivered", "opened", "clicked", "bounced", "complained"
            const lastEvent = email.last_event || email.status;

            // Check what activities already exist for this email
            const existingEvents = await db.collection('vendor_activities')
                .where('metadata.resendId', '==', resendId)
                .get();
            const existingTypes = new Set(existingEvents.docs.map(d => d.data().type));

            const batch = db.batch();
            let batchOps = 0;

            // Create missing activity entries
            const eventsToCreate = [];

            if ((lastEvent === 'delivered' || lastEvent === 'opened' || lastEvent === 'clicked') && !existingTypes.has('EMAIL_DELIVERED')) {
                eventsToCreate.push({
                    type: 'EMAIL_DELIVERED',
                    description: 'Email successfully delivered to inbox.',
                    deliveryStatus: 'delivered',
                });
            }

            if ((lastEvent === 'opened' || lastEvent === 'clicked') && !existingTypes.has('EMAIL_OPENED')) {
                eventsToCreate.push({
                    type: 'EMAIL_OPENED',
                    description: 'Recipient opened the email.',
                    deliveryStatus: 'opened',
                });
            }

            if (lastEvent === 'clicked' && !existingTypes.has('EMAIL_CLICKED')) {
                eventsToCreate.push({
                    type: 'EMAIL_CLICKED',
                    description: 'Recipient clicked a link in the email.',
                    deliveryStatus: 'clicked',
                });
            }

            if (lastEvent === 'bounced' && !existingTypes.has('EMAIL_BOUNCED')) {
                eventsToCreate.push({
                    type: 'EMAIL_BOUNCED',
                    description: `Email bounced.`,
                    deliveryStatus: 'bounced',
                });
            }

            for (const evt of eventsToCreate) {
                const ref = db.collection('vendor_activities').doc();
                batch.set(ref, {
                    vendorId,
                    type: evt.type,
                    description: evt.description,
                    createdAt: email.created_at ? new Date(email.created_at) : new Date(),
                    metadata: {
                        resendId,
                        deliveryStatus: evt.deliveryStatus,
                        rawEvent: `email.${evt.deliveryStatus}`,
                        to: email.to?.[0] || activity.metadata?.to || undefined,
                        backfilled: true,
                    }
                });
                batchOps++;
            }

            if (batchOps > 0) {
                await batch.commit();
                updated += batchOps;
            }

            // Track best engagement per vendor
            const heatOrder = { clicked: 4, opened: 3, delivered: 2, bounced: 1 };
            const heat = heatOrder[lastEvent] || 0;
            const current = vendorEngagement[vendorId];

            if (!current || heat > (heatOrder[current.lastEvent] || 0)) {
                vendorEngagement[vendorId] = {
                    lastEvent,
                    lastEventAt: email.created_at ? new Date(email.created_at) : new Date(),
                };
            }

            // Count opens/clicks
            if (lastEvent === 'opened' || lastEvent === 'clicked') {
                if (!vendorEngagement[vendorId].openCount) vendorEngagement[vendorId].openCount = 0;
                vendorEngagement[vendorId].openCount++;
            }
            if (lastEvent === 'clicked') {
                if (!vendorEngagement[vendorId].clickCount) vendorEngagement[vendorId].clickCount = 0;
                vendorEngagement[vendorId].clickCount++;
            }

            // Throttle to avoid rate limits
            await sleep(150);

        } catch (err) {
            errors++;
            console.error(`\n  ❌ Error for ${resendId}:`, err.message);
        }
    }

    console.log(`\n\n📊 Results: ${processed} processed, ${updated} activities created, ${skipped} skipped, ${errors} errors\n`);

    // Update vendor engagement caches
    const vendorIds = Object.keys(vendorEngagement);
    console.log(`📬 Updating emailEngagement for ${vendorIds.length} vendors...\n`);

    for (const vid of vendorIds) {
        const eng = vendorEngagement[vid];
        try {
            const updateData = {
                'emailEngagement.lastEvent': eng.lastEvent,
                'emailEngagement.lastEventAt': eng.lastEventAt,
                'updatedAt': new Date(),
            };
            if (eng.openCount) updateData['emailEngagement.openCount'] = eng.openCount;
            if (eng.clickCount) updateData['emailEngagement.clickCount'] = eng.clickCount;

            if (eng.lastEvent === 'bounced') {
                updateData['outreachStatus'] = 'FAILED';
                updateData['outreachMeta.bounced'] = true;
            }

            await db.collection('vendors').doc(vid).update(updateData);
            console.log(`  ✅ ${vid}: ${eng.lastEvent}${eng.openCount ? ` (${eng.openCount} opens)` : ''}`);
        } catch (err) {
            console.error(`  ❌ ${vid}: ${err.message}`);
        }
    }

    console.log('\n✅ Backfill complete!');
    process.exit(0);
}

backfill().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
