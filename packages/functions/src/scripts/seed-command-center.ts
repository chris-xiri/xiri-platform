/**
 * Seed Command Center data — 30 days of morning_reports + tonight's nfc_sessions
 *
 * Usage: npx tsx packages/functions/src/scripts/seed-command-center.ts
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Timestamp } from 'firebase-admin/firestore';

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'xiri-facility-solutions-485813' });
}
const db = admin.firestore();

// ── Buildings (matching realistic Long Island names) ──────────────────
const BUILDINGS = [
    { locationName: 'Garden City Medical Plaza',    siteId: 'gcmp_site',   vendorName: 'Maria R.',    zones: ['Lobby', 'Exam Rooms', 'Restrooms', 'Break Room', 'Admin Office'] },
    { locationName: 'Mineola Office Tower',         siteId: 'mot_site',    vendorName: 'Luis G.',     zones: ['Main Floor', 'Restrooms', 'Conference Room'] },
    { locationName: 'Hempstead Auto Center',        siteId: 'hac_site',    vendorName: 'Carlos T.',   zones: ['Showroom', 'Service Bay', 'Restrooms', 'Office'] },
    { locationName: 'Westbury Dental Group',        siteId: 'wdg_site',    vendorName: 'Sandra M.',   zones: ['Reception', 'Treatment Rm 1', 'Treatment Rm 2', 'X-Ray Room', 'Restrooms', 'Staff Break Room'] },
    { locationName: 'Franklin Square Law Office',   siteId: 'fslo_site',   vendorName: 'Ana P.',      zones: ['Reception & Lobby', 'Restrooms', 'Partner Offices', 'Server Room'] },
];

function randomTier(): 'green' | 'amber' | 'red' {
    const r = Math.random();
    if (r < 0.95) return 'green';   // 95% green
    if (r < 0.99) return 'amber';   // 4% amber
    return 'red';                    // 1% red
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedMorningReports() {
    console.log('📊 Seeding morning_reports for 30 days...\n');

    const batch = db.batch();
    let count = 0;
    const now = new Date();

    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
        const reportDate = new Date(now);
        reportDate.setDate(reportDate.getDate() - daysAgo);
        reportDate.setHours(5, 30, 0, 0); // 5:30 AM report time

        // Skip weekends for some buildings (not all operate 7 days)
        const dayOfWeek = reportDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        for (const building of BUILDINGS) {
            // Half the buildings skip weekends
            if (isWeekend && Math.random() < 0.5) continue;

            const tier = randomTier();
            const totalZones = building.zones.length;
            const zonesCompleted = tier === 'green'
                ? totalZones
                : tier === 'amber'
                    ? randomInt(Math.ceil(totalZones * 0.5), totalZones)
                    : randomInt(0, Math.ceil(totalZones * 0.5));

            const subject = tier === 'green'
                ? `✅ ${building.locationName} — All Clear`
                : tier === 'amber'
                    ? `⚠️ ${building.locationName} — Late Start [No Action Needed]`
                    : `🚨 ${building.locationName} — Attention Required`;

            const ref = db.collection('morning_reports').doc();
            batch.set(ref, {
                workOrderId: `wo_${building.siteId}`,
                locationName: building.locationName,
                clientEmail: `chris+${building.siteId}@xiri.ai`,
                tier,
                sentAt: Timestamp.fromDate(reportDate),
                zonesCompleted,
                zonesTotal: totalZones,
                subject,
            });
            count++;
        }
    }

    await batch.commit();
    console.log(`  ✅ Created ${count} morning reports\n`);
}

async function seedTonightSessions() {
    console.log('🌙 Seeding tonight\'s NFC sessions...\n');

    const batch = db.batch();
    const now = new Date();

    // Pick 3 buildings that have "checked in" tonight
    const checkedIn = BUILDINGS.slice(0, 3);

    for (let i = 0; i < checkedIn.length; i++) {
        const building = checkedIn[i];

        // Clock in within the last 1-3 hours
        const clockIn = new Date(now);
        clockIn.setHours(now.getHours() - randomInt(1, 3), randomInt(0, 59), 0, 0);

        // Scan some zones
        const zonesScanned = i === 0
            ? building.zones.length  // Building 1: complete
            : randomInt(1, building.zones.length - 1); // Others: in progress

        const zoneScanResults = building.zones.slice(0, zonesScanned).map((zoneName, j) => {
            const scanTime = new Date(clockIn);
            scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(10, 25));
            return {
                zoneId: `zone_${j}`,
                zoneName,
                scannedAt: Timestamp.fromDate(scanTime),
                tasks: [],
            };
        });

        const clockOut = i === 0 ? Timestamp.fromDate(new Date(clockIn.getTime() + 3 * 60 * 60 * 1000)) : null;

        const ref = db.collection('nfc_sessions').doc();
        batch.set(ref, {
            siteLocationId: building.siteId,
            locationName: building.locationName,
            personName: building.vendorName,
            personRole: 'cleaner',
            clockInAt: Timestamp.fromDate(clockIn),
            ...(clockOut ? { clockOutAt: clockOut } : {}),
            zoneScanResults,
            createdAt: Timestamp.fromDate(clockIn),
        });

        console.log(`  🏢 ${building.locationName} — ${zonesScanned}/${building.zones.length} zones, clock-in ${clockIn.toLocaleTimeString()}`);
    }

    // Buildings 4 & 5 have no session (for "waiting" / "late" / "no-show" display)
    console.log(`  🏢 ${BUILDINGS[3].locationName} — no session (should show as waiting/late)`);
    console.log(`  🏢 ${BUILDINGS[4].locationName} — no session (should show as waiting/late)`);

    await batch.commit();
    console.log(`\n  ✅ Created ${checkedIn.length} tonight sessions\n`);
}

async function main() {
    console.log('🚀 Command Center Data Seed\n');
    console.log('═'.repeat(50));

    await seedMorningReports();
    await seedTonightSessions();

    console.log('═'.repeat(50));
    console.log('🎉 Done! Refresh the Command Center to see data.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
