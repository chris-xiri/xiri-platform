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
    referrerDomain: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    searchQuery: string;
    aiSource: string;
    channel: string;
    gclid: string;
    gbraid: string;
    wbraid: string;
    msclkid: string;
    fbclid: string;
    liFatId: string;
    firstTouchTimestamp: string;
}

export interface LeadAttributionPayload {
    source: string;
    formSource: string;
    medium: string;
    campaign: string;
    landingPage: string;
    conversionPage: string;
    referrer: string;
    referrerDomain: string | null;
    aiEngine: string | null;
    channel: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    searchQuery: string | null;
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    msclkid: string | null;
    fbclid: string | null;
    liFatId: string | null;
    pagesVisited: string[];
    pageCount: number;
    visitCount: number;
    firstTouchAt: string | null;
    convertedAt: string;
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
    timezone: string | null;
    screenResolution: string | null;
    lastTouch: {
        source?: string;
        medium?: string;
        campaign?: string;
        term?: string | null;
        content?: string | null;
        referrer?: string;
        referrerDomain?: string | null;
        landingPage?: string;
        aiEngine?: string | null;
        channel?: string;
        searchQuery?: string | null;
        gclid?: string | null;
        gbraid?: string | null;
        wbraid?: string | null;
        msclkid?: string | null;
        fbclid?: string | null;
        liFatId?: string | null;
        timestamp?: string;
    } | null;
}

const LEGACY_ATTRIBUTION_KEY = 'xiri_first_touch_attribution_v1';
const FIRST_TOUCH_STORAGE_KEY = 'xiri_first_touch_attribution_v2';
const LAST_TOUCH_STORAGE_KEY = 'xiri_last_touch_attribution_v1';
const SESSION_JOURNEY_KEY = 'xiri_session_journey_v1';
const VISIT_COUNT_KEY = 'xiri_visit_count_v1';
const VISIT_COUNTED_SESSION_KEY = 'xiri_visit_counted_v1';
const FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Custom Event for Debug Overlay
export const DEBUG_EVENT_NAME = 'xiri-tracking-debug';

const AI_REFERRER_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /chatgpt\.com|chat\.openai\.com|openai\.com/i, name: 'chatgpt' },
    { pattern: /perplexity\.ai/i, name: 'perplexity' },
    { pattern: /claude\.ai|anthropic\.com/i, name: 'claude' },
    { pattern: /gemini\.google\.com|bard\.google\.com/i, name: 'gemini' },
    { pattern: /copilot\.microsoft\.com|bing\.com\/chat/i, name: 'copilot' },
    { pattern: /grok\.com|x\.ai/i, name: 'grok' },
    { pattern: /meta\.ai/i, name: 'meta_ai' },
    { pattern: /you\.com/i, name: 'you_ai' },
    { pattern: /phind\.com/i, name: 'phind' },
];

const SEARCH_ENGINE_DOMAINS: { pattern: RegExp; name: string; queryParams: string[] }[] = [
    { pattern: /(^|\.)google\.[a-z.]+$/i, name: 'google', queryParams: ['q'] },
    { pattern: /(^|\.)bing\.com$/i, name: 'bing', queryParams: ['q'] },
    { pattern: /(^|\.)yahoo\.com$/i, name: 'yahoo', queryParams: ['p', 'q'] },
    { pattern: /(^|\.)duckduckgo\.com$/i, name: 'duckduckgo', queryParams: ['q'] },
    { pattern: /(^|\.)ecosia\.org$/i, name: 'ecosia', queryParams: ['q'] },
    { pattern: /(^|\.)search\.brave\.com$/i, name: 'brave', queryParams: ['q'] },
    { pattern: /(^|\.)yandex\.[a-z.]+$/i, name: 'yandex', queryParams: ['text', 'q'] },
    { pattern: /(^|\.)aol\.com$/i, name: 'aol', queryParams: ['q', 'query'] },
    { pattern: /(^|\.)ask\.com$/i, name: 'ask', queryParams: ['q'] },
    { pattern: /(^|\.)startpage\.com$/i, name: 'startpage', queryParams: ['query', 'q'] },
];

