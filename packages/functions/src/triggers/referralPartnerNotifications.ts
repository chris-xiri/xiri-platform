/**
 * Referral Partner Notifications & Server-Side Prospect Queue / Vendor Sync
 *
 * Fires on `referral_leads/{referralId}` create + update.
 * On create:
 *   1. Sync referrer into `vendors` pipeline (deduplicated by email) via Admin SDK
 *   2. Queue referred building into `prospect_queue` (`source: 'referral'`, tagged with referrer details)
 *      so it lives in Sales → Prospects for review/enrichment before importing into CRM & Contracts
 *   3. Send submission confirmation email to referrer WITH a full summary of their submitted details
 *   4. Send internal notification email to chris@xiri.ai
 * On milestone status updates (`payoutStatus` or `status`):
 *   - walkthrough_scheduled
 *   - walkthrough_paid
 *   - close_paid
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { sendEmail, buildSimpleFooter } from "../utils/emailUtils";
import { db, admin } from "../utils/firebase";

const TIMEOUT_SECONDS = 120;
const INTERNAL_NOTIFY_EMAIL = "chris@xiri.ai";
const REFERRAL_CHAT_WEBHOOK =
    "https://chat.googleapis.com/v1/spaces/AAQAPUtlQy8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=b-fnG1EgCa51jupyFoCoPWGhtErrT7AUDRh4vuWTKqE";

// Payout constants — must match dlp-referral-partners.ts
const WALKTHROUGH_BONUS = 100;
const CLOSE_BONUS = 400;
const RECURRING_BONUS = 50;

const PAYMENT_INFO_BASE = "https://xiri.ai/referral/payment-info";

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatTradeLabel(trade: unknown): string {
    return String(trade || "other")
        .replace(/-referral-partner$/, "")
        .replace(/-/g, " ")
        .trim() || "other";
}

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
        await Promise.allSettled([
            syncReferralToProspectQueueAndVendors(referralId, after),
            sendSubmissionConfirmation(referralId, after),
            sendInternalReferralAlert(referralId, after),
            sendReferralChatNotification(referralId, after),
        ]);
        return;
    }

    // ── Status changed (dashboard updates `payoutStatus`, legacy/scripts may update `status`) ──
    const oldStatus = before.payoutStatus || before.status;
    const newStatus = after.payoutStatus || after.status;
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

/* ─── Server-side Prospect Queue + Vendor Sync (Admin SDK) ──────── */

