/**
 * TidyCal Cloud Functions
 * Callable functions that proxy TidyCal API for the frontend.
 *
 * - getAvailableTimeslots: public (no auth) — used on vendor onboarding page
 * - bookOnboardingCall: public (no auth) — creates booking + updates vendor doc
 * - getAvailableTimeslotsAuth: auth required — used in dashboard for lead booking
 * - bookDiscoveryCall: auth required — creates booking + updates lead doc
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../utils/firebase";
import { DASHBOARD_CORS } from "../utils/cors";
import {
    getTimeslots,
    createBooking,
    listBookings,
    TIDYCAL_BOOKING_TYPES,
} from "../utils/tidycal";

const TIDYCAL_API_KEY = defineSecret("TIDYCAL_API_KEY");

// ─── Public: Get Timeslots (Vendor Onboarding Page) ─────────────────────

/**
 * Fetch available timeslots for vendor onboarding calls.
 * No auth required — called from the public onboarding page.
 */
export const getOnboardingTimeslots = onRequest({
    cors: DASHBOARD_CORS,
    secrets: [TIDYCAL_API_KEY],
}, async (req, res) => {
    try {
        const { startDate, endDate, timezone, bookingTypeId } = req.query as Record<string, string>;

        if (!startDate || !endDate) {
            res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
            return;
        }

        const typeId = bookingTypeId
            ? parseInt(bookingTypeId, 10)
            : TIDYCAL_BOOKING_TYPES.CONTRACTOR_ONBOARDING;

        const slots = await getTimeslots(
            typeId,
            startDate,
            endDate,
            timezone || "America/New_York"
        );

        res.json({ slots });
    } catch (error: any) {
        console.error("getOnboardingTimeslots error:", error);
        res.status(500).json({ error: error.message || "Failed to fetch timeslots" });
    }
});

// ─── Public: Book Onboarding Call ───────────────────────────────────────

/**
 * Book an onboarding call for a vendor.
 * No auth required — called from the public onboarding page.
 * Creates TidyCal booking + updates vendor Firestore doc.
 */
export const bookOnboardingCall = onRequest({
    cors: DASHBOARD_CORS,
    secrets: [TIDYCAL_API_KEY],
}, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { vendorId, name, email, starts_at, timezone } = req.body;

        if (!vendorId || !name || !email || !starts_at) {
            res.status(400).json({ error: "vendorId, name, email, starts_at are required" });
            return;
        }

        // Verify vendor exists
        const vendorRef = db.collection("vendors").doc(vendorId);
        const vendorDoc = await vendorRef.get();
        if (!vendorDoc.exists) {
            res.status(404).json({ error: "Vendor not found" });
            return;
        }

        // Create TidyCal booking
        const booking = await createBooking(
            TIDYCAL_BOOKING_TYPES.CONTRACTOR_ONBOARDING,
            {
                name,
                email,
                starts_at,
                timezone: timezone || "America/New_York",
                questions: { vendor_id: vendorId },
            }
        );

        // Update vendor doc in Firestore
        await vendorRef.update({
            status: "onboarding_scheduled",
            onboardingCallTime: starts_at,
            tidycalBookingId: booking.id,
            tidycalMeetingUrl: booking.meeting_url || null,
            tidycalRescheduleUrl: booking.reschedule_url || null,
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Log activity
        await db.collection("vendor_activities").add({
            vendorId,
            type: "ONBOARDING_CALL_BOOKED",
            description: `Onboarding call booked for ${new Date(starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
            createdAt: FieldValue.serverTimestamp(),
            metadata: {
                tidycalBookingId: booking.id,
                starts_at,
                meetingUrl: booking.meeting_url,
            },
        });

        console.log(`✅ Onboarding call booked for vendor ${vendorId} — TidyCal ID ${booking.id}`);

        res.json({
            success: true,
            booking: {
                id: booking.id,
                starts_at: booking.starts_at,
                ends_at: booking.ends_at,
                meeting_url: booking.meeting_url,
                reschedule_url: booking.reschedule_url,
            },
        });
    } catch (error: any) {
        console.error("bookOnboardingCall error:", error);
        res.status(500).json({ error: error.message || "Failed to book call" });
    }
});

// ─── Auth: Get Timeslots (Dashboard) ────────────────────────────────────

/**
 * Fetch available timeslots — used in the dashboard for lead/vendor booking.
 * Requires auth.
 */
export const getDashboardTimeslots = onCall({
    cors: DASHBOARD_CORS,
    secrets: [TIDYCAL_API_KEY],
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { startDate, endDate, timezone, bookingTypeId } = request.data;

    if (!startDate || !endDate) {
        throw new HttpsError("invalid-argument", "startDate and endDate are required");
    }

    const typeId = bookingTypeId || TIDYCAL_BOOKING_TYPES.DISCOVERY_CALL;

    const slots = await getTimeslots(
        typeId,
        startDate,
        endDate,
        timezone || "America/New_York"
    );

    return { slots };
});

// ─── Auth: Book Discovery Call (Lead) ───────────────────────────────────

/**
 * Book a discovery call for a lead from the dashboard.
 * Updates the lead's Firestore doc and logs the activity.
 */
export const bookDiscoveryCall = onCall({
    cors: DASHBOARD_CORS,
    secrets: [TIDYCAL_API_KEY],
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { leadId, name, email, starts_at, timezone, bookingTypeId } = request.data;

    if (!leadId || !name || !email || !starts_at) {
        throw new HttpsError("invalid-argument", "leadId, name, email, starts_at are required");
    }

    // Verify lead exists
    const leadRef = db.collection("leads").doc(leadId);
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists) {
        throw new HttpsError("not-found", "Lead not found");
    }

    const typeId = bookingTypeId || TIDYCAL_BOOKING_TYPES.DISCOVERY_CALL;

    // Create TidyCal booking
    const booking = await createBooking(typeId, {
        name,
        email,
        starts_at,
        timezone: timezone || "America/New_York",
        questions: { lead_id: leadId },
    });

    // Update lead doc
    await leadRef.update({
        discoveryCallTime: starts_at,
        tidycalBookingId: booking.id,
        tidycalMeetingUrl: booking.meeting_url || null,
        tidycalRescheduleUrl: booking.reschedule_url || null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    // Log activity
    await db.collection("lead_activities").add({
        leadId,
        type: "DISCOVERY_CALL_BOOKED",
        description: `Discovery call booked for ${new Date(starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        metadata: {
            tidycalBookingId: booking.id,
            starts_at,
            meetingUrl: booking.meeting_url,
        },
    });

    console.log(`✅ Discovery call booked for lead ${leadId} — TidyCal ID ${booking.id}`);

    return {
        success: true,
        booking: {
            id: booking.id,
            starts_at: booking.starts_at,
            ends_at: booking.ends_at,
            meeting_url: booking.meeting_url,
            reschedule_url: booking.reschedule_url,
        },
    };
});

// ─── Auth: List Bookings (Dashboard) ────────────────────────────────────

/**
 * List TidyCal bookings — used in the dashboard to show upcoming calls.
 */
export const getTidyCalBookings = onCall({
    cors: DASHBOARD_CORS,
    secrets: [TIDYCAL_API_KEY],
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

    const { bookingTypeId, page } = request.data || {};

    const result = await listBookings({
        bookingTypeId,
        page: page || 1,
    });

    return result;
});
