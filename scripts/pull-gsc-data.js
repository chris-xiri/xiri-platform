/**
 * Google Search Console Data Pull Script
 * 
 * Pulls keyword ranking data from GSC and saves to a JSON file
 * that the /seo-audit workflow can analyze.
 * 
 * SETUP (one-time):
 * 1. Go to Google Cloud Console → APIs & Services → Library
 * 2. Enable "Google Search Console API"
 * 3. Create a Service Account (APIs & Services → Credentials → Create Credentials → Service Account)
 * 4. Generate a JSON key for the service account and save to: scripts/gsc-credentials.json
 * 5. In Google Search Console, add the service account email as a user with "Full" permissions
 *    (Settings → Users and permissions → Add user → paste the client_email from the JSON key)
 * 
 * USAGE:
 *   node scripts/pull-gsc-data.js
 *   node scripts/pull-gsc-data.js --days 28    (last 28 days, default)
 *   node scripts/pull-gsc-data.js --days 90    (last 90 days)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ── Config ──
const SITE_URL = 'https://xiri.ai';  // Your Search Console property
const CREDENTIALS_PATH = path.join(__dirname, 'gsc-credentials.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'seo-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'gsc-rankings.json');

// Parse --days argument
const daysArg = process.argv.find(a => a.startsWith('--days'));
const DAYS = daysArg ? parseInt(daysArg.split('=')[1] || process.argv[process.argv.indexOf('--days') + 1] || '28') : 28;

// ── Target keywords we're tracking ──
const TRACKED_KEYWORDS = [
    // Tier 1: Money Keywords
    'how much should office cleaning cost',
    'how much does medical office cleaning cost',
    'how much does dental office cleaning cost',
    'janitorial cleaning cost calculator',
    'commercial cleaning cost per square foot',
    'how much does gym cleaning cost',
    'how to hire a janitorial company',
    'janitorial cleaning checklist',
    'janitorial cleaning cost',
    'office cleaning cost',
    'commercial cleaning rates',
    'janitorial services cost',
    // Tier 2: Comparison Keywords
    'franchise vs independent cleaning company',
    'in-house vs outsourced janitorial',
    'what to look for in a cleaning company',
    'how often should an office be cleaned',
    'best commercial cleaning company long island',
    'janitorial services nassau county',
    // Tier 3: Local Keywords
    'janitorial services great neck',
    'office cleaning westbury ny',
    'medical office cleaning nassau county',
    'commercial cleaning long island',
    'janitorial services new york',
];

async function main() {
    // Check for credentials
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.error('\n❌ Missing credentials file: scripts/gsc-credentials.json');
        console.error('\nSETUP INSTRUCTIONS:');
        console.error('1. Go to https://console.cloud.google.com/apis/library');
        console.error('2. Enable "Google Search Console API"');
        console.error('3. Create a Service Account (APIs & Services → Credentials)');
        console.error('4. Generate a JSON key and save to: scripts/gsc-credentials.json');
        console.error('5. In GSC, add the service account email as a user');
        console.error('   (Settings → Users and permissions → Add user)\n');
        process.exit(1);
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchConsole = google.searchconsole({ version: 'v1', auth });

    // Date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - DAYS);

    const fmt = d => d.toISOString().split('T')[0];

    console.log(`\n📊 Pulling GSC data for ${SITE_URL}`);
    console.log(`   Date range: ${fmt(startDate)} → ${fmt(endDate)} (${DAYS} days)\n`);

    try {
        // ── Pull ALL keyword data (top 1000) ──
        const allKeywords = await searchConsole.searchanalytics.query({
            siteUrl: SITE_URL,
            requestBody: {
                startDate: fmt(startDate),
                endDate: fmt(endDate),
                dimensions: ['query', 'page'],
                rowLimit: 1000,
                type: 'web',
            },
        });

        // ── Pull TRACKED keyword data specifically ──
        const trackedResults = [];
        for (const keyword of TRACKED_KEYWORDS) {
            try {
                const result = await searchConsole.searchanalytics.query({
                    siteUrl: SITE_URL,
                    requestBody: {
                        startDate: fmt(startDate),
                        endDate: fmt(endDate),
                        dimensions: ['query', 'page'],
                        dimensionFilterGroups: [{
                            filters: [{
                                dimension: 'query',
                                operator: 'contains',
                                expression: keyword,
                            }],
                        }],
                        rowLimit: 10,
                        type: 'web',
                    },
                });
                if (result.data.rows) {
                    trackedResults.push(...result.data.rows.map(row => ({
                        trackedKeyword: keyword,
                        query: row.keys[0],
                        page: row.keys[1],
                        clicks: row.clicks,
                        impressions: row.impressions,
                        ctr: Math.round(row.ctr * 10000) / 100, // e.g., 3.45%
                        position: Math.round(row.position * 10) / 10,
                    })));
                }
            } catch (err) {
                // Silently skip individual keyword failures
            }
        }

        // ── Format output ──
        const output = {
            pulledAt: new Date().toISOString(),
            siteUrl: SITE_URL,
            dateRange: { start: fmt(startDate), end: fmt(endDate), days: DAYS },
            summary: {
                totalKeywords: allKeywords.data.rows?.length || 0,
                trackedKeywords: trackedResults.length,
                totalClicks: allKeywords.data.rows?.reduce((s, r) => s + r.clicks, 0) || 0,
                totalImpressions: allKeywords.data.rows?.reduce((s, r) => s + r.impressions, 0) || 0,
            },
            // Top 50 keywords by impressions
            topKeywords: (allKeywords.data.rows || [])
                .sort((a, b) => b.impressions - a.impressions)
                .slice(0, 50)
                .map(row => ({
                    query: row.keys[0],
                    page: row.keys[1],
                    clicks: row.clicks,
                    impressions: row.impressions,
                    ctr: Math.round(row.ctr * 10000) / 100,
                    position: Math.round(row.position * 10) / 10,
                })),
            // Tracked keyword performance
            trackedKeywords: trackedResults.sort((a, b) => a.position - b.position),
            // Keywords where position > 10 (page 2+) — improvement opportunities  
            improvementOpportunities: (allKeywords.data.rows || [])
                .filter(r => r.position > 10 && r.impressions > 5)
                .sort((a, b) => b.impressions - a.impressions)
                .slice(0, 30)
                .map(row => ({
                    query: row.keys[0],
                    page: row.keys[1],
                    clicks: row.clicks,
                    impressions: row.impressions,
                    position: Math.round(row.position * 10) / 10,
                })),
        };

        // Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // Save with timestamp backup
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        const backupFile = path.join(OUTPUT_DIR, `gsc-rankings-${fmt(endDate)}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(output, null, 2));

        // Print summary
        console.log('✅ Data pulled successfully!\n');
        console.log(`   Total keywords found: ${output.summary.totalKeywords}`);
        console.log(`   Total clicks: ${output.summary.totalClicks}`);
        console.log(`   Total impressions: ${output.summary.totalImpressions}`);
        console.log(`\n   Saved to: ${OUTPUT_FILE}`);
        console.log(`   Backup:   ${backupFile}`);

        // Print top 10
        console.log('\n── Top 10 Keywords by Impressions ──\n');
        console.log('  Pos  │ Clicks │ Impr  │ CTR    │ Query');
        console.log('───────┼────────┼───────┼────────┼──────────────────────────────');
        output.topKeywords.slice(0, 10).forEach(kw => {
            const pos = String(kw.position).padStart(5);
            const clicks = String(kw.clicks).padStart(6);
            const impr = String(kw.impressions).padStart(5);
            const ctr = (kw.ctr + '%').padStart(6);
            console.log(`  ${pos} │ ${clicks} │ ${impr} │ ${ctr} │ ${kw.query.slice(0, 45)}`);
        });

        // Print tracked keywords
        if (trackedResults.length > 0) {
            console.log('\n── Tracked Keyword Rankings ──\n');
            console.log('  Pos  │ Keyword');
            console.log('───────┼──────────────────────────────────────────');
            trackedResults.sort((a, b) => a.position - b.position).forEach(kw => {
                const pos = String(kw.position).padStart(5);
                const icon = kw.position <= 10 ? '🟢' : kw.position <= 30 ? '🟡' : '🔴';
                console.log(`  ${pos} │ ${icon} ${kw.trackedKeyword}`);
            });
        }

        console.log('\n📝 Run /seo-audit in a new conversation to analyze this data.\n');

    } catch (err) {
        console.error('❌ Error pulling GSC data:', err.message);
        if (err.message.includes('403')) {
            console.error('\n   The service account likely doesn\'t have access to this GSC property.');
            console.error('   Add the service account email in GSC → Settings → Users and permissions.\n');
        }
        process.exit(1);
    }
}

main();
