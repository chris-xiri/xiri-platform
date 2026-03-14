/**
 * NFC Monitoring — Nightly Status Checks + Morning Reports
 *
 * Two scheduled Cloud Functions:
 *   1. checkNightlyStatus — runs every 15 min (6 PM – 1 AM) to detect no-shows/late starts
 *   2. generateMorningReports — runs at 5:30 AM ET to send Green/Amber/Red emails
 *
 * Data flow:
 *   work_orders → nfc_sessions (tonight's data) → morning_reports (log) → Resend email
 *
 * Uses the existing WorkOrder schema from @xiri-facility-solutions/shared:
 *   - schedule.startTime  = agreed start time (e.g. "19:00")
 *   - schedule.daysOfWeek = boolean[7] (Sun–Sat)
 *   - leadId              = linked lead (has clientEmail)
 *   - nfcZones            = zone configuration
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { googleChatWebhookSecret, notifyLateWarning, notifyNoShow, sendText, makeThreadKey } from "../utils/googleChatUtils";
import { sendEmail, sendBatchEmails } from "../utils/emailUtils";
import {
    buildMorningReportHtml,
    buildSubjectLine,
    type MorningReportData,
    type ReportTier,
    type ZoneResult,
    type ReportIssue,
} from "../utils/morningReportEmail";

// ─── Config ──────────────────────────────────────────────────────────

const REPORT_FROM = 'XIRI Facility Solutions <reports@xiri.ai>';
const OPS_EMAIL = 'chris@xiri.ai';
const TIMEZONE = 'America/New_York';

// Fallback defaults — overridden by Firestore settings/monitoring
const FALLBACK_GRACE_MINUTES = 60;
const FALLBACK_NO_SHOW_MINUTES = 120;
const FALLBACK_LATE_REMINDER_INTERVAL = 15;
const FALLBACK_ESCALATION_REMINDER_INTERVAL = 15;

/** Global monitoring settings from Firestore settings/monitoring */
interface MonitoringConfig {
    graceMinutes: number;
    noShowMinutes: number;
    lateReminderIntervalMinutes: number;
    escalationReminderIntervalMinutes: number;
}

/** Load monitoring settings from Firestore, falling back to defaults */
async function loadMonitoringConfig(): Promise<MonitoringConfig> {
    try {
        const snap = await db.collection('settings').doc('monitoring').get();
        if (snap.exists) {
            const data = snap.data()!;
            return {
                graceMinutes: data.graceMinutes ?? FALLBACK_GRACE_MINUTES,
                noShowMinutes: data.noShowMinutes ?? FALLBACK_NO_SHOW_MINUTES,
                lateReminderIntervalMinutes: data.lateReminderIntervalMinutes ?? FALLBACK_LATE_REMINDER_INTERVAL,
                escalationReminderIntervalMinutes: data.escalationReminderIntervalMinutes ?? FALLBACK_ESCALATION_REMINDER_INTERVAL,
            };
        }
    } catch (err) {
        console.error('Failed to load monitoring config, using defaults:', err);
    }
    return {
        graceMinutes: FALLBACK_GRACE_MINUTES,
        noShowMinutes: FALLBACK_NO_SHOW_MINUTES,
        lateReminderIntervalMinutes: FALLBACK_LATE_REMINDER_INTERVAL,
        escalationReminderIntervalMinutes: FALLBACK_ESCALATION_REMINDER_INTERVAL,
    };
}

// ─── Day helpers ─────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Get current day index (0=Sun) in ET */
function getTodayIndex(): number {
    return new Date().toLocaleDateString('en-US', { timeZone: TIMEZONE, weekday: 'short' }) === 'Sun' ? 0
        : DAY_NAMES.indexOf(
            new Date().toLocaleDateString('en-US', { timeZone: TIMEZONE, weekday: 'short' })
        );
}

/** Check if a boolean[7] schedule includes today */
function isScheduledToday(daysOfWeek: boolean[]): boolean {
    return daysOfWeek[getTodayIndex()] === true;
}

/** Check if a boolean[7] schedule included yesterday */
function wasScheduledYesterday(daysOfWeek: boolean[]): boolean {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const idx = DAY_NAMES.indexOf(
        yesterday.toLocaleDateString('en-US', { timeZone: TIMEZONE, weekday: 'short' })
    );
    return daysOfWeek[idx] === true;
}