const SOCIAL_DOMAINS: { pattern: RegExp; name: string }[] = [
    { pattern: /(^|\.)(linkedin\.com|lnkd\.in)$/i, name: 'linkedin' },
    { pattern: /(^|\.)(facebook\.com|fb\.com|messenger\.com)$/i, name: 'facebook' },
    { pattern: /(^|\.)instagram\.com$/i, name: 'instagram' },
    { pattern: /(^|\.)(twitter\.com|x\.com|t\.co)$/i, name: 'x' },
    { pattern: /(^|\.)(youtube\.com|youtu\.be)$/i, name: 'youtube' },
    { pattern: /(^|\.)reddit\.com$/i, name: 'reddit' },
    { pattern: /(^|\.)tiktok\.com$/i, name: 'tiktok' },
    { pattern: /(^|\.)nextdoor\.com$/i, name: 'nextdoor' },
    { pattern: /(^|\.)pinterest\.com$/i, name: 'pinterest' },
];

function isSelfReferrer(referrer: string): boolean {
    if (!referrer || referrer === 'direct') return true;
    try {
        const refHost = new URL(referrer).hostname.replace(/^www\./i, '').toLowerCase();
        const curHost = typeof window !== 'undefined'
            ? window.location.hostname.replace(/^www\./i, '').toLowerCase()
            : '';
        if (!refHost) return true;
        if (refHost === curHost) return true;
        if (refHost === 'xiri.ai' || refHost.endsWith('.xiri.ai')) return true;
        return false;
    } catch {
        return false;
    }
}

function parseReferrerInfo(rawReferrer: string): {
    referrer: string;
    referrerDomain: string;
    searchEngine: string;
    socialNetwork: string;
    searchQuery: string;
} {
    if (!rawReferrer || rawReferrer === 'direct' || isSelfReferrer(rawReferrer)) {
        return {
            referrer: 'direct',
            referrerDomain: '',
            searchEngine: '',
            socialNetwork: '',
            searchQuery: '',
        };
    }

    try {
        const parsed = new URL(rawReferrer);
        const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();

        let searchEngine = '';
        let searchQuery = '';
        for (const engine of SEARCH_ENGINE_DOMAINS) {
            if (engine.pattern.test(domain)) {
                searchEngine = engine.name;
                for (const qp of engine.queryParams) {
                    const val = parsed.searchParams.get(qp);
                    if (val && val.trim()) {
                        searchQuery = val.trim().slice(0, 200);
                        break;
                    }
                }
                break;
            }
        }

        let socialNetwork = '';
        for (const social of SOCIAL_DOMAINS) {
            if (social.pattern.test(domain)) {
                socialNetwork = social.name;
                break;
            }
        }

        return {
            referrer: rawReferrer.slice(0, 500),
            referrerDomain: domain,
            searchEngine,
            socialNetwork,
            searchQuery,
        };
    } catch {
        return {
            referrer: rawReferrer.slice(0, 500),
            referrerDomain: '',
            searchEngine: '',
            socialNetwork: '',
            searchQuery: '',
        };
    }
}

function detectAiSource(referrer: string, utmSource: string): string {
    const combined = `${referrer} ${utmSource}`.toLowerCase();
    for (const { pattern, name } of AI_REFERRER_PATTERNS) {
        if (pattern.test(combined)) return name;
    }
    return '';
}

