import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
    generateST1201,
    XiriCorporateData,
    VendorCertData,
} from "@xiri/shared/src/TaxCertificateService";

if (!admin.apps.length) {
    admin.initializeApp();
}

const STORAGE_PATH = 'tax-certificates/st-120-1';

/**
 * Fires when a Work Order is updated.
 * If a vendor was just assigned (vendorId changed from empty to a value),
 * generate a blanket ST-120.1 and email it to the vendor.
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

    // ── Vendor salesTaxId is optional (XIRI's ID is what matters) ──
    const vendorSalesTaxId = vendorData.compliance?.salesTaxId?.trim() || '';

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
        city: vendorData.city ?? '',
        state: vendorData.state ?? '',
        zip: vendorData.zip ?? '',
        email: vendorData.email || '',
        salesTaxId: vendorSalesTaxId || undefined,
    };

    // ── Generate the ST-120.1 as a BLANKET certificate ──
    // Pass undefined for projectData so the service uses blanket defaults
    // ("All vendor facilities" / "Blanket certificate")
    const result = await generateST1201(vendorCertData, xiriData, undefined);

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
    let storagePath: string;
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

        storagePath = `gs://${bucket.name}/${fileName}`;
        logger.info(`[ST-120.1] PDF uploaded to ${storagePath}`);
    } catch (err) {
        logger.error(`[ST-120.1] Storage upload failed for WO ${workOrderId}:`, err);
        return;
    }

    // ── Update work order with certificate path ──
    await db.collection('work_orders').doc(workOrderId).update({
        st1201CertificatePath: storagePath,
        st1201IssueDate: result.issueDate,
        st1201ExpiryDate: result.expiryDate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Email to vendor ──
    if (vendorCertData.email) {
        const vendorName = vendorCertData.businessName;

        // Attach PDF as base64 content (avoids needing signed URLs)
        const pdfBase64 = Buffer.from(result.pdfBytes).toString('base64');

        await db.collection('mail_queue').add({
            to: vendorCertData.email,
            subject: `ST-120.1 Exempt Purchase Certificate — ${xiriData.businessName}`,
            templateType: 'st_120_1_certificate',
            templateData: {
                vendorName,
                purchaserName: xiriData.businessName,
                projectName: 'All Projects (Blanket)',
                issueDate: result.issueDate,
                expiryDate: result.expiryDate,
            },
            attachments: [{
                filename: `ST-120.1_Blanket_${vendorName.replace(/\s+/g, '_')}.pdf`,
                content: pdfBase64,
                encoding: 'base64',
                contentType: 'application/pdf',
            }],
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // ── Log activity ──
    await db.collection('vendor_activities').add({
        vendorId: newVendorId,
        type: 'TAX_CERTIFICATE_ISSUED',
        description: `ST-120.1 blanket certificate generated (WO ${workOrderId}) and emailed to ${vendorCertData.email || 'vendor'}.`,
        createdAt: new Date(),
        metadata: {
            workOrderId,
            certificateType: 'ST-120.1',
            certificateScope: 'blanket',
            issueDate: result.issueDate,
            expiryDate: result.expiryDate,
            storagePath,
        },
    });

    logger.info(`[ST-120.1] Certificate generated and emailed for WO ${workOrderId}, vendor ${newVendorId}.`);
});
