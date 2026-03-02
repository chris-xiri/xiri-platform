/**
 * Import Northwell affiliate providers into Firestore leads collection.
 * Reads from northwell_affiliates.json (output of scrape-northwell.js).
 *
 * Usage: node scripts/import-northwell-leads.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '..', 'northwell_affiliates.json');

async function main() {
    console.log("🔥 Northwell → Firestore Leads Importer\n");

    if (!fs.existsSync(JSON_PATH)) {
        console.error("❌ northwell_affiliates.json not found. Run scrape-northwell.js first.");
        process.exit(1);
    }

    const providers = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    console.log(`   Loaded ${providers.length} providers from JSON\n`);

    // Init Firebase Admin
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
        // Try application default credentials
        admin.initializeApp({ projectId: 'xiri-facility-solutions' });
    }

    const db = admin.firestore();

    // Deduplicate against existing leads
    console.log("   Checking for existing Northwell leads...");
    const existingQuery = await db.collection('leads')
        .where('attribution.source', '==', 'Northwell Health')
        .select('phone', 'businessName')
        .get();

    const existingKeys = new Set();
    existingQuery.forEach(doc => {
        const d = doc.data();
        existingKeys.add(`${d.businessName}|${d.phone}`);
    });
    console.log(`   Found ${existingKeys.size} existing Northwell leads\n`);

    // Import in batches of 500
    const BATCH_SIZE = 500;
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
        const chunk = providers.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        let batchCount = 0;

        for (const p of chunk) {
            const businessName = `${p.name}${p.credentials ? ', ' + p.credentials : ''}`;
            const key = `${businessName}|${p.phone}`;

            if (existingKeys.has(key)) {
                skipped++;
                continue;
            }

            const ref = db.collection('leads').doc();
            batch.set(ref, {
                businessName,
                website: p.profileUrl || null,
                address: p.address || null,
                city: p.city || null,
                state: p.state || 'NY',
                zip: p.zip || null,
                facilityType: 'medical_private',
                contactName: p.name,
                email: null,
                phone: p.phone || null,
                notes: [
                    p.specialty ? `Specialty: ${p.specialty}` : '',
                    p.distance ? `Distance from GCP: ${p.distance} mi` : '',
                    p.isPrivateOffice ? 'Private office (non-Northwell facility)' : 'Located at Northwell facility',
                    p.additionalLocations > 0 ? `${p.additionalLocations} additional locations` : '',
                ].filter(Boolean).join('. '),
                status: 'new',
                attribution: {
                    source: 'Northwell Health',
                    medium: 'scrape',
                    campaign: 'northwell-affiliates-2026',
                    landingPage: p.profileUrl || '',
                },
                tags: ['northwell-affiliate', p.isPrivateOffice ? 'private-office' : 'northwell-facility'],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'scraper',
            });
            batchCount++;
            existingKeys.add(key); // Prevent intra-batch dupes
        }

        if (batchCount > 0) {
            await batch.commit();
            imported += batchCount;
        }

        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(providers.length / BATCH_SIZE);
        console.log(`   Batch ${batchNum}/${totalBatches}: +${batchCount} imported (${skipped} skipped, ${imported} total)`);
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Total leads now: ${existingKeys.size + imported - skipped}`);

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
