import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { fetchPendingTasks, updateTaskStatus, enqueueTask, claimTask, QueueItem } from "../utils/queueUtils";
import { skipToWeekday, DEFAULT_SEND_HOUR_UTC, buildScheduledDate, isUsBusinessHoliday } from "../utils/scheduleUtils";
import { sendEmail, parseAddress } from "../utils/emailUtils";
import { getFacilityPhrases, cleanBusinessName, isOrthodonticPractice } from '@xiri/shared';
import { extractContactFirstName } from "../utils/leadSequenceEngine";

// ── Smart fallbacks for unresolved merge variables ─────────────────
const SMART_FALLBACKS: Record<string, string> = {
    contactName: 'there',
    businessName: 'your facility',
    vendorName: 'your company',
    facilityType: 'your facility',
    address: '',
    squareFootage: '',
    city: 'your area',
    state: '',
    services: 'facility maintenance',
    specialty: 'facility maintenance',
    onboardingUrl: 'https://xiri.ai/demo',
};

/**
 * Replace any remaining unresolved {{variables}} with smart fallbacks,
 * then clean up leftover artifacts (double spaces, orphaned commas).
 */
function sanitizeUnresolvedVars(text: string): { cleaned: string; replaced: string[] } {
    const replaced: string[] = [];
    const cleaned = text
        .replace(/\{\{([a-zA-Z_]+)\}\}/g, (match, key) => {
            replaced.push(match);
            return SMART_FALLBACKS[key] ?? '';
        })
        .replace(/\s{2,}/g, ' ')
        .replace(/,\s*,/g, ',')
        .replace(/\|\s*\|/g, '|')
        .replace(/^\s*,\s*/gm, '')
        .replace(/,\s*$/gm, '')
        .trim();
    return { cleaned, replaced };
}

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ── Sender resolution from email_senders collection ──────
interface SenderProfile {
    name: string;
    email: string;
    replyTo: string;
}

const SENDER_DEFAULTS: Record<string, SenderProfile> = {
    partnerships: { name: 'XIRI Partnerships', email: 'partnerships@xiri.ai', replyTo: 'chris@xiri.ai' },
    sales: { name: 'Chris Leung — XIRI', email: 'chris@xiri.ai', replyTo: 'chris@xiri.ai' },
    onboarding: { name: 'XIRI Facility Solutions', email: 'onboarding@xiri.ai', replyTo: 'chris@xiri.ai' },
    compliance: { name: 'XIRI Compliance', email: 'compliance@xiri.ai', replyTo: 'chris@xiri.ai' },
};

// In-memory cache to avoid re-reading within a single queue run
const senderCache: Record<string, SenderProfile> = {};

/**
 * Resolve sender profile from email_senders collection.
 * Falls back to hardcoded defaults if collection doc is missing.
 */
async function getSenderFrom(senderId: string): Promise<string> {
    if (senderCache[senderId]) {
        const s = senderCache[senderId];
        return `${s.name} <${s.email}>`;
    }

    try {
        const doc = await db.collection('email_senders').doc(senderId).get();
        if (doc.exists) {
            const data = doc.data()!;
            const profile: SenderProfile = {
                name: data.name,
                email: data.email,
                replyTo: data.replyTo || 'chris@xiri.ai',
            };
            senderCache[senderId] = profile;
            return `${profile.name} <${profile.email}>`;
        }
    } catch (err) {
        logger.warn(`Failed to read email_senders/${senderId}, using default`, err);
    }

    // Fallback
    const fallback = SENDER_DEFAULTS[senderId] || SENDER_DEFAULTS.onboarding;
    senderCache[senderId] = fallback;
    return `${fallback.name} <${fallback.email}>`;
}

