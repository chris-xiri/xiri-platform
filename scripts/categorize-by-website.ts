/**
 * Categorize remaining uncategorized companies by checking their website.
 * 
 * Strategy:
 *   1. Find companies without a facilityType (or with 'other'/'uncategorized')
 *   2. Look up associated contacts to find a website URL
 *   3. Fetch the homepage and analyze text content
 *   4. Infer facility type from page content keywords
 * 
 * Usage:
 *   npx tsx scripts/categorize-by-website.ts --dry-run   # Preview only
 *   npx tsx scripts/categorize-by-website.ts              # Actually update
 */

import * as admin from "firebase-admin";
import https from "https";
import http from "http";

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "xiri-facility-solutions",
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ═══════════════════════════════════════════════════════════
// Website content → FacilityType inference
// ═══════════════════════════════════════════════════════════

function inferFromWebsiteContent(text: string, title: string): string | null {
    const q = (text + ' ' + title).toLowerCase();

    // Funeral
    if (q.includes('funeral') || q.includes('mortuary') || q.includes('cremation') || q.includes('memorial service') || q.includes('obituar') || q.includes('bereavement')) return 'funeral_home';

    // Medical — specific
    if (q.includes('dialysis')) return 'medical_dialysis';
    if (q.includes('urgent care') || q.includes('walk-in clinic')) return 'medical_urgent_care';
    if (q.includes('surgery center') || q.includes('surgical')) return 'medical_surgery';
    if (q.includes('dental') || q.includes('dentist') || q.includes('orthodont') || q.includes('endodont') || q.includes('periodon') || q.includes('prosthodont') || q.includes('oral health')) return 'medical_dental';
    if (q.includes('veterinar') || q.includes('animal hospital') || q.includes('pet health') || q.includes('your pet') || q.includes('companion animal')) return 'medical_veterinary';
    if (q.includes('chiropract') || q.includes('spinal') || q.includes('adjustment') || q.includes('subluxation')) return 'medical_private';
    if (q.includes('acupuncture') || q.includes('hearing aid') || q.includes('audiology') || q.includes('optometr') || q.includes('pharmacy') || q.includes('prescription')) return 'medical_private';
    if (q.includes('medical') || q.includes('healthcare') || q.includes('patient') || q.includes('physician') || q.includes('doctor') || q.includes('clinical') || q.includes('diagnosis') || q.includes('treatment plan')) return 'medical_private';

    // Pet services
    if (q.includes('dog grooming') || q.includes('pet grooming') || q.includes('boarding') || q.includes('doggy daycare') || q.includes('pet sitting') || q.includes('pet spa') || q.includes('kennel')) return 'medical_veterinary';

    // Education
    if (q.includes('daycare') || q.includes('day care') || q.includes('preschool') || q.includes('childcare') || q.includes('child care') || q.includes('toddler') || q.includes('early childhood') || q.includes('nursery school')) return 'edu_daycare';
    if (q.includes('tutoring') || q.includes('test prep') || q.includes('sat prep') || q.includes('learning center') || q.includes('homework help') || q.includes('academic support') || q.includes('educational program')) return 'edu_tutoring';
    if (q.includes('private school') || q.includes('k-12') || q.includes('enrollment') || q.includes('curriculum') || q.includes('academy') || q.includes('campus')) return 'edu_private_school';

    // Auto
    if (q.includes('dealership') || q.includes('pre-owned vehicle') || q.includes('new car') || q.includes('test drive') || q.includes('auto sales')) return 'auto_dealer_showroom';
    if (q.includes('auto repair') || q.includes('oil change') || q.includes('brake') || q.includes('transmission') || q.includes('tire service') || q.includes('mechanic') || q.includes('auto service')) return 'auto_service_center';

    // Manufacturing
    if (q.includes('manufactur') || q.includes('industrial') || q.includes('warehouse') || q.includes('wholesale') || q.includes('production line') || q.includes('packaging')) return 'manufacturing_light';

    // Fitness
    if (q.includes('gym') || q.includes('fitness') || q.includes('workout') || q.includes('crossfit') || q.includes('personal train') || q.includes('yoga') || q.includes('martial art') || q.includes('boxing')) return 'fitness_gym';

    // Retail / Entertainment
    if (q.includes('escape room') || q.includes('party room') || q.includes('event space') || q.includes('entertainment')) return 'retail_storefront';
    if (q.includes('retail') || q.includes('shopping') || q.includes('store') || q.includes('boutique') || q.includes('salon') || q.includes('barber')) return 'retail_storefront';

    // Religious
    if (q.includes('church') || q.includes('worship') || q.includes('sermon') || q.includes('congregation') ||
        q.includes('mosque') || q.includes('prayer') || q.includes('islamic') || q.includes('quran') ||
        q.includes('synagogue') || q.includes('temple') || q.includes('torah') || q.includes('shabbat') ||
        q.includes('sunday service') || q.includes('bible study') || q.includes('ministry') || q.includes('parish')) return 'religious_center';

    // Office / Professional services
    if (q.includes('law firm') || q.includes('attorney') || q.includes('legal') || q.includes('litigation') || q.includes('practice areas')) return 'office_general';
    if (q.includes('architect') || q.includes('design firm') || q.includes('engineering firm')) return 'office_general';
    if (q.includes('insurance') || q.includes('real estate') || q.includes('mortgage') || q.includes('financial service')) return 'office_general';
    if (q.includes('consulting') || q.includes('software') || q.includes('technology') || q.includes('it service')) return 'office_general';

    // Library
    if (q.includes('library') || q.includes('book lending') || q.includes('public library')) return 'office_general';

    return null;
}

