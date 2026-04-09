/**
 * Auto-categorize prospect_queue documents based on searchQuery.
 * 
 * Maps searchQuery → canonical FacilityType, then batch-updates Firestore.
 * Records that can't be mapped are left as-is (no facilityType set).
 * 
 * Usage: npx tsx scripts/categorize-prospects.ts [--dry-run]
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
// searchQuery → FacilityType mapping
// ═══════════════════════════════════════════════════════════
const QUERY_TO_FACILITY_TYPE: Record<string, string> = {
    // Religious
    "church":           "religious_center",
    "mosque":           "religious_center",
    "jewish temple":    "religious_center",
    "religious center": "religious_center",
    "synagogue":        "religious_center",
    "temple":           "religious_center",

    // Education
    "daycare":          "edu_daycare",
    "preschool":        "edu_daycare",
    "childcare":        "edu_daycare",
    "tutoring academy": "edu_tutoring",
    "tutoring center":  "edu_tutoring",
    "learning center":  "edu_tutoring",
    "private school":   "edu_private_school",

    // Medical
    "dental office":    "medical_dental",
    "dental clinic":    "medical_dental",
    "dentist":          "medical_dental",
    "chiropractor":     "medical_private",
    "chiropractic":     "medical_private",
    "medical office":   "medical_private",
    "doctor office":    "medical_private",
    "urgent care":      "medical_urgent_care",
    "surgery center":   "medical_surgery",
    "dialysis":         "medical_dialysis",
    "veterinary clinic":"medical_veterinary",
    "veterinarian":     "medical_veterinary",
    "vet clinic":       "medical_veterinary",
    "animal hospital":  "medical_veterinary",

    // Other
    "gym":              "fitness_gym",
    "fitness":          "fitness_gym",
    "auto dealer":      "auto_dealer_showroom",
    "auto service":     "auto_service_center",
    "retail":           "retail_storefront",
    "office":           "office_general",
};

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE\n" : "✏️  LIVE MODE — will update Firestore\n");

    const snap = await db.collection("prospect_queue").get();
    console.log(`Total documents: ${snap.size}\n`);

    let updated = 0;
    let alreadyCategorized = 0;
    let unmapped = 0;
    const unmappedQueries: Record<string, number> = {};

    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
        const data = doc.data();

        // Skip if already categorized
        if (data.facilityType && data.facilityType !== "uncategorized") {
            alreadyCategorized++;
            continue;
        }

        const searchQuery = (data.searchQuery || "").toLowerCase().trim();
        const mapped = QUERY_TO_FACILITY_TYPE[searchQuery];

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
            console.log(`  ✅ ${data.businessName} → ${mapped} (query: "${searchQuery}")`);
        } else {
            unmapped++;
            unmappedQueries[searchQuery] = (unmappedQueries[searchQuery] || 0) + 1;
            console.log(`  ⚠️  ${data.businessName} — no mapping for "${searchQuery}"`);
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

    if (Object.keys(unmappedQueries).length > 0) {
        console.log(`\n  Unmapped search queries:`);
        for (const [q, count] of Object.entries(unmappedQueries).sort((a, b) => b[1] - a[1])) {
            console.log(`    "${q}" → ${count} prospects (needs manual categorization)`);
        }
    }

    console.log();
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