/** Get a Date object for today at a given HH:MM in ET */
function getTimeToday(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const etStr = now.toLocaleDateString('en-US', { timeZone: TIMEZONE });
    const etDate = new Date(etStr);
    etDate.setHours(h, m, 0, 0);
    return etDate;
}

/** Format a Date to human time like "7:02 PM" */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: TIMEZONE,
    });
}

/** Format a Date to "March 12, 2026" */
function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: TIMEZONE,
    });
}

// ─── Resolved Work Order (hydrated with lead data) ───────────────────

interface ResolvedWorkOrder {
    id: string;
    leadId: string;
    locationName: string;
    buildingId: string;        // nfc_sites locationId (from leadId or work order)
    vendorName: string;
    vendorPhone: string;
    startTime: string;         // "19:00"
    daysOfWeek: boolean[];
    graceMinutes: number;
    noShowMinutes: number;
    clientEmail: string;
    clientName: string;
    opsAlertEmail: string;
    nfcZones: any[];
    status: string;
}

/** Hydrate a work order doc with lead data */
async function resolveWorkOrder(doc: FirebaseFirestore.DocumentSnapshot): Promise<ResolvedWorkOrder | null> {
    const wo = doc.data();
    if (!wo || wo.status !== 'active') return null;

    // Get client email from the linked lead
    let clientEmail = '';
    let clientName = '';
    if (wo.leadId) {
        const leadDoc = await db.collection("leads").doc(wo.leadId).get();
        if (leadDoc.exists) {
            const lead = leadDoc.data()!;
            clientEmail = lead.email || lead.contactEmail || '';
            clientName = lead.contactName || lead.businessName || '';
        }
    }

    // Look up vendor phone number
    let vendorPhone = '';
    const vendorId = wo.assignedVendorId || wo.vendorHistory?.[0]?.vendorId;
    if (vendorId) {
        try {
            const vendorDoc = await db.collection('vendors').doc(vendorId).get();
            if (vendorDoc.exists) {
                vendorPhone = vendorDoc.data()?.phone || '';
            }
        } catch { /* no vendor phone */ }
    }

    // Prefer explicit nfcSiteId → falls back to leadId for older records
    const buildingId = wo.nfcSiteId || wo.locationId || wo.leadId;

    return {
        id: doc.id,
        leadId: wo.leadId,
        locationName: wo.locationName || '',
        buildingId,
        vendorName: wo.vendorHistory?.[0]?.vendorName || 'Unknown Vendor',
        vendorPhone,
        startTime: wo.schedule?.startTime || '19:00',
        daysOfWeek: wo.schedule?.daysOfWeek || [false, true, true, true, true, true, false],
        graceMinutes: wo.monitoringGraceMinutes || 0,  // 0 = use global config
        noShowMinutes: wo.monitoringNoShowMinutes || 0, // 0 = use global config
        clientEmail,
        clientName,
        opsAlertEmail: OPS_EMAIL,
        nfcZones: wo.nfcZones || [],
        status: wo.status,
    };
}

// ─── 1. Nightly Status Check ─────────────────────────────────────────

/**
 * Runs every 15 minutes from 6 PM to midnight ET.
 * Checks for no-shows and late starts on active work orders.
 */
