/**
 * seed-corporate-settings.js
 *
 * Seeds the `settings/corporate` Firestore doc used by the ST-120.1
 * certificate generator and other corporate-level operations.
 *
 * Usage:
 *   node scripts/seed-corporate-settings.js
 *
 * Prerequisites:
 *   - Firebase Emulator running (or set env vars for production)
 */

const admin = require('firebase-admin');

// Emulator targets
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.GCLOUD_PROJECT = 'xiri-facility-solutions';

admin.initializeApp({
    projectId: 'xiri-facility-solutions',
});

const db = admin.firestore();

const corporateSettings = {
    // ── Business Identity ──
    businessName: 'XIRI Facility Solutions LLC',
    address: '9 Lahey Street',
    city: 'New Hyde Park',
    state: 'NY',
    zip: '11040',

    // ── Tax ──
    salesTaxId: '41-1511214',                // XIRI's Certificate of Authority ID

    // ── Authorized Signer ──
    signerName: 'Christopher Leung',          // Authorized signer
    signerTitle: 'VP of Facility Solutions',

    // ── Digital Signature ──
    // Base64-encoded PNG/JPEG of the authorized rep's signature.
    // Generate via: `base64 -i signature.png` (or use an online converter)
    signatureImageBase64: '',               // TODO: Paste base64 string here

    // ── Metadata ──
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
};

async function seedCorporateSettings() {
    console.log('Seeding settings/corporate...');

    await db.collection('settings').doc('corporate').set(corporateSettings, { merge: true });

    console.log('✅ settings/corporate seeded successfully.');
    console.log('');
    console.log('⚠️  TODOs remaining:');
    console.log('   1. Set signatureImageBase64 (base64-encoded signature image)');
}

seedCorporateSettings().catch(console.error);
