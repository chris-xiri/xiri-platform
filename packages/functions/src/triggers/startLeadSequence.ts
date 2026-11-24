/**
 * startLeadSequence — Enroll a sales lead/contact into a queue-backed SDR email funnel.
 *
 * Delegates to `enqueueLeadSequence` so all sequences run through `outreach_queue`
 * and `processOutreachQueue` (enforcing daily warmup caps, weekday-only sending,
 * real-time `_warm`/`_cold` engagement branching, and automatic stop guardrails).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { DASHBOARD_CORS } from "../utils/cors";
import { enqueueLeadSequence } from "../utils/leadSequenceEngine";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const startLeadSequence = onCall(
    {
        cors: DASHBOARD_CORS,
        secrets: ["RESEND_API_KEY"],
    },
    async (request) => {
        const { leadId, contactId, sequenceId, enrolledBy, initialDelayDays, initialDelayMinutes, isSecondaryContact } = request.data || {};

        if (!leadId) {
            throw new HttpsError("invalid-argument", "leadId is required");
        }

        const result = await enqueueLeadSequence({
            db,
            leadId,
            contactId: contactId || null,
            sequenceId: sequenceId || null,
            initialDelayDays: typeof initialDelayDays === "number" ? initialDelayDays : 0,
            initialDelayMinutes: typeof initialDelayMinutes === "number" ? initialDelayMinutes : 0,
            isSecondaryContact: Boolean(isSecondaryContact),
            throwOnGuard: true,
            enrolledBy: enrolledBy === "bulk" ? "bulk" : "manual",
        });

        return {
            success: true,
            leadId: result.leadId,
            contactId: result.contactId,
            sequenceId: result.sequenceId,
            sequenceName: result.sequenceName,
            stepsScheduled: result.stepsTotal,
            firstTaskId: result.firstTaskId,
            firstSendAt: result.firstSendAt,
            message: `Enrolled in "${result.sequenceName}" (${result.stepsTotal} touches queued via SDR pacing engine).`,
        };
    }
);
