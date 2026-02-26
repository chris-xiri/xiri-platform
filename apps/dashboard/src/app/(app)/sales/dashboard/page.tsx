'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DollarSign, TrendingUp, Users, Target, Clock, CheckCircle,
    Mail, ArrowRight, Plus, XCircle, AlertTriangle,
    ChevronUp, ChevronDown, Loader2, Eye, MousePointerClick
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import LeadList from '@/components/LeadList';
import LeadDetailDrawer from '@/components/lead/LeadDetailDrawer';
import { AddLeadDialog } from '@/components/AddLeadDialog';

/* ─── Helpers ─────────────────────────────────────────────────────── */

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: any): string => {
    if (!d) return '—';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function pct(n: number, d: number): string {
    return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

/* ─── Commission Status Colors ────────────────────────────────────── */

const COMM_STATUS: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    PARTIALLY_CANCELLED: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const PAYOUT_ICON: Record<string, React.ReactNode> = {
    PAID: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
    PENDING: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    CANCELLED: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

/* ─── Status Tabs ─────────────────────────────────────────────────── */

const STATUS_TABS = [
    { key: 'all', label: 'All', icon: Users, color: '' },
    { key: 'new', label: 'New', icon: Users, color: 'text-blue-600' },
    { key: 'contacted', label: 'Contacted', icon: Mail, color: 'text-yellow-600' },
    { key: 'qualified', label: 'Qualified', icon: CheckCircle, color: 'text-green-600' },
    { key: 'walkthrough', label: 'Walkthrough', icon: Eye, color: 'text-purple-600' },
    { key: 'proposal', label: 'Proposal', icon: Target, color: 'text-orange-600' },
    { key: 'quoted', label: 'Quoted', icon: DollarSign, color: 'text-sky-600' },
    { key: 'won', label: 'Won', icon: CheckCircle, color: 'text-emerald-600' },
    { key: 'lost', label: 'Lost', icon: XCircle, color: 'text-gray-500' },
] as const;

/* ─── Commission Interface ────────────────────────────────────────── */

interface CommRow {
    id: string;
    staffId: string;
    quoteId: string;
    leadId: string;
    type: string;
    mrr: number;
    acv: number;
    rate: number;
    totalCommission: number;
    status: string;
    payoutSchedule: { month: number; amount: number; percentage: number; status: string; scheduledAt: any; paidAt: any }[];
    createdAt: any;
}

/* ─── Component ───────────────────────────────────────────────────── */

export default function SalesDashboardPage() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<any[]>([]);
    const [commRecords, setCommRecords] = useState<CommRow[]>([]);
    const [leadNames, setLeadNames] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState('all');
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [showAddLead, setShowAddLead] = useState(false);
    const [statsCollapsed, setStatsCollapsed] = useState(true);
    const [expandedCommId, setExpandedCommId] = useState<string | null>(null);

    // Fetch all data
    useEffect(() => {
        if (!profile?.uid) return;

        // Live listener on leads
        const leadsUnsub = onSnapshot(
            query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(500)),
            (snap) => {
                setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        );

        // Fetch commissions for current user
        async function fetchCommissions() {
            try {
                const commSnap = await getDocs(query(
                    collection(db, 'commissions'),
                    where('staffId', '==', profile!.uid),
                ));
                const rows: CommRow[] = commSnap.docs.map(d => ({ id: d.id, ...d.data() } as CommRow));
                rows.sort((a, b) => {
                    const aD = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const bD = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return bD.getTime() - aD.getTime();
                });
                setCommRecords(rows);

                // Fetch lead names
                const leadIds = [...new Set(rows.map(r => r.leadId).filter(Boolean))];
                const names: Record<string, string> = {};
                for (const lid of leadIds) {
                    try {
                        const leadDoc = await getDoc(doc(db, 'leads', lid));
                        if (leadDoc.exists()) {
                            const ld = leadDoc.data();
                            names[lid] = ld.businessName || ld.companyName || ld.name || lid;
                        }
                    } catch { /* ignore */ }
                }
                setLeadNames(names);
            } catch (err) {
                console.error('Error fetching commissions:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchCommissions();

        return () => leadsUnsub();
    }, [profile?.uid]);

    // Pipeline counts
    const counts = useMemo(() => {
        const map: Record<string, number> = { all: leads.length };
        for (const l of leads) {
            const s = (l.status || 'new').toLowerCase();
            map[s] = (map[s] || 0) + 1;
        }
        return map;
    }, [leads]);

    // Outreach stats
    const outreach = useMemo(() => {
        let sent = 0, opened = 0, clicked = 0, bounced = 0;
        for (const l of leads) {
            const os = l.outreachStatus;
            if (os === 'SENT' || os === 'REPLIED') sent++;
            const eng = l.emailEngagement?.lastEvent;
            if (eng === 'opened' || eng === 'clicked') opened++;
            if (eng === 'clicked') clicked++;
            if (eng === 'bounced') bounced++;
        }
        return { sent, opened, clicked, bounced };
    }, [leads]);

    // Commission totals
    const commTotals = useMemo(() => {
        let earned = 0, pending = 0;
        for (const c of commRecords) {
            for (const p of c.payoutSchedule || []) {
                if (p.status === 'PAID') earned += p.amount;
                else if (p.status === 'PENDING') pending += p.amount;
            }
        }
        return { earned, pending };
    }, [commRecords]);

    // Quotes ACV
    const [totalAcv, setTotalAcv] = useState(0);
    useEffect(() => {
        getDocs(query(collection(db, 'quotes'), where('status', '==', 'accepted')))
            .then(snap => setTotalAcv(snap.docs.reduce((s, d) => s + ((d.data().totalMonthlyRate || 0) * 12), 0)))
            .catch(() => { });
    }, []);

    const wonCount = counts['won'] || 0;
    const convRate = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0;

    // Status filter for LeadList
    const statusFilters = useMemo(() => {
        if (activeTab === 'all') return undefined;
        return [activeTab];
    }, [activeTab]);

    const typeLabel = (t: string) => {
        switch (t) {
            case 'SALES_NEW': return 'New Sale';
            case 'FSM_UPSELL': return 'Upsell';
            case 'FSM_RETENTION': return 'NRR Bonus';
            default: return t;
        }
    };

    if (loading) {
        return (
            <ProtectedRoute resource="sales/dashboard">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute resource="sales/dashboard">
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
                {/* ─── Header ──────────────────────────────────────── */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b bg-card">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Sales Pipeline</h1>
                            <p className="text-sm text-muted-foreground">
                                {leads.length} leads • {wonCount} won • {fmt(totalAcv)} ACV
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                                onClick={() => setStatsCollapsed(prev => !prev)}>
                                {statsCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                {statsCollapsed ? 'Show Stats' : 'Hide Stats'}
                            </Button>
                            <Button onClick={() => setShowAddLead(true)} className="gap-2" size="sm">
                                <Plus className="w-4 h-4" /> Add Lead
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Collapsible Stats ─────────────────────────── */}
                {!statsCollapsed && (
                    <div className="flex-shrink-0 px-4 sm:px-6 py-4 space-y-4 border-b bg-muted/20">
                        {/* KPI Cards */}
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Leads</p>
                                            <p className="text-xl font-bold">{leads.length}</p>
                                        </div>
                                        <Users className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Win Rate</p>
                                            <p className="text-xl font-bold">{convRate}%</p>
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-sky-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total ACV</p>
                                            <p className="text-xl font-bold">{fmt(totalAcv)}</p>
                                        </div>
                                        <DollarSign className="w-5 h-5 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border border-green-200 dark:border-green-900">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Earned</p>
                                            <p className="text-xl font-bold text-green-600">{fmt(commTotals.earned)}</p>
                                        </div>
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border border-amber-200 dark:border-amber-900">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Pending</p>
                                            <p className="text-xl font-bold text-amber-600">{fmt(commTotals.pending)}</p>
                                        </div>
                                        <Clock className="w-5 h-5 text-amber-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Inline Outreach Funnel Bar */}
                        <div className="flex items-center gap-2 text-xs">
                            {[
                                { label: 'Sent', count: outreach.sent, color: 'bg-sky-500' },
                                { label: 'Opened', count: outreach.opened, color: 'bg-blue-500' },
                                { label: 'Clicked', count: outreach.clicked, color: 'bg-purple-500' },
                                { label: 'Won', count: wonCount, color: 'bg-emerald-600' },
                            ].map((step, i, arr) => (
                                <div key={step.label} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                                    <span className="text-muted-foreground">{step.label}</span>
                                    <span className="font-bold tabular-nums">{step.count}</span>
                                    <span className="text-muted-foreground/50 text-[10px]">{pct(step.count, outreach.sent || 1)}</span>
                                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-1" />}
                                </div>
                            ))}
                            {outreach.bounced > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-red-500">
                                    <AlertTriangle className="w-3 h-3" /> {outreach.bounced} bounced
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Status Tabs ─────────────────────────────────── */}
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

                {/* ─── CRM Table ───────────────────────────────────── */}
                <div className="flex-1 overflow-hidden px-4 sm:px-6 py-2">
                    <LeadList
                        title="Sales Pipeline"
                        statusFilters={statusFilters}
                        onRowClick={(id) => setSelectedLeadId(id)}
                    />
                </div>

                {/* ─── Commission Table (Accounting-style) ─────────── */}
                {commRecords.length > 0 && (
                    <div className="flex-shrink-0 border-t">
                        <div className="px-4 sm:px-6 py-2 bg-muted/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-semibold">My Commissions</span>
                                <Badge variant="secondary" className="text-[10px]">{commRecords.length}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-green-600 font-medium">{fmt(commTotals.earned)} earned</span>
                                <span className="text-amber-600 font-medium">{fmt(commTotals.pending)} pending</span>
                            </div>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-xs">
                                        <th className="text-left p-2 pl-4 sm:pl-6 font-medium">Client</th>
                                        <th className="text-left p-2 font-medium">Type</th>
                                        <th className="text-right p-2 font-medium">ACV</th>
                                        <th className="text-right p-2 font-medium">Rate</th>
                                        <th className="text-right p-2 font-medium">Commission</th>
                                        <th className="text-center p-2 font-medium">Status</th>
                                        <th className="p-2 pr-4 sm:pr-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commRecords.map(c => (
                                        <>
                                            <tr
                                                key={c.id}
                                                className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                                                onClick={() => setExpandedCommId(expandedCommId === c.id ? null : c.id)}
                                            >
                                                <td className="p-2 pl-4 sm:pl-6 font-medium">{leadNames[c.leadId] || c.leadId || '—'}</td>
                                                <td className="p-2">
                                                    <Badge variant="outline" className="text-[10px]">{typeLabel(c.type)}</Badge>
                                                </td>
                                                <td className="p-2 text-right font-mono text-xs">{fmt(c.acv)}</td>
                                                <td className="p-2 text-right text-xs">{(c.rate * 100).toFixed(0)}%</td>
                                                <td className="p-2 text-right font-mono font-semibold">{fmt(c.totalCommission)}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${COMM_STATUS[c.status] || ''}`}>
                                                        {c.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-2 pr-4 sm:pr-6">
                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedCommId === c.id ? 'rotate-180' : ''}`} />
                                                </td>
                                            </tr>
                                            {expandedCommId === c.id && (
                                                <tr key={`${c.id}-detail`}>
                                                    <td colSpan={7} className="bg-muted/10 p-3 pl-4 sm:pl-6">
                                                        <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Payout Schedule</p>
                                                        <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-muted-foreground pb-1 border-b">
                                                            <span>Payout</span>
                                                            <span className="text-right">Amount</span>
                                                            <span className="text-center">Scheduled</span>
                                                            <span className="text-center">Status</span>
                                                        </div>
                                                        {c.payoutSchedule.map((p, i) => (
                                                            <div key={i} className="grid grid-cols-4 gap-2 text-xs items-center py-1.5">
                                                                <span>Payout {i + 1} ({p.percentage}%)</span>
                                                                <span className="text-right font-mono">{fmt(p.amount)}</span>
                                                                <span className="text-center text-muted-foreground text-[10px]">
                                                                    {p.paidAt ? fmtDate(p.paidAt) : p.scheduledAt ? fmtDate(p.scheduledAt) : 'Awaiting invoice'}
                                                                </span>
                                                                <span className="flex items-center justify-center gap-1">
                                                                    {PAYOUT_ICON[p.status]}
                                                                    <span className={`text-[10px] ${COMM_STATUS[p.status] || ''} px-1 py-0.5 rounded`}>
                                                                        {p.status}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── Drawers / Dialogs ───────────────────────────── */}
                <LeadDetailDrawer
                    leadId={selectedLeadId}
                    open={!!selectedLeadId}
                    onClose={() => setSelectedLeadId(null)}
                />
                <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} />
            </div>
        </ProtectedRoute>
    );
}
