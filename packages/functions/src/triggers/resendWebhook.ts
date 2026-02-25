import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";

const db = admin.firestore();

/**
 * Resend Webhook Handler
 * 
 * Receives email events from Resend (delivered, opened, clicked, bounced, complained)
 * and updates the corresponding vendor_activities record with delivery status.
 * 
 * Webhook URL: https://us-central1-xiri-facility-solutions.cloudfunctions.net/resendWebhook
 * Configure in Resend Dashboard → Webhooks → Add Endpoint
 * Events to subscribe: email.delivered, email.opened, email.clicked, email.bounced, email.complained
 */
export const resendWebhook = onRequest({
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
}, async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const event = req.body;

        // Resend webhook payload structure:
        // { type: "email.delivered", created_at: "...", data: { email_id: "...", to: [...], ... } }
        const eventType = event?.type;
        const emailId = event?.data?.email_id;

        if (!eventType || !emailId) {
            logger.warn('Resend webhook: missing type or email_id', { body: JSON.stringify(event).substring(0, 500) });
            res.status(400).json({ error: 'Missing type or email_id' });
            return;
        }

        logger.info(`Resend webhook: ${eventType} for email ${emailId}`);

        // Map Resend event types to our delivery status
        const statusMap: Record<string, { deliveryStatus: string; activityType: string; description: string }> = {
            'email.delivered': {
                deliveryStatus: 'delivered',
                activityType: 'EMAIL_DELIVERED',
                description: 'Email successfully delivered to inbox.'
            },
            'email.opened': {
                deliveryStatus: 'opened',
                activityType: 'EMAIL_OPENED',
                description: 'Recipient opened the email.'
            },
            'email.clicked': {
                deliveryStatus: 'clicked',
                activityType: 'EMAIL_CLICKED',
                description: 'Recipient clicked a link in the email.'
            },
            'email.bounced': {
                deliveryStatus: 'bounced',
                activityType: 'EMAIL_BOUNCED',
                description: `Email bounced: ${event?.data?.bounce_type || 'unknown'} — ${event?.data?.error_message || 'no details'}.`
            },
            'email.complained': {
                deliveryStatus: 'spam',
                activityType: 'EMAIL_COMPLAINED',
                description: 'Recipient marked email as spam.'
            },
        };

        const mapping = statusMap[eventType];
        if (!mapping) {
            logger.info(`Resend webhook: unhandled event type ${eventType}`);
            res.status(200).json({ ok: true, skipped: true });
            return;
        }

        // ─── Resolve vendorId ───────────────────────────────────────────
        // Path 1: Resend tags — handle both object ({vendorId:"xxx"}) and array ([{name,value}]) formats
        let vendorId: string | null = null;
        const tags = event?.data?.tags;
        if (tags) {
            if (typeof tags === 'object' && !Array.isArray(tags) && tags.vendorId) {
                // Object format: { vendorId: "xxx" }
                vendorId = tags.vendorId;
            } else if (Array.isArray(tags)) {
                // Array format: [{ name: "vendorId", value: "xxx" }]
                const vendorTag = tags.find((t: any) => t.name === 'vendorId');
                if (vendorTag?.value) vendorId = vendorTag.value;
            }
            if (vendorId) {
                logger.info(`Resend webhook: resolved vendorId=${vendorId} from tag`);
            }
        }

        // Path 2: Activity lookup fallback — for emails that predate the tagging fix
        if (!vendorId) {
            const activitiesSnapshot = await db.collection('vendor_activities')
                .where('metadata.resendId', '==', emailId)
                .limit(1)
                .get();

            if (!activitiesSnapshot.empty) {
                vendorId = activitiesSnapshot.docs[0].data().vendorId;
                logger.info(`Resend webhook: resolved vendorId=${vendorId} from activity lookup`);
            }
        }

        if (!vendorId) {
            logger.warn(`Resend webhook: could not resolve vendorId for emailId ${emailId}`);
            res.status(200).json({ ok: true, notFound: true });
            return;
        }

        // Create a new activity entry for this event (so it shows in timeline)
        await db.collection('vendor_activities').add({
            vendorId,
            type: mapping.activityType,
            description: mapping.description,
            createdAt: new Date(),
            metadata: {
                resendId: emailId,
                deliveryStatus: mapping.deliveryStatus,
                rawEvent: eventType,
                to: event?.data?.to?.[0] || undefined,
            }
        });

        // ─── Update vendor doc engagement cache ───
        if (vendorId) {
            const engagementUpdate: Record<string, any> = {
                'emailEngagement.lastEvent': mapping.deliveryStatus,
                'emailEngagement.lastEventAt': new Date(),
            };

            if (eventType === 'email.opened') {
                engagementUpdate['emailEngagement.openCount'] = admin.firestore.FieldValue.increment(1);
            } else if (eventType === 'email.clicked') {
                engagementUpdate['emailEngagement.clickCount'] = admin.firestore.FieldValue.increment(1);
            }

            // If bounced, also update outreach status
            if (eventType === 'email.bounced') {
                engagementUpdate['outreachStatus'] = 'FAILED';
                engagementUpdate['outreachMeta.bounced'] = true;
                engagementUpdate['outreachMeta.bounceType'] = event?.data?.bounce_type || 'unknown';
                engagementUpdate['outreachMeta.bounceError'] = event?.data?.error_message || 'Email bounced';
            }

            engagementUpdate['updatedAt'] = new Date();

            await db.collection('vendors').doc(vendorId).update(engagementUpdate);
            logger.info(`Vendor ${vendorId}: emailEngagement updated (${mapping.deliveryStatus})`);
        }

        // ─── Template Stats Tracking (for A/B testing analytics) ───
        try {
            // Path 1: Read templateId directly from Resend tags (preferred - no Firestore query needed)
            let templateId: string | null = null;
            if (tags) {
                if (typeof tags === 'object' && !Array.isArray(tags) && tags.templateId) {
                    templateId = tags.templateId;
                } else if (Array.isArray(tags)) {
                    const templateTag = tags.find((t: any) => t.name === 'templateId');
                    if (templateTag?.value) templateId = templateTag.value;
                }
            }

            // Path 2: Fallback — query activity to find templateId (legacy emails without tag)
            if (!templateId) {
                const sentActivity = await db.collection('vendor_activities')
                    .where('metadata.resendId', '==', emailId)
                    .limit(1)
                    .get();

                if (!sentActivity.empty) {
                    templateId = sentActivity.docs[0].data().metadata?.templateId || null;
                }
            }

            if (templateId) {
                const statsField = mapping.deliveryStatus; // delivered, opened, clicked, bounced
                await db.collection('templates').doc(templateId).update({
                    [`stats.${statsField}`]: admin.firestore.FieldValue.increment(1),
                    'stats.lastUpdated': new Date(),
                });
                logger.info(`Template ${templateId}: stats.${statsField} incremented`);
            }
        } catch (statsErr) {
            // Non-critical — don't fail the webhook over stats
            logger.warn('Template stats update failed:', statsErr);
        }

        logger.info(`Resend webhook: processed ${eventType} for vendor ${vendorId}`);
        res.status(200).json({ ok: true, processed: eventType });

    } catch (error) {
        logger.error('Resend webhook error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});
