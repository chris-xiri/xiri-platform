import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { DASHBOARD_CORS } from "../utils/cors";
import { validateFreeTierEligibility, AccountUsage } from "@xiri-facility-solutions/shared";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calculates current account asset usage for a contract/lead to check against Free Tier limits.
 */
async function getAccountUsage(contractId: string, leadId?: string): Promise<AccountUsage> {
    const contractDoc = await db.collection("contracts").doc(contractId).get();
    if (!contractDoc.exists) {
        throw new HttpsError("not-found", `Contract ${contractId} not found`);
    }

    const contract = contractDoc.data()!;
    const lineItems: any[] = contract.lineItems || [];

    // Unique locations from line items or contract locations
    const locationsSet = new Set<string>();
    lineItems.forEach(li => {
        if (li.locationName) locationsSet.add(li.locationName.trim().toLowerCase());
    });
    if (locationsSet.size === 0 && contract.formalEntityAddress) {
        locationsSet.add(contract.formalEntityAddress.trim().toLowerCase());
    }

    const recurringLineItems = lineItems.filter((li: any) => li.frequency !== "one_time");

    // Team members / user seats associated with lead or contract
    let teamMemberCount = 1;
    const targetLeadId = leadId || contract.leadId;
    if (targetLeadId) {
        const contactsSnap = await db.collection("contacts")
            .where("companyId", "==", targetLeadId)
            .get();
        if (!contactsSnap.empty) {
            teamMemberCount = contactsSnap.size;
        }
    }

    return {
        locationCount: Math.max(1, locationsSet.size),
        lineItemCount: recurringLineItems.length,
        teamMemberCount,
    };
}

/**
 * OnCall trigger: checkFreeTierEligibility
 * Pre-checks current usage against Free Tier limits before user attempts downgrade.
 */
export const checkFreeTierEligibility = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const { contractId, leadId } = request.data || {};
    if (!contractId) {
        throw new HttpsError("invalid-argument", "Missing contractId");
    }

    const usage = await getAccountUsage(contractId, leadId);
    const eligibility = validateFreeTierEligibility(usage);

    return {
        contractId,
        eligibility,
    };
});

/**
 * OnCall trigger: cancelSubscription
 * Cancels a contract/subscription, marks status as 'terminated', updates lead to 'churned',
 * halts auto-invoicing, and sends a confirmation email.
 */
export const cancelSubscription = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const { contractId, reason, cancelledBy } = request.data || {};
    if (!contractId) {
        throw new HttpsError("invalid-argument", "Missing contractId");
    }

    const contractRef = db.collection("contracts").doc(contractId);
    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
        throw new HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data()!;
    const clientName = contract.clientBusinessName || contract.formalEntityName || "Client";
    const clientEmail = contract.contactEmail || contract.signerEmail || "";
    const leadId = contract.leadId;

    const previousStatus = contract.status;
    const now = new Date();

    // 1. Update contract document
    await contractRef.update({
        status: "terminated",
        cancelledAt: now,
        cancelReason: reason || "User requested cancellation",
        cancelledBy: cancelledBy || request.auth?.uid || "user",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Update lead status to churned if present
    if (leadId) {
        await db.collection("leads").doc(leadId).update({
            status: "churned",
            churnReason: reason || "Contract cancelled",
            churnedAt: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((err) => logger.warn(`Could not update lead ${leadId} status: ${err.message}`));
    }

    // 3. Log activity
    await db.collection("activity_logs").add({
        type: "CONTRACT_TERMINATED",
        contractId,
        leadId: leadId || null,
        clientName,
        cancelledBy: cancelledBy || request.auth?.uid || "user",
        reason: reason || "User requested cancellation",
        description: `Contract ${contractId} for ${clientName} cancelled/terminated (previous status: ${previousStatus})`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Enqueue cancellation email
    if (clientEmail) {
        await db.collection("mail_queue").add({
            to: clientEmail,
            subject: `Subscription Cancellation Confirmation — XIRI Facility Solutions`,
            templateType: "contract_cancellation",
            templateData: {
                clientName,
                contractId,
                cancelledAt: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                reason: reason || "User requested cancellation",
                exitClause: contract.exitClause || "30-day notice",
            },
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    logger.info(`[Subscription] Contract ${contractId} for ${clientName} successfully cancelled.`);

    return {
        success: true,
        message: `Subscription for ${clientName} has been cancelled.`,
        contractId,
        status: "terminated",
    };
});

/**
 * OnCall trigger: downgradeSubscription
 * Downgrades account to Free Tier AFTER validating that current asset usage complies with FREE_TIER_LIMITS.
 * If usage exceeds limits, blocks downgrade with itemized list of excess resources to delete.
 */
export const downgradeSubscription = onCall({
    cors: DASHBOARD_CORS,
}, async (request) => {
    const { contractId, reason } = request.data || {};
    if (!contractId) {
        throw new HttpsError("invalid-argument", "Missing contractId");
    }

    const contractRef = db.collection("contracts").doc(contractId);
    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
        throw new HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data()!;
    const clientName = contract.clientBusinessName || contract.formalEntityName || "Client";
    const clientEmail = contract.contactEmail || contract.signerEmail || "";
    const leadId = contract.leadId;

    // 1. Audit current usage against Free Tier limits
    const usage = await getAccountUsage(contractId, leadId);
    const eligibility = validateFreeTierEligibility(usage);

    if (!eligibility.isEligible) {
        logger.warn(`[Subscription] Downgrade blocked for ${contractId}: exceeds Free Tier limits`, eligibility.exceededLimits);
        return {
            success: false,
            error: "LIMITS_EXCEEDED",
            message: "Cannot downgrade to Free Tier. Current asset usage exceeds Free Tier limits.",
            eligibility,
        };
    }

    const now = new Date();

    // 2. Perform Downgrade
    await contractRef.update({
        status: "free_tier",
        isFreeTier: true,
        totalMonthlyRate: 0,
        downgradedAt: now,
        downgradeReason: reason || "User requested Free Tier downgrade",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Log activity
    await db.collection("activity_logs").add({
        type: "CONTRACT_DOWNGRADED_TO_FREE_TIER",
        contractId,
        leadId: leadId || null,
        clientName,
        description: `Contract ${contractId} for ${clientName} downgraded to Free Tier ($0/mo)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Enqueue confirmation email
    if (clientEmail) {
        await db.collection("mail_queue").add({
            to: clientEmail,
            subject: `Plan Downgraded to Free Tier — XIRI Facility Solutions`,
            templateType: "free_tier_downgrade",
            templateData: {
                clientName,
                contractId,
                downgradedAt: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                limits: eligibility.limits,
            },
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    logger.info(`[Subscription] Contract ${contractId} for ${clientName} downgraded to Free Tier.`);

    return {
        success: true,
        message: `Plan successfully downgraded to Free Tier.`,
        contractId,
        status: "free_tier",
        eligibility,
    };
});
