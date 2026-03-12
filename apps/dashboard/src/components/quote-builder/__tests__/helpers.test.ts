import { describe, it, expect } from 'vitest';
import { stripUndefined, getOrdinalSuffix, FrequencyDisplay, formatCurrency, computeTotals } from '../helpers';
import { QuoteLineItem } from '@xiri-facility-solutions/shared';

// ─── stripUndefined ───────────────────────────────────────────────────
describe('stripUndefined', () => {
    it('removes top-level undefined values', () => {
        expect(stripUndefined({ a: 1, b: undefined, c: 'hello' }))
            .toEqual({ a: 1, c: 'hello' });
    });

    it('handles nested objects', () => {
        expect(stripUndefined({ a: { b: 1, c: undefined }, d: 'ok' }))
            .toEqual({ a: { b: 1 }, d: 'ok' });
    });

    it('handles arrays', () => {
        expect(stripUndefined([{ a: 1, b: undefined }, { c: 2 }]))
            .toEqual([{ a: 1 }, { c: 2 }]);
    });

    it('preserves Date objects', () => {
        const date = new Date('2024-01-01');
        expect(stripUndefined({ d: date })).toEqual({ d: date });
    });

    it('preserves null values', () => {
        expect(stripUndefined({ a: null, b: 1 })).toEqual({ a: null, b: 1 });
    });

    it('handles empty object', () => {
        expect(stripUndefined({})).toEqual({});
    });

    it('returns primitives unchanged', () => {
        expect(stripUndefined(42)).toBe(42);
        expect(stripUndefined('hello')).toBe('hello');
        expect(stripUndefined(null)).toBe(null);
    });
});

// ─── getOrdinalSuffix ─────────────────────────────────────────────────
describe('getOrdinalSuffix', () => {
    it('returns "st" for 1, 21, 31', () => {
        expect(getOrdinalSuffix(1)).toBe('st');
        expect(getOrdinalSuffix(21)).toBe('st');
        expect(getOrdinalSuffix(31)).toBe('st');
    });

    it('returns "nd" for 2, 22', () => {
        expect(getOrdinalSuffix(2)).toBe('nd');
        expect(getOrdinalSuffix(22)).toBe('nd');
    });

    it('returns "rd" for 3, 23', () => {
        expect(getOrdinalSuffix(3)).toBe('rd');
        expect(getOrdinalSuffix(23)).toBe('rd');
    });

    it('returns "th" for 11, 12, 13 (special teens)', () => {
        expect(getOrdinalSuffix(11)).toBe('th');
        expect(getOrdinalSuffix(12)).toBe('th');
        expect(getOrdinalSuffix(13)).toBe('th');
    });

    it('returns "th" for other numbers', () => {
        expect(getOrdinalSuffix(4)).toBe('th');
        expect(getOrdinalSuffix(15)).toBe('th');
        expect(getOrdinalSuffix(20)).toBe('th');
    });
});

// ─── FrequencyDisplay ─────────────────────────────────────────────────
describe('FrequencyDisplay', () => {
    const makeItem = (overrides: Partial<QuoteLineItem> = {}): QuoteLineItem => ({
        id: 'test',
        locationId: 'loc_1',
        locationName: 'Test',
        locationAddress: '123 Main',
        locationCity: 'NY',
        locationState: 'NY',
        locationZip: '10001',
        serviceType: 'Cleaning',
        frequency: 'weekly',
        clientRate: 100,
        lineItemStatus: 'pending',
        addedBy: 'user1',
        addedByRole: 'sales',
        ...overrides,
    });

    it('returns "One-Time" for one_time frequency', () => {
        expect(FrequencyDisplay(makeItem({ frequency: 'one_time' }))).toBe('One-Time');
    });

    it('returns "Daily (Mon–Sun)" for nightly', () => {
        expect(FrequencyDisplay(makeItem({ frequency: 'nightly' }))).toBe('Daily (Mon–Sun)');
    });

    it('returns "Weekdays (Mon–Fri)" for standard weekday pattern', () => {
        expect(FrequencyDisplay(makeItem({
            frequency: 'custom_days',
            daysOfWeek: [false, true, true, true, true, true, false],
        }))).toBe('Weekdays (Mon–Fri)');
    });

    it('returns Nx/week for custom days', () => {
        expect(FrequencyDisplay(makeItem({
            frequency: 'custom_days',
            daysOfWeek: [false, true, false, true, false, true, false],
        }))).toBe('3x/week (Mon, Wed, Fri)');
    });

    it('capitalizes simple frequencies', () => {
        expect(FrequencyDisplay(makeItem({ frequency: 'weekly' }))).toBe('Weekly');
        expect(FrequencyDisplay(makeItem({ frequency: 'biweekly' }))).toBe('Biweekly');
    });

    it('shows monthly day_of_month pattern', () => {
        expect(FrequencyDisplay(makeItem({
            frequency: 'monthly',
            monthlyPattern: { type: 'day_of_month', day: 15 },
        }))).toBe('Monthly (on the 15th)');
    });

    it('shows monthly nth_weekday pattern', () => {
        expect(FrequencyDisplay(makeItem({
            frequency: 'monthly',
            monthlyPattern: { type: 'nth_weekday', week: 2, dayOfWeek: 1 },
        }))).toBe('Monthly (2nd Monday)');
    });
});