export const checkNightlyStatus = onSchedule({
    schedule: "*/15 18-23 * * *",
    timeZone: TIMEZONE,
    region: "us-central1",
    secrets: [googleChatWebhookSecret],
}, async () => {
    const now = new Date();
    console.log(`🔍 Nightly check @ ${formatTime(now)}`);

    // Load global config from Firestore
    const config = await loadMonitoringConfig();
    console.log(`📋 Config: grace=${config.graceMinutes}m, noShow=${config.noShowMinutes}m, lateReminder=${config.lateReminderIntervalMinutes}m, escalation=${config.escalationReminderIntervalMinutes}m`);

    const woSnap = await db.collection("work_orders")
        .where("status", "==", "active")
        .get();

    if (woSnap.empty) {
        console.log("No active work orders.");
        return;
    }

    for (const woDoc of woSnap.docs) {
        const wo = await resolveWorkOrder(woDoc);
        if (!wo) continue;
        if (!isScheduledToday(wo.daysOfWeek)) continue;

        // Use per-WO overrides or global config
        const graceMin = wo.graceMinutes || config.graceMinutes;
        const noShowMin = wo.noShowMinutes || config.noShowMinutes;

        const agreedStart = getTimeToday(wo.startTime);
        const warningTime = new Date(agreedStart.getTime() + graceMin * 60 * 1000);
        const noShowTime = new Date(agreedStart.getTime() + noShowMin * 60 * 1000);
        const minutesSinceStart = Math.floor((now.getTime() - agreedStart.getTime()) / 60000);

        // Check if there's an NFC session tonight
        const startOfEvening = new Date(agreedStart);
        startOfEvening.setHours(startOfEvening.getHours() - 2);

        const sessionsSnap = await db.collection("nfc_sessions")
            .where("siteLocationId", "==", wo.buildingId)
            .where("createdAt", ">=", startOfEvening)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        if (!sessionsSnap.empty) continue; // Crew checked in — skip

        // Only process if we're past the scheduled start time
        if (minutesSinceStart < 0) continue;

        const threadKey = makeThreadKey(wo.buildingId);

        if (now >= noShowTime) {
            // ── NO-SHOW ──────────────────────────────────────────
            console.log(`🔴 NO-SHOW: ${wo.locationName}`);

            const existing = await db.collection("monitoring_events")
                .where("workOrderId", "==", wo.id)
                .where("type", "==", "no_show")
                .where("detectedAt", ">=", startOfEvening)
                .limit(1)
                .get();

            if (!existing.empty) continue;

            await db.collection("monitoring_events").add({
                workOrderId: wo.id,
                buildingId: wo.buildingId,
                type: "no_show",
                detectedAt: now,
                message: `No NFC check-in. Expected by ${formatTime(agreedStart)}.`,
            });

            await sendEmail(
                wo.opsAlertEmail,
                `🔴 NO-SHOW: ${wo.locationName}`,
                `<p><strong>No NFC check-in</strong> at ${wo.locationName}.</p>
                 <p>Expected: ${formatTime(agreedStart)} | Now: ${formatTime(now)}</p>
                 <p>Vendor: ${wo.vendorName}</p>
                 <p><strong>Action:</strong> Contact crew lead or dispatch backup.</p>`,
                undefined,
                REPORT_FROM,
            );

            notifyNoShow({
                siteLocationId: wo.buildingId,
                locationName: wo.locationName,
                vendorName: wo.vendorName,
                vendorPhone: wo.vendorPhone || undefined,
                expectedTime: formatTime(agreedStart),
                workOrderId: wo.id,
            }).catch(console.error);

        } else if (now >= warningTime) {
            // ── LATE WARNING (grace period expired) ──────────────
            console.log(`⚠️ WARNING: ${wo.locationName} — no check-in yet`);

            const existing = await db.collection("monitoring_events")
                .where("workOrderId", "==", wo.id)
                .where("type", "==", "late_warning")
                .where("detectedAt", ">=", startOfEvening)
                .limit(1)
                .get();

            if (existing.empty) {
                // First time hitting grace — send the card
                await db.collection("monitoring_events").add({
                    workOrderId: wo.id,
                    buildingId: wo.buildingId,
                    type: "late_warning",
                    detectedAt: now,
                    message: `No check-in after ${graceMin}min grace. Expected by ${formatTime(agreedStart)}.`,
                });

                notifyLateWarning({
                    siteLocationId: wo.buildingId,
                    locationName: wo.locationName,
                    expectedTime: formatTime(agreedStart),
                    workOrderId: wo.id,
                    vendorName: wo.vendorName,
                    vendorPhone: wo.vendorPhone || undefined,
                }).catch(console.error);
            }

            // ── ESCALATION REMINDERS (between grace and no-show) ──
            if (config.escalationReminderIntervalMinutes > 0) {
                const minutesSinceGrace = Math.floor((now.getTime() - warningTime.getTime()) / 60000);
                const reminderSlot = Math.floor(minutesSinceGrace / config.escalationReminderIntervalMinutes);
                if (reminderSlot > 0) {
                    const reminderKey = `escalation_${reminderSlot}`;
                    const existingReminder = await db.collection("monitoring_events")
                        .where("workOrderId", "==", wo.id)
                        .where("type", "==", reminderKey)
                        .where("detectedAt", ">=", startOfEvening)
                        .limit(1)
                        .get();

                    if (existingReminder.empty) {
                        await db.collection("monitoring_events").add({
                            workOrderId: wo.id,
                            buildingId: wo.buildingId,
                            type: reminderKey,
                            detectedAt: now,
                            message: `Escalation reminder #${reminderSlot}`,
                        });

                        const minutesLate = minutesSinceStart;
                        sendText(threadKey, `🚨 *Escalation — ${wo.locationName}*\nCrew is now *${minutesLate} min late*. Grace period expired. Consider dispatching backup vendor.`)
                            .catch(console.error);
                        console.log(`🚨 Escalation reminder #${reminderSlot} for ${wo.locationName}`);
                    }
                }
            }

        } else if (now > agreedStart) {
            // ── LATE REMINDERS (between scheduled start and grace) ──
            if (config.lateReminderIntervalMinutes > 0 && minutesSinceStart >= config.lateReminderIntervalMinutes) {
                const reminderSlot = Math.floor(minutesSinceStart / config.lateReminderIntervalMinutes);
                const reminderKey = `late_reminder_${reminderSlot}`;

                const existingReminder = await db.collection("monitoring_events")
                    .where("workOrderId", "==", wo.id)
                    .where("type", "==", reminderKey)
                    .where("detectedAt", ">=", startOfEvening)
                    .limit(1)
                    .get();

                if (existingReminder.empty) {
                    await db.collection("monitoring_events").add({
                        workOrderId: wo.id,
                        buildingId: wo.buildingId,
                        type: reminderKey,
                        detectedAt: now,
                        message: `Late reminder — ${minutesSinceStart}min since start`,
                    });

                    sendText(threadKey, `🔔 *Reminder — ${wo.locationName}*\nCrew hasn't checked in yet. *${minutesSinceStart} min* since scheduled start (${formatTime(agreedStart)}).`)
                        .catch(console.error);
                    console.log(`🔔 Late reminder #${reminderSlot} for ${wo.locationName}`);
                }
            }
        }
    }
});

