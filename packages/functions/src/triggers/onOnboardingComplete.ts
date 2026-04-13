import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { Resend } from "resend";
import { buildSimpleFooter, buildEmailHeader, buildEmailSignature } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Sends a Google Chat notification when a vendor
 * completes the onboarding form (status → compliance_review).
 * Also sends a confirmation email to the vendor.
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
    const capabilities: string[] = after.capabilities || [];
    const capDisplay = capabilities.length > 0 ? capabilities.map(c => c.replace(/_/g, ' ')).join(', ') : 'None specified';
    const vendorCity = after.city || '';
    const vendorState = after.state || '';
    const locationDisplay = [vendorCity, vendorState].filter(Boolean).join(', ') || 'Not specified';

    logger.info(`Vendor ${vendorId} (${businessName}) completed onboarding. Sending notification.`);

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

    // ─── Google Chat Notification Card ───
    const VENDOR_CHAT_WEBHOOK = "https://chat.googleapis.com/v1/spaces/AAQAYd8NzdA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=WFryLEM_LRyVmM5I0m5A0KghBN8yL3Fw8vZMLgBDjOQ";

    const complianceItems = [
        compliance.hasBusinessEntity ? "✅ Business Entity" : "❌ Business Entity",
        compliance.generalLiability?.hasInsurance ? "✅ General Liability" : "❌ General Liability",
        compliance.workersComp?.hasInsurance ? "✅ Workers' Comp" : "❌ Workers' Comp",
        compliance.autoInsurance?.hasInsurance ? "✅ Auto Insurance" : "❌ Auto Insurance",
    ].join("  •  ");

    const acordStatus = compliance.acord25?.url ? "✅ Uploaded" : "⏳ Not yet";

    const chatCard = {
        header: {
            title: "🏗️  New Contractor Registered",
            subtitle: `${businessName}  •  ${locationDisplay}`,
            imageUrl: "https://xiri.ai/icon.png",
            imageType: "CIRCLE",
        },
        sections: [
            {
                widgets: [
                    {
                        decoratedText: {
                            topLabel: "BUSINESS NAME",
                            text: businessName,
                            startIcon: { knownIcon: "PERSON" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "EMAIL",
                            text: email,
                            startIcon: { knownIcon: "EMAIL" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "PHONE",
                            text: phone,
                            startIcon: { knownIcon: "PHONE" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "LOCATION",
                            text: locationDisplay,
                            startIcon: { knownIcon: "MAP_PIN" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "ONBOARDING TRACK",
                            text: track === "FAST_TRACK" ? "⚡ Express Contract" : "🤝 Partner Network",
                            startIcon: { knownIcon: "BOOKMARK" },
                        },
                    },
                    {
                        decoratedText: {
                            topLabel: "LANGUAGE",
                            text: lang === "es" ? "🇪🇸 Spanish" : "🇺🇸 English",
                            startIcon: { knownIcon: "DESCRIPTION" },
                        },
                    },
                ],
            },
            {
                header: "Compliance Summary",
                widgets: [
                    { textParagraph: { text: complianceItems } },
                    {
                        decoratedText: {
                            topLabel: "ACORD 25",
                            text: acordStatus,
                            startIcon: { knownIcon: "DESCRIPTION" },
                        },
                    },
                ],
            },
            {
                header: "Service Capabilities",
                widgets: [
                    { textParagraph: { text: capDisplay } },
                ],
            },
            {
                widgets: [
                    {
                        buttonList: {
                            buttons: [
                                {
                                    text: "📋 Review in CRM",
                                    onClick: { openLink: { url: dashboardLink } },
                                },
                                ...(phone && phone !== "N/A" ? [{
                                    text: "📞 Call",
                                    onClick: { openLink: { url: `tel:${phone}` } },
                                }] : []),
                                ...(email && email !== "N/A" ? [{
                                    text: "📧 Email",
                                    onClick: { openLink: { url: `mailto:${email}` } },
                                }] : []),
                            ],
                        },
                    },
                ],
            },
        ],
    };

    try {
        const chatResp = await fetch(VENDOR_CHAT_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `New contractor registered: ${businessName} (${email}) — Services: ${capDisplay}`,
                cardsV2: [{ cardId: `vendor-onboard-${vendorId}`, card: chatCard }],
            }),
        });
        if (!chatResp.ok) {
            logger.error(`Google Chat webhook failed (${chatResp.status}):`, await chatResp.text());
        } else {
            logger.info(`Google Chat notification sent for vendor ${vendorId}`);
        }
    } catch (chatErr) {
        logger.error("Google Chat notification error:", chatErr);
    }

    // ─── Vendor Confirmation Email ───
    const resend = new Resend(process.env.RESEND_API_KEY);
    if (email && email !== 'N/A') {
        const isSpanish = lang === 'es';

        const vendorHtml = isSpanish ? `
    ${buildEmailHeader()}
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">¡Recibimos su solicitud!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hola <strong>${businessName}</strong>,</p>
            <p>Gracias por completar su solicitud para unirse a la Red de Contratistas de XIRI. Hemos recibido su información y nuestro equipo la revisará en breve.</p>

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

            ${buildEmailSignature()}
            ${buildSimpleFooter()}
        </div>
    </div>` : `
    ${buildEmailHeader()}
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">We've received your application!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi <strong>${businessName}</strong>,</p>
            <p>Thank you for completing your application to join the XIRI Contractor Network. We've received your information and our team will review it shortly.</p>

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

            ${buildEmailSignature()}
            ${buildSimpleFooter()}
        </div>
    </div>`;

        const vendorSubject = isSpanish
            ? `✅ Solicitud recibida — ${businessName}`
            : `✅ Application received — ${businessName}`;

        try {
            const { error: vendorError } = await resend.emails.send({
                from: 'XIRI Facility Solutions <onboarding@xiri.ai>',
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

    // ─── Compliance Score Calculation ───
    const db = admin.firestore();
    const hasEntity = !!compliance.hasBusinessEntity;
    const hasGL = !!compliance.generalLiability?.hasInsurance;
    const hasWC = !!compliance.workersComp?.hasInsurance;
    const hasAuto = !!compliance.autoInsurance?.hasInsurance;
    const hasW9 = !!compliance.w9Collected;

    // Attestation: up to 50 points (10 per item)
    const attestationItems = [hasEntity, hasGL, hasWC, hasAuto, hasW9];
    const attestationScore = attestationItems.filter(Boolean).length * 10;

    // Doc uploads: up to 30 points
    const uploads = compliance.uploadedDocs || {};
    const hasAcord25 = !!compliance.acord25?.url;
    const legacyDocsCount = [uploads.coi, uploads.llc, uploads.w9].filter(Boolean).length;
    // ACORD 25 = 30 points (replaces 3 individual docs), legacy = 10 per doc
    const docsUploadedScore = hasAcord25 ? 30 : Math.min(legacyDocsCount * 10, 30);

    // AI verification: up to 20 points
    const acord25Verified = compliance.acord25?.status === 'VERIFIED';
    const docsVerifiedScore = acord25Verified ? 20 : 0;

    const totalScore = attestationScore + docsUploadedScore + docsVerifiedScore;

    const complianceUpdate: Record<string, any> = {
        complianceScore: totalScore,
        complianceBreakdown: {
            attestation: attestationScore,
            docsUploaded: docsUploadedScore,
            docsVerified: docsVerifiedScore,
        },
        statusUpdatedAt: new Date(),
    };

    // Auto-advance: skip pending_verification, go straight to onboarding call
    // Doc verification happens later in the "ready" stage
    if (totalScore >= 80) {
        complianceUpdate.status = 'onboarding_scheduled';
    }

    await db.collection("vendors").doc(vendorId).update(complianceUpdate);

    logger.info(`Vendor ${vendorId} compliance score: ${totalScore}/100 (attest=${attestationScore}, docs=${docsUploadedScore}, verified=${docsVerifiedScore})`);

    // Log activity
    await db.collection("vendor_activities").add({
        vendorId,
        type: "ONBOARDING_COMPLETE",
        description: `${businessName} completed onboarding form (${track}). Compliance score: ${totalScore}/100.`,
        createdAt: new Date(),
        metadata: { track, email, phone, lang, complianceScore: totalScore }
    });
});
