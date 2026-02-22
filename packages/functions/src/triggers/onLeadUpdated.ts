/**
 * Cascade triggers — propagate denormalized field changes across collections.
 * 
 * onLeadUpdated: lead.businessName → quotes, contracts, work_orders, invoices
 * onVendorUpdated: vendor.businessName → work_orders (vendorHistory), vendor_remittances
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from '../utils/firebase';

/* ─── Lead: businessName cascade ───────────────────────────────────── */

export const onLeadUpdated = onDocumentUpdated('leads/{leadId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const leadId = event.params.leadId;
    const oldName = before.businessName;
    const newName = after.businessName;

    if (!newName || oldName === newName) return;

    logger.info(`[Cascade] Lead ${leadId} businessName: "${oldName}" → "${newName}"`);

    const batch = db.batch();
    let count = 0;

    // Quotes — leadBusinessName
    const quotesSnap = await db.collection('quotes').where('leadId', '==', leadId).get();
    for (const d of quotesSnap.docs) { batch.update(d.ref, { leadBusinessName: newName }); count++; }

    // Contracts — clientName
    const contractsSnap = await db.collection('contracts').where('leadId', '==', leadId).get();
    for (const d of contractsSnap.docs) { batch.update(d.ref, { clientName: newName }); count++; }

    // Work Orders — businessName + companyName
    const woSnap = await db.collection('work_orders').where('leadId', '==', leadId).get();
    for (const d of woSnap.docs) { batch.update(d.ref, { businessName: newName, companyName: newName }); count++; }

    // Invoices — clientName
    const invSnap = await db.collection('invoices').where('leadId', '==', leadId).get();
    for (const d of invSnap.docs) { batch.update(d.ref, { clientName: newName }); count++; }

    if (count > 0) {
        await batch.commit();
        logger.info(`[Cascade] Updated ${count} docs for lead "${newName}"`);
    }
});

/* ─── Vendor: businessName cascade ─────────────────────────────────── */

export const onVendorUpdated = onDocumentUpdated('vendors/{vendorId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const vendorId = event.params.vendorId;
    const oldName = before.businessName;
    const newName = after.businessName;

    if (!newName || oldName === newName) return;

    logger.info(`[Cascade] Vendor ${vendorId} businessName: "${oldName}" → "${newName}"`);

    const batch = db.batch();
    let count = 0;

    // Vendor Remittances — vendorName
    const remSnap = await db.collection('vendor_remittances').where('vendorId', '==', vendorId).get();
    for (const d of remSnap.docs) { batch.update(d.ref, { vendorName: newName }); count++; }

    // Work Orders — update vendorName in vendorHistory array entries
    // Note: vendorHistory is an array with objects containing vendorName.
    // Firestore can't update nested array items atomically, so we update the full array.
    const woSnap = await db.collection('work_orders').where('assignedVendorId', '==', vendorId).get();
    for (const d of woSnap.docs) {
        const data = d.data();
        if (data.vendorHistory && Array.isArray(data.vendorHistory)) {
            const updated = data.vendorHistory.map((entry: any) =>
                entry.vendorId === vendorId ? { ...entry, vendorName: newName } : entry
            );
            batch.update(d.ref, { vendorHistory: updated });
            count++;
        }
    }

    if (count > 0) {
        await batch.commit();
        logger.info(`[Cascade] Updated ${count} docs for vendor "${newName}"`);
    }
});
