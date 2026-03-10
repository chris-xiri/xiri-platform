'use client';

export type EventName =
    // Existing events
    | 'page_view'
    | 'service_view'
    | 'click_cta'

    // Lead Acquisition Funnel
    | 'lead_form_view'
    | 'lead_zip_submit'
    | 'lead_zip_rejected'
    | 'lead_submission_start'
    | 'lead_submission_success'
    | 'lead_submission_error'
    | 'audit_start'
    | 'audit_step_complete'
    | 'audit_submit'
    | 'audit_success'

    // Calculator Funnel (existing)
    | 'calculator_view'
    | 'calculator_estimate'
    | 'calculator_advanced_toggle'
    | 'calculator_cta_click'
    | 'calculator_email_submit'

    // Vendor Onboarding Funnel
    | 'onboarding_start'
    | 'onboarding_language'
    | 'onboarding_step_complete'
    | 'onboarding_submit'
    | 'onboarding_success'

    // Quote Review Funnel
    | 'quote_review_view'
    | 'quote_accept'
    | 'quote_request_changes'
    | 'quote_response_success'

    // Waitlist
    | 'waitlist_view'
    | 'waitlist_submit'

    // Invoice Payment
    | 'invoice_view'
    | 'invoice_payment_method_select'

    // SEO Content Engagement
    | 'guide_view'
    | 'industry_card_click'
    | 'solution_page_view'
    | 'contractor_page_view'

    // Tools Engagement
    | 'tool_view'
    | 'tool_search'
    | 'tool_filter'
    | 'tool_result_expand'
    | 'tool_external_click'
    | 'tool_cta_click'

    // Referral Partner Funnel
    | 'referral_page_view'
    | 'referral_form_view'
    | 'referral_form_submit'
    | 'referral_form_success'
    | 'referral_form_error';

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
