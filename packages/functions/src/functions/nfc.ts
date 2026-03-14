/**
 * NFC Site Key Validation Cloud Function
 *
 * Handles:
 * - validateSiteKey: Validates a site key password, creates a session, returns session token
 * - updateZoneScan: Records a zone scan within an active session
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import * as crypto from "crypto";
import {
    googleChatWebhookSecret,
    notifyShiftStarted,
    notifyManagerClockIn,
    notifyZoneScanned,
    notifyAllZonesDone,
    notifyManagerAuditZone,
    notifyCleanerClockOut,
    notifyShiftVerified,
} from "../utils/googleChatUtils";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Hash a site key using SHA-256 (fast, deterministic — good for lookup) */
function hashSiteKey(plainKey: string): string {
    return crypto.createHash("sha256").update(plainKey).digest("hex");
}

/** Generate a session token */
function generateSessionToken(): string {
    return crypto.randomUUID();
}

/**
 * Called from the public site when a cleaner/NM taps the Start tag.
 *
 * Input: { locationId, siteKey, personName }
 * - locationId: from the NFC tag URL
 * - siteKey: the secret password entered by the user
 * - personName: the cleaner/NM's name
 *
 * Role auto-detection:
 * - If key matches siteKeyHash → role = 'cleaner'
 * - If key matches managerKeyHash ({SITEKEY}-AUDIT) → role = 'night_manager'
 *
 * Returns: { sessionId, locationName, vendorName, zones, expiresAt, personRole }
 * Or throws if the key is invalid/revoked.
 */
export const validateSiteKey = onCall({
    cors: DASHBOARD_CORS,
    secrets: [googleChatWebhookSecret],
}, async (request) => {
    const { locationId, siteKey, personName, personPhone } = request.data;

    // Validate input
    if (!locationId || typeof locationId !== "string") {
        throw new HttpsError("invalid-argument", "locationId is required");
    }
    if (!siteKey || typeof siteKey !== "string") {
        throw new HttpsError("invalid-argument", "Site key is required");
    }
    if (!personName || typeof personName !== "string" || personName.trim().length === 0) {
        throw new HttpsError("invalid-argument", "Name is required");
    }

    // Look up the site config
    const siteDoc = await db.collection("nfc_sites").doc(locationId).get();
    if (!siteDoc.exists) {
        throw new HttpsError("not-found", "Location not found. Check with your supervisor.");
    }

    const siteData = siteDoc.data()!;

    // Check if site key has been revoked
    if (siteData.revokedAt) {
        throw new HttpsError("permission-denied", "Access has been revoked. Contact your supervisor for a new site key.");
    }

    // Auto-detect role by checking against both keys
    const hashedInput = hashSiteKey(siteKey.trim());
    let personRole: "cleaner" | "night_manager";

    if (hashedInput === siteData.siteKeyHash) {
        personRole = "cleaner";
    } else if (siteData.managerKeyHash && hashedInput === siteData.managerKeyHash) {
        personRole = "night_manager";
    } else {
        throw new HttpsError("permission-denied", "Invalid site key. Please check and try again.");
    }

    // Create a new session
    const sessionId = generateSessionToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

    await db.collection("nfc_sessions").doc(sessionId).set({
        id: sessionId,
        siteLocationId: locationId,
        locationName: siteData.locationName,
        personName: personName.trim(),
        personPhone: personPhone?.trim() || null,
        personRole,
        clockInAt: new Date(),
        clockOutAt: null,
        zoneScanResults: [],
        auditScore: null,
        auditNotes: null,
        deviceFingerprint: request.data.deviceFingerprint || null,
        expiresAt,
        createdAt: new Date(),
    });

    // ── Google Chat notification (fire-and-forget) ──
    const workOrderId = siteData.workOrderId || null;
    if (personRole === 'cleaner') {
        notifyShiftStarted({
            siteLocationId: locationId,
            locationName: siteData.locationName,
            crewName: personName.trim(),
            crewPhone: personPhone?.trim() || null,
            workOrderId,
        }).catch(console.error);
    } else {
        notifyManagerClockIn({
            siteLocationId: locationId,
            locationName: siteData.locationName,
            managerName: personName.trim(),
        });
    }

    // Return session info (no sensitive data like siteKeyHash)
    return {
        sessionId,
        personRole,
        locationName: siteData.locationName,
        vendorName: siteData.vendorName,
        bidFrequency: siteData.bidFrequency || null,
        daysOfWeek: siteData.daysOfWeek || null,
        zones: (siteData.zones || []).map((z: any) => ({
            id: z.id,
            name: z.name,
            tagId: z.tagId,
            tagLocationHint: z.tagLocationHint || null,
            roomTypeNames: z.roomIds || z.roomTypeNames || [],
            tasks: z.tasks || [],
        })),
        expiresAt: expiresAt.toISOString(),
    };
});

