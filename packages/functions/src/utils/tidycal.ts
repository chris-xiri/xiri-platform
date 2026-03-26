/**
 * TidyCal API Client
 * Server-side utility for interacting with the TidyCal scheduling API.
 * Reads TIDYCAL_API_KEY from environment (provided via defineSecret).
 *
 * API Reference: https://tidycal.com/api/docs
 */

const TIDYCAL_BASE = "https://tidycal.com/api";

// ─── Booking Type IDs (verified from TidyCal API 2026-03-26) ────────
export const TIDYCAL_BOOKING_TYPES = {
    /** Vendor onboarding — 30 min "XIRI Facility Solutions | Contractor Onboarding Call" */
    CONTRACTOR_ONBOARDING: 439911,
    /** Lead pre-site discovery — 30 min "XIRI Facility Solutions | Pre-Site Visit Discovery Call" */
    DISCOVERY_CALL: 1829202,
    /** General catch-all — 30 min "XIRI Facility Solutions | 30-Minute Meeting" */
    GENERAL_MEETING: 1829203,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────

export interface TidyCalTimeslot {
    /** ISO 8601 start time, e.g. "2026-03-28T14:00:00Z" */
    starts_at: string;
    /** Duration in minutes */
    duration_minutes: number;
    /** Whether the slot is available */
    is_available: boolean;
}

export interface TidyCalBooking {
    id: number;
    booking_type_id: number;
    starts_at: string;
    ends_at: string;
    cancelled_at: string | null;
    contact: {
        id: number;
        name: string;
        email: string;
    };
    meeting_url: string | null;
    reschedule_url: string | null;
    cancel_url: string | null;
    created_at: string;
}

export interface CreateBookingPayload {
    /** Contact's display name */
    name: string;
    /** Contact's email */
    email: string;
    /** ISO 8601 start time from the timeslots API */
    starts_at: string;
    /** IANA timezone, e.g. "America/New_York" */
    timezone: string;
    /** Key-value map for custom question responses */
    questions?: Record<string, string>;
}

// ─── API Client ─────────────────────────────────────────────────────────

function headers(): Record<string, string> {
    const apiKey = process.env.TIDYCAL_API_KEY;
    if (!apiKey) throw new Error("TIDYCAL_API_KEY not set in environment");
    return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}

/**
 * Fetch available timeslots for a booking type.
 * Returns real-time availability reflecting synced Google Calendar.
 */
export async function getTimeslots(
    bookingTypeId: number,
    startDate: string, // ISO date: "2026-03-28" or full ISO
    endDate: string,   // ISO date: "2026-04-04" or full ISO
    timezone = "America/New_York"
): Promise<TidyCalTimeslot[]> {
    // TidyCal requires full ISO datetime format (Y-m-d\TH:i:s\Z)
    const startsAt = startDate.includes("T") ? startDate : `${startDate}T00:00:00Z`;
    const endsAt = endDate.includes("T") ? endDate : `${endDate}T23:59:59Z`;

    const params = new URLSearchParams({
        starts_at: startsAt,
        ends_at: endsAt,
        timezone,
    });

    const url = `${TIDYCAL_BASE}/booking-types/${bookingTypeId}/timeslots?${params}`;
    const resp = await fetch(url, { method: "GET", headers: headers() });

    if (!resp.ok) {
        const body = await resp.text();
        console.error(`TidyCal getTimeslots error ${resp.status}:`, body);
        throw new Error(`TidyCal API error: ${resp.status}`);
    }

    const data = await resp.json();
    // The API returns { data: [...] } with paginated timeslots
    return data.data || data;
}

/**
 * Create a new booking on a booking type.
 * TidyCal sends the confirmation email + calendar invite automatically.
 */
export async function createBooking(
    bookingTypeId: number,
    payload: CreateBookingPayload
): Promise<TidyCalBooking> {
    const url = `${TIDYCAL_BASE}/booking-types/${bookingTypeId}/bookings`;

    const body: Record<string, unknown> = {
        name: payload.name,
        email: payload.email,
        starts_at: payload.starts_at,
        timezone: payload.timezone,
    };

    // Attach custom question responses if provided
    if (payload.questions) {
        body.questions = payload.questions;
    }

    const resp = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errorBody = await resp.text();
        console.error(`TidyCal createBooking error ${resp.status}:`, errorBody);
        throw new Error(`TidyCal booking failed: ${resp.status} — ${errorBody}`);
    }

    const data = await resp.json();
    return data.data || data;
}

/**
 * List bookings with optional filters.
 */
export async function listBookings(options?: {
    bookingTypeId?: number;
    page?: number;
    cancelled?: boolean;
}): Promise<{ bookings: TidyCalBooking[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.bookingTypeId) params.set("booking_type_id", String(options.bookingTypeId));
    if (options?.page) params.set("page", String(options.page));
    if (options?.cancelled !== undefined) params.set("cancelled", options.cancelled ? "1" : "0");

    const url = `${TIDYCAL_BASE}/bookings?${params}`;
    const resp = await fetch(url, { method: "GET", headers: headers() });

    if (!resp.ok) {
        const body = await resp.text();
        console.error(`TidyCal listBookings error ${resp.status}:`, body);
        throw new Error(`TidyCal API error: ${resp.status}`);
    }

    const data = await resp.json();
    return {
        bookings: data.data || [],
        total: data.total || 0,
    };
}

/**
 * Cancel a booking by ID.
 */
export async function cancelBooking(bookingId: number): Promise<void> {
    const url = `${TIDYCAL_BASE}/bookings/${bookingId}/cancel`;
    const resp = await fetch(url, {
        method: "PATCH",
        headers: headers(),
    });

    if (!resp.ok) {
        const body = await resp.text();
        console.error(`TidyCal cancelBooking error ${resp.status}:`, body);
        throw new Error(`TidyCal cancel failed: ${resp.status}`);
    }
}