function classifyChannel(input: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    aiSource: string;
    searchEngine: string;
    socialNetwork: string;
    referrerDomain: string;
    gclid: string;
    gbraid: string;
    wbraid: string;
    msclkid: string;
    fbclid: string;
    liFatId: string;
}): string {
    const medium = input.utmMedium.toLowerCase().trim();
    const source = input.utmSource.toLowerCase().trim();

    if (input.aiSource) return 'ai_search';

    const isPaidMedium = /^(cpc|ppc|paidsearch|paid_search|sem|paid|adwords|search_ads)$/.test(medium);
    const isPaidSocialMedium = /^(paid_social|paidsocial|social_paid|cpm|display|paid-social)$/.test(medium);

    if (input.gclid || input.gbraid || input.wbraid || input.msclkid || isPaidMedium) {
        if (isPaidSocialMedium || /(facebook|fb|instagram|ig|linkedin|tiktok|meta)/.test(source)) {
            return 'paid_social';
        }
        return 'paid_search';
    }

    if (isPaidSocialMedium || (input.liFatId && medium.includes('paid'))) {
        return 'paid_social';
    }

    if (/^(email|newsletter|drip|outreach|sequence|e-mail)$/.test(medium) || source === 'email') {
        return 'email';
    }

    if (input.searchEngine || medium === 'organic' || /^(google|bing|yahoo|duckduckgo|ecosia|brave)$/.test(source)) {
        return 'organic_search';
    }

    if (input.socialNetwork || input.fbclid || input.liFatId || medium === 'social' || /^(linkedin|facebook|instagram|twitter|x|youtube|reddit|tiktok|nextdoor)$/.test(source)) {
        return 'organic_social';
    }

    if (source || input.utmCampaign) {
        return 'campaign';
    }

    if (input.referrerDomain) {
        return 'referral';
    }

    return 'direct';
}

function defaultMediumForChannel(channel: string): string {
    switch (channel) {
        case 'paid_search': return 'cpc';
        case 'organic_search': return 'organic';
        case 'ai_search': return 'ai_answer_engine';
        case 'paid_social': return 'paid_social';
        case 'organic_social': return 'social';
        case 'email': return 'email';
        case 'referral': return 'referral';
        case 'campaign': return 'campaign';
        default: return 'direct';
    }
}

function buildSnapshotFromCurrentPage(): AttributionSnapshot {
    const params = new URLSearchParams(window.location.search);
    const refInfo = parseReferrerInfo(document.referrer || '');
    const utmSource = (params.get('utm_source') || '').trim();
    const utmMedium = (params.get('utm_medium') || '').trim();
    const utmCampaign = (params.get('utm_campaign') || '').trim();
    const utmTerm = (params.get('utm_term') || '').trim();
    const utmContent = (params.get('utm_content') || '').trim();
    const gclid = (params.get('gclid') || '').trim();
    const gbraid = (params.get('gbraid') || '').trim();
    const wbraid = (params.get('wbraid') || '').trim();
    const msclkid = (params.get('msclkid') || '').trim();
    const fbclid = (params.get('fbclid') || '').trim();
    const liFatId = (params.get('li_fat_id') || '').trim();
    const aiSource = detectAiSource(refInfo.referrer, utmSource);
    const searchQuery = refInfo.searchQuery || utmTerm || '';

    const channel = classifyChannel({
        utmSource,
        utmMedium,
        utmCampaign,
        aiSource,
        searchEngine: refInfo.searchEngine,
        socialNetwork: refInfo.socialNetwork,
        referrerDomain: refInfo.referrerDomain,
        gclid,
        gbraid,
        wbraid,
        msclkid,
        fbclid,
        liFatId,
    });

    return {
        initialLandingPage: window.location.pathname + window.location.search,
        initialReferrer: refInfo.referrer,
        referrerDomain: refInfo.referrerDomain,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        searchQuery,
        aiSource,
        channel,
        gclid,
        gbraid,
        wbraid,
        msclkid,
        fbclid,
        liFatId,
        firstTouchTimestamp: new Date().toISOString(),
    };
}

