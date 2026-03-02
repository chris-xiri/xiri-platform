/**
 * Fix Northwell lead addresses in Firestore.
 * Uses ZIP code to look up city/state via zippopotam.us API,
 * then strips city + state + zip from raw address to get clean street.
 *
 * Usage: node scripts/fix-northwell-addresses.js [--dry-run]
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Cache zip lookups to avoid redundant API calls
const zipCache = {};

async function lookupZip(zip) {
    if (zipCache[zip]) return zipCache[zip];
    try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (!res.ok) return null;
        const data = await res.json();
        const place = data.places?.[0];
        if (!place) return null;
        const result = {
            city: place['place name'],
            state: place['state abbreviation'],
        };
        zipCache[zip] = result;
        return result;
    } catch {
        return null;
    }
}

// US State full names for stripping from raw addresses
const STATE_NAMES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming', 'District of Columbia',
];

/**
 * Parse a concatenated address using zip lookup.
 * Raw format: "2403 Jericho TurnpikeGarden City Park, New York 11040"
 * Goal: address="2403 Jericho Turnpike", city="Garden City Park", state="NY", zip="11040"
 */
function extractStreetAddress(raw, city, state, zip) {
    if (!raw) return raw;

    let cleaned = raw;

    // Strip zip from end
    if (zip) {
        cleaned = cleaned.replace(new RegExp('\\s*' + zip + '\\s*$'), '').trim();
    }

    // Strip state name (full or abbreviation) from end
    for (const stateName of STATE_NAMES) {
        const re = new RegExp(',?\\s*' + stateName.replace(/ /g, '\\s+') + '\\s*$', 'i');
        if (re.test(cleaned)) {
            cleaned = cleaned.replace(re, '').trim();
            break;
        }
    }
    // Also strip 2-letter abbreviation
    if (state) {
        cleaned = cleaned.replace(new RegExp(',?\\s*' + state + '\\s*$'), '').trim();
    }

    // Now cleaned = "2403 Jericho TurnpikeGarden City Park" or "1575 Hillside Ave Suite 130New Hyde Park"
    // Strip the city name from the end
    if (city) {
        // Try exact match at end first (case insensitive)
        const cityRe = new RegExp(',?\\s*' + city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
        if (cityRe.test(cleaned)) {
            cleaned = cleaned.replace(cityRe, '').trim();
        } else {
            // City might be concatenated without space: "TurnpikeGarden City Park"
            // Find the city name within the string (case insensitive)
            const idx = cleaned.toLowerCase().lastIndexOf(city.toLowerCase());
            if (idx > 0) {
                cleaned = cleaned.substring(0, idx).trim();
            }
        }
    }

    // Clean up trailing comma
    cleaned = cleaned.replace(/,\s*$/, '').trim();

    return cleaned || raw;
}

async function main() {
    console.log(`🔧 Northwell Address Fixer ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

    // Init Firebase Admin
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });

    const db = admin.firestore();

    // Fetch all Northwell leads
    console.log('   Fetching Northwell leads...');
    const snapshot = await db.collection('leads')
        .where('attribution.source', '==', 'Northwell Health')
        .get();

    console.log(`   Found ${snapshot.size} Northwell leads\n`);

    // First pass: collect unique zips and look them up
    const zips = new Set();
    snapshot.docs.forEach(d => {
        const zip = d.data().zip;
        if (zip) zips.add(zip);
    });

    console.log(`   Looking up ${zips.size} unique ZIP codes...`);
    let lookupCount = 0;
    for (const zip of zips) {
        await lookupZip(zip);
        lookupCount++;
        if (lookupCount % 50 === 0) process.stdout.write(`   ${lookupCount}/${zips.size} zips...\r`);
    }
    console.log(`   ✅ Looked up ${zips.size} ZIP codes\n`);

    let fixed = 0, skipped = 0, errors = 0;
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const rawAddress = data.address;
        const zip = data.zip || '';

        if (!rawAddress || !zip) {
            skipped++;
            continue;
        }

        const lookup = zipCache[zip];
        if (!lookup) {
            if (fixed < 5) console.log(`   ⚠️  No ZIP data for ${zip}: "${rawAddress}"`);
            errors++;
            continue;
        }

        const streetAddress = extractStreetAddress(rawAddress, lookup.city, lookup.state, zip);

        if (DRY_RUN) {
            if (fixed < 15) {
                console.log(`   📍 "${rawAddress}"`);
                console.log(`      → addr: "${streetAddress}" | city: "${lookup.city}" | state: "${lookup.state}" | zip: "${zip}"\n`);
            }
        } else {
            batch.update(docSnap.ref, {
                address: streetAddress,
                city: lookup.city,
                state: lookup.state,
                zip: zip,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            batchCount++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`   Committed batch of ${batchCount}... (${fixed + batchCount} total)`);
                batch = db.batch();
                batchCount = 0;
            }
        }
        fixed++;
    }

    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(`   Committed final batch of ${batchCount}`);
    }

    console.log(`\n✅ Done!`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors (no ZIP data): ${errors}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
