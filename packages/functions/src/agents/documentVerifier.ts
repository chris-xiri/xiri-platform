import { GoogleGenerativeAI } from "@google/generative-ai";
import * as logger from "firebase-functions/logger";
import * as https from "https";
import { getPrompt } from "../utils/promptUtils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ─── Download file from URL as Buffer (native Node.js, no deps) ───
function downloadFileAsBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFileAsBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed with status ${res.statusCode}`));
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ─── Legacy Interface ───
interface VerificationResult {
    valid: boolean;
    reasoning: string;
    extracted: Record<string, any>;
}

// ─── ACORD 25 Extracted Data ───
export interface AcordExtracted {
    insuredName?: string;
    glActive?: boolean;
    glPolicyNumber?: string;
    glPerOccurrence?: number;
    glAggregate?: number;
    wcActive?: boolean;
    wcPolicyNumber?: string;
    wcPerStatute?: boolean;
    wcEachAccident?: number;
    autoActive?: boolean;
    autoPolicyNumber?: string;
    autoCombinedSingleLimit?: number;
    umbrellaActive?: boolean;
    expirationDates?: Array<{ policy: string; effective?: string; expires: string }>;
    certificateHolder?: string;
    certificateDate?: string;
}

export interface Acord25VerificationResult {
    valid: boolean;
    reasoning: string;
    extracted: AcordExtracted;
    flags: string[];  // specific issues found
}

// ─── Legacy: Simulated Document Verification ───
export async function verifyDocument(docType: 'COI' | 'W9', vendorName: string, specialty: string): Promise<VerificationResult> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let simulatedOcrText = "";

    if (docType === 'COI') {
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);

        simulatedOcrText = `
            CERTIFICATE OF LIABILITY INSURANCE
            PRODUCER: State Farm Insurance
            INSURED: ${vendorName}
            
            COVERAGES:
            COMMERCIAL GENERAL LIABILITY
            EACH OCCURRENCE: $2,000,000
            GENERAL AGGREGATE: $4,000,000
            
            WORKERS COMPENSATION
            STATUTORY LIMITS: YES
            E.L. EACH ACCIDENT: $1,000,000
            
            POLICY EFF: 01/01/2024
            POLICY EXP: ${nextYear.toLocaleDateString()}
        `;
    } else if (docType === 'W9') {
        simulatedOcrText = `
            Form W-9
            Name: ${vendorName}
            Business Name: ${vendorName} LLC
            Federal Tax Classification: Limited Liability Company
            TIN: XX-XXX1234
            Signed: JS
            Date: 01/15/2024
        `;
    }

    try {
        const FALLBACK = `You are a document verification agent for XIRI Facility Solutions.

Analyze this {{documentType}} for {{vendorName}} (specialty: {{specialty}}).

Requirements: {{requirements}}

Document content:
{{ocrText}}

