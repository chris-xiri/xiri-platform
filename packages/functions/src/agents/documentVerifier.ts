import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as https from "https";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const db = admin.firestore();

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
    glPerOccurrence?: number;
    glAggregate?: number;
    wcActive?: boolean;
    wcPolicyNumber?: string;
    autoActive?: boolean;
    expirationDates?: Array<{ policy: string; expires: string }>;
    certificateHolder?: string;
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
        const templateDoc = await db.collection("templates").doc("document_verifier_prompt").get();
        if (!templateDoc.exists) {
            throw new Error("Document verifier prompt not found in database");
        }

        const template = templateDoc.data();
        const requirements = docType === 'COI'
            ? 'Must have General Liability > $1,000,000 and valid dates.'
            : 'Must be signed and have a TIN.';

        const prompt = template?.content
            .replace(/\{\{documentType\}\}/g, docType)
            .replace(/\{\{vendorName\}\}/g, vendorName)
            .replace(/\{\{specialty\}\}/g, specialty)
            .replace(/\{\{requirements\}\}/g, requirements)
            .replace(/\{\{ocrText\}\}/g, simulatedOcrText);

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
        const prompt = `You are an insurance compliance verification agent for Xiri Facility Solutions.

Analyze this ACORD 25 Certificate of Liability Insurance and extract the following data in JSON format.

**The vendor's name on file is: "${vendorName}"**

**The vendor attested to having the following coverage:**
- General Liability: ${attestations.hasGL ? 'YES' : 'NO'}
- Workers' Compensation: ${attestations.hasWC ? 'YES' : 'NO'}
- Auto Insurance: ${attestations.hasAuto ? 'YES' : 'NO'}
- Business Entity (LLC/Corp): ${attestations.hasEntity ? 'YES' : 'NO'}

**Minimum requirements to PASS:**
- General Liability: ≥ $1,000,000 per occurrence AND ≥ $2,000,000 aggregate
- Workers' Compensation: Must have active policy if attested
- Auto Insurance: Must have active policy if attested
- All policies must NOT be expired (check against today's date: ${new Date().toISOString().split('T')[0]})
- Insured name should reasonably match vendor name on file

**Cross-reference the vendor's attestations against the actual document.**
If the vendor attested to having coverage but the document does NOT show it, flag it.
If limits are below minimums, flag it.
If any policy is expired, flag it.

Return ONLY valid JSON in this exact format:
{
    "valid": true/false,
    "reasoning": "Brief explanation of the verification result",
    "flags": ["list of specific issues found, empty array if none"],
    "extracted": {
        "insuredName": "Name as shown on certificate",
        "glPerOccurrence": 1000000,
        "glAggregate": 2000000,
        "wcActive": true/false,
        "wcPolicyNumber": "policy number or null",
        "autoActive": true/false,
        "expirationDates": [
            { "policy": "General Liability", "expires": "2025-01-15" },
            { "policy": "Workers Comp", "expires": "2025-06-30" }
        ],
        "certificateHolder": "Name if listed, or null"
    }
}`;

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
