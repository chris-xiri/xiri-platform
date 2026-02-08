import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface VerificationResult {
    valid: boolean;
    reasoning: string;
    extracted: Record<string, any>;
}

export async function verifyDocument(docType: 'COI' | 'W9', vendorName: string, specialty: string): Promise<VerificationResult> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Simulate OCR extraction based on the doc type
    // In a real app, this would be the output of a Vision API
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
            DAMAGE TO RENTED PREMISES: $100,000
            MED EXP: $5,000
            PERSONAL & ADV INJURY: $2,000,000
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
            Address: 123 Main St
            TIN: XX-XXX1234
            Signed: JS
            Date: 01/15/2024
        `;
    }

    const prompt = `
        You are an expert Insurance Compliance Officer.
        Analyze the following OCR text extracted from a ${docType} document for vendor "${vendorName}" (${specialty}).

        Requirements:
        1. Name must match "${vendorName}" (fuzzy match ok).
        2. ${docType === 'COI' ? 'Must have General Liability > $1,000,000 and valid dates.' : 'Must be signed and have a TIN.'}

        OCR Text:
        """
        ${simulatedOcrText}
        """

        Output strictly JSON:
        {
            "valid": boolean,
            "reasoning": "string (concise summary for admin)",
            "extracted": {
                // key fields found
            }
        }
    `;

    try {
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
