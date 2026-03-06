import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quoteLogger } from '../logger';

describe('quoteLogger', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('logs step changes with [QuoteBuilder] prefix', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        quoteLogger.stepChange(0, 1);
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'step_change',
            { from: 0, to: 1 }
        );
    });

    it('logs lead selection', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        quoteLogger.leadSelected('lead_123', 'Acme Corp');
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'lead_selected',
            { leadId: 'lead_123', businessName: 'Acme Corp' }
        );
    });

    it('logs location operations', () => {
        const addSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        quoteLogger.locationAdded('loc_1', 'Main Office');
        expect(addSpy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'location_added',
            { locationId: 'loc_1', name: 'Main Office' }
        );

        quoteLogger.locationRemoved('loc_1');
        expect(addSpy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'location_removed',
            { locationId: 'loc_1' }
        );
    });

    it('logs line item operations', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        quoteLogger.lineItemAdded('li_1', 'loc_1');
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'line_item_added',
            { itemId: 'li_1', locationId: 'loc_1' }
        );

        quoteLogger.lineItemUpdated('li_1', ['serviceType', 'clientRate']);
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'line_item_updated',
            { itemId: 'li_1', fields: ['serviceType', 'clientRate'] }
        );
    });

    it('logs quote submission', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        quoteLogger.quoteSubmitted('quote_abc', 5000, false);
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'quote_submitted',
            { quoteId: 'quote_abc', totalMonthly: 5000, isRevision: false }
        );
    });

    it('logs errors with console.error', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        quoteLogger.quoteError('handleSubmit', new Error('Firestore timeout'));
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'quote_error',
            { action: 'handleSubmit', error: 'Firestore timeout' }
        );
    });

    it('logs validation failures with console.warn', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        quoteLogger.validationFailed(2, 'Missing service type');
        expect(spy).toHaveBeenCalledWith(
            '[QuoteBuilder]',
            'validation_failed',
            { step: 2, reason: 'Missing service type' }
        );
    });
});
