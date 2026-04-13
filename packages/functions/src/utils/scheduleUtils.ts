/**
 * scheduleUtils — Business-day scheduling helpers for outreach sequences.
 *
 * Research-backed defaults (2025 industry data):
 * - Best days: Tuesday, Wednesday, Thursday (Mon has inbox chaos, Fri has low engagement)
 * - Best time: 10:00 AM ET (14:00 UTC) — peak open-rate window is 9 AM–12 PM local
 * - ~23% of opens happen within the first hour of delivery
 * - Saturday and Sunday are excluded entirely
 *
 * Sources: HubSpot 2024, Mailchimp 2023, Brevo 2025, Twilio SendGrid 2025
 */

/**
 * Default send hour in UTC. 14:00 UTC = 10:00 AM ET (within the 9–12 AM sweet spot).
 */
export const DEFAULT_SEND_HOUR_UTC = 14;

/**
 * Advance a date by `businessDays`, skipping Saturdays (6) and Sundays (0).
 *
 * If the resulting date still falls on a weekend (e.g. dayOffset === 0 and
 * today is Saturday), roll forward to Monday.
 *
 * @param start  - The reference start date (typically "now")
 * @param businessDays - Number of business days to add (0 = today or next weekday)
 * @returns A new Date advanced by the requested business days
 */
export function addBusinessDays(start: Date, businessDays: number): Date {
    const result = new Date(start);

    if (businessDays === 0) {
        // If today is a weekend, roll forward to Monday
        return skipToWeekday(result);
    }

    let remaining = businessDays;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay(); // 0=Sun, 6=Sat
        if (day !== 0 && day !== 6) {
            remaining--;
        }
    }

    return result;
}

/**
 * If the given date falls on Saturday or Sunday, roll forward to Monday.
 * Otherwise return the date unchanged (returns a new Date instance).
 */
export function skipToWeekday(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    if (day === 6) {
        // Saturday → Monday (+2)
        result.setDate(result.getDate() + 2);
    } else if (day === 0) {
        // Sunday → Monday (+1)
        result.setDate(result.getDate() + 1);
    }
    return result;
}

/**
 * Build a scheduled send Date from a day offset, skipping weekends.
 *
 * For `dayOffset === 0`, sends immediately (returns `now`).
 * For `dayOffset > 0`, adds that many calendar days then ensures the
 * result is a weekday, set to `sendHourUTC`.
 *
 * @param now          - current time
 * @param dayOffset    - calendar-day offset from the sequence definition
 * @param sendHourUTC  - hour in UTC to schedule the email (default 14 = 10 AM ET)
 */
export function buildScheduledDate(
    now: Date,
    dayOffset: number,
    sendHourUTC: number = DEFAULT_SEND_HOUR_UTC,
): Date {
    if (dayOffset === 0) {
        return now; // Send immediately for first touch
    }

    const scheduled = new Date(now);
    scheduled.setDate(scheduled.getDate() + dayOffset);
    scheduled.setHours(sendHourUTC, 0, 0, 0);

    // Ensure we don't land on a weekend
    return skipToWeekday(scheduled);
}
