/**
 * Dedup & Analyze prospect_queue
 * 
 * Reads all documents from prospect_queue, identifies duplicates
 * by email, website domain, phone, address, and normalized name,
 * then deletes the duplicates (keeping the first occurrence).
 * 
 * Also reports "uncategorized" (missing facilityType) entries.
 * 
 * Usage: npx tsx scripts/dedup-prospects.ts [--dry-run]
 */

import * as admin from "firebase-admin";

// Initialize with service account
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "xiri-facility-solutions",
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

interface ProspectDoc {
    id: string;
    businessName: string;
    normalizedName: string;
    contactEmail: string | null;
    genericEmail: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    searchQuery: string;
    facilityType?: string;
}

function extractDomain(url: string | null): string | null {
    if (!url) return null;
    try {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    } catch { return null; }
}

function normalizeAddress(addr: string | null): string | null {
    if (!addr) return null;
    return addr.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
}

function cleanPhone(phone: string | null): string | null {
    if (!phone) return null;
    return phone.replace(/[^0-9]/g, '');
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE — no deletions\n" : "🗑️  LIVE MODE — will delete duplicates\n");

    // Fetch all prospect_queue docs
    const snap = await db.collection("prospect_queue").get();
    console.log(`Total documents in prospect_queue: ${snap.size}\n`);

    const docs: ProspectDoc[] = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            businessName: data.businessName || '',
            normalizedName: data.normalizedName || '',
            contactEmail: data.contactEmail || null,
            genericEmail: data.genericEmail || null,
            website: data.website || null,
            phone: data.phone || null,
            address: data.address || null,
            status: data.status || 'unknown',
            searchQuery: data.searchQuery || '',
            facilityType: data.facilityType || undefined,
        };
    });

    // ═══════════════════════════════════════════════════
    // DEDUP ANALYSIS
    // ═══════════════════════════════════════════════════

    const seen = new Set<string>();
    const keep: ProspectDoc[] = [];
    const dupes: ProspectDoc[] = [];

    for (const doc of docs) {
        const keys: string[] = [];

        // Email-based dedup
        if (doc.contactEmail) keys.push(`email:${doc.contactEmail.toLowerCase()}`);
        if (doc.genericEmail) keys.push(`email:${doc.genericEmail.toLowerCase()}`);

        // Domain-based dedup
        const domain = extractDomain(doc.website);
        if (domain) keys.push(`domain:${domain}`);

        // Phone-based dedup
        const phone = cleanPhone(doc.phone);
        if (phone && phone.length >= 7) keys.push(`phone:${phone}`);

        // Address-based dedup
        const addr = normalizeAddress(doc.address);
        if (addr && addr.length >= 10) keys.push(`addr:${addr}`);

        // Name-based dedup
        if (doc.normalizedName) keys.push(`name:${doc.normalizedName}`);

        // Check if any key already seen
        const isDupe = keys.some(k => seen.has(k));

        if (isDupe) {
            dupes.push(doc);
        } else {
            keep.push(doc);
            // Add all keys to seen set
            keys.forEach(k => seen.add(k));
        }
    }

    console.log(`═══════════════════════════════════════`);
    console.log(`DEDUP RESULTS`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  Unique: ${keep.length}`);
    console.log(`  Duplicates: ${dupes.length}`);
    console.log();

    if (dupes.length > 0) {
        console.log(`Duplicates to remove:`);
        for (const d of dupes) {
            const email = d.contactEmail || d.genericEmail || 'no email';
            const domain = extractDomain(d.website) || 'no domain';
            console.log(`  ❌ ${d.businessName} | ${email} | ${domain} | ${d.address || 'no addr'}`);
        }
        console.log();
    }

    // ═══════════════════════════════════════════════════
    // FACILITY TYPE ANALYSIS
    // ═══════════════════════════════════════════════════

    const uncategorized = keep.filter(d => !d.facilityType);
    const categorized = keep.filter(d => d.facilityType);

    console.log(`═══════════════════════════════════════`);
    console.log(`FACILITY TYPE ANALYSIS (unique records)`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  Categorized: ${categorized.length}`);
    console.log(`  Uncategorized: ${uncategorized.length}`);
    console.log();

    // Group uncategorized by searchQuery to help categorize
    const byQuery: Record<string, ProspectDoc[]> = {};
    for (const d of uncategorized) {
        const q = d.searchQuery || 'unknown';
        if (!byQuery[q]) byQuery[q] = [];
        byQuery[q].push(d);
    }

    console.log(`Uncategorized by search query:`);
    for (const [query, items] of Object.entries(byQuery).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  "${query}" → ${items.length} prospects`);
        for (const d of items.slice(0, 3)) {
            console.log(`    • ${d.businessName} (${d.contactEmail || d.genericEmail || 'no email'})`);
        }
        if (items.length > 3) console.log(`    ... and ${items.length - 3} more`);
    }
    console.log();

    // ═══════════════════════════════════════════════════
    // STATUS BREAKDOWN
    // ═══════════════════════════════════════════════════
    const byStatus: Record<string, number> = {};
    for (const d of docs) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    }
    console.log(`STATUS BREAKDOWN (all records):`);
    for (const [status, count] of Object.entries(byStatus)) {
        console.log(`  ${status}: ${count}`);
    }
    console.log();

    // ═══════════════════════════════════════════════════
    // DELETE DUPLICATES
    // ═══════════════════════════════════════════════════

    if (dupes.length > 0 && !dryRun) {
        console.log(`Deleting ${dupes.length} duplicates...`);
        const BATCH_LIMIT = 500;
        for (let i = 0; i < dupes.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            const chunk = dupes.slice(i, i + BATCH_LIMIT);
            for (const d of chunk) {
                batch.delete(db.collection("prospect_queue").doc(d.id));
            }
            await batch.commit();
            console.log(`  Deleted batch of ${chunk.length}`);
        }
        console.log(`✅ Done. Removed ${dupes.length} duplicates.`);
    } else if (dupes.length > 0) {
        console.log(`Would delete ${dupes.length} duplicates. Run without --dry-run to execute.`);
    } else {
        console.log(`No duplicates found! 🎉`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
