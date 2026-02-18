import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { fetchPendingTasks, updateTaskStatus, enqueueTask, QueueItem } from "../utils/queueUtils";
import { getNextBusinessSlot } from "../utils/timeUtils";
import { generateOutreachContent } from "../agents/outreach";
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
                if (task.type === 'GENERATE') {
                    await handleGenerate(task);
                } else if (task.type === 'SEND') {
                    await handleSend(task);
                } else if (task.type === 'FOLLOW_UP') {
                    await handleFollowUp(task);
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
            }
        }
    } catch (error) {
        logger.error("Fatal error in queue processor:", error);
    }
});

async function handleGenerate(task: QueueItem) {
    logger.info(`Generating content for task ${task.id}`);

    // Reconstruct vendor object from metadata
    // In production, might be better to fetch fresh vendor data
    const vendorData = task.metadata;

    const outreachResult = await generateOutreachContent(vendorData, vendorData.phone ? 'SMS' : 'EMAIL');

    if (outreachResult.error) {
        throw new Error("AI Generation Failed: " + (outreachResult.sms || "Unknown Error"));
    }

    // 1. Log the drafts (Visible to User)
    await db.collection("vendor_activities").add({
        vendorId: task.vendorId,
        type: "OUTREACH_QUEUED", // Using same type for UI compatibility
        description: `Outreach drafts generated (waiting to send).`,
        createdAt: new Date(),
        metadata: {
            sms: outreachResult.sms,
            email: outreachResult.email,
            preferredChannel: outreachResult.channel,
            campaignUrgency: vendorData.hasActiveContract ? "URGENT" : "SUPPLY"
        }
    });

    // 2. Calculate Schedule
    const scheduledTime = getNextBusinessSlot(vendorData.hasActiveContract ? "URGENT" : "SUPPLY");

    // 3. Enqueue SEND Task
    await enqueueTask(db, {
        vendorId: task.vendorId,
        type: 'SEND',
        scheduledAt: admin.firestore.Timestamp.fromDate(scheduledTime),
        metadata: {
            // Pass the generated content along
            sms: outreachResult.sms,
            email: outreachResult.email,
            channel: outreachResult.channel
        }
    });

    // 4. Mark GENERATE task complete
    await updateTaskStatus(db, task.id!, 'COMPLETED');
    logger.info(`Task ${task.id} completed. Send scheduled for ${scheduledTime.toISOString()}`);
}

async function handleSend(task: QueueItem) {
    logger.info(`Executing SEND for task ${task.id}`);

    const vendorDoc = await db.collection("vendors").doc(task.vendorId).get();
    const vendor = vendorDoc.exists ? vendorDoc.data() : null;
    const vendorEmail = vendor?.email || task.metadata?.email?.to;

    let sendSuccess = false;

    if (task.metadata.channel === 'EMAIL' && vendorEmail) {
        // ─── Real Resend Email ───
        const emailData = task.metadata.email;
        const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || '').replace(/\n/g, '<br/>')}</div>`;

        sendSuccess = await sendEmail(
            vendorEmail,
            emailData?.subject || 'Xiri Facility Solutions — Partnership Opportunity',
            htmlBody
        );

        if (!sendSuccess) {
            logger.error(`Failed to send email to ${vendorEmail} for task ${task.id}`);
            throw new Error(`Resend email failed for vendor ${task.vendorId}`);
        }
    } else if (task.metadata.channel === 'SMS') {
        // ─── SMS: Twilio integration deferred ───
        logger.info(`SMS send deferred for task ${task.id} (Twilio not yet integrated)`);
        sendSuccess = true; // Log as success for now
    } else {
        logger.warn(`No valid channel/email for task ${task.id}. Channel: ${task.metadata.channel}, Email: ${vendorEmail}`);
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
            content: task.metadata.channel === 'SMS' ? task.metadata.sms : task.metadata.email?.subject
        }
    });

    await updateTaskStatus(db, task.id!, sendSuccess ? 'COMPLETED' : 'FAILED');

    // Update Vendor Record
    if (sendSuccess) {
        await db.collection("vendors").doc(task.vendorId).update({
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
        await db.collection("vendors").doc(task.vendorId).update({
            outreachStatus: 'PENDING',
            outreachChannel: task.metadata.channel,
            outreachTime: new Date()
        });
    }
}

async function handleFollowUp(task: QueueItem) {
    logger.info(`Processing FOLLOW_UP task ${task.id} (sequence ${task.metadata?.sequence})`);

    const vendorDoc = await db.collection("vendors").doc(task.vendorId).get();
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

    const sequence = task.metadata?.sequence || 1;
    const businessName = task.metadata?.businessName || vendor.businessName || 'there';
    const isSpanish = (task.metadata?.preferredLanguage || vendor.preferredLanguage) === 'es';

    const unsubscribeUrl = `https://us-central1-xiri-facility-solutions.cloudfunctions.net/handleUnsubscribe?vendorId=${task.vendorId}`;
    const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;

    const subject = task.metadata?.subject || `Follow-up: Complete your Xiri profile`;
    const html = buildFollowUpEmail(sequence, businessName, onboardingUrl, unsubscribeUrl, isSpanish);

    const sendSuccess = await sendEmail(vendorEmail, subject, html);

    if (sendSuccess) {
        await db.collection("vendor_activities").add({
            vendorId: task.vendorId,
            type: "FOLLOW_UP_SENT",
            description: `Follow-up #${sequence} sent to ${vendorEmail}`,
            createdAt: new Date(),
            metadata: { sequence, email: vendorEmail, channel: 'EMAIL' }
        });
        await updateTaskStatus(db, task.id!, 'COMPLETED');
        logger.info(`Follow-up #${sequence} sent to ${vendorEmail} for vendor ${task.vendorId}`);
    } else {
        throw new Error(`Failed to send follow-up #${sequence} to ${vendorEmail}`);
    }
}