/** Fallback: infer from URL structure + business name */
function inferFromUrl(url: string, businessName: string): string | null {
    const u = (url + ' ' + businessName).toLowerCase();

    // URL domain clues
    if (u.includes('law') || u.includes('legal') || u.includes('attorney')) return 'office_general';
    if (u.includes('daycare') || u.includes('childcare') || u.includes('learningcenter')) return 'edu_daycare';
    if (u.includes('dental') || u.includes('dentist')) return 'medical_dental';
    if (u.includes('vet') || u.includes('animal')) return 'medical_veterinary';
    if (u.includes('chiro')) return 'medical_private';
    if (u.includes('church') || u.includes('masjid') || u.includes('temple') || u.includes('synagogue')) return 'religious_center';
    if (u.includes('funeral') || u.includes('memorial')) return 'funeral_home';

    // Business name suffix clues
    const name = businessName.trim();
    if (/,\s*PC$/i.test(name) || /,\s*P\.?C\.?$/i.test(name)) return 'office_general';  // Professional Corporation
    if (/^Dr\.?\s/i.test(name)) return 'medical_private'; // Doctor
    if (/Co\.\s*Inc/i.test(name) || /\bInc\.?$/i.test(name) || /\bCorp\.?$/i.test(name)) return 'manufacturing_light';

    return null;
}

// ═══════════════════════════════════════════════════════════
// Simple HTTP fetcher (no dependencies needed)
// ═══════════════════════════════════════════════════════════

function fetchPage(url: string, maxRedirects = 3): Promise<string> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { 
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; XiriBot/1.0)',
                'Accept': 'text/html',
            }
        }, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(url);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }
                return fetchPage(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
            }

            let data = '';
            res.on('data', (chunk: string) => {
                data += chunk;
                // Only grab first 50KB to avoid huge pages
                if (data.length > 50000) {
                    res.destroy();
                    resolve(data);
                }
            });
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

