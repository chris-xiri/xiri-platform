/**
 * sendSingleLeadEmail – Send a one-off targeted email to a lead.
 *
 * Called from the dashboard CRM when a user picks a targeted template
 * (e.g. "Backflow Preventer") instead of starting a full drip sequence.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendEmail, getTemplate, replaceVariables, injectFacilityPhrases } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const sendSingleLeadEmail = onCall(
    { secrets: ["RESEND_API_KEY"] },
    async (request) => {
    const { leadId, templateId, contactId: requestedContactId } = request.data;

    if (!leadId || !templateId) {
        throw new HttpsError('invalid-argument', 'leadId and templateId are required');
    }

    // ── Fetch the lead (try companies first, fall back to leads) ──
    let leadDoc = await db.collection("companies").doc(leadId).get();
    let leadCollection = "companies";
    if (!leadDoc.exists) {
        leadDoc = await db.collection("leads").doc(leadId).get();
        leadCollection = "leads";
    }
    if (!leadDoc.exists) {
        throw new HttpsError('not-found', `Lead/Company ${leadId} not found`);
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || lead.name || 'Unknown';

    // ── Guard: block sends to unsubscribed / lost leads ──
    if (lead.unsubscribedAt || lead.status === 'lost') {
        throw new HttpsError(
            'failed-precondition',
            `${businessName} has unsubscribed or is marked as lost — cannot send email.`
        );
    }

    // ─── Resolve contact (contact-centric model) ───
    let contactId: string | null = requestedContactId || null;
    let contactEmail: string = '';
    let contactName: string = '';
    let contactUnsubscribed = false;

    if (contactId) {
        const contactDoc = await db.collection('contacts').doc(contactId).get();
        if (contactDoc.exists) {
            const c = contactDoc.data()!;
            contactEmail = c.email || '';
            contactName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
            contactUnsubscribed = c.unsubscribed || false;
        }
    }

    if (!contactEmail) {
        // Try primary contact lookup
        const primarySnap = await db.collection('contacts')
            .where('companyId', '==', leadId)
            .where('isPrimary', '==', true)
            .limit(1)
            .get();

        if (!primarySnap.empty) {
            const pDoc = primarySnap.docs[0];
            contactId = pDoc.id;
            const pData = pDoc.data();
            contactEmail = pData.email || '';
            contactName = `${pData.firstName || ''} ${pData.lastName || ''}`.trim();
            contactUnsubscribed = pData.unsubscribed || false;
        }
    }

    // Backward compat: fall back to lead-level email
    if (!contactEmail) {
        contactEmail = lead.email || '';
        contactName = lead.contactName || '';
        contactUnsubscribed = lead.unsubscribed || false;
    }

    if (!contactEmail || contactEmail.trim().length === 0) {
        throw new HttpsError(
            'failed-precondition',
            `Lead ${businessName} has no email — cannot send.`
        );
    }

    // Check unsubscribe (contact-level takes priority)
    if (contactUnsubscribed) {
        throw new HttpsError(
            'failed-precondition',
            `${contactName || 'Contact'} has unsubscribed from emails.`
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
        contactName,
        facilityType: lead.facilityType || '',
        address: lead.address || '',
        squareFootage: lead.squareFootage || '',
        email: contactEmail,
    };

    // Inject facility-type personalization phrases (spaceNoun, cadencePhrase, etc.)
    injectFacilityPhrases(variables);

    logger.info(`[SendSingle] Variables for merge:`, variables);

    // Merge subject + body with variables
    const mergedSubject = replaceVariables(template.subject, variables);
    const templateBody = (template as any).content || (template as any).body || '';
    logger.info(`[SendSingle] Template body field found: ${templateBody ? 'yes' : 'no'}, length: ${templateBody.length}`);
    const mergedBody = replaceVariables(templateBody, variables);

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
            contactId: contactId || null,
            type: "EMAIL_FAILED",
            description: `Failed to send targeted email "${templateId}" to ${contactEmail}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentBy: request.auth?.uid || 'manual',
            metadata: { templateId, subject: mergedSubject, to: contactEmail, contactId: contactId || null },
        });

        throw new HttpsError('internal', 'Failed to send email via Resend');
    }

    // ── Log success ──
    await db.collection("lead_activities").add({
        leadId,
        contactId: contactId || null,
        type: "TARGETED_EMAIL_SENT",
        description: `Targeted email "${templateId}" sent to ${contactEmail}: ${mergedSubject}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: request.auth?.uid || 'manual',
        metadata: {
            templateId,
            subject: mergedSubject,
            to: contactEmail,
            resendId: result.resendId,
            contactId: contactId || null,
        },
    });

    // Update lead status to contacted if still new
    if (lead.status === 'new') {
        await db.collection(leadCollection).doc(leadId).update({
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
