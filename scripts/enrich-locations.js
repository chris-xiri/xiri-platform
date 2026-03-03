#!/usr/bin/env node
/**
 * Location Enrichment Pipeline (v2)
 * 
 * Phase 1: Scrapes Wikipedia for verifiable facts about each town
 * Phase 2: Feeds scraped facts to Gemini Flash via Vertex AI (grounded, restricted to sources)
 * 
 * Prerequisites:
 *   gcloud auth login
 *   gcloud config set project xiri-facility-solutions
 * 
 * Usage:
 *   node scripts/enrich-locations.js
 *   
 *   Optional flags:
 *     --dry-run         Print output without writing to seo-data.json
 *     --only=slug       Only enrich a single location (e.g. --only=garden-city-ny)
 *     --skip-enriched   Skip locations with >150 char localInsight
 */

const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');

// ─── Config ───
const GCP_PROJECT = process.env.GCP_PROJECT || 'xiri-facility-solutions';
const GCP_REGION = process.env.GCP_REGION || 'us-central1';
const SEO_PATH = path.join(__dirname, '..', 'apps', 'public-site', 'data', 'seo-data.json');
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const SKIP_ENRICHED = process.argv.includes('--skip-enriched');

// Get access token from gcloud
function getAccessToken() {
    try {
        return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    } catch (e) {
        console.error('❌ Could not get gcloud access token. Run: gcloud auth login');
        process.exit(1);
    }
}

// ─── Step 1: Scrape Wikipedia for Real Facts ───

async function scrapeWikipedia(townName) {
    const searchName = `${townName}, New York`;
    const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchName)}&format=json&srlimit=1`;

    try {
        const searchRes = await fetch(wikiSearchUrl);
        const searchData = await searchRes.json();
        const pageTitle = searchData?.query?.search?.[0]?.title;

        if (!pageTitle) return { source: 'wikipedia', content: '', found: false };

        // Get the actual page content (plain text extract)
        const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&exintro=false&explaintext=true&exsectionformat=plain&format=json`;
        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();
        const pages = pageData?.query?.pages || {};
        const pageContent = Object.values(pages)[0]?.extract || '';

        // Take first ~2000 chars (intro + key sections)
        return {
            source: 'wikipedia',
            title: pageTitle,
            content: pageContent.slice(0, 2500),
            found: true
        };
    } catch (e) {
        return { source: 'wikipedia', content: '', found: false, error: e.message };
    }
}

// ─── Step 2: Feed Scraped Data to Gemini Flash (Grounded) ───

