import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
    generateST1201,
    XiriCorporateData,
    VendorCertData,
    ProjectData,
} from "@xiri/shared/src/TaxCertificateService";

if (!admin.apps.length) {
    admin.initializeApp();
}

const STORAGE_PATH = 'tax-certificates/st-120-1';

/**
 * Fires when a Work Order is updated.
 * If a vendor was just assigned (vendorId changed from empty to a value),
 * and the vendor has a valid salesTaxId, generate a per-project ST-120.1
 * and email it to the vendor.
 */
export const onWorkOrderAssigned = onDocumentUpdated({
    document: "work_orders/{workOrderId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // ── Guard: only fire when vendorId is newly set ──
    const oldVendorId = before.vendorId || null;
    const newVendorId = after.vendorId || null;

    if (!newVendorId || oldVendorId === newVendorId) return;

    const workOrderId = event.params.workOrderId;
    logger.info(`[ST-120.1] Vendor ${newVendorId} assigned to work order ${workOrderId}.`);

    const db = admin.firestore();

    // ── Load vendor data ──
    let vendorData: any;
    try {
        const vendorSnap = await db.collection('vendors').doc(newVendorId).get();
        if (!vendorSnap.exists) {
            logger.error(`[ST-120.1] Vendor ${newVendorId} not found.`);
            return;
        }
        vendorData = vendorSnap.data();
    } catch (err) {
        logger.error(`[ST-120.1] Error loading vendor ${newVendorId}:`, err);
        return;
    }

    // ── Guard: vendor must have salesTaxId ──
    const salesTaxId = vendorData.compliance?.salesTaxId?.trim();
    if (!salesTaxId) {
        logger.info(`[ST-120.1] Vendor ${newVendorId} has no salesTaxId — skipping certificate.`);

        await db.collection('vendor_activities').add({
            vendorId: newVendorId,
            type: 'TAX_CERTIFICATE_SKIPPED',
            description: `ST-120.1 not generated for WO ${workOrderId} — vendor has no Sales Tax ID on file.`,
            createdAt: new Date(),
            metadata: { workOrderId },
        });
        return;
    }

    // ── Load client/lead data for project owner info ──
    let leadData: any = {};
    if (after.leadId) {
        try {
            const leadSnap = await db.collection('leads').doc(after.leadId).get();
            if (leadSnap.exists) {
                leadData = leadSnap.data();
            }
        } catch (err) {
            logger.warn(`[ST-120.1] Could not load lead ${after.leadId}:`, err);
        }
    }

    // ── Load XIRI corporate settings ──
    let xiriData: XiriCorporateData;
    try {
        const settingsSnap = await db.collection('settings').doc('corporate').get();
        const settings = settingsSnap.data();

        if (!settings?.salesTaxId) {
            logger.error('[ST-120.1] XIRI corporate settings missing or no salesTaxId configured.');
            return;
        }

        xiriData = {
            businessName: settings.businessName || 'XIRI Facility Solutions LLC',
            address: settings.address || '',
            city: settings.city || '',
            state: settings.state || 'NY',
            zip: settings.zip || '',
            salesTaxId: settings.salesTaxId,
            signatureImageBase64: settings.signatureImageBase64 || '',
            signerName: settings.signerName || '',
            signerTitle: settings.signerTitle || '',
        };
    } catch (err) {
        logger.error('[ST-120.1] Error loading corporate settings:', err);
        return;
    }

    // ── Build inputs ──
    const vendorCertData: VendorCertData = {
        vendorId: newVendorId,
        businessName: vendorData.businessName || 'Unknown Vendor',
        address: vendorData.address || vendorData.streetAddress || '',
        city: vendorData.city,
        state: vendorData.state,
        zip: vendorData.zip,
        email: vendorData.email || '',
        salesTaxId,
    };

    const ownerName = leadData.businessName || after.locationName || 'Project Owner';
    const ownerAddress = leadData.address || '';

    const projectDataInput: ProjectData = {
        workOrderId,
        projectName: after.locationName || leadData.businessName || 'Project',
        projectAddress: after.locationAddress || '',
        projectCity: after.locationCity,
        projectState: after.locationState,
        projectZip: after.locationZip,
        ownerName,
        ownerAddress,
    };

    // ── Generate the ST-120.1 ──
    const result = await generateST1201(vendorCertData, xiriData, projectDataInput);

    if (!result.success || !result.pdfBytes) {
        logger.error(`[ST-120.1] Generation failed for WO ${workOrderId}: ${result.error}`);
        await db.collection('vendor_activities').add({
            vendorId: newVendorId,
            type: 'TAX_CERTIFICATE_ERROR',
            description: `ST-120.1 generation failed for WO ${workOrderId}: ${result.error}`,
            createdAt: new Date(),
            metadata: { workOrderId },
        });
        return;
    }

    // ── Upload to Firebase Storage ──
    let pdfUrl: string;
    try {
        const bucket = admin.storage().bucket();
        const fileName = `${STORAGE_PATH}/${workOrderId}_${newVendorId}_${result.issueDate}.pdf`;
        const file = bucket.file(fileName);

        await file.save(Buffer.from(result.pdfBytes), {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    workOrderId,
                    vendorId: newVendorId,
                    issueDate: result.issueDate!,
                    expiryDate: result.expiryDate!,
                },
            },
        });

        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        });
        pdfUrl = signedUrl;
    } catch (err) {
        logger.error(`[ST-120.1] Storage upload failed for WO ${workOrderId}:`, err);
        return;
    }

    // ── Update work order with certificate URL ──
    await db.collection('work_orders').doc(workOrderId).update({
        st1201CertificateUrl: pdfUrl,
        st1201IssueDate: result.issueDate,
        st1201ExpiryDate: result.expiryDate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Email to vendor ──
    if (vendorCertData.email) {
        const vendorName = vendorCertData.businessName;
        const projectName = projectDataInput.projectName;

        await db.collection('mail_queue').add({
            to: vendorCertData.email,
            subject: `ST-120.1 Exempt Purchase Certificate — ${projectName}`,
            templateType: 'st_120_1_certificate',
            templateData: {
                vendorName,
                purchaserName: xiriData.businessName,
                projectName,
                projectAddress: projectDataInput.projectAddress,
                issueDate: result.issueDate,
                expiryDate: result.expiryDate,
            },
            attachments: [{
                filename: `ST-120.1_${projectName.replace(/\s+/g, '_')}.pdf`,
                path: pdfUrl,
            }],
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // ── Log activity ──
    await db.collection('vendor_activities').add({
        vendorId: newVendorId,
        type: 'TAX_CERTIFICATE_ISSUED',
        description: `ST-120.1 generated for project "${projectDataInput.projectName}" (WO ${workOrderId}) and emailed to ${vendorCertData.email || 'vendor'}.`,
        createdAt: new Date(),
        metadata: {
            workOrderId,
            certificateType: 'ST-120.1',
            issueDate: result.issueDate,
            expiryDate: result.expiryDate,
            projectName: projectDataInput.projectName,
            projectAddress: projectDataInput.projectAddress,
            pdfUrl,
        },
    });

    logger.info(`[ST-120.1] Certificate generated and emailed for WO ${workOrderId}, vendor ${newVendorId}.`);
});