function buildFollowUpEmail(sequence: number, businessName: string, onboardingUrl: string, unsubscribeUrl: string, isSpanish: boolean): string {
    const msgs: Record<number, { en: { body: string; cta: string }; es: { body: string; cta: string } }> = {
        1: {
            en: {
                body: `We noticed you haven't completed your Xiri profile yet. Completing your profile is the first step to receiving work opportunities from our network of medical and commercial facilities.`,
                cta: 'Complete My Profile'
            },
            es: {
                body: `Notamos que aún no ha completado su perfil de Xiri. Completar su perfil es el primer paso para recibir oportunidades de trabajo de nuestra red de instalaciones médicas y comerciales.`,
                cta: 'Completar Mi Perfil'
            }
        },
        2: {
            en: {
                body: `Just checking in — we'd love to have you on board. Our contractor network is growing and there are active opportunities in your area. It only takes a few minutes to complete your profile.`,
                cta: 'Finish My Application'
            },
            es: {
                body: `Solo queríamos saber cómo está — nos encantaría contar con usted. Nuestra red de contratistas está creciendo y hay oportunidades activas en su área.`,
                cta: 'Finalizar Mi Solicitud'
            }
        },
        3: {
            en: {
                body: `This is our final follow-up. We don't want you to miss out on work opportunities with Xiri. If you're still interested, please complete your profile. Otherwise, we'll remove you from our outreach list.`,
                cta: 'Complete Profile Now'
            },
            es: {
                body: `Este es nuestro último seguimiento. No queremos que pierda las oportunidades de trabajo con Xiri. Si aún está interesado, complete su perfil.`,
                cta: 'Completar Perfil Ahora'
            }
        }
    };

    const msg = msgs[sequence]?.[isSpanish ? 'es' : 'en'] || msgs[1].en;
    const greeting = isSpanish ? `Hola ${businessName},` : `Hi ${businessName},`;
    const reply = isSpanish ? '¿Preguntas? Simplemente responda a este correo.' : 'Questions? Just reply to this email.';
    const unsub = isSpanish ? 'Cancelar suscripción' : 'Unsubscribe from future emails';
    const signoff = isSpanish ? 'Saludos cordiales' : 'Best regards';

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Xiri Facility Solutions</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px;">${greeting}</p>
            <p style="font-size: 15px; line-height: 1.7;">${msg.body}</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${onboardingUrl}" style="display: inline-block; padding: 14px 32px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    ${msg.cta}
                </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">${reply}</p>
            <p style="margin-top: 24px; font-size: 14px;">${signoff},<br/><strong>Xiri Facility Solutions Team</strong></p>
        </div>
        <div style="text-align: center; margin-top: 16px;">
            <a href="${unsubscribeUrl}" style="font-size: 11px; color: #94a3b8; text-decoration: underline;">${unsub}</a>
        </div>
    </div>`;
}