Verify compliance and extract key data. Return JSON:
{
    "valid": true/false,
    "reasoning": "Brief explanation",
    "extracted": {}
}`;

        const requirements = docType === 'COI'
            ? 'Must have General Liability > $1,000,000 and valid dates.'
            : 'Must be signed and have a TIN.';

        const prompt = await getPrompt('document_verifier_legacy', FALLBACK, {
            documentType: docType,
            vendorName,
            specialty,
            requirements,
            ocrText: simulatedOcrText,
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        return JSON.parse(jsonMatch[0]) as VerificationResult;
    } catch (error) {
        console.error("AI Verification Failed:", error);
        return {
            valid: false,
            reasoning: "AI Verification Failed: " + error,
            extracted: {}
        };
    }
}

// ─── Coverage Minimum Thresholds ───
const COVERAGE_MINIMUMS = {
    glPerOccurrence: 1_000_000,  // $1M
    glAggregate: 2_000_000,      // $2M
    wcEachAccident: 500_000,     // $500K
};

// ─── Deterministic Validation (no AI) ───
// Runs threshold checks on already-extracted data so number
// comparisons are never delegated to the LLM.
function validateExtracted(
    extracted: AcordExtracted,
    vendorName: string,
    attestations: { hasGL: boolean; hasWC: boolean; hasAuto: boolean; hasEntity: boolean },
    today: string
): { valid: boolean; reasoning: string; flags: string[] } {
    const flags: string[] = [];
    let valid = true;

    // CHECK 1 — CGL required
    if (!extracted.glActive) {
        valid = false;
        flags.push('No active Commercial General Liability coverage found — CGL is required');
    }

    // CHECK 2 — WC required
    if (!extracted.wcActive) {
        valid = false;
        flags.push('No active Workers\' Compensation coverage found — WC is required');
    }

    // CHECK 3 — CGL minimum limits
    if (extracted.glActive) {
        if (extracted.glPerOccurrence != null && extracted.glPerOccurrence < COVERAGE_MINIMUMS.glPerOccurrence) {
            valid = false;
            flags.push(`CGL Per Occurrence $${extracted.glPerOccurrence.toLocaleString()} is below required minimum $${COVERAGE_MINIMUMS.glPerOccurrence.toLocaleString()}`);
        }
        if (extracted.glAggregate != null && extracted.glAggregate < COVERAGE_MINIMUMS.glAggregate) {
            valid = false;
            flags.push(`CGL General Aggregate $${extracted.glAggregate.toLocaleString()} is below required minimum $${COVERAGE_MINIMUMS.glAggregate.toLocaleString()}`);
        }
    }

    // CHECK 4 — WC minimum limits
    if (extracted.wcActive) {
        if (extracted.wcEachAccident != null && extracted.wcEachAccident < COVERAGE_MINIMUMS.wcEachAccident) {
            valid = false;
            flags.push(`WC E.L. Each Accident $${extracted.wcEachAccident.toLocaleString()} is below required minimum $${COVERAGE_MINIMUMS.wcEachAccident.toLocaleString()}`);
        }
    }

    // CHECK 5 — Expiration dates
    if (extracted.expirationDates) {
        for (const entry of extracted.expirationDates) {
            if (entry.expires && entry.expires < today) {
                valid = false;
                flags.push(`${entry.policy} policy expired on ${entry.expires}`);
            }
        }
    }

    // CHECK 6 — Name match (basic)
    if (extracted.insuredName && vendorName) {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const extractedNorm = normalize(extracted.insuredName);
        const vendorNorm = normalize(vendorName);
        // Check if one contains the other (handles LLC/Inc suffixes, abbreviations)
        if (!extractedNorm.includes(vendorNorm) && !vendorNorm.includes(extractedNorm)) {
            flags.push(`Insured name "${extracted.insuredName}" may not match vendor "${vendorName}" — manual review recommended`);
        }
    }

    // Attestation cross-reference
    const allNo = !attestations.hasGL && !attestations.hasWC && !attestations.hasAuto;
    if (!allNo) {
        if (attestations.hasGL && !extracted.glActive) {
            flags.push('Vendor attested to having General Liability but ACORD shows no active CGL policy');
        }
        if (attestations.hasWC && !extracted.wcActive) {
            flags.push('Vendor attested to having Workers\' Comp but ACORD shows no active WC policy');
        }
        if (attestations.hasAuto && !extracted.autoActive) {
            flags.push('Vendor attested to having Auto Insurance but ACORD shows no active auto policy');
        }
    }

    // Build reasoning summary
    const parts: string[] = [];
    if (extracted.glActive) parts.push(`CGL active ($${(extracted.glPerOccurrence || 0).toLocaleString()} occ / $${(extracted.glAggregate || 0).toLocaleString()} agg)`);
    if (extracted.wcActive) parts.push(`WC active ($${(extracted.wcEachAccident || 0).toLocaleString()} ea accident)`);
    if (extracted.autoActive) parts.push('Auto active');
    if (extracted.umbrellaActive) parts.push('Umbrella active');

    const reasoning = valid
        ? `All required coverages present and meet minimums. ${parts.join(', ')}.`
        : `Verification failed. ${flags.join('. ')}.`;

    return { valid, reasoning, flags };
}

// ─── ACORD 25 Real PDF Verification ───
export async function verifyAcord25(
    fileUrl: string,
    vendorName: string,
    attestations: {
        hasGL: boolean;
        hasWC: boolean;
        hasAuto: boolean;
        hasEntity: boolean;
    }
): Promise<Acord25VerificationResult> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
        // 1. Download the PDF/image from Firebase Storage
        logger.info(`Downloading ACORD 25 from: ${fileUrl}`);

        const buffer = await downloadFileAsBuffer(fileUrl);
        const isPdf = fileUrl.toLowerCase().includes('.pdf');
        const isJpg = fileUrl.toLowerCase().includes('.jpg') || fileUrl.toLowerCase().includes('.jpeg');
        const isPng = fileUrl.toLowerCase().includes('.png');
        const contentType = isPdf ? 'application/pdf' : isJpg ? 'image/jpeg' : isPng ? 'image/png' : 'application/pdf';
        const base64Data = buffer.toString('base64');

        // 2. Build the extraction-only prompt (AI extracts, code validates)
        const ACORD_FALLBACK = `You are an insurance document data extraction agent for XIRI Facility Solutions.

Analyze this ACORD 25 Certificate of Liability Insurance and extract all data into JSON.
Vendor: "{{vendorName}}"
Today: {{todayDate}}

Return ONLY the extracted JSON — do NOT make pass/fail judgments.`;

        const prompt = await getPrompt('acord25_verifier', ACORD_FALLBACK, {
            vendorName,
            hasGL: attestations.hasGL ? 'YES' : 'NO',
            hasWC: attestations.hasWC ? 'YES' : 'NO',
            hasAuto: attestations.hasAuto ? 'YES' : 'NO',
            hasEntity: attestations.hasEntity ? 'YES' : 'NO',
            todayDate: new Date().toISOString().split('T')[0],
        });

        // 3. Send to Gemini with the file as inline data
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    {
                        inlineData: {
                            mimeType: contentType,
                            data: base64Data
                        }
                    },
                    { text: prompt }
                ]
            }]
        });

        const responseText = result.response.text();
        logger.info(`Gemini ACORD 25 response length: ${responseText.length}`);

        // 4. Parse the AI extraction
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in Gemini response");
        }

        const aiResult = JSON.parse(jsonMatch[0]);
        const extracted: AcordExtracted = aiResult.extracted || aiResult;

        // 5. Run deterministic validation (code, not AI)
        const today = new Date().toISOString().split('T')[0];
        const validation = validateExtracted(extracted, vendorName, attestations, today);

        logger.info(`ACORD 25 verification: valid=${validation.valid}, flags=${validation.flags.length} (deterministic)`);

        return {
            valid: validation.valid,
            reasoning: validation.reasoning,
            extracted,
            flags: validation.flags,
        };

    } catch (error) {
        logger.error("ACORD 25 verification failed:", error);
        return {
            valid: false,
            reasoning: `AI verification failed: ${error}`,
            extracted: {},
            flags: ["AI_PROCESSING_ERROR"]
        };
    }
}
