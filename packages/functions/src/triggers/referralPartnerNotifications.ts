/**
 * Referral Partner Email Notifications
 *
 * Fires on `referral_leads/{referralId}` create + update.
 * Sends branded emails at each milestone:
 *   1. Submission confirmation  (status: 'new')
 *   2. Walkthrough scheduled    (status: 'walkthrough_scheduled')
 *   3. Walkthrough payment sent (status: 'walkthrough_paid')
 *   4. Close payment sent       (status: 'close_paid')
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { sendEmail, buildSimpleFooter } from "../utils/emailUtils";
import * as admin from "firebase-admin";

const db = admin.firestore();
const TIMEOUT_SECONDS = 120;

// Payout constants — must match dlp-referral-partners.ts
const WALKTHROUGH_BONUS = 100;
const CLOSE_BONUS = 400;
const RECURRING_BONUS = 50;

const PAYMENT_INFO_BASE = "https://xiri.ai/referral/payment-info";

/* ─── Main trigger ──────────────────────────────────────────────── */

export const onReferralLeadWritten = onDocumentWritten({
    document: "referral_leads/{referralId}",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: TIMEOUT_SECONDS,
}, async (event) => {
    if (!event.data) return;

    const referralId = event.params.referralId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Deletion — ignore
    if (!after) return;

    // ── New document created ──
    if (!before) {
        await sendSubmissionConfirmation(referralId, after);
        return;
    }

    // ── Status changed ──
    const oldStatus = before.status;
    const newStatus = after.status;
    if (oldStatus === newStatus) return;

    logger.info(`[Referral] ${referralId} status: ${oldStatus} → ${newStatus}`);

    switch (newStatus) {
        case "walkthrough_scheduled":
            await sendWalkthroughScheduled(referralId, after);
            break;
        case "walkthrough_paid":
            await sendPaymentNotification(referralId, after, "walkthrough");
            break;
        case "close_paid":
            await sendPaymentNotification(referralId, after, "close");
            break;
        default:
            logger.info(`[Referral] No email for status: ${newStatus}`);
    }
});

/* ─── Email 1: Submission Confirmation ──────────────────────────── */

