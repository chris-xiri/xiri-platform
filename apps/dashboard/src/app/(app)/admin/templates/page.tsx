'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle, RefreshCw, Mail, MousePointerClick, Eye, AlertTriangle, ChevronDown, ChevronRight, ArrowRight, HardHat, Building2 } from 'lucide-react';

interface TemplateStats {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
}

interface AISuggestion {
    analysis: string;
    suggestions: { subject: string; body: string; rationale: string }[];
    shortUrlTest?: { recommendation: string; shortVariant: string };
    generatedAt: any;
    performanceSnapshot: TemplateStats;
}

interface Template {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: string;
    sequence?: number;
    stats?: TemplateStats;
    aiSuggestions?: AISuggestion[];
}

// ─── Variant color schemes ───
const VARIANT_COLORS: Record<string, { bg: string; border: string; badge: string; badgeText: string }> = {
    base: { bg: 'bg-white dark:bg-card', border: 'border-border', badge: 'bg-sky-100 dark:bg-sky-900/30', badgeText: 'text-sky-700 dark:text-sky-300' },
    warm: { bg: 'bg-orange-50/60 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 dark:bg-orange-900/30', badgeText: 'text-orange-700 dark:text-orange-300' },
    cold: { bg: 'bg-blue-50/60 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/30', badgeText: 'text-blue-700 dark:text-blue-300' },
};

function getVariantType(id: string): 'warm' | 'cold' | 'base' {
    if (id.includes('_warm')) return 'warm';
    if (id.includes('_cold')) return 'cold';
    return 'base';
}

