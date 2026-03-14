'use client';

import { useState } from 'react';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BUILDINGS = [
    { locationName: 'Garden City Medical Plaza',  siteId: 'gcmp_site', vendorName: 'Maria R.',  zones: ['Lobby', 'Exam Rooms', 'Restrooms', 'Break Room', 'Admin Office'] },
    { locationName: 'Mineola Office Tower',       siteId: 'mot_site',  vendorName: 'Luis G.',   zones: ['Main Floor', 'Restrooms', 'Conference Room'] },
    { locationName: 'Hempstead Auto Center',      siteId: 'hac_site',  vendorName: 'Carlos T.', zones: ['Showroom', 'Service Bay', 'Restrooms', 'Office'] },
    { locationName: 'Westbury Dental Group',      siteId: 'wdg_site',  vendorName: 'Sandra M.', zones: ['Reception', 'Treatment Rm 1', 'Treatment Rm 2', 'X-Ray Room', 'Restrooms', 'Staff Break Room'] },
    { locationName: 'Franklin Square Law Office', siteId: 'fslo_site', vendorName: 'Ana P.',    zones: ['Reception & Lobby', 'Restrooms', 'Partner Offices', 'Server Room'] },
];

const VENDOR_PHONES: Record<string, string> = {
    'Maria R.': '(516) 555-0101',
    'Luis G.': '(516) 555-0102',
    'Carlos T.': '(516) 555-0103',
    'Sandra M.': '(516) 555-0104',
    'Ana P.': '(516) 555-0105',
};

