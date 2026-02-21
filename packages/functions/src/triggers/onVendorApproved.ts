import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { scrapeWebsite } from "../utils/websiteScraper";
import { verifyEmail, isDisposableEmail, isRoleBasedEmail } from "../utils/emailVerification";
import { validatePhone } from "../utils/phoneValidation";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

console.log("Loading onVendorApproved trigger...");

// ─── Trigger 1: Existing vendor updated TO 'qualified' ───
export const onVendorApproved = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: [GEMINI_API_KEY],
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
    secrets: [GEMINI_API_KEY],
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

                // Did we find an email?
                if (foundEmail) {
                    logger.info(`Found email ${foundEmail} for vendor ${vendorId}. Proceeding to outreach.`);
                    const updatedDoc = await db.collection("vendors").doc(vendorId).get();
                    await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
                } else {
                    await markNeedsContact(vendorId, "No email found after enrichment");
                }

            } catch (enrichError: any) {
                logger.error(`Enrichment error for ${vendorId}:`, enrichError);
                await markNeedsContact(vendorId, `Enrichment error: ${enrichError.message}`);
            }

            return;
        }

        // ─── BRANCH 3: No email AND no website → needs manual contact ───
        logger.info(`Vendor ${vendorId} has no email and no website. Marking NEEDS_CONTACT.`);
        await markNeedsContact(vendorId, "No email or website available");

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
