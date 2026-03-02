/**
 * Northwell Health Affiliate Provider Scraper
 * Scrapes ~3,880 affiliate (non-W2) providers from Northwell's find-care page
 * and imports them into the Firestore 'leads' collection.
 *
 * Usage:
 *   npx tsx scripts/scrape-northwell.ts [--csv-only] [--max-pages N]
 *
 * Options:
 *   --csv-only     Only export to CSV, skip Firestore import
 *   --max-pages N  Limit scraping to N pages (for testing)
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// Firebase Admin SDK for Firestore import
import * as admin from "firebase-admin";

// ── Config ──
const BASE_URL = "https://www.northwell.edu/find-care";
const SEARCH_PARAMS = new URLSearchParams({
    location: "Garden City Park, NY 11040",
    is_staff: "false",
    latitude: "40.74102311",
    longitude: "-73.66316102",
    sort: "distance_asc",
    map: "false",
});
const RESULTS_PER_PAGE = 10;
const OUTPUT_CSV = path.join(__dirname, "..", "northwell_affiliates.csv");
const DELAY_BETWEEN_PAGES_MS = 1500; // Be respectful

// ── Types ──
interface ProviderLead {
    name: string;
    credentials: string;
    specialty: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    fax: string;
    distance: string;
    profileUrl: string;
    additionalLocations: number;
    isPrivateOffice: boolean; // No Northwell facility name in address
}

// ── Parse CLI Args ──
const args = process.argv.slice(2);
const csvOnly = args.includes("--csv-only");
const maxPagesIdx = args.indexOf("--max-pages");
const maxPages = maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1]) : Infinity;

// ── Main ──
async function main() {
    console.log("🏥 Northwell Affiliate Provider Scraper");
    console.log(`   Mode: ${csvOnly ? "CSV only" : "CSV + Firestore import"}`);
    console.log(`   Max pages: ${maxPages === Infinity ? "all" : maxPages}`);
    console.log("");

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const allProviders: ProviderLead[] = [];
    let pageNum = 1;
    let totalPages = 1;

    // First load to get total count
    const firstUrl = `${BASE_URL}?${SEARCH_PARAMS.toString()}`;
    console.log(`📄 Loading page 1...`);
    await page.goto(firstUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    // Get total results count — look for "Showing X-Y of Z results"
    const altTotal = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        // Match "Showing 1-10 of 3880 results" or "3,880 results"
        const m = bodyText.match(/of\s+([\d,]+)\s*results/i);
        if (m) return parseInt(m[1].replace(/,/g, ""));
        const m2 = bodyText.match(/([\d,]+)\s*results/i);
        if (m2) return parseInt(m2[1].replace(/,/g, ""));
        return 0;
    });
    if (altTotal > 0) {
        totalPages = Math.ceil(altTotal / RESULTS_PER_PAGE);
        console.log(`   Found ${altTotal} total results (${totalPages} pages)`);
    }

    const effectiveMaxPages = Math.min(totalPages, maxPages);
    console.log(`   Will scrape ${effectiveMaxPages} pages\n`);

    // Scrape page 1
    const p1Results = await scrapeCurrentPage(page, pageNum);
    allProviders.push(...p1Results);
    console.log(`   ✅ Page 1: ${p1Results.length} providers (total: ${allProviders.length})`);

    // Scrape remaining pages
    for (pageNum = 2; pageNum <= effectiveMaxPages; pageNum++) {
        const pageUrl = `${BASE_URL}?${SEARCH_PARAMS.toString()}&page=${pageNum}`;

        try {
            await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(3000); // Let React render

            const results = await scrapeCurrentPage(page, pageNum);
            allProviders.push(...results);

            if (pageNum % 10 === 0 || pageNum === effectiveMaxPages) {
                console.log(`   ✅ Page ${pageNum}/${effectiveMaxPages}: ${results.length} providers (total: ${allProviders.length})`);
            }

            // If no results found, we've likely hit the end
            if (results.length === 0) {
                console.log(`   ⚠️  No results on page ${pageNum}, stopping.`);
                break;
            }
        } catch (err: any) {
            console.error(`   ❌ Page ${pageNum} error: ${err.message}`);
            // Continue to next page
        }
    }

    await browser.close();

    console.log(`\n📊 Scraping complete: ${allProviders.length} providers found`);
    const privateOffice = allProviders.filter(p => p.isPrivateOffice);
    console.log(`   Private office (likely own-office): ${privateOffice.length}`);
    console.log(`   Northwell-affiliated location: ${allProviders.length - privateOffice.length}`);

    // Export to CSV
    exportToCsv(allProviders);

    // Import to Firestore
    if (!csvOnly) {
        await importToFirestore(allProviders);
    }

    console.log("\n✅ Done!");
}

async function scrapeCurrentPage(page: Page, pageNum: number): Promise<ProviderLead[]> {
    // Wait for provider cards to appear
    await page.waitForSelector('div[id^="provider-card-"]', { timeout: 10000 }).catch(() => null);

    return await page.evaluate(() => {
        const providers: any[] = [];

        // Use the stable ID-based selector for provider cards
        const cards = document.querySelectorAll('div[id^="provider-card-"]');

        cards.forEach((card) => {
            try {
                const text = card.textContent || "";

                // Name — in h2 element, inside a link
                const nameLink = card.querySelector('h2 a, a[href*="find-a-doctor"]');
                const nameText = nameLink?.textContent?.trim() || "";

                // Parse name and credentials (e.g., "Adam S. Cirlincione, DPM")
                const nameMatch = nameText.match(/^(.+?),\s*(.+)$/);
                const name = nameMatch ? nameMatch[1].trim() : nameText;
                const credentials = nameMatch ? nameMatch[2].trim() : "";

                // Profile URL
                const profileUrl = (nameLink as HTMLAnchorElement)?.href || "";

                // Specialty — text line after the name, typically in a span
                let specialty = "";
                const spans = card.querySelectorAll("span");
                for (const span of spans) {
                    const t = span.textContent?.trim() || "";
                    // Specialty is usually short text that isn't an address/phone/distance
                    if (t && !t.match(/^\d/) && !t.includes("mile") && !t.includes("(")
                        && !t.includes("View") && !t.includes("Partner") && !t.includes("rating")
                        && t !== name && t !== nameText && t.length > 3 && t.length < 80) {
                        specialty = t;
                        break;
                    }
                }

                // Address — from Google Maps link
                const mapsLink = card.querySelector('a[href*="google.com/maps"]');
                let fullAddress = mapsLink?.textContent?.trim() || "";

                // If no maps link, try to extract from text
                if (!fullAddress) {
                    const addrMatch = text.match(/(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Turnpike|Tpke|Lane|Ln|Way|Place|Pl|Court|Ct|Highway|Hwy)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i);
                    if (addrMatch) fullAddress = addrMatch[1];
                }

                // Parse city, state, zip from address
                const csz = fullAddress.match(/,\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})/);
                const city = csz ? csz[1].trim() : "";
                const state = csz ? csz[2] : "";
                const zip = csz ? csz[3] : "";

                // Phone — from tel: link
                const phoneLink = card.querySelector('a[href^="tel:"]');
                const phone = phoneLink?.textContent?.trim() || "";

                // Distance
                const distMatch = text.match(/([\d.]+)\s*mi(?:le)?s?/i);
                const distance = distMatch ? `${distMatch[1]} mi` : "";

                // Additional locations
                const locMatch = text.match(/View more locations?\s*\((\d+)\)/i);
                const additionalLocations = locMatch ? parseInt(locMatch[1]) : 0;

                // Is private office? (no Northwell facility name in address)
                const hasNorthwellFacility = /northwell|nslij|long island jewish|lenox hill|huntington hospital|south shore/i.test(fullAddress);
                const isPrivateOffice = !hasNorthwellFacility;

                if (name && name.length > 2) {
                    providers.push({
                        name,
                        credentials,
                        specialty,
                        address: fullAddress,
                        city,
                        state,
                        zip,
                        phone,
                        fax: "",
                        distance,
                        profileUrl,
                        additionalLocations,
                        isPrivateOffice,
                    });
                }
            } catch (e) {
                // Skip problematic cards
            }
        });

        return providers;
    });
}

function exportToCsv(providers: ProviderLead[]) {
    const headers = [
        "Name", "Credentials", "Specialty", "Address", "City", "State", "ZIP",
        "Phone", "Fax", "Distance", "Profile URL", "Additional Locations",
        "Private Office", "Facility Type",
    ];

    const rows = providers.map((p) => [
        csvEscape(p.name),
        csvEscape(p.credentials),
        csvEscape(p.specialty),
        csvEscape(p.address),
        csvEscape(p.city),
        csvEscape(p.state),
        p.zip,
        p.phone,
        p.fax,
        p.distance,
        p.profileUrl,
        p.additionalLocations.toString(),
        p.isPrivateOffice ? "Yes" : "No",
        "medical_private",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    fs.writeFileSync(OUTPUT_CSV, csv, "utf8");
    console.log(`\n📁 CSV exported: ${OUTPUT_CSV}`);
}

function csvEscape(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}

async function importToFirestore(providers: ProviderLead[]) {
    console.log(`\n🔥 Importing ${providers.length} leads to Firestore...`);

    // Initialize Firebase Admin
    const serviceAccountPath = path.join(__dirname, "..", "service-account.json");
    if (!fs.existsSync(serviceAccountPath)) {
        console.log("   ⚠️  service-account.json not found — using application default credentials");
        admin.initializeApp({ projectId: "xiri-facility-solutions" });
    } else {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    const db = admin.firestore();
    const batch_size = 500; // Firestore batch limit
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < providers.length; i += batch_size) {
        const chunk = providers.slice(i, i + batch_size);
        const batch = db.batch();

        for (const provider of chunk) {
            // Check for duplicates by phone or name+address combo
            const existingQuery = await db
                .collection("leads")
                .where("phone", "==", provider.phone)
                .where("businessName", "==", `${provider.name}, ${provider.credentials}`)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                skipped++;
                continue;
            }

            const leadDoc = db.collection("leads").doc();
            batch.set(leadDoc, {
                businessName: `${provider.name}, ${provider.credentials}`.trim(),
                website: provider.profileUrl || null,
                address: provider.address,
                city: provider.city,
                state: provider.state,
                zip: provider.zip,
                facilityType: "medical_private",
                contactName: provider.name,
                email: null,
                phone: provider.phone || null,
                notes: [
                    `Specialty: ${provider.specialty}`,
                    provider.distance ? `Distance: ${provider.distance}` : "",
                    provider.isPrivateOffice ? "Private office (not Northwell facility)" : "Located at Northwell facility",
                    provider.additionalLocations > 0 ? `${provider.additionalLocations} additional locations` : "",
                ].filter(Boolean).join(". "),
                status: "new",
                attribution: {
                    source: "Northwell Health",
                    medium: "scrape",
                    campaign: "northwell-affiliates-2026",
                    landingPage: provider.profileUrl,
                },
                tags: ["northwell-affiliate", provider.isPrivateOffice ? "private-office" : "northwell-facility"],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: "scraper",
            });
        }

        await batch.commit();
        imported += chunk.length - skipped;

        if ((i / batch_size + 1) % 5 === 0 || i + batch_size >= providers.length) {
            console.log(`   ✅ Batch ${Math.floor(i / batch_size) + 1}: ${imported} imported, ${skipped} skipped`);
        }
        skipped = 0;
    }

    console.log(`\n🎉 Firestore import complete: ${imported} leads added`);
}

// ── Run ──
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
