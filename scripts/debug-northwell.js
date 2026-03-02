const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log("🔍 Diagnostic scraper test\n");

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.northwell.edu/find-care?location=Garden+City+Park%2C+NY+11040&is_staff=false&latitude=40.74102311&longitude=-73.66316102&sort=distance_asc&map=false', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
    });

    console.log('Waiting 8s for full render...');
    await page.waitForTimeout(8000);

    // Step 1: Can we find cards?
    const cardCount = await page.locator('div[id^="provider-card-"]').count();
    console.log(`Locator card count: ${cardCount}`);

    // Step 2: Try evaluate
    const evalCount = await page.evaluate(() => {
        return document.querySelectorAll('div[id^="provider-card-"]').length;
    });
    console.log(`Evaluate card count: ${evalCount}`);

    // Step 3: Try locator-based extraction instead of evaluate
    const cards = page.locator('div[id^="provider-card-"]');
    const count = await cards.count();
    console.log(`\nExtracting ${count} cards via locators...`);

    const providers = [];
    for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const cardText = await card.textContent();

        // Name
        const nameLink = card.locator('a[href*="find-a-doctor"]').first();
        const nameText = await nameLink.textContent().catch(() => '');
        const profileUrl = await nameLink.getAttribute('href').catch(() => '');

        // Parse name/credentials
        const nameParts = nameText ? nameText.trim().match(/^(.+?),\s*(.+)$/) : null;
        const name = nameParts ? nameParts[1].trim() : (nameText || '').trim();
        const credentials = nameParts ? nameParts[2].trim() : '';

        // Phone
        const phoneLink = card.locator('a[href^="tel:"]').first();
        const phone = await phoneLink.textContent().catch(() => '');

        // Address
        const mapsLink = card.locator('a[href*="google.com/maps"]').first();
        const address = await mapsLink.textContent().catch(() => '');

        // Specialty — extract from text lines
        const lines = (cardText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const nameIdx = lines.findIndex(l => l.includes(name));
        let specialty = '';
        if (nameIdx >= 0) {
            for (let j = nameIdx + 1; j < Math.min(nameIdx + 4, lines.length); j++) {
                const line = lines[j];
                if (line && !line.match(/^\d/) && !line.includes('mile') && !line.includes('Patient')
                    && !line.includes('View') && !line.includes('Partner') && line.length > 3 && line.length < 80) {
                    specialty = line;
                    break;
                }
            }
        }

        // Distance
        const distMatch = (cardText || '').match(/([\d.]+)\s*miles?\s*away/i);
        const distance = distMatch ? distMatch[1] : '';

        // Additional locations
        const locMatch = (cardText || '').match(/View more locations?\s*\((\d+)\)/i);
        const additionalLocations = locMatch ? parseInt(locMatch[1]) : 0;

        // Parse city/state/zip
        const csz = (address || '').match(/,\s*([A-Za-z\s]+?)(?:,\s*|\s+)(?:NY|New York)\s*(\d{5})/i);

        const isNorthwell = /northwell|nslij|long island jewish|lenox hill/i.test(address || '');

        providers.push({
            name,
            credentials,
            specialty,
            address: (address || '').trim(),
            city: csz ? csz[1].trim() : '',
            state: 'NY',
            zip: csz ? csz[2] : '',
            phone: (phone || '').trim(),
            distance,
            profileUrl: profileUrl ? `https://www.northwell.edu${profileUrl}` : '',
            additionalLocations,
            isPrivateOffice: !isNorthwell,
        });

        console.log(`   ${i + 1}. ${name}, ${credentials} | ${specialty} | ${(phone || '').trim()} | ${(address || '').trim()}`);
    }

    await browser.close();

    // Save results
    if (providers.length > 0) {
        const headers = ["Name", "Credentials", "Specialty", "Address", "City", "State", "ZIP", "Phone", "Distance", "Profile URL", "Additional Locations", "Private Office"];
        const csvEscape = (v) => (v && (v.includes(",") || v.includes('"'))) ? `"${v.replace(/"/g, '""')}"` : (v || "");
        const rows = providers.map(p => [
            csvEscape(p.name), csvEscape(p.credentials), csvEscape(p.specialty),
            csvEscape(p.address), csvEscape(p.city), p.state, p.zip,
            p.phone, p.distance, csvEscape(p.profileUrl),
            p.additionalLocations.toString(), p.isPrivateOffice ? "Yes" : "No",
        ].join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        fs.writeFileSync(path.join(__dirname, '..', 'northwell_test.csv'), csv, 'utf8');
        console.log(`\n✅ Saved ${providers.length} providers to northwell_test.csv`);
    }

    process.exit(0);
})();