/** Title-case a capability/specialty string for professional emails. */
function titleCase(s: string): string {
    if (!s) return '';
    if (s === s.toUpperCase() && s.length <= 5) return s; // acronyms like HVAC
    return s
        .replace(/[_-]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Run every minute to check for pending tasks
// Region must match project config
export const processOutreachQueue = onSchedule({
    schedule: "every 1 minutes",
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
}, async (event) => {
    logger.info("Processing outreach queue...");

    // ── New York Business-Hours & Weekday Guard (Mon–Fri, 9:00 AM – 4:00 PM ET) ──
    // Prevents weekend sends AND prevents Sunday-night / 6 AM UTC-drift sends.
    const now = new Date();
    const etParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        hour12: false,
    }).formatToParts(now);
    const etWeekday = etParts.find(p => p.type === 'weekday')?.value || '';
    const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0', 10);

    if (etWeekday === 'Sat' || etWeekday === 'Sun') {
        logger.info(`Weekend in ET (${etWeekday}) — skipping outreach queue processing.`);
        return;
    }

    const holidayName = isUsBusinessHoliday(now);
    if (holidayName) {
        logger.info(`US Holiday in ET (${holidayName}) — skipping outreach queue processing until next business day.`);
        return;
    }

    const isLeadSendWindow = etHour >= 9 && etHour < 16;

    // ── Max Daily Outreach Limit Guard (default 25 per weekday) ──
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let maxDailyOutreach = 25;
    try {
        const configDoc = await db.collection("prospecting_config").doc("default").get();
        if (configDoc.exists && typeof configDoc.data()?.maxDailyOutreach === 'number') {
            maxDailyOutreach = configDoc.data()!.maxDailyOutreach;
        }
    } catch (cfgErr) {
        logger.warn("[OutreachWorker] Could not read maxDailyOutreach, defaulting to 25:", cfgErr);
    }

    const dailyStatsRef = db.collection("prospecting_config").doc("outreach_daily_stats");
    const dailyStatsDoc = await dailyStatsRef.get();
    const statsData = dailyStatsDoc.exists ? dailyStatsDoc.data() : null;
    let sentToday = statsData?.date === todayStr ? (statsData?.sentCount || 0) : 0;

    if (sentToday >= maxDailyOutreach) {
        logger.info(`[OutreachWorker] Daily outreach cap reached (${sentToday}/${maxDailyOutreach} sent on ${todayStr}). Deferring remaining queue items to next weekday.`);
        return;
    }

    try {
        const tasks = await fetchPendingTasks(db);
        if (tasks.length === 0) {
            logger.info("No pending tasks found.");
            return;
        }

        logger.info(`Found ${tasks.length} tasks to process (${sentToday}/${maxDailyOutreach} sent today).`);

        for (const task of tasks) {
            try {
                // Lead cold outreach sends strictly within 9:00 AM – 4:00 PM ET Mon–Fri
                if (task.leadId && !isLeadSendWindow) {
                    logger.info(`[OutreachWorker] Outside NY lead send window (ET hour=${etHour}) — holding lead task ${task.id} until 9 AM ET.`);
                    continue;
                }

                // Check daily outreach cap BEFORE claiming lead tasks so nothing gets stuck IN_PROGRESS
                if (task.leadId && sentToday >= maxDailyOutreach) {
                    logger.info(`[OutreachWorker] Daily outreach cap reached (${sentToday}/${maxDailyOutreach}). Deferring remaining lead tasks.`);
                    continue;
                }

                // ── Claim the task before processing (prevents duplicate sends) ──
                const claimed = await claimTask(db, task.id!);
                if (!claimed) {
                    logger.info(`Task ${task.id} already claimed by another worker — skipping.`);
                    continue;
                }

                if (task.leadId) {
                    // ── Lead Outreach (template + engagement-branched funnel) ──
                    const didSend = await handleLeadSend(task);
                    if (didSend) sentToday++;
                } else {
                    // ── Vendor Outreach (existing) ──
                    if (task.type === 'GENERATE') {
                        await handleGenerate(task);
                    } else if (task.type === 'SEND') {
                        await handleSend(task);
                    } else if (task.type === 'FOLLOW_UP') {
                        await handleFollowUp(task);
                    }
                }
            } catch (err) {
                logger.error(`Error processing task ${task.id}:`, err);
                // Simple retry logic: Increment count, set to retry, backoff
                // If > 5 retries, mark FAILED
                const newRetryCount = (task.retryCount || 0) + 1;
                const status = newRetryCount > 5 ? 'FAILED' : 'RETRY';

                // Exponential backoff for retry (1m, 2m, 4m...) — also skip weekends
                let nextAttempt = new Date();
                nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));
                nextAttempt = skipToWeekday(nextAttempt);

                await updateTaskStatus(db, task.id!, status, {
                    retryCount: newRetryCount,
                    scheduledAt: admin.firestore.Timestamp.fromDate(nextAttempt),
                    error: String(err)
                });

                // When max retries exhausted, update vendor outreachStatus to FAILED
                if (status === 'FAILED' && task.vendorId) {
                    await db.collection("vendors").doc(task.vendorId).update({
                        outreachStatus: 'FAILED',
                        statusUpdatedAt: new Date(),
                    });
                    await db.collection("vendor_activities").add({
                        vendorId: task.vendorId,
                        type: "OUTREACH_FAILED",
                        description: `Outreach failed after ${newRetryCount} attempts: ${String(err).slice(0, 200)}`,
                        createdAt: new Date(),
                        metadata: { error: String(err).slice(0, 500), retryCount: newRetryCount, taskType: task.type },
                    });
                }
            }
        }
    } catch (error) {
        logger.error("Fatal error in queue processor:", error);
    }
});

