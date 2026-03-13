/**
 * Test Morning Report — Local Script
 *
 * Generates sample morning report emails for all 3 tiers and either:
 *   1. Sends them to chris+client@xiri.ai via Resend
 *   2. Writes HTML files to /tmp for local preview
 *
 * Usage:
 *   npx tsx packages/functions/src/scripts/test-morning-report.ts
 *   npx tsx packages/functions/src/scripts/test-morning-report.ts --send
 *   npx tsx packages/functions/src/scripts/test-morning-report.ts --html
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Resend } from 'resend';
import {
    buildMorningReportHtml,
    buildSubjectLine,
    type MorningReportData,
} from '../utils/morningReportEmail';

const REPORT_FROM = 'XIRI Facility Solutions <onboarding@xiri.ai>'; // Use onboarding@ until reports@ is set up
const TEST_RECIPIENT = 'chris+client@xiri.ai';

// ─── Sample Data ─────────────────────────────────────────────────────

const BASE_DATA = {
    buildingName: 'Sunrise Medical Center',
    reportDate: 'March 12, 2026',
    crewName: 'Maria R.',
    clockIn: '7:02 PM',
    clockOut: '10:38 PM',
    zonesTotal: 5,
    complianceLogUrl: 'https://xiri.ai/c/loc_sunrise',
};

const SAMPLE_ZONES = [
    { zoneName: 'Lobby & Waiting Room', tasksCompleted: 4, tasksTotal: 4, scannedAt: '7:08 PM' },
    { zoneName: 'Exam Rooms 1-3', tasksCompleted: 6, tasksTotal: 6, scannedAt: '7:41 PM' },
    { zoneName: 'Restrooms', tasksCompleted: 5, tasksTotal: 5, scannedAt: '8:15 PM' },
    { zoneName: 'Break Room', tasksCompleted: 3, tasksTotal: 3, scannedAt: '8:45 PM' },
    { zoneName: 'Administrative Office', tasksCompleted: 3, tasksTotal: 3, scannedAt: '9:12 PM' },
];

const scenarios: Record<string, MorningReportData> = {
    green: {
        ...BASE_DATA,
        tier: 'green',
        zonesCompleted: 5,
        zones: SAMPLE_ZONES,
        issues: [],
    },
    amber: {
        ...BASE_DATA,
        tier: 'amber',
        crewName: 'Carlos T. (backup)',
        clockIn: '8:15 PM',
        clockOut: '11:42 PM',
        zonesCompleted: 5,
        zones: SAMPLE_ZONES.map(z => ({
            ...z,
            // Shift times later to match late start
            scannedAt: z.scannedAt.replace(/7:/, '8:').replace(/8:/, '9:').replace(/9:/, '10:'),
        })),
        issues: [
            {
                type: 'late_start',
                summary: 'Original crew was unavailable. XIRI dispatched backup crew within 30 minutes.',
                resolved: true,
            },
            {
                type: 'backup_dispatched',
                summary: 'Backup crew (Carlos T.) completed all 5 zones. No missed tasks.',
                resolved: true,
            },
        ],
    },
    red: {
        ...BASE_DATA,
        tier: 'red',
        zonesCompleted: 3,
        zones: [
            ...SAMPLE_ZONES.slice(0, 3),
            { zoneName: 'Server Room', tasksCompleted: 0, tasksTotal: 4, scannedAt: '—' },
            { zoneName: 'Executive Suite', tasksCompleted: 0, tasksTotal: 3, scannedAt: '—' },
        ],
        issues: [
            {
                type: 'partial_completion',
                summary: '3/5 zones completed. Server Room and Executive Suite were locked.',
                resolved: false,
                actionNeeded: 'Can you provide key access or arrange after-hours entry? Reply to this email or call (516) 555-0199.',
            },
        ],
    },
};

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const shouldSend = args.includes('--send');
    const shouldWriteHtml = args.includes('--html') || !shouldSend;

    console.log('🧪 Morning Report Test Generator\n');
    console.log(`Mode: ${shouldSend ? '📧 SEND to ' + TEST_RECIPIENT : '💾 HTML files only'}\n`);

    const resend = shouldSend ? new Resend(process.env.RESEND_API_KEY) : null;

    for (const [tierName, data] of Object.entries(scenarios)) {
        const html = buildMorningReportHtml(data);
        const subject = buildSubjectLine(data);

        console.log(`── ${tierName.toUpperCase()} ──`);
        console.log(`  Subject: ${subject}`);
        console.log(`  Zones: ${data.zonesCompleted}/${data.zonesTotal}`);
        console.log(`  Issues: ${data.issues.length}`);

        if (shouldWriteHtml) {
            const outPath = path.join(process.cwd(), `morning-report-${tierName}.html`);
            fs.writeFileSync(outPath, html);
            console.log(`  📄 Saved: ${outPath}`);
        }

        if (shouldSend && resend) {
            try {
                const { data: emailData, error } = await resend.emails.send({
                    from: REPORT_FROM,
                    to: TEST_RECIPIENT,
                    replyTo: 'chris@xiri.ai',
                    subject,
                    html,
                });

                if (error) {
                    console.log(`  ❌ Send failed: ${error.message}`);
                } else {
                    console.log(`  ✅ Sent! Resend ID: ${emailData?.id}`);
                }
            } catch (err: any) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }

        console.log();
    }

    console.log('Done! 🎉');
    if (shouldWriteHtml) {
        console.log('\nOpen the HTML files in a browser to preview the emails.');
        console.log('Run with --send to actually send to ' + TEST_RECIPIENT);
    }
}

main().catch(console.error);
