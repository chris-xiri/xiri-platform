// ─── Structured Logging for QuoteBuilder ──────────────────────────────
// All console output is prefixed with [QuoteBuilder] for easy filtering
// in production logs and browser DevTools.

type LogLevel = 'info' | 'warn' | 'error';

interface LogEvent {
    event: string;
    [key: string]: unknown;
}

function log(level: LogLevel, { event, ...data }: LogEvent) {
    const prefix = `[QuoteBuilder]`;
    const payload = Object.keys(data).length > 0 ? data : undefined;

    switch (level) {
        case 'info':
            console.log(prefix, event, ...(payload ? [payload] : []));
            break;
        case 'warn':
            console.warn(prefix, event, ...(payload ? [payload] : []));
            break;
        case 'error':
            console.error(prefix, event, ...(payload ? [payload] : []));
            break;
    }
}

export const quoteLogger = {
    stepChange: (from: number, to: number) =>
        log('info', { event: 'step_change', from, to }),

    leadSelected: (leadId: string, businessName: string) =>
        log('info', { event: 'lead_selected', leadId, businessName }),

    locationAdded: (locationId: string, name: string) =>
        log('info', { event: 'location_added', locationId, name }),

    locationRemoved: (locationId: string) =>
        log('info', { event: 'location_removed', locationId }),

    lineItemAdded: (itemId: string, locationId: string) =>
        log('info', { event: 'line_item_added', itemId, locationId }),

    lineItemUpdated: (itemId: string, fields: string[]) =>
        log('info', { event: 'line_item_updated', itemId, fields }),

    lineItemRemoved: (itemId: string) =>
        log('info', { event: 'line_item_removed', itemId }),

    quoteSubmitted: (quoteId: string, totalMonthly: number, isRevision: boolean) =>
        log('info', { event: 'quote_submitted', quoteId, totalMonthly, isRevision }),

    quoteError: (action: string, error: unknown) =>
        log('error', { event: 'quote_error', action, error: error instanceof Error ? error.message : String(error) }),

    validationFailed: (step: number, reason: string) =>
        log('warn', { event: 'validation_failed', step, reason }),
};
