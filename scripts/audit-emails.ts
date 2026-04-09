/**
 * Email-Domain Audit for prospect_queue
 * 
 * Checks every prospect's contactEmail against their business website.
 * Flags and fixes:
 *   - Junk emails (known platform/library/CDN domains)
 *   - Domain mismatches (email domain ≠ website domain)
 * 
 * Fixes: clears contactEmail, stores rejected email in rejectedEmail field,
 * and sets emailConfidence to 'rejected'.
 * 
 * Usage: npx tsx scripts/audit-emails.ts [--dry-run]
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

// ═══════════════════════════════════════════════════
// VALIDATION LOGIC (mirrors prospector.ts)
// ═══════════════════════════════════════════════════

const JUNK_EMAIL_DOMAINS = new Set([
    'example.com', 'domain.com', 'test.com', 'sentry.io', 'wixpress.com',
    'wordpress.org', 'wordpress.com', 'squarespace.com', 'weebly.com',
    'godaddy.com', 'namecheap.com', 'cloudflare.com', 'netlify.com',
    'vercel.com', 'heroku.com', 'amazonaws.com', 'google.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'broofa.com', 'uab.edu', 'w3.org', 'schema.org', 'jquery.com',
    'bootstrapcdn.com', 'cdnjs.com', 'unpkg.com', 'jsdelivr.net',
    'fontawesome.com', 'typekit.net', 'googleusercontent.com',
    'gstatic.com', 'googleapis.com', 'fbcdn.net', 'twimg.com',
    'linkedinusercontent.com', 'mysite.com',
]);

const FREE_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'msn.com', 'live.com',
    'verizon.net', 'comcast.net', 'att.net', 'sbcglobal.net',
    'optonline.net', 'optimum.net', 'cox.net', 'charter.net',
    'earthlink.net', 'juno.com', 'protonmail.com', 'proton.me',
    'zoho.com', 'yandex.com', 'mail.com', 'inbox.com',
    'atlanticbbn.net',
]);

function extractDomain(url: string): string | null {
    try {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    } catch { return null; }
}

/**
 * Strip common suffixes/noise words from a domain root for better matching.
 * e.g. "exceedlearningcenterny" → "exceedlearning"
 */
function stripDomainNoise(root: string): string {
    return root
        .replace(/[-_]/g, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, '')
        .replace(/(mail|email|web|site|online|center|centres?|ny|li|usa|inc|llc|corp|org|hq|app|the)$/gi, ''); // run twice for stacked suffixes
}

/**
 * Extract meaningful words from a domain root for word-overlap matching.
 * Splits on common boundaries.
 */