// ─── formatCurrency ───────────────────────────────────────────────────
describe('formatCurrency', () => {
    it('formats positive amounts', () => {
        expect(formatCurrency(2500)).toBe('$2,500');
    });

    it('formats zero', () => {
        expect(formatCurrency(0)).toBe('$0');
    });

    it('formats large amounts', () => {
        expect(formatCurrency(1250000)).toBe('$1,250,000');
    });

    it('handles decimal amounts', () => {
        // minimumFractionDigits: 0 rounds to nearest whole number
        const result = formatCurrency(99.99);
        expect(result).toMatch(/^\$\d/);
    });
});

// ─── computeTotals ────────────────────────────────────────────────────
describe('computeTotals', () => {
    const makeItem = (overrides: Partial<QuoteLineItem> = {}): QuoteLineItem => ({
        id: 'test',
        locationId: 'loc_1',
        locationName: 'Test',
        locationAddress: '123 Main',
        locationCity: 'NY',
        locationState: 'NY',
        locationZip: '10001',
        serviceType: 'Cleaning',
        frequency: 'weekly',
        clientRate: 1000,
        lineItemStatus: 'pending',
        addedBy: 'user1',
        addedByRole: 'sales',
        ...overrides,
    });

    it('computes totals for recurring items', () => {
        const items = [
            makeItem({ id: 'a', clientRate: 2000, taxAmount: 178 }),
            makeItem({ id: 'b', clientRate: 1500, taxAmount: 133 }),
        ];
        const totals = computeTotals(items);
        expect(totals.recurringSubtotal).toBe(3500);
        expect(totals.recurringTax).toBe(311);
        expect(totals.totalMonthly).toBe(3811);
        expect(totals.oneTimeItems).toHaveLength(0);
    });

    it('separates one-time from recurring', () => {
        const items = [
            makeItem({ id: 'a', frequency: 'weekly', clientRate: 2000 }),
            makeItem({ id: 'b', frequency: 'one_time', clientRate: 500 }),
        ];
        const totals = computeTotals(items);
        expect(totals.recurringItems).toHaveLength(1);
        expect(totals.oneTimeItems).toHaveLength(1);
        expect(totals.recurringSubtotal).toBe(2000);
        expect(totals.oneTimeSubtotal).toBe(500);
    });

    it('excludes cancelled items', () => {
        const items = [
            makeItem({ id: 'a', clientRate: 2000 }),
            makeItem({ id: 'b', clientRate: 1000, lineItemStatus: 'cancelled' }),
        ];
        const totals = computeTotals(items);
        expect(totals.activeItems).toHaveLength(1);
        expect(totals.subtotalBeforeTax).toBe(2000);
    });

    it('handles empty array', () => {
        const totals = computeTotals([]);
        expect(totals.activeItems).toHaveLength(0);
        expect(totals.totalMonthly).toBe(0);
        expect(totals.totalOneTime).toBe(0);
    });
});