// ─── 2. Morning Report Generator ─────────────────────────────────────

/**
 * Runs at 5:30 AM ET. Generates Green/Amber/Red morning report for each
 * active work order scheduled last night, then sends ALL reports in one
 * Resend batch API call (up to 100 per batch, avoids rate limits).
 */
export const generateMorningReports = onSchedule({
    schedule: "30 5 * * *",
    timeZone: TIMEZONE,
    region: "us-central1",
}, async () => {
    console.log("📧 Generating morning reports...");

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const config = await loadMonitoringConfig();

    const woSnap = await db.collection("work_orders")
        .where("status", "==", "active")
        .get();

    // Phase 1: Build all reports
    const pendingReports: {
        wo: ResolvedWorkOrder;
        reportData: MorningReportData;
        html: string;
        subject: string;
    }[] = [];

    for (const doc of woSnap.docs) {
        const wo = await resolveWorkOrder(doc);
        if (!wo) continue;
        if (!wasScheduledYesterday(wo.daysOfWeek)) continue;
        if (!wo.clientEmail) {
            console.log(`⏭️ ${wo.locationName}: no client email, skipping`);
            continue;
        }

        try {
            const graceMin = wo.graceMinutes || config.graceMinutes;
            const reportData = await buildReportData(wo, yesterday, graceMin);
            const html = buildMorningReportHtml(reportData);
            const subject = buildSubjectLine(reportData);
            pendingReports.push({ wo, reportData, html, subject });
        } catch (err) {
            console.error(`❌ ${wo.locationName}: failed to build report`, err);
        }
    }

    if (pendingReports.length === 0) {
        console.log("No reports to send.");
        return;
    }

    // Phase 2: Batch send all emails (one API call, up to 100 emails)
    console.log(`📨 Sending ${pendingReports.length} reports via batch API...`);

    const batchPayload = pendingReports.map(r => ({
        to: r.wo.clientEmail,
        subject: r.subject,
        html: r.html,
        from: REPORT_FROM,
        replyTo: OPS_EMAIL,
    }));

    // Resend batch limit is 100. Split into chunks if needed.
    const BATCH_SIZE = 100;
    for (let i = 0; i < batchPayload.length; i += BATCH_SIZE) {
        const chunk = batchPayload.slice(i, i + BATCH_SIZE);
        const result = await sendBatchEmails(chunk);

        if (!result.success) {
            console.error(`❌ Batch ${i / BATCH_SIZE + 1} failed:`, result.error);
        }
    }

    // Phase 3: Log all reports to Firestore
    const batch = db.batch();
    for (const r of pendingReports) {
        const ref = db.collection("morning_reports").doc();
        batch.set(ref, {
            workOrderId: r.wo.id,
            leadId: r.wo.leadId,
            buildingId: r.wo.buildingId,
            locationName: r.wo.locationName,
            clientEmail: r.wo.clientEmail,
            tier: r.reportData.tier,
            subject: r.subject,
            sentAt: new Date(),
            zonesCompleted: r.reportData.zonesCompleted,
            zonesTotal: r.reportData.zonesTotal,
        });
    }
    await batch.commit();

    console.log(`✅ ${pendingReports.length} morning reports sent and logged.`);
});

