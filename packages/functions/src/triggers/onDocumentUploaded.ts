import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { verifyDocument, verifyAcord25 } from "../agents/documentVerifier";

const db = admin.firestore();

export const onDocumentUploaded = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: ["GEMINI_API_KEY", "RESEND_API_KEY"]
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const vendorId = event.params.vendorId;

    if (!before || !after) return;

    // ─── ACORD 25 Verification ───
    const acord25Before = before.compliance?.acord25?.status;
    const acord25After = after.compliance?.acord25?.status;

    if (acord25After === 'PENDING' && acord25Before !== 'PENDING') {
        logger.info(`Processing ACORD 25 for vendor ${vendorId}`);

        const fileUrl = after.compliance?.acord25?.url;
        if (!fileUrl) {
            logger.error(`No ACORD 25 URL found for vendor ${vendorId}`);
            return;
        }

        const vendorName = after.businessName || after.companyName || "Vendor";
        const attestations = {
            hasGL: after.compliance?.generalLiability?.hasInsurance || false,
            hasWC: after.compliance?.workersComp?.hasInsurance || false,
            hasAuto: after.compliance?.autoInsurance?.hasInsurance || false,
            hasEntity: after.compliance?.hasBusinessEntity || false
        };

        try {
            const result = await verifyAcord25(fileUrl, vendorName, attestations);

            // Determine status: VERIFIED, FLAGGED, or REJECTED
            const status = result.valid ? 'VERIFIED' : (result.flags.length > 0 ? 'FLAGGED' : 'REJECTED');

            // Update the vendor document
            await db.doc(`vendors/${vendorId}`).update({
                'compliance.acord25.status': status,
                'compliance.acord25.verifiedAt': admin.firestore.FieldValue.serverTimestamp(),
                'compliance.acord25.aiAnalysis': {
                    valid: result.valid,
                    reasoning: result.reasoning,
                    extracted: result.extracted
                },
                'compliance.acord25.extractedData': result.extracted,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log activity
            await db.collection('vendor_activities').add({
                vendorId,
                type: 'AI_VERIFICATION',
                description: `AI ${status === 'VERIFIED' ? 'Verified' : 'Flagged'} ACORD 25: ${result.reasoning}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    docType: 'ACORD_25',
                    status,
                    valid: result.valid,
                    flags: result.flags,
                    extracted: result.extracted
                }
            });

            logger.info(`ACORD 25 verification complete for ${vendorId}: ${status}`);

            // If flagged, notify admin
            if (status === 'FLAGGED') {
                await sendFlagNotification(vendorId, vendorName, result.flags, result.reasoning);
            }

        } catch (error) {
            logger.error(`ACORD 25 verification failed for ${vendorId}:`, error);

            await db.doc(`vendors/${vendorId}`).update({
                'compliance.acord25.status': 'FLAGGED',
                'compliance.acord25.aiAnalysis': {
                    valid: false,
                    reasoning: `Verification error: ${error}`,
                    extracted: {}
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return; // Don't process legacy triggers for ACORD 25 uploads
    }

    // ─── Legacy: COI Verification ───
    if (after.compliance?.coi?.status === 'PENDING' && before.compliance?.coi?.status !== 'PENDING') {
        logger.info(`Processing COI for ${vendorId}`);
        await runLegacyVerification(vendorId, 'COI', after);
    }

    // ─── Legacy: W9 Verification ───
    if (after.compliance?.w9?.status === 'PENDING' && before.compliance?.w9?.status !== 'PENDING') {
        logger.info(`Processing W9 for ${vendorId}`);
        await runLegacyVerification(vendorId, 'W9', after);
    }
});

// ─── Legacy Verification Runner ───
async function runLegacyVerification(vendorId: string, docType: 'COI' | 'W9', vendorData: any) {
    try {
        const result = await verifyDocument(docType, vendorData.companyName || "Vendor", vendorData.specialty || "General");

        const fieldPath = docType === 'COI' ? 'compliance.coi' : 'compliance.w9';
        await db.doc(`vendors/${vendorId}`).update({
            [`${fieldPath}.status`]: result.valid ? 'VERIFIED' : 'REJECTED',
            [`${fieldPath}.aiAnalysis`]: {
                valid: result.valid,
                reasoning: result.reasoning,
                extracted: result.extracted
            },
            [`${fieldPath}.verifiedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('vendor_activities').add({
            vendorId,
            type: 'AI_VERIFICATION',
            description: `AI ${result.valid ? 'Verified' : 'Rejected'} ${docType}: ${result.reasoning}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                docType,
                valid: result.valid,
                extracted: result.extracted
            }
        });

        if (result.valid) {
            const { sendTemplatedEmail } = await import('../utils/emailUtils');
            await sendTemplatedEmail(vendorId, 'doc_upload_notification', {
                documentType: docType === 'COI' ? 'Certificate of Insurance' : 'W-9 Form'
            });
        }

    } catch (error) {
        logger.error(`Verification failed for ${docType}:`, error);
    }
}

// ─── Flag Notification Email ───
async function sendFlagNotification(vendorId: string, vendorName: string, flags: string[], reasoning: string) {
    try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const flagList = flags.map(f => `<li style="color: #b45309;">${f}</li>`).join('');
        const dashboardLink = `https://app.xiri.ai/supply/crm/${vendorId}`;

        await resend.emails.send({
            from: 'Xiri Compliance <compliance@xiri.ai>',
            to: 'chris@xiri.ai',
            subject: `⚠️ ACORD 25 Flagged: ${vendorName}`,
            html: `
            <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px;">
                <h2 style="color: #b45309;">⚠️ ACORD 25 Flagged for Review</h2>
                <p><strong>${vendorName}</strong>'s ACORD 25 has been flagged by AI verification.</p>
                
                <h3 style="margin-top: 16px;">Issues Found:</h3>
                <ul>${flagList}</ul>
                
                <p style="margin-top: 16px;"><strong>AI Summary:</strong> ${reasoning}</p>
                
                <div style="margin-top: 24px;">
                    <a href="${dashboardLink}" style="display: inline-block; padding: 12px 24px; background: #b45309; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Review in CRM →
                    </a>
                </div>
                
                <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
                    Vendor ID: ${vendorId}
                </p>
            </div>`
        });

        logger.info(`Flag notification sent for vendor ${vendorId}`);
    } catch (error) {
        logger.error('Failed to send flag notification:', error);
    }
}
