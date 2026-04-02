/**
 * sendSingleLeadEmail – Send a one-off targeted email to a lead.
 *
 * Called from the dashboard CRM when a user picks a targeted template
 * (e.g. "Backflow Preventer") instead of starting a full drip sequence.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendEmail, getTemplate, replaceVariables } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const sendSingleLeadEmail = onCall(async (request) => {
    const { leadId, templateId } = request.data;

    if (!leadId || !templateId) {
        throw new HttpsError('invalid-argument', 'leadId and templateId are required');
    }

    // ── Fetch the lead ──
    const leadDoc = await db.collection("leads").doc(leadId).get();
    if (!leadDoc.exists) {
        throw new HttpsError('not-found', `Lead ${leadId} not found`);
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || 'Unknown';
    const contactEmail = lead.email;

    if (!contactEmail || contactEmail.trim().length === 0) {
        throw new HttpsError(
            'failed-precondition',
            `Lead ${businessName} has no email — cannot send.`
        );
    }

    // Check unsubscribe
    if (lead.unsubscribed) {
        throw new HttpsError(
            'failed-precondition',
            `Lead ${businessName} has unsubscribed from emails.`
        );
    }

    // ── Fetch the template ──
    const template = await getTemplate(templateId);
    if (!template) {
        throw new HttpsError('not-found', `Template ${templateId} not found`);
    }

    // ── Build merge variables ──
    const variables: Record<string, string> = {
        businessName,
        contactName: lead.contactName || '',
        facilityType: lead.facilityType || '',
        address: lead.address || '',
        squareFootage: lead.squareFootage || '',
        email: contactEmail,
    };

    // Merge subject + body with variables
    const mergedSubject = replaceVariables(template.subject, variables);
    const mergedBody = replaceVariables(template.content || (template as any).body || '', variables);

    // Convert plain text body to HTML (preserve line breaks)
    const htmlBody = mergedBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    logger.info(`[SendSingle] Sending "${templateId}" to ${contactEmail} for lead ${leadId}`);

    // ── Send via Resend ──
    const result = await sendEmail(
        contactEmail,
        mergedSubject,
        htmlBody,
        undefined, // attachments
        'XIRI Facility Solutions <chris@xiri.ai>',
        leadId,
        templateId,
        'lead',
    );

    if (!result.success) {
        // Log failure
        await db.collection("lead_activities").add({
            leadId,
            type: "EMAIL_FAILED",
            description: `Failed to send targeted email "${templateId}" to ${contactEmail}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentBy: request.auth?.uid || 'manual',
            metadata: { templateId, subject: mergedSubject, to: contactEmail },
        });

        throw new HttpsError('internal', 'Failed to send email via Resend');
    }

    // ── Log success ──
    await db.collection("lead_activities").add({
        leadId,
        type: "TARGETED_EMAIL_SENT",
        description: `Targeted email "${templateId}" sent to ${contactEmail}: ${mergedSubject}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: request.auth?.uid || 'manual',
        metadata: {
            templateId,
            subject: mergedSubject,
            to: contactEmail,
            resendId: result.resendId,
        },
    });

    // Update lead status to contacted if still new
    if (lead.status === 'new') {
        await db.collection("leads").doc(leadId).update({
            status: 'contacted',
        });
    }

    logger.info(`[SendSingle] ✅ Sent "${mergedSubject}" to ${contactEmail} (Resend: ${result.resendId})`);

    return {
        success: true,
        message: `Email sent to ${contactEmail}`,
        subject: mergedSubject,
        resendId: result.resendId,
    };
});
