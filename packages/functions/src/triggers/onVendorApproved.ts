import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { db } from "../utils/firebase";
import { scrapeWebsite, deepMailtoScan, searchWebForEmail } from "../utils/websiteScraper";
import { verifyEmail, isDisposableEmail, isRoleBasedEmail } from "../utils/emailVerification";
import { validatePhone } from "../utils/phoneValidation";
import { enqueueTask } from "../utils/queueUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const SERPER_API_KEY = defineSecret("SERPER_API_KEY");

console.log("Loading vendor enrichment triggers...");

// ─── Trigger 1: Vendor status changes to 'qualified' ───
export const onVendorApproved = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: [GEMINI_API_KEY, SERPER_API_KEY],
}, async (event) => {
    if (!event.data) return;

    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const vendorId = event.params.vendorId;

    if (!newData || !oldData) return;
    if (newData.status !== 'qualified' || oldData.status === 'qualified') return;

    logger.info(`[UPDATE] Vendor ${vendorId} status changed to qualified.`);
    await runEnrichPipeline(vendorId, newData, oldData.status);
});

// ─── Trigger 2: New vendor created WITH status 'qualified' ───
export const onVendorCreated = onDocumentCreated({
    document: "vendors/{vendorId}",
    secrets: [GEMINI_API_KEY, SERPER_API_KEY],
}, async (event) => {
    if (!event.data) return;

    const data = event.data.data();
    const vendorId = event.params.vendorId;

    if (!data) return;
    if (data.status !== 'qualified') return;

    logger.info(`[CREATE] Vendor ${vendorId} created with status qualified.`);
    await runEnrichPipeline(vendorId, data, 'new');
});


// ═══════════════════════════════════════════════════════════
//  SHARED PIPELINE LOGIC
// ═══════════════════════════════════════════════════════════

