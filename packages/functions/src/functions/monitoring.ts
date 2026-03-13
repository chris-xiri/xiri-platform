/**
 * NFC Monitoring — Nightly Status Checks + Morning Reports
 *
 * Two scheduled Cloud Functions:
 *   1. checkNightlyStatus — runs every 15 min (6 PM – 1 AM) to detect no-shows/late starts
 *   2. generateMorningReports — runs at 5:30 AM ET to send Green/Amber/Red emails
 *
 * Data flow:
 *   work_orders → nfc_sessions (tonight's data) → morning_reports (log) → Resend email
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { sendEmail } from "../utils/emailUtils";
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

/** Get today's day name in ET */
function getTodayName(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: TIMEZONE });
}

/** Get a Date object for today at a given HH:MM in ET */
function getTimeToday(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    // Create date in ET
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

// ─── Work Order types ────────────────────────────────────────────────

interface WorkOrder {
    id: string;
    buildingId: string;        // → nfc_sites locationId
    vendorId?: string;
    vendorName: string;
    buildingName: string;
    agreedStartTime: string;   // "19:00"
    graceMinutes: number;      // default 30
    noShowMinutes: number;     // default 60
    schedule: string[];        // ["Mon","Tue","Wed","Thu","Fri"]
    clientEmail: string;
    clientName: string;
    opsAlertEmail?: string;
    morningReportTime?: string; // "05:30"
    status: 'active' | 'paused';
}

// ─── 1. Nightly Status Check ─────────────────────────────────────────

/**
 * Runs every 15 minutes from 6 PM to 1 AM ET.
 * Checks for no-shows and late starts on active work orders.
 */
export const checkNightlyStatus = onSchedule({
    schedule: "*/15 18-23 * * *", // Every 15 min, 6 PM - midnight
    timeZone: TIMEZONE,
    region: "us-central1",
}, async () => {
    const today = getTodayName();
    const now = new Date();

    console.log(`🔍 Nightly check @ ${formatTime(now)} (${today})`);

    // Get active work orders scheduled for today
    const woSnap = await db.collection("work_orders")
        .where("status", "==", "active")
        .get();

    if (woSnap.empty) {
        console.log("No active work orders.");
        return;
    }

    for (const doc of woSnap.docs) {
        const wo = { id: doc.id, ...doc.data() } as WorkOrder;

        // Skip if not scheduled for today
        if (!wo.schedule.includes(today)) continue;

        const agreedStart = getTimeToday(wo.agreedStartTime);
        const warningTime = new Date(agreedStart.getTime() + wo.graceMinutes * 60 * 1000);
        const noShowTime = new Date(agreedStart.getTime() + wo.noShowMinutes * 60 * 1000);

        // Check if there's a session tonight
        const startOfEvening = new Date(agreedStart);
        startOfEvening.setHours(startOfEvening.getHours() - 2); // Look 2h before

        const sessionsSnap = await db.collection("nfc_sessions")
            .where("siteLocationId", "==", wo.buildingId)
            .where("createdAt", ">=", startOfEvening)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        const hasSession = !sessionsSnap.empty;

        if (hasSession) {
            // Crew checked in — nothing to alert on
            continue;
        }

        // No session yet — check timing
        if (now >= noShowTime) {
            // 🔴 NO-SHOW
            console.log(`🔴 NO-SHOW: ${wo.buildingName} (expected by ${formatTime(agreedStart)})`);

            // Log event
            await db.collection("monitoring_events").add({
                workOrderId: wo.id,
                buildingId: wo.buildingId,
                buildingName: wo.buildingName,
                type: "no_show",
                detectedAt: now,
                agreedStartTime: wo.agreedStartTime,
                message: `No NFC check-in detected. Expected by ${formatTime(agreedStart)}.`,
            });

            // Alert ops (only once - check if already alerted)
            const existingAlert = await db.collection("monitoring_events")
                .where("workOrderId", "==", wo.id)
                .where("type", "==", "no_show")
                .where("detectedAt", ">=", startOfEvening)
                .limit(2)
                .get();

            if (existingAlert.size <= 1) {
                // First no-show alert — send to ops
                await sendEmail(
                    wo.opsAlertEmail || OPS_EMAIL,
                    `🔴 NO-SHOW: ${wo.buildingName}`,
                    `<p><strong>No NFC check-in detected</strong> at ${wo.buildingName}.</p>
                     <p>Expected start: ${formatTime(agreedStart)}<br>
                     Current time: ${formatTime(now)}</p>
                     <p>Crew: ${wo.vendorName}</p>
                     <p><strong>Action:</strong> Contact the crew lead or dispatch backup.</p>`,
                    undefined,
                    REPORT_FROM,
                );
            }

        } else if (now >= warningTime) {
            // ⚠️ WARNING
            console.log(`⚠️ WARNING: ${wo.buildingName} — no check-in yet (grace expired)`);

            await db.collection("monitoring_events").add({
                workOrderId: wo.id,
                buildingId: wo.buildingId,
                buildingName: wo.buildingName,
                type: "late_warning",
                detectedAt: now,
                agreedStartTime: wo.agreedStartTime,
                message: `No check-in after grace period. Expected by ${formatTime(agreedStart)}.`,
            });
        }
    }
});

// ─── 2. Morning Report Generator ─────────────────────────────────────

/**
 * Runs at 5:30 AM ET. Generates and sends the morning report email
 * for each active work order that was scheduled last night.
 */
export const generateMorningReports = onSchedule({
    schedule: "30 5 * * *", // 5:30 AM every day
    timeZone: TIMEZONE,
    region: "us-central1",
}, async () => {
    console.log("📧 Generating morning reports...");

    // Get yesterday's day name (since we're running at 5:30 AM)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayName = yesterday.toLocaleDateString('en-US', { weekday: 'short', timeZone: TIMEZONE });

    const woSnap = await db.collection("work_orders")
        .where("status", "==", "active")
        .get();

    if (woSnap.empty) {
        console.log("No active work orders.");
        return;
    }

    for (const doc of woSnap.docs) {
        const wo = { id: doc.id, ...doc.data() } as WorkOrder;

        // Skip if not scheduled for yesterday
        if (!wo.schedule.includes(yesterdayName)) continue;

        try {
            const reportData = await buildReportData(wo, yesterday);
            const html = buildMorningReportHtml(reportData);
            const subject = buildSubjectLine(reportData);

            // Send to client
            const result = await sendEmail(
                wo.clientEmail,
                subject,
                html,
                undefined,
                REPORT_FROM,
            );

            // Log the report
            await db.collection("morning_reports").add({
                workOrderId: wo.id,
                buildingId: wo.buildingId,
                buildingName: wo.buildingName,
                clientEmail: wo.clientEmail,
                tier: reportData.tier,
                subject,
                sentAt: new Date(),
                resendId: result.resendId || null,
                reportData: {
                    zonesCompleted: reportData.zonesCompleted,
                    zonesTotal: reportData.zonesTotal,
                    crewName: reportData.crewName,
                    clockIn: reportData.clockIn,
                    clockOut: reportData.clockOut,
                    issues: reportData.issues,
                },
            });

            console.log(`✅ ${wo.buildingName}: ${reportData.tier.toUpperCase()} report sent to ${wo.clientEmail}`);
        } catch (err) {
            console.error(`❌ Failed to generate report for ${wo.buildingName}:`, err);
        }
    }
});

// ─── Build report data from session ──────────────────────────────────

async function buildReportData(wo: WorkOrder, dateRef: Date): Promise<MorningReportData> {
    // Look for sessions from last night (roughly 4 PM yesterday to 6 AM today)
    const windowStart = new Date(dateRef);
    windowStart.setHours(16, 0, 0, 0); // 4 PM yesterday
    const windowEnd = new Date(dateRef);
    windowEnd.setDate(windowEnd.getDate() + 1);
    windowEnd.setHours(6, 0, 0, 0); // 6 AM today

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

    // Get monitoring events from last night
    const eventsSnap = await db.collection("monitoring_events")
        .where("workOrderId", "==", wo.id)
        .where("detectedAt", ">=", windowStart)
        .where("detectedAt", "<=", windowEnd)
        .get();

    const monitoringEvents = eventsSnap.docs.map(d => d.data());

    // ─── No session at all = no-show ────────────────────────────
    if (sessionsSnap.empty) {
        const hasNoShow = monitoringEvents.some(e => e.type === 'no_show');
        return {
            tier: 'red',
            buildingName: wo.buildingName,
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
                actionNeeded: hasNoShow
                    ? 'XIRI Ops has been notified. We are arranging coverage.'
                    : 'Please contact XIRI if this is unexpected.',
            }],
        };
    }

    // ─── Session exists — analyze completeness ──────────────────
    // Use the first cleaner session (most recent)
    const cleanerSessions = sessionsSnap.docs
        .filter(d => d.data().personRole === 'cleaner');
    const session = cleanerSessions.length > 0
        ? cleanerSessions[0].data()
        : sessionsSnap.docs[0].data();

    const clockIn = session.clockInAt?.toDate?.() || session.clockInAt;
    const clockOut = session.clockOutAt?.toDate?.() || session.clockOutAt;
    const zoneScanResults = session.zoneScanResults || [];

    // Build zone results
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

    // Determine issues
    const issues: ReportIssue[] = [];

    // Check for late start
    const agreedStart = getTimeToday(wo.agreedStartTime);
    agreedStart.setDate(dateRef.getDate());
    agreedStart.setMonth(dateRef.getMonth());
    agreedStart.setFullYear(dateRef.getFullYear());

    if (clockIn && new Date(clockIn) > new Date(agreedStart.getTime() + wo.graceMinutes * 60 * 1000)) {
        const delayMinutes = Math.round((new Date(clockIn).getTime() - agreedStart.getTime()) / 60000);
        issues.push({
            type: 'late_start',
            summary: `Crew arrived ${delayMinutes} minutes late (${formatTime(new Date(clockIn))} vs ${formatTime(agreedStart)} agreed)`,
            resolved: zonesCompleted >= totalZones, // Resolved if all zones done
        });
    }

    // Check for backup dispatched
    if (monitoringEvents.some(e => e.type === 'backup_dispatched')) {
        issues.push({
            type: 'backup_dispatched',
            summary: 'Original crew unavailable. Backup crew dispatched.',
            resolved: zonesCompleted >= totalZones,
        });
    }

    // Check for partial completion
    if (zonesCompleted < totalZones && zonesCompleted > 0) {
        const missedZones = (siteData.zones || [])
            .filter((z: any) => !zoneScanResults.some((s: any) => s.zoneId === z.id))
            .map((z: any) => z.name || z.id);

        issues.push({
            type: 'partial_completion',
            summary: `${zonesCompleted}/${totalZones} zones completed. Missed: ${missedZones.join(', ')}`,
            resolved: false,
            actionNeeded: missedZones.length > 0
                ? `Were these areas locked or inaccessible? Reply to let us know.`
                : undefined,
        });
    }

    // ─── Determine tier ─────────────────────────────────────────
    let tier: ReportTier = 'green';
    if (issues.some(i => !i.resolved)) {
        tier = 'red';
    } else if (issues.length > 0) {
        tier = 'amber';
    }

    return {
        tier,
        buildingName: wo.buildingName,
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
 * onCall function to manually trigger a morning report for a specific work order.
 * Used for internal testing and demos.
 *
 * Input: { workOrderId, recipientEmail? }
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

    const wo = { id: woDoc.id, ...woDoc.data() } as WorkOrder;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const reportData = await buildReportData(wo, yesterday);

    // Override scenario if requested
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
    const to = recipientEmail || wo.clientEmail;

    const result = await sendEmail(to, subject, html, undefined, REPORT_FROM);

    return {
        success: result.success,
        tier: reportData.tier,
        subject,
        sentTo: to,
        resendId: result.resendId,
    };
});
