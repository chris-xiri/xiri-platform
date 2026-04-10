/**
 * Backfill company.website from prospect_queue and placesData
 * 
 * Many company records have placesData.website but not a top-level website field.
 * This script also checks prospect_queue for website URLs and propagates them.
 *
 * Usage:
 *   npx tsx scripts/backfill-company-website.ts --dry-run   # Preview
 *   npx tsx scripts/backfill-company-website.ts              # Apply
 */

import * as admin from "firebase-admin";

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "xiri-facility-solutions",
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE\n" : "✏️  LIVE MODE — will update Firestore\n");

    // Load all companies
    const companiesSnap = await db.collection("companies").get();
    const missingWebsite: { id: string; name: string }[] = [];
    const hasWebsite = new Set<string>();

    for (const doc of companiesSnap.docs) {
        const data = doc.data();
        if (data.website) {
            hasWebsite.add(doc.id);
        } else {
            missingWebsite.push({ id: doc.id, name: data.businessName || '' });
        }
    }

    console.log(`Companies with website: ${hasWebsite.size}`);
    console.log(`Companies missing website: ${missingWebsite.length}\n`);

    // Source 1: placesData.website
    const fromPlaces: { id: string; name: string; website: string }[] = [];
    for (const doc of companiesSnap.docs) {
        const data = doc.data();
        if (!data.website && data.placesData?.website) {
            fromPlaces.push({ id: doc.id, name: data.businessName || '', website: data.placesData.website });
        }
    }

    // Source 2: prospect_queue
    const prospectsSnap = await db.collection("prospect_queue").get();
    const nameToCompanyId = new Map<string, string>();
    for (const c of missingWebsite) {
        if (c.name) nameToCompanyId.set(c.name.toLowerCase().trim(), c.id);
    }

    const fromProspects: { id: string; name: string; website: string }[] = [];
    const prospectWebsiteByCompanyId = new Map<string, string>();
    for (const doc of prospectsSnap.docs) {
        const data = doc.data();
        if (data.website && data.businessName) {
            const companyId = nameToCompanyId.get(data.businessName.toLowerCase().trim());
            if (companyId && !hasWebsite.has(companyId) && !prospectWebsiteByCompanyId.has(companyId)) {
                const isAlreadyFromPlaces = fromPlaces.some(p => p.id === companyId);
                if (!isAlreadyFromPlaces) {
                    prospectWebsiteByCompanyId.set(companyId, data.website);
                    fromProspects.push({ id: companyId, name: data.businessName, website: data.website });
                }
            }
        }
    }

    console.log(`From placesData: ${fromPlaces.length}`);
    console.log(`From prospect_queue: ${fromProspects.length}`);
    console.log();

    const allUpdates = [...fromPlaces, ...fromProspects];

    if (allUpdates.length === 0) {
        console.log("Nothing to update! All companies already have websites or no source data available.");
        process.exit(0);
    }

    // Apply updates
    const BATCH_LIMIT = 500;
    let updated = 0;

    for (let i = 0; i < allUpdates.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const chunk = allUpdates.slice(i, i + BATCH_LIMIT);
        for (const item of chunk) {
            console.log(`  ✅ ${item.name} → ${item.website}`);
            if (!dryRun) {
                batch.update(db.collection("companies").doc(item.id), { website: item.website });
            }
        }
        if (!dryRun) await batch.commit();
        updated += chunk.length;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`Updated ${updated} companies with website URLs`);
    console.log(`═══════════════════════════════════════\n`);

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
