import { onDocumentUpdated } from "firebase-functions/v2/firestore";
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

export const onVendorApproved = onDocumentUpdated({
    document: "vendors/{vendorId}",
    secrets: [GEMINI_API_KEY],
}, async (event) => {
    console.log("onVendorApproved triggered!");
    if (!event.data) {
        console.log("No event data.");
        return;
    }

    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const vendorId = event.params.vendorId;

    if (!newData || !oldData) return;

    // Only trigger on status change TO qualified
    if (newData.status !== 'qualified' || oldData.status === 'qualified') return;

    logger.info(`Vendor ${vendorId} approved. Starting enrich-first pipeline.`);

    try {
        // 1. Log Activity: "Vendor Approved"
        await db.collection("vendor_activities").add({
            vendorId,
            type: "STATUS_CHANGE",
            description: "Vendor approved — starting onboarding pipeline.",
            createdAt: new Date(),
            metadata: {
                oldStatus: oldData.status,
                newStatus: newData.status,
                onboardingTrack: newData.onboardingTrack || 'STANDARD',
            }
        });

        const vendorEmail = newData.email?.trim();
        const vendorWebsite = newData.website?.trim();

        // ─── BRANCH 1: Already has email → go straight to outreach ───
        if (vendorEmail) {
            logger.info(`Vendor ${vendorId} has email (${vendorEmail}). Proceeding to outreach.`);
            await setOutreachPending(vendorId, newData);
            return;
        }

        // ─── BRANCH 2: No email but has website → try enrichment ───
        if (vendorWebsite) {
            logger.info(`Vendor ${vendorId} has no email but has website. Enriching...`);

            await event.data.after.ref.update({
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
                    await markNeedsContact(vendorId, event, "Website scrape failed");
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
                if (scrapedData.phone && !newData.phone) {
                    const phoneValidation = validatePhone(scrapedData.phone);
                    if (phoneValidation.valid) {
                        updateData.phone = phoneValidation.formatted;
                        enrichedFields.push('phone');
                    }
                }

                // Save address if missing
                if (scrapedData.address && !newData.address) {
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
                    await event.data.after.ref.update(updateData);
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
                    // Re-read the vendor data with the new email
                    const updatedVendor = (await event.data.after.ref.get()).data();
                    await setOutreachPending(vendorId, updatedVendor || newData);
                } else {
                    await markNeedsContact(vendorId, event, "No email found after enrichment");
                }

            } catch (enrichError: any) {
                logger.error(`Enrichment error for ${vendorId}:`, enrichError);
                await markNeedsContact(vendorId, event, `Enrichment error: ${enrichError.message}`);
            }

            return;
        }

        // ─── BRANCH 3: No email AND no website → needs manual contact ───
        logger.info(`Vendor ${vendorId} has no email and no website. Marking NEEDS_CONTACT.`);
        await markNeedsContact(vendorId, event, "No email or website available");

    } catch (error) {
        logger.error("Error in onVendorApproved pipeline:", error);
    }
});


// ─── Helper: set outreach pending and enqueue GENERATE task ───
async function setOutreachPending(vendorId: string, vendorData: any) {
    await db.collection("vendors").doc(vendorId).update({
        outreachStatus: 'PENDING',
        statusUpdatedAt: new Date(),
    });

    const { enqueueTask } = await import("../utils/queueUtils");
    await enqueueTask(db, {
        vendorId,
        type: 'GENERATE',
        scheduledAt: new Date() as any,
        metadata: {
            status: vendorData.status,
            hasActiveContract: vendorData.hasActiveContract,
            phone: vendorData.phone,
            companyName: vendorData.businessName,
            specialty: vendorData.specialty || vendorData.capabilities?.[0],
        }
    });

    logger.info(`Outreach GENERATE task enqueued for vendor ${vendorId}`);
}


// ─── Helper: mark vendor as NEEDS_CONTACT ───
async function markNeedsContact(vendorId: string, event: any, reason: string) {
    await event.data.after.ref.update({
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
