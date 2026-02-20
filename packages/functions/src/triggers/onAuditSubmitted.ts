import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const INTERNAL_NOTIFY_EMAIL = "chris@xiri.ai";

/**
 * Fires when a new lead is created from the audit wizard.
 * 
 * Actions:
 * 1. Send confirmation email to the lead
 * 2. Send internal notification to chris@xiri.ai
 * 3. Log to activity_logs
 */
export const onAuditSubmitted = onDocumentCreated({
    document: "leads/{leadId}",
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const leadId = event.params.leadId;

    // Only fire for audit wizard leads
    if (data.source !== 'audit_wizard') return;

    const businessName = data.businessName || data.companyName || 'Your Facility';
    const contactName = data.contactName || data.name || '';
    const contactEmail = data.email || data.contactEmail;
    const address = data.address || data.location || '';

    if (!contactEmail) {
        logger.warn(`[AuditSubmitted] Lead ${leadId} has no email — skipping confirmation`);
        return;
    }

    // 1. Send confirmation email to the lead
    await db.collection('mail_queue').add({
        to: contactEmail,
        subject: `We received your audit request — ${businessName}`,
        templateType: 'audit_confirmation',
        templateData: {
            html: buildAuditConfirmationEmail(contactName, businessName),
        },
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Send internal notification
    await db.collection('mail_queue').add({
        to: INTERNAL_NOTIFY_EMAIL,
        subject: `🔔 New Audit Lead: ${businessName}`,
        templateType: 'internal_notification',
        templateData: {
            html: buildInternalNotificationEmail(leadId, contactName, contactEmail, businessName, address, data),
        },
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Log activity
    await db.collection('activity_logs').add({
        type: 'AUDIT_SUBMITTED',
        leadId,
        email: contactEmail,
        businessName,
        description: `New audit lead from ${businessName} (${contactEmail})`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[AuditSubmitted] Confirmation + internal alert sent for lead ${leadId} (${businessName})`);
});


// ─── Email Builders ───────────────────────────────────────────────────

function buildAuditConfirmationEmail(contactName: string, businessName: string): string {
    const greeting = contactName ? `Hi ${contactName}` : 'Hello';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">XIRI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Facility Solutions</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        ${greeting},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Thank you for requesting a facility audit for <strong>${businessName}</strong>. We've received your information and a member of our team will reach out within <strong>24 hours</strong> to schedule your complimentary assessment.
      </p>

      <!-- What's Next -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #0369a1; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What happens next?</p>
        <ol style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 18px;">
          <li>A Facility Solutions Manager will contact you</li>
          <li>We'll schedule a walkthrough of your facility</li>
          <li>You'll receive a custom maintenance plan & quote</li>
        </ol>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        Questions in the meantime? Reply to this email — we're happy to help.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions • <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}


function buildInternalNotificationEmail(
    leadId: string,
    contactName: string,
    contactEmail: string,
    businessName: string,
    address: string,
    data: any,
): string {
    const facilityType = data.facilityType || data.propertyType || 'Not specified';
    const sqft = data.squareFootage || data.sqft || 'Not specified';
    const services = data.services?.join(', ') || data.selectedServices?.join(', ') || 'Not specified';

    return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px; color: #111827;">🔔 New Audit Lead</h2>
    
    <table style="width: 100%; font-size: 14px; color: #374151;">
      <tr><td style="padding: 6px 0; color: #6b7280;">Business:</td><td style="padding: 6px 0; font-weight: 600;">${businessName}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Contact:</td><td style="padding: 6px 0;">${contactName || 'N/A'} — ${contactEmail}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Address:</td><td style="padding: 6px 0;">${address || 'N/A'}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Facility Type:</td><td style="padding: 6px 0;">${facilityType}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Sq Ft:</td><td style="padding: 6px 0;">${sqft}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Services:</td><td style="padding: 6px 0;">${services}</td></tr>
    </table>

    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <a href="https://app.xiri.ai/sales/crm/${leadId}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">View in Dashboard →</a>
    </div>
  </div>
</body>
</html>`;
}
