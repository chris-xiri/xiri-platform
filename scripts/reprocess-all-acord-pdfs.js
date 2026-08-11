const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const https = require('https');

const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const saPath = path.join(__dirname, '..', 'service-account.json');
    if (fs.existsSync(saPath)) {
        const serviceAccount = require(saPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'xiri-facility-solutions',
        });
    } else {
        admin.initializeApp({
            projectId: 'xiri-facility-solutions',
        });
    }
}
const db = admin.firestore();

// Initialize Gemini (Defaults to gemini-3.5-flash / gemini-2.5-flash for lowest cost)
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAemuNQsnnDPtBNc19ONDVr8OEKIO_SVSo";
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function downloadFileAsBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFileAsBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed with status ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

const SYSTEM_PROMPT = `
You are an expert commercial insurance compliance reviewer specializing in ACORD 25 (Certificate of Liability Insurance) documents for facility management vendors.

Examine the uploaded ACORD 25 PDF/image carefully and extract key insurance values, policy status, and coverage details into structured JSON.

Return JSON strictly adhering to this schema:
{
  "insuredName": "string",
  "certificateHolder": "string",
  "producerName": "string",
  "glActive": boolean,
  "glOccurrenceLimit": number or null,
  "glAggregateLimit": number or null,
  "glPolicyNumber": "string",
  "glExpirationDate": "YYYY-MM-DD",
  "wcActive": boolean,
  "wcStatutoryLimits": boolean,
  "wcPolicyNumber": "string",
  "wcExpirationDate": "YYYY-MM-DD",
  "autoActive": boolean,
  "autoCombinedSingleLimit": number or null,
  "autoPolicyNumber": "string",
  "autoExpirationDate": "YYYY-MM-DD",
  "reasoning": "string summary of verification",
  "flags": ["string array of compliance issues found"]
}
`;

async function reprocessAllAcordPdfs() {
    console.log(`🚀 Reprocessing ALL vendor ACORD 25 PDFs using model: [${MODEL_NAME}]...`);

    const snapshot = await db.collection('vendors').get();
    if (snapshot.empty) {
        console.log("No vendors found in Firestore.");
        return;
    }

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    for (const doc of snapshot.docs) {
        const vendorData = doc.data();
        const vendorId = doc.id;
        const acord25 = vendorData.compliance?.acord25;
        const fileUrl = acord25?.url;

        if (!fileUrl) {
            continue;
        }

        processedCount++;
        const vendorName = vendorData.businessName || vendorData.companyName || "Vendor " + vendorId;
        console.log(`\n📄 [${processedCount}] Processing ACORD 25 for ${vendorName} (${vendorId})...`);
        console.log(`   URL: ${fileUrl}`);

        try {
            const buffer = await downloadFileAsBuffer(fileUrl);
            const isPdf = fileUrl.toLowerCase().includes('.pdf');
            const isJpg = fileUrl.toLowerCase().includes('.jpg') || fileUrl.toLowerCase().includes('.jpeg');
            const isPng = fileUrl.toLowerCase().includes('.png');
            const contentType = isPdf ? 'application/pdf' : isJpg ? 'image/jpeg' : isPng ? 'image/png' : 'application/pdf';

            const imagePart = {
                inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: contentType
                }
            };

            const result = await model.generateContent([
                SYSTEM_PROMPT,
                imagePart,
                `Verify this ACORD 25 for vendor: "${vendorName}".`
            ]);

            const rawText = result.response.text();
            const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const extracted = JSON.parse(jsonText);

            const hasFlags = Array.isArray(extracted.flags) && extracted.flags.length > 0;
            const valid = extracted.glActive === true && !hasFlags;
            const status = valid ? 'VERIFIED' : (hasFlags ? 'FLAGGED' : 'REJECTED');

            await db.doc(`vendors/${vendorId}`).update({
                'compliance.acord25.status': status,
                'compliance.acord25.verifiedAt': admin.firestore.FieldValue.serverTimestamp(),
                'compliance.acord25.aiAnalysis': {
                    valid,
                    reasoning: extracted.reasoning || "AI batch verification complete.",
                    extracted
                },
                'compliance.acord25.extractedData': extracted,
                'compliance.generalLiability.verified': extracted.glActive === true,
                'compliance.generalLiability.hasInsurance': extracted.glActive === true,
                'compliance.workersComp.verified': extracted.wcActive === true,
                'compliance.workersComp.hasInsurance': extracted.wcActive === true,
                'compliance.autoInsurance.verified': extracted.autoActive === true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Success! Status: ${status}`);
            console.log(`   Reasoning: ${extracted.reasoning}`);
            if (hasFlags) console.log(`   Flags: ${extracted.flags.join(' | ')}`);
            successCount++;

        } catch (err) {
            console.error(`   ❌ Failed to process ${vendorId}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n🎉 Reprocessing Complete!`);
    console.log(`Total PDF Vendors Checked: ${processedCount}`);
    console.log(`Successfully Re-analyzed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

reprocessAllAcordPdfs().then(() => process.exit(0)).catch(err => {
    console.error("Batch script error:", err);
    process.exit(1);
});
