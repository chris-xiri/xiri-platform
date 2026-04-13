/**
 * Backfill Email Engagement — Pull events from Resend and update contact docs
 *
 * The Resend webhook was writing emailEngagement to entity docs (companies/leads),
 * but the CRM funnel reads from the contacts collection. This function:
 *   1. Loads all contacts from Firestore, indexed by email
 *   2. Paginates through Resend's GET /emails endpoint
 *   3. Matches each email's `to` address to a contact
 *   4. Writes the best-known engagement state to the contact doc
 *
 * Trigger via: https://us-central1-xiri-facility-solutions-485813.cloudfunctions.net/backfillEngagement
 * Add ?dryRun=true to preview without writing
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { Resend } from 'resend';
import { cancelLeadTasks, cancelLeadScheduledEmails } from '../utils/queueUtils';

const db = admin.firestore();

// Engagement priority — higher = better signal
const PRIORITY: Record<string, number> = {
    clicked: 3,
    opened: 2,
    delivered: 1,
    bounced: 0,
    complained: 0,
    suppressed: 0,
    sent: 0,
    delivery_delayed: -1,
};

// Events that indicate an undeliverable/problematic address
const DISCARD_EVENTS = new Set(['bounced', 'complained', 'suppressed']);

interface ContactMatch {
    id: string;
    email: string;
    companyId?: string;
    unsubscribed?: boolean;
    existing?: {
        lastEvent?: string;
        openCount?: number;
        clickCount?: number;
    };
}

interface EngagementAccum {
    lastEvent: string;
    openCount: number;
    clickCount: number;
    lastEventAt: Date;
}

export const backfillEngagement = onRequest({
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: ['RESEND_API_KEY'],
}, async (req, res) => {
    const dryRun = req.query.dryRun === 'true';
    const resend = new Resend(process.env.RESEND_API_KEY);

    const log: string[] = [];
    const emit = (msg: string) => {
        log.push(msg);
        logger.info(msg);
    };

    emit(`📧 Backfill Email Engagement → Contacts`);
    emit(`   Mode: ${dryRun ? '🏜️  DRY RUN' : '🔥 LIVE'}`);

    // ─── Step 1: Build email → contact lookup ──────────────────
    emit('📋 Loading contacts from Firestore...');
    const contactsSnap = await db.collection('contacts').get();
    const emailToContact = new Map<string, ContactMatch>();

    for (const doc of contactsSnap.docs) {
        const data = doc.data();
        const email = (data.email || '').toLowerCase().trim();
        if (!email) continue;

        emailToContact.set(email, {
            id: doc.id,
            email,
            companyId: data.companyId || undefined,
            unsubscribed: data.unsubscribed || false,
            existing: data.emailEngagement || undefined,
        });
    }
    emit(`   Found ${emailToContact.size} contacts with emails`);

    // ─── Step 2: Paginate through Resend emails ───────────────
    emit('📨 Fetching emails from Resend API...');

    const engagementMap = new Map<string, EngagementAccum>();
    let totalEmails = 0;
    let matchedEmails = 0;
    let cursor: string | undefined;
    let pageNum = 0;

    while (true) {
        pageNum++;
        const params: { limit: number; after?: string } = { limit: 100 };
        if (cursor) params.after = cursor;

        let data: any;
        try {
            const result = await resend.emails.list(params);
            data = result.data;
        } catch (err: any) {
            emit(`   ❌ Resend API error on page ${pageNum}: ${err.message}`);
            break;
        }

        if (!data?.data || data.data.length === 0) {
            emit(`   Page ${pageNum}: no more emails`);
            break;
        }

        const emails = data.data;
        totalEmails += emails.length;

        for (const email of emails) {
            const recipients: string[] = Array.isArray(email.to) ? email.to : [email.to];
            const lastEvent = email.last_event || 'delivered';

            for (const rawTo of recipients) {
                const to = rawTo.toLowerCase().trim();
                const contact = emailToContact.get(to);
                if (!contact) continue;

                matchedEmails++;
                const existing = engagementMap.get(contact.id);
                const newPriority = PRIORITY[lastEvent] ?? 0;
                const existingPriority = existing ? (PRIORITY[existing.lastEvent] ?? 0) : -1;
                const emailCreatedAt = email.created_at ? new Date(email.created_at) : new Date();

                if (!existing) {
                    engagementMap.set(contact.id, {
                        lastEvent,
                        openCount: lastEvent === 'opened' || lastEvent === 'clicked' ? 1 : 0,
                        clickCount: lastEvent === 'clicked' ? 1 : 0,
                        lastEventAt: emailCreatedAt,
                    });
                } else {
                    if (newPriority > existingPriority) {
                        existing.lastEvent = lastEvent;
                    }
                    if (lastEvent === 'opened' || lastEvent === 'clicked') {
                        existing.openCount++;
                    }
                    if (lastEvent === 'clicked') {
                        existing.clickCount++;
                    }
                    if (emailCreatedAt > existing.lastEventAt) {
                        existing.lastEventAt = emailCreatedAt;
                    }
                }
            }
        }

        emit(`   Page ${pageNum}: ${emails.length} emails (${matchedEmails} matched so far)`);

        if (!data.has_more || emails.length < 100) break;
        cursor = emails[emails.length - 1].id;

        // Small delay to be nice to the API
        await new Promise(r => setTimeout(r, 200));
    }

    emit(`📊 Summary:`);
    emit(`   Total Resend emails scanned: ${totalEmails}`);
    emit(`   Matched to contacts: ${matchedEmails}`);
    emit(`   Unique contacts to update: ${engagementMap.size}`);

    // ─── Step 3: Write engagement to contact docs ─────────────
    if (engagementMap.size === 0) {
        emit('✅ Nothing to backfill — all contacts are up to date.');
        res.json({ ok: true, log });
        return;
    }

    emit(`${dryRun ? '🏜️  Would update' : '✏️  Updating'} ${engagementMap.size} contacts...`);

    let updated = 0;
    let skipped = 0;
    const dryRunDetails: any[] = [];

    // Build a contactId → ContactMatch lookup for efficiency
    const contactById = new Map<string, ContactMatch>();
    for (const c of emailToContact.values()) {
        contactById.set(c.id, c);
    }

    // Process in batches of 450 (Firestore max = 500)
    const entries = [...engagementMap.entries()];
    for (let i = 0; i < entries.length; i += 450) {
        const chunk = entries.slice(i, i + 450);
        const batch = db.batch();
        let batchCount = 0;

        for (const [contactId, engagement] of chunk) {
            const contact = contactById.get(contactId);
            const existingEvent = contact?.existing?.lastEvent;
            const existingPriority = PRIORITY[existingEvent || ''] ?? -1;
            const newPriority = PRIORITY[engagement.lastEvent] ?? 0;

            // Skip if existing engagement is already better
            if (existingPriority >= newPriority && contact?.existing) {
                skipped++;
                continue;
            }

            const update: Record<string, any> = {
                'emailEngagement.lastEvent': engagement.lastEvent,
                'emailEngagement.lastEventAt': engagement.lastEventAt,
            };

            if (engagement.openCount > (contact?.existing?.openCount || 0)) {
                update['emailEngagement.openCount'] = engagement.openCount;
            }
            if (engagement.clickCount > (contact?.existing?.clickCount || 0)) {
                update['emailEngagement.clickCount'] = engagement.clickCount;
            }

            if (dryRun) {
                dryRunDetails.push({
                    email: contact?.email,
                    lastEvent: engagement.lastEvent,
                    opens: engagement.openCount,
                    clicks: engagement.clickCount,
                });
            } else {
                batch.update(db.collection('contacts').doc(contactId), update);
                batchCount++;
            }
            updated++;
        }

        if (!dryRun && batchCount > 0) {
            await batch.commit();
            emit(`   Committed batch of ${batchCount}`);
        }
    }

    emit(`✅ Engagement backfill done! Updated: ${updated}, Skipped (already better): ${skipped}`);

    // ─── Step 4: Discard bounced / suppressed contacts ─────────
    // Mark contacts whose best engagement is bounced/complained/suppressed
    // as unsubscribed and move their parent company to "lost" status.
    emit(`🧹 Cleaning up bounced/suppressed contacts...`);

    let discarded = 0;
    let alreadyDiscarded = 0;
    const discardDetails: any[] = [];

    for (const [contactId, engagement] of engagementMap.entries()) {
        if (!DISCARD_EVENTS.has(engagement.lastEvent)) continue;

        const contact = contactById.get(contactId);
        if (!contact) continue;

        // Skip if already marked unsubscribed
        if (contact.unsubscribed) {
            alreadyDiscarded++;
            continue;
        }

        if (dryRun) {
            discardDetails.push({
                contactId,
                email: contact.email,
                lastEvent: engagement.lastEvent,
                companyId: contact.companyId || 'none',
            });
            discarded++;
            continue;
        }

        // Mark contact as unsubscribed
        try {
            await db.collection('contacts').doc(contactId).update({
                unsubscribed: true,
                unsubscribedAt: new Date(),
                unsubscribeReason: engagement.lastEvent === 'complained' ? 'spam_complaint' : 'hard_bounce',
            });
        } catch (err: any) {
            emit(`   ⚠️ Failed to unsubscribe contact ${contactId}: ${err.message}`);
            continue;
        }

        // Mark parent company as lost + cancel pending tasks
        if (contact.companyId) {
            try {
                const companyRef = db.collection('companies').doc(contact.companyId);
                const companyDoc = await companyRef.get();

                if (companyDoc.exists && companyDoc.data()?.status !== 'lost') {
                    const prevStatus = companyDoc.data()?.status;
                    await companyRef.update({
                        status: 'lost',
                        lostReason: engagement.lastEvent === 'complained' ? 'spam_complaint' : 'hard_bounce',
                        unsubscribedAt: new Date(),
                        outreachStatus: engagement.lastEvent === 'complained' ? 'SPAM_COMPLAINT' : 'BOUNCED',
                    });

                    // Cancel pending outreach tasks
                    const cancelledTasks = await cancelLeadTasks(db, contact.companyId);
                    const cancelledEmails = await cancelLeadScheduledEmails(db, contact.companyId, 'companies');

                    // Log activity
                    await db.collection('lead_activities').add({
                        leadId: contact.companyId,
                        contactId,
                        type: 'STATUS_CHANGE',
                        description: `${engagement.lastEvent} detected during backfill — lead auto-marked as lost. ${cancelledTasks} tasks + ${cancelledEmails} scheduled emails cancelled.`,
                        createdAt: new Date(),
                        metadata: {
                            from: prevStatus,
                            to: 'lost',
                            trigger: `backfill_${engagement.lastEvent}`,
                            cancelledTasks,
                            resendCancelled: cancelledEmails,
                            contactId,
                        },
                    });
                }
            } catch (err: any) {
                emit(`   ⚠️ Failed to mark company ${contact.companyId} as lost: ${err.message}`);
            }
        }

        discarded++;
    }

    emit(`🧹 Bounce cleanup done! Discarded: ${discarded}, Already discarded: ${alreadyDiscarded}`);

    res.json({
        ok: true,
        dryRun,
        totalEmails,
        matchedEmails,
        contactsUpdated: updated,
        contactsSkipped: skipped,
        discarded,
        alreadyDiscarded,
        dryRunDetails: dryRun ? dryRunDetails : undefined,
        discardDetails: dryRun ? discardDetails : undefined,
        log,
    });
});