function hasExplicitCampaignSignals(s: AttributionSnapshot): boolean {
    return Boolean(
        s.utmSource ||
        s.utmMedium ||
        s.utmCampaign ||
        s.utmTerm ||
        s.gclid ||
        s.gbraid ||
        s.wbraid ||
        s.msclkid ||
        s.fbclid ||
        s.liFatId ||
        s.aiSource ||
        s.referrerDomain
    );
}

function resolveSnapshotSource(s: AttributionSnapshot): string {
    if (s.utmSource) return s.utmSource;
    if (s.aiSource) return `ai_${s.aiSource}`;
    if (s.gclid || s.gbraid || s.wbraid) return 'google';
    if (s.msclkid) return 'bing';
    if (s.referrerDomain) {
        const refInfo = parseReferrerInfo(s.initialReferrer);
        return refInfo.searchEngine || refInfo.socialNetwork || s.referrerDomain;
    }
    if (s.fbclid) return 'facebook';
    if (s.liFatId) return 'linkedin';
    return 'direct';
}

function detectDeviceInfo(): {
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
    timezone: string | null;
    screenResolution: string | null;
} {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return { deviceType: 'desktop', browser: 'Unknown', os: 'Unknown', timezone: null, screenResolution: null };
    }
    const ua = navigator.userAgent || '';
    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    const isMobile = !isTablet && /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const deviceType: 'mobile' | 'tablet' | 'desktop' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    let browser = 'Other';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Safari';

    let os = 'Other';
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let timezone: string | null = null;
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        timezone = null;
    }

    const screenResolution = window.screen?.width && window.screen?.height
        ? `${window.screen.width}x${window.screen.height}`
        : null;

    return { deviceType, browser, os, timezone, screenResolution };
}

function incrementVisitCountIfNewSession(): number {
    if (typeof window === 'undefined') return 1;
    try {
        const alreadyCounted = sessionStorage.getItem(VISIT_COUNTED_SESSION_KEY);
        const current = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) || 0;
        if (alreadyCounted) {
            return Math.max(1, current);
        }
        const next = current + 1;
        localStorage.setItem(VISIT_COUNT_KEY, String(next));
        sessionStorage.setItem(VISIT_COUNTED_SESSION_KEY, '1');
        return next;
    } catch {
        return 1;
    }
}

export function getVisitCount(): number {
    if (typeof window === 'undefined') return 1;
    try {
        const current = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '1', 10);
        return Number.isFinite(current) && current > 0 ? current : 1;
    } catch {
        return 1;
    }
}

export function recordPageVisit(pathname?: string): string[] {
    if (typeof window === 'undefined') return [];
    const path = pathname || window.location.pathname;
    if (!path || path.startsWith('/audit/start')) {
        return getSessionJourney();
    }
    try {
        const raw = sessionStorage.getItem(SESSION_JOURNEY_KEY);
        const pages: string[] = raw ? JSON.parse(raw) : [];
        if (pages[pages.length - 1] !== path) {
            pages.push(path);
            const trimmed = pages.slice(-20);
            sessionStorage.setItem(SESSION_JOURNEY_KEY, JSON.stringify(trimmed));
            return trimmed;
        }
        return pages;
    } catch {
        return [path];
    }
}

