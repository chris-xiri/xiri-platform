import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// NRR bonus tiers
const NRR_TIERS = [
    { min: 1.10, rate: 0.02 },   // > 110% NRR → 2% of portfolio ACV
    { min: 1.00, rate: 0.01 },   // 100–110% → 1%
    { min: 0.90, rate: 0.005 },  // 90–100% → 0.5%
    { min: 0, rate: 0 },      // < 90% → $0
];

/**
 * Runs daily at 9 AM UTC.
 * Checks for commission payouts that are scheduled and due today.
 * Verifies the client is still active before marking as PAID.
 */
export const processCommissionPayouts = onSchedule({
    schedule: "0 9 * * *",  // Daily at 9 AM UTC
    timeZone: "America/New_York",
}, async () => {
    const now = new Date();
    logger.info(`[CommissionPayouts] Processing scheduled payouts for ${now.toISOString()}`);

    // Find all ACTIVE commissions that have PENDING payouts
    const commSnap = await db.collection('commissions')
        .where('status', '==', 'ACTIVE')
        .get();

    let processed = 0;
    let paid = 0;

    for (const commDoc of commSnap.docs) {
        const commission = commDoc.data();
        const schedule = [...commission.payoutSchedule];
        let changed = false;

        for (const entry of schedule) {
            if (entry.status !== 'PENDING') continue;

            // Check if payout is due
            const scheduledAt = entry.scheduledAt?.toDate?.() || new Date(entry.scheduledAt);
            if (scheduledAt > now) continue;

            // Verify client is still active (not churned)
            const leadDoc = await db.collection('leads').doc(commission.leadId).get();
            const leadData = leadDoc.data();
            if (leadData?.status === 'churned' || leadData?.status === 'lost') {
                entry.status = 'CANCELLED';
                changed = true;
                logger.info(`[CommissionPayouts] Skipping payout — client ${commission.leadId} is ${leadData?.status}`);
                continue;
            }

            // Pay it
            entry.status = 'PAID';
            entry.paidAt = now;
            changed = true;
            paid++;

            // Log payout
            await db.collection('commission_ledger').add({
                commissionId: commDoc.id,
                type: 'PAYOUT_PAID',
                amount: entry.amount,
                staffId: commission.staffId,
                description: `Scheduled payout: $${entry.amount.toFixed(2)} (${entry.percentage}%)`,
                createdAt: now,
            });

            logger.info(`[CommissionPayouts] Paid $${entry.amount} to ${commission.staffId} (commission ${commDoc.id})`);
        }

        if (changed) {
            // Check if all payouts are complete
            const allDone = schedule.every((e: any) => e.status === 'PAID' || e.status === 'CANCELLED');
            const anyPaidExist = schedule.some((e: any) => e.status === 'PAID');
            const anyCancelled = schedule.some((e: any) => e.status === 'CANCELLED');

            let newStatus = commission.status;
            if (allDone && anyPaidExist && !anyCancelled) {
                newStatus = 'COMPLETED';
            } else if (allDone && anyCancelled) {
                newStatus = 'PARTIALLY_CANCELLED';
            }

            await commDoc.ref.update({
                payoutSchedule: schedule,
                status: newStatus,
                updatedAt: now,
            });
            processed++;
        }
    }

    logger.info(`[CommissionPayouts] Done: ${processed} commissions processed, ${paid} payouts made`);
});


/**
 * Runs quarterly (1st of Jan, Apr, Jul, Oct) at midnight UTC.
 * Calculates Net Revenue Retention for each FSM and creates retention bonuses.
 */
