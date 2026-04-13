/**
 * suppressionUtils.ts — Resend Audience suppression layer
 *
 * Centralizes all interactions with Resend's Contacts/Audience API so
 * every unsubscribe path (link click, bounce, complaint) syncs to Resend
 * and every send path checks Resend suppression before dispatching.
 *
 * The audience ID is stored in Firestore at `config/resend` → `audienceId`.
 * Set it once via the Firebase console or a setup script.
 */

import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();
let _cachedAudienceId: string | null = null;

/** Lazily resolve the Resend audience ID from Firestore config. */
async function getAudienceId(): Promise<string | null> {
    if (_cachedAudienceId) return _cachedAudienceId;

    try {
        const doc = await db.collection('config').doc('resend').get();
        _cachedAudienceId = doc.data()?.audienceId || null;
    } catch (err) {
        logger.warn('[Suppression] Could not read config/resend.audienceId:', err);
    }
    return _cachedAudienceId;
}

function getResend(): Resend {
    return new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Add (or update) a contact in the Resend audience as **unsubscribed**.
 *
 * Call this from every unsubscribe path:
 *   - handleUnsubscribe (link click)
 *   - resendWebhook (bounce / spam complaint)
 *   - manual CRM actions
 *
 * Resend will refuse to deliver any future email to this address if
 * it's marked unsubscribed in the audience.
 */
export async function addToResendSuppression(
    email: string,
    reason: 'unsubscribed' | 'hard_bounce' | 'spam_complaint',
    metadata?: { entityId?: string; entityType?: 'vendor' | 'lead'; contactId?: string },
): Promise<boolean> {
    const audienceId = await getAudienceId();
    if (!audienceId) {
        logger.warn(`[Suppression] No audienceId configured — skipping Resend suppression for ${email}`);
        return false;
    }

    const resend = getResend();

    try {
        // Try to create the contact first. If they already exist, update them.
        const { error } = await resend.contacts.create({
            audienceId,
            email,
            unsubscribed: true,
            firstName: metadata?.entityType || '',
            lastName: reason, // Stash the reason in lastName for visibility in Resend dashboard
        });

        if (error) {
            // Contact might already exist — try updating instead
            try {
                // List contacts to find the existing one
                const { data: listData } = await resend.contacts.list({ audienceId });
                const existing = (listData as any)?.data?.find((c: any) => c.email === email);

                if (existing) {
                    await resend.contacts.update({
                        audienceId,
                        id: existing.id,
                        unsubscribed: true,
                        lastName: reason,
                    });
                    logger.info(`[Suppression] Updated existing Resend contact ${email} → unsubscribed (${reason})`);
                    return true;
                }
            } catch (updateErr) {
                logger.warn(`[Suppression] Could not update contact ${email}:`, updateErr);
            }

            logger.warn(`[Suppression] Resend contacts.create error for ${email}:`, error);
            return false;
        }

        logger.info(`[Suppression] Added ${email} to Resend suppression audience (${reason})`);
        return true;
    } catch (err) {
        logger.error(`[Suppression] Failed to sync ${email} to Resend audience:`, err);
        return false;
    }
}

/**
 * Check whether an email address is suppressed in Resend.
 *
 * Returns `true` if the email should NOT receive messages.
 * Falls back to Firestore contact/lead-level `unsubscribed` flag
 * if Resend audience is unavailable.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
    // ── Path 1: Firestore contact-level check (always run) ──
    try {
        const contactSnap = await db.collection('contacts')
            .where('email', '==', email)
            .where('unsubscribed', '==', true)
            .limit(1)
            .get();
        if (!contactSnap.empty) {
            logger.info(`[Suppression] ${email} suppressed via Firestore contact`);
            return true;
        }
    } catch { /* non-critical */ }

    // ── Path 2: Resend audience check ──
    const audienceId = await getAudienceId();
    if (!audienceId) return false; // No audience configured — rely on Firestore only

    try {
        const resend = getResend();
        const { data: listData } = await resend.contacts.list({ audienceId });
        const contact = (listData as any)?.data?.find((c: any) => c.email === email);

        if (contact?.unsubscribed) {
            logger.info(`[Suppression] ${email} suppressed via Resend audience`);
            return true;
        }
    } catch (err) {
        // Non-fatal — if we can't reach Resend, rely on Firestore check above
        logger.warn(`[Suppression] Resend audience check failed for ${email}:`, err);
    }

    return false;
}

/**
 * Remove suppression for an email (e.g., if someone re-subscribes).
 */
export async function removeFromResendSuppression(email: string): Promise<boolean> {
    const audienceId = await getAudienceId();
    if (!audienceId) return false;

    try {
        const resend = getResend();
        const { data: listData } = await resend.contacts.list({ audienceId });
        const contact = (listData as any)?.data?.find((c: any) => c.email === email);

        if (contact) {
            await resend.contacts.update({
                audienceId,
                id: contact.id,
                unsubscribed: false,
            });
            logger.info(`[Suppression] Removed ${email} from Resend suppression`);
            return true;
        }
    } catch (err) {
        logger.error(`[Suppression] Failed to remove suppression for ${email}:`, err);
    }

    return false;
}