// ─── Build report data ───────────────────────────────────────────────

async function buildReportData(wo: ResolvedWorkOrder, dateRef: Date, graceMin: number): Promise<MorningReportData> {
    const windowStart = new Date(dateRef);
    windowStart.setHours(16, 0, 0, 0);
    const windowEnd = new Date(dateRef);
    windowEnd.setDate(windowEnd.getDate() + 1);
    windowEnd.setHours(6, 0, 0, 0);

    // Get NFC sessions from last night
    const sessionsSnap = await db.collection("nfc_sessions")
        .where("siteLocationId", "==", wo.buildingId)
        .where("createdAt", ">=", windowStart)
        .where("createdAt", "<=", windowEnd)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

    // Get site config for total zones
    const siteDoc = await db.collection("nfc_sites").doc(wo.buildingId).get();
    const siteData = siteDoc.exists ? siteDoc.data()! : { zones: [] };
    const totalZones = (siteData.zones || []).length;

    // Get monitoring events (query kept for future backup-dispatch detection)
    await db.collection("monitoring_events")
        .where("workOrderId", "==", wo.id)
        .where("detectedAt", ">=", windowStart)
        .where("detectedAt", "<=", windowEnd)
        .get();

    // ── No session = no-show ──
    if (sessionsSnap.empty) {
        return {
            tier: 'red',
            buildingName: wo.locationName,
            reportDate: formatDate(dateRef),
            crewName: 'No crew checked in',
            clockIn: '—',
            clockOut: '—',
            zonesCompleted: 0,
            zonesTotal: totalZones,
            zones: [],
            issues: [{
                type: 'no_show',
                summary: 'No crew checked in last night',
                resolved: false,
                actionNeeded: 'XIRI Ops has been notified and is arranging coverage.',
            }],
        };
    }

    // ── Session exists ──
    const cleanerSessions = sessionsSnap.docs.filter(d => d.data().personRole === 'cleaner');
    const session = cleanerSessions.length > 0 ? cleanerSessions[0].data() : sessionsSnap.docs[0].data();

    const clockIn = session.clockInAt?.toDate?.() || session.clockInAt;
    const clockOut = session.clockOutAt?.toDate?.() || session.clockOutAt;
    const zoneScanResults = session.zoneScanResults || [];

    const zones: ZoneResult[] = (siteData.zones || []).map((siteZone: any) => {
        const scan = zoneScanResults.find((s: any) => s.zoneId === siteZone.id);
        return {
            zoneName: siteZone.name || siteZone.id,
            tasksCompleted: scan ? (scan.tasksCompleted?.length || 0) : 0,
            tasksTotal: (siteZone.tasks || []).length || 1,
            scannedAt: scan?.scannedAt
                ? formatTime(scan.scannedAt?.toDate?.() || new Date(scan.scannedAt))
                : '—',
        };
    });

    const zonesCompleted = zoneScanResults.length;
    const issues: ReportIssue[] = [];

    // Late start?
    const agreedStart = getTimeToday(wo.startTime);
    agreedStart.setDate(dateRef.getDate());
    agreedStart.setMonth(dateRef.getMonth());
    agreedStart.setFullYear(dateRef.getFullYear());

    if (clockIn && new Date(clockIn) > new Date(agreedStart.getTime() + graceMin * 60 * 1000)) {
        const delayMin = Math.round((new Date(clockIn).getTime() - agreedStart.getTime()) / 60000);
        issues.push({
            type: 'late_start',
            summary: `Crew arrived ${delayMin} minutes late (${formatTime(new Date(clockIn))} vs ${formatTime(agreedStart)} agreed)`,
            resolved: zonesCompleted >= totalZones,
        });
    }

    // Partial completion?
    if (zonesCompleted < totalZones && zonesCompleted > 0) {
        const missed = (siteData.zones || [])
            .filter((z: any) => !zoneScanResults.some((s: any) => s.zoneId === z.id))
            .map((z: any) => z.name || z.id);
        issues.push({
            type: 'partial_completion',
            summary: `${zonesCompleted}/${totalZones} zones completed. Missed: ${missed.join(', ')}`,
            resolved: false,
            actionNeeded: 'Were these areas locked or inaccessible? Reply to let us know.',
        });
    }

    // Determine tier
    let tier: ReportTier = 'green';
    if (issues.some(i => !i.resolved)) tier = 'red';
    else if (issues.length > 0) tier = 'amber';

    return {
        tier,
        buildingName: wo.locationName,
        reportDate: formatDate(dateRef),
        crewName: session.personName || 'Unknown',
        clockIn: clockIn ? formatTime(new Date(clockIn)) : '—',
        clockOut: clockOut ? formatTime(new Date(clockOut)) : '—',
        zonesCompleted,
        zonesTotal: totalZones,
        zones,
        issues,
        complianceLogUrl: `https://xiri.ai/c/${wo.buildingId}`,
    };
}

