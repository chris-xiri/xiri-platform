"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onVendorApproved = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const outreach_1 = require("../agents/outreach");
exports.onVendorApproved = (0, firestore_1.onDocumentUpdated)({
    document: "vendors/{vendorId}",
    secrets: [
        "GEMINI_API_KEY",
        "SMTP_HOST",
        "SMTP_USER",
        "SMTP_PASS"
    ]
}, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const before = change.before.data();
    const after = change.after.data();
    // Check if status changed to APPROVED or AI_AUTO_APPROVED
    const isNowApproved = (after.status === 'APPROVED' || after.status === 'AI_AUTO_APPROVED');
    const wasApproved = (before.status === 'APPROVED' || before.status === 'AI_AUTO_APPROVED');
    // Trigger only on transition to approved, or if it is approved but outreach hasn't started yet (e.g. manual re-trigger?)
    // Strictly: only if it wasn't approved before, and is now.
    if (isNowApproved && !wasApproved) {
        console.log(`Vendor ${event.params.vendorId} approved. Triggering outreach agent.`);
        await (0, outreach_1.performOutreach)(event.params.vendorId);
    }
});
//# sourceMappingURL=outreachTriggers.js.map