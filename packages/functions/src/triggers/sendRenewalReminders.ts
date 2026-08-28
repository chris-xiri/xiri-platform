import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { DASHBOARD_CORS } from "../utils/cors";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled trigger: sendRenewalReminders
 * Runs on the 25th of every month at 8:00 AM EST (5 days before monthly invoice generation).
 * 
 * For each active contract:
 * 1. Checks if client should receive a pre-billing / auto-renewal reminder for the upcoming month.
 * 2. Enqueues a 'renewal_reminder' email in mail_queue detailing upcoming charges, renewal date, and cancellation window.
 * 3. Updates contract doc with lastRenewalReminderSentAt.
 */
export const sendRenewalReminders = onSchedule({
    schedule: "0 8 25 * *", // 8 AM EST on 25th of every month
    timeZone: "America/New_York",
}, async () => {
    logger.info("[RenewalReminders] Starting monthly auto-renewal reminder check...");
    await runRenewalReminderPipeline();
});

/**
 * Manual trigger for admin/testing
 */
export const triggerSendRenewalReminders = onCall({
    cors: DASHBOARD_CORS,
}, async () => {
    logger.info("[RenewalReminders] Manual trigger invoked.");
    const stats = await runRenewalReminderPipeline();
    return { success: true, stats };
});

async function runRenewalReminderPipeline() {
    const now = new Date();
    // Next month period label
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const renewalPeriodLabel = nextMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const renewalDateStr = nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // Fetch active contracts
    const contractsSnap = await db.collection("contracts")
        .where("status", "==", "active")
        .get();

    if (contractsSnap.empty) {
        logger.info("[RenewalReminders] No active contracts found.");
        return { processed: 0, sent: 0, skipped: 0 };
    }

    let sent = 0;
    let skipped = 0;

    for (const contractDoc of contractsSnap.docs) {
        const contract = contractDoc.data();
        const contractId = contractDoc.id;
        const clientName = contract.clientBusinessName || contract.formalEntityName || "Valued Client";
        const clientEmail = contract.contactEmail || contract.signerEmail || contract.clientEmail || "";
        const lineItems: any[] = contract.lineItems || [];

        if (!clientEmail) {
            skipped++;
            continue;
        }

        // Deduplication guard: check if reminder already sent for this period
        if (contract.lastRenewalReminderPeriod === renewalPeriodLabel) {
            skipped++;
            continue;
        }

        // Calculate upcoming recurring charge
        const recurringItems = lineItems.filter((li: any) => li.frequency !== "one_time");
        const monthlyRate = contract.totalMonthlyRate || contract.monthlyRate ||
            recurringItems.reduce((sum: number, li: any) => sum + (li.clientRate || 0), 0);

        // Enqueue renewal reminder email
        await db.collection("mail_queue").add({
            to: clientEmail,
            subject: `Upcoming Service Renewal & Billing Notice (${renewalPeriodLabel}) — XIRI`,
            templateType: "renewal_reminder",
            templateData: {
                clientName,
                contractId,
                renewalPeriodLabel,
                renewalDateStr,
                monthlyRate,
                lineItems: recurringItems.map((li: any) => ({
                    serviceType: li.serviceType || "Facility Maintenance",
                    locationName: li.locationName || "Facility Location",
                    rate: li.clientRate || 0,
                })),
                exitClause: contract.exitClause || "30-day notice",
            },
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update contract tracking
        await contractDoc.ref.update({
            lastRenewalReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRenewalReminderPeriod: renewalPeriodLabel,
        });

        // Log activity
        await db.collection("activity_logs").add({
            type: "RENEWAL_REMINDER_SENT",
            contractId,
            clientName,
            renewalPeriodLabel,
            monthlyRate,
            description: `Auto-renewal charge reminder sent to ${clientEmail} for ${renewalPeriodLabel} ($${monthlyRate.toLocaleString()})`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        sent++;
        logger.info(`[RenewalReminders] Queued reminder for ${clientName} (${clientEmail}): $${monthlyRate} for ${renewalPeriodLabel}`);
    }

    logger.info(`[RenewalReminders] Complete: ${sent} reminders sent, ${skipped} skipped.`);
    return { processed: contractsSnap.size, sent, skipped };
}
