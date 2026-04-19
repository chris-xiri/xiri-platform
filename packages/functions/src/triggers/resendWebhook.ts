import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { logger } from "firebase-functions/v2";
import { cancelVendorTasks, cancelLeadTasks, cancelLeadScheduledEmails } from "../utils/queueUtils";
import { addToResendSuppression } from "../utils/suppressionUtils";


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
    cors: false,   // Resend is not a browser — no CORS needed
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: ['RESEND_WEBHOOK_SECRET'],
}, async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // ─── Webhook signature verification (Resend Pro) ────────────────
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
        const svixId = req.headers['svix-id'] as string | undefined;
        const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
        const svixSignature = req.headers['svix-signature'] as string | undefined;

        if (!svixId || !svixTimestamp || !svixSignature) {
            logger.warn('Resend webhook: missing svix-* headers');
            res.status(401).json({ error: 'Missing signature headers' });
            return;
        }

        // Guard against replay attacks: reject messages older than 5 minutes
        const tsSeconds = parseInt(svixTimestamp, 10);
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
            logger.warn('Resend webhook: timestamp out of tolerance', { svixTimestamp });
            res.status(401).json({ error: 'Timestamp out of tolerance' });
            return;
        }

        // Compute HMAC: sign("{svix-id}.{svix-timestamp}.{raw-body}")
        const rawBody = typeof req.rawBody === 'string'
            ? req.rawBody
            : req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
        const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
        const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
        const computed = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

        // svix-signature may contain multiple versions: "v1,<sig> v1,<sig2>"
        const signatures = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''));
        const isValid = signatures.some(sig => {
            try {
                return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
            } catch { return false; }
        });

        if (!isValid) {
            logger.error('Resend webhook: signature mismatch');
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }

        logger.info('Resend webhook: signature verified ✓');
    } else {
        logger.warn('Resend webhook: RESEND_WEBHOOK_SECRET not set — running UNSIGNED (insecure)');
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

        // ─── Resolve entity (vendor or lead) ─────────────────────────────
        // Path 1: Resend tags — handle both object ({entityId:"xxx"}) and array ([{name,value}]) formats
        let entityId: string | null = null;
        let entityType: 'vendor' | 'lead' | null = null;
        const tags = event?.data?.tags;

        let tagContactId: string | null = null;

        if (tags) {
            const getTag = (key: string): string | null => {
                if (typeof tags === 'object' && !Array.isArray(tags) && tags[key]) return tags[key];
                if (Array.isArray(tags)) {
                    const found = tags.find((t: any) => t.name === key);
                    return found?.value || null;
                }
                return null;
            };

            // Check for vendorId or leadId in tags
            const vendorId = getTag('vendorId');
            const leadId = getTag('leadId');
            tagContactId = getTag('contactId');
            if (vendorId) {
                entityId = vendorId;
                entityType = 'vendor';
            } else if (leadId) {
                entityId = leadId;
                entityType = 'lead';
            }

            if (entityId) {
                logger.info(`Resend webhook: resolved ${entityType}Id=${entityId} from tag`);
            }
        }

        // Path 2: Activity lookup fallback — check both vendor_activities and lead_activities
        if (!entityId) {
            // Try vendor_activities first
            const vendorSnap = await db.collection('vendor_activities')
                .where('metadata.resendId', '==', emailId)
                .limit(1)
                .get();

            if (!vendorSnap.empty) {
                entityId = vendorSnap.docs[0].data().vendorId;
                entityType = 'vendor';
                logger.info(`Resend webhook: resolved vendorId=${entityId} from vendor_activities lookup`);
            } else {
                // Try lead_activities
                const leadSnap = await db.collection('lead_activities')
                    .where('metadata.resendId', '==', emailId)
                    .limit(1)
                    .get();

                if (!leadSnap.empty) {
                    entityId = leadSnap.docs[0].data().leadId;
                    entityType = 'lead';
                    logger.info(`Resend webhook: resolved leadId=${entityId} from lead_activities lookup`);
                }
            }
        }

        // ─── Resolve contactId ───
        // Path 1 (fast): contactId from tag — no secondary DB fetch needed
        let resolvedContactId: string | null = tagContactId;

        // Path 2 (fallback): if no tag, try the matching lead_activities doc
        if (!resolvedContactId && entityType === 'lead') {
            const actSnap = await db.collection('lead_activities')
                .where('metadata.resendId', '==', emailId)
                .limit(1)
                .get();
            if (!actSnap.empty) {
                resolvedContactId = actSnap.docs[0].data().contactId
                    || actSnap.docs[0].data().metadata?.contactId
                    || null;
            }
        }

        if (!entityId || !entityType) {
            logger.warn(`Resend webhook: could not resolve entity for emailId ${emailId}`);
            res.status(200).json({ ok: true, notFound: true });
            return;
        }

        // ─── Detect unsubscribe clicks ────────────────────────────
        // If the recipient clicked the unsubscribe link, this is NOT genuine
        // engagement. Record it separately and skip engagement escalation.
        const clickedUrl = event?.data?.click?.link || event?.data?.click?.url || '';
        const isUnsubscribeClick = eventType === 'email.clicked' &&
            (clickedUrl.includes('/handleUnsubscribe') || clickedUrl.includes('unsubscribe'));

        if (isUnsubscribeClick) {
            logger.info(`Resend webhook: unsubscribe link clicked for ${entityType} ${entityId} — skipping engagement escalation`);
        }

        // Use a modified mapping for unsubscribe clicks
        const effectiveMapping = isUnsubscribeClick
            ? { ...mapping, activityType: 'EMAIL_UNSUBSCRIBE_CLICKED', deliveryStatus: mapping.deliveryStatus, description: 'Recipient clicked the unsubscribe link.' }
            : mapping;

        // ─── Log activity to the correct collection ───
        const activitiesCollection = entityType === 'vendor' ? 'vendor_activities' : 'lead_activities';
        const idField = entityType === 'vendor' ? 'vendorId' : 'leadId';

        const activityData: Record<string, any> = {
            [idField]: entityId,
            type: effectiveMapping.activityType,
            description: effectiveMapping.description,
            createdAt: new Date(),
            metadata: {
                resendId: emailId,
                deliveryStatus: effectiveMapping.deliveryStatus,
                rawEvent: eventType,
                to: event?.data?.to?.[0] || undefined,
                ...(isUnsubscribeClick ? { clickedUrl, isUnsubscribeClick: true } : {}),
            }
        };

        // Add contactId for lead activities
        if (entityType === 'lead' && resolvedContactId) {
            activityData.contactId = resolvedContactId;
            activityData.metadata.contactId = resolvedContactId;
        }

        await db.collection(activitiesCollection).add(activityData);

        // ─── Update entity doc engagement cache ───
        // Resolve the correct collection for leads (companies first, then leads)
        let entityCollection: string;
        if (entityType === 'vendor') {
            entityCollection = 'vendors';
        } else {
            // Match the dual-collection pattern used everywhere else
            const companyDoc = await db.collection('companies').doc(entityId).get();
            entityCollection = companyDoc.exists ? 'companies' : 'leads';
        }

        // Priority map: higher number = higher engagement level. Never downgrade.
        const ENGAGEMENT_PRIORITY: Record<string, number> = {
            delivered: 1,
            opened: 2,
            clicked: 3,
            bounced: 0,   // bounced is a failure state, always record it
            spam: 0,
        };

        const engagementUpdate: Record<string, any> = {
            'emailEngagement.lastEventAt': new Date(),
        };

        // Only update lastEvent if the new event is higher priority than current
        const newPriority = ENGAGEMENT_PRIORITY[mapping.deliveryStatus] ?? 0;
        let shouldUpdateLastEvent = true;

        let currentEntityStatus: string | undefined;

        try {
            const entityDoc = await db.collection(entityCollection).doc(entityId).get();
            const currentEvent = entityDoc.data()?.emailEngagement?.lastEvent;
            currentEntityStatus = entityDoc.data()?.status;
            const currentPriority = ENGAGEMENT_PRIORITY[currentEvent] ?? -1;

            if (newPriority > 0 && currentPriority >= newPriority) {
                // Current engagement is already higher — don't downgrade
                shouldUpdateLastEvent = false;
                logger.info(`${entityType} ${entityId}: skipping lastEvent downgrade (${currentEvent} → ${mapping.deliveryStatus})`);
            }
        } catch (readErr) {
            // If we can't read current state, still update (safe default)
            logger.warn(`Could not read current engagement for ${entityType} ${entityId}:`, readErr);
        }

        if (shouldUpdateLastEvent && !isUnsubscribeClick) {
            engagementUpdate['emailEngagement.lastEvent'] = effectiveMapping.deliveryStatus;
        }

        if (eventType === 'email.opened') {
            engagementUpdate['emailEngagement.openCount'] = admin.firestore.FieldValue.increment(1);
        } else if (eventType === 'email.clicked' && !isUnsubscribeClick) {
            // Only count genuine content clicks, not unsubscribe link clicks
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

        try {
            await db.collection(entityCollection).doc(entityId).update(engagementUpdate);
            logger.info(`${entityType} ${entityId}: emailEngagement updated (${mapping.deliveryStatus}, lastEvent=${shouldUpdateLastEvent ? 'updated' : 'preserved'})`);
        } catch (engErr) {
            logger.warn(`Failed to update ${entityType} engagement:`, engErr);
        }

        if (
            entityType === 'lead' &&
            currentEntityStatus === 'new' &&
            !isUnsubscribeClick &&
            ['email.delivered', 'email.opened', 'email.clicked'].includes(eventType)
        ) {
            try {
                await db.collection(entityCollection).doc(entityId).update({
                    status: 'contacted',
                    updatedAt: new Date(),
                });
                logger.info(`${entityType} ${entityId}: promoted status new -> contacted after ${eventType}`);
            } catch (statusErr) {
                logger.warn(`Failed to promote ${entityType} ${entityId} to contacted:`, statusErr);
            }
        }

        // ─── Mirror engagement to contact doc ────────────────────────
        // The CRM funnel reads emailEngagement from the contacts collection,
        // so we must write it there too (not just on the entity doc).
        if (resolvedContactId) {
            const contactEngagement: Record<string, any> = {
                'emailEngagement.lastEventAt': new Date(),
            };

            if (shouldUpdateLastEvent && !isUnsubscribeClick) {
                contactEngagement['emailEngagement.lastEvent'] = effectiveMapping.deliveryStatus;
            }
            if (['email.delivered', 'email.opened', 'email.clicked'].includes(eventType) && !isUnsubscribeClick) {
                contactEngagement.emailStatus = 'deliverable';
                contactEngagement.suppressionReason = null;
                contactEngagement.lastValidatedAt = new Date();
                contactEngagement.validationSource = 'resend';
            }
            if (eventType === 'email.opened') {
                contactEngagement['emailEngagement.openCount'] = admin.firestore.FieldValue.increment(1);
            } else if (eventType === 'email.clicked' && !isUnsubscribeClick) {
                contactEngagement['emailEngagement.clickCount'] = admin.firestore.FieldValue.increment(1);
            }

            try {
                await db.collection('contacts').doc(resolvedContactId).update(contactEngagement);
                logger.info(`Contact ${resolvedContactId}: emailEngagement mirrored (${mapping.deliveryStatus})`);
            } catch (contactErr) {
                logger.warn(`Failed to mirror engagement to contact ${resolvedContactId}:`, contactErr);
            }
        }

        // ─── Auto-suppress on bounce / spam complaint ─────────────────
        // Dismiss vendor or mark lead as lost, and cancel all pending tasks
        // so we stop wasting queue cycles on undeliverable addresses.
        if (eventType === 'email.bounced' || eventType === 'email.complained') {
            const reason = eventType === 'email.bounced' ? 'hard_bounce' : 'spam_complaint';
            const reasonLabel = eventType === 'email.bounced' ? 'Hard bounce' : 'Spam complaint';
            const recipientEmail = event?.data?.to?.[0];

            // Sync to Resend suppression audience
            if (recipientEmail) {
                await addToResendSuppression(recipientEmail, reason as any, {
                    entityId: entityId!,
                    entityType: entityType!,
                });
            }

            try {
                if (entityType === 'vendor') {
                    // Check if already dismissed
                    const vendorDoc = await db.collection('vendors').doc(entityId).get();
                    if (vendorDoc.exists && vendorDoc.data()?.status !== 'dismissed') {
                        await db.collection('vendors').doc(entityId).update({
                            status: 'dismissed',
                            statusUpdatedAt: new Date(),
                            dismissReason: reason,
                            unsubscribedAt: new Date(),
                        });

                        const cancelledCount = await cancelVendorTasks(db, entityId);

                        await db.collection('vendor_activities').add({
                            vendorId: entityId,
                            type: 'STATUS_CHANGE',
                            description: `${reasonLabel} detected — vendor auto-dismissed. ${cancelledCount} pending tasks cancelled.`,
                            createdAt: new Date(),
                            metadata: { from: vendorDoc.data()?.status, to: 'dismissed', trigger: reason, cancelledTasks: cancelledCount },
                        });

                        logger.info(`[AutoSuppress] Vendor ${entityId} dismissed (${reason}). ${cancelledCount} tasks cancelled.`);
                    }
                } else if (entityType === 'lead') {
                    // Check companies first, then leads collection
                    let leadDoc = await db.collection('companies').doc(entityId).get();
                    let leadCollection = 'companies';
                    if (!leadDoc.exists) {
                        leadDoc = await db.collection('leads').doc(entityId).get();
                        leadCollection = 'leads';
                    }

                    if (leadDoc.exists && leadDoc.data()?.status !== 'lost') {
                        const prevStatus = leadDoc.data()?.status;
                        await db.collection(leadCollection).doc(entityId).update({
                            status: 'lost',
                            lostReason: reason,
                            unsubscribedAt: new Date(),
                            outreachStatus: reason === 'spam_complaint' ? 'SPAM_COMPLAINT' : 'BOUNCED',
                        });

                        const cancelledCount = await cancelLeadTasks(db, entityId);

                        // Cancel any Resend-native-scheduled emails too
                        const resendCancelled = await cancelLeadScheduledEmails(db, entityId, leadCollection as 'companies' | 'leads');

                        // Also mark contact as unsubscribed if we have one
                        if (resolvedContactId) {
                            await db.collection('contacts').doc(resolvedContactId).update({
                                unsubscribed: true,
                                unsubscribedAt: new Date(),
                                unsubscribeReason: reason,
                                lifecycleStatus: 'suppressed',
                                lifecycleReason: reason,
                                lifecycleUpdatedAt: new Date(),
                                emailStatus: reason === 'spam_complaint' ? 'spam' : 'bounced',
                                suppressionReason: reason,
                                lastValidatedAt: new Date(),
                                validationSource: 'resend',
                            });
                        }

                        await db.collection('lead_activities').add({
                            leadId: entityId,
                            contactId: resolvedContactId || null,
                            type: 'STATUS_CHANGE',
                            description: `${reasonLabel} detected — lead auto-marked as lost. ${cancelledCount} queue tasks + ${resendCancelled} scheduled emails cancelled.`,
                            createdAt: new Date(),
                            metadata: { from: prevStatus, to: 'lost', trigger: reason, cancelledTasks: cancelledCount, resendCancelled, contactId: resolvedContactId || null },
                        });

                        logger.info(`[AutoSuppress] Lead ${entityId} marked lost (${reason}). ${cancelledCount} queue tasks + ${resendCancelled} Resend emails cancelled.`);
                    }
                }
            } catch (suppressErr) {
                // Non-critical — don't fail the webhook, but log prominently
                logger.error(`[AutoSuppress] Failed to suppress ${entityType} ${entityId}:`, suppressErr);
            }
        }

        // ─── Template Stats Tracking (for A/B testing analytics) ───
        try {
            let templateId: string | null = null;

            // Path 1: Read templateId from Resend tags
            if (tags) {
                const getTag = (key: string): string | null => {
                    if (typeof tags === 'object' && !Array.isArray(tags) && tags[key]) return tags[key];
                    if (Array.isArray(tags)) {
                        const found = tags.find((t: any) => t.name === key);
                        return found?.value || null;
                    }
                    return null;
                };
                templateId = getTag('templateId');
            }

            // Path 2: Fallback — query activity to find templateId (legacy emails without tag)
            if (!templateId) {
                const sentActivity = await db.collection(activitiesCollection)
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

        logger.info(`Resend webhook: processed ${eventType} for ${entityType} ${entityId}`);
        res.status(200).json({ ok: true, processed: eventType });

    } catch (error) {
        logger.error('Resend webhook error:', error);
        res.status(500).json({ error: 'Internal error' });
    }
});
