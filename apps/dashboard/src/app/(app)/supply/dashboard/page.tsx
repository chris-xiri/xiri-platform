'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users, CheckCircle, Mail, Eye, MousePointerClick, ArrowRight,
    Loader2, TrendingUp, AlertTriangle, UserCheck, Clock, XCircle
} from 'lucide-react';

interface FunnelData {
    total: number;
    sourced: number;       // qualified, not yet outreached
    sent: number;          // outreachStatus = SENT
    delivered: number;     // emailEngagement.lastEvent = delivered | opened | clicked
    opened: number;        // emailEngagement.lastEvent = opened | clicked
    clicked: number;       // emailEngagement.lastEvent = clicked
    onboarded: number;     // status = onboarded | active
    bounced: number;       // emailEngagement.lastEvent = bounced
    failed: number;        // outreachStatus = FAILED
    awaitingOnboarding: number;
    needsManual: number;   // outreachStatus = NEEDS_MANUAL
}

interface PipelineBreakdown {
    new_lead: number;
    qualified: number;
    awaiting_onboarding: number;
    onboarding_started: number;
    onboarded: number;
    active: number;
    rejected: number;
    blacklisted: number;
}

function computeFunnel(vendors: any[]): FunnelData {
    const data: FunnelData = {
        total: vendors.length,
        sourced: 0, sent: 0, delivered: 0, opened: 0, clicked: 0,
        onboarded: 0, bounced: 0, failed: 0, awaitingOnboarding: 0, needsManual: 0,
    };

    for (const v of vendors) {
        const status = v.status || 'new_lead';
        const outreach = v.outreachStatus;
        const engagement = v.emailEngagement?.lastEvent;

        // Pipeline counts
        if (status === 'onboarded' || status === 'active') data.onboarded++;
        if (status === 'qualified' && !outreach) data.sourced++;
        if (status === 'awaiting_onboarding') data.awaitingOnboarding++;

        // Outreach counts
        if (outreach === 'SENT') data.sent++;
        if (outreach === 'FAILED') data.failed++;
        if (outreach === 'NEEDS_MANUAL' || outreach === 'NEEDS_MANUAL_OUTREACH') data.needsManual++;

        // Engagement counts (cumulative — clicked implies opened implies delivered)
        if (engagement === 'delivered' || engagement === 'opened' || engagement === 'clicked') data.delivered++;
        if (engagement === 'opened' || engagement === 'clicked') data.opened++;
        if (engagement === 'clicked') data.clicked++;
        if (engagement === 'bounced') data.bounced++;
    }

    return data;
}

function computePipeline(vendors: any[]): PipelineBreakdown {
    const p: PipelineBreakdown = {
        new_lead: 0, qualified: 0, awaiting_onboarding: 0,
        onboarding_started: 0, onboarded: 0, active: 0, rejected: 0, blacklisted: 0,
    };
    for (const v of vendors) {
        const s = v.status as keyof PipelineBreakdown;
        if (s in p) p[s]++;
    }
    return p;
}

function pct(numerator: number, denominator: number): string {
    if (denominator === 0) return '—';
    return `${Math.round((numerator / denominator) * 100)}%`;
}

function FunnelStep({ label, count, total, icon: Icon, color, isLast }: {
    label: string; count: number; total: number; icon: React.ElementType; color: string; isLast?: boolean;
}) {
    const rate = total > 0 ? Math.round((count / total) * 100) : 0;
    const barWidth = total > 0 ? Math.max(8, (count / total) * 100) : 8;

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-xs font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums">{count}</span>
                        <Badge variant="outline" className="text-[9px] px-1 h-4 tabular-nums">{pct(count, total)}</Badge>
                    </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
                        style={{ width: `${barWidth}%` }}
                    />
                </div>
            </div>
            {!isLast && <ArrowRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 mt-3" />}
        </div>
    );
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
    title: string; value: string | number; subtitle: string; icon: React.ElementType; trend?: 'up' | 'down' | 'neutral';
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
            </CardContent>
        </Card>
    );
}

