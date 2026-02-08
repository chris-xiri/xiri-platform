
// Business Hours Config
const START_HOUR = 9; // 9 AM
const END_HOUR = 17; // 5 PM
// Timezone offset for Austin, TX (CST)
// const TIMEZONE_OFFSET = -6; // CST (approximate for Austin demo)

export function getNextBusinessSlot(urgency: 'URGENT' | 'SUPPLY'): Date {
    const now = new Date();
    // Adjust to target timezone if needed, simple version for demo uses server time (UTC)
    // For robust production, use minimal-timezone or date-fns-tz

    // Simple logic:
    // If Urgent and within Mon-Fri 9-5: Send in 10 mins.
    // Else: Next Business Day at 9 AM (Urgent) or 10 AM (Supply).

    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const hour = now.getHours();

    const isWeekend = day === 0 || day === 6;
    const isBusinessHours = !isWeekend && hour >= START_HOUR && hour < END_HOUR;

    if (urgency === 'URGENT' && isBusinessHours) {
        // Schedule for 10 minutes from now
        return new Date(now.getTime() + 10 * 60000);
    }

    // Calculate next business day
    let nextDate = new Date(now);

    if (day === 5) { // Friday -> Monday
        nextDate.setDate(now.getDate() + 3);
    } else if (day === 6) { // Saturday -> Monday
        nextDate.setDate(now.getDate() + 2);
    } else { // Sun-Thu -> Next Day
        nextDate.setDate(now.getDate() + 1);
    }

    // Set Time
    nextDate.setHours(urgency === 'URGENT' ? START_HOUR : START_HOUR + 1, 0, 0, 0);

    // If today is Sunday, we just moved to Monday, which is correct.
    // If today is Friday after 5pm, we moved to Monday, correct.
    // If today is Monday after 5pm, we move to Tuesday, correct.

    return nextDate;
}