// Parse sequence step number from template ID
function getStepNumber(id: string): number {
    const match = id.match(/outreach_(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// Group by step and extract variants
interface StepGroup {
    step: number;
    label: string;
    templates: Template[];
    stats: TemplateStats;
}

function buildPipeline(templates: Template[], prefix: string): StepGroup[] {
    const stepMap: Record<number, Template[]> = {};
    for (const t of templates) {
        if (!t.id.startsWith(prefix)) continue;
        const step = getStepNumber(t.id);
        stepMap[step] = stepMap[step] || [];
        stepMap[step].push(t);
    }

    return Object.entries(stepMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([stepStr, tpls]) => {
            const step = Number(stepStr);
            const stats = tpls.reduce((acc, t) => ({
                sent: acc.sent + (t.stats?.sent || 0),
                delivered: acc.delivered + (t.stats?.delivered || 0),
                opened: acc.opened + (t.stats?.opened || 0),
                clicked: acc.clicked + (t.stats?.clicked || 0),
                bounced: acc.bounced + (t.stats?.bounced || 0),
            }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });

            return {
                step,
                label: step === 1 ? 'Initial Outreach' : `Follow-up #${step - 1}`,
                templates: tpls.sort((a, b) => a.id.localeCompare(b.id)),
                stats,
            };
        });
}

function rate(n: number, d: number): string {
    if (d === 0) return '—';
    return `${Math.min((n / d) * 100, 100).toFixed(1)}%`;
}

function rateColor(n: number, d: number, threshold: number): string {
    if (d === 0) return 'text-muted-foreground';
    const pct = Math.min(n / d, 1);
    if (pct >= threshold) return 'text-green-600 dark:text-green-400';
    if (pct >= threshold * 0.7) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
}

export default function TemplateAnalyticsPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);

    useEffect(() => { fetchTemplates(); }, []);

    async function fetchTemplates() {
        setLoading(true);
        const snap = await getDocs(collection(db, 'templates'));
        const data = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Template))
            .filter(t => t.id.startsWith('vendor_outreach_') || t.id.startsWith('sales_outreach_'));
        setTemplates(data);
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
        } finally { setOptimizing(null); }
    }

    async function handleApply(templateId: string, sug: { subject: string; body: string }) {
        setApplying(templateId);
        try {
            await updateDoc(doc(db, 'templates', templateId), {
                subject: sug.subject, body: sug.body, updatedAt: new Date(),
                stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
            });
            await fetchTemplates();
        } catch (err) { console.error('Apply failed:', err); }
        finally { setApplying(null); }
    }

    async function handleDismiss(templateId: string) {
        await updateDoc(doc(db, 'templates', templateId), { aiSuggestions: deleteField() });
        await fetchTemplates();
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

    const vendorPipeline = buildPipeline(templates, 'vendor_outreach_');
    const salesPipeline = buildPipeline(templates, 'sales_outreach_');

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Template Analytics</h2>
                    <p className="text-sm text-muted-foreground">
                        Outreach sequence performance — see at which step prospects convert
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTemplates} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
            </div>

            {/* Contractor Outreach Pipeline */}
            {vendorPipeline.length > 0 && (
                <PipelineSection
                    title="Contractor Outreach"
                    icon={<HardHat className="w-5 h-5" />}
                    pipeline={vendorPipeline}
                    optimizing={optimizing}
                    applying={applying}
                    onOptimize={handleOptimize}
                    onApply={handleApply}
                    onDismiss={handleDismiss}
                />
            )}

            {/* Sales Lead Pipeline */}
            {salesPipeline.length > 0 && (
                <PipelineSection
                    title="Sales Lead Outreach"
                    icon={<Building2 className="w-5 h-5" />}
                    pipeline={salesPipeline}
                    optimizing={optimizing}
                    applying={applying}
                    onOptimize={handleOptimize}
                    onApply={handleApply}
                    onDismiss={handleDismiss}
                />
            )}

            {vendorPipeline.length === 0 && salesPipeline.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No email templates found. Seed templates to get started.</p>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   PIPELINE SECTION — horizontal sequence funnel
   ═══════════════════════════════════════════════════ */
function PipelineSection({ title, icon, pipeline, optimizing, applying, onOptimize, onApply, onDismiss }: {
    title: string;
    icon: React.ReactNode;
    pipeline: StepGroup[];
    optimizing: string | null;
    applying: string | null;
    onOptimize: (id: string) => void;
    onApply: (id: string, sug: { subject: string; body: string }) => void;
    onDismiss: (id: string) => void;
}) {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    // Summary totals for the pipeline
    const totals = pipeline.reduce((acc, s) => ({
        sent: acc.sent + s.stats.sent,
        delivered: acc.delivered + s.stats.delivered,
        opened: acc.opened + s.stats.opened,
        clicked: acc.clicked + s.stats.clicked,
        bounced: acc.bounced + s.stats.bounced,
    }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });

    return (
        <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
                <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{totals.sent}</strong> total sent</span>
                    <span className={rateColor(totals.opened, totals.sent, 0.3)}>
                        {rate(totals.opened, totals.sent)} opens
                    </span>
                    {totals.bounced > 0 && <span className="text-red-500">{totals.bounced} bounced</span>}
                </div>
            </div>

            {/* Horizontal Pipeline Cards */}
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                {pipeline.map((step, idx) => {
                    const isExpanded = expandedStep === step.step;
                    const openRate = step.stats.sent > 0 ? Math.min(step.stats.opened / step.stats.sent, 1) : 0;
                    const barFill = step.stats.sent > 0 ? Math.min(step.stats.delivered / step.stats.sent, 1) : 0;

                    return (
                        <div key={step.step} className="flex items-stretch flex-shrink-0">
                            {/* Step Card */}
                            <button
                                onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                                className={`flex flex-col justify-between min-w-[180px] max-w-[220px] p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${isExpanded
                                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-md'
                                    : 'border-border bg-card hover:border-muted-foreground/30'
                                    }`}
                            >
                                {/* Step Label */}
                                <div className="mb-3">
                                    <Badge variant="outline" className="text-[10px] font-mono mb-1">Step {step.step}</Badge>
                                    <p className="text-sm font-semibold leading-tight">{step.label}</p>
                                    {step.templates.length > 1 && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {step.templates.length} variants
                                        </p>
                                    )}
                                </div>

                                {/* Key Stats */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Sent</span>
                                        <span className="font-bold">{step.stats.sent}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Opened</span>
                                        <span className={`font-bold ${rateColor(step.stats.opened, step.stats.sent, 0.3)}`}>
                                            {rate(step.stats.opened, step.stats.sent)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Clicked</span>
                                        <span className={`font-bold ${rateColor(step.stats.clicked, step.stats.opened, 0.1)}`}>
                                            {rate(step.stats.clicked, step.stats.opened)}
                                        </span>
                                    </div>
                                    {step.stats.bounced > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Bounced</span>
                                            <span className="font-bold text-red-500">{step.stats.bounced}</span>
                                        </div>
                                    )}

                                    {/* Delivery bar */}
                                    <div className="pt-1">
                                        <div className="w-full bg-muted rounded-full h-1.5">
                                            <div
                                                className="bg-green-500 h-1.5 rounded-full transition-all"
                                                style={{ width: `${barFill * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground mt-0.5 text-right">
                                            {rate(step.stats.delivered, step.stats.sent)} delivered
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {/* Arrow between steps */}
                            {idx < pipeline.length - 1 && (
                                <div className="flex items-center px-2">
                                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Expanded Step Detail */}
            {expandedStep !== null && (() => {
                const step = pipeline.find(s => s.step === expandedStep);
                if (!step) return null;
                return (
                    <Card className="border-sky-200 dark:border-sky-800">
                        <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">
                                    Step {step.step}: {step.label}
                                    <span className="text-muted-foreground font-normal ml-2">
                                        ({step.templates.length} template{step.templates.length > 1 ? 's' : ''})
                                    </span>
                                </h4>
                                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpandedStep(null)}>
                                    Close
                                </Button>
                            </div>

                            {step.templates.map(t => (
                                <TemplateDetail
                                    key={t.id}
                                    template={t}
                                    onOptimize={onOptimize}
                                    onApply={onApply}
                                    onDismiss={onDismiss}
                                    optimizing={optimizing}
                                    applying={applying}
                                />
                            ))}
                        </CardContent>
                    </Card>
                );
            })()}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   TEMPLATE DETAIL — individual template card
   ═══════════════════════════════════════════════════ */
function TemplateDetail({ template: t, onOptimize, onApply, onDismiss, optimizing, applying }: {
    template: Template;
    onOptimize: (id: string) => void;
    onApply: (id: string, sug: { subject: string; body: string }) => void;
    onDismiss: (id: string) => void;
    optimizing: string | null;
    applying: string | null;
}) {
    const s = t.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const variantType = getVariantType(t.id);
    const colors = VARIANT_COLORS[variantType];
    const hasAI = t.aiSuggestions && t.aiSuggestions.length > 0;
    const latestAI = hasAI ? t.aiSuggestions![t.aiSuggestions!.length - 1] : null;
    const [showBody, setShowBody] = useState(false);
    const [showAI, setShowAI] = useState(false);

    return (
        <div className={`rounded-lg border p-4 space-y-3 ${colors.bg} ${colors.border}`}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`${colors.badge} ${colors.badgeText} text-[10px] shadow-none border-none`}>
                        {variantType === 'warm' ? '🔥 Warm' : variantType === 'cold' ? '❄️ Cold' : '📧 Base'}
                    </Badge>
                    <span className="text-sm font-medium">{t.name}</span>
                    <code className="text-[9px] text-muted-foreground bg-muted px-1 rounded hidden sm:inline">{t.id}</code>
                </div>
                <div className="flex items-center gap-1">
                    {hasAI && (
                        <Button variant="ghost" size="sm" className="text-xs gap-1 text-purple-600" onClick={() => setShowAI(!showAI)}>
                            <Sparkles className="w-3 h-3" /> {showAI ? 'Hide' : 'View'} AI
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onOptimize(t.id)} disabled={optimizing === t.id}>
                        {optimizing === t.id
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Optimizing...</>
                            : <><Sparkles className="w-3 h-3" /> AI Optimize</>}
                    </Button>
                </div>
            </div>

            {/* Subject */}
            <div className="text-xs">
                <span className="font-medium text-foreground">Subject:</span>{' '}
                <span className="text-muted-foreground">{t.subject}</span>
            </div>

            {/* Body toggle */}
            <div>
                <button onClick={() => setShowBody(!showBody)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {showBody ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showBody ? 'Hide email body' : 'Show full email body'}
                </button>
                {showBody && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md border text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto">
                        {t.body || 'No body content'}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                    <p className="text-base font-bold">{s.sent}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Sent</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${rateColor(s.delivered, s.sent, 0.9)}`}>{rate(s.delivered, s.sent)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Delivered</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${rateColor(s.opened, s.sent, 0.3)}`}>{rate(s.opened, s.sent)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Opened</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${rateColor(s.clicked, s.opened, 0.1)}`}>{rate(s.clicked, s.opened)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Clicked</p>
                </div>
                <div>
                    <p className={`text-base font-bold ${s.bounced > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{s.bounced}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Bounced</p>
                </div>
            </div>

            {/* AI Suggestions */}
            {showAI && latestAI && (
                <div className="border rounded-lg p-4 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-800 dark:text-purple-300">AI Suggestions</span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onDismiss(t.id)}>Dismiss</Button>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-400">{latestAI.analysis}</p>
                    {latestAI.suggestions?.map((sug, i) => (
                        <div key={i} className="p-3 bg-white dark:bg-card rounded border space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Option {i + 1}</span>
                                <Button size="sm" className="text-xs h-7 gap-1" onClick={() => onApply(t.id, sug)} disabled={applying === t.id}>
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
