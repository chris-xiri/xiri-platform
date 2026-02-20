import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const FAIL_THRESHOLD = 70; // Score below this = failed audit
const SUSPENSION_THRESHOLD = 3; // Auto-suspend after this many failures
const INTERNAL_NOTIFY_EMAIL = "chris@xiri.ai";

/**
 * Fires when a new audit is created.
 * If the overall score is below the threshold, triggers escalation.
 *
 * Actions:
 * 1. Flag the work order as needs_remediation
 * 2. Create a remediation work order
 * 3. Increment vendor failedAuditCount
 * 4. Email FSM about failed audit
 * 5. If vendor hits 3+ failures → auto-suspend + notify
 * 6. Log to activity_logs
 */
export const onAuditFailed = onDocumentCreated({
    document: "audits/{auditId}",
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const auditId = event.params.auditId;

    const overallScore = data.overallScore ?? data.score ?? 100;

    // Only fire for failing audits
    if (overallScore >= FAIL_THRESHOLD) return;

    const workOrderId = data.workOrderId;
    const vendorId = data.vendorId;
    const locationName = data.locationName || data.location || 'Unknown Location';
    const clientName = data.clientName || data.businessName || '';

    logger.info(`[AuditFailed] Audit ${auditId} scored ${overallScore}% (threshold: ${FAIL_THRESHOLD}%)`);

    // ─── 1. Flag work order ──────────────────────────────────────────────

    if (workOrderId) {
        await db.collection('work_orders').doc(workOrderId).update({
            status: 'needs_remediation',
            failedAuditId: auditId,
            failedAuditScore: overallScore,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // ─── 2. Create remediation work order ────────────────────────────────

    let remediationId: string | null = null;
    if (workOrderId) {
        // Fetch original work order to copy details
        const woDoc = await db.collection('work_orders').doc(workOrderId).get();
        const woData = woDoc.exists ? woDoc.data() : null;

        const remRef = await db.collection('work_orders').add({
            type: 'remediation',
            originalWorkOrderId: workOrderId,
            auditId,
            leadId: woData?.leadId || data.leadId || null,
            vendorId: vendorId || null,
            assignedFsmId: woData?.assignedFsmId || null,
            locationName,
            description: `Remediation required: Audit scored ${overallScore}% at ${locationName}. Issues: ${data.failureNotes || data.notes || 'See audit report.'}`,
            status: 'pending',
            priority: 'high',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        remediationId = remRef.id;
    }

    // ─── 3. Increment vendor failure count ───────────────────────────────

    let vendorFailCount = 0;
    let vendorName = 'Unknown Vendor';
    let vendorSuspended = false;

    if (vendorId) {
        const vendorRef = db.collection('vendors').doc(vendorId);
        const vendorDoc = await vendorRef.get();

        if (vendorDoc.exists) {
            const vendorData = vendorDoc.data()!;
            vendorName = vendorData.businessName || vendorData.name || vendorName;
            vendorFailCount = (vendorData.failedAuditCount || 0) + 1;

            const updateData: Record<string, any> = {
                failedAuditCount: vendorFailCount,
                lastFailedAuditId: auditId,
                lastFailedAuditDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // ─── 5. Auto-suspend if threshold reached ────────────────
            if (vendorFailCount >= SUSPENSION_THRESHOLD) {
                updateData.status = 'suspended';
                updateData.suspensionReason = `Auto-suspended after ${vendorFailCount} failed audits`;
                vendorSuspended = true;
            }

            await vendorRef.update(updateData);
        }
    }

    // ─── 4. Email FSM ────────────────────────────────────────────────────

    // Find FSM email — check work order assignedFsmId or fall back to internal
    let fsmEmail = INTERNAL_NOTIFY_EMAIL;
    if (workOrderId) {
        const woDoc = await db.collection('work_orders').doc(workOrderId).get();
        const fsmId = woDoc.data()?.assignedFsmId;
        if (fsmId) {
            const fsmDoc = await db.collection('users').doc(fsmId).get();
            fsmEmail = fsmDoc.data()?.email || INTERNAL_NOTIFY_EMAIL;
        }
    }

    await db.collection('mail_queue').add({
        to: fsmEmail,
        subject: `⚠️ Audit Failed: ${locationName} — ${overallScore}%`,
        templateType: 'audit_failed',
        templateData: {
            html: buildAuditFailedEmail({
                locationName,
                clientName,
                overallScore,
                vendorName,
                failureNotes: data.failureNotes || data.notes || 'See audit details in dashboard.',
                remediationId,
                auditId,
            }),
        },
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ─── 5b. Notify about vendor suspension ──────────────────────────────

    if (vendorSuspended) {
        await db.collection('mail_queue').add({
            to: INTERNAL_NOTIFY_EMAIL,
            subject: `🚫 Vendor Suspended: ${vendorName} (${vendorFailCount} failed audits)`,
            templateType: 'vendor_suspended',
            templateData: {
                html: `
                <div style="font-family: -apple-system, sans-serif; padding: 24px;">
                    <h2 style="color: #dc2626;">🚫 Vendor Auto-Suspended</h2>
                    <p><strong>${vendorName}</strong> has been automatically suspended after <strong>${vendorFailCount}</strong> failed audits.</p>
                    <p>Last failure: ${locationName} — Score: ${overallScore}%</p>
                    <p>Action required: Review vendor and decide whether to reinstate or terminate.</p>
                    <a href="https://app.xiri.ai/supply/crm/${vendorId}" style="display: inline-block; background: #dc2626; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">View Vendor →</a>
                </div>`,
            },
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    // ─── 6. Activity log ─────────────────────────────────────────────────

    await db.collection('activity_logs').add({
        type: 'AUDIT_FAILED',
        auditId,
        workOrderId: workOrderId || null,
        vendorId: vendorId || null,
        remediationWorkOrderId: remediationId,
        overallScore,
        vendorFailCount,
        vendorSuspended,
        description: `Audit failed at ${locationName} (${overallScore}%). Vendor: ${vendorName}. ${vendorSuspended ? 'VENDOR AUTO-SUSPENDED.' : ''}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[AuditFailed] Escalation complete: audit ${auditId}, score ${overallScore}%, vendor ${vendorName} (failures: ${vendorFailCount})${vendorSuspended ? ' — SUSPENDED' : ''}`);
});


// ─── Email Builder ────────────────────────────────────────────────────

function buildAuditFailedEmail(data: {
    locationName: string;
    clientName: string;
    overallScore: number;
    vendorName: string;
    failureNotes: string;
    remediationId: string | null;
    auditId: string;
}): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⚠️ Audit Failed</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${data.locationName}</p>
    </div>

    <div style="padding: 32px 24px;">
      <!-- Score -->
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <p style="color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Overall Score</p>
        <p style="color: #dc2626; font-size: 36px; font-weight: 700; margin: 0;">${data.overallScore}%</p>
      </div>

      <table style="width: 100%; font-size: 14px; color: #374151; margin-bottom: 20px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Client:</td><td style="padding: 6px 0; font-weight: 500;">${data.clientName || 'N/A'}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Vendor:</td><td style="padding: 6px 0; font-weight: 500;">${data.vendorName}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Issues:</td><td style="padding: 6px 0;">${data.failureNotes}</td></tr>
      </table>

      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        A <strong>remediation work order</strong> has been auto-created. Please review and assign a follow-up.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://app.xiri.ai/operations/audits" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Dashboard →</a>
      </div>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions • <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
