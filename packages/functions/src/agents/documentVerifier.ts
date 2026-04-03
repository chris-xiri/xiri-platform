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

// ─── NEW: ACORD 25 Real PDF Verification ───
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
        // Detect content type from URL or default to PDF
        const isPdf = fileUrl.toLowerCase().includes('.pdf');
        const isJpg = fileUrl.toLowerCase().includes('.jpg') || fileUrl.toLowerCase().includes('.jpeg');
        const isPng = fileUrl.toLowerCase().includes('.png');
        const contentType = isPdf ? 'application/pdf' : isJpg ? 'image/jpeg' : isPng ? 'image/png' : 'application/pdf';
        const base64Data = buffer.toString('base64');

        // 2. Build the structured extraction prompt
        const ACORD_FALLBACK = `You are an insurance compliance verification agent for XIRI Facility Solutions.

Analyze this ACORD 25 Certificate of Liability Insurance and extract data in JSON format.
Vendor: "{{vendorName}}"
GL: {{hasGL}}, WC: {{hasWC}}, Auto: {{hasAuto}}, Entity: {{hasEntity}}
Today: {{todayDate}}

Return JSON with valid, reasoning, flags, and extracted fields.`;

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

        // 4. Parse the structured response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in Gemini response");
        }

        const parsed = JSON.parse(jsonMatch[0]) as Acord25VerificationResult;

        // Ensure flags array exists
        if (!parsed.flags) {
            parsed.flags = [];
        }

        logger.info(`ACORD 25 verification result: valid=${parsed.valid}, flags=${parsed.flags.length}`);
        return parsed;

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
