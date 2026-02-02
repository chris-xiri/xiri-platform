import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { performOutreach } from "../agents/outreach";
import { Vendor } from "../utils/types";

export const onVendorApproved = onDocumentUpdated("vendors/{vendorId}", async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as Vendor;
    const after = change.after.data() as Vendor;

    // Check if status changed to APPROVED or AI_AUTO_APPROVED
    const isNowApproved = (after.status === 'APPROVED' || after.status === 'AI_AUTO_APPROVED');
    const wasApproved = (before.status === 'APPROVED' || before.status === 'AI_AUTO_APPROVED');

    // Trigger only on transition to approved, or if it is approved but outreach hasn't started yet (e.g. manual re-trigger?)
    // Strictly: only if it wasn't approved before, and is now.
    if (isNowApproved && !wasApproved) {
        console.log(`Vendor ${event.params.vendorId} approved. Triggering outreach agent.`);
        await performOutreach(event.params.vendorId);
    }
});
