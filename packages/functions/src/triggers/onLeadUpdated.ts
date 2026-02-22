/**
 * Cascade triggers — propagate denormalized field changes across collections.
 *
 * PATTERN: When adding new denormalized fields in the future, add their
 * cascade logic to the appropriate trigger below. Search for "CASCADE POINT"
 * to find where to add new field cascades.
 *
 * onLeadUpdated:   businessName, email, contactName
 * onVendorUpdated: businessName, email
 * onStaffUpdated:  displayName (FSM name, Night Manager name)
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from '../utils/firebase';

/** Helper: returns true if a field changed */
const changed = (before: any, after: any, field: string) =>
    after[field] && before[field] !== after[field];

/* ─── Lead cascade ─────────────────────────────────────────────────── */

export const onLeadUpdated = onDocumentUpdated('leads/{leadId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const leadId = event.params.leadId;

    // Collect all changed fields and their target mappings
    // ── CASCADE POINT: Lead fields ──────────────────────────
    const nameChanged = changed(before, after, 'businessName');
    const emailChanged = changed(before, after, 'email');
    const contactChanged = changed(before, after, 'contactName');

    if (!nameChanged && !emailChanged && !contactChanged) return;

    logger.info(`[Cascade:Lead] ${leadId} — name:${nameChanged} email:${emailChanged} contact:${contactChanged}`);

    const batch = db.batch();
    let count = 0;

    // Quotes — leadBusinessName
    if (nameChanged) {
        const snap = await db.collection('quotes').where('leadId', '==', leadId).get();
        for (const d of snap.docs) { batch.update(d.ref, { leadBusinessName: after.businessName }); count++; }
    }

    // Contracts — clientBusinessName
    if (nameChanged) {
        const snap = await db.collection('contracts').where('leadId', '==', leadId).get();
        for (const d of snap.docs) { batch.update(d.ref, { clientBusinessName: after.businessName }); count++; }
    }

    // Work Orders — businessName + companyName
    if (nameChanged) {
        const snap = await db.collection('work_orders').where('leadId', '==', leadId).get();
        for (const d of snap.docs) { batch.update(d.ref, { businessName: after.businessName, companyName: after.businessName }); count++; }
    }

    // Invoices — clientBusinessName, clientEmail, clientContactName
    {
        const patch: Record<string, any> = {};
        if (nameChanged) patch.clientBusinessName = after.businessName;
        if (emailChanged) patch.clientEmail = after.email;
        if (contactChanged) patch.clientContactName = after.contactName;

        if (Object.keys(patch).length > 0) {
            const snap = await db.collection('invoices').where('leadId', '==', leadId).get();
            for (const d of snap.docs) { batch.update(d.ref, patch); count++; }
        }
    }

    // Site Visits — clientBusinessName
    if (nameChanged) {
        const snap = await db.collection('site_visits').where('leadId', '==', leadId).get();
        for (const d of snap.docs) { batch.update(d.ref, { clientBusinessName: after.businessName }); count++; }
    }

    if (count > 0) {
        await batch.commit();
        logger.info(`[Cascade:Lead] Updated ${count} docs for "${after.businessName}"`);
    }
});

/* ─── Vendor cascade ───────────────────────────────────────────────── */

export const onVendorUpdated = onDocumentUpdated('vendors/{vendorId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const vendorId = event.params.vendorId;

    // ── CASCADE POINT: Vendor fields ────────────────────────
    const nameChanged = changed(before, after, 'businessName');
    const emailChanged = changed(before, after, 'email');

    if (!nameChanged && !emailChanged) return;

    logger.info(`[Cascade:Vendor] ${vendorId} — name:${nameChanged} email:${emailChanged}`);

    const batch = db.batch();
    let count = 0;

    // Vendor Remittances — vendorName, vendorEmail
    {
        const patch: Record<string, any> = {};
        if (nameChanged) patch.vendorName = after.businessName;
        if (emailChanged) patch.vendorEmail = after.email;

        if (Object.keys(patch).length > 0) {
            const snap = await db.collection('vendor_remittances').where('vendorId', '==', vendorId).get();
            for (const d of snap.docs) { batch.update(d.ref, patch); count++; }
        }
    }

    // Work Orders — vendorHistory[].vendorName (array rewrite)
    if (nameChanged) {
        const snap = await db.collection('work_orders').where('assignedVendorId', '==', vendorId).get();
        for (const d of snap.docs) {
            const data = d.data();
            if (data.vendorHistory && Array.isArray(data.vendorHistory)) {
                const updated = data.vendorHistory.map((entry: any) =>
                    entry.vendorId === vendorId ? { ...entry, vendorName: after.businessName } : entry
                );
                batch.update(d.ref, { vendorHistory: updated });
                count++;
            }
        }
    }

    // Check-Ins — vendorName
    if (nameChanged) {
        const snap = await db.collection('check_ins').where('vendorId', '==', vendorId).get();
        for (const d of snap.docs) { batch.update(d.ref, { vendorName: after.businessName }); count++; }
    }

    if (count > 0) {
        await batch.commit();
        logger.info(`[Cascade:Vendor] Updated ${count} docs for "${after.businessName}"`);
    }
});

/* ─── Staff cascade (users) ────────────────────────────────────────── */

export const onStaffUpdated = onDocumentUpdated('users/{userId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const userId = event.params.userId;

    // ── CASCADE POINT: Staff fields ─────────────────────────
    const nameChanged = changed(before, after, 'displayName');
    if (!nameChanged) return;

    const newName = after.displayName;
    const roles: string[] = after.roles || [];

    logger.info(`[Cascade:Staff] ${userId} displayName → "${newName}" (roles: ${roles.join(',')})`);

    const batch = db.batch();
    let count = 0;

    // FSM name → quotes, site_visits
    if (roles.includes('fsm') || roles.includes('admin')) {
        // Quotes — assignedFsmName
        const quotesSnap = await db.collection('quotes').where('assignedFsmId', '==', userId).get();
        for (const d of quotesSnap.docs) { batch.update(d.ref, { assignedFsmName: newName }); count++; }

        // Site Visits — fsmName
        const svSnap = await db.collection('site_visits').where('fsmId', '==', userId).get();
        for (const d of svSnap.docs) { batch.update(d.ref, { fsmName: newName }); count++; }
    }

    // Night Manager name → check_ins, work_orders
    if (roles.includes('night_manager') || roles.includes('night_mgr') || roles.includes('admin')) {
        // Check-Ins — nightManagerName
        const ciSnap = await db.collection('check_ins').where('nightManagerId', '==', userId).get();
        for (const d of ciSnap.docs) { batch.update(d.ref, { nightManagerName: newName }); count++; }

        // Work Orders — assignedNightManagerName
        const woSnap = await db.collection('work_orders').where('assignedNightManagerId', '==', userId).get();
        for (const d of woSnap.docs) { batch.update(d.ref, { assignedNightManagerName: newName }); count++; }
    }

    if (count > 0) {
        await batch.commit();
        logger.info(`[Cascade:Staff] Updated ${count} docs for "${newName}"`);
    }
});