async function handleGenerate(task: QueueItem) {
    logger.info(`Generating content for task ${task.id}`);

    // Fetch fresh vendor data
    const vendorDoc = await db.collection("vendors").doc(task.vendorId!).get();
    const vendor = vendorDoc.exists ? vendorDoc.data() : task.metadata;

    const sequence = task.metadata?.sequence || 1;
    const templateId = `vendor_outreach_${sequence}`;

    // Fetch the email template from Firestore
    const templateDoc = await db.collection("templates").doc(templateId).get();
    if (!templateDoc.exists) {
        throw new Error(`Email template ${templateId} not found in Firestore. Run seed-email-templates.js to create them.`);
    }

    const template = templateDoc.data()!;
    const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;

    // Build merge variables from vendor data
    const services = Array.isArray(vendor?.capabilities) && vendor.capabilities.length > 0
        ? vendor.capabilities.map(titleCase).join(', ')
        : titleCase(vendor?.specialty || 'Facility Services');
    const contactName = vendor?.contactName || vendor?.businessName || 'there';

    const mergeVars: Record<string, string> = {
        vendorName: vendor?.companyName || vendor?.businessName || 'your company',
        contactName,
        city: vendor?.city || 'your area',
        state: vendor?.state || '',
        services,
        specialty: titleCase(vendor?.specialty || vendor?.capabilities?.[0] || 'Services'),
        onboardingUrl,
    };

    // Merge template fields
    let subject = template.subject || '';
    let body = template.body || '';
    for (const [key, value] of Object.entries(mergeVars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
    }
    // Legacy placeholder
    body = body.replace(/\[ONBOARDING_LINK\]/g, onboardingUrl);

    const emailResult = { subject, body };

    // 1. Log the draft (Visible in Activity Feed)
    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: "OUTREACH_QUEUED",
        description: `Outreach email draft generated from template (sequence ${sequence}).`,
        createdAt: new Date(),
        metadata: {
            email: emailResult,
            preferredChannel: 'EMAIL',
            templateId,
            sequence,
        }
    });

    // 2. Schedule SEND immediately (next queue cycle ~1 min)
    const scheduledTime = new Date();

    // 3. Enqueue SEND Task
    await enqueueTask(db, {
        vendorId: task.vendorId,
        type: 'SEND',
        scheduledAt: admin.firestore.Timestamp.fromDate(scheduledTime),
        metadata: {
            email: emailResult,
            channel: 'EMAIL',
            sequence,
            templateId,
        }
    });

    // 4. Mark GENERATE task complete
    await updateTaskStatus(db, task.id!, 'COMPLETED');
    logger.info(`Task ${task.id} completed (template: ${templateId}). Send scheduled.`);
}

