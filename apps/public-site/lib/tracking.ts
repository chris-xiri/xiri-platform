'use client';

export type EventName =
    | 'page_view'
    | 'service_view'
    | 'click_cta'
    | 'lead_submission_start'
    | 'lead_submission_success'
    | 'lead_submission_error';

export interface EventProperties {
    [key: string]: string | number | boolean | undefined;
}

// Custom Event for Debug Overlay
export const DEBUG_EVENT_NAME = 'xiri-tracking-debug';

export const trackEvent = (name: EventName, properties?: EventProperties) => {
    const timestamp = new Date().toISOString();

    // 1. Log to console for development
    if (process.env.NODE_ENV === 'development') {
        console.groupCollapsed(`[Tracking] ${name}`);
        console.table(properties);
        console.groupEnd();

        // Dispatch event for Debug Overlay
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME, {
                detail: { name, properties, timestamp }
            }));
        }
    }

    // 2. Send to Google Analytics (if configured)
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', name, properties);
    }
};

export const initTracking = () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[Tracking] Initialized');
    }
};
