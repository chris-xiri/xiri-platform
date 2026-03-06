import { QuoteLineItem } from '@xiri/shared';

// ─── Pure Helper Functions ────────────────────────────────────────────
// All functions here are pure (no side effects, no React hooks, no Firebase).
// They are the primary targets for unit tests.

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Strip undefined values recursively before Firestore writes */
export function stripUndefined(obj: any): any {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && typeof obj.toDate !== 'function') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, stripUndefined(v)])
        );
    }
    return obj;
}

/** Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.) */
export function getOrdinalSuffix(n: number): string {
    if (n >= 11 && n <= 13) return 'th';
    const last = n % 10;
    if (last === 1) return 'st';
    if (last === 2) return 'nd';
    if (last === 3) return 'rd';
    return 'th';
}

/** Human-readable frequency display string for a line item */
export function FrequencyDisplay(item: QuoteLineItem): string {
    const WEEK_NAMES = ['1st', '2nd', '3rd', '4th'];
    const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (item.frequency === 'one_time') return 'One-Time';
    if (item.frequency === 'nightly') return 'Daily (Mon–Sun)';
    if (item.frequency === 'custom_days' && item.daysOfWeek) {
        const isWeekdays = JSON.stringify(item.daysOfWeek) === JSON.stringify([false, true, true, true, true, true, false]);
        if (isWeekdays) return 'Weekdays (Mon–Fri)';
        const count = item.daysOfWeek.filter(Boolean).length;
        const days = item.daysOfWeek.map((d, i) => d ? DAY_LABELS[i] : null).filter(Boolean);
        return `${count}x/week (${days.join(', ')})`;
    }
    const base = item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1);
    if ((item.frequency === 'monthly' || item.frequency === 'quarterly') && item.monthlyPattern) {
        if (item.monthlyPattern.type === 'day_of_month') {
            return `${base} (on the ${item.monthlyPattern.day}${getOrdinalSuffix(item.monthlyPattern.day)})`;
        }
        if (item.monthlyPattern.type === 'nth_weekday') {
            return `${base} (${WEEK_NAMES[item.monthlyPattern.week - 1]} ${FULL_DAYS[item.monthlyPattern.dayOfWeek]})`;
        }
    }
    return base;
}

/** Format a number as USD currency */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

/** Compute totals from line items – used in both step 3 and step 4 */
export interface QuoteTotals {
    activeItems: QuoteLineItem[];
    recurringItems: QuoteLineItem[];
    oneTimeItems: QuoteLineItem[];
    recurringSubtotal: number;
    oneTimeSubtotal: number;
    subtotalBeforeTax: number;
    recurringTax: number;
    oneTimeTax: number;
    totalTax: number;
    totalMonthly: number;
    totalOneTime: number;
}

export function computeTotals(lineItems: QuoteLineItem[]): QuoteTotals {
    const activeItems = lineItems.filter(li => li.lineItemStatus !== 'cancelled');
    const recurringItems = activeItems.filter(li => li.frequency !== 'one_time');
    const oneTimeItems = activeItems.filter(li => li.frequency === 'one_time');
    const recurringSubtotal = recurringItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const oneTimeSubtotal = oneTimeItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const subtotalBeforeTax = activeItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const recurringTax = recurringItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const oneTimeTax = oneTimeItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const totalTax = activeItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const totalMonthly = recurringSubtotal + recurringTax;
    const totalOneTime = oneTimeSubtotal + oneTimeTax;

    return {
        activeItems, recurringItems, oneTimeItems,
        recurringSubtotal, oneTimeSubtotal, subtotalBeforeTax,
        recurringTax, oneTimeTax, totalTax,
        totalMonthly, totalOneTime,
    };
}
