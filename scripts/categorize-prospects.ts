/**
 * Auto-categorize prospect_queue documents based on searchQuery.
 * 
 * 1. Uses a static searchQuery → FacilityType map for well-known types.
 * 2. Loads custom facility types from Firestore (facility_types_custom)
 *    and uses their `inferPatterns` for fuzzy matching against
 *    businessName and searchQuery.
 * 
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
// searchQuery → FacilityType mapping (static / well-known)
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

// ═══════════════════════════════════════════════════════════
// Load custom facility types from Firestore
// ═══════════════════════════════════════════════════════════
interface CustomFacilityType {
    slug: string;
    label: string;
    inferPatterns: string[];
}

async function loadCustomTypes(): Promise<CustomFacilityType[]> {
    const snap = await db.collection("facility_types_custom").get();
    const types: CustomFacilityType[] = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        types.push({
            slug: data.slug || doc.id,
            label: data.label || doc.id,
            inferPatterns: data.inferPatterns || [],
        });
    }
    return types;
}

/**
 * Try to infer a facility type using custom types' inferPatterns.
 * Checks both businessName and searchQuery with substring matching.
 */
function inferCustomType(
    businessName: string,
    searchQuery: string,
    customTypes: CustomFacilityType[],
): string | null {
    const haystack = `${businessName} ${searchQuery}`.toLowerCase();
    for (const ct of customTypes) {
        for (const pattern of ct.inferPatterns) {
            if (haystack.includes(pattern.toLowerCase())) {
                return ct.slug;
            }
        }
    }
    return null;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE\n" : "✏️  LIVE MODE — will update Firestore\n");

    // Load custom types first
    const customTypes = await loadCustomTypes();
    console.log(`Loaded ${customTypes.length} custom facility types from Firestore:`);
    for (const ct of customTypes) {
        console.log(`  • ${ct.label} (${ct.slug}) — patterns: [${ct.inferPatterns.join(", ")}]`);
    }
    console.log();

    const snap = await db.collection("prospect_queue").get();
    console.log(`Total documents: ${snap.size}\n`);

    let updated = 0;
    let updatedCustom = 0;
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
        const businessName = (data.businessName || "").toLowerCase().trim();

        // 1. Try static map first (exact match on searchQuery)
        let mapped = QUERY_TO_FACILITY_TYPE[searchQuery];
        let source = "static";

        // 2. If not found, try custom types' inferPatterns (fuzzy match)
        if (!mapped) {
            const customMatch = inferCustomType(businessName, searchQuery, customTypes);
            if (customMatch) {
                mapped = customMatch;
                source = "custom";
            }
        }

        if (mapped) {
            if (!dryRun) {
                batch.update(doc.ref, {
                    facilityType: mapped,
                    updatedAt: new Date(),
                });
                batchCount++;
                if (batchCount >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            updated++;
            if (source === "custom") updatedCustom++;
            console.log(`  ✅ ${data.businessName} → ${mapped} (${source}, query: "${searchQuery}")`);
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
    console.log(`    ├─ via static map: ${updated - updatedCustom}`);
    console.log(`    └─ via custom:     ${updatedCustom}`);
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
