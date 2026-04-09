/**
 * sendPreviewEmail – Send a preview/test email to the current user.
 *
 * Called from the email template editor to let admins see what a
 * merged template looks like in their actual inbox (Gmail, etc.).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendEmail, replaceVariables, injectFacilityPhrases } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const sendPreviewEmail = onCall(
    { secrets: ["RESEND_API_KEY"] },
    async (request) => {
        // Auth required
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }

        const { to, subject, body, sampleData } = request.data;

        if (!to || !subject || !body) {
            throw new HttpsError('invalid-argument', 'to, subject, and body are required');
        }

        // Build merge variables from sample data
        const variables: Record<string, string> = { ...sampleData };

        // Inject facility phrases if facilityType is present
        if (variables.facilityType) {
            injectFacilityPhrases(variables);
        }

        // Merge variables into subject and body
        const mergedSubject = `[PREVIEW] ${replaceVariables(subject, variables)}`;
        let mergedBody = replaceVariables(body, variables);

        // If the body is already HTML (from rich text editor), use as-is
        // Otherwise convert plain text to HTML
        if (!mergedBody.includes('<p>') && !mergedBody.includes('<br')) {
            mergedBody = mergedBody
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }

        logger.info(`[SendPreview] Sending test email to ${to}: "${mergedSubject}"`);

        const result = await sendEmail(
            to,
            mergedSubject,
            mergedBody,
            undefined, // no attachments
            'XIRI Facility Solutions <chris@xiri.ai>',
            undefined, // no entity ID
            undefined, // no template ID
            undefined, // no entity type (skip unsubscribe footer)
        );

        if (!result.success) {
            throw new HttpsError('internal', 'Failed to send preview email');
        }

        logger.info(`[SendPreview] ✅ Preview sent to ${to} (Resend: ${result.resendId})`);

        return {
            success: true,
            message: `Preview sent to ${to}`,
            resendId: result.resendId,
        };
    }
);
