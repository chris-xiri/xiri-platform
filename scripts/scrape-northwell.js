/**
 * Northwell Health Affiliate Provider Scraper
 * Scrapes ~3,880 affiliate (non-W2) providers and exports to CSV + JSON.
 *
 * Usage: node scripts/scrape-northwell.js [--max-pages N]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = "https://www.northwell.edu/find-care";
const SEARCH_PARAMS = "location=Garden+City+Park%2C+NY+11040&is_staff=false&latitude=40.74102311&longitude=-73.66316102&sort=distance_asc&map=false";
const OUTPUT_CSV = path.join(__dirname, '..', 'northwell_affiliates.csv');
const OUTPUT_JSON = path.join(__dirname, '..', 'northwell_affiliates.json');

const args = process.argv.slice(2);
const maxPagesIdx = args.indexOf("--max-pages");
const maxPages = maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1]) : Infinity;

async function scrapePageLocators(page) {
    const providers = [];
    const cards = page.locator('div[id^="provider-card-"]');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const cardText = await card.textContent() || "";

        // Name — use h2 link (the avatar also has a find-a-doctor link but just initials)
        const h2Link = card.locator('h2 a').first();
        const h2Count = await card.locator('h2 a').count();
        let nameText = '';
        let profileUrl = '';

        if (h2Count > 0) {
            nameText = (await h2Link.textContent() || '').trim();
            const href = await h2Link.getAttribute('href') || '';
            profileUrl = href.startsWith('http') ? href : `https://www.northwell.edu${href}`;
        } else {
            // Fallback: get all find-a-doctor links and take the one with the longest text (the name)
            const links = card.locator('a[href*="find-a-doctor"]');
            const linkCount = await links.count();
            for (let j = 0; j < linkCount; j++) {
                const t = (await links.nth(j).textContent() || '').trim();
                if (t.length > nameText.length) {
                    nameText = t;
                    const href = await links.nth(j).getAttribute('href') || '';
                    profileUrl = href.startsWith('http') ? href : `https://www.northwell.edu${href}`;
                }
            }
        }

        if (!nameText || nameText.length < 4) continue;

        // Split name/credentials
        const nameParts = nameText.match(/^(.+?),\s*(.+)$/);
        const name = nameParts ? nameParts[1].trim() : nameText;
        const credentials = nameParts ? nameParts[2].trim() : '';

        // Phone
        const phoneLink = card.locator('a[href^="tel:"]').first();
        const phoneCount = await card.locator('a[href^="tel:"]').count();
        const phone = phoneCount > 0 ? (await phoneLink.textContent() || '').trim() : '';

        // Address — from Google Maps link
        const mapsLink = card.locator('a[href*="google.com/maps"]').first();
        const mapsCount = await card.locator('a[href*="google.com/maps"]').count();
        let address = mapsCount > 0 ? (await mapsLink.textContent() || '').trim() : '';

        // Specialty — from text lines, first meaningful line after name
        const lines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const nameIdx = lines.findIndex(l => l.includes(name));
        let specialty = '';
        if (nameIdx >= 0) {
            for (let j = nameIdx + 1; j < Math.min(nameIdx + 5, lines.length); j++) {
                const line = lines[j];
                if (line && !line.match(/^\d/) && !line.includes('mile') && !line.includes('Patient')
                    && !line.includes('View') && !line.includes('Partner') && !line.includes('rating')
                    && !line.includes('Book') && line.length > 3 && line.length < 80) {
                    specialty = line;
                    break;
                }
            }
        }

        // Distance
        const distMatch = cardText.match(/([\d.]+)\s*miles?\s*away/i);
        const distance = distMatch ? distMatch[1] : '';

        // Additional locations
        const locMatch = cardText.match(/View more locations?\s*\((\d+)\)/i);
        const additionalLocations = locMatch ? parseInt(locMatch[1]) : 0;

        // Parse city/state/zip from address
        const csz = address.match(/,?\s*([A-Za-z\s]+?)(?:,\s*|\s+)(?:New York|NY)\s*(\d{5})/i);
        const city = csz ? csz[1].trim() : '';
        const zip = csz ? csz[2] : '';

        // Private office check
        const isNorthwell = /northwell|nslij|long island jewish|lenox hill|cohen|zucker/i.test(address);

        providers.push({
            name, credentials, specialty, address,
            city, state: 'NY', zip,
            phone, distance, profileUrl,
            additionalLocations,
            isPrivateOffice: !isNorthwell,
        });
    }
    return providers;
}

(async () => {
    console.log("🏥 Northwell Affiliate Provider Scraper");
    console.log(`   Max pages: ${maxPages === Infinity ? "all" : maxPages}\n`);

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Page 1
    console.log("📄 Loading page 1...");
    await page.goto(`${BASE_URL}?${SEARCH_PARAMS}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('div[id^="provider-card-"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Total count
    const totalResults = await page.evaluate(() => {
        const m = document.body.innerText.match(/of\s+([\d,]+)\s*results/i);
        return m ? parseInt(m[1].replace(/,/g, "")) : 0;
    });
    const totalPages = Math.min(Math.ceil(totalResults / 10), maxPages);
    console.log(`   Found ${totalResults} total results → scraping ${totalPages} pages\n`);

    const allProviders = [];

    // Scrape page 1
    const p1 = await scrapePageLocators(page);
    allProviders.push(...p1);
    console.log(`   ✅ Page 1/${totalPages}: ${p1.length} providers (total: ${allProviders.length})`);

    // Remaining pages
    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
        try {
            await page.goto(`${BASE_URL}?${SEARCH_PARAMS}&page=${pageNum}`, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForSelector('div[id^="provider-card-"]', { timeout: 15000 }).catch(() => null);
            await page.waitForTimeout(1500);

            const providers = await scrapePageLocators(page);
            allProviders.push(...providers);

            if (pageNum % 20 === 0 || pageNum === totalPages) {
                console.log(`   ✅ Page ${pageNum}/${totalPages}: ${providers.length} providers (total: ${allProviders.length})`);
            }

            if (providers.length === 0) {
                console.log(`   ⚠️  Empty page ${pageNum}, stopping.`);
                break;
            }
        } catch (err) {
            console.error(`   ❌ Page ${pageNum}: ${err.message}`);
        }
    }

    await browser.close();

    // Stats
    const priv = allProviders.filter(p => p.isPrivateOffice);
    console.log(`\n📊 Done: ${allProviders.length} providers`);
    console.log(`   Private office: ${priv.length} | Northwell facility: ${allProviders.length - priv.length}`);

    // CSV
    const headers = ["Name", "Credentials", "Specialty", "Address", "City", "State", "ZIP", "Phone", "Distance", "Profile URL", "Additional Locations", "Private Office"];
    const esc = v => (v && (v.includes(",") || v.includes('"') || v.includes('\n'))) ? `"${v.replace(/"/g, '""')}"` : (v || "");
    const rows = allProviders.map(p => [
        esc(p.name), esc(p.credentials), esc(p.specialty), esc(p.address),
        esc(p.city), p.state, p.zip, p.phone, p.distance, esc(p.profileUrl),
        String(p.additionalLocations), p.isPrivateOffice ? "Yes" : "No",
    ].join(","));
    fs.writeFileSync(OUTPUT_CSV, [headers.join(","), ...rows].join("\n"), "utf8");
    console.log(`\n📁 CSV: ${OUTPUT_CSV}`);

    // JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allProviders, null, 2), "utf8");
    console.log(`📁 JSON: ${OUTPUT_JSON}`);

    console.log("\n✅ Done!");
    process.exit(0);
})();
