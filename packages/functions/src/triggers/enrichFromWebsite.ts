import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { scrapeWebsite } from '../utils/websiteScraper';
import { verifyEmail, isDisposableEmail, isRoleBasedEmail } from '../utils/emailVerification';
import { validatePhone, isBusinessPhone } from '../utils/phoneValidation';
import { defineSecret } from 'firebase-functions/params';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

interface EnrichRequest {
    collection: 'leads' | 'vendors';
    documentId: string;
    website: string;
}

interface EnrichResponse {
    success: boolean;
    enrichedFields: string[];
    data?: any;
    error?: string;
}

export const enrichFromWebsite = onCall<EnrichRequest, Promise<EnrichResponse>>({
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: '512MiB',
}, async (request) => {
    // 1. Validate request
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { collection, documentId, website } = request.data;

    if (!collection || !documentId || !website) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    if (!['leads', 'vendors'].includes(collection)) {
        throw new HttpsError('invalid-argument', 'Invalid collection');
    }

    try {
        // 2. Scrape website
        console.log(`Enriching ${collection}/${documentId} from ${website}`);
        const scrapedResult = await scrapeWebsite(website, GEMINI_API_KEY.value());

        if (!scrapedResult.success) {
            throw new HttpsError('internal', `Scraping failed: ${scrapedResult.error}`);
        }

        const scrapedData = scrapedResult.data!;

        // 3. Verify email if found
        let verifiedEmail: string | undefined;
        if (scrapedData.email) {
            const emailVerification = await verifyEmail(scrapedData.email);

            if (emailVerification.valid &&
                emailVerification.deliverable &&
                !isDisposableEmail(scrapedData.email) &&
                !isRoleBasedEmail(scrapedData.email)) {
                verifiedEmail = scrapedData.email;
            } else {
                console.log(`Email ${scrapedData.email} failed verification:`, emailVerification.reason);
            }
        }

        // 4. Validate phone if found
        let validatedPhone: string | undefined;
        if (scrapedData.phone) {
            const phoneValidation = validatePhone(scrapedData.phone);

            if (phoneValidation.valid) {
                validatedPhone = phoneValidation.formatted;
            } else {
                console.log(`Phone ${scrapedData.phone} failed validation:`, phoneValidation.reason);
            }
        }

        // 5. Prepare update data
        const db = getFirestore();
        const docRef = db.collection(collection).doc(documentId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            throw new HttpsError('not-found', 'Document not found');
        }

        const existingData = docSnap.data()!;
        const enrichedFields: string[] = [];
        const updateData: any = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Only update fields that are missing or empty
        if (verifiedEmail && !existingData.email) {
            updateData.email = verifiedEmail;
            enrichedFields.push('email');
        }

        if (validatedPhone && !existingData.phone) {
            updateData.phone = validatedPhone;
            enrichedFields.push('phone');
        }

        if (scrapedData.address && !existingData.address) {
            updateData.address = scrapedData.address;
            enrichedFields.push('address');
        }

        if (scrapedData.businessName && !existingData.businessName) {
            updateData.businessName = scrapedData.businessName;
            enrichedFields.push('businessName');
        }

        // Add social media links if found
        if (scrapedData.socialMedia) {
            const socialMedia: any = {};
            if (scrapedData.socialMedia.linkedin) {
                socialMedia.linkedin = scrapedData.socialMedia.linkedin;
                enrichedFields.push('linkedin');
            }
            if (scrapedData.socialMedia.facebook) {
                socialMedia.facebook = scrapedData.socialMedia.facebook;
                enrichedFields.push('facebook');
            }
            if (scrapedData.socialMedia.twitter) {
                socialMedia.twitter = scrapedData.socialMedia.twitter;
                enrichedFields.push('twitter');
            }

            if (Object.keys(socialMedia).length > 0) {
                updateData.socialMedia = socialMedia;
            }
        }

        // Add enrichment metadata
        updateData.enrichment = {
            lastEnriched: FieldValue.serverTimestamp(),
            enrichedFields,
            enrichmentSource: 'manual',
            scrapedWebsite: website,
            confidence: scrapedData.confidence,
        };

        // 6. Update Firestore
        if (enrichedFields.length > 0) {
            await docRef.update(updateData);
            console.log(`Successfully enriched ${enrichedFields.length} fields for ${collection}/${documentId}`);
        } else {
            console.log(`No new fields to enrich for ${collection}/${documentId}`);
        }

        // 7. Return result
        return {
            success: true,
            enrichedFields,
            data: {
                email: verifiedEmail,
                phone: validatedPhone,
                address: scrapedData.address,
                businessName: scrapedData.businessName,
                socialMedia: scrapedData.socialMedia,
                confidence: scrapedData.confidence,
            },
        };
    } catch (error: any) {
        console.error('Enrichment error:', error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Enrichment failed: ${error.message}`);
    }
});