export const calculateNrr = onSchedule({
    schedule: "0 0 1 1,4,7,10 *",  // Quarterly: 1st of Jan, Apr, Jul, Oct
    timeZone: "America/New_York",
}, async () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();

    // Determine the quarter we're calculating for (previous quarter)
    const quarterMap: Record<number, string> = {
        0: `${currentYear - 1}-Q4`,  // Jan → calc Q4 of prev year
        3: `${currentYear}-Q1`,       // Apr → calc Q1
        6: `${currentYear}-Q2`,       // Jul → calc Q2
        9: `${currentYear}-Q3`,       // Oct → calc Q3
    };
    const quarter = quarterMap[currentMonth] || `${currentYear}-Q${Math.ceil((currentMonth + 1) / 3)}`;

    logger.info(`[NRR] Calculating Net Revenue Retention for ${quarter}`);

    // Get all leads that have been handed off to an FSM
    const leadsSnap = await db.collection('leads')
        .where('handedOffToFsm', '!=', null)
        .get();

    // Group leads by FSM
    const fsmPortfolios: Map<string, {
        leadIds: string[];
        startingMrr: number;
        currentMrr: number;
        upsells: number;
        downgrades: number;
        churn: number;
    }> = new Map();

    for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data();
        const fsmId = lead.handedOffToFsm;
        if (!fsmId) continue;

        if (!fsmPortfolios.has(fsmId)) {
            fsmPortfolios.set(fsmId, {
                leadIds: [],
                startingMrr: 0,
                currentMrr: 0,
                upsells: 0,
                downgrades: 0,
                churn: 0,
            });
        }

        const portfolio = fsmPortfolios.get(fsmId)!;
        portfolio.leadIds.push(leadDoc.id);

        // Get quotes for this lead to determine MRR
        const quotesSnap = await db.collection('quotes')
            .where('leadId', '==', leadDoc.id)
            .where('status', '==', 'accepted')
            .get();

        let leadMrr = 0;
        for (const quoteDoc of quotesSnap.docs) {
            leadMrr += quoteDoc.data().totalMonthlyRate || 0;
        }

        if (lead.status === 'churned') {
            portfolio.churn += leadMrr;
        } else {
            portfolio.currentMrr += leadMrr;
        }

        // Tally upsells (quotes marked as upsells for this FSM)
        const upsellSnap = await db.collection('quotes')
            .where('leadId', '==', leadDoc.id)
            .where('isUpsell', '==', true)
            .where('status', '==', 'accepted')
            .get();

        for (const upsellDoc of upsellSnap.docs) {
            portfolio.upsells += upsellDoc.data().totalMonthlyRate || 0;
        }
    }

    // Calculate NRR and bonuses for each FSM
    for (const [fsmId, portfolio] of fsmPortfolios) {
        // Starting MRR = current + churn - upsells (what they started the quarter with)
        const startingMrr = portfolio.currentMrr + portfolio.churn - portfolio.upsells;
        if (startingMrr <= 0) continue; // Skip if no starting portfolio

        const nrr = (startingMrr + portfolio.upsells - portfolio.downgrades - portfolio.churn) / startingMrr;

        // Determine bonus rate from tiers
        let bonusRate = 0;
        for (const tier of NRR_TIERS) {
            if (nrr >= tier.min) {
                bonusRate = tier.rate;
                break;
            }
        }

        const portfolioAcv = portfolio.currentMrr * 12;
        const bonusAmount = Math.round(portfolioAcv * bonusRate / 4 * 100) / 100; // Quarterly portion

        // Save NRR snapshot
        await db.collection('nrr_snapshots').add({
            fsmId,
            quarter,
            startingMrr,
            endingMrr: portfolio.currentMrr,
            upsells: portfolio.upsells,
            downgrades: portfolio.downgrades,
            churn: portfolio.churn,
            nrr: Math.round(nrr * 10000) / 100, // Store as percentage (e.g., 105.5)
            bonusRate,
            bonusAmount,
            calculatedAt: now,
        });

        // If bonus > 0, create a retention commission
        if (bonusAmount > 0) {
            const commRef = await db.collection('commissions').add({
                staffId: fsmId,
                staffRole: 'fsm',
                quoteId: '',  // N/A for retention
                leadId: '',   // N/A for retention (portfolio-level)
                type: 'FSM_RETENTION',
                mrr: portfolio.currentMrr,
                acv: portfolioAcv,
                rate: bonusRate,
                totalCommission: bonusAmount,
                payoutSchedule: [{
                    month: 0,
                    amount: bonusAmount,
                    percentage: 100,
                    status: 'PENDING',
                    scheduledAt: now, // Pay immediately
                }],
                clawbackWindowEnd: now, // No clawback for retention bonuses
                status: 'ACTIVE',
                createdAt: now,
                updatedAt: now,
            });

            await db.collection('commission_ledger').add({
                commissionId: commRef.id,
                type: 'PAYOUT_SCHEDULED',
                amount: bonusAmount,
                staffId: fsmId,
                description: `${quarter} NRR retention bonus: ${(nrr * 100).toFixed(1)}% NRR → ${(bonusRate * 100).toFixed(1)}% rate → $${bonusAmount.toFixed(2)}`,
                createdAt: now,
            });
        }

        logger.info(`[NRR] FSM ${fsmId}: NRR=${(nrr * 100).toFixed(1)}%, portfolio=$${portfolio.currentMrr}/mo, bonus=$${bonusAmount}`);
    }

    logger.info(`[NRR] Completed NRR calculation for ${quarter}: ${fsmPortfolios.size} FSMs processed`);
});
