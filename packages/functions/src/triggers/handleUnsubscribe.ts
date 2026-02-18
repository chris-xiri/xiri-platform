import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { cancelVendorTasks } from "../utils/queueUtils";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Unsubscribe Handler
 * 
 * HTTP endpoint that handles vendor unsubscribe requests.
 * Called when a vendor clicks the unsubscribe link in their email.
 * 
 * GET /handleUnsubscribe?vendorId=xxx&token=yyy
 * 
 * - Sets vendor status to 'dismissed'
 * - Cancels all pending drip/outreach tasks
 * - Shows a confirmation page
 */
export const handleUnsubscribe = onRequest({
    cors: true,
}, async (req, res) => {
    const vendorId = req.query.vendorId as string;

    if (!vendorId) {
        res.status(400).send(renderPage(
            'Invalid Request',
            'Missing vendor identifier. If you clicked a link from an email, please try again.',
            false
        ));
        return;
    }

    try {
        // Verify vendor exists
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

        // Already dismissed?
        if (vendor.status === 'dismissed') {
            res.status(200).send(renderPage(
                'Already Unsubscribed',
                `${businessName} has already been removed from our outreach list. You won't receive any more emails.`,
                true
            ));
            return;
        }

        // Update vendor status to dismissed
        await db.collection("vendors").doc(vendorId).update({
            status: 'dismissed',
            statusUpdatedAt: new Date(),
            dismissReason: 'unsubscribed',
            unsubscribedAt: new Date(),
        });

        // Cancel all pending tasks
        const cancelledCount = await cancelVendorTasks(db, vendorId);

        // Log activity
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
            `${businessName} has been removed from our outreach list. You won't receive any more emails from Xiri Facility Solutions.<br/><br/>If this was a mistake, please contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.`,
            true
        ));

    } catch (err) {
        logger.error(`Error processing unsubscribe for ${vendorId}:`, err);
        res.status(500).send(renderPage(
            'Something Went Wrong',
            'We encountered an error processing your request. Please try again or contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.',
            false
        ));
    }
});

function renderPage(title: string, message: string, success: boolean): string {
    const icon = success ? '✅' : '⚠️';
    const color = success ? '#059669' : '#dc2626';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — Xiri Facility Solutions</title>
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
        <div class="footer">Xiri Facility Solutions</div>
    </div>
</body>
</html>`;
}