async function enrichWithGemini(location, wikiData) {
    const townName = location.name.replace(', NY', '');

    const prompt = `You are a local market research analyst for XIRI Facility Solutions, a commercial cleaning and facility management company serving Nassau County, NY.

═══ CRITICAL INSTRUCTIONS ═══
1. You may ONLY reference facts that appear in the VERIFIED SOURCES below.
2. Do NOT invent business names, landmark names, street names, medical centers, statistics, or any factual claims not in the sources.
3. If the source data is limited, write shorter, more general content rather than fabricating details.
4. Write in a confident, authoritative tone for SEO landing pages.
5. Focus on why this specific town needs professional facility management services.

═══ VERIFIED SOURCE 1: Our Existing Data ═══
Town: ${location.name}
Population: ${location.population || 'Not specified'}
Region: ${location.region}
Known Landmarks: ${(location.landmarks || []).join(', ') || 'None listed'}
Key Intersection: ${location.keyIntersection || 'Not specified'}
Nearby Cities: ${(location.nearbyCities || []).join(', ') || 'Not specified'}
ZIP Codes: ${(location.zipCodes || []).join(', ') || 'Not specified'}
Latitude: ${location.latitude}, Longitude: ${location.longitude}

═══ VERIFIED SOURCE 2: Wikipedia "${wikiData.title || townName}" ═══
${wikiData.found ? wikiData.content : 'No Wikipedia article found for this location.'}

═══ OUTPUT FORMAT ═══
Return ONLY a JSON object (no markdown, no code fences, no explanation) with these exact fields:

{
  "localInsight": "[2-3 sentences about this town's commercial/medical landscape. Reference ONLY facts from the sources. Mention real institutions, neighborhoods, or corridors if they appear in the Wikipedia article.]",
  "medicalDensity": "[Short phrase describing medical/professional office density. Only reference real facilities mentioned in Wikipedia or our data.]",
  "serviceChallenges": "[1-2 sentences about facility management challenges specific to this type of community — multi-tenant buildings, medical compliance, seasonal traffic, etc.]",
  "whyXiri": "[1-2 sentences about XIRI's advantage here. Reference real nearby cities from our data to explain route density.]",
  "complianceNote": "[1-2 sentences about relevant compliance requirements. For medical-heavy areas: OSHA + HIPAA. For commercial: OSHA + local codes. For mixed: appropriate standards.]",
  "facilityTypes": ["5-7 specific facility types based on what actually exists per the sources"],
  "landmarks": ["3-4 real landmark names from EITHER source — do not invent any"],
  "localFaqs": [
    {"question": "Do you currently service facilities in ${townName}?", "answer": "[Specific answer referencing real nearby areas from our data]"},
    {"question": "What types of facilities do you clean in ${townName}?", "answer": "[Answer based on facility types that actually exist per the sources]"},
    {"question": "How quickly can you start service in ${townName}?", "answer": "[Answer mentioning nearby XIRI coverage areas: ${(location.nearbyCities || []).join(', ')}]"},
    {"question": "Do you handle medical office compliance in ${townName}?", "answer": "[Answer about OSHA/HIPAA compliance, tailored to whether the area is medical-heavy or not]"}
  ]
}`;

    const accessToken = getAccessToken();
    const url = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_REGION}/publishers/google/models/gemini-2.0-flash:generateContent`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    maxOutputTokens: 2000,
                },
            }),
        });

        const data = await res.json();

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const errMsg = data.error?.message || 'Unknown error';
            console.error(`  ⚠️  Gemini error for ${townName}: ${errMsg}`);
            return null;
        }

        const rawText = data.candidates[0].content.parts[0].text;

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`  ⚠️  Could not parse JSON from Gemini for ${townName}`);
            return null;
        }

        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error(`  ⚠️  Error for ${townName}: ${e.message}`);
        return null;
    }
}

// ─── Step 3: Main Pipeline ───

async function main() {
    const data = JSON.parse(fs.readFileSync(SEO_PATH, 'utf8'));
    const locations = data.locations || [];

    // Filter to locations that need enrichment
    let toEnrich = locations.filter(loc => {
        if (ONLY) return loc.slug === ONLY;
        if (SKIP_ENRICHED && loc.localInsight && loc.localInsight.length > 150) return false;
        // Skip the 2 original handcrafted ones
        if (['great-neck-ny', 'new-hyde-park-ny'].includes(loc.slug)) return false;
        return true;
    });

    console.log(`\n🔍 Enriching ${toEnrich.length} locations...\n`);

    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < toEnrich.length; i++) {
        const loc = toEnrich[i];
        const townName = loc.name.replace(', NY', '');
        process.stdout.write(`[${i + 1}/${toEnrich.length}] 📍 ${townName}... `);

        // Step 1: Scrape Wikipedia
        const wiki = await scrapeWikipedia(townName);
        process.stdout.write(wiki.found ? `wiki ✓ (${wiki.content.length} chars)... ` : 'wiki ✗... ');

        // Small delay between wiki requests
        await sleep(300);

        // Step 2: Enrich with Gemini
        const enrichment = await enrichWithGemini(loc, wiki);

        if (enrichment) {
            // Merge enrichment into location
            if (enrichment.localInsight) loc.localInsight = enrichment.localInsight;
            if (enrichment.medicalDensity) loc.medicalDensity = enrichment.medicalDensity;
            if (enrichment.serviceChallenges) loc.serviceChallenges = enrichment.serviceChallenges;
            if (enrichment.whyXiri) loc.whyXiri = enrichment.whyXiri;
            if (enrichment.complianceNote) loc.complianceNote = enrichment.complianceNote;
            if (enrichment.facilityTypes?.length) loc.facilityTypes = enrichment.facilityTypes;
            if (enrichment.localFaqs?.length) loc.localFaqs = enrichment.localFaqs;
            if (enrichment.landmarks?.length) loc.landmarks = enrichment.landmarks;

            enriched++;
            console.log('✅');
        } else {
            failed++;
            console.log('❌');
        }

        // Rate limit Gemini: ~1.5 req/s
        await sleep(700);
    }

    console.log(`\n📊 Results: ${enriched} enriched, ${failed} failed, ${locations.length - toEnrich.length} skipped`);

    if (!DRY_RUN) {
        fs.writeFileSync(SEO_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`✅ Written to ${SEO_PATH}\n`);
    } else {
        console.log('🏃 Dry run — no changes written\n');
        if (toEnrich.length > 0 && enriched > 0) {
            const sample = toEnrich.find(l => l.localInsight?.length > 100) || toEnrich[0];
            console.log('Sample enriched location:');
            console.log(JSON.stringify(sample, null, 2));
        }
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