export default function SupplyDashboardPage() {
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const snap = await getDocs(collection(db, 'vendors'));
                setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('Error loading vendors:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <ProtectedRoute resource="supply/recruitment">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            </ProtectedRoute>
        );
    }

    const funnel = computeFunnel(vendors);
    const pipeline = computePipeline(vendors);

    return (
        <ProtectedRoute resource="supply/recruitment">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Supply Dashboard</h1>
                    <p className="text-muted-foreground">Contractor network, outreach funnel, and pipeline health</p>
                </div>

                {/* Top-level stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Contractors"
                        value={funnel.total}
                        subtitle="In your network"
                        icon={Users}
                    />
                    <StatCard
                        title="Onboarded"
                        value={funnel.onboarded}
                        subtitle={`${pct(funnel.onboarded, funnel.total)} of network`}
                        icon={CheckCircle}
                    />
                    <StatCard
                        title="Awaiting Response"
                        value={funnel.awaitingOnboarding}
                        subtitle="Outreach sent, waiting"
                        icon={Clock}
                    />
                    <StatCard
                        title="Email → Onboard Rate"
                        value={pct(funnel.onboarded, funnel.sent || 1)}
                        subtitle={`${funnel.onboarded} of ${funnel.sent} emailed`}
                        icon={TrendingUp}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Outreach Funnel */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Outreach Funnel
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Conversion at each stage — from sent to onboarded
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FunnelStep label="Emails Sent" count={funnel.sent} total={funnel.sent || 1} icon={Mail} color="text-sky-500" />
                            <FunnelStep label="Delivered" count={funnel.delivered} total={funnel.sent || 1} icon={CheckCircle} color="text-green-500" />
                            <FunnelStep label="Opened" count={funnel.opened} total={funnel.sent || 1} icon={Eye} color="text-blue-500" />
                            <FunnelStep label="Clicked" count={funnel.clicked} total={funnel.sent || 1} icon={MousePointerClick} color="text-purple-500" />
                            <FunnelStep label="Onboarded" count={funnel.onboarded} total={funnel.sent || 1} icon={UserCheck} color="text-emerald-500" isLast />

                            {/* Problem indicators */}
                            {(funnel.bounced > 0 || funnel.failed > 0 || funnel.needsManual > 0) && (
                                <div className="pt-3 border-t space-y-2">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Issues</p>
                                    {funnel.bounced > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 text-red-500"><XCircle className="w-3 h-3" /> Bounced</span>
                                            <Badge variant="destructive" className="text-[10px]">{funnel.bounced}</Badge>
                                        </div>
                                    )}
                                    {funnel.failed > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 text-orange-500"><AlertTriangle className="w-3 h-3" /> Failed</span>
                                            <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">{funnel.failed}</Badge>
                                        </div>
                                    )}
                                    {funnel.needsManual > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1.5 text-amber-500"><AlertTriangle className="w-3 h-3" /> Needs Manual Outreach</span>
                                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">{funnel.needsManual}</Badge>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pipeline Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Pipeline Breakdown
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Where your contractors are in the onboarding pipeline
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { label: 'New Lead', count: pipeline.new_lead, color: 'bg-slate-400' },
                                    { label: 'Qualified', count: pipeline.qualified, color: 'bg-blue-500' },
                                    { label: 'Awaiting Onboarding', count: pipeline.awaiting_onboarding, color: 'bg-amber-500' },
                                    { label: 'Onboarding Started', count: pipeline.onboarding_started, color: 'bg-sky-500' },
                                    { label: 'Onboarded', count: pipeline.onboarded, color: 'bg-green-500' },
                                    { label: 'Active', count: pipeline.active, color: 'bg-emerald-600' },
                                    { label: 'Rejected', count: pipeline.rejected, color: 'bg-red-400', hidden: pipeline.rejected === 0 },
                                    { label: 'Blacklisted', count: pipeline.blacklisted, color: 'bg-red-600', hidden: pipeline.blacklisted === 0 },
                                ].filter(s => !s.hidden).map(stage => (
                                    <div key={stage.label} className="flex items-center gap-3">
                                        <div className="w-24 text-xs text-muted-foreground truncate">{stage.label}</div>
                                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
                                            <div
                                                className={`h-full rounded-full ${stage.color} transition-all duration-700`}
                                                style={{ width: `${funnel.total > 0 ? Math.max(2, (stage.count / funnel.total) * 100) : 0}%` }}
                                            />
                                        </div>
                                        <div className="w-10 text-right text-sm font-bold tabular-nums">{stage.count}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Conversion summary */}
                            <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-3">
                                <div className="text-center p-3 rounded-lg bg-muted/50">
                                    <div className="text-lg font-bold">{pct(funnel.onboarded, funnel.total)}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Conversion</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-muted/50">
                                    <div className="text-lg font-bold">{pct(funnel.opened, funnel.sent || 1)}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Open Rate</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ProtectedRoute>
    );
}
