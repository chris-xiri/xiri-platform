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
 * Compute nth weekday of a month (e.g., 4th Thursday of November = Thanksgiving).
 * weekday: 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat. month: 1-12.
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const offset = (weekday - firstDow + 7) % 7;
    return 1 + offset + (n - 1) * 7;
}

/**
 * Compute last weekday of a month (e.g., last Monday of May = Memorial Day).
 */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDow = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
    const offset = (lastDow - weekday + 7) % 7;
    return lastDay - offset;
}

/**
 * Returns the US holiday name if `date` falls on a major US holiday when NY
 * dental/orthodontic practices are closed (evaluated in America/New_York),
 * otherwise `null`.
 */
export function isUsBusinessHoliday(date: Date): string | null {
    const etStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
    const [year, month, day] = etStr.split('-').map(Number);

    // Fixed-date holidays
    if (month === 1 && day === 1) return "New Year's Day";
    if (month === 7 && day === 4) return 'Independence Day';
    if (month === 12 && day === 24) return 'Christmas Eve';
    if (month === 12 && day === 25) return 'Christmas Day';

    // Floating Monday holidays
    if (month === 5 && day === lastWeekdayOfMonth(year, 5, 1)) return 'Memorial Day';
    if (month === 9 && day === nthWeekdayOfMonth(year, 9, 1, 1)) return 'Labor Day';

    // Thanksgiving (4th Thursday of Nov) + Black Friday (day after Thanksgiving)
    const thanksgivingDay = nthWeekdayOfMonth(year, 11, 4, 4);
    if (month === 11 && day === thanksgivingDay) return 'Thanksgiving Day';
    if (month === 11 && day === thanksgivingDay + 1) return 'Day After Thanksgiving';

    return null;
}

/**
 * Advance a date by `businessDays`, skipping weekends and US business holidays.
 */
export function addBusinessDays(start: Date, businessDays: number): Date {
    const result = new Date(start);

    if (businessDays === 0) {
        return skipToWeekday(result);
    }

    let remaining = businessDays;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay(); // 0=Sun, 6=Sat
        if (day !== 0 && day !== 6 && !isUsBusinessHoliday(result)) {
            remaining--;
        }
    }

    return result;
}

/**
 * If the given date falls on Saturday, Sunday, or a major US holiday,
 * roll forward to the next open weekday.
 */
export function skipToWeekday(date: Date): Date {
    const result = new Date(date);
    for (let guard = 0; guard < 10; guard++) {
        const day = result.getDay();
        if (day === 6) {
            result.setDate(result.getDate() + 2);
        } else if (day === 0) {
            result.setDate(result.getDate() + 1);
        } else if (isUsBusinessHoliday(result)) {
            result.setDate(result.getDate() + 1);
        } else {
            break;
        }
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