function extractDomainWords(root: string): string[] {
    // Try to split camelCase-ish and known word boundaries
    return root
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function validateEmailForBusiness(
    email: string,
    businessWebsite?: string | null
): 'domain_match' | 'free_provider' | 'junk' | 'mismatch' {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) return 'junk';

    if (JUNK_EMAIL_DOMAINS.has(emailDomain)) return 'junk';
    if (FREE_EMAIL_PROVIDERS.has(emailDomain)) return 'free_provider';

    if (businessWebsite) {
        const bizDomain = extractDomain(businessWebsite);
        if (bizDomain) {
            // 1. Exact match or subdomain
            if (emailDomain === bizDomain || emailDomain.endsWith('.' + bizDomain)) {
                return 'domain_match';
            }

            const bizRoot = bizDomain.split('.')[0].replace(/[-_]/g, '');
            const emailRoot = emailDomain.split('.')[0].replace(/[-_]/g, '');

            // 2. Simple substring match (one contains the other)
            if (bizRoot.length > 2 && emailRoot.length > 2 &&
                (bizRoot.includes(emailRoot) || emailRoot.includes(bizRoot))) {
                return 'domain_match';
            }

            // 3. Stripped match (remove common suffixes like 'center', 'ny', 'mail')
            const bizStripped = stripDomainNoise(bizRoot);
            const emailStripped = stripDomainNoise(emailRoot);
            if (bizStripped.length > 2 && emailStripped.length > 2 &&
                (bizStripped.includes(emailStripped) || emailStripped.includes(bizStripped))) {
                return 'domain_match';
            }

            // 4. TLD-swapped check (same root, different TLD)
            const bizBase = bizDomain.split('.').slice(0, -1).join('.');
            const emailBase = emailDomain.split('.').slice(0, -1).join('.');
            if (bizBase === emailBase) {
                return 'domain_match';
            }

            return 'mismatch';
        }
    }

    return 'free_provider'; // no website to compare
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE — no changes\n" : "🛠️  LIVE MODE — will fix bad emails\n");

    const snap = await db.collection("prospect_queue").get();
    console.log(`Total documents in prospect_queue: ${snap.size}\n`);

    // Categorize every email
    const results = {
        no_email: [] as any[],
        no_website: [] as any[],
        domain_match: [] as any[],
        free_provider: [] as any[],
        junk: [] as any[],
        mismatch: [] as any[],
    };

    for (const doc of snap.docs) {
        const data = doc.data();
        const email = data.contactEmail || data.genericEmail;
        const website = data.website;
        const name = data.businessName || doc.id;

        if (!email) {
            results.no_email.push({ id: doc.id, name, website });
            continue;
        }

        if (!website) {
            results.no_website.push({ id: doc.id, name, email });
            continue;
        }

        const validation = validateEmailForBusiness(email, website);
        results[validation].push({
            id: doc.id,
            name,
            email,
            emailField: data.contactEmail ? 'contactEmail' : 'genericEmail',
            website,
            websiteDomain: extractDomain(website),
            emailDomain: email.split('@')[1]?.toLowerCase(),
        });
    }

    // ═══════════════════════════════════════════════════
    // REPORT
    // ═══════════════════════════════════════════════════

    console.log(`═══════════════════════════════════════`);
    console.log(`EMAIL-DOMAIN VALIDATION AUDIT`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  ✅ Domain match:    ${results.domain_match.length}`);
    console.log(`  ✅ Free provider:   ${results.free_provider.length}`);
    console.log(`  ❌ Junk domain:     ${results.junk.length}`);
    console.log(`  ⚠️  Domain mismatch: ${results.mismatch.length}`);
    console.log(`  📭 No email:        ${results.no_email.length}`);
    console.log(`  🌐 No website:      ${results.no_website.length}`);
    console.log();

    // Show junk details
    if (results.junk.length > 0) {
        console.log(`\n❌ JUNK EMAILS (will be cleared):`);
        console.log(`${'—'.repeat(80)}`);
        for (const r of results.junk) {
            console.log(`  ${r.name}`);
            console.log(`    Email:   ${r.email}`);
            console.log(`    Website: ${r.website}`);
            console.log();
        }
    }

    // Show mismatch details
    if (results.mismatch.length > 0) {
        console.log(`\n⚠️  DOMAIN MISMATCHES (will be cleared):`);
        console.log(`${'—'.repeat(80)}`);
        for (const r of results.mismatch) {
            console.log(`  ${r.name}`);
            console.log(`    Email:   ${r.email} (domain: ${r.emailDomain})`);
            console.log(`    Website: ${r.website} (domain: ${r.websiteDomain})`);
            console.log();
        }
    }

    // ═══════════════════════════════════════════════════
    // FIX: Clear bad emails
    // ═══════════════════════════════════════════════════

    const toFix = [...results.junk, ...results.mismatch];

    if (toFix.length === 0) {
        console.log(`\n🎉 No bad emails found! All clean.`);
        process.exit(0);
    }

    console.log(`\nTotal to fix: ${toFix.length} prospects`);

    if (dryRun) {
        console.log(`\nRun without --dry-run to apply fixes.`);
        process.exit(0);
    }

    console.log(`\nApplying fixes...`);
    const BATCH_LIMIT = 500;

    for (let i = 0; i < toFix.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const chunk = toFix.slice(i, i + BATCH_LIMIT);

        for (const r of chunk) {
            const ref = db.collection("prospect_queue").doc(r.id);
            const updateData: Record<string, any> = {
                // Store the rejected email for reference
                rejectedEmail: r.email,
                rejectedEmailReason: results.junk.includes(r) ? 'junk_domain' : 'domain_mismatch',
                rejectedEmailDomain: r.emailDomain,
                // Clear the bad email field
                emailConfidence: 'rejected',
            };

            // Clear the appropriate email field
            if (r.emailField === 'contactEmail') {
                updateData.contactEmail = admin.firestore.FieldValue.delete();
            } else {
                updateData.genericEmail = admin.firestore.FieldValue.delete();
            }

            batch.update(ref, updateData);
        }

        await batch.commit();
        console.log(`  Fixed batch of ${chunk.length}`);
    }

    console.log(`\n✅ Done. Fixed ${toFix.length} prospects with bad emails.`);
    console.log(`   Rejected emails preserved in 'rejectedEmail' field for review.`);

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
