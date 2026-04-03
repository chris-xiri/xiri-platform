import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { cancelVendorTasks, cancelLeadTasks } from "../utils/queueUtils";
import { COMPANY_NAME, COMPANY_ADDRESS, SERVICE_AREA } from "../utils/emailUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Unified Unsubscribe Handler
 * 
 * HTTP endpoint that handles unsubscribe requests for both vendors AND leads.
 * Called when a recipient clicks the unsubscribe link in their email.
 * 
 * GET /handleUnsubscribe?id=xxx&type=vendor
 * GET /handleUnsubscribe?id=xxx&type=lead
 * 
 * Legacy support (vendors):
 * GET /handleUnsubscribe?vendorId=xxx
 * 
 * Actions:
 *   Vendor: Sets status to 'dismissed', cancels pending tasks
 *   Lead:   Sets status to 'lost', sets unsubscribedAt, cancels pending tasks
 */
export const handleUnsubscribe = onRequest({
    cors: true,
}, async (req, res) => {
    // Support both new (?id=&type=) and legacy (?vendorId=) formats
    const entityType = (req.query.type as string) || 'vendor';
    const entityId = (req.query.id as string) || (req.query.vendorId as string);

    if (!entityId) {
        res.status(400).send(renderPage(
            'Invalid Request',
            'Missing identifier. If you clicked a link from an email, please try again.',
            false
        ));
        return;
    }

    try {
        if (entityType === 'lead') {
            const contactId = req.query.contactId as string | undefined;
            await handleLeadUnsubscribe(entityId, res, contactId);
        } else {
            await handleVendorUnsubscribe(entityId, res);
        }
    } catch (err) {
        logger.error(`Error processing unsubscribe for ${entityType} ${entityId}:`, err);
        res.status(500).send(renderPage(
            'Something Went Wrong',
            'We encountered an error processing your request. Please try again or contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.',
            false
        ));
    }
});

// ── Vendor unsubscribe ──────────────────────────────────────────

async function handleVendorUnsubscribe(vendorId: string, res: any) {
    const vendorDoc = await db.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
        res.status(404).send(renderPage(
            'Not Found',
            'We couldn\'t find your record. You may have already been unsubscribed.',
            false
        ));
        return;
    }

    const vendor = vendorDoc.data()!;
    const businessName = vendor.businessName || 'Vendor';

    if (vendor.status === 'dismissed') {
        res.status(200).send(renderPage(
            'Already Unsubscribed',
            `${businessName} has already been removed from our outreach list. You won't receive any more emails.`,
            true
        ));
        return;
    }

    await db.collection("vendors").doc(vendorId).update({
        status: 'dismissed',
        statusUpdatedAt: new Date(),
        dismissReason: 'unsubscribed',
        unsubscribedAt: new Date(),
    });

    const cancelledCount = await cancelVendorTasks(db, vendorId);

    await db.collection("vendor_activities").add({
        vendorId,
        type: "STATUS_CHANGE",
        description: `${businessName} unsubscribed via email link. ${cancelledCount} pending tasks cancelled.`,
        createdAt: new Date(),
        metadata: {
            from: vendor.status,
            to: 'dismissed',
            trigger: 'unsubscribe_link',
            cancelledTasks: cancelledCount,
        }
    });

    logger.info(`Vendor ${vendorId} (${businessName}) unsubscribed. ${cancelledCount} tasks cancelled.`);

    res.status(200).send(renderPage(
        'Unsubscribed Successfully',
        `${businessName} has been removed from our outreach list. You won't receive any more emails from XIRI Facility Solutions.<br/><br/>If this was a mistake, please contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.`,
        true
    ));
}

// ── Lead unsubscribe ────────────────────────────────────────────

async function handleLeadUnsubscribe(leadId: string, res: any, contactId?: string) {
    const leadDoc = await db.collection("leads").doc(leadId).get();
    if (!leadDoc.exists) {
        res.status(404).send(renderPage(
            'Not Found',
            'We couldn\'t find your record. You may have already been unsubscribed.',
            false
        ));
        return;
    }

    const lead = leadDoc.data()!;
    const businessName = lead.businessName || 'Business';

    // ── Resolve contact for contact-level unsubscribe ──
    let resolvedContactId = contactId || null;

    if (!resolvedContactId) {
        // Try to find the primary contact
        const primarySnap = await db.collection('contacts')
            .where('companyId', '==', leadId)
            .where('isPrimary', '==', true)
            .limit(1)
            .get();
        if (!primarySnap.empty) {
            resolvedContactId = primarySnap.docs[0].id;
        }
    }

    // Check if already unsubscribed (contact-level or lead-level)
    if (resolvedContactId) {
        const contactDoc = await db.collection('contacts').doc(resolvedContactId).get();
        if (contactDoc.exists && contactDoc.data()?.unsubscribed) {
            res.status(200).send(renderPage(
                'Already Unsubscribed',
                `You have already been removed from our outreach list. You won't receive any more emails.`,
                true
            ));
            return;
        }
    }

    if (lead.unsubscribedAt || lead.status === 'lost') {
        res.status(200).send(renderPage(
            'Already Unsubscribed',
            `${businessName} has already been removed from our outreach list. You won't receive any more emails.`,
            true
        ));
        return;
    }

    // Mark contact as unsubscribed
    if (resolvedContactId) {
        await db.collection('contacts').doc(resolvedContactId).update({
            unsubscribed: true,
            unsubscribedAt: new Date(),
        });
    }

    // Update lead — mark as lost with unsubscribe reason
    const previousStatus = lead.status;
    await db.collection("leads").doc(leadId).update({
        status: 'lost',
        unsubscribedAt: new Date(),
        lostReason: 'unsubscribed',
        outreachStatus: 'UNSUBSCRIBED',
    });

    // Cancel all pending outreach tasks
    const cancelledCount = await cancelLeadTasks(db, leadId);

    // Log activity
    await db.collection("lead_activities").add({
        leadId,
        contactId: resolvedContactId || null,
        type: "STATUS_CHANGE",
        description: `${businessName} unsubscribed via email link. Status changed from ${previousStatus} to lost. ${cancelledCount} pending tasks cancelled.`,
        createdAt: new Date(),
        metadata: {
            from: previousStatus,
            to: 'lost',
            trigger: 'unsubscribe_link',
            cancelledTasks: cancelledCount,
            contactId: resolvedContactId || null,
        }
    });

    logger.info(`Lead ${leadId} (${businessName}) unsubscribed. Contact: ${resolvedContactId || 'none'}. ${cancelledCount} tasks cancelled.`);

    res.status(200).send(renderPage(
        'Unsubscribed Successfully',
        `${businessName} has been removed from our outreach list. You won't receive any more emails from XIRI Facility Solutions.<br/><br/>If this was a mistake, please contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.`,
        true
    ));
}

// ── Confirmation page renderer ──────────────────────────────────

function renderPage(title: string, message: string, success: boolean): string {
    const icon = success ? '✅' : '⚠️';
    const color = success ? '#059669' : '#dc2626';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — XIRI Facility Solutions</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; }
        .card { background: white; border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h1 { color: ${color}; font-size: 24px; margin: 0 0 16px 0; }
        p { color: #475569; line-height: 1.6; font-size: 15px; margin: 0; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="footer">${COMPANY_NAME} · ${COMPANY_ADDRESS}<br>${SERVICE_AREA}</div>
    </div>
</body>
</html>`;
}
