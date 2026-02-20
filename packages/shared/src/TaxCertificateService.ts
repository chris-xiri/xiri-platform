/**
 * TaxCertificateService
 *
 * Fills the official NY State ST-120.1 (Contractor Exempt Purchase Certificate)
 * fillable PDF template for a specific project/address when a vendor is assigned
 * to a Work Order.
 *
 * One ST-120.1 per project/address. XIRI holds the certificate.
 * The vendor's Certificate of Authority sales tax ID is required.
 *
 * Flow:
 * 1. Vendor assigned to WO → pull client address + vendor info
 * 2. Fill official ST-120.1 template (Line 2 = project/address/owner)
 * 3. Check Box M (services purchased for resale)
 * 4. Embed XIRI's authorized digital signature
 * 5. Upload to Storage, email to vendor
 */

import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

// ─── Input Types ──────────────────────────────────────────────

export interface XiriCorporateData {
    businessName: string;                 // "XIRI Facility Solutions LLC"
    address: string;                      // Full street address
    city: string;
    state: string;
    zip: string;
    salesTaxId: string;                   // XIRI's own NY sales tax ID
    signatureImageBase64: string;         // PNG/JPEG of authorized rep's signature
    signerName: string;                   // Name of authorized representative
    signerTitle: string;                  // e.g. "VP of Facility Solutions"
}

export interface VendorCertData {
    vendorId: string;
    businessName: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    email: string;                        // verified vendor email for distribution
    salesTaxId: string;                   // Certificate of Authority / sales tax ID
}

export interface ProjectData {
    workOrderId: string;
    projectName: string;                  // Lead businessName or location name
    projectAddress: string;               // WO locationAddress
    projectCity?: string;
    projectState?: string;
    projectZip?: string;
    ownerName: string;                    // Client / Lead businessName
    ownerAddress: string;                 // Client / Lead address
}

export interface CertificateResult {
    success: boolean;
    pdfBytes?: Uint8Array;                // The filled PDF bytes (for upload by caller)
    issueDate?: string;
    expiryDate?: string;
    error?: string;
}

// ─── Constants ────────────────────────────────────────────────

const CERT_VALIDITY_YEARS = 3;

/**
 * Official ST-120.1 fillable form field names (36 fields total).
 *
 * Section 1 — Vendor (seller providing services to XIRI):
 *   "name of vendor", "street address1", "city1", "state1", "zip code 1"
 *
 * Section 2 — Purchaser (XIRI buying for resale):
 *   "name of purchasing contractor", "street address2", "city2", "state2", "zip code 2"
 *
 * Vendor's sales tax ID:
 *   "enter your sales tax vendor id number"
 *
 * Line 2 — Project details (one ST-120.1 per project):
 *   "line 2 1" = project name
 *   "line 2 2" = project address
 *   "line 2 3" = owner name
 *   "line 2 4" = owner address
 *
 * Signature:
 *   "type or print name and title of owner"
 *   "date prepared"
 *
 * Checkboxes (a-s):
 *   "box m" = services purchased for resale ← always checked
 */

// ─── Service ──────────────────────────────────────────────────

/**
 * Fill the official NY State ST-120.1 PDF template with vendor, XIRI, and project data.
 *
 * @param vendorData  - Vendor's business info and sales tax ID
 * @param xiriData    - XIRI corporate info and authorized signature
 * @param projectData - Work order location / project owner info
 * @returns           - Result with PDF bytes and validity dates
 */
export async function generateST1201(
    vendorData: VendorCertData,
    xiriData: XiriCorporateData,
    projectData: ProjectData,
): Promise<CertificateResult> {
    // ── Validate vendor has a sales tax ID ──
    if (!vendorData.salesTaxId || vendorData.salesTaxId.trim().length === 0) {
        return {
            success: false,
            error: 'Vendor does not have a valid Sales Tax ID (Certificate of Authority). Cannot generate ST-120.1.',
        };
    }

    try {
        // ── Calculate dates ──
        const now = new Date();
        const issueDate = now.toLocaleDateString('en-US');
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + CERT_VALIDITY_YEARS);
        const expiryDate = expiry.toISOString().split('T')[0]; // ISO for storage
        const expiryDisplay = expiry.toLocaleDateString('en-US');

        // ── Load official ST-120.1 template ──
        const templatePath = path.resolve(__dirname, 'templates', 'st120_1_template.pdf');
        const templateBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();

        // ── Section 1: Vendor (seller) ──
        form.getTextField('name of vendor').setText(vendorData.businessName);
        form.getTextField('street address1').setText(vendorData.address || '');
        form.getTextField('city1').setText(vendorData.city || '');
        form.getTextField('state1').setText(vendorData.state || '');
        form.getTextField('zip code 1').setText(vendorData.zip || '');

        // ── Vendor's sales tax ID ──
        form.getTextField('enter your sales tax vendor id number').setText(vendorData.salesTaxId);

        // ── Section 2: Purchaser (XIRI) ──
        form.getTextField('name of purchasing contractor').setText(xiriData.businessName);
        form.getTextField('street address2').setText(xiriData.address);
        form.getTextField('city2').setText(xiriData.city);
        form.getTextField('state2').setText(xiriData.state);
        form.getTextField('zip code 2').setText(xiriData.zip);

        // ── Line 2: Project details ──
        form.getTextField('line 2 1').setText(projectData.projectName);
        const fullProjectAddress = [
            projectData.projectAddress,
            projectData.projectCity,
            projectData.projectState,
            projectData.projectZip,
        ].filter(Boolean).join(', ');
        form.getTextField('line 2 2').setText(fullProjectAddress);
        form.getTextField('line 2 3').setText(projectData.ownerName);
        form.getTextField('line 2 4').setText(projectData.ownerAddress);

        // ── Box M: Services purchased for resale ──
        form.getCheckBox('box m').check();

        // ── Signature block ──
        form.getTextField('type or print name and title of owner').setText(
            `${xiriData.signerName}, ${xiriData.signerTitle}`
        );
        form.getTextField('date prepared').setText(issueDate);

        // ── Embed digital signature image ──
        if (xiriData.signatureImageBase64) {
            try {
                const sigBytes = Buffer.from(xiriData.signatureImageBase64, 'base64');
                let sigImage;
                try {
                    sigImage = await pdfDoc.embedPng(sigBytes);
                } catch {
                    sigImage = await pdfDoc.embedJpg(sigBytes);
                }

                // Draw signature on the last page near the signature line
                const pages = pdfDoc.getPages();
                const lastPage = pages[pages.length - 1];
                const { height } = lastPage.getSize();

                // Position near bottom of last page — signature area
                lastPage.drawImage(sigImage, {
                    x: 72,
                    y: height - 720,  // near bottom of form
                    width: 150,
                    height: 40,
                });
            } catch (sigErr) {
                // Signature embedding failed — form is still valid without it
                console.warn('Could not embed signature image:', sigErr);
            }
        }

        // ── Flatten form (make fields read-only) ──
        form.flatten();

        // ── Serialize ──
        const pdfBytes = await pdfDoc.save();

        return {
            success: true,
            pdfBytes,
            issueDate: now.toISOString().split('T')[0], // ISO for storage
            expiryDate,
        };

    } catch (error: any) {
        return {
            success: false,
            error: `Failed to generate ST-120.1: ${error.message}`,
        };
    }
}
