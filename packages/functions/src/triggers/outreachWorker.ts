import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { fetchPendingTasks, updateTaskStatus, enqueueTask, QueueItem } from "../utils/queueUtils";
// import { getNextBusinessSlot } from "../utils/timeUtils"; // TODO: Re-enable for production
// NOTE: generateOutreachContent is kept as a fallback but no longer used for vendor outreach (templates are used instead)
import { generateSalesOutreachContent } from "../agents/salesOutreach";
import { sendEmail } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Run every minute to check for pending tasks
// Region must match project config
export const processOutreachQueue = onSchedule({
    schedule: "every 1 minutes",
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
}, async (event) => {
    logger.info("Processing outreach queue...");

    try {
        const tasks = await fetchPendingTasks(db);
        if (tasks.length === 0) {
            logger.info("No pending tasks found.");
            return;
        }

        logger.info(`Found ${tasks.length} tasks to process.`);

        for (const task of tasks) {
            try {
                // Route based on whether task is for a vendor or a lead
                if (task.leadId) {
                    // ── Sales Lead Outreach ──
                    if (task.type === 'GENERATE') {
                        await handleLeadGenerate(task);
                    } else if (task.type === 'FOLLOW_UP') {
                        await handleLeadFollowUp(task);
                    } else if (task.type === 'SEND') {
                        await handleLeadSend(task);
                    }
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

                // Exponential backoff for retry (1m, 2m, 4m...)
                const nextAttempt = new Date();
                nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));

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
        ? vendor.capabilities.join(', ')
        : vendor?.specialty || 'Facility Services';
    const contactName = vendor?.contactName || vendor?.businessName || 'there';

    const mergeVars: Record<string, string> = {
        vendorName: vendor?.companyName || vendor?.businessName || 'your company',
        contactName,
        city: vendor?.city || 'your area',
        state: vendor?.state || '',
        services,
        specialty: vendor?.specialty || vendor?.capabilities?.[0] || 'Services',
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
    const vendorEmail = vendor?.email || task.metadata?.email?.to;

    let sendSuccess = false;
    let resendId: string | undefined;
    let htmlBody = '';

    if (vendorEmail) {
        // ─── Always send via Email until Twilio SMS is integrated ───
        const emailData = task.metadata.email;
        htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || '').replace(/\n/g, '<br/>')}</div>`;

        const result = await sendEmail(
            vendorEmail,
            emailData?.subject || 'Xiri Facility Solutions — Partnership Opportunity',
            htmlBody,
            undefined,   // no attachments
            undefined,   // default from
            task.vendorId ?? undefined  // tag email with vendorId for webhook tracking
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
            from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
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
        // No more templates in the sequence — we're done
        logger.info(`No template ${templateId} found. Follow-up sequence complete for vendor ${task.vendorId}.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    const template = templateDoc.data()!;
    const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;

    // Merge vendor data
    const services = Array.isArray(vendor.capabilities) && vendor.capabilities.length > 0
        ? vendor.capabilities.join(', ')
        : vendor.specialty || 'Facility Services';
    const contactName = vendor.contactName || vendor.businessName || 'there';

    const mergeVars: Record<string, string> = {
        vendorName: vendor.companyName || vendor.businessName || 'your company',
        contactName,
        city: vendor.city || 'your area',
        state: vendor.state || '',
        services,
        specialty: vendor.specialty || vendor.capabilities?.[0] || 'Services',
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

    const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`;

    const { success: sendSuccess, resendId } = await sendEmail(
        vendorEmail, subject, htmlBody,
        undefined, undefined, task.vendorId ?? undefined
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
            from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
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
    } else {
        throw new Error(`Failed to send follow-up #${sequence} to ${vendorEmail}`);
    }
}




// ═══════════════════════════════════════════════════════════
// ── SALES LEAD OUTREACH HANDLERS ──
// ═══════════════════════════════════════════════════════════

async function handleLeadGenerate(task: QueueItem) {
    logger.info(`[SalesOutreach] Generating intro email for lead ${task.leadId}`);

    const leadData = task.metadata;
    const outreachResult = await generateSalesOutreachContent(leadData, 0);

    if (outreachResult.error) {
        throw new Error("AI Generation Failed for sales outreach");
    }

    // Log draft
    await db.collection("lead_activities").add({
        leadId: task.leadId,
        type: "OUTREACH_QUEUED",
        description: `Sales outreach email generated for ${leadData.businessName || 'lead'}.`,
        createdAt: new Date(),
        metadata: { email: outreachResult.email },
    });

    // Enqueue SEND immediately
    await enqueueTask(db, {
        leadId: task.leadId,
        type: 'SEND',
        scheduledAt: admin.firestore.Timestamp.fromDate(new Date()),
        metadata: {
            email: outreachResult.email,
            toEmail: leadData.email,
            businessName: leadData.businessName,
        }
    });

    await updateTaskStatus(db, task.id!, 'COMPLETED');
    logger.info(`[SalesOutreach] Lead ${task.leadId} intro email generated, SEND queued.`);
}

async function handleLeadSend(task: QueueItem) {
    logger.info(`[SalesOutreach] Sending email for lead ${task.leadId}`);

    const toEmail = task.metadata?.toEmail;
    if (!toEmail) {
        logger.warn(`[SalesOutreach] No email for lead ${task.leadId}, skipping.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    const emailData = task.metadata.email;
    const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.7;">${(emailData?.body || '').replace(/\n/g, '<br/>')}</div>`;

    const sendSuccess = await sendEmail(
        toEmail,
        emailData?.subject || 'Xiri Facility Solutions — Simplify Your Facility Management',
        htmlBody
    );

    await db.collection("lead_activities").add({
        leadId: task.leadId,
        type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
        description: sendSuccess
            ? `Sales email sent to ${toEmail}.`
            : `Failed to send sales email to ${toEmail}.`,
        createdAt: new Date(),
        metadata: { to: toEmail, subject: emailData?.subject },
    });

    await updateTaskStatus(db, task.id!, sendSuccess ? 'COMPLETED' : 'FAILED');

    if (sendSuccess) {
        await db.collection("leads").doc(task.leadId!).update({
            outreachStatus: 'SENT',
            outreachSentAt: new Date(),
        });
    }
}

async function handleLeadFollowUp(task: QueueItem) {
    const sequence = task.metadata?.sequence || 1;
    logger.info(`[SalesOutreach] Processing follow-up #${sequence} for lead ${task.leadId}`);

    // Check if lead is still qualified (hasn't progressed or been lost)
    const leadDoc = await db.collection("leads").doc(task.leadId!).get();
    const leadData = leadDoc.exists ? leadDoc.data() : null;

    if (!leadData) {
        logger.warn(`[SalesOutreach] Lead ${task.leadId} not found, skipping.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    // Skip if lead has already replied or been lost
    if (leadData.outreachStatus === 'REPLIED' || leadData.status === 'lost') {
        logger.info(`[SalesOutreach] Lead ${task.leadId} status is '${leadData.outreachStatus || leadData.status}', skipping follow-up.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    const toEmail = task.metadata?.email || leadData.email;
    if (!toEmail) {
        logger.warn(`[SalesOutreach] No email for lead ${task.leadId}, skipping.`);
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        return;
    }

    // Generate follow-up content via AI
    const outreachResult = await generateSalesOutreachContent({
        ...leadData,
        ...task.metadata,
    }, sequence);

    if (outreachResult.error) {
        throw new Error(`AI generation failed for sales follow-up #${sequence}`);
    }

    const emailData = outreachResult.email;
    const htmlBody = buildSalesFollowUpEmail(
        sequence,
        task.metadata?.businessName || leadData.businessName || 'there',
        task.metadata?.contactName || leadData.contactName || '',
        emailData?.body || '',
    );

    const subject = emailData?.subject || task.metadata?.subject || `Follow-up: ${task.metadata?.businessName || 'Your facility'}`;
    const sendSuccess = await sendEmail(toEmail, subject, htmlBody);

    if (sendSuccess) {
        await db.collection("lead_activities").add({
            leadId: task.leadId,
            type: "FOLLOW_UP_SENT",
            description: `Sales follow-up #${sequence} sent to ${toEmail}`,
            createdAt: new Date(),
            metadata: { sequence, email: toEmail },
        });
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        logger.info(`[SalesOutreach] Follow-up #${sequence} sent to ${toEmail} for lead ${task.leadId}`);
    } else {
        throw new Error(`Failed to send sales follow-up #${sequence} to ${toEmail}`);
    }
}

function buildSalesFollowUpEmail(sequence: number, businessName: string, contactName: string, aiBody: string): string {
    const greeting = contactName ? `Hi ${contactName},` : `Hello,`;
    const signoff = sequence >= 3 ? 'Best regards' : 'Best';

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0c4a6e, #0369a1); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Xiri Facility Solutions</h1>
            <p style="color: #bae6fd; margin: 4px 0 0; font-size: 13px;">Your Single-Source Facility Partner</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px;">${greeting}</p>
            <div style="font-size: 15px; line-height: 1.7;">${aiBody.replace(/\n/g, '<br/>')}</div>
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://xiri.ai/contact?ref=outreach" style="display: inline-block; padding: 14px 32px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    Schedule a Free Walkthrough
                </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">Have questions? Simply reply to this email.</p>
            <p style="margin-top: 24px; font-size: 14px;">${signoff},<br/><strong>Xiri Facility Solutions</strong></p>
        </div>
    </div>`;
}

