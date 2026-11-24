'use client';

import { useState } from 'react';
import { LeadAttribution } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    TrendingUp,
    Globe,
    Search,
    Sparkles,
    MousePointerClick,
    Route,
    Monitor,
    Smartphone,
    Tablet,
    Clock,
    ExternalLink,
    Copy,
    Check,
    ArrowRight,
    Tag,
} from 'lucide-react';
import { format } from 'date-fns';

const CLARITY_PROJECT_ID = 'vtpukex31u';
const PUBLIC_SITE_ORIGIN = 'https://xiri.ai';

interface AttributionCardProps {
    attribution?: Partial<LeadAttribution> | null;
    leadId?: string | null;
    createdAt?: any;
    compact?: boolean;
}

const CHANNEL_META: Record<string, { label: string; className: string }> = {
    paid_search: { label: 'Paid Search', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    organic_search: { label: 'Organic Search', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    ai_search: { label: 'AI Search', className: 'bg-violet-100 text-violet-800 border-violet-200' },
    paid_social: { label: 'Paid Social', className: 'bg-pink-100 text-pink-800 border-pink-200' },
    organic_social: { label: 'Organic Social', className: 'bg-sky-100 text-sky-800 border-sky-200' },
    email: { label: 'Email', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    referral: { label: 'Referral', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    campaign: { label: 'Campaign', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    manual: { label: 'Manual Entry', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    direct: { label: 'Direct', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const AI_ENGINE_LABELS: Record<string, string> = {
    chatgpt: 'ChatGPT',
    perplexity: 'Perplexity',
    claude: 'Claude',
    gemini: 'Gemini',
    copilot: 'Microsoft Copilot',
    grok: 'Grok',
    meta_ai: 'Meta AI',
    you_ai: 'You.com AI',
    phind: 'Phind',
};

function extractDomain(url?: string | null): string | null {
    if (!url || url === 'direct') return null;
    try {
        return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return null;
    }
}

function inferChannel(attr: Partial<LeadAttribution>): string {
    if (attr.channel && CHANNEL_META[attr.channel]) return attr.channel;
    if (attr.aiEngine || attr.source?.startsWith('ai_')) return 'ai_search';
    if (attr.medium === 'manual') return 'manual';
    if (attr.gclid || attr.gbraid || attr.wbraid || attr.msclkid) return 'paid_search';

    const medium = (attr.medium || '').toLowerCase();
    const source = (attr.source || '').toLowerCase();
    const refDomain = attr.referrerDomain || extractDomain(attr.referrer);

    if (/^(cpc|ppc|paidsearch|paid_search|sem|paid)$/.test(medium)) return 'paid_search';
    if (/^(paid_social|paidsocial|cpm|display)$/.test(medium)) return 'paid_social';
    if (/^(email|newsletter|drip|outreach)$/.test(medium)) return 'email';
    if (medium === 'partner' || source === 'referral') return 'referral';

    if (refDomain) {
        if (/(google|bing|yahoo|duckduckgo|ecosia|brave|yandex|aol|ask|startpage)\./i.test(refDomain)) {
            return 'organic_search';
        }
        if (/(chatgpt|openai|perplexity|claude|anthropic|gemini|copilot|grok)/i.test(refDomain)) {
            return 'ai_search';
        }
        if (/(linkedin|lnkd\.in|facebook|fb\.com|instagram|twitter|x\.com|t\.co|youtube|reddit|tiktok|nextdoor)/i.test(refDomain)) {
            return 'organic_social';
        }
        if (!refDomain.endsWith('xiri.ai')) {
            return 'referral';
        }
    }

    if (medium === 'organic') return 'organic_search';
    if (medium === 'social') return 'organic_social';
    return 'direct';
}

function formatLabel(value?: string | null): string {
    if (!value) return '';
    return value
        .replace(/^ai_/i, '')
        .replace(/^page_/i, 'Page: ')
        .replace(/^industry_/i, 'Industry: ')
        .replace(/_/g, ' ');
}

function toSafeDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
        const d = value.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDurationBetween(start: Date | null, end: Date | null): string | null {
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return null;
    const seconds = Math.round(diffMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function toPublicHref(path?: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/')) return `${PUBLIC_SITE_ORIGIN}${path}`;
    return null;
}

export default function AttributionCard({
    attribution,
    leadId,
    createdAt,
    compact = false,
}: AttributionCardProps) {
    const [copiedTag, setCopiedTag] = useState(false);

    const hasAnyData = Boolean(
        attribution &&
        (
            attribution.source ||
            attribution.medium ||
            attribution.campaign ||
            attribution.landingPage ||
            attribution.referrer ||
            attribution.channel ||
            attribution.aiEngine ||
            attribution.formSource
        )
    );

    if (!hasAnyData || !attribution) {
        return (
            <div className="p-8 text-center">
                <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <h3 className="font-medium text-sm">No Attribution Data</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Attribution data appears when leads come through the website or tracked campaigns.
                </p>
            </div>
        );
    }

    const channelKey = inferChannel(attribution);
    const channelMeta = CHANNEL_META[channelKey] || {
        label: formatLabel(channelKey),
        className: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const referrerDomain = attribution.referrerDomain || extractDomain(attribution.referrer);
    const hasExternalReferrer = Boolean(attribution.referrer && attribution.referrer !== 'direct');
    const aiLabel = attribution.aiEngine
        ? (AI_ENGINE_LABELS[attribution.aiEngine.toLowerCase()] || attribution.aiEngine)
        : null;
    const searchKeyword = attribution.searchQuery || attribution.utmTerm || null;

    const clickIds = [
        attribution.gclid ? { key: 'gclid', value: attribution.gclid } : null,
        attribution.gbraid ? { key: 'gbraid', value: attribution.gbraid } : null,
        attribution.wbraid ? { key: 'wbraid', value: attribution.wbraid } : null,
        attribution.msclkid ? { key: 'msclkid', value: attribution.msclkid } : null,
        attribution.fbclid ? { key: 'fbclid', value: attribution.fbclid } : null,
        attribution.liFatId ? { key: 'li_fat_id', value: attribution.liFatId } : null,
    ].filter((x): x is { key: string; value: string } => Boolean(x));

    const landingHref = toPublicHref(attribution.landingPage);
    const conversionHref = toPublicHref(attribution.conversionPage);
    const showConversionPage = Boolean(
        attribution.conversionPage &&
        attribution.conversionPage !== attribution.landingPage?.split('?')[0]
    );

    const pagesVisited = Array.isArray(attribution.pagesVisited) ? attribution.pagesVisited : [];
    const firstTouchDate = toSafeDate(attribution.firstTouchAt);
    const convertedDate = toSafeDate(attribution.convertedAt) || toSafeDate(createdAt);
    const timeToConvert = formatDurationBetween(firstTouchDate, convertedDate);

    const DeviceIcon =
        attribution.deviceType === 'mobile'
            ? Smartphone
            : attribution.deviceType === 'tablet'
                ? Tablet
                : Monitor;

    const clarityTag = attribution.clarityTag || null;
    const clarityUrl = `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/impressions`;

    const handleCopyClarityTag = () => {
        if (!clarityTag) return;
        navigator.clipboard?.writeText(clarityTag).then(() => {
            setCopiedTag(true);
            setTimeout(() => setCopiedTag(false), 1800);
        }).catch(() => {});
    };

    return (
        <Card>
            <CardHeader className={compact ? 'py-3 pb-2' : 'pb-3'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className={compact ? 'text-sm flex items-center gap-2' : 'text-base flex items-center gap-2'}>
                        <TrendingUp className="w-4 h-4" /> Attribution
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`text-[11px] font-medium ${channelMeta.className}`}>
                            {channelMeta.label}
                        </Badge>
                        {aiLabel && (
                            <Badge variant="outline" className="text-[11px] font-medium bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                <Sparkles className="w-3 h-3" /> {aiLabel}
                            </Badge>
                        )}
                        {attribution.visitCount && attribution.visitCount > 1 && (
                            <Badge variant="secondary" className="text-[11px]">
                                Visit #{attribution.visitCount}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Search Keyword Highlight (Paid Search utm_term or referrer query) */}
                {searchKeyword && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 flex items-start gap-2">
                        <Search className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-emerald-800">
                                Search Term / Keyword
                            </p>
                            <p className="text-sm font-medium text-emerald-950 break-words">
                                &ldquo;{searchKeyword}&rdquo;
                            </p>
                        </div>
                    </div>
                )}

                {/* Traffic Source Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {attribution.source && (
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Source</p>
                            <p className="font-medium break-words">{formatLabel(attribution.source)}</p>
                        </div>
                    )}
                    {attribution.medium && (
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Medium</p>
                            <p className="break-words">{formatLabel(attribution.medium)}</p>
                        </div>
                    )}
                    <div className="col-span-2 min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Referrer
                        </p>
                        {hasExternalReferrer ? (
                            <div className="mt-0.5 space-y-0.5">
                                {referrerDomain && (
                                    <p className="font-medium text-sm">{referrerDomain}</p>
                                )}
                                <a
                                    href={attribution.referrer}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1"
                                >
                                    {attribution.referrer}
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Direct / No referrer passed
                            </p>
                        )}
                    </div>
                    {attribution.campaign && (
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Campaign</p>
                            <p className="text-sm break-words">{attribution.campaign}</p>
                        </div>
                    )}
                    {attribution.utmContent && (
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ad Content</p>
                            <p className="text-sm break-words">{attribution.utmContent}</p>
                        </div>
                    )}
                </div>

                {/* Click IDs */}
                {clickIds.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Ad Click IDs
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {clickIds.map(({ key, value }) => (
                                <span
                                    key={key}
                                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground max-w-full truncate"
                                    title={`${key}=${value}`}
                                >
                                    <span className="font-semibold text-foreground">{key}:</span>
                                    <span className="truncate max-w-[160px]">{value}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Landing Page / Conversion Page / Form CTA */}
                <div className="border-t pt-3 space-y-2.5">
                    {attribution.landingPage && (
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                First Landing Page
                            </p>
                            {landingHref ? (
                                <a
                                    href={landingHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1 mt-0.5"
                                >
                                    {attribution.landingPage}
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            ) : (
                                <p className="text-xs text-primary break-all mt-0.5">{attribution.landingPage}</p>
                            )}
                        </div>
                    )}

                    {showConversionPage && attribution.conversionPage && (
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Conversion Page
                            </p>
                            {conversionHref ? (
                                <a
                                    href={conversionHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1 mt-0.5"
                                >
                                    {attribution.conversionPage}
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            ) : (
                                <p className="text-xs text-primary break-all mt-0.5">{attribution.conversionPage}</p>
                            )}
                        </div>
                    )}

                    {attribution.formSource && (
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> Form / CTA Used
                            </p>
                            <p className="text-xs font-medium mt-0.5 break-words">
                                {formatLabel(attribution.formSource)}
                            </p>
                        </div>
                    )}
                </div>

                {/* On-Site Page Journey */}
                {pagesVisited.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                                <Route className="w-3 h-3" /> On-Site Journey ({attribution.pageCount || pagesVisited.length}{' '}
                                {(attribution.pageCount || pagesVisited.length) === 1 ? 'page' : 'pages'})
                            </p>
                            {timeToConvert && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {timeToConvert} to convert
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                            {pagesVisited.map((page, idx) => (
                                <span key={`${page}-${idx}`} className="inline-flex items-center gap-1">
                                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] break-all">
                                        {page}
                                    </span>
                                    {idx < pagesVisited.length - 1 && (
                                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Last Touch (when different from First Touch) */}
                {attribution.lastTouch && (
                    <div className="border-t pt-3 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Last-Touch Session (Returned Via)
                        </p>
                        <div className="rounded-md bg-muted/50 px-2.5 py-2 text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {attribution.lastTouch.channel && (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                        {CHANNEL_META[attribution.lastTouch.channel]?.label || formatLabel(attribution.lastTouch.channel)}
                                    </Badge>
                                )}
                                {attribution.lastTouch.source && (
                                    <span className="font-medium">{formatLabel(attribution.lastTouch.source)}</span>
                                )}
                                {attribution.lastTouch.medium && (
                                    <span className="text-muted-foreground">/ {formatLabel(attribution.lastTouch.medium)}</span>
                                )}
                            </div>
                            {attribution.lastTouch.landingPage && (
                                <p className="text-[11px] text-muted-foreground break-all">
                                    Entry: {attribution.lastTouch.landingPage}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Device / Timing / Clarity Replay */}
                {(attribution.deviceType || firstTouchDate || clarityTag) && (
                    <div className="border-t pt-3 space-y-2">
                        {(attribution.deviceType || attribution.browser || attribution.os || attribution.timezone) && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5">
                                    <DeviceIcon className="w-3 h-3" />
                                    {[attribution.deviceType, attribution.browser, attribution.os]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                                {attribution.timezone && (
                                    <span className="rounded bg-muted/60 px-2 py-0.5">
                                        {attribution.timezone}
                                    </span>
                                )}
                            </div>
                        )}

                        {firstTouchDate && (
                            <p className="text-[11px] text-muted-foreground">
                                First seen: {format(firstTouchDate, 'MMM d, yyyy h:mm a')}
                                {timeToConvert ? ` (${timeToConvert} before submitting)` : ''}
                            </p>
                        )}

                        {clarityTag && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    asChild
                                >
                                    <a href={clarityUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-3 h-3" />
                                        Watch in Clarity
                                    </a>
                                </Button>
                                <button
                                    type="button"
                                    onClick={handleCopyClarityTag}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                                    title="Copy Clarity lead_id filter tag"
                                >
                                    {copiedTag ? (
                                        <>
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            Copied lead_id
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" />
                                            lead_id: {clarityTag.slice(0, 10)}…
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