// ─── updateZoneScan ──────────────────────────────────────────────────

/**
 * Called from the public site when a cleaner/NM scans a zone tag.
 *
 * Input: { sessionId, zoneId, zoneName, tasksCompleted }
 *
 * Returns: { success: true, zonesRemaining }
 */
export const updateZoneScan = onCall({
    cors: DASHBOARD_CORS,
    secrets: [googleChatWebhookSecret],
}, async (request) => {
    const { sessionId, zoneId, zoneName, tasksCompleted } = request.data;

    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (!zoneId || typeof zoneId !== "string") {
        throw new HttpsError("invalid-argument", "zoneId is required");
    }

    // Look up the session
    const sessionDoc = await db.collection("nfc_sessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Session not found. Please tap the Start tag again.");
    }

    const sessionData = sessionDoc.data()!;

    // Check if session has expired
    const expiresAt = sessionData.expiresAt?.toDate?.() || sessionData.expiresAt;
    if (expiresAt && new Date() > new Date(expiresAt)) {
        throw new HttpsError("permission-denied", "Session expired. Please tap the Start tag to clock in again.");
    }

    // Add the zone scan result
    const scanResult = {
        zoneId,
        zoneName: zoneName || zoneId,
        scannedAt: new Date(),
        tasksCompleted: tasksCompleted || [],
    };

    const existingResults = sessionData.zoneScanResults || [];
    // Update or add the zone scan
    const existingIndex = existingResults.findIndex((r: any) => r.zoneId === zoneId);
    if (existingIndex >= 0) {
        existingResults[existingIndex] = scanResult;
    } else {
        existingResults.push(scanResult);
    }

    await db.collection("nfc_sessions").doc(sessionId).update({
        zoneScanResults: existingResults,
    });

    // Store task-level feedback for cross-role visibility
    // Manager notes → shown to cleaner; Cleaner notes → shown to manager
    // All notes persist in nfc_sessions for FM dashboard reports
    const personRole = request.data.personRole;
    if (sessionData.siteLocationId) {
        const taskNotes: Record<string, any> = {};
        for (const task of (tasksCompleted || [])) {
            taskNotes[task.taskId] = {
                taskName: task.taskName,
                auditStatus: task.auditStatus || null,
                note: task.note || null,
                photo: task.photo || null,
                completed: task.completed ?? false,
            };
        }
        if (Object.keys(taskNotes).length > 0 || request.data.auditNotes) {
            // Store under role-specific key so each role sees the other's feedback
            const feedbackDocId = `${zoneId}_${personRole}`;
            await db.collection("nfc_sites").doc(sessionData.siteLocationId)
                .collection("audit_feedback").doc(feedbackDocId).set({
                    zoneId,
                    personRole,
                    tasks: taskNotes,
                    submittedAt: new Date(),
                    scanStartedAt: request.data.scanStartedAt || null,
                    auditNotes: request.data.auditNotes || null,
                    sessionId,
                });
        }
    }

    // Check how many zones remain
    const siteDoc = await db.collection("nfc_sites").doc(sessionData.siteLocationId).get();
    const totalZones = siteDoc.exists ? (siteDoc.data()!.zones || []).length : 0;
    const scannedZones = existingResults.length;

    // ── Google Chat notification (fire-and-forget) ──
    const isManager = sessionData.personRole === 'night_manager';
    if (isManager) {
        notifyManagerAuditZone({
            siteLocationId: sessionData.siteLocationId,
            zoneName: zoneName || zoneId,
            zonesCompleted: scannedZones,
            zonesTotal: totalZones,
        });
    } else {
        notifyZoneScanned({
            siteLocationId: sessionData.siteLocationId,
            zoneName: zoneName || zoneId,
            zonesCompleted: scannedZones,
            zonesTotal: totalZones,
        });
    }

    if (scannedZones >= totalZones && !isManager) {
        notifyAllZonesDone({
            siteLocationId: sessionData.siteLocationId,
            locationName: sessionData.locationName,
        });
    }

    return {
        success: true,
        zonesCompleted: scannedZones,
        zonesTotal: totalZones,
        allZonesDone: scannedZones >= totalZones,
    };
});

