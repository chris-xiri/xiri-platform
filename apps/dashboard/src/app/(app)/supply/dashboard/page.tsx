'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import VendorList from '@/components/VendorList';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { AddContractorDialog } from '@/components/AddContractorDialog';
import { Vendor } from '@xiri/shared';
import {
    Users, CheckCircle, Mail, Eye, MousePointerClick, ArrowRight,
    Loader2, TrendingUp, AlertTriangle, UserCheck, Clock, XCircle,
    Plus, ShieldCheck, CalendarCheck, Rocket, Star, Pause, Ban, FileSearch,
    ChevronUp, ChevronDown,
} from 'lucide-react';

/* ───────── Funnel / Pipeline Helpers ─────────────────────────────────── */

interface FunnelData {
    total: number; sourced: number; sent: number; delivered: number;
    opened: number; clicked: number; onboarded: number;
    bounced: number; failed: number; awaitingOnboarding: number; needsManual: number;
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
        if (status === 'onboarded' || status === 'active') data.onboarded++;
        if (status === 'qualified' && !outreach) data.sourced++;
        if (status === 'awaiting_onboarding') data.awaitingOnboarding++;
        if (outreach === 'SENT') data.sent++;
        if (outreach === 'FAILED') data.failed++;
        if (outreach === 'NEEDS_MANUAL' || outreach === 'NEEDS_MANUAL_OUTREACH') data.needsManual++;
        if (engagement === 'delivered' || engagement === 'opened' || engagement === 'clicked') data.delivered++;
        if (engagement === 'opened' || engagement === 'clicked') data.opened++;
        if (engagement === 'clicked') data.clicked++;
        if (engagement === 'bounced') data.bounced++;
    }
    return data;
}

