import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ─── Commission Constants ───
const MRR_THRESHOLD = 3000;        // $3K MRR = $36K ACV
const RATE_STANDARD = 0.10;        // 10% for deals ≤ $3K MRR
const RATE_PREMIUM = 0.15;         // 15% for deals > $3K MRR
const FSM_UPSELL_RATE = 0.05;      // 5% of annualized upsell
const CLAWBACK_MONTHS = 6;         // Cancel unpaid payouts within 6 months
const PAYOUT_SPLIT = [50, 25, 25]; // 3-month payout schedule

/**
 * Fires when a Quote's status changes to 'accepted'.
 * Calculates the sales commission and schedules the 3-month payout.
 *
 * Payout clock starts when FIRST INVOICE IS PAID — so we create the
 * commission record as PENDING here, and activate it in onInvoicePaid.
 */
export const onQuoteAccepted = onDocumentUpdated({
    document: "quotes/{quoteId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Guard: only fire when status changes TO 'accepted'
    if (before.status === after.status) return;
    if (after.status !== 'accepted') return;

    const quoteId = event.params.quoteId;
    const leadId = after.leadId;
    const assignedTo = after.assignedTo || after.createdBy;
    const isUpsell = after.isUpsell === true;

    // Calculate MRR and ACV
    const mrr = after.totalMonthlyRate || 0;
    const acv = mrr * 12;

    // Determine commission rate and type
    let rate: number;
    let type: string;

    if (isUpsell) {
        // FSM upsell: 5% of annualized upsell (one-time)
        rate = FSM_UPSELL_RATE;
        type = 'FSM_UPSELL';
    } else {
        // Sales commission: 10% or 15% based on MRR threshold
        rate = mrr > MRR_THRESHOLD ? RATE_PREMIUM : RATE_STANDARD;
        type = 'SALES_NEW';
    }

    const totalCommission = acv * rate;

    // Build payout schedule (payouts start when first invoice is paid)
    const payoutSchedule = PAYOUT_SPLIT.map((pct, month) => ({
        month,
        amount: Math.round((totalCommission * pct / 100) * 100) / 100, // Round to cents
        percentage: pct,
        status: 'PENDING' as const,
        scheduledAt: null, // Will be set when first invoice is paid
    }));

    // For FSM upsells, single payout (100% at once)
    const fsmPayoutSchedule = [{
        month: 0,
        amount: totalCommission,
        percentage: 100,
        status: 'PENDING' as const,
        scheduledAt: null,
    }];

    const now = new Date();
    const clawbackEnd = new Date(now);
    clawbackEnd.setMonth(clawbackEnd.getMonth() + CLAWBACK_MONTHS);

    // Determine staffRole
    const staffRole = isUpsell ? 'fsm' : 'sales';

    // Create commission record
    const commissionRef = await db.collection('commissions').add({
        staffId: assignedTo,
        staffRole,
        quoteId,
        leadId,
        type,
        mrr,
        acv,
        rate,
        totalCommission,
        payoutSchedule: isUpsell ? fsmPayoutSchedule : payoutSchedule,
        clawbackWindowEnd: clawbackEnd,
        status: 'PENDING', // Activates when first invoice is paid
        createdAt: now,
        updatedAt: now,
    });

    // Log to commission ledger
    await db.collection('commission_ledger').add({
        commissionId: commissionRef.id,
        type: 'PAYOUT_SCHEDULED',
        amount: totalCommission,
        staffId: assignedTo,
        description: `${type === 'FSM_UPSELL' ? 'Upsell' : 'New deal'} commission: ${(rate * 100).toFixed(0)}% of $${acv.toLocaleString()} ACV = $${totalCommission.toLocaleString()}`,
        createdAt: now,
    });

    // Log activity
    await db.collection('activity_logs').add({
        type: 'COMMISSION_CREATED',
        quoteId,
        leadId,
        staffId: assignedTo,
        commissionId: commissionRef.id,
        totalCommission,
        rate,
        acv,
        mrr,
        commissionType: type,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[Commission] Created ${type} commission for staff ${assignedTo}: $${totalCommission} (${(rate * 100).toFixed(0)}% of $${acv} ACV) — quote ${quoteId}`);
});


/**
 * Fires when an invoice status changes to 'paid'.
 * If the commission is still PENDING, this activates it and triggers Payout 1 (50%).
 * For subsequent payouts, the scheduled function handles them monthly.
 */
export const onInvoicePaid = onDocumentUpdated({
    document: "invoices/{invoiceId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Guard: only fire when status changes TO 'paid'
    if (before.status === after.status) return;
    if (after.status !== 'paid') return;

    const quoteId = after.quoteId;
    if (!quoteId) return;

    // Find PENDING commissions for this quote
    const commSnap = await db.collection('commissions')
        .where('quoteId', '==', quoteId)
        .where('status', '==', 'PENDING')
        .get();

    if (commSnap.empty) return;

    const now = new Date();

    for (const commDoc of commSnap.docs) {
        const commission = commDoc.data();
        const schedule = [...commission.payoutSchedule];

        // Set payout dates: Month 0 = now, Month 1 = +30 days, Month 2 = +60 days
        schedule.forEach((entry: any, i: number) => {
            const payDate = new Date(now);
            payDate.setDate(payDate.getDate() + (i * 30));
            entry.scheduledAt = payDate;
        });

        // Mark Payout 0 as PAID immediately
        schedule[0].status = 'PAID';
        schedule[0].paidAt = now;

        await commDoc.ref.update({
            status: 'ACTIVE',
            payoutSchedule: schedule,
            updatedAt: now,
        });

        // Log payout
        await db.collection('commission_ledger').add({
            commissionId: commDoc.id,
            type: 'PAYOUT_PAID',
            amount: schedule[0].amount,
            staffId: commission.staffId,
            description: `Payout 1 of ${schedule.length}: $${schedule[0].amount.toFixed(2)} (${schedule[0].percentage}%) — triggered by invoice payment`,
            createdAt: now,
        });

        logger.info(`[Commission] Activated commission ${commDoc.id}: Payout 1 of $${schedule[0].amount} paid`);
    }
});


/**
 * Fires when a Work Order is updated.
 * If a vendorId was just assigned AND the lead hasn't been handed off yet,
 * mark the Sales → FSM handoff on the lead.
 */
export const onWorkOrderHandoff = onDocumentUpdated({
    document: "work_orders/{workOrderId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Guard: only fire when vendorId is newly set
    const hadVendor = before.vendorId && before.vendorId.length > 0;
    const hasVendor = after.vendorId && after.vendorId.length > 0;
    if (hadVendor || !hasVendor) return;

    const leadId = after.leadId;
    const fsmId = after.assignedFsmId || after.createdBy;
    if (!leadId) return;

    // Check if lead already has a handoff
    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) return;

    const leadData = leadDoc.data();
    if (leadData?.handedOffToFsm) return; // Already handed off

    // Mark the handoff
    await db.collection('leads').doc(leadId).update({
        handedOffToFsm: fsmId,
        handoffDate: new Date(),
    });

    await db.collection('activity_logs').add({
        type: 'SALES_TO_FSM_HANDOFF',
        leadId,
        fsmId,
        workOrderId: event.params.workOrderId,
        description: `Account handed off from Sales to FSM (first work order assigned)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[Handoff] Lead ${leadId} handed off to FSM ${fsmId} via work order ${event.params.workOrderId}`);
});


/**
 * Fires when a lead status changes to 'churned'.
 * Cancels any unpaid commission payouts within the 6-month clawback window.
 */
export const onClientCancelled = onDocumentUpdated({
    document: "leads/{leadId}",
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Guard: only fire when status changes TO 'churned'
    if (before.status === after.status) return;
    if (after.status !== 'churned') return;

    const leadId = event.params.leadId;
    const now = new Date();

    // Find active commissions for this lead within clawback window
    const commSnap = await db.collection('commissions')
        .where('leadId', '==', leadId)
        .where('status', 'in', ['PENDING', 'ACTIVE'])
        .get();

    if (commSnap.empty) return;

    for (const commDoc of commSnap.docs) {
        const commission = commDoc.data();

        // Check if still within clawback window
        const clawbackEnd = commission.clawbackWindowEnd?.toDate?.() || commission.clawbackWindowEnd;
        if (!clawbackEnd || now > new Date(clawbackEnd)) {
            logger.info(`[Clawback] Commission ${commDoc.id} past clawback window — no action`);
            continue;
        }

        // Cancel unpaid portions only (already-paid amounts stay)
        const schedule = [...commission.payoutSchedule];
        let cancelledAmount = 0;

        schedule.forEach((entry: any) => {
            if (entry.status === 'PENDING') {
                entry.status = 'CANCELLED';
                cancelledAmount += entry.amount;
            }
        });

        if (cancelledAmount === 0) continue;

        await commDoc.ref.update({
            status: 'PARTIALLY_CANCELLED',
            payoutSchedule: schedule,
            updatedAt: now,
        });

        // Log clawback
        await db.collection('commission_ledger').add({
            commissionId: commDoc.id,
            type: 'CLAWBACK',
            amount: -cancelledAmount,
            staffId: commission.staffId,
            description: `Client churned within clawback window. $${cancelledAmount.toFixed(2)} in unpaid payouts cancelled.`,
            createdAt: now,
        });

        logger.info(`[Clawback] Commission ${commDoc.id}: $${cancelledAmount} in unpaid payouts cancelled (client churn)`);
    }
});
