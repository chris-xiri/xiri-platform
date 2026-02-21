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

        // Find the vendor_activities record that has this resendId
        const activitiesSnapshot = await db.collection('vendor_activities')
            .where('metadata.resendId', '==', emailId)
            .limit(1)
            .get();

        if (activitiesSnapshot.empty) {
            logger.warn(`Resend webhook: no activity found for resendId ${emailId}`);
            // Still return 200 so Resend doesn't retry
            res.status(200).json({ ok: true, notFound: true });
            return;
        }

        const activityDoc = activitiesSnapshot.docs[0];
        const activityData = activityDoc.data();
        const vendorId = activityData.vendorId;

        // Update the existing activity with delivery status
        await activityDoc.ref.update({
            'metadata.deliveryStatus': mapping.deliveryStatus,
            'metadata.deliveryUpdatedAt': new Date(),
        });

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

        // If bounced, update vendor outreach status
        if (eventType === 'email.bounced' && vendorId) {
            await db.collection('vendors').doc(vendorId).update({
                outreachStatus: 'FAILED',
                'outreachMeta.bounced': true,
                'outreachMeta.bounceType': event?.data?.bounce_type || 'unknown',
                'outreachMeta.bounceError': event?.data?.error_message || 'Email bounced',
                updatedAt: new Date(),
            });
            logger.info(`Vendor ${vendorId}: email bounced, set outreachStatus to FAILED`);
        }

        logger.info(`Resend webhook: processed ${eventType} for vendor ${vendorId}`);
        res.status(200).json({ ok: true, processed: eventType });

    } catch (error) {
        logger.error('Resend webhook error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});