/** Extract readable text from HTML (strip tags, scripts, styles) */
function htmlToText(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000); // first ~10K chars is plenty
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : '';
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    console.log(dryRun ? "🔍 DRY RUN MODE\n" : "✏️  LIVE MODE — will update Firestore\n");

    // Step 1: Find uncategorized companies
    const companiesSnap = await db.collection("companies").get();
    const uncategorized: { id: string; name: string }[] = [];

    for (const doc of companiesSnap.docs) {
        const data = doc.data();
        if (!data.facilityType || data.facilityType === 'uncategorized' || data.facilityType === 'other') {
            const name = data.businessName || '';
            if (name.trim()) {
                uncategorized.push({ id: doc.id, name });
            }
        }
    }

    console.log(`Found ${uncategorized.length} uncategorized companies\n`);
    if (uncategorized.length === 0) {
        console.log("All companies are already categorized! 🎉");
        process.exit(0);
    }

    // Step 2: Build a map of companyId → website from multiple sources
    const companyWebsites = new Map<string, string>();

    // Source A: Check company doc itself (may have placesData.website)
    for (const doc of companiesSnap.docs) {
        const data = doc.data();
        if (data.website) {
            companyWebsites.set(doc.id, data.website);
        } else if (data.placesData?.website) {
            companyWebsites.set(doc.id, data.placesData.website);
        }
    }
    console.log(`  Source A (company docs): ${companyWebsites.size} websites`);

    // Source B: contacts collection
    const contactsSnap = await db.collection("contacts").get();
    let contactWebsites = 0;
    for (const doc of contactsSnap.docs) {
        const data = doc.data();
        if (data.companyId && data.website && !companyWebsites.has(data.companyId)) {
            companyWebsites.set(data.companyId, data.website);
            contactWebsites++;
        }
    }
    console.log(`  Source B (contacts): ${contactWebsites} additional websites`);

    // Source C: prospect_queue — match by businessName
    const prospectsSnap = await db.collection("prospect_queue").get();
    const uncategorizedNames = new Map(uncategorized.map(c => [c.name.toLowerCase().trim(), c.id]));
    let prospectWebsites = 0;
    for (const doc of prospectsSnap.docs) {
        const data = doc.data();
        if (data.website && data.businessName) {
            const companyId = uncategorizedNames.get(data.businessName.toLowerCase().trim());
            if (companyId && !companyWebsites.has(companyId)) {
                companyWebsites.set(companyId, data.website);
                prospectWebsites++;
            }
        }
    }
    console.log(`  Source C (prospect_queue): ${prospectWebsites} additional websites`);
    console.log(`  Total websites found: ${companyWebsites.size}\n`);

    // Step 3: For each uncategorized company, try to fetch & analyze website
    let categorized = 0;
    let noWebsite = 0;
    let fetchFailed = 0;
    let noMatch = 0;
    const results: { name: string; type: string | null; website: string | null; error?: string }[] = [];

    const batch = db.batch();
    let batchCount = 0;

    for (const company of uncategorized) {
        const website = companyWebsites.get(company.id);

        if (!website) {
            // Try name-only inference as last resort
            const nameInferred = inferFromUrl('', company.name);
            if (nameInferred) {
                categorized++;
                results.push({ name: company.name, type: nameInferred, website: null });
                console.log(`  ✅ ${company.name} → ${nameInferred} (from name pattern)`);
                if (!dryRun) {
                    batch.update(db.collection("companies").doc(company.id), { facilityType: nameInferred });
                    batchCount++;
                }
            } else {
                noWebsite++;
                results.push({ name: company.name, type: null, website: null, error: 'No website found' });
                console.log(`  ⚠️  ${company.name} — no website, no name match`);
            }
            continue;
        }

        try {
            // Ensure URL has protocol
            const url = website.startsWith('http') ? website : `https://${website}`;
            console.log(`  🌐 ${company.name} — fetching ${url}...`);

            const html = await fetchPage(url);
            const title = extractTitle(html);
            const text = htmlToText(html);
            let inferred = inferFromWebsiteContent(text, title);

            // Fallback: check the URL itself for clues
            if (!inferred) {
                inferred = inferFromUrl(url, company.name);
            }

            if (inferred) {
                categorized++;
                results.push({ name: company.name, type: inferred, website: url });
                console.log(`  ✅ ${company.name} → ${inferred} (from website: "${title.slice(0, 60)}")`);

                if (!dryRun) {
                    batch.update(db.collection("companies").doc(company.id), { facilityType: inferred });
                    batchCount++;
                }
            } else {
                noMatch++;
                results.push({ name: company.name, type: null, website: url, error: `No match from content (title: "${title.slice(0, 80)}")` });
                console.log(`  ❓ ${company.name} — couldn't infer from website content (title: "${title.slice(0, 60)}")`);
            }
        } catch (err: any) {
            fetchFailed++;
            results.push({ name: company.name, type: null, website, error: err.message });
            console.log(`  ❌ ${company.name} — fetch failed: ${err.message}`);
        }

        // Small delay to be polite
        await new Promise(r => setTimeout(r, 500));
    }

    // Commit
    if (batchCount > 0 && !dryRun) {
        await batch.commit();
    }

    // Summary
    console.log(`\n═══════════════════════════════════════`);
    console.log(`RESULTS`);
    console.log(`═══════════════════════════════════════`);
    console.log(`  Categorized from website: ${categorized}`);
    console.log(`  No website available:     ${noWebsite}`);
    console.log(`  Fetch failed:             ${fetchFailed}`);
    console.log(`  No match from content:    ${noMatch}`);
    console.log(`  Total uncategorized:      ${uncategorized.length}`);
    console.log();

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