async function runEnrichPipeline(vendorId: string, vendorData: any, previousStatus: string) {
    try {
        // 1. Log Activity: "Vendor Approved"
        await db.collection("vendor_activities").add({
            vendorId,
            type: "STATUS_CHANGE",
            description: "Vendor approved — starting onboarding pipeline.",
            createdAt: new Date(),
            metadata: {
                oldStatus: previousStatus,
                newStatus: 'qualified',
                onboardingTrack: vendorData.onboardingTrack || 'STANDARD',
            }
        });

        const vendorEmail = vendorData.email?.trim();
        const vendorWebsite = vendorData.website?.trim();

        // ─── BRANCH 1: Already has email → go straight to outreach ───
        if (vendorEmail) {
            logger.info(`Vendor ${vendorId} has email (${vendorEmail}). Proceeding to outreach.`);
            await setOutreachPending(vendorId, vendorData);
            return;
        }

        // ─── BRANCH 2: No email but has website → try enrichment ───
        if (vendorWebsite) {
            logger.info(`Vendor ${vendorId} has no email but has website. Enriching...`);

            await db.collection("vendors").doc(vendorId).update({
                outreachStatus: 'ENRICHING',
                enrichmentStartedAt: new Date(),
                statusUpdatedAt: new Date(),
            });

            await db.collection("vendor_activities").add({
                vendorId,
                type: "ENRICHMENT",
                description: `Scraping ${vendorWebsite} for contact info...`,
                createdAt: new Date(),
            });

            try {
                const scrapedResult = await scrapeWebsite(vendorWebsite, GEMINI_API_KEY.value());

                if (!scrapedResult.success || !scrapedResult.data) {
                    logger.warn(`Enrichment failed for ${vendorId}: ${scrapedResult.error}`);
                    await markNeedsContact(vendorId, "Website scrape failed");
                    return;
                }

                const scrapedData = scrapedResult.data;
                const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
                const enrichedFields: string[] = [];

                // Verify and save email
                let foundEmail: string | undefined;
                if (scrapedData.email) {
                    const emailVerification = await verifyEmail(scrapedData.email);
                    if (emailVerification.valid &&
                        emailVerification.deliverable &&
                        !isDisposableEmail(scrapedData.email) &&
                        !isRoleBasedEmail(scrapedData.email)) {
                        foundEmail = scrapedData.email;
                        updateData.email = foundEmail;
                        enrichedFields.push('email');
                    } else {
                        logger.info(`Scraped email ${scrapedData.email} failed verification.`);
                    }
                }

                // Validate and save phone
                if (scrapedData.phone && !vendorData.phone) {
                    const phoneValidation = validatePhone(scrapedData.phone);
                    if (phoneValidation.valid) {
                        updateData.phone = phoneValidation.formatted;
                        enrichedFields.push('phone');
                    }
                }

                // Save address if missing
                if (scrapedData.address && !vendorData.address) {
                    updateData.address = scrapedData.address;
                    enrichedFields.push('address');
                }

                // Save social media
                if (scrapedData.socialMedia) {
                    const sm: any = {};
                    if (scrapedData.socialMedia.linkedin) { sm.linkedin = scrapedData.socialMedia.linkedin; enrichedFields.push('linkedin'); }
                    if (scrapedData.socialMedia.facebook) { sm.facebook = scrapedData.socialMedia.facebook; enrichedFields.push('facebook'); }
                    if (scrapedData.socialMedia.twitter) { sm.twitter = scrapedData.socialMedia.twitter; enrichedFields.push('twitter'); }
                    if (Object.keys(sm).length > 0) updateData.socialMedia = sm;
                }

                // Save contact form URL if detected
                if (scrapedData.contactFormUrl) {
                    updateData.contactFormUrl = scrapedData.contactFormUrl;
                    enrichedFields.push('contactFormUrl');
                }

                // Enrichment metadata
                updateData.enrichment = {
                    lastEnriched: admin.firestore.FieldValue.serverTimestamp(),
                    enrichedFields,
                    enrichmentSource: 'auto_onboarding',
                    scrapedWebsite: vendorWebsite,
                    confidence: scrapedData.confidence,
                };

                // Update vendor doc with scraped data
                if (enrichedFields.length > 0) {
                    await db.collection("vendors").doc(vendorId).update(updateData);
                }

                await db.collection("vendor_activities").add({
                    vendorId,
                    type: "ENRICHMENT",
                    description: enrichedFields.length > 0
                        ? `Enriched ${enrichedFields.length} field(s): ${enrichedFields.join(', ')}`
                        : "No new fields found from website.",
                    createdAt: new Date(),
                    metadata: { enrichedFields, confidence: scrapedData.confidence },
                });

                // Did we find an email from website scrape?
                if (foundEmail) {
                    logger.info(`Found email ${foundEmail} for vendor ${vendorId} via website scrape. Proceeding to outreach.`);
                    const updatedDoc = await db.collection("vendors").doc(vendorId).get();
                    await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
                    return;
                }

                // ─── FALLBACK LAYER 2: Deep mailto scan ───
                logger.info(`No email from scrape for ${vendorId}. Trying deep mailto scan...`);
                const mailtoResult = await deepMailtoScan(vendorWebsite);

                if (mailtoResult.email) {
                    const mailtoVerification = await verifyEmail(mailtoResult.email);
                    if (mailtoVerification.valid && mailtoVerification.deliverable) {
                        await db.collection("vendors").doc(vendorId).update({
                            email: mailtoResult.email,
                            'enrichment.enrichedFields': admin.firestore.FieldValue.arrayUnion('email'),
                            'enrichment.enrichmentSource': 'deep_mailto_scan',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        await db.collection("vendor_activities").add({
                            vendorId,
                            type: "ENRICHMENT",
                            description: `Deep mailto scan found email (scanned ${mailtoResult.pagesScanned} pages)`,
                            createdAt: new Date(),
                            metadata: { email: mailtoResult.email, pagesScanned: mailtoResult.pagesScanned },
                        });
                        logger.info(`Found email ${mailtoResult.email} via deep mailto for ${vendorId}.`);
                        const updatedDoc = await db.collection("vendors").doc(vendorId).get();
                        await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
                        return;
                    }
                }

                // ─── FALLBACK LAYER 3: Serper web search ───
                const vendorName = vendorData.businessName || vendorData.name || '';
                const vendorLocation = vendorData.address || vendorData.location || '';
                let domain: string | undefined;
                try { domain = new URL(vendorWebsite).hostname; } catch { /* ignore */ }

                logger.info(`No email from mailto scan for ${vendorId}. Trying Serper web search...`);
                const webResult = await searchWebForEmail(vendorName, vendorLocation, domain, SERPER_API_KEY.value());

                if (webResult.email) {
                    const webVerification = await verifyEmail(webResult.email);
                    if (webVerification.valid && webVerification.deliverable) {
                        await db.collection("vendors").doc(vendorId).update({
                            email: webResult.email,
                            'enrichment.enrichedFields': admin.firestore.FieldValue.arrayUnion('email'),
                            'enrichment.enrichmentSource': webResult.source,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        await db.collection("vendor_activities").add({
                            vendorId,
                            type: "ENRICHMENT",
                            description: `Serper web search found email via ${webResult.source}`,
                            createdAt: new Date(),
                            metadata: { email: webResult.email, source: webResult.source },
                        });
                        logger.info(`Found email ${webResult.email} via ${webResult.source} for ${vendorId}.`);
                        const updatedDoc = await db.collection("vendors").doc(vendorId).get();
                        await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
                        return;
                    }
                }

                // ─── ALL SOURCES EXHAUSTED ───
                if (scrapedData.contactFormUrl) {
                    logger.info(`All enrichment failed for ${vendorId}, but found contact form: ${scrapedData.contactFormUrl}`);
                    await db.collection("vendors").doc(vendorId).update({
                        outreachStatus: 'NEEDS_MANUAL_OUTREACH',
                        statusUpdatedAt: new Date(),
                        'enrichment.exhausted': true,
                        'enrichment.sourcesAttempted': ['website_scrape', 'deep_mailto', 'serper_web_search'],
                    });
                    await db.collection("vendor_activities").add({
                        vendorId,
                        type: "NEEDS_MANUAL_OUTREACH",
                        description: `No email found after 3-layer enrichment. Contact form: ${scrapedData.contactFormUrl}`,
                        createdAt: new Date(),
                        metadata: { contactFormUrl: scrapedData.contactFormUrl, sourcesAttempted: 3 },
                    });
                } else {
                    await db.collection("vendors").doc(vendorId).update({
                        'enrichment.exhausted': true,
                        'enrichment.sourcesAttempted': ['website_scrape', 'deep_mailto', 'serper_web_search'],
                    });
                    await markNeedsContact(vendorId, "No email found after 3-layer enrichment (scrape → mailto → web search)");
                }

            } catch (enrichError: any) {
                logger.error(`Enrichment error for ${vendorId}:`, enrichError);
                await markNeedsContact(vendorId, `Enrichment error: ${enrichError.message}`);
            }

            return;
        }

        // ─── BRANCH 3: No email AND no website → try Serper web search before giving up ───
        logger.info(`Vendor ${vendorId} has no email and no website. Trying Serper web search...`);

        const vendorName = vendorData.businessName || vendorData.name || '';
        const vendorLocation = vendorData.address || vendorData.location || '';

        if (vendorName) {
            const webResult = await searchWebForEmail(vendorName, vendorLocation, undefined, SERPER_API_KEY.value());

            if (webResult.email) {
                const webVerification = await verifyEmail(webResult.email);
                if (webVerification.valid && webVerification.deliverable) {
                    await db.collection("vendors").doc(vendorId).update({
                        email: webResult.email,
                        enrichment: {
                            lastEnriched: admin.firestore.FieldValue.serverTimestamp(),
                            enrichedFields: ['email'],
                            enrichmentSource: webResult.source,
                        },
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    await db.collection("vendor_activities").add({
                        vendorId,
                        type: "ENRICHMENT",
                        description: `Serper web search found email via ${webResult.source} (no website on file)`,
                        createdAt: new Date(),
                        metadata: { email: webResult.email, source: webResult.source },
                    });
                    logger.info(`Found email ${webResult.email} via web search for ${vendorId} (no website).`);
                    const updatedDoc = await db.collection("vendors").doc(vendorId).get();
                    await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
                    return;
                }
            }
        }

        // Truly exhausted — no website, no web results
        await db.collection("vendors").doc(vendorId).update({
            'enrichment.exhausted': true,
            'enrichment.sourcesAttempted': vendorName ? ['serper_web_search'] : ['none_available'],
        });
        await markNeedsContact(vendorId, vendorName
            ? "No email found — web search exhausted, no website on file"
            : "No email, no website, no business name — cannot enrich"
        );

    } catch (error) {
        logger.error("Error in enrich pipeline:", error);
    }
}


// ─── Helper: check profile completeness before outreach ───
async function checkProfileCompleteness(vendorId: string, vendorData: any): Promise<string[]> {
    const missing: string[] = [];

    if (!vendorData.businessName) missing.push('businessName');

    const hasCapabilities = Array.isArray(vendorData.capabilities) && vendorData.capabilities.length > 0;
    const hasSpecialty = !!vendorData.specialty;
    if (!hasCapabilities && !hasSpecialty) missing.push('services/capabilities');

    // email is already gated by the enrichment pipeline — this is a safety check
    if (!vendorData.email) missing.push('email');

    return missing;
}


// ─── Helper: set outreach pending and enqueue GENERATE task ───
async function setOutreachPending(vendorId: string, vendorData: any) {
    // Profile completeness gate
    const missingFields = await checkProfileCompleteness(vendorId, vendorData);

    if (missingFields.length > 0) {
        logger.warn(`Vendor ${vendorId} profile incomplete. Missing: ${missingFields.join(', ')}. Blocking outreach.`);

        await db.collection("vendors").doc(vendorId).update({
            outreachStatus: 'PROFILE_INCOMPLETE',
            statusUpdatedAt: new Date(),
        });

        await db.collection("vendor_activities").add({
            vendorId,
            type: "PROFILE_INCOMPLETE",
            description: `Outreach blocked — missing: ${missingFields.join(', ')}. Complete the vendor profile to enable outreach.`,
            createdAt: new Date(),
            metadata: { missingFields },
        });

        return;
    }

    await db.collection("vendors").doc(vendorId).update({
        outreachStatus: 'PENDING',
        statusUpdatedAt: new Date(),
    });

    // Pass full vendor profile for AI personalization
    const { enqueueTask } = await import("../utils/queueUtils");
    await enqueueTask(db, {
        vendorId,
        type: 'GENERATE',
        scheduledAt: new Date() as any,
        metadata: {
            companyName: vendorData.businessName,
            specialty: vendorData.specialty || vendorData.capabilities?.[0] || null,
            capabilities: vendorData.capabilities || [],
            contactName: vendorData.contactName || null,
            city: vendorData.city || null,
            state: vendorData.state || null,
            zip: vendorData.zip || null,
            phone: vendorData.phone || null,
            hasActiveContract: vendorData.hasActiveContract || false,
            status: vendorData.status,
        }
    });

    logger.info(`Outreach GENERATE task enqueued for vendor ${vendorId}`);
}


// ─── Helper: mark vendor as NEEDS_CONTACT ───
async function markNeedsContact(vendorId: string, reason: string) {
    await db.collection("vendors").doc(vendorId).update({
        outreachStatus: 'NEEDS_CONTACT',
        statusUpdatedAt: new Date(),
    });

    await db.collection("vendor_activities").add({
        vendorId,
        type: "NEEDS_CONTACT",
        description: `Manual outreach required: ${reason}`,
        createdAt: new Date(),
    });

    logger.info(`Vendor ${vendorId} marked NEEDS_CONTACT: ${reason}`);
}