// ─── 3. Manual trigger for testing ───────────────────────────────────

/**
 * onCall: manually trigger a morning report for testing/demos.
 * Input: { workOrderId, recipientEmail?, scenario? }
 */
export const sendTestMorningReport = onCall({
    cors: true,
}, async (request) => {
    const { workOrderId, recipientEmail, scenario } = request.data;

    if (!workOrderId) {
        throw new HttpsError("invalid-argument", "workOrderId is required");
    }

    const woDoc = await db.collection("work_orders").doc(workOrderId).get();
    if (!woDoc.exists) {
        throw new HttpsError("not-found", "Work order not found");
    }

    const wo = await resolveWorkOrder(woDoc);
    if (!wo) {
        throw new HttpsError("failed-precondition", "Work order is not active");
    }

    const config = await loadMonitoringConfig();
    const graceMin = wo.graceMinutes || config.graceMinutes;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reportData = await buildReportData(wo, yesterday, graceMin);

    // Override scenario for testing
    if (scenario === 'green') {
        reportData.tier = 'green';
        reportData.issues = [];
        reportData.zonesCompleted = reportData.zonesTotal;
    } else if (scenario === 'amber') {
        reportData.tier = 'amber';
        reportData.issues = [{
            type: 'late_start',
            summary: 'Crew arrived 45 minutes late. All zones completed.',
            resolved: true,
        }];
    } else if (scenario === 'red') {
        reportData.tier = 'red';
        reportData.issues = [{
            type: 'partial_completion',
            summary: '8/10 zones completed. Server room and executive suite were locked.',
            resolved: false,
            actionNeeded: 'Can you provide key access for the server room and executive suite?',
        }];
    }

    const html = buildMorningReportHtml(reportData);
    const subject = buildSubjectLine(reportData);
    const to = recipientEmail || wo.clientEmail || OPS_EMAIL;

    const result = await sendEmail(to, subject, html, undefined, REPORT_FROM);

    return {
        success: result.success,
        tier: reportData.tier,
        subject,
        sentTo: to,
        resendId: result.resendId,
    };
});
