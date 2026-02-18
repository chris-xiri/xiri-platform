import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { Resend } from "resend";

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Sends a notification email to chris@xiri.ai when a vendor
 * completes the onboarding form (status → compliance_review).
 */
export const onOnboardingComplete = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: ["RESEND_API_KEY"],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when status changes TO 'compliance_review'
    if (before.status === after.status) return;
    if (after.status !== 'compliance_review') return;

    const vendorId = event.params.vendorId;
    const businessName = after.businessName || 'Unknown Vendor';
    const email = after.email || 'N/A';
    const phone = after.phone || 'N/A';
    const track = after.onboardingTrack || 'STANDARD';
    const lang = after.preferredLanguage || 'en';

    logger.info(`Vendor ${vendorId} (${businessName}) completed onboarding. Sending notification.`);

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Build compliance summary
    const compliance = after.compliance || {};
    const complianceLines = [
        `Business Entity: ${compliance.hasBusinessEntity ? '✅ Yes' : '❌ No'}`,
        `General Liability: ${compliance.generalLiability?.hasInsurance ? '✅ Yes' : '❌ No'}`,
        `Workers Comp: ${compliance.workersComp?.hasInsurance ? '✅ Yes' : '❌ No'}`,
        `Auto Insurance: ${compliance.autoInsurance?.hasInsurance ? '✅ Yes' : '❌ No'}`,
        `W-9 Collected: ${compliance.w9Collected ? '✅ Yes' : '⏳ Pending'}`,
    ].join('<br/>');

    const dashboardLink = `https://app.xiri.ai/supply/crm/${vendorId}`;

    const html = `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px;">
        <h2 style="color: #0c4a6e;">🏗️ Vendor Onboarding Complete</h2>
        <p><strong>${businessName}</strong> has completed the onboarding form and is ready for compliance review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${email}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${phone}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Track</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${track === 'FAST_TRACK' ? '⚡ Express Contract' : '🤝 Partner Network'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Language</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${lang === 'es' ? '🇪🇸 Spanish' : '🇺🇸 English'}</td></tr>
        </table>

        <h3 style="color: #0c4a6e; margin-top: 24px;">Compliance Self-Report</h3>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px;">
            ${complianceLines}
        </div>

        <div style="margin-top: 24px;">
            <a href="${dashboardLink}" style="display: inline-block; padding: 12px 24px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Review in CRM →
            </a>
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
            Vendor ID: ${vendorId}
        </p>
    </div>`;

    try {
        const { data, error } = await resend.emails.send({
            from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
            to: 'chris@xiri.ai',
            subject: `🏗️ Vendor Onboarded: ${businessName}`,
            html,
        });

        if (error) {
            logger.error('Failed to send onboarding notification:', error);
        } else {
            logger.info(`Notification sent to chris@xiri.ai (Resend ID: ${data?.id})`);
        }
    } catch (err) {
        logger.error('Error sending onboarding notification:', err);
    }

    // ─── Vendor Confirmation Email ───
    if (email && email !== 'N/A') {
        const isSpanish = lang === 'es';

        const vendorHtml = isSpanish ? `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">¡Recibimos su solicitud!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hola <strong>${businessName}</strong>,</p>
            <p>Gracias por completar su solicitud para unirse a la Red de Contratistas de Xiri. Hemos recibido su información y nuestro equipo la revisará en breve.</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 15px;">Lo que recibimos:</h3>
                <p style="margin: 4px 0; font-size: 14px;">📧 Email: ${email}</p>
                <p style="margin: 4px 0; font-size: 14px;">📞 Teléfono: ${phone}</p>
                <p style="margin: 4px 0; font-size: 14px;">📋 Modalidad: ${track === 'FAST_TRACK' ? '⚡ Contrato Express' : '🤝 Red de Socios'}</p>
            </div>

            <h3 style="color: #0c4a6e; font-size: 15px;">Próximos Pasos:</h3>
            <ol style="font-size: 14px; padding-left: 20px;">
                <li>Nuestro equipo revisará sus documentos e información</li>
                <li>Recibirá una confirmación cuando su cuenta esté verificada</li>
                <li>Una vez aprobado, comenzará a recibir oportunidades de trabajo</li>
            </ol>

            <p style="font-size: 14px; color: #64748b;">Si tiene alguna pregunta, simplemente responda a este correo.</p>

            <p style="margin-top: 24px;">Saludos cordiales,<br/><strong>Equipo Xiri Facility Solutions</strong></p>
        </div>
    </div>` : `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">We've received your application!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi <strong>${businessName}</strong>,</p>
            <p>Thank you for completing your application to join the Xiri Contractor Network. We've received your information and our team will review it shortly.</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 15px;">What we received:</h3>
                <p style="margin: 4px 0; font-size: 14px;">📧 Email: ${email}</p>
                <p style="margin: 4px 0; font-size: 14px;">📞 Phone: ${phone}</p>
                <p style="margin: 4px 0; font-size: 14px;">📋 Track: ${track === 'FAST_TRACK' ? '⚡ Express Contract' : '🤝 Partner Network'}</p>
            </div>

            <h3 style="color: #0c4a6e; font-size: 15px;">What happens next:</h3>
            <ol style="font-size: 14px; padding-left: 20px;">
                <li>Our team will review your documents and information</li>
                <li>You'll receive a confirmation once your account is verified</li>
                <li>Once approved, you'll start receiving work opportunities</li>
            </ol>

            <p style="font-size: 14px; color: #64748b;">If you have any questions, just reply to this email.</p>

            <p style="margin-top: 24px;">Best regards,<br/><strong>Xiri Facility Solutions Team</strong></p>
        </div>
    </div>`;

        const vendorSubject = isSpanish
            ? `✅ Solicitud recibida — ${businessName}`
            : `✅ Application received — ${businessName}`;

        try {
            const { error: vendorError } = await resend.emails.send({
                from: 'Xiri Facility Solutions <onboarding@xiri.ai>',
                replyTo: 'chris@xiri.ai',
                to: email,
                subject: vendorSubject,
                html: vendorHtml,
            });

            if (vendorError) {
                logger.error('Failed to send vendor confirmation:', vendorError);
            } else {
                logger.info(`Vendor confirmation sent to ${email}`);
            }
        } catch (err) {
            logger.error('Error sending vendor confirmation:', err);
        }
    }

    // Log activity
    await admin.firestore().collection("vendor_activities").add({
        vendorId,
        type: "ONBOARDING_COMPLETE",
        description: `${businessName} completed onboarding form (${track}). Notifications sent to chris@xiri.ai and ${email}.`,
        createdAt: new Date(),
        metadata: { track, email, phone, lang }
    });
});
