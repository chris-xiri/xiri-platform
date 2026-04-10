/**
 * Auto-categorize companies in the 'companies' collection based on businessName.
 * 
 * Uses keyword matching against each company's businessName to infer
 * a canonical FacilityType, then batch-updates Firestore.
 * Companies that can't be mapped are left as-is.
 * 
 * Usage:
 *   npx tsx scripts/categorize-companies.ts --dry-run   # Preview only
 *   npx tsx scripts/categorize-companies.ts              # Actually update
 */

import * as admin from "firebase-admin";

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "xiri-facility-solutions",
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ═══════════════════════════════════════════════════════════
// businessName → FacilityType inference
// Mirrors shared/index.ts inferFacilityType() but adds more
// patterns useful for company name matching (e.g. "Tabernacle",
// "Masjid", "Montessori", etc.)
// ═══════════════════════════════════════════════════════════
function inferFromName(name: string): string | null {
    const q = name.toLowerCase();

    // Medical — most specific first
    if (q.includes('dialysis')) return 'medical_dialysis';
    if (q.includes('urgent care')) return 'medical_urgent_care';
    if (q.includes('surgery') || q.includes('surgical')) return 'medical_surgery';
    if (q.includes('dental') || q.includes('dentist') || q.includes('orthodont') || q.includes('endodont') || q.includes('prosthodont') || q.includes(' dds')) return 'medical_dental';
    if (q.includes('veterinary') || q.includes('vet clinic') || q.includes('animal hospital') || q.includes('animal care') || q.includes('bond vet') || q.includes('pet hospital')) return 'medical_veterinary';
    if (q.includes('chiropract') || q.includes('chriopract') || q.includes('chiro care')) return 'medical_private'; // includes common typo
    if (q.includes('acupuncture') || q.includes('hearing care') || q.includes('optical') || q.includes('pharmacy')) return 'medical_private';
    if (q.includes('medical') || q.includes('doctor') || q.includes('physician') || q.includes('clinic') || q.includes('dermatolog') || q.includes('pediatric') || q.includes('ophthalm') || q.includes('podiatr') || q.includes('cardio') || q.includes('orthoped') || q.includes('physical therapy') || q.includes('radiology') || q.includes('wellness center') || q.includes('back and neck')) return 'medical_private';

    // Pet services (→ veterinary since they need similar cleaning)
    if (q.includes('pet care') || q.includes('pet spa') || q.includes('pet hotel') || q.includes('pet resort') || q.includes('dog ') || q.includes('paw') || q.includes('k9 ') || q.includes('camp bow wow') || q.includes('hounds town') || q.includes('pooch') || q.includes('pet grooming') || q.includes('kennel') || q.includes('bones') && (q.includes('bath') || q.includes('biscuit') || q.includes('beds'))) return 'medical_veterinary';

    // Funeral homes
    if (q.includes('funeral') || q.includes('mortuary') || q.includes('cremation')) return 'funeral_home';

    // Education
    if (q.includes('daycare') || q.includes('day care') || q.includes('preschool') || q.includes('childcare') || q.includes('child care') || q.includes('nursery school') || q.includes('montessori') || q.includes('head start') || q.includes('early childhood') || q.includes('children\'s center') || q.includes('little minds') || q.includes('little people')) return 'edu_daycare';
    if (q.includes('tutoring') || q.includes('tutor') || q.includes('learning center') || q.includes('educational center') || q.includes('test prep') || q.includes('kumon') || q.includes('mathnasium') || q.includes('sylvan') || q.includes('sat prep') || q.includes('education team') || q.includes('education -') || q.includes('mindnasium') || q.includes('premier plus education')) return 'edu_tutoring';
    if (q.includes('private school') || q.includes('prep school') || q.includes('academy') || q.includes('school')) return 'edu_private_school';

    // Auto
    if (q.includes('dealership') || q.includes('auto dealer') || q.includes('car dealer') || (q.includes('motor') && (q.includes('sales') || q.includes('dealer')))) return 'auto_dealer_showroom';
    if (q.includes('auto service') || q.includes('auto repair') || q.includes('mechanic') || q.includes('tire') || q.includes('muffler') || q.includes('jiffy lube') || q.includes('meineke')) return 'auto_service_center';

    // Labs / Manufacturing
    if (q.includes('cleanroom') || q.includes('clean room') || q.includes('lab ') || q.includes(' lab') || q.includes('laboratory')) return 'lab_cleanroom';
    if (q.includes('bsl') || q.includes('biosafety')) return 'lab_bsl';
    if (q.includes('manufacturing') || q.includes('factory') || q.includes('warehouse') || q.includes('industrial')) return 'manufacturing_light';

    // Fitness
    if (q.includes('gym') || q.includes('fitness') || q.includes('crossfit') || q.includes('yoga') || q.includes('pilates') || q.includes('boxing') || q.includes('martial art') || q.includes('karate') || q.includes('planet fitness') || q.includes('equinox') || q.includes('kombative')) return 'fitness_gym';

    // Retail / Entertainment venues
    if (q.includes('retail') || q.includes('store') || q.includes('shop') || q.includes('boutique') || q.includes('salon') || q.includes('barber') || q.includes('escape room') || q.includes('party') || q.includes('birdie') || q.includes('center stage')) return 'retail_storefront';

    // Religious — expanded for company names
    if (q.includes('church') || q.includes('cathedral') || q.includes('chapel') || q.includes('parish') ||
        q.includes('tabernacle') || q.includes('gospel') || q.includes('ministry') || q.includes('ministries') ||
        q.includes('congregation') || q.includes('worship') || q.includes('baptist') || q.includes('methodist') ||
        q.includes('lutheran') || q.includes('pentecostal') || q.includes('apostolic') || q.includes('evangelical') ||
        q.includes('presbyterian') || q.includes('episcopal') || q.includes('catholic') || q.includes('orthodox') ||
        q.includes('mosque') || q.includes('masjid') || q.includes('islamic') ||
        q.includes('synagogue') || q.includes('temple') || q.includes('jewish') || q.includes('chabad') ||
        q.includes('shul') || q.includes('religious') ||
        q.includes('our lady') || q.includes('saint ') || q.includes('st. ') || q.includes('holy ') ||
        q.includes('community church') || q.includes('grace ') || q.includes('faith ') ||
        q.includes('incarnation') || q.includes('spiritual') || q.includes('bible') || q.includes('redemption') ||
        q.includes('revival') || q.includes('assembly of god') || q.includes('house of prayer') ||
        q.includes('christian center') || q.includes('christian fellowship') || q.includes('christian cultural') ||
        q.includes('seminary') || q.includes('immaculate') || q.includes('mission') ||
        q.includes('community center') ||
        (q.includes('first ') && (q.includes('church') || q.includes('baptist') || q.includes('assembly')))) return 'religious_center';

    // Office — law firms, architects, insurance, real estate, banks, consultants, tech
    if (q.includes('office') || q.includes('co-working') || q.includes('coworking') ||
        q.includes('law ') || q.includes('llp') || q.includes('attorney') || q.includes('legal') || q.includes('esq') ||
        q.includes('architect') || q.includes('design') ||
        q.includes('insurance') || q.includes('state farm') || q.includes('allstate') ||
        q.includes('real estate') || q.includes('realty') ||
        q.includes('federal') || q.includes('bank') || q.includes('credit union') ||
        q.includes('consultant') || q.includes('technology') || q.includes('systems') || q.includes('electric')) return 'office_general';

    // Library
    if (q.includes('library')) return 'office_general';

    return null;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE\n" : "✏️  LIVE MODE — will update Firestore\n");

    const snap = await db.collection("companies").get();
    console.log(`Total companies: ${snap.size}\n`);

    let updated = 0;
    let alreadyCategorized = 0;
    let unmapped = 0;
    const unmappedNames: string[] = [];

    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
        const data = doc.data();

        // Skip if already has a valid facility type
        if (data.facilityType && data.facilityType !== "uncategorized" && data.facilityType !== "other") {
            alreadyCategorized++;
            continue;
        }

        const name = data.businessName || "";
        const mapped = inferFromName(name);

        if (mapped) {
            if (!dryRun) {
                batch.update(doc.ref, { facilityType: mapped });
                batchCount++;
                if (batchCount >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            updated++;
            console.log(`  ✅ ${name} → ${mapped}`);
        } else {
            unmapped++;
            unmappedNames.push(name);
        }
    }

    // Commit remaining batch
    if (batchCount > 0 && !dryRun) {
        await batch.commit();
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`RESULTS`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  Already categorized: ${alreadyCategorized}`);
    console.log(`  Auto-categorized:    ${updated}`);
    console.log(`  Still uncategorized: ${unmapped}`);

    if (unmappedNames.length > 0) {
        console.log(`\n  Companies that couldn't be auto-categorized:`);
        for (const name of unmappedNames.sort()) {
            console.log(`    ❓ ${name}`);
        }
    }

    console.log();
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