function randomTier(): 'green' | 'amber' | 'red' {
    const r = Math.random();
    if (r < 0.95) return 'green';
    if (r < 0.99) return 'amber';
    return 'red';
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime12(hour24: number, minute: number): string {
    // Handle minute overflow
    const totalMin = hour24 * 60 + minute;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function SeedCommandCenterPage() {
    const [log, setLog] = useState<string[]>([]);
    const [running, setRunning] = useState(false);

    const addLog = (msg: string) => setLog(prev => [...prev, msg]);

    const seedData = async () => {
        setRunning(true);
        setLog([]);
        addLog('🚀 Starting Command Center data seed...');

        try {
            // ── Morning Reports (30 days) ──
            addLog('📊 Seeding morning_reports for 30 days...');
            const now = new Date();
            let reportCount = 0;

            for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
                const reportDate = new Date(now);
                reportDate.setDate(reportDate.getDate() - daysAgo);
                reportDate.setHours(5, 30, 0, 0);

                const dayOfWeek = reportDate.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                for (const building of BUILDINGS) {
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

                    // Generate zone-level detail
                    const clockInHour = tier === 'amber' ? randomInt(20, 21) : randomInt(18, 19);
                    const clockInMin = randomInt(0, 59);
                    const clockIn = formatTime12(clockInHour, clockInMin);
                    const clockOutHour = clockInHour + randomInt(2, 4);
                    const clockOutMin = randomInt(0, 59);
                    const clockOut = tier === 'red' && Math.random() < 0.5
                        ? null
                        : formatTime12(clockOutHour, clockOutMin);

                    const zones = building.zones.map((zoneName, zi) => {
                        const completed = zi < zonesCompleted;
                        const tasksTotal = randomInt(3, 6);
                        const scanMinOffset = (zi + 1) * randomInt(12, 18);
                        return {
                            zoneName,
                            tasksCompleted: completed ? tasksTotal : 0,
                            tasksTotal,
                            scannedAt: completed
                                ? formatTime12(clockInHour, clockInMin + scanMinOffset)
                                : null,
                        };
                    });

                    // Generate realistic issues
                    const AMBER_ISSUES = [
                        { type: 'late_start', summary: 'Original crew unavailable. Backup dispatched within 30 min.', resolved: true },
                        { type: 'late_start', summary: 'Crew arrived 45 min late due to traffic. All zones completed.', resolved: true },
                        { type: 'late_start', summary: 'Key access delay at front desk. Building mgr contacted.', resolved: true },
                    ];
                    const RED_ISSUES = [
                        { type: 'partial_completion', summary: '2 zones inaccessible — offices were locked.', resolved: false, actionNeeded: 'Can you provide after-hours key access? Reply to this email.' },
                        { type: 'no_show', summary: 'Crew did not arrive. Emergency backup deployed for next night.', resolved: false, actionNeeded: 'We are investigating and will follow up by EOD.' },
                        { type: 'partial_completion', summary: 'Equipment malfunction — floor polisher broke mid-shift.', resolved: false, actionNeeded: 'Replacement scheduled for tomorrow night.' },
                    ];

                    const issues = tier === 'green' ? [] :
                        tier === 'amber' ? [AMBER_ISSUES[randomInt(0, AMBER_ISSUES.length - 1)]] :
                            [RED_ISSUES[randomInt(0, RED_ISSUES.length - 1)]];

                    const id = `mr_${building.siteId}_${daysAgo}`;
                    await setDoc(doc(db, 'morning_reports', id), {
                        workOrderId: `wo_${building.siteId}`,
                        locationName: building.locationName,
                        clientEmail: `chris+${building.siteId}@xiri.ai`,
                        tier,
                        sentAt: Timestamp.fromDate(reportDate),
                        zonesCompleted,
                        zonesTotal: totalZones,
                        subject,
                        crewName: building.vendorName,
                        clockIn,
                        clockOut,
                        zones,
                        issues,
                    });
                    reportCount++;
                }
            }
            addLog(`  ✅ Created ${reportCount} morning reports`);

            // ── Tonight: Work Orders + NFC Sites + Sessions ──
            addLog('🌙 Seeding tonight\'s work orders, NFC sites, and sessions...');

            // 9 buildings covering every status + night manager scenarios
            const TONIGHT_SCENARIOS = [
                {
                    ...BUILDINGS[0], startTime: '15:00',
                    scenario: 'verified', // All zones done, night manager approved ✅
                },
                {
                    locationName: 'Levittown Community Center', siteId: 'lcc_site', vendorName: 'Rachel W.',
                    zones: ['Main Hall', 'Kitchen', 'Restrooms', 'Office'],
                    startTime: '15:00',
                    scenario: 'flagged', // All zones done but night manager found issues ⚠️
                },
                {
                    locationName: 'Syosset Dance Studio', siteId: 'sds_site', vendorName: 'Jenny L.',
                    zones: ['Studio A', 'Studio B', 'Lobby', 'Restrooms', 'Break Room'],
                    startTime: '15:00',
                    scenario: 'pending_review', // All zones done, no manager review yet
                },
                {
                    ...BUILDINGS[1], startTime: '16:00',
                    scenario: 'in_progress', // Clocked in, scanning zones
                },
                {
                    ...BUILDINGS[2], startTime: '16:00',
                    scenario: 'on_site', // Clocked in, 0 zones tapped
                },
                {
                    ...BUILDINGS[3], startTime: '14:00',
                    scenario: 'incomplete', // Session expired — past 2× estimate
                },
                {
                    locationName: 'Bethpage Medical Arts', siteId: 'bma_site', vendorName: 'Tom H.',
                    zones: ['Waiting Room', 'Exam 1', 'Exam 2', 'Lab', 'Restrooms', 'Admin'],
                    startTime: '14:00',
                    scenario: 'running_over', // Past 1.5× estimate, zones still missing
                },
                {
                    ...BUILDINGS[4], startTime: '15:30',
                    scenario: 'late', // No session, 1hr+ past start
                },
                {
                    locationName: 'Floral Park Veterinary', siteId: 'fpv_site', vendorName: 'David K.',
                    zones: ['Waiting Room', 'Exam Room 1', 'Exam Room 2', 'Surgery Suite', 'Kennel Area'],
                    startTime: '13:00',
                    scenario: 'no_show', // No session, 3hr+ past start
                },
                {
                    locationName: 'New Hyde Park Accounting', siteId: 'nhpa_site', vendorName: 'Kelly S.',
                    zones: ['Lobby', 'Open Office', 'Conference Room', 'Restrooms'],
                    startTime: '20:00',
                    scenario: 'waiting', // Not started yet
                },
            ];

            for (const s of TONIGHT_SCENARIOS) {
                // Create Work Order
                const woId = `wo_${s.siteId}`;
                const allDays = [true, true, true, true, true, true, true];
                await setDoc(doc(db, 'work_orders', woId), {
                    locationName: s.locationName,
                    locationId: s.siteId,
                    nfcSiteId: s.siteId,
                    status: 'active',
                    serviceType: 'Janitorial',
                    schedule: {
                        startTime: s.startTime,
                        daysOfWeek: allDays,
                        frequency: 'daily',
                    },
                    monitoringGraceMinutes: 60,
                    monitoringNoShowMinutes: 120,
                    vendorHistory: [{ vendorName: s.vendorName, assignedAt: Timestamp.fromDate(new Date()) }],
                    leadId: s.siteId,
                    createdAt: Timestamp.fromDate(new Date()),
                });

                // Create NFC Site
                await setDoc(doc(db, 'nfc_sites', s.siteId), {
                    locationName: s.locationName,
                    vendorName: s.vendorName,
                    workOrderId: woId,
                    estimatedCleanMinutes: s.zones.length * 25,
                    zones: s.zones.map((name, i) => ({
                        id: `zone_${i}`,
                        name,
                        tasks: Array.from({ length: randomInt(3, 5) }, (_, ti) => ({
                            id: `task_${i}_${ti}`,
                            name: ['Vacuum', 'Mop', 'Wipe surfaces', 'Empty trash', 'Sanitize', 'Dust'][ti % 6],
                        })),
                    })),
                    createdAt: Timestamp.fromDate(new Date()),
                });

                // Create NFC Session based on scenario
                if (s.scenario === 'verified') {
                    // Cleaner session — all zones done
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 5), 0, 0);
                    const clockOut = new Date(clockIn.getTime() + randomInt(2, 3) * 3600000);

                    const zoneScanResults = s.zones.map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(12, 20));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        clockOutAt: Timestamp.fromDate(clockOut),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });

                    // Night manager session — separate doc, all zones inspected, high score
                    const mgrClockIn = new Date(clockOut.getTime() + randomInt(15, 45) * 60000);
                    const mgrClockOut = new Date(mgrClockIn.getTime() + randomInt(20, 40) * 60000);
                    const mgrZoneScans = s.zones.map((zoneName, j) => {
                        const scanTime = new Date(mgrClockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(3, 8));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasksCompleted: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_night_manager_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: 'Mike D.',
                        personRole: 'night_manager',
                        clockInAt: Timestamp.fromDate(mgrClockIn),
                        clockOutAt: Timestamp.fromDate(mgrClockOut),
                        zoneScanResults: mgrZoneScans,
                        auditScore: 5,
                        auditNotes: null,
                        createdAt: Timestamp.fromDate(mgrClockIn),
                    });
                    // Seed per-zone audit_feedback for verified scenario (all zones good)
                    for (let j = 0; j < s.zones.length; j++) {
                        const zoneId = `zone_${j}`;
                        const site = s;
                        const zoneTasks: Record<string, any> = {};
                        for (let ti = 0; ti < randomInt(3, 5); ti++) {
                            zoneTasks[`task_${j}_${ti}`] = {
                                taskName: ['Vacuum', 'Mop', 'Wipe surfaces', 'Empty trash', 'Sanitize', 'Dust'][ti % 6],
                                auditStatus: 'good',
                                note: null,
                                photo: null,
                                completed: true,
                            };
                        }
                        await setDoc(doc(db, 'nfc_sites', site.siteId, 'audit_feedback', `${zoneId}_night_manager`), {
                            zoneId,
                            personRole: 'night_manager',
                            tasks: zoneTasks,
                            submittedAt: Timestamp.fromDate(mgrZoneScans[j]?.scannedAt?.toDate?.() || new Date()),
                            auditNotes: null,
                            sessionId: `session_night_manager_tonight_${site.siteId}`,
                        });
                    }
                    addLog(`  ✅ ${s.locationName} — VERIFIED (cleaner done + manager audit score 5)`);

                } else if (s.scenario === 'flagged') {
                    // Cleaner session — all zones done
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 5), 0, 0);
                    const clockOut = new Date(clockIn.getTime() + randomInt(2, 3) * 3600000);

                    const zoneScanResults = s.zones.map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(12, 20));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        clockOutAt: Timestamp.fromDate(clockOut),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });

                    // Night manager session — low score + notes = flagged
                    const mgrClockIn = new Date(clockOut.getTime() + randomInt(15, 45) * 60000);
                    const mgrClockOut = new Date(mgrClockIn.getTime() + randomInt(20, 40) * 60000);
                    const mgrZoneScans = s.zones.map((zoneName, j) => {
                        const scanTime = new Date(mgrClockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(3, 8));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasksCompleted: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_night_manager_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: 'Mike D.',
                        personRole: 'night_manager',
                        clockInAt: Timestamp.fromDate(mgrClockIn),
                        clockOutAt: Timestamp.fromDate(mgrClockOut),
                        zoneScanResults: mgrZoneScans,
                        auditScore: 2,
                        auditNotes: 'Kitchen floor still has sticky residue near sink. Restroom paper towel dispenser jammed (facilities issue).',
                        createdAt: Timestamp.fromDate(mgrClockIn),
                    });
                    // Seed per-zone audit_feedback for flagged scenario (mixed ratings)
                    const auditStatuses: ('good' | 'acceptable' | 'unacceptable')[] = ['good', 'unacceptable', 'acceptable', 'good'];
                    const auditNotesPerZone = [
                        null,
                        'Kitchen floor still has sticky residue near sink.',
                        'Paper towel dispenser needs refill — facilities issue.',
                        null,
                    ];
                    for (let j = 0; j < s.zones.length; j++) {
                        const zoneId = `zone_${j}`;
                        const zoneTasks: Record<string, any> = {};
                        for (let ti = 0; ti < randomInt(3, 5); ti++) {
                            zoneTasks[`task_${j}_${ti}`] = {
                                taskName: ['Vacuum', 'Mop', 'Wipe surfaces', 'Empty trash', 'Sanitize', 'Dust'][ti % 6],
                                auditStatus: auditStatuses[j % auditStatuses.length],
                                note: ti === 0 ? (auditNotesPerZone[j % auditNotesPerZone.length] || null) : null,
                                photo: null,
                                completed: true,
                            };
                        }
                        await setDoc(doc(db, 'nfc_sites', s.siteId, 'audit_feedback', `${zoneId}_night_manager`), {
                            zoneId,
                            personRole: 'night_manager',
                            tasks: zoneTasks,
                            submittedAt: Timestamp.fromDate(mgrZoneScans[j]?.scannedAt?.toDate?.() || new Date()),
                            auditNotes: auditNotesPerZone[j % auditNotesPerZone.length] || null,
                            sessionId: `session_night_manager_tonight_${s.siteId}`,
                        });
                    }
                    addLog(`  ⚠️ ${s.locationName} — FLAGGED (cleaner done + manager audit score 2)`);

                } else if (s.scenario === 'pending_review') {
                    // All zones done, no manager review yet
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 5), 0, 0);
                    const clockOut = new Date(clockIn.getTime() + randomInt(2, 3) * 3600000);

                    const zoneScanResults = s.zones.map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(12, 20));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        clockOutAt: Timestamp.fromDate(clockOut),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });
                    addLog(`  🟣 ${s.locationName} — PENDING REVIEW (${s.zones.length}/${s.zones.length} zones, awaiting manager)`);

                } else if (s.scenario === 'in_progress') {
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 10), 0, 0);

                    const zonesScanned = randomInt(1, Math.max(1, s.zones.length - 1));
                    const zoneScanResults = s.zones.slice(0, zonesScanned).map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(10, 20));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });
                    addLog(`  🔵 ${s.locationName} — IN PROGRESS (${zonesScanned}/${s.zones.length} zones)`);

                } else if (s.scenario === 'on_site') {
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 10), 0, 0);

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        zoneScanResults: [],
                        createdAt: Timestamp.fromDate(clockIn),
                    });
                    addLog(`  🟦 ${s.locationName} — ON SITE (clocked in, 0 zones tapped)`);

                } else if (s.scenario === 'incomplete') {
                    // Clocked out with missing zones
                    const clockIn = new Date(now);
                    const [h] = s.startTime.split(':').map(Number);
                    clockIn.setHours(h, randomInt(0, 5), 0, 0);
                    const clockOut = new Date(clockIn.getTime() + 2 * 3600000);

                    const zonesScanned = Math.min(2, s.zones.length);
                    const zoneScanResults = s.zones.slice(0, zonesScanned).map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * 20);
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        clockOutAt: Timestamp.fromDate(clockOut),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });
                    addLog(`  🟠 ${s.locationName} — INCOMPLETE (${zonesScanned}/${s.zones.length} zones, clocked out)`);

                } else if (s.scenario === 'running_over') {
                    // Clocked in ~1.75× est ago, some zones scanned, still no clock-out
                    const estMin = s.zones.length * 25;
                    const clockIn = new Date(now.getTime() - Math.round(estMin * 1.75) * 60000);

                    const zonesScanned = Math.min(3, s.zones.length - 1);
                    const zoneScanResults = s.zones.slice(0, zonesScanned).map((zoneName, j) => {
                        const scanTime = new Date(clockIn);
                        scanTime.setMinutes(scanTime.getMinutes() + (j + 1) * randomInt(15, 25));
                        return { zoneId: `zone_${j}`, zoneName, scannedAt: Timestamp.fromDate(scanTime), tasks: [] };
                    });

                    await setDoc(doc(db, 'nfc_sessions', `session_cleaner_tonight_${s.siteId}`), {
                        siteLocationId: s.siteId,
                        locationName: s.locationName,
                        personName: s.vendorName,
                        personPhone: VENDOR_PHONES[s.vendorName] || null,
                        personRole: 'cleaner',
                        clockInAt: Timestamp.fromDate(clockIn),
                        zoneScanResults,
                        createdAt: Timestamp.fromDate(clockIn),
                    });
                    addLog(`  🟡 ${s.locationName} — RUNNING OVER (${zonesScanned}/${s.zones.length} zones, 1.75× est time elapsed)`);

                } else {
                    // late, no_show, waiting — no session
                    const emoji = s.scenario === 'late' ? '🟡' : s.scenario === 'no_show' ? '🔴' : '⚪';
                    addLog(`  ${emoji} ${s.locationName} — ${s.scenario.toUpperCase().replace('_', '-')} (scheduled ${s.startTime}, no session)`);
                }
            }

            addLog('');
            addLog('🎉 Done! Navigate to /operations/command-center to see results.');

        } catch (err: any) {
            addLog(`❌ Error: ${err.message}`);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Seed Command Center Data</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Creates 30 days of morning reports (95% green, 4% amber, 1% red) and 3 tonight NFC sessions.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={seedData} disabled={running} size="lg" className="w-full">
                        {running ? 'Seeding...' : '🌱 Seed Data'}
                    </Button>

                    {log.length > 0 && (
                        <pre className="bg-muted rounded-lg p-4 text-xs font-mono max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                            {log.join('\n')}
                        </pre>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