async function syncReferralToProspectQueueAndVendors(referralId: string, data: FirebaseFirestore.DocumentData) {
    if (data.syncedToProspectQueueAt) return;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const tradeSlug = String(data.trade || "other").trim() || "other";
    const tradeLabel = formatTradeLabel(tradeSlug);
    const buildingName = String(data.buildingName || "").trim();
    const buildingAddress = String(data.buildingAddress || "").trim();
    const managerName = String(data.managerName || "").trim();
    const managerEmail = String(data.managerEmail || "").trim().toLowerCase();
    const managerPhone = String(data.managerPhone || "").trim();
    const referrerName = String(data.referrerName || "").trim();
    const referrerEmail = String(data.referrerEmail || "").trim().toLowerCase();
    const referrerPhone = String(data.referrerPhone || "").trim();
    const sourceSlug = String(data.source || "hub").trim();
    const sourcePage = sourceSlug === "hub" || sourceSlug === "direct" ? "/refer" : `/refer/${sourceSlug}`;
    const notes = String(data.notes || "").trim();

    let vendorId: string | null = null;
    let prospectQueueId: string | null = null;

    // 1. Sync referrer into contractor/vendor pipeline (deduplicated by email)
    try {
        if (referrerEmail) {
            const existingVendor = await db.collection("vendors")
                .where("email", "==", referrerEmail)
                .limit(1)
                .get();

            if (!existingVendor.empty) {
                vendorId = existingVendor.docs[0].id;
            }
        }

        if (!vendorId && (referrerName || referrerEmail)) {
            const vendorRef = await db.collection("vendors").add({
                businessName: referrerName || referrerEmail,
                contactName: referrerName,
                email: referrerEmail,
                phone: referrerPhone,
                trade: tradeLabel,
                capabilities: tradeLabel !== "other" && tradeLabel !== "general" ? [tradeLabel] : [],
                status: "qualified",
                source: "referral_partner",
                notes: `Referral partner who referred ${buildingName}`,
                referralLeadId: referralId,
                createdAt: now,
                updatedAt: now,
            });
            vendorId = vendorRef.id;
            logger.info(`[Referral] Created vendor=${vendorId} for referrer ${referrerEmail}`);
        }
    } catch (err) {
        logger.error(`[Referral] Failed to sync referrer vendor for ${referralId}:`, err);
    }

    // 2. Add referred building to `prospect_queue` under dedicated `source: 'referral'` channel
    //    Tagged with complete referrer metadata so it flows cleanly into CRM -> Quotes -> Contracts -> Payouts.
    try {
        const today = new Date().toISOString().split("T")[0];
        const prospectRef = db.collection("prospect_queue").doc();
        prospectQueueId = prospectRef.id;

        await prospectRef.set({
            businessName: buildingName || "Referred Building",
            address: buildingAddress || null,
            phone: managerPhone || null,
            contactName: managerName || null,
            contactEmail: managerEmail || null,
            contactTitle: managerName ? "Building Manager" : null,
            emailSource: managerEmail ? "referral_form" : null,
            emailConfidence: managerEmail ? "high" : "low",
            status: "pending_review",
            source: "referral",
            batchDate: today,
            searchQuery: `referral:${tradeLabel}`,
            searchLocation: buildingAddress || "Nassau County, NY",
            notes: notes || null,
            referralLeadId: referralId,
            referralData: {
                referralLeadId: referralId,
                referrerName,
                referrerEmail,
                referrerPhone,
                trade: tradeLabel,
                tradeSlug,
                vendorId: vendorId || null,
                sourcePage,
                notes: notes || null,
                walkthroughBonus: WALKTHROUGH_BONUS,
                closeBonus: CLOSE_BONUS,
                recurringBonus: RECURRING_BONUS,
            },
            createdAt: now,
            updatedAt: now,
        });

        logger.info(`[Referral] Queued ${referralId} into prospect_queue=${prospectQueueId}`);
    } catch (err) {
        logger.error(`[Referral] Failed to queue ${referralId} into prospect_queue:`, err);
    }

    // 3. Link created records back onto referral_leads (idempotency marker)
    try {
        await db.collection("referral_leads").doc(referralId).set({
            ...(prospectQueueId ? { prospectQueueId } : {}),
            ...(vendorId ? { vendorId } : {}),
            syncedToProspectQueueAt: now,
        }, { merge: true });
    } catch (err) {
        logger.error(`[Referral] Failed to record sync links on ${referralId}:`, err);
    }
}

/* ─── Internal Alert Email ──────────────────────────────────────── */