export function getSessionJourney(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(SESSION_JOURNEY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function readStoredSnapshot(storage: Storage, key: string): AttributionSnapshot | null {
    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AttributionSnapshot>;
        if (!parsed || typeof parsed !== 'object') return null;

        // Backfill newer fields when reading legacy v1 snapshots
        const refInfo = parseReferrerInfo(parsed.initialReferrer || '');
        const utmSource = parsed.utmSource || '';
        const utmMedium = parsed.utmMedium || '';
        const utmCampaign = parsed.utmCampaign || '';
        const utmTerm = parsed.utmTerm || '';
        const utmContent = parsed.utmContent || '';
        const aiSource = parsed.aiSource || detectAiSource(refInfo.referrer, utmSource);
        const gclid = parsed.gclid || '';
        const gbraid = parsed.gbraid || '';
        const wbraid = parsed.wbraid || '';
        const msclkid = parsed.msclkid || '';
        const fbclid = parsed.fbclid || '';
        const liFatId = parsed.liFatId || '';

        return {
            initialLandingPage: parsed.initialLandingPage || '/',
            initialReferrer: refInfo.referrer,
            referrerDomain: parsed.referrerDomain || refInfo.referrerDomain,
            utmSource,
            utmMedium,
            utmCampaign,
            utmTerm,
            utmContent,
            searchQuery: parsed.searchQuery || refInfo.searchQuery || utmTerm || '',
            aiSource,
            channel: parsed.channel || classifyChannel({
                utmSource,
                utmMedium,
                utmCampaign,
                aiSource,
                searchEngine: refInfo.searchEngine,
                socialNetwork: refInfo.socialNetwork,
                referrerDomain: parsed.referrerDomain || refInfo.referrerDomain,
                gclid,
                gbraid,
                wbraid,
                msclkid,
                fbclid,
                liFatId,
            }),
            gclid,
            gbraid,
            wbraid,
            msclkid,
            fbclid,
            liFatId,
            firstTouchTimestamp: parsed.firstTouchTimestamp || new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

export function captureFirstTouchAttribution(): AttributionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        incrementVisitCountIfNewSession();
        const currentSnapshot = buildSnapshotFromCurrentPage();

        // Update session last-touch whenever session starts OR new campaign/referrer signals arrive
        const existingLast = readStoredSnapshot(sessionStorage, LAST_TOUCH_STORAGE_KEY);
        if (!existingLast || hasExplicitCampaignSignals(currentSnapshot)) {
            sessionStorage.setItem(LAST_TOUCH_STORAGE_KEY, JSON.stringify(currentSnapshot));
        }

        // Check persistent first-touch in localStorage (90-day window)
        const existingFirst =
            readStoredSnapshot(localStorage, FIRST_TOUCH_STORAGE_KEY) ||
            readStoredSnapshot(sessionStorage, LEGACY_ATTRIBUTION_KEY);

        if (existingFirst) {
            const ageMs = Date.now() - new Date(existingFirst.firstTouchTimestamp).getTime();
            if (!Number.isNaN(ageMs) && ageMs < FIRST_TOUCH_TTL_MS) {
                // Ensure it is persisted in v2 localStorage
                localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(existingFirst));
                return existingFirst;
            }
        }

        localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(currentSnapshot));
        sessionStorage.setItem(LEGACY_ATTRIBUTION_KEY, JSON.stringify(currentSnapshot));

        if (currentSnapshot.aiSource) {
            trackEvent('ai_referral_session', {
                ai_engine: currentSnapshot.aiSource,
                landing_page: window.location.pathname,
                referrer: currentSnapshot.initialReferrer,
            });
        }

        return currentSnapshot;
    } catch {
        return null;
    }
}

export function getFirstTouchAttribution(): AttributionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        return (
            readStoredSnapshot(localStorage, FIRST_TOUCH_STORAGE_KEY) ||
            readStoredSnapshot(sessionStorage, LEGACY_ATTRIBUTION_KEY) ||
            captureFirstTouchAttribution()
        );
    } catch {
        return null;
    }
}

export function getLastTouchAttribution(): AttributionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        return readStoredSnapshot(sessionStorage, LAST_TOUCH_STORAGE_KEY) || getFirstTouchAttribution();
    } catch {
        return null;
    }
}

