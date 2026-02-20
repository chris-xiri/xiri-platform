import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail } from "../utils/emailUtils";

const db = admin.firestore();

/**
 * processMailQueue — Firestore Trigger
 * 
 * Triggered when a new document is created in the `mail_queue` collection.
 * Processes the email and sends it via Resend.
 * 
 * NOTE: This is a Firestore trigger, not an HTTP function, so CORS is not applicable.
 * The dashboard writes to `mail_queue` and this function picks it up server-side.
 * 
 * Supported templateTypes:
 * - `client_invoice` — Invoice email sent to clients with a payment link
 * - `vendor_remittance` — Remittance statement sent to vendors
 * - `quote` — Quote email (handled by existing sendQuoteEmail)
 */
export const processMailQueue = onDocumentCreated({
    document: "mail_queue/{docId}",
    secrets: ["RESEND_API_KEY"],
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.error("No data in mail_queue document");
        return;
    }

    const data = snap.data();
    const docRef = snap.ref;

    try {
        // Mark as processing
        await docRef.update({ status: "processing", processedAt: admin.firestore.FieldValue.serverTimestamp() });

        const { to, subject, templateType, templateData } = data;

        if (!to || !subject) {
            throw new Error("Missing 'to' or 'subject' in mail_queue document");
        }

        // Build HTML based on template type
        let html = "";

        switch (templateType) {
            case "client_invoice":
                html = buildClientInvoiceEmail(templateData);
                break;
            case "vendor_remittance":
                html = buildVendorRemittanceEmail(templateData);
                break;
            default:
                // Generic email — use subject and any provided HTML body
                html = templateData?.html || `<p>${subject}</p>`;
                break;
        }

        // Send via Resend
        const success = await sendEmail(
            to,
            subject,
            html,
            undefined, // attachments
            "Xiri Facility Solutions <billing@xiri.ai>"
        );

        if (success) {
            await docRef.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() });
            console.log(`✅ Mail sent: ${templateType} → ${to}`);
        } else {
            await docRef.update({ status: "failed", error: "Resend API returned failure" });
            console.error(`❌ Mail failed: ${templateType} → ${to}`);
        }

    } catch (error: any) {
        console.error("Error processing mail_queue:", error);
        await docRef.update({
            status: "failed",
            error: error.message || "Unknown error",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});


// ─── Email Template Builders ──────────────────────────────────────────

function buildClientInvoiceEmail(data: any): string {
    const { clientBusinessName, clientContactName, totalAmount, paymentLink, billingPeriod } = data || {};

    const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(totalAmount || 0);
    const periodText = billingPeriod ? `${billingPeriod.start} — ${billingPeriod.end}` : "Current Period";

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
        Hi ${clientContactName || "there"},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Your invoice for <strong>${clientBusinessName || "your facility"}</strong> is ready.
      </p>

      <!-- Amount Box -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Amount Due</p>
        <p style="color: #0369a1; font-size: 32px; font-weight: 700; margin: 0;">${formattedAmount}</p>
        <p style="color: #94a3b8; font-size: 13px; margin: 8px 0 0;">Billing Period: ${periodText}</p>
      </div>

      ${paymentLink ? `
      <!-- CTA -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${paymentLink}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View Invoice & Pay</a>
      </div>
      ` : ""}

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        If you have any questions about this invoice, please reply to this email or contact your Facility Solutions Manager.
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


function buildVendorRemittanceEmail(data: any): string {
    const { vendorName, totalAmount, billingPeriod, lineItems } = data || {};

    const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(totalAmount || 0);
    const periodText = billingPeriod ? `${billingPeriod.start} — ${billingPeriod.end}` : "Current Period";

    const lineItemsHtml = (lineItems || []).map((li: any) =>
        `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151;">${li.serviceType || "—"}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #6b7280;">${li.locationName || "—"}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151; text-align: right; font-weight: 500;">$${(li.amount || 0).toLocaleString()}</td>
        </tr>`
    ).join("");

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
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Remittance Statement</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hi ${vendorName || "Partner"},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Here is your remittance statement for <strong>${periodText}</strong>. This details the services you provided and the payment owed to you.
      </p>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Service</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Location</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <!-- Total -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Total Owed to You</p>
        <p style="color: #16a34a; font-size: 28px; font-weight: 700; margin: 0;">${formattedAmount}</p>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 20px 0 0;">
        Payment will be processed according to your agreed terms. If you have any questions, please reply to this email.
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
