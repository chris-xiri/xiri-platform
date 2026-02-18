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

    // Log activity
    await admin.firestore().collection("vendor_activities").add({
        vendorId,
        type: "ONBOARDING_COMPLETE",
        description: `${businessName} completed onboarding form (${track}). Notification sent to chris@xiri.ai.`,
        createdAt: new Date(),
        metadata: { track, email, phone, lang }
    });
});