async function sendSubmissionConfirmation(referralId: string, data: any) {
    const { referrerName, referrerEmail, buildingName } = data;
    if (!referrerEmail) return;

    const firstName = referrerName?.split(" ")[0] || "there";

    const subject = `Referral received — ${buildingName}`;
    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px;">Thanks for the referral, ${firstName}!</h1>
        <p style="color: #475569; line-height: 1.6;">
            We've received your referral for <strong>${buildingName}</strong> and will reach out to them within <strong>24 hours</strong>.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #166534;">Your Payout Timeline</p>
            ${payoutStep("1", "We contact the building", "Within 24 hours", false)}
            ${payoutStep("2", "You join us for the walkthrough", `$${WALKTHROUGH_BONUS} paid to you`, false)}
            ${payoutStep("3", "Cleaning contract goes live", `$${CLOSE_BONUS} paid to you`, false)}
            ${payoutStep("4", "Recurring monthly payout", `$${RECURRING_BONUS}/mo for life of contract`, false)}
        </div>

        <p style="color: #475569; line-height: 1.6;">
            We'll keep you updated by email at every step. If you have any questions, just reply to this email.
        </p>

        <p style="color: #475569;">
            Know another building? <a href="https://xiri.ai/refer" style="color: #059669; font-weight: 600;">Refer another one →</a>
        </p>
    `);

    const result = await sendEmail(referrerEmail, subject, html);
    await logActivity(referralId, "SUBMISSION_EMAIL_SENT", subject, referrerEmail, result.success);
}

/* ─── Email 2: Walkthrough Scheduled ────────────────────────────── */

async function sendWalkthroughScheduled(referralId: string, data: any) {
    const { referrerName, referrerEmail, buildingName } = data;
    if (!referrerEmail) return;

    const firstName = referrerName?.split(" ")[0] || "there";
    const paymentLink = `${PAYMENT_INFO_BASE}/${referralId}`;

    const subject = `Great news — we're visiting ${buildingName}!`;
    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px;">Walkthrough scheduled! 🎉</h1>
        <p style="color: #475569; line-height: 1.6;">
            Hey ${firstName}, great news — we've scheduled a walkthrough at <strong>${buildingName}</strong>.
            ${data.walkthroughDate ? `It's set for <strong>${data.walkthroughDate}</strong>.` : ""}
        </p>

        <p style="color: #475569; line-height: 1.6;">
            When you join us for the walkthrough, we'll pay you <strong>$${WALKTHROUGH_BONUS}</strong>.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #166534;">Your Payout Timeline</p>
            ${payoutStep("1", "We contact the building", "Done ✓", true)}
            ${payoutStep("2", "You join us for the walkthrough", `$${WALKTHROUGH_BONUS} paid to you`, false, true)}
            ${payoutStep("3", "Cleaning contract goes live", `$${CLOSE_BONUS} paid to you`, false)}
            ${payoutStep("4", "Recurring monthly payout", `$${RECURRING_BONUS}/mo for life of contract`, false)}
        </div>

        <p style="color: #475569; line-height: 1.6; font-weight: 600;">
            Before the walkthrough, please submit your payment info so we can pay you fast:
        </p>

        <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentLink}"
               style="display: inline-block; background: #059669; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Submit Payment Info →
            </a>
        </div>

        <p style="color: #94a3b8; font-size: 13px;">
            We accept Venmo, PayPal, or direct bank transfer (ACH).
        </p>
    `);

    const result = await sendEmail(referrerEmail, subject, html);
    await logActivity(referralId, "WALKTHROUGH_SCHEDULED_EMAIL_SENT", subject, referrerEmail, result.success);
}

/* ─── Emails 3 & 4: Payment Notifications ───────────────────────── */

async function sendPaymentNotification(
    referralId: string,
    data: any,
    type: "walkthrough" | "close"
) {
    const { referrerName, referrerEmail, buildingName } = data;
    if (!referrerEmail) return;

    const firstName = referrerName?.split(" ")[0] || "there";
    const isWalkthrough = type === "walkthrough";
    const amount = isWalkthrough ? WALKTHROUGH_BONUS : CLOSE_BONUS;

    const subject = isWalkthrough
        ? `Your $${amount} walkthrough payment is on the way!`
        : `Your $${amount} payment is on the way — plus $${RECURRING_BONUS}/mo recurring!`;

    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px;">
            ${isWalkthrough ? "Walkthrough payment sent! 💰" : "Contract closed — payday! 🎉💰"}
        </h1>
        <p style="color: #475569; line-height: 1.6;">
            Hey ${firstName}, we've sent <strong>$${amount}</strong> to your ${data.paymentInfo?.method || "account"} for your referral of <strong>${buildingName}</strong>.
        </p>

        ${isWalkthrough ? `
        <p style="color: #475569; line-height: 1.6;">
            Next up: when the cleaning contract goes live, you'll receive another <strong>$${CLOSE_BONUS}</strong> — plus <strong>$${RECURRING_BONUS}/mo</strong> recurring.
        </p>
        ` : `
        <p style="color: #475569; line-height: 1.6;">
            And now the best part — you'll receive <strong>$${RECURRING_BONUS} every month</strong> for the life of this contract. That's passive income just for making an introduction.
        </p>
        `}

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #166534;">Your Payout Timeline</p>
            ${payoutStep("1", "We contact the building", "Done ✓", true)}
            ${payoutStep("2", "Walkthrough bonus", `$${WALKTHROUGH_BONUS} ${isWalkthrough ? "PAID ✓" : "Done ✓"}`, true)}
            ${payoutStep("3", "Contract close bonus", isWalkthrough ? `$${CLOSE_BONUS} — coming next` : `$${CLOSE_BONUS} PAID ✓`, !isWalkthrough, !isWalkthrough)}
            ${payoutStep("4", "Recurring monthly", `$${RECURRING_BONUS}/mo ${isWalkthrough ? "coming soon" : "starts now"}`, !isWalkthrough)}
        </div>

        <p style="color: #475569; line-height: 1.6;">
            Know another building? Every referral is another income stream.
            <a href="https://xiri.ai/refer" style="color: #059669; font-weight: 600;">Refer another one →</a>
        </p>
    `);

    const result = await sendEmail(referrerEmail, subject, html);
    await logActivity(referralId, `${type.toUpperCase()}_PAYMENT_EMAIL_SENT`, subject, referrerEmail, result.success);
}

/* ─── Helpers ───────────────────────────────────────────────────── */

/** Branded email wrapper */
function wrapEmail(body: string): string {
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px;">
        ${body}

        ${buildSimpleFooter()}
    </div>`;
}

/** Single step in the payout timeline */
function payoutStep(num: string, label: string, detail: string, done: boolean, current = false): string {
    const bgColor = done ? "#dcfce7" : current ? "#fef9c3" : "#f8fafc";
    const textColor = done ? "#166534" : current ? "#854d0e" : "#475569";
    const borderColor = done ? "#bbf7d0" : current ? "#fde68a" : "#e2e8f0";
    return `
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 6px;">
        <span style="background: ${done ? "#059669" : current ? "#eab308" : "#cbd5e1"}; color: white; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">${done ? "✓" : num}</span>
        <div>
            <p style="margin: 0; font-weight: 600; color: ${textColor}; font-size: 14px;">${label}</p>
            <p style="margin: 2px 0 0; color: ${textColor}; font-size: 13px; opacity: 0.8;">${detail}</p>
        </div>
    </div>`;
}

/** Log email activity to referral_activities */
async function logActivity(referralId: string, type: string, subject: string, to: string, success: boolean) {
    try {
        await db.collection("referral_leads").doc(referralId).collection("activities").add({
            type: success ? type : type.replace("_SENT", "_FAILED"),
            description: `${success ? "Email sent" : "Email failed"}: ${subject}`,
            to,
            subject,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        logger.error(`[Referral] Failed to log activity for ${referralId}:`, err);
    }
}
