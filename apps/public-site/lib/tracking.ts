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

    // SEO / AEO / GEO Content Engagement
    | 'guide_view'
    | 'industry_card_click'
    | 'solution_page_view'
    | 'contractor_page_view'
    | 'case_study_view'
    | 'case_study_cta_click'
    | 'dental_hub_funnel_click'
    | 'ai_referral_session'

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
    | 'referral_form_error'

    // AI Sales Assistant & SMS Walkthrough
    | 'ai_chat_opened'
    | 'ai_chat_message'
    | 'ai_chat_lead_captured'
    | 'ask_any_ai_click'
    | 'sms_walkthrough_click';

export interface EventProperties {
    [key: string]: string | number | boolean | undefined;
}

export interface AttributionSnapshot {
    initialLandingPage: string;
    initialReferrer: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    aiSource: string;
    firstTouchTimestamp: string;
}

const ATTRIBUTION_STORAGE_KEY = 'xiri_first_touch_attribution_v1';

// Custom Event for Debug Overlay
export const DEBUG_EVENT_NAME = 'xiri-tracking-debug';

const AI_REFERRER_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /chatgpt\.com|openai\.com/i, name: 'chatgpt' },
    { pattern: /perplexity\.ai/i, name: 'perplexity' },
    { pattern: /claude\.ai|anthropic\.com/i, name: 'claude' },
    { pattern: /gemini\.google\.com|bard\.google\.com/i, name: 'gemini' },
    { pattern: /copilot\.microsoft\.com|bing\.com\/chat/i, name: 'copilot' },
    { pattern: /you\.com/i, name: 'you_ai' },
    { pattern: /phind\.com/i, name: 'phind' },
];

function detectAiSource(referrer: string, utmSource: string): string {
    const combined = `${referrer} ${utmSource}`.toLowerCase();
    for (const { pattern, name } of AI_REFERRER_PATTERNS) {
        if (pattern.test(combined)) return name;
    }
    return '';
}

export function captureFirstTouchAttribution(): AttributionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        const existing = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
        if (existing) {
            return JSON.parse(existing) as AttributionSnapshot;
        }

        const params = new URLSearchParams(window.location.search);
        const referrer = document.referrer || 'direct';
        const utmSource = params.get('utm_source') || '';
        const utmMedium = params.get('utm_medium') || '';
        const utmCampaign = params.get('utm_campaign') || '';
        const aiSource = detectAiSource(referrer, utmSource);

        const snapshot: AttributionSnapshot = {
            initialLandingPage: window.location.pathname + window.location.search,
            initialReferrer: referrer,
            utmSource,
            utmMedium,
            utmCampaign,
            aiSource,
            firstTouchTimestamp: new Date().toISOString(),
        };

        sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(snapshot));

        if (aiSource) {
            trackEvent('ai_referral_session', {
                ai_engine: aiSource,
                landing_page: window.location.pathname,
                referrer,
            });
        }

        return snapshot;
    } catch {
        return null;
    }
}

export function getFirstTouchAttribution(): AttributionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AttributionSnapshot) : captureFirstTouchAttribution();
    } catch {
        return null;
    }
}

export const trackEvent = (name: EventName, properties?: EventProperties) => {
    const timestamp = new Date().toISOString();
    const isDebugEnabled =
        process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' && window.location.search.includes('debug_tracking=1'));

    const enrichedProps: EventProperties = {
        page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        ...properties,
    };

    // 1. Log to console & Debug Overlay when in dev or ?debug_tracking=1
    if (isDebugEnabled) {
        console.groupCollapsed(`[Tracking] ${name}`);
        console.table(enrichedProps);
        console.groupEnd();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME, {
                detail: { name, properties: enrichedProps, timestamp }
            }));
        }
    }

    // 2. Send to Google Analytics (if configured)
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', name, enrichedProps);
    }

    // 3. Tag Microsoft Clarity session for funnel filtering
    if (typeof window !== 'undefined' && typeof (window as any).clarity === 'function') {
        try {
            (window as any).clarity('set', 'last_event', name);
            if (enrichedProps.source) {
                (window as any).clarity('set', 'lead_source', String(enrichedProps.source));
            }
        } catch {
            // ignore clarity errors
        }
    }
};

export const initTracking = () => {
    const snapshot = captureFirstTouchAttribution();
    if (process.env.NODE_ENV === 'development') {
        console.log('[Tracking] Initialized', snapshot);
    }
};
