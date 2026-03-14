/**
 * Test Batch Send — 5 unique emails in one API call
 *
 * Usage: npx tsx packages/functions/src/scripts/test-batch-send.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Resend } from 'resend';
import { buildMorningReportHtml, buildSubjectLine, type MorningReportData } from '../utils/morningReportEmail';

const REPORT_FROM = 'XIRI Facility Solutions <onboarding@xiri.ai>';

// 5 different buildings, different tiers, different data — all to plus-tagged addresses
const scenarios: { tag: string; data: MorningReportData }[] = [
    {
        tag: 'client-building1',
        data: {
            tier: 'green', buildingName: 'Garden City Medical Plaza', reportDate: 'March 12, 2026',
            crewName: 'Maria R.', clockIn: '7:02 PM', clockOut: '10:38 PM',
            zonesCompleted: 5, zonesTotal: 5,
            zones: [
                { zoneName: 'Lobby', tasksCompleted: 3, tasksTotal: 3, scannedAt: '7:08 PM' },
                { zoneName: 'Exam Rooms', tasksCompleted: 5, tasksTotal: 5, scannedAt: '7:41 PM' },
                { zoneName: 'Restrooms', tasksCompleted: 4, tasksTotal: 4, scannedAt: '8:15 PM' },
                { zoneName: 'Break Room', tasksCompleted: 3, tasksTotal: 3, scannedAt: '8:45 PM' },
                { zoneName: 'Admin Office', tasksCompleted: 3, tasksTotal: 3, scannedAt: '9:12 PM' },
            ],
            issues: [],
        },
    },
    {
        tag: 'client-building2',
        data: {
            tier: 'green', buildingName: 'Mineola Office Tower', reportDate: 'March 12, 2026',
            crewName: 'Luis G.', clockIn: '6:55 PM', clockOut: '9:30 PM',
            zonesCompleted: 3, zonesTotal: 3,
            zones: [
                { zoneName: 'Main Floor', tasksCompleted: 6, tasksTotal: 6, scannedAt: '7:00 PM' },
                { zoneName: 'Restrooms', tasksCompleted: 4, tasksTotal: 4, scannedAt: '7:45 PM' },
                { zoneName: 'Conference Room', tasksCompleted: 3, tasksTotal: 3, scannedAt: '8:20 PM' },
            ],
            issues: [],
        },
    },
    {
        tag: 'client-building3',
        data: {
            tier: 'amber', buildingName: 'Hempstead Auto Center', reportDate: 'March 12, 2026',
            crewName: 'Carlos T. (backup)', clockIn: '9:15 PM', clockOut: '12:30 AM',
            zonesCompleted: 4, zonesTotal: 4,
            zones: [
                { zoneName: 'Showroom', tasksCompleted: 5, tasksTotal: 5, scannedAt: '9:20 PM' },
                { zoneName: 'Service Bay', tasksCompleted: 3, tasksTotal: 3, scannedAt: '10:00 PM' },
                { zoneName: 'Restrooms', tasksCompleted: 4, tasksTotal: 4, scannedAt: '10:40 PM' },
                { zoneName: 'Office', tasksCompleted: 3, tasksTotal: 3, scannedAt: '11:15 PM' },
            ],
            issues: [
                { type: 'late_start', summary: 'Original crew unavailable. Backup dispatched within 30 min.', resolved: true },
            ],
        },
    },
    {
        tag: 'client-building4',
        data: {
            tier: 'amber', buildingName: 'Westbury Dental Group', reportDate: 'March 12, 2026',
            crewName: 'Sandra M.', clockIn: '7:45 PM', clockOut: '10:10 PM',
            zonesCompleted: 6, zonesTotal: 6,
            zones: [
                { zoneName: 'Reception', tasksCompleted: 3, tasksTotal: 3, scannedAt: '7:50 PM' },
                { zoneName: 'Treatment Room 1', tasksCompleted: 5, tasksTotal: 5, scannedAt: '8:10 PM' },
                { zoneName: 'Treatment Room 2', tasksCompleted: 5, tasksTotal: 5, scannedAt: '8:30 PM' },
                { zoneName: 'X-Ray Room', tasksCompleted: 3, tasksTotal: 3, scannedAt: '8:50 PM' },
                { zoneName: 'Restrooms', tasksCompleted: 4, tasksTotal: 4, scannedAt: '9:10 PM' },
                { zoneName: 'Staff Break Room', tasksCompleted: 2, tasksTotal: 2, scannedAt: '9:30 PM' },
            ],
            issues: [
                { type: 'late_start', summary: 'Crew arrived 45 minutes late but completed all zones.', resolved: true },
            ],
        },
    },
    {
        tag: 'client-building5',
        data: {
            tier: 'red', buildingName: 'Franklin Square Law Office', reportDate: 'March 12, 2026',
            crewName: 'Maria R.', clockIn: '7:02 PM', clockOut: '9:30 PM',
            zonesCompleted: 2, zonesTotal: 4,
            zones: [
                { zoneName: 'Reception & Lobby', tasksCompleted: 4, tasksTotal: 4, scannedAt: '7:10 PM' },
                { zoneName: 'Restrooms', tasksCompleted: 3, tasksTotal: 3, scannedAt: '7:40 PM' },
                { zoneName: 'Partner Offices', tasksCompleted: 0, tasksTotal: 5, scannedAt: '\u2014' },
                { zoneName: 'Server Room', tasksCompleted: 0, tasksTotal: 3, scannedAt: '\u2014' },
            ],
            issues: [
                { type: 'partial_completion', summary: '2/4 zones completed. Partner offices and server room were locked.',
                  resolved: false, actionNeeded: 'Can you provide after-hours key access? Reply to this email.' },
            ],
        },
    },
];

async function main() {
    console.log('🧪 Batch Send Test — 5 unique emails in one API call\n');

    const resend = new Resend(process.env.RESEND_API_KEY);

    const payload = scenarios.map(s => ({
        from: REPORT_FROM,
        to: `chris+${s.tag}@xiri.ai`,
        replyTo: 'chris@xiri.ai',
        subject: buildSubjectLine(s.data),
        html: buildMorningReportHtml(s.data),
    }));

    console.log('Emails in batch:');
    payload.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.to} — ${p.subject}`);
    });
    console.log();

    const { data, error } = await resend.batch.send(payload);

    if (error) {
        console.error('❌ Batch failed:', error);
    } else {
        console.log('✅ Batch sent!');
        console.log('Response:', JSON.stringify(data, null, 2));
    }
}

main().catch(console.error);
