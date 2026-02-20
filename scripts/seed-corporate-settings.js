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
    address: '123 Corporate Blvd',          // TODO: Replace with real address
    city: 'New York',
    state: 'NY',
    zip: '10001',

    // ── Tax ──
    salesTaxId: '',                          // TODO: XIRI's Certificate of Authority ID

    // ── Authorized Signer ──
    signerName: '',                          // TODO: Full name of authorized signer
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
    console.log('   1. Set salesTaxId (Certificate of Authority ID)');
    console.log('   2. Set signerName (authorized representative)');
    console.log('   3. Set signatureImageBase64 (base64-encoded signature image)');
    console.log('   4. Set real business address');
}

seedCorporateSettings().catch(console.error);