async function sendInternalReferralAlert(referralId: string, data: FirebaseFirestore.DocumentData) {
    const buildingName = escapeHtml(data.buildingName || "Unnamed Building");
    const buildingAddress = escapeHtml(data.buildingAddress || "Not provided");
    const referrerName = escapeHtml(data.referrerName || "Unknown");
    const referrerEmail = escapeHtml(data.referrerEmail || "N/A");
    const referrerPhone = escapeHtml(data.referrerPhone || "N/A");
    const trade = escapeHtml(formatTradeLabel(data.trade));
    const managerName = escapeHtml(data.managerName || "Not provided");
    const managerEmail = escapeHtml(data.managerEmail || "Not provided");
    const managerPhone = escapeHtml(data.managerPhone || "Not provided");
    const notes = escapeHtml(data.notes || "None");
    const source = escapeHtml(data.source || "direct");

    const subject = `🤝 New Referral Lead: ${data.buildingName || "Building"} (via ${data.referrerName || "Partner"})`;
    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px; font-size: 22px;">New Building Referral</h1>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
            <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Building</td><td style="padding: 6px 0; font-weight: 600;">${buildingName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Address</td><td style="padding: 6px 0;">${buildingAddress}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Manager</td><td style="padding: 6px 0;">${managerName} · ${managerEmail} · ${managerPhone}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Referred By</td><td style="padding: 6px 0; font-weight: 600;">${referrerName} (${trade})</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Referrer Contact</td><td style="padding: 6px 0;">${referrerEmail} · ${referrerPhone}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Source Page</td><td style="padding: 6px 0;">/refer/${source}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Notes</td><td style="padding: 6px 0;">${notes}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Referral ID</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${escapeHtml(referralId)}</td></tr>
        </table>
        <div style="margin-top: 24px;">
            <a href="https://app.xiri.ai/sales/prospects"
               style="display: inline-block; background: #059669; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-right: 10px;">
                Review in Prospects →
            </a>
            <a href="https://app.xiri.ai/sales/referrals"
               style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #cbd5e1;">
                Referral Payouts
            </a>
        </div>
    `);

    const result = await sendEmail(INTERNAL_NOTIFY_EMAIL, subject, html);
    await logActivity(referralId, "INTERNAL_ALERT_SENT", subject, INTERNAL_NOTIFY_EMAIL, result.success);
}

/* ─── Google Chat Notification ──────────────────────────────────── */

async function sendReferralChatNotification(referralId: string, data: FirebaseFirestore.DocumentData) {
    const buildingName = String(data.buildingName || "Unnamed Building").trim();
    const buildingAddress = String(data.buildingAddress || "Not provided").trim();
    const referrerName = String(data.referrerName || "Unknown Partner").trim();
    const referrerEmail = String(data.referrerEmail || "").trim();
    const referrerPhone = String(data.referrerPhone || "").trim();
    const trade = formatTradeLabel(data.trade);
    const managerName = String(data.managerName || "").trim();
    const managerEmail = String(data.managerEmail || "").trim();
    const managerPhone = String(data.managerPhone || "").trim();
    const notes = String(data.notes || "").trim();
    const source = String(data.source || "hub").trim();

    const managerSummary = [managerName, managerEmail, managerPhone].filter(Boolean).join(" · ") || "Not provided";
    const referrerContact = [referrerEmail, referrerPhone].filter(Boolean).join(" · ") || "N/A";

    const chatCard = {
        header: {
            title: "🤝 New Building Referral",
            subtitle: `${buildingName} • via ${referrerName}${trade && trade !== "other" ? ` (${trade})` : ""}`,
            imageUrl: "https://xiri.ai/icon.png",
            imageType: "CIRCLE",
        },
        sections: [
            {
                header: "Referred Building",
                widgets: [
                    {
                        decoratedText: {
                            topLabel: "BUILDING",
                            text: buildingName,
                            startIcon: { knownIcon: "STORE" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "ADDRESS",
                            text: buildingAddress,
                            startIcon: { knownIcon: "MAP_PIN" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "BUILDING MANAGER",
                            text: managerSummary,
                            startIcon: { knownIcon: "PERSON" },
                        },
                    },
                    ...(notes ? [{
                        decoratedText: {
                            topLabel: "NOTES",
                            text: notes,
                            wrapText: true,
                        },
                    }] : []),
                ],
            },
            {
                header: "Referral Partner",
                widgets: [
                    {
                        decoratedText: {
                            topLabel: "REFERRER",
                            text: `${referrerName}${trade && trade !== "other" ? ` (${trade})` : ""}`,
                            startIcon: { knownIcon: "MEMBERSHIP" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "CONTACT",
                            text: referrerContact,
                            startIcon: { knownIcon: "EMAIL" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "SOURCE PAGE",
                            text: source === "hub" || source === "direct" ? "/refer" : `/refer/${source}`,
                        },
                    },
                ],
            },
            {
                widgets: [
                    {
                        buttonList: {
                            buttons: [
                                {
                                    text: "Review in Prospects",
                                    onClick: { openLink: { url: "https://app.xiri.ai/sales/prospects" } },
                                },
                                {
                                    text: "Referral Payouts",
                                    onClick: { openLink: { url: "https://app.xiri.ai/sales/referrals" } },
                                },
                                ...(referrerEmail ? [{
                                    text: "Email Referrer",
                                    onClick: { openLink: { url: `mailto:${referrerEmail}` } },
                                }] : []),
                            ],
                        },
                    },
                ],
            },
        ],
    };

    try {
        const resp = await fetch(REFERRAL_CHAT_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `🤝 New Referral: ${buildingName} (${buildingAddress}) — referred by ${referrerName} (${trade})`,
                cardsV2: [{ cardId: `referral-lead-${referralId}`, card: chatCard }],
            }),
        });
        if (!resp.ok) {
            const errText = await resp.text();
            logger.error(`[Referral] Google Chat webhook failed (${resp.status}):`, errText);
            await logActivity(referralId, "CHAT_ALERT_FAILED", `Google Chat (${resp.status})`, "google_chat", false);
            return;
        }
        logger.info(`[Referral] Google Chat alert sent for ${referralId}`);
        await logActivity(referralId, "CHAT_ALERT_SENT", `Google Chat: ${buildingName}`, "google_chat", true);
    } catch (err) {
        logger.error(`[Referral] Google Chat webhook error for ${referralId}:`, err);
        await logActivity(referralId, "CHAT_ALERT_FAILED", String(err), "google_chat", false);
    }
}

/* ─── Email 1: Submission Confirmation ──────────────────────────── */

async function sendSubmissionConfirmation(referralId: string, data: any) {
    const { referrerName, referrerEmail, referrerPhone, buildingName, buildingAddress, managerName, managerEmail, managerPhone, notes, trade } = data;
    if (!referrerEmail) return;

    const firstName = escapeHtml(referrerName?.split(" ")[0] || "there");
    const safeBuildingName = escapeHtml(buildingName || "your referred building");
    const safeAddress = escapeHtml(buildingAddress || "Not provided");
    const safeReferrerName = escapeHtml(referrerName || "");
    const safeReferrerEmail = escapeHtml(referrerEmail || "");
    const safeReferrerPhone = escapeHtml(referrerPhone || "");
    const safeTrade = escapeHtml(formatTradeLabel(trade));

    const managerParts = [
        managerName ? escapeHtml(managerName) : "",
        managerEmail ? escapeHtml(managerEmail) : "",
        managerPhone ? escapeHtml(managerPhone) : "",
    ].filter(Boolean);

    const summaryRows: string[] = [
        summaryRow("Building / Business", `<strong>${safeBuildingName}</strong>`),
        summaryRow("Building Address", safeAddress),
        ...(managerParts.length > 0 ? [summaryRow("Building Manager", managerParts.join(" · "))] : []),
        ...(notes && String(notes).trim() ? [summaryRow("Notes", escapeHtml(notes))] : []),
        summaryRow("Your Info", `${safeReferrerName}${safeTrade && safeTrade !== "other" ? ` (${safeTrade})` : ""}<br/><span style="color: #64748b; font-size: 13px;">${safeReferrerEmail}${safeReferrerPhone ? ` · ${safeReferrerPhone}` : ""}</span>`),
        summaryRow("Reference ID", `<span style="font-family: monospace; font-size: 12px; color: #64748b;">${escapeHtml(referralId)}</span>`),
    ];

    const subject = `Referral received — ${buildingName}`;
    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px;">Thanks for the referral, ${firstName}!</h1>
        <p style="color: #475569; line-height: 1.6;">
            We've received your referral for <strong>${safeBuildingName}</strong> and will reach out to them within <strong>24 hours</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em;">Summary of Details Submitted</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
                ${summaryRows.join("")}
            </table>
            <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
                Need to add or correct anything? Just reply directly to this email and we'll update your referral.
            </p>
        </div>

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

    const firstName = escapeHtml(referrerName?.split(" ")[0] || "there");
    const safeBuildingName = escapeHtml(buildingName || "the building");
    const paymentLink = `${PAYMENT_INFO_BASE}/${referralId}`;

    const subject = `Great news — we're visiting ${buildingName}!`;
    const html = wrapEmail(`
        <h1 style="color: #059669; margin: 0 0 16px;">Walkthrough scheduled! 🎉</h1>
        <p style="color: #475569; line-height: 1.6;">
            Hey ${firstName}, great news — we've scheduled a walkthrough at <strong>${safeBuildingName}</strong>.
            ${data.walkthroughDate ? `It's set for <strong>${escapeHtml(data.walkthroughDate)}</strong>.` : ""}
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

    const firstName = escapeHtml(referrerName?.split(" ")[0] || "there");
    const safeBuildingName = escapeHtml(buildingName || "the building");
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
            Hey ${firstName}, we've sent <strong>$${amount}</strong> to your ${escapeHtml(data.paymentInfo?.method || "account")} for your referral of <strong>${safeBuildingName}</strong>.
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

/** Single row in the submitted-details summary table */
function summaryRow(label: string, valueHtml: string): string {
    return `
    <tr>
        <td style="padding: 7px 12px 7px 0; color: #64748b; vertical-align: top; width: 150px; border-bottom: 1px solid #e2e8f0;">${label}</td>
        <td style="padding: 7px 0; color: #0f172a; vertical-align: top; border-bottom: 1px solid #e2e8f0;">${valueHtml}</td>
    </tr>`;
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

/** Log email activity to referral_leads/{id}/activities */
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