async function handleSend(task: QueueItem) {
    logger.info(`Executing SEND for task ${task.id}`);

    const vendorDoc = await db.collection("vendors").doc(task.vendorId!).get();
    const vendor = vendorDoc.exists ? vendorDoc.data() : null;

    // ── Suppression check: skip dismissed/unsubscribed vendors ──
    if (vendor?.status === 'dismissed') {
        logger.info(`[Suppression] Vendor ${task.vendorId} is dismissed — skipping send and cancelling task.`);
        await updateTaskStatus(db, task.id!, 'CANCELLED');
        return;
    }

    const vendorEmail = vendor?.email || task.metadata?.email?.to;

    let sendSuccess = false;
    let resendId: string | undefined;
    let htmlBody = '';

    // Resolve sender from email_senders collection (outside if block for activity log)
    const senderId = task.metadata?.senderId || 'partnerships';
    const senderFrom = await getSenderFrom(senderId);

    if (vendorEmail) {
        // ─── Always send via Email until Twilio SMS is integrated ───
        const emailData = task.metadata.email;
        htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || '').replace(/\n/g, '<br/>')}</div>`;

        const result = await sendEmail(
            vendorEmail,
            emailData?.subject || 'XIRI Facility Solutions — Partnership Opportunity',
            htmlBody,
            undefined,   // no attachments
            senderFrom,
            task.vendorId ?? undefined,  // tag email with vendorId for webhook tracking
            task.metadata.templateId ?? undefined,  // tag with templateId for stats tracking
            'vendor', // entityType for unsubscribe footer
        );
        sendSuccess = result.success;
        resendId = result.resendId;

        if (!sendSuccess) {
            logger.error(`Failed to send email to ${vendorEmail} for task ${task.id}`);
            throw new Error(`Resend email failed for vendor ${task.vendorId}`);
        }
    } else {
        logger.warn(`No email for task ${task.id}. Channel: ${task.metadata.channel}`);
        sendSuccess = false;
    }

    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
        description: sendSuccess
            ? `Automated ${task.metadata.channel} sent to ${vendorEmail || 'vendor'}.`
            : `Failed to send ${task.metadata.channel} to vendor.`,
        createdAt: new Date(),
        metadata: {
            channel: task.metadata.channel,
            to: vendorEmail || 'unknown',
            from: senderFrom,
            replyTo: 'chris@xiri.ai',
            // Full email fields for activity feed preview
            subject: task.metadata.channel === 'SMS' ? null : task.metadata.email?.subject,
            body: task.metadata.channel === 'SMS' ? task.metadata.sms : task.metadata.email?.body,
            html: task.metadata.channel === 'SMS' ? null : htmlBody,
            templateId: task.metadata.templateId || null,
            resendId: resendId || null,
        }
    });

    await updateTaskStatus(db, task.id!, sendSuccess ? 'COMPLETED' : 'FAILED');

    // Update Vendor Record
    if (sendSuccess) {
        await db.collection("vendors").doc(task.vendorId!).update({
            status: 'awaiting_onboarding',
            outreachStatus: 'SENT',
            outreachChannel: task.metadata.channel,
            outreachSentAt: new Date(),
            statusUpdatedAt: new Date()
        });

        // Increment template stats.sent
        if (task.metadata.templateId) {
            try {
                await db.collection('templates').doc(task.metadata.templateId).update({
                    'stats.sent': admin.firestore.FieldValue.increment(1),
                    'stats.lastUpdated': new Date(),
                });
                logger.info(`Template ${task.metadata.templateId}: stats.sent incremented`);
            } catch (statsErr) {
                logger.warn('Template stats.sent update failed:', statsErr);
            }
        }

        // Log status transition
        await db.collection("vendor_activities").add({
            vendorId: task.vendorId,
            type: "STATUS_CHANGE",
            description: `Pipeline advanced: qualified → awaiting_onboarding (outreach ${task.metadata.channel} delivered)`,
            createdAt: new Date(),
            metadata: { from: 'qualified', to: 'awaiting_onboarding', trigger: 'outreach_sent' }
        });
    } else {
        await db.collection("vendors").doc(task.vendorId!).update({
            outreachStatus: 'PENDING',
            outreachChannel: task.metadata.channel,
            outreachTime: new Date()
        });
    }
}

async function handleFollowUp(task: QueueItem) {
    logger.info(`Processing FOLLOW_UP task ${task.id} (sequence ${task.metadata?.sequence})`);

    const vendorDoc = await db.collection("vendors").doc(task.vendorId!).get();
    const vendor = vendorDoc.exists ? vendorDoc.data() : null;

    if (!vendor) {
        logger.warn(`Vendor ${task.vendorId} not found, marking task completed.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    // Skip if vendor has already progressed past awaiting_onboarding
    if (vendor.status !== 'awaiting_onboarding') {
        logger.info(`Vendor ${task.vendorId} is now '${vendor.status}', skipping follow-up.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    const vendorEmail = vendor.email || task.metadata?.email;
    if (!vendorEmail) {
        logger.warn(`No email for vendor ${task.vendorId}, skipping follow-up.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    // ─── Engagement-Based Routing ───────────────────────────────────
    const engagement = vendor.emailEngagement?.lastEvent;
    const sequence = task.metadata?.sequence || 1;
    let variantSuffix = '';  // standard (no suffix)
    let variantId = 'standard';

    if (engagement === 'bounced') {
        // Email bounced — don't send, flag for manual outreach
        logger.info(`Vendor ${task.vendorId} email bounced, flagging for manual outreach.`);
        await db.collection("vendors").doc(task.vendorId!).update({
            outreachStatus: 'NEEDS_MANUAL',
            statusUpdatedAt: new Date(),
        });
        await db.collection("vendor_activities").add({
            vendorId: task.vendorId,
            type: "NEEDS_MANUAL_OUTREACH",
            description: `Follow-up #${sequence} skipped — previous email bounced. Manual outreach needed.`,
            createdAt: new Date(),
            metadata: { sequence, reason: 'bounce' },
        });
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    } else if (engagement === 'opened' || engagement === 'clicked') {
        variantSuffix = '_warm';
        variantId = 'warm';
    } else if (engagement === 'delivered') {
        variantSuffix = '_cold';
        variantId = 'cold';
    }

    // Try engagement variant first, fall back to standard template
    const baseTemplateId = `vendor_outreach_${sequence + 1}`;
    let templateId = `${baseTemplateId}${variantSuffix}`;
    let templateDoc = await db.collection("templates").doc(templateId).get();

    if (!templateDoc.exists && variantSuffix) {
        // Fall back to standard template if variant doesn't exist yet
        templateId = baseTemplateId;
        variantId = 'standard';
        templateDoc = await db.collection("templates").doc(templateId).get();
    }
    if (!templateDoc.exists) {
        // No more templates in the sequence — sequence is complete.
        // Auto-dismiss if vendor never engaged; flag for manual if they opened but didn't onboard.
        const lastEngagement = vendor.emailEngagement?.lastEvent;
        const hasEngaged = lastEngagement === 'opened' || lastEngagement === 'clicked';

        if (hasEngaged) {
            // They showed interest but didn't complete onboarding — flag for manual follow-up
            logger.info(`Vendor ${task.vendorId} engaged (${lastEngagement}) but didn't onboard. Flagging for manual outreach.`);
            await db.collection("vendors").doc(task.vendorId!).update({
                outreachStatus: 'NEEDS_MANUAL',
                statusUpdatedAt: new Date(),
            });
            await db.collection("vendor_activities").add({
                vendorId: task.vendorId,
                type: "NEEDS_MANUAL_OUTREACH",
                description: `Drip sequence complete (${sequence} emails). Vendor opened/clicked but didn't onboard — needs personal follow-up.`,
                createdAt: new Date(),
                metadata: { sequence, lastEngagement, reason: 'sequence_complete_engaged' },
            });
        } else {
            // No engagement at all — auto-dismiss
            logger.info(`Vendor ${task.vendorId} completed full sequence with no engagement. Auto-dismissing.`);
            await db.collection("vendors").doc(task.vendorId!).update({
                status: 'dismissed',
                dismissReason: 'sequence_exhausted',
                statusUpdatedAt: new Date(),
                outreachStatus: 'EXHAUSTED',
            });
            await db.collection("vendor_activities").add({
                vendorId: task.vendorId,
                type: "STATUS_CHANGE",
                description: `Auto-dismissed: full drip sequence (${sequence} emails) completed with no engagement.`,
                createdAt: new Date(),
                metadata: {
                    from: 'awaiting_onboarding',
                    to: 'dismissed',
                    trigger: 'auto_dismiss_no_engagement',
                    sequence,
                    lastEngagement: lastEngagement || 'none',
                },
            });
        }

        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    const template = templateDoc.data()!;
    const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;

    // Merge vendor data
    const services = Array.isArray(vendor.capabilities) && vendor.capabilities.length > 0
        ? vendor.capabilities.map(titleCase).join(', ')
        : titleCase(vendor.specialty || 'Facility Services');
    const contactName = vendor.contactName || vendor.businessName || 'there';

    const mergeVars: Record<string, string> = {
        vendorName: vendor.companyName || vendor.businessName || 'your company',
        contactName,
        city: vendor.city || 'your area',
        state: vendor.state || '',
        services,
        specialty: titleCase(vendor.specialty || vendor.capabilities?.[0] || 'Services'),
        onboardingUrl,
    };

    let subject = template.subject || '';
    let body = template.body || '';
    for (const [key, value] of Object.entries(mergeVars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
    }
    body = body.replace(/\[ONBOARDING_LINK\]/g, onboardingUrl);

    // ── Safety net: replace any remaining unresolved {{variables}} ──
    const subjectSanitized = sanitizeUnresolvedVars(subject);
    const bodySanitized = sanitizeUnresolvedVars(body);
    if (subjectSanitized.replaced.length || bodySanitized.replaced.length) {
        logger.warn(`[VendorOutreach] Unresolved merge vars in template ${templateId}: ` +
            `subject=[${subjectSanitized.replaced.join(', ')}], body=[${bodySanitized.replaced.join(', ')}]`);
    }
    subject = subjectSanitized.cleaned;
    body = bodySanitized.cleaned;

    const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`;

    // Resolve sender from email_senders collection
    const followUpSenderId = task.metadata?.senderId || 'partnerships';
    const followUpSenderFrom = await getSenderFrom(followUpSenderId);

    const { success: sendSuccess, resendId } = await sendEmail(
        vendorEmail, subject, htmlBody,
        undefined, followUpSenderFrom, task.vendorId ?? undefined, templateId,
        'vendor',
    );

    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: sendSuccess ? "FOLLOW_UP_SENT" : "OUTREACH_FAILED",
        description: sendSuccess
            ? `Follow-up #${sequence} sent to ${vendorEmail}`
            : `Failed to send follow-up #${sequence} to ${vendorEmail}`,
        createdAt: new Date(),
        metadata: {
            sequence,
            channel: 'EMAIL',
            to: vendorEmail,
            from: followUpSenderFrom,
            subject,
            body,
            html: htmlBody,
            templateId,
            variantId,
            resendId: resendId || null,
        }
    });

    if (sendSuccess) {
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        logger.info(`Follow-up #${sequence} sent to ${vendorEmail} (template: ${templateId})`);

        // Increment template stats.sent
        try {
            await db.collection('templates').doc(templateId).update({
                'stats.sent': admin.firestore.FieldValue.increment(1),
                'stats.lastUpdated': new Date(),
            });
            logger.info(`Template ${templateId}: stats.sent incremented`);
        } catch (statsErr) {
            logger.warn('Template stats.sent update failed:', statsErr);
        }
    } else {
        throw new Error(`Failed to send follow-up #${sequence} to ${vendorEmail}`);
    }
}




/**
 * Render plain text email body with clean clickable links (supports [Label](https://...)
 * and bare https:// URLs) while safely escaping HTML.
 */
function renderLeadEmailHtml(body: string): string {
    const escaped = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Convert markdown links [Label](https://...) into styled anchors
    const withMdLinks = escaped.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" style="color: #0369a1; text-decoration: underline; font-weight: 500;">$1</a>'
    );

    // Convert remaining bare https:// URLs not already inside href="..."
    const withAllLinks = withMdLinks.replace(
        /(?<!href=")(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color: #0369a1; text-decoration: underline;">$1</a>'
    );

    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; font-size: 14px; line-height: 1.7;">${withAllLinks.replace(/\n/g, '<br/>')}</div>`;
}

async function handleLeadSend(task: QueueItem): Promise<boolean> {
    logger.info(`[LeadOutreach] Processing task ${task.id} for lead ${task.leadId}`);

    // ── Resolve lead document from companies OR leads ──
    let leadDoc = await db.collection("companies").doc(task.leadId!).get();
    let leadCollection = 'companies';
    if (!leadDoc.exists) {
        leadDoc = await db.collection("leads").doc(task.leadId!).get();
        leadCollection = 'leads';
    }
    if (!leadDoc.exists) {
        logger.info(`[Suppression] Lead ${task.leadId} not found in companies or leads — cancelling task.`);
        await updateTaskStatus(db, task.id!, 'CANCELLED');
        return false;
    }

    // ── Suppression check: skip lost / unsubscribed leads ──
    const leadData = leadDoc.data()!;
    if (leadData.status === 'lost' || leadData.unsubscribedAt) {
        logger.info(`[Suppression] Lead ${task.leadId} is ${leadData.status}/unsubscribed — cancelling task.`);
        await updateTaskStatus(db, task.id!, 'CANCELLED');
        return false;
    }

    // ── Human Pipeline Guardrail: skip leads in active sales conversations ──
    const HUMAN_PIPELINE_STATUSES = ['qualified', 'walkthrough', 'proposal', 'quoted', 'won'];
    if (HUMAN_PIPELINE_STATUSES.includes(leadData.status)) {
        logger.info(`[HumanHandoff] Lead ${task.leadId} is in active human sales pipeline ("${leadData.status}") — cancelling automated cold task.`);
        await updateTaskStatus(db, task.id!, 'CANCELLED');
        return false;
    }

    // ── Resolve contact (contact-centric model) & engagement telemetry ──
    const contactId = task.contactId || task.metadata?.contactId || null;
    let toEmail = task.metadata?.email || leadData.email || '';
    let contactName = task.metadata?.contactName || leadData.contactName || 'there';
    let contactData: Record<string, any> | null = null;

    if (contactId) {
        const contactDoc = await db.collection('contacts').doc(contactId).get();
        if (contactDoc.exists) {
            contactData = contactDoc.data()!;
            if (contactData.unsubscribed || contactData.lifecycleStatus === 'suppressed' || contactData.lifecycleStatus === 'held') {
                logger.info(`[Suppression] Contact ${contactId} is ${contactData.lifecycleStatus || 'unsubscribed'} — cancelling task.`);
                await updateTaskStatus(db, task.id!, 'CANCELLED');
                return false;
            }
            toEmail = contactData.email || toEmail;
            const fullName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
            if (fullName) contactName = fullName;
        }
    }

    if (!toEmail) {
        logger.warn(`[LeadOutreach] No email for lead ${task.leadId}, cancelling task.`);
        await updateTaskStatus(db, task.id!, 'CANCELLED');
        return false;
    }

    const baseTemplateId = task.metadata?.templateId;
    if (!baseTemplateId) {
        logger.error(`[LeadOutreach] No templateId for lead ${task.leadId} task ${task.id}.`);
        await updateTaskStatus(db, task.id!, 'FAILED');
        return false;
    }

    // ── Dynamic Warm / Cold Branching for Follow-Up Steps (stepIndex >= 1) ──
    const stepIndex: number = typeof task.metadata?.stepIndex === 'number'
        ? task.metadata.stepIndex
        : Math.max(0, (task.metadata?.sequence || 1) - 1);

    const engagement = contactData?.emailEngagement || {};
    const isWarm = Boolean(
        engagement.highIntentClicked ||
        (engagement.clickCount || engagement.clickedCount || 0) > 0 ||
        (engagement.openCount || engagement.openedCount || 0) > 0 ||
        engagement.lastEvent === 'opened' ||
        engagement.lastEvent === 'clicked'
    );

    let resolvedTemplateId = baseTemplateId;
    let branchTag: 'warm' | 'cold' | 'base' = 'base';
    let templateDoc = null as FirebaseFirestore.DocumentSnapshot | null;

    if (stepIndex >= 1) {
        const branchSuffix = isWarm ? '_warm' : '_cold';
        const candidateId = `${baseTemplateId}${branchSuffix}`;
        const candidateDoc = await db.collection('templates').doc(candidateId).get();
        if (candidateDoc.exists) {
            resolvedTemplateId = candidateId;
            branchTag = isWarm ? 'warm' : 'cold';
            templateDoc = candidateDoc;
            logger.info(`[LeadOutreach] Engagement branch (${branchTag}) selected template "${resolvedTemplateId}" for ${toEmail}`);
        }
    }

    if (!templateDoc) {
        templateDoc = await db.collection('templates').doc(baseTemplateId).get();
    }

    if (!templateDoc.exists) {
        logger.error(`[LeadOutreach] Template ${resolvedTemplateId} not found. Run scripts/seed-dental-sdr-funnel.js.`);
        await updateTaskStatus(db, task.id!, 'FAILED');
        return false;
    }

    const template = templateDoc.data()!;

    // ── Build full merge variables ──
    const rawBizName = leadData.businessName || task.metadata?.businessName || 'your practice';
    const cleanBiz = cleanBusinessName(rawBizName) || rawBizName;
    const rawAddress = leadData.address || task.metadata?.address || '';
    const parsedAddr = parseAddress(rawAddress);
    const city = task.metadata?.city || leadData.city || parsedAddr.city || (rawAddress ? rawAddress.split(',')[0].trim() : 'Metro NY');
    const rawFacilityType = leadData.facilityType || task.metadata?.facilityType || 'medical_dental';
    const isOrtho = isOrthodonticPractice({
        clinicType: leadData.dossier?.clinicType || task.metadata?.clinicType,
        practiceSpecialty: leadData.practiceSpecialty,
        businessName: rawBizName,
        searchQuery: leadData.searchQuery,
    });

    const mergeVars: Record<string, string> = {
        contactName,
        contactFirstName: task.metadata?.contactFirstName || extractContactFirstName(contactName),
        contactEmail: toEmail,
        businessName: cleanBiz,
        cleanBizName: cleanBiz,
        facilityType: titleCase(rawFacilityType),
        practiceType: isOrtho ? 'orthodontic practice' : 'dental practice',
        address: rawAddress,
        city,
        state: task.metadata?.state || leadData.state || parsedAddr.state || 'NY',
        squareFootage: String(leadData.squareFootage || task.metadata?.squareFootage || ''),
        keyObservation: leadData.dossier?.keyObservation || task.metadata?.keyObservation || '',
        estimatedOperatories: String(leadData.dossier?.estimatedOperatories || task.metadata?.estimatedOperatories || ''),
    };

    const phrases = getFacilityPhrases(rawFacilityType);
    for (const [key, value] of Object.entries(phrases)) {
        if (!mergeVars[key]) mergeVars[key] = value;
    }

    const defensiveAliases: Record<string, string> = {
        vendorName: mergeVars.businessName,
        services: titleCase(rawFacilityType),
        specialty: isOrtho ? 'Orthodontic Practice' : 'Dental Practice',
        onboardingUrl: 'https://xiri.ai/audit/start',
    };
    for (const [key, value] of Object.entries(defensiveAliases)) {
        if (!mergeVars[key]) mergeVars[key] = value;
    }

    // ── Step 0 AI Personalized Draft blending (only for primary contact so secondary contacts get their own name) ──
    const allowCompanyDraft = task.metadata?.useCompanyDraft !== false && contactData?.isPrimary !== false;
    const draft = allowCompanyDraft ? (task.metadata?.outreachDraft || leadData.outreachDraft) : null;
    let subject = '';
    let body = '';

    if (stepIndex === 0 && template.useCustomDraft && draft?.subject && draft?.body) {
        subject = draft.subject;
        // Safety belt: never send a broken "Hi Dr.," greeting from older drafts
        body = draft.body.replace(/^Hi Dr\.,/i, `Hi ${mergeVars.contactFirstName},`);
        logger.info(`[LeadOutreach] Using AI SDR personalized draft for Step 1 to ${toEmail}`);
    } else {
        subject = template.subject || task.metadata?.subject || '';
        body = template.body || template.content || '';
    }

    for (const [key, value] of Object.entries(mergeVars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
    }

    const subjectSanitized = sanitizeUnresolvedVars(subject);
    const bodySanitized = sanitizeUnresolvedVars(body);
    if (subjectSanitized.replaced.length || bodySanitized.replaced.length) {
        logger.warn(`[LeadOutreach] Unresolved merge vars in template ${resolvedTemplateId}: ` +
            `subject=[${subjectSanitized.replaced.join(', ')}], body=[${bodySanitized.replaced.join(', ')}]`);
    }
    subject = subjectSanitized.cleaned;
    body = bodySanitized.cleaned;

    // Strip duplicate trailing "Best,\nChris" if signature is appended by sendEmail()
    body = body.replace(/\n+(?:Best|Thanks|Regards),?\s*\n+Chris(?:\s+Leung)?\s*$/i, '').trim();

    const htmlBody = renderLeadEmailHtml(body);

    const leadSenderId = task.metadata?.senderId || 'sales';
    const leadSenderFrom = await getSenderFrom(leadSenderId);

    const sendResult = await sendEmail(
        toEmail, subject, htmlBody,
        undefined,
        leadSenderFrom,
        task.leadId ?? undefined, resolvedTemplateId,
        'lead',
        {
            contactId: contactId || undefined,
            skipHeader: true,
        },
    );

    const now = new Date();

    await db.collection("lead_activities").add({
        leadId: task.leadId,
        contactId: contactId || null,
        type: sendResult.success ? "OUTREACH_SENT" : "OUTREACH_FAILED",
        description: sendResult.success
            ? `Funnel Touch #${stepIndex + 1} (${branchTag}) sent to ${toEmail}: "${subject}"`
            : `Failed to send Funnel Touch #${stepIndex + 1} to ${toEmail}.`,
        createdAt: now,
        metadata: {
            to: toEmail,
            subject,
            body,
            html: htmlBody,
            templateId: resolvedTemplateId,
            baseTemplateId,
            branch: branchTag,
            sequenceId: task.metadata?.sequenceId || null,
            sequence: stepIndex + 1,
            stepIndex,
            resendId: sendResult.resendId || null,
            contactId: contactId || null,
        },
    });

    await updateTaskStatus(db, task.id!, sendResult.success ? 'COMPLETED' : 'FAILED', {
        ...(sendResult.success ? { completedAt: now } as any : {}),
    });

    if (!sendResult.success) {
        return false;
    }

    // ── Update company & contact progress ──
    const sequenceId = task.metadata?.sequenceId || leadData.activeSequenceId || null;

    await db.collection(leadCollection).doc(task.leadId!).update({
        outreachStatus: 'SENT',
        outreachSentAt: now,
        lastTouchStep: stepIndex + 1,
        updatedAt: now,
    });

    if (contactId) {
        const contactUpdates: Record<string, any> = {
            emailStatus: 'sent',
            lastEmailedAt: now,
            updatedAt: now,
        };
        if (sequenceId) {
            contactUpdates[`sequenceHistory.${sequenceId}.currentStep`] = stepIndex + 1;
            contactUpdates[`sequenceHistory.${sequenceId}.lastSentAt`] = now;
        }
        await db.collection('contacts').doc(contactId).set(contactUpdates, { merge: true });
    }

    // ── Increment daily outreach counter atomically (resets cleanly when ET date rolls over) ──
    try {
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const statsRef = db.collection("prospecting_config").doc("outreach_daily_stats");
        await db.runTransaction(async (txn) => {
            const snap = await txn.get(statsRef);
            const data = snap.exists ? snap.data()! : {};
            const currentCount = data.date === todayStr ? (data.sentCount || 0) : 0;
            txn.set(statsRef, {
                date: todayStr,
                sentCount: currentCount + 1,
                lastSentAt: now,
            }, { merge: true });
        });
    } catch (counterErr) {
        logger.warn('Daily outreach counter update failed:', counterErr);
    }

    // ── Increment template stats.sent ──
    try {
        await db.collection('templates').doc(resolvedTemplateId).update({
            'stats.sent': admin.firestore.FieldValue.increment(1),
            'stats.lastUpdated': now,
        });
    } catch (statsErr) {
        logger.warn('Template stats.sent update failed:', statsErr);
    }

    // ── Chain Next Step in Sequence (or Transition to Monthly Nurture) ──
    if (sequenceId) {
        try {
            const seqDoc = await db.collection('sequences').doc(sequenceId).get();
            if (seqDoc.exists) {
                const seqData = seqDoc.data()!;
                const steps: Array<{ templateId: string; dayOffset: number; label?: string }> = seqData.steps || [];
                const nextIndex = stepIndex + 1;

                if (nextIndex < steps.length) {
                    const currentDay = steps[stepIndex]?.dayOffset ?? 0;
                    const nextStep = steps[nextIndex];
                    const deltaDays = Math.max(1, (nextStep.dayOffset ?? (currentDay + 3)) - currentDay);
                    const nextSendAt = buildScheduledDate(now, deltaDays);

                    await enqueueTask(db, {
                        leadId: task.leadId,
                        contactId: contactId || undefined,
                        type: 'SEND',
                        scheduledAt: admin.firestore.Timestamp.fromDate(nextSendAt),
                        metadata: {
                            ...task.metadata,
                            sequence: nextIndex + 1,
                            stepIndex: nextIndex,
                            totalSteps: steps.length,
                            templateId: nextStep.templateId,
                            stepLabel: nextStep.label || `Touch ${nextIndex + 1}`,
                            outreachDraft: null, // Only Step 0 uses initial custom draft
                        },
                    });

                    logger.info(
                        `[LeadOutreach] Chained "${sequenceId}" Step ${nextIndex + 1}/${steps.length} (${nextStep.templateId}) for ${toEmail} at ${nextSendAt.toISOString()}`
                    );
                } else {
                    // Sequence completed! Mark history completed & optionally chain into monthly nurture
                    if (contactId) {
                        await db.collection('contacts').doc(contactId).set({
                            [`sequenceHistory.${sequenceId}.status`]: 'completed',
                            [`sequenceHistory.${sequenceId}.completedAt`]: now,
                        }, { merge: true });
                    }

                    const nextSequenceId = seqData.nextSequenceId;
                    if (nextSequenceId && nextSequenceId !== sequenceId) {
                        const nurtureDoc = await db.collection('sequences').doc(nextSequenceId).get();
                        const nurtureSteps = nurtureDoc.exists ? (nurtureDoc.data()?.steps || []) : [];
                        if (nurtureSteps.length > 0) {
                            const firstNurture = nurtureSteps[0];
                            const nurtureDelayDays = Math.max(14, firstNurture.dayOffset || 30);
                            const nurtureSendAt = buildScheduledDate(now, nurtureDelayDays);

                            await enqueueTask(db, {
                                leadId: task.leadId,
                                contactId: contactId || undefined,
                                type: 'SEND',
                                scheduledAt: admin.firestore.Timestamp.fromDate(nurtureSendAt),
                                metadata: {
                                    ...task.metadata,
                                    sequenceId: nextSequenceId,
                                    sequenceName: nurtureDoc.data()?.name || nextSequenceId,
                                    sequence: 1,
                                    stepIndex: 0,
                                    totalSteps: nurtureSteps.length,
                                    templateId: firstNurture.templateId,
                                    stepLabel: firstNurture.label || 'Monthly Nurture #1',
                                    outreachDraft: null,
                                },
                            });

                            await db.collection(leadCollection).doc(task.leadId!).update({
                                activeSequenceId: nextSequenceId,
                                activeSequenceName: nurtureDoc.data()?.name || nextSequenceId,
                            });

                            logger.info(
                                `[LeadOutreach] Sequence "${sequenceId}" finished — transitioned ${toEmail} into long-term nurture "${nextSequenceId}" at ${nurtureSendAt.toISOString()}`
                            );
                        }
                    }
                }
            }
        } catch (chainErr) {
            logger.error(`[LeadOutreach] Failed to chain next step for ${task.leadId}:`, chainErr);
        }
    }

    return true;
}