// ─── completeSession ─────────────────────────────────────────────────

/**
 * Called when all zones are done and the user submits their audit.
 *
 * Input: { sessionId, auditScore, auditNotes }
 */
export const completeNfcSession = onCall({
    cors: DASHBOARD_CORS,
    secrets: [googleChatWebhookSecret],
}, async (request) => {
    const { sessionId, auditScore, auditNotes } = request.data;

    if (!sessionId) {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }

    const sessionDoc = await db.collection("nfc_sessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Session not found.");
    }

    await db.collection("nfc_sessions").doc(sessionId).update({
        clockOutAt: new Date(),
        auditScore: auditScore || null,
        auditNotes: auditNotes || null,
    });

    // ── Google Chat notification (fire-and-forget) ──
    const sessionData = sessionDoc.data()!;
    if (sessionData.personRole === 'night_manager') {
        // Look up workOrderId from nfc_sites
        const siteDoc = await db.collection("nfc_sites").doc(sessionData.siteLocationId).get();
        const workOrderId = siteDoc.exists ? (siteDoc.data()?.workOrderId || null) : null;
        notifyShiftVerified({
            siteLocationId: sessionData.siteLocationId,
            locationName: sessionData.locationName,
            managerName: sessionData.personName,
            auditScore: auditScore || undefined,
            workOrderId,
        }).catch(console.error);
    } else {
        notifyCleanerClockOut({
            siteLocationId: sessionData.siteLocationId,
            locationName: sessionData.locationName,
            crewName: sessionData.personName,
        });
    }

    return { success: true, message: "Session completed. Thank you!" };
});

// ─── getComplianceLog ────────────────────────────────────────────────

/** Helper to get initials from a full name */
function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2) || "?";
}

/**
 * Public compliance log — returns recent cleaning/audit sessions for a location.
 * Names are sanitized to initials only for privacy.
 *
 * Input: { locationId }
 * Returns: { locationName, vendorName, sessions[], summary }
 */
export const getComplianceLog = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const { locationId } = request.data;

    if (!locationId || typeof locationId !== "string") {
        throw new HttpsError("invalid-argument", "locationId is required");
    }

    // Get site info
    const siteDoc = await db.collection("nfc_sites").doc(locationId).get();
    if (!siteDoc.exists) {
        throw new HttpsError("not-found", "Location not found.");
    }
    const siteData = siteDoc.data()!;

    // Query recent sessions (last 30 days) — requires composite index on siteLocationId + createdAt
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionsSnap = await db.collection("nfc_sessions")
        .where("siteLocationId", "==", locationId)
        .where("createdAt", ">=", thirtyDaysAgo)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

    // Build sanitized session list
    let totalZonesCompleted = 0;
    let totalZonesExpected = 0;

    const sessions = sessionsSnap.docs
        .filter(d => {
            const role = d.data().personRole;
            return role === "cleaner" || role === "night_manager";
        })
        .map(d => {
            const data = d.data();
            const zones = data.zoneScanResults || [];
            const totalSiteZones = (siteData.zones || []).length;

            totalZonesCompleted += zones.length;
            totalZonesExpected += totalSiteZones;

            return {
                initials: getInitials(data.personName || "Unknown"),
                role: data.personRole,
                clockInAt: data.clockInAt?.toDate?.()?.toISOString() || null,
                clockOutAt: data.clockOutAt?.toDate?.()?.toISOString() || null,
                zonesCompleted: zones.length,
                zonesTotal: totalSiteZones,
                zones: zones.map((z: any) => ({
                    zoneName: z.zoneName || z.zoneId,
                    scannedAt: z.scannedAt?.toDate?.()?.toISOString() || null,
                    tasks: (z.tasksCompleted || []).map((t: any) => ({
                        name: t.taskName,
                        completed: t.completed,
                        hasPhoto: !!t.photo,
                    })),
                })),
            };
        });

    return {
        locationName: siteData.locationName,
        vendorName: siteData.vendorName,
        totalZones: (siteData.zones || []).length,
        sessions,
        summary: {
            totalSessions: sessions.filter(s => s.role === "cleaner").length,
            totalAudits: sessions.filter(s => s.role === "night_manager").length,
            completionRate: totalZonesExpected > 0
                ? Math.round((totalZonesCompleted / totalZonesExpected) * 100)
                : 0,
        },
    };
});