export function buildLeadAttributionPayload(options?: {
    formSource?: string;
    originPage?: string;
}): LeadAttributionPayload {
    const firstTouch = getFirstTouchAttribution();
    const lastTouch = getLastTouchAttribution();
    const journey = getSessionJourney();
    const visitCount = getVisitCount();
    const device = detectDeviceInfo();
    const formSource = options?.formSource || 'direct';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const conversionPage = options?.originPage || currentPath;

    // Prefer first-touch for channel/source, falling back to last-touch if first-touch was pure direct and last-touch has campaign/referrer
    const primary = firstTouch && (hasExplicitCampaignSignals(firstTouch) || !lastTouch || !hasExplicitCampaignSignals(lastTouch))
        ? firstTouch
        : (lastTouch || firstTouch);

    const channel = primary?.channel || 'direct';
    const source = primary ? resolveSnapshotSource(primary) : 'direct';
    const medium = primary?.utmMedium || defaultMediumForChannel(channel);
    const campaign = primary?.utmCampaign || '';

    const hasDistinctLastTouch = Boolean(
        firstTouch &&
        lastTouch &&
        (
            resolveSnapshotSource(firstTouch) !== resolveSnapshotSource(lastTouch) ||
            firstTouch.channel !== lastTouch.channel ||
            firstTouch.utmCampaign !== lastTouch.utmCampaign ||
            firstTouch.initialLandingPage !== lastTouch.initialLandingPage
        )
    );

    return {
        source,
        formSource,
        medium,
        campaign,
        landingPage: firstTouch?.initialLandingPage || conversionPage || '/',
        conversionPage,
        referrer: primary?.initialReferrer || 'direct',
        referrerDomain: primary?.referrerDomain || null,
        aiEngine: primary?.aiSource || null,
        channel,
        utmSource: primary?.utmSource || null,
        utmMedium: primary?.utmMedium || null,
        utmCampaign: primary?.utmCampaign || null,
        utmTerm: primary?.utmTerm || null,
        utmContent: primary?.utmContent || null,
        searchQuery: primary?.searchQuery || null,
        gclid: primary?.gclid || null,
        gbraid: primary?.gbraid || null,
        wbraid: primary?.wbraid || null,
        msclkid: primary?.msclkid || null,
        fbclid: primary?.fbclid || null,
        liFatId: primary?.liFatId || null,
        pagesVisited: journey.length > 0 ? journey : [conversionPage].filter(Boolean),
        pageCount: Math.max(journey.length, 1),
        visitCount,
        firstTouchAt: firstTouch?.firstTouchTimestamp || null,
        convertedAt: new Date().toISOString(),
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        timezone: device.timezone,
        screenResolution: device.screenResolution,
        lastTouch: hasDistinctLastTouch && lastTouch
            ? {
                source: resolveSnapshotSource(lastTouch),
                medium: lastTouch.utmMedium || defaultMediumForChannel(lastTouch.channel),
                campaign: lastTouch.utmCampaign || undefined,
                term: lastTouch.utmTerm || null,
                content: lastTouch.utmContent || null,
                referrer: lastTouch.initialReferrer,
                referrerDomain: lastTouch.referrerDomain || null,
                landingPage: lastTouch.initialLandingPage,
                aiEngine: lastTouch.aiSource || null,
                channel: lastTouch.channel,
                searchQuery: lastTouch.searchQuery || null,
                gclid: lastTouch.gclid || null,
                gbraid: lastTouch.gbraid || null,
                wbraid: lastTouch.wbraid || null,
                msclkid: lastTouch.msclkid || null,
                fbclid: lastTouch.fbclid || null,
                liFatId: lastTouch.liFatId || null,
                timestamp: lastTouch.firstTouchTimestamp,
            }
            : null,
    };
}

export function tagClarityLead(leadId: string): void {
    if (typeof window === 'undefined' || !leadId) return;
    if (typeof (window as any).clarity === 'function') {
        try {
            (window as any).clarity('identify', leadId);
            (window as any).clarity('set', 'lead_id', leadId);
        } catch {
            // ignore clarity errors
        }
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
    recordPageVisit();
    if (process.env.NODE_ENV === 'development') {
        console.log('[Tracking] Initialized', snapshot);
    }
};