function pct(n: number, d: number): string { return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`; }

/* ───────── Status Tabs ───────────────────────────────────────────────── */

const STATUS_TABS = [
    { key: 'all', label: 'All', icon: Users, color: '' },
    { key: 'pending_review', label: 'Sourced', icon: Users, color: 'text-sky-600 dark:text-sky-400' },
    { key: 'qualified', label: 'Qualified', icon: CheckCircle, color: 'text-blue-600 dark:text-blue-400' },
    { key: 'awaiting_onboarding', label: 'Awaiting Form', icon: Mail, color: 'text-indigo-600' },
    { key: 'compliance_review', label: 'Compliance', icon: ShieldCheck, color: 'text-amber-600 dark:text-amber-400' },
    { key: 'pending_verification', label: 'Verifying Docs', icon: FileSearch, color: 'text-orange-600 dark:text-orange-400' },
    { key: 'onboarding_scheduled', label: 'Onboarding Call', icon: CalendarCheck, color: 'text-violet-600' },
    { key: 'ready_for_assignment', label: 'Ready', icon: Rocket, color: 'text-teal-600' },
    { key: 'active', label: 'Active', icon: Star, color: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'suspended', label: 'Suspended', icon: Pause, color: 'text-orange-600 dark:text-orange-400' },
    { key: 'dismissed', label: 'Dismissed', icon: Ban, color: 'text-red-600 dark:text-red-400' },
] as const;

/* ───────── Component ─────────────────────────────────────────────────── */

export default function SupplyDashboardPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [showAddContractor, setShowAddContractor] = useState(false);
    const [funnelCollapsed, setFunnelCollapsed] = useState(true);

    // Live Firestore listener
    useEffect(() => {
        const q = query(collection(db, 'vendors'), orderBy('createdAt', 'desc'), limit(500));
        const unsub = onSnapshot(q, (snap) => {
            setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Counts per status
    const counts = useMemo(() => {
        const map: Record<string, number> = { all: vendors.length };
        for (const v of vendors) {
            const s = (v.status || 'pending_review').toLowerCase();
            map[s] = (map[s] || 0) + 1;
        }
        return map;
    }, [vendors]);

    // Status filter for VendorList
    const statusFilters = useMemo(() => {
        if (activeTab === 'all') return undefined;
        return [activeTab, activeTab.toUpperCase()];
    }, [activeTab]);

    const funnel = useMemo(() => computeFunnel(vendors), [vendors]);

    if (loading) {
        return (
            <ProtectedRoute resource="supply/recruitment">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute resource="supply/recruitment">
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
                {/* ─── Header ────────────────────────────────────────────── */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b bg-card">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Supply Pipeline</h1>
                            <p className="text-sm text-muted-foreground">{vendors.length} contractors • Outreach funnel + CRM</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                                onClick={() => setFunnelCollapsed(prev => !prev)}>
                                {funnelCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                {funnelCollapsed ? 'Show Funnel' : 'Hide Funnel'}
                            </Button>
                            <Button onClick={() => setShowAddContractor(true)} className="gap-2" size="sm">
                                <Plus className="w-4 h-4" /> Add Contractor
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Collapsible Funnel Stats ──────────────────────────── */}
                {!funnelCollapsed && (
                    <div className="flex-shrink-0 px-4 sm:px-6 py-4 space-y-4 border-b bg-muted/20">
                        {/* Stat Cards */}
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Contractors</p>
                                            <p className="text-xl font-bold">{funnel.total}</p>
                                        </div>
                                        <Users className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Onboarded</p>
                                            <p className="text-xl font-bold">{funnel.onboarded}</p>
                                        </div>
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Awaiting Response</p>
                                            <p className="text-xl font-bold">{funnel.awaitingOnboarding}</p>
                                        </div>
                                        <Clock className="w-5 h-5 text-amber-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Email → Onboard</p>
                                            <p className="text-xl font-bold">{pct(funnel.onboarded, funnel.sent || 1)}</p>
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-sky-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Funnel Mini Bar */}
                        <div className="flex items-center gap-2 text-xs">
                            {[
                                { label: 'Sent', count: funnel.sent, color: 'bg-sky-50 dark:bg-sky-950/300' },
                                { label: 'Delivered', count: funnel.delivered, color: 'bg-green-50 dark:bg-green-950/300' },
                                { label: 'Opened', count: funnel.opened, color: 'bg-blue-50 dark:bg-blue-950/300' },
                                { label: 'Clicked', count: funnel.clicked, color: 'bg-purple-50 dark:bg-purple-950/300' },
                                { label: 'Onboarded', count: funnel.onboarded, color: 'bg-emerald-600' },
                            ].map((step, i, arr) => (
                                <div key={step.label} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                                    <span className="text-muted-foreground">{step.label}</span>
                                    <span className="font-bold tabular-nums">{step.count}</span>
                                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-1" />}
                                </div>
                            ))}
                            {funnel.bounced > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-red-500 dark:text-red-400">
                                    <XCircle className="w-3 h-3" /> {funnel.bounced} bounced
                                </div>
                            )}
                            {funnel.failed > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-orange-500">
                                    <AlertTriangle className="w-3 h-3" /> {funnel.failed} failed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Status Tabs ────────────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center gap-1 overflow-x-auto px-4 sm:px-6 py-2 border-b bg-card">
                    {STATUS_TABS.map((tab) => {
                        const count = counts[tab.key] || 0;
                        const isActive = activeTab === tab.key;
                        const Icon = tab.icon;
                        if (tab.key !== 'all' && count === 0) return null;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                                    ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? '' : tab.color}`} />
                                {tab.label}
                                {count > 0 && (
                                    <Badge
                                        variant={isActive ? 'outline' : 'secondary'}
                                        className={`text-[10px] px-1 py-0 h-4 ml-0.5 ${isActive ? 'border-primary-foreground/30 text-primary-foreground' : ''}`}
                                    >
                                        {count}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ─── CRM Table ──────────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden px-4 sm:px-6 py-2">
                    <VendorList
                        title="Vendor Pipeline"
                        statusFilters={statusFilters}
                        onSelectVendor={(id) => setSelectedVendorId(id)}
                        selectedVendorId={selectedVendorId}
                    />
                </div>

                {/* ─── Detail Drawer ──────────────────────────────────────── */}
                <VendorDetailDrawer
                    vendorId={selectedVendorId}
                    open={!!selectedVendorId}
                    onClose={() => setSelectedVendorId(null)}
                />

                <AddContractorDialog open={showAddContractor} onOpenChange={setShowAddContractor} />
            </div>
        </ProtectedRoute>
    );
}
