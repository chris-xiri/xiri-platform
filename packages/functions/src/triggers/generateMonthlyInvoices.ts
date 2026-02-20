import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Runs on the 1st of every month at 6:00 AM EST.
 * 
 * For each active contract:
 * 1. Gathers completed work orders from the previous month
 * 2. Creates a consolidated draft invoice
 * 3. Logs to activity_logs
 * 
 * Invoices are created as 'draft' — Accounting reviews, then marks as 'sent'.
 */
export const generateMonthlyInvoices = onSchedule({
    schedule: "0 6 1 * *", // 6 AM on 1st of every month
    timeZone: "America/New_York",
}, async () => {
    logger.info("[MonthlyInvoices] Starting monthly invoice generation...");

    // Calculate billing period (previous full month)
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1); // 1st of prev month

    const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Find all active contracts
    const contractsSnap = await db.collection('contracts')
        .where('status', '==', 'active')
        .get();

    if (contractsSnap.empty) {
        logger.info("[MonthlyInvoices] No active contracts found. Done.");
        return;
    }

    let invoicesCreated = 0;
    let invoicesSkipped = 0;

    for (const contractDoc of contractsSnap.docs) {
        const contract = contractDoc.data();
        const contractId = contractDoc.id;
        const leadId = contract.leadId;
        const clientName = contract.clientName || contract.businessName || 'Client';
        const clientEmail = contract.contactEmail || contract.clientEmail || '';

        // Find completed work orders for this contract in the billing period
        let workOrdersQuery = db.collection('work_orders')
            .where('status', '==', 'completed');

        // Link WOs to contract via leadId or contractId
        if (contract.leadId) {
            workOrdersQuery = workOrdersQuery.where('leadId', '==', contract.leadId);
        }

        const woSnap = await workOrdersQuery.get();

        // Filter to previous month's completions
        const periodWOs = woSnap.docs.filter(doc => {
            const woData = doc.data();
            const completedAt = woData.completedAt?.toDate?.() || woData.completedAt;
            if (!completedAt) return false;
            const d = new Date(completedAt);
            return d >= periodStart && d <= periodEnd;
        });

        if (periodWOs.length === 0) {
            invoicesSkipped++;
            continue;
        }

        // Build line items from work orders
        const lineItems = periodWOs.map(woDoc => {
            const wo = woDoc.data();
            return {
                workOrderId: woDoc.id,
                locationName: wo.locationName || wo.location || 'Service Location',
                serviceType: wo.serviceType || wo.type || 'Facility Maintenance',
                description: wo.description || '',
                rate: wo.rate || wo.amount || 0,
            };
        });

        // Use monthlyRate from contract if available, otherwise sum work orders
        const totalAmount = contract.monthlyRate || contract.totalMonthlyRate ||
            lineItems.reduce((sum, li) => sum + li.rate, 0);

        // Create draft invoice
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30); // Net 30

        const invoiceRef = await db.collection('invoices').add({
            contractId,
            leadId: leadId || null,
            clientName,
            clientEmail,
            lineItems,
            totalAmount,
            billingPeriod: {
                start: periodStart.toISOString().split('T')[0],
                end: periodEnd.toISOString().split('T')[0],
                label: periodLabel,
            },
            workOrderCount: periodWOs.length,
            status: 'draft',
            dueDate,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log activity
        await db.collection('activity_logs').add({
            type: 'INVOICE_AUTO_GENERATED',
            invoiceId: invoiceRef.id,
            contractId,
            leadId: leadId || null,
            clientName,
            totalAmount,
            billingPeriod: periodLabel,
            workOrderCount: periodWOs.length,
            description: `Auto-generated draft invoice for ${clientName}: $${totalAmount.toLocaleString()} (${periodLabel}, ${periodWOs.length} work orders)`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        invoicesCreated++;
        logger.info(`[MonthlyInvoices] Created invoice ${invoiceRef.id} for ${clientName}: $${totalAmount} (${periodWOs.length} WOs)`);
    }

    logger.info(`[MonthlyInvoices] Complete: ${invoicesCreated} invoices created, ${invoicesSkipped} contracts skipped (no completed WOs)`);
});
