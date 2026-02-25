'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Sparkles, CheckCircle, XCircle, RefreshCw, Mail, MousePointerClick, Eye, AlertTriangle, ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface TemplateStats {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
}

interface AISuggestion {
    analysis: string;
    suggestions: {
        subject: string;
        body: string;
        rationale: string;
    }[];
    shortUrlTest?: {
        recommendation: string;
        shortVariant: string;
    };
    generatedAt: any;
    performanceSnapshot: TemplateStats;
}

interface Template {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: string;
    stats?: TemplateStats;
    aiSuggestions?: AISuggestion[];
    lastOptimizedAt?: any;
}

// Variant color schemes for visual distinction
const VARIANT_COLORS: Record<string, { bg: string; border: string; badge: string; badgeText: string }> = {
    base: { bg: 'bg-white dark:bg-card', border: 'border-border', badge: 'bg-sky-100 dark:bg-sky-900/30', badgeText: 'text-sky-700 dark:text-sky-300' },
    warm: { bg: 'bg-orange-50/50 dark:bg-orange-950/10', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 dark:bg-orange-900/30', badgeText: 'text-orange-700 dark:text-orange-300' },
    cold: { bg: 'bg-blue-50/50 dark:bg-blue-950/10', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/30', badgeText: 'text-blue-700 dark:text-blue-300' },
};

function getVariantType(id: string): 'warm' | 'cold' | 'base' {
    if (id.includes('_warm')) return 'warm';
    if (id.includes('_cold')) return 'cold';
    return 'base';
}

// Group templates by their base outreach step
function groupTemplates(templates: Template[]): { label: string; stepNumber: number; base: Template | null; variants: Template[] }[] {
    const groups: Record<string, { base: Template | null; variants: Template[] }> = {};

    for (const t of templates) {
        const match = t.id.match(/^(vendor_outreach_\d+)(?:_(.+))?$/);
        if (!match) continue; // Skip non-outreach templates entirely

        const baseId = match[1];
        const variant = match[2];
        groups[baseId] = groups[baseId] || { base: null, variants: [] };

        if (!variant) {
            groups[baseId].base = t;
        } else {
            groups[baseId].variants.push(t);
        }
    }

    return Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => {
            const stepNum = parseInt(key.match(/\d+$/)?.[0] || '0');
            const base = group.base;
            const label = base?.name || `Outreach Step ${stepNum}`;
            return { label, stepNumber: stepNum, base, variants: group.variants };
        });
}

export default function TemplateAnalyticsPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

    useEffect(() => { fetchTemplates(); }, []);

    async function fetchTemplates() {
        setLoading(true);
        const snap = await getDocs(collection(db, 'templates'));
        const data = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Template))
            // Only show actual email templates, not agent prompts
            .filter(t => t.id.startsWith('vendor_outreach_'))
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        setTemplates(data);
        // Auto-expand all groups on first load
        const grouped = groupTemplates(data);
        setExpandedGroups(new Set(grouped.map(g => g.stepNumber)));
        setLoading(false);
    }

    async function handleOptimize(templateId: string) {
        setOptimizing(templateId);
        try {
            const fn = httpsCallable(functions, 'optimizeTemplate');
            await fn({ templateId });
            await fetchTemplates();
        } catch (err) {
            console.error('Optimize failed:', err);
            alert('Failed to optimize. Check console.');
        } finally {
            setOptimizing(null);
        }
    }

    async function handleApplySuggestion(templateId: string, suggestion: { subject: string; body: string }) {
        setApplying(templateId);
        try {
            await updateDoc(doc(db, 'templates', templateId), {
                subject: suggestion.subject,
                body: suggestion.body,
                updatedAt: new Date(),
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
            });
            await fetchTemplates();
        } catch (err) {
            console.error('Apply failed:', err);
        } finally {
            setApplying(null);
        }
    }

    async function handleDismissSuggestions(templateId: string) {
        await updateDoc(doc(db, 'templates', templateId), {
            aiSuggestions: deleteField(),
        });
        await fetchTemplates();
    }

    function rate(n: number, d: number): string {
        if (d === 0) return '—';
        const pct = Math.min((n / d) * 100, 100); // Cap at 100%
        return `${pct.toFixed(1)}%`;
    }

    function getRateColor(n: number, d: number, threshold: number): string {
        if (d === 0) return 'text-muted-foreground';
        const pct = Math.min(n / d, 1); // Cap at 1.0
        if (pct >= threshold) return 'text-green-600 dark:text-green-400';
        if (pct >= threshold * 0.7) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    }

    const toggleGroup = (stepNumber: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(stepNumber)) { next.delete(stepNumber); } else { next.add(stepNumber); }
            return next;
        });
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

    const groups = groupTemplates(templates);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Template Analytics</h2>
                    <p className="text-sm text-muted-foreground">
                        Track email performance and get AI-powered optimization suggestions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        setExpandedGroups(prev => prev.size === groups.length ? new Set() : new Set(groups.map(g => g.stepNumber)));
                    }} className="gap-1 text-xs">
                        {expandedGroups.size === groups.length ? 'Collapse All' : 'Expand All'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchTemplates} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(() => {
                    const totals = templates.reduce((acc, t) => ({
                        sent: acc.sent + (t.stats?.sent || 0),
                        delivered: acc.delivered + (t.stats?.delivered || 0),
                        opened: acc.opened + (t.stats?.opened || 0),
                        clicked: acc.clicked + (t.stats?.clicked || 0),
                    }), { sent: 0, delivered: 0, opened: 0, clicked: 0 });
                    return (
                        <>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <Mail className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                                    <p className="text-2xl font-bold">{totals.sent}</p>
                                    <p className="text-xs text-muted-foreground">Total Sent</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                                    <p className="text-2xl font-bold">{rate(totals.delivered, totals.sent)}</p>
                                    <p className="text-xs text-muted-foreground">Delivery Rate</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <Eye className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                                    <p className="text-2xl font-bold">{rate(totals.opened, totals.sent)}</p>
                                    <p className="text-xs text-muted-foreground">Open Rate</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <MousePointerClick className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                                    <p className="text-2xl font-bold">{rate(totals.clicked, totals.opened)}</p>
                                    <p className="text-xs text-muted-foreground">Click Rate</p>
                                </CardContent>
                            </Card>
                        </>
                    );
                })()}
            </div>

            {/* Grouped Template Cards */}
            <div className="space-y-3">
                {groups.map(group => {
                    const isExpanded = expandedGroups.has(group.stepNumber);
                    const allTemplates = [group.base, ...group.variants].filter(Boolean) as Template[];
                    const groupStats = allTemplates.reduce((acc, t) => ({
                        sent: acc.sent + (t.stats?.sent || 0),
                        delivered: acc.delivered + (t.stats?.delivered || 0),
                        opened: acc.opened + (t.stats?.opened || 0),
                        clicked: acc.clicked + (t.stats?.clicked || 0),
                        bounced: acc.bounced + (t.stats?.bounced || 0),
                    }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });

                    return (
                        <Card key={group.stepNumber}>
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group.stepNumber)}
                                className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    }
                                    <div className="min-w-0 flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-mono">Step {group.stepNumber}</Badge>
                                        <span className="font-semibold text-sm">{group.label}</span>
                                        {group.variants.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                + {group.variants.length} variant{group.variants.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Inline summary stats */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                                    <span><strong className="text-foreground">{groupStats.sent}</strong> sent</span>
                                    <span className={getRateColor(groupStats.opened, groupStats.sent, 0.3)}>
                                        {rate(groupStats.opened, groupStats.sent)} open
                                    </span>
                                    <span className={getRateColor(groupStats.clicked, groupStats.opened, 0.1)}>
                                        {rate(groupStats.clicked, groupStats.opened)} click
                                    </span>
                                    {groupStats.bounced > 0 && (
                                        <span className="text-red-600 dark:text-red-400">{groupStats.bounced} bounced</span>
                                    )}
                                </div>
                            </button>

                            {/* Expanded: show each template */}
                            {isExpanded && (
                                <CardContent className="pt-0 pb-4 px-5 space-y-3">
                                    {allTemplates.map(t => (
                                        <TemplateRow
                                            key={t.id}
                                            template={t}
                                            rate={rate}
                                            getRateColor={getRateColor}
                                            onOptimize={handleOptimize}
                                            onApply={handleApplySuggestion}
                                            onDismiss={handleDismissSuggestions}
                                            optimizing={optimizing}
                                            applying={applying}
                                        />
                                    ))}
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Individual Template Row ─── */
function TemplateRow({ template: t, rate, getRateColor, onOptimize, onApply, onDismiss, optimizing, applying }: {
    template: Template;
    rate: (n: number, d: number) => string;
    getRateColor: (n: number, d: number, threshold: number) => string;
    onOptimize: (id: string) => void;
    onApply: (id: string, sug: { subject: string; body: string }) => void;
    onDismiss: (id: string) => void;
    optimizing: string | null;
    applying: string | null;
}) {
    const s = t.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const hasAI = t.aiSuggestions && t.aiSuggestions.length > 0;
    const latestAI = hasAI ? t.aiSuggestions![t.aiSuggestions!.length - 1] : null;
    const [showAI, setShowAI] = useState(false);
    const [showBody, setShowBody] = useState(false);

    const variantType = getVariantType(t.id);
    const colors = VARIANT_COLORS[variantType];

    return (
        <div className={`rounded-lg border p-4 space-y-3 ${colors.bg} ${colors.border} ${variantType !== 'base' ? 'ml-4' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${colors.badge} ${colors.badgeText} text-[10px] shadow-none border-none`}>
                        {variantType === 'warm' ? '🔥 Warm' : variantType === 'cold' ? '❄️ Cold' : '📧 Base'}
                    </Badge>
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <code className="text-[9px] text-muted-foreground bg-muted px-1 rounded hidden sm:inline">{t.id}</code>
                </div>
                <div className="flex items-center gap-1">
                    {hasAI && (
                        <Button variant="ghost" size="sm" className="text-xs gap-1 text-purple-600" onClick={() => setShowAI(!showAI)}>
                            <Sparkles className="w-3 h-3" /> {showAI ? 'Hide' : 'View'} AI
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-7"
                        onClick={() => onOptimize(t.id)}
                        disabled={optimizing === t.id}
                    >
                        {optimizing === t.id ? (
                            <><RefreshCw className="w-3 h-3 animate-spin" /> Optimizing...</>
                        ) : (
                            <><Sparkles className="w-3 h-3" /> AI Optimize</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Subject Line */}
            <div className="text-xs">
                <span className="font-medium text-foreground">Subject:</span>{' '}
                <span className="text-muted-foreground">{t.subject}</span>
            </div>

            {/* Email Body (collapsible) */}
            <div>
                <button
                    onClick={() => setShowBody(!showBody)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    {showBody ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showBody ? 'Hide email body' : 'Show email body'}
                </button>
                {showBody && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md border text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                        {t.body || 'No body content'}
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                    <p className="text-base font-bold">{s.sent}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Sent</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${getRateColor(s.delivered, s.sent, 0.9)}`}>
                        {rate(s.delivered, s.sent)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Delivered</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${getRateColor(s.opened, s.sent, 0.3)}`}>
                        {rate(s.opened, s.sent)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Opened</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${getRateColor(s.clicked, s.opened, 0.1)}`}>
                        {rate(s.clicked, s.opened)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Clicked</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${s.bounced > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {s.bounced}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Bounced</p>
                </div>
            </div>

            {/* AI Suggestions (collapsible) */}
            {showAI && latestAI && (
                <div className="border rounded-lg p-4 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-800 dark:text-purple-300">AI Suggestions</span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onDismiss(t.id)}>
                            Dismiss
                        </Button>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-400">{latestAI.analysis}</p>

                    {latestAI.shortUrlTest && (
                        <div className="text-xs p-2 bg-white/60 dark:bg-white/10 rounded border border-purple-100 dark:border-purple-800">
                            <span className="font-medium">🔗 URL Test:</span> {latestAI.shortUrlTest.recommendation}
                        </div>
                    )}

                    {latestAI.suggestions?.map((sug, i) => (
                        <div key={i} className="p-3 bg-white dark:bg-card rounded border space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Option {i + 1}</span>
                                <Button
                                    size="sm"
                                    className="text-xs h-7 gap-1"
                                    onClick={() => onApply(t.id, sug)}
                                    disabled={applying === t.id}
                                >
                                    <CheckCircle className="w-3 h-3" /> Apply
                                </Button>
                            </div>
                            <p className="text-xs"><span className="font-medium">Subject:</span> {sug.subject}</p>
                            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{sug.body}</p>
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 italic">{sug.rationale}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
