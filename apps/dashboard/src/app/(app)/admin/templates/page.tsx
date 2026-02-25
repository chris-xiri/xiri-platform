'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Sparkles, CheckCircle, XCircle, RefreshCw, TrendingUp, TrendingDown, Mail, MousePointerClick, Eye, AlertTriangle } from 'lucide-react';

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
            .filter(t => t.category === 'vendor' || t.category === 'vendor_email')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setTemplates(data);
        setLoading(false);
    }

    async function handleOptimize(templateId: string) {
        setOptimizing(templateId);
        try {
            const fn = httpsCallable(functions, 'optimizeTemplate');
            await fn({ templateId });
            await fetchTemplates(); // reload
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
                // Reset stats for the new version
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
        return `${((n / d) * 100).toFixed(1)}%`;
    }

    function getRateColor(n: number, d: number, threshold: number): string {
        if (d === 0) return 'text-muted-foreground';
        const pct = n / d;
        if (pct >= threshold) return 'text-green-600';
        if (pct >= threshold * 0.7) return 'text-amber-600';
        return 'text-red-600';
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Template Analytics</h2>
                    <p className="text-sm text-muted-foreground">
                        Track email performance and get AI-powered optimization suggestions
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTemplates} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
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

            {/* Template Cards */}
            {templates.map(t => {
                const s = t.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
                const hasAI = t.aiSuggestions && t.aiSuggestions.length > 0;
                const latestAI = hasAI ? t.aiSuggestions![t.aiSuggestions!.length - 1] : null;
                const isUnderperforming = s.sent >= 10 && (s.opened / s.sent) < 0.3;

                return (
                    <Card key={t.id} className={isUnderperforming ? 'border-amber-300' : ''}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base">{t.name}</CardTitle>
                                    {t.id.includes('_warm') && <Badge className="bg-orange-100 text-orange-700 text-[10px]">Warm</Badge>}
                                    {t.id.includes('_cold') && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Cold</Badge>}
                                    {isUnderperforming && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Low Performance
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => handleOptimize(t.id)}
                                    disabled={optimizing === t.id}
                                >
                                    {optimizing === t.id ? (
                                        <><RefreshCw className="w-3 h-3 animate-spin" /> Optimizing...</>
                                    ) : (
                                        <><Sparkles className="w-3 h-3" /> AI Optimize</>
                                    )}
                                </Button>
                            </div>
                            <CardDescription className="text-xs">
                                <code className="text-[10px] bg-muted px-1 rounded">{t.id}</code>
                                {' · Subject: '}<span className="font-medium">{t.subject}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats Row */}
                            <div className="grid grid-cols-5 gap-3 text-center">
                                <div>
                                    <p className="text-lg font-bold">{s.sent}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Sent</p>
                                </div>
                                <div>
                                    <p className={`text-lg font-bold ${getRateColor(s.delivered, s.sent, 0.9)}`}>
                                        {rate(s.delivered, s.sent)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Delivered</p>
                                </div>
                                <div>
                                    <p className={`text-lg font-bold ${getRateColor(s.opened, s.sent, 0.3)}`}>
                                        {rate(s.opened, s.sent)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Opened</p>
                                </div>
                                <div>
                                    <p className={`text-lg font-bold ${getRateColor(s.clicked, s.opened, 0.1)}`}>
                                        {rate(s.clicked, s.opened)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Clicked</p>
                                </div>
                                <div>
                                    <p className={`text-lg font-bold ${s.bounced > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        {s.bounced}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Bounced</p>
                                </div>
                            </div>

                            {/* AI Suggestions */}
                            {latestAI && (
                                <div className="border rounded-lg p-4 bg-purple-50/50 border-purple-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-800">AI Suggestions</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-muted-foreground"
                                            onClick={() => handleDismissSuggestions(t.id)}
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                    <p className="text-xs text-purple-700">{latestAI.analysis}</p>

                                    {latestAI.shortUrlTest && (
                                        <div className="text-xs p-2 bg-white/60 rounded border border-purple-100">
                                            <span className="font-medium">🔗 URL Test:</span> {latestAI.shortUrlTest.recommendation}
                                        </div>
                                    )}

                                    {latestAI.suggestions?.map((sug, i) => (
                                        <div key={i} className="p-3 bg-white rounded border space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium">Option {i + 1}</span>
                                                <Button
                                                    size="sm"
                                                    className="text-xs h-7 gap-1"
                                                    onClick={() => handleApplySuggestion(t.id, sug)}
                                                    disabled={applying === t.id}
                                                >
                                                    <CheckCircle className="w-3 h-3" /> Apply
                                                </Button>
                                            </div>
                                            <p className="text-xs"><span className="font-medium">Subject:</span> {sug.subject}</p>
                                            <p className="text-[11px] text-muted-foreground line-clamp-3">{sug.body}</p>
                                            <p className="text-[10px] text-purple-600 italic">{sug.rationale}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
