import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import { analyzeVendorLeads } from "../agents/recruiter";
import { searchVendors } from "../agents/sourcer";
import { searchProperties } from "../agents/propertySourcer";

// ── Lead Sourcing Agent ──
export const generateLeads = onCall({
    secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
    timeoutSeconds: 540
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const hasActiveContract = data.hasActiveContract || false;
    const previewOnly = data.previewOnly || false;
    const provider = data.provider || 'google_maps';
    const dcaCategory = data.dcaCategory;

    if ((provider === 'google_maps' && !query) || !location) {
        throw new HttpsError("invalid-argument", "Missing required fields in request.");
    }

    try {
        console.log(`Analyzing leads for query: ${query}, location: ${location}, provider: ${provider}, category: ${dcaCategory}${previewOnly ? ' (PREVIEW MODE)' : ''}`);

        const rawVendors = await searchVendors(query, location, provider, dcaCategory);
        console.log(`Sourced ${rawVendors.length} vendors from ${provider}.`);

        const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract, previewOnly);

        return {
            message: "Lead generation process completed.",
            sourced: rawVendors.length,
            analysis: result,
            vendors: previewOnly ? result.vendors : undefined
        };
    } catch (error: any) {
        console.error("Error in generateLeads:", error);
        throw new HttpsError("internal", error.message || "An internal error occurred.");
    }
});

// ── Clear Pipeline ──
export const clearPipeline = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    try {
        const snapshot = await db.collection('vendors').get();

        if (snapshot.empty) {
            return { message: "Pipeline already empty." };
        }

        let count = 0;
        const chunks: Promise<any>[] = [];
        let currentBatch = db.batch();

        snapshot.docs.forEach((doc, index) => {
            currentBatch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                chunks.push(currentBatch.commit());
                currentBatch = db.batch();
            }
        });

        chunks.push(currentBatch.commit());
        await Promise.all(chunks);

        return { message: `Cleared ${count} vendors from pipeline.` };
    } catch (error: any) {
        throw new HttpsError("internal", error.message);
    }
});

// ── Recruiter Agent Test ──
export const runRecruiterAgent = onRequest({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
    const rawVendors = req.body.vendors || [
        { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
        { name: "Joe's Pizza", services: "Best pizza in town" },
        { name: "Elite HVAC", services: "Commercial HVAC systems" }
    ];

    const result = await analyzeVendorLeads(rawVendors, "Commercial Cleaning");
    res.json(result);
});

// ── Test Email ──
export const testSendEmail = onCall({
    secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
    cors: DASHBOARD_CORS,
}, async (request) => {
    const { sendTemplatedEmail } = await import("../utils/emailUtils");
    const { vendorId, templateId } = request.data;

    if (!vendorId || !templateId) {
        throw new HttpsError("invalid-argument", "Missing vendorId or templateId");
    }

    try {
        await sendTemplatedEmail(vendorId, templateId);
        return { success: true, message: `Email sent to vendor ${vendorId}` };
    } catch (error: any) {
        console.error("Error sending test email:", error);
        throw new HttpsError("internal", error.message || "Failed to send email");
    }
});

// ── Property Sourcing ──
export const sourceProperties = onCall({
    cors: DASHBOARD_CORS,
    timeoutSeconds: 120
}, async (request) => {
    const data = request.data || {};
    const query = data.query;
    const location = data.location;
    const providerName = data.provider || 'mock';

    if (!query || !location) {
        throw new HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
    }

    try {
        console.log(`[sourceProperties] query="${query}", location="${location}", provider=${providerName}`);
        const properties = await searchProperties(query, location, providerName);

        return {
            message: 'Property sourcing completed.',
            sourced: properties.length,
            properties,
        };
    } catch (error: any) {
        console.error('[sourceProperties] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to source properties.');
    }
});
