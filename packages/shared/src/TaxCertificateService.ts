/**
 * TaxCertificateService
 *
 * Fills the official NY State ST-120.1 (Contractor Exempt Purchase Certificate)
 * as a BLANKET certificate covering all purchases from a given vendor.
 *
 * One ST-120.1 per vendor (blanket). XIRI retains the certificate; vendor
 * receives a copy for their records. Vendor sales tax ID is optional.
 *
 * Flow:
 * 1. Vendor assigned to first WO → pull vendor info
 * 2. Fill official ST-120.1 template (Line 2 = blanket / all projects)
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
    salesTaxId?: string;                  // Certificate of Authority / sales tax ID (optional)
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
 * Vendor's sales tax ID (optional):
 *   "enter your sales tax vendor id number"
 *
 * Line 2 — Blanket certificate (covers all projects):
 *   "line 2 1" = "All facilities serviced by vendor"
 *   "line 2 2" = "Blanket — all project locations"
 *   "line 2 3" = XIRI business name
 *   "line 2 4" = XIRI address
 *
 * Signature:
 *   "type or print name and title of owner"
 *   "date prepared"
 *
 * Checkboxes (a-s):
 *   "box m" = services purchased for resale ← always checked
 */

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Safely set a PDF text field, truncating at the field's maxLength (if any)
 * to prevent pdf-lib from throwing on overflow.
 */
function safeSetText(
    form: ReturnType<PDFDocument['getForm']>,
    fieldName: string,
    value: string,
): void {
    const field = form.getTextField(fieldName);
    const max = (field as any).acroField?.getMaxLength?.();
    field.setText(max ? value.slice(0, max) : value);
}

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
    projectData?: ProjectData,
): Promise<CertificateResult> {

    try {
        // ── Calculate dates ──
        const now = new Date();
        const issueDate = now.toLocaleDateString('en-US');
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + CERT_VALIDITY_YEARS);
        const expiryDate = expiry.toISOString().split('T')[0]; // ISO for storage

        // ── Load official ST-120.1 template ──
        const templatePath = path.resolve(__dirname, 'templates', 'st120_1_template.pdf');
        const templateBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();

        // ── Section 1: Vendor (seller) ──
        safeSetText(form, 'name of vendor', vendorData.businessName);
        safeSetText(form, 'street address1', vendorData.address ?? '');
        safeSetText(form, 'city1', vendorData.city ?? '');
        safeSetText(form, 'state1', vendorData.state ?? '');
        safeSetText(form, 'zip code 1', vendorData.zip ?? '');

        // ── Purchaser's sales tax ID (XIRI's Certificate of Authority) ──
        safeSetText(form, 'enter your sales tax vendor id number', xiriData.salesTaxId);

        // ── Section 2: Purchaser (XIRI) ──
        safeSetText(form, 'name of purchasing contractor', xiriData.businessName);
        safeSetText(form, 'street address2', xiriData.address);
        safeSetText(form, 'city2', xiriData.city);
        safeSetText(form, 'state2', xiriData.state);
        safeSetText(form, 'zip code 2', xiriData.zip);

        // ── Line 2: Blanket certificate — covers all projects ──
        // Line 2 has four small cells on the ST-120.1 form with maxLength limits.
        // For blanket certs: 1=description, 2=coverage, 3=company, 4=city/state
        safeSetText(form, 'line 2 1',
            projectData?.projectName || 'All vendor facilities'
        );
        safeSetText(form, 'line 2 2',
            projectData?.projectAddress || 'Blanket certificate'
        );
        safeSetText(form, 'line 2 3',
            projectData?.ownerName || xiriData.businessName
        );
        safeSetText(form, 'line 2 4',
            projectData?.ownerAddress || issueDate
        );

        // ── Box M: Services purchased for resale ──
        form.getCheckBox('box m').check();

        // ── Signature block ──
        safeSetText(form, 'type or print name and title of owner',
            `${xiriData.signerName}, ${xiriData.signerTitle}`
        );
        safeSetText(form, 'date prepared', issueDate);

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

                // Draw signature on page 2 (the page with the certification/signature line)
                const pages = pdfDoc.getPages();
                const sigPage = pages[1];
                const { height } = sigPage.getSize();

                // Position near bottom of page 2 — signature area
                sigPage.drawImage(sigImage, {
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
