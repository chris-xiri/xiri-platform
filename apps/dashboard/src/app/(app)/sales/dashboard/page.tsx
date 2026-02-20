'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Target, Clock, CheckCircle, AlertTriangle, Calendar, ArrowRight, Zap } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const formatDate = (d: any): string => {
    if (!d) return 'TBD';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const monthLabel = (d: any): string => {
    if (!d) return 'TBD';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

function estimatePayoutDate(createdAt: any, payoutIndex: number): Date | null {
    if (!createdAt) return null;
    const base = createdAt.toDate?.() || new Date(createdAt);
    const estimated = new Date(base);
    estimated.setDate(estimated.getDate() + 60 + (payoutIndex * 30));
    return estimated;
}

interface PayoutEntry {
    month: number;
    amount: number;
    percentage: number;
    status: string;
    scheduledAt: any;
    paidAt: any;
}

interface CommissionRecord {
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
    payoutSchedule: PayoutEntry[];
    createdAt: any;
}

export default function SalesDashboardPage() {
    const { profile } = useAuth();
    const [stats, setStats] = useState({
        totalLeads: 0,
        qualifiedLeads: 0,
        wonDeals: 0,
        totalAcv: 0,
    });
    const [commissions, setCommissions] = useState({
        totalEarned: 0,
        totalPending: 0,
        nextPayout: null as { amount: number; date: Date } | null,
        recentPayouts: [] as { amount: number; date: Date; description: string }[],
    });
    const [commRecords, setCommRecords] = useState<CommissionRecord[]>([]);
    const [leadNames, setLeadNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile?.uid) return;
        async function fetchData() {
            try {
                // Fetch leads
                const leadsSnap = await getDocs(collection(db, 'leads'));
                const leads = leadsSnap.docs.map(d => d.data());
                const qualified = leads.filter(l => ['qualified', 'walkthrough', 'proposal', 'quoted', 'won'].includes(l.status));
                const won = leads.filter(l => l.status === 'won');

                // Fetch quotes for ACV
                const quotesSnap = await getDocs(query(collection(db, 'quotes'), where('status', '==', 'accepted')));
                const totalAcv = quotesSnap.docs.reduce((sum, d) => sum + ((d.data().totalMonthlyRate || 0) * 12), 0);

                setStats({
                    totalLeads: leads.length,
                    qualifiedLeads: qualified.length,
                    wonDeals: won.length,
                    totalAcv,
                });

                // Fetch commissions for current user
                const commSnap = await getDocs(query(
                    collection(db, 'commissions'),
                    where('staffId', '==', profile!.uid),
                ));

                let totalEarned = 0;
                let totalPending = 0;
                let nextPayout: { amount: number; date: Date } | null = null;
                const rows: CommissionRecord[] = [];

                for (const d of commSnap.docs) {
                    const data = d.data();
                    rows.push({ id: d.id, ...data } as CommissionRecord);
                    for (const entry of data.payoutSchedule || []) {
                        if (entry.status === 'PAID') {
                            totalEarned += entry.amount;
                        } else if (entry.status === 'PENDING') {
                            totalPending += entry.amount;
                            const schedDate = entry.scheduledAt
                                ? (entry.scheduledAt.toDate?.() || new Date(entry.scheduledAt))
                                : estimatePayoutDate(data.createdAt, entry.month);
                            if (schedDate && (!nextPayout || schedDate < nextPayout.date)) {
                                nextPayout = { amount: entry.amount, date: schedDate };
                            }
                        }
                    }
                }

                rows.sort((a, b) => {
                    const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return bDate.getTime() - aDate.getTime();
                });
                setCommRecords(rows);

                // Fetch lead names for timeline
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

                // Fetch recent ledger entries
                const ledgerSnap = await getDocs(query(
                    collection(db, 'commission_ledger'),
                    where('staffId', '==', profile!.uid),
                    where('type', '==', 'PAYOUT_PAID'),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                ));
                const recentPayouts = ledgerSnap.docs.map(d => ({
                    amount: d.data().amount,
                    date: d.data().createdAt?.toDate?.() || new Date(d.data().createdAt),
                    description: d.data().description,
                }));

                setCommissions({ totalEarned, totalPending, nextPayout, recentPayouts });
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [profile?.uid]);

    // ─── Build Upcoming Payouts Timeline ─────────────────────────────────
    const upcomingPayouts: {
        commission: CommissionRecord;
        payout: PayoutEntry;
        payoutIndex: number;
        clientName: string;
    }[] = [];

    commRecords.forEach(c => {
        c.payoutSchedule.forEach((p, i) => {
            if (p.status === 'PENDING') {
                upcomingPayouts.push({
                    commission: c,
                    payout: p,
                    payoutIndex: i,
                    clientName: leadNames[c.leadId] || 'Client',
                });
            }
        });
    });

    upcomingPayouts.sort((a, b) => {
        const aDate = a.payout.scheduledAt
            ? (a.payout.scheduledAt.toDate?.() || new Date(a.payout.scheduledAt)).getTime()
            : (estimatePayoutDate(a.commission.createdAt, a.payoutIndex)?.getTime() || Infinity);
        const bDate = b.payout.scheduledAt
            ? (b.payout.scheduledAt.toDate?.() || new Date(b.payout.scheduledAt)).getTime()
            : (estimatePayoutDate(b.commission.createdAt, b.payoutIndex)?.getTime() || Infinity);
        return aDate - bDate;
    });

    const payoutsByMonth: Record<string, typeof upcomingPayouts> = {};
    upcomingPayouts.forEach(item => {
        const actualDate = item.payout.scheduledAt;
        const estDate = estimatePayoutDate(item.commission.createdAt, item.payoutIndex);
        const dateToUse = actualDate || estDate;
        const key = dateToUse ? monthLabel(dateToUse) : 'TBD';
        if (!payoutsByMonth[key]) payoutsByMonth[key] = [];
        payoutsByMonth[key].push(item);
    });

    const conversionRate = stats.totalLeads > 0
        ? Math.round((stats.wonDeals / stats.totalLeads) * 100)
        : 0;

    return (
        <ProtectedRoute resource="sales/dashboard">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Sales Dashboard</h1>
                    <p className="text-muted-foreground">Pipeline performance and commission tracking</p>
                </div>

                {/* Pipeline KPIs */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : stats.totalLeads}</div>
                            <p className="text-xs text-muted-foreground">All time</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : stats.qualifiedLeads}</div>
                            <p className="text-xs text-muted-foreground">In active pipeline</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : `${conversionRate}%`}</div>
                            <p className="text-xs text-muted-foreground">{stats.wonDeals} deals won</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total ACV</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.totalAcv)}</div>
                            <p className="text-xs text-muted-foreground">Accepted quotes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Commission KPIs */}
                <h2 className="text-xl font-semibold mt-2">My Commissions</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-green-200 dark:border-green-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Earned (Paid)</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {loading ? '...' : formatCurrency(commissions.totalEarned)}
                            </div>
                            <p className="text-xs text-muted-foreground">Commission payouts received</p>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 dark:border-amber-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {loading ? '...' : formatCurrency(commissions.totalPending)}
                            </div>
                            <p className="text-xs text-muted-foreground">Scheduled payouts remaining</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {commissions.nextPayout ? (
                                <>
                                    <div className="text-2xl font-bold">{formatCurrency(commissions.nextPayout.amount)}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {commissions.nextPayout.date.toLocaleDateString()}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                                    <p className="text-xs text-muted-foreground">No payouts scheduled</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent payouts */}
                {commissions.recentPayouts.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Recent Payouts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {commissions.recentPayouts.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-medium">{p.description}</p>
                                        <p className="text-xs text-muted-foreground">{p.date.toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant="outline" className="text-green-600 border-green-300">
                                        +{formatCurrency(p.amount)}
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* ─── Payout Timeline ─────────────────────────────────────── */}
                {Object.keys(payoutsByMonth).length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-500" />
                                <CardTitle>Payout Timeline</CardTitle>
                            </div>
                            <p className="text-sm text-muted-foreground">When you'll get paid — month by month</p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {Object.entries(payoutsByMonth).map(([month, items], monthIdx) => {
                                    const monthTotal = items.reduce((sum, i) => sum + i.payout.amount, 0);
                                    return (
                                        <div key={month} className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-lg">{month}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {items.length} payout{items.length !== 1 ? 's' : ''} {items.some(i => !i.payout.scheduledAt) ? '(estimated)' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(monthTotal)}
                                                </p>
                                            </div>
                                            <div className="ml-5 border-l-2 border-blue-200 dark:border-blue-800 pl-6 space-y-3">
                                                {items.map((item) => (
                                                    <div
                                                        key={`${item.commission.id}-${item.payoutIndex}`}
                                                        className="relative bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow"
                                                    >
                                                        <div className="absolute -left-[31px] top-5 w-3 h-3 rounded-full bg-blue-400 dark:bg-blue-500 border-2 border-background" />
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium">{item.clientName}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Payout {item.payoutIndex + 1} of {item.commission.payoutSchedule.length}
                                                                    </Badge>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {item.payout.percentage}% of {formatCurrency(item.commission.totalCommission)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {item.payout.scheduledAt
                                                                        ? `Scheduled: ${formatDate(item.payout.scheduledAt)}`
                                                                        : `Est. ${formatDate(estimatePayoutDate(item.commission.createdAt, item.payoutIndex))}`
                                                                    }
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xl font-bold font-mono">
                                                                    {formatCurrency(item.payout.amount)}
                                                                </p>
                                                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100 text-xs mt-1">
                                                                    <Clock className="w-3 h-3 mr-1" />
                                                                    Pending
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {monthIdx < Object.keys(payoutsByMonth).length - 1 && (
                                                <div className="flex items-center justify-center my-4">
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ─── Deal Breakdown ──────────────────────────────────────── */}
                {commRecords.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-green-500" />
                                <CardTitle>Your Deals</CardTitle>
                            </div>
                            <p className="text-sm text-muted-foreground">Commission breakdown per deal</p>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {commRecords.map(c => {
                                    const paidCount = c.payoutSchedule.filter(p => p.status === 'PAID').length;
                                    const totalPayouts = c.payoutSchedule.length;
                                    const paidAmount = c.payoutSchedule.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
                                    const progress = totalPayouts > 0 ? (paidCount / totalPayouts) * 100 : 0;

                                    return (
                                        <div key={c.id} className="p-4 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="font-semibold text-base">{leadNames[c.leadId] || 'Client'}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {c.type === 'SALES_NEW' ? 'New Sale' : c.type === 'FSM_UPSELL' ? 'Upsell' : c.type}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {(c.rate * 100).toFixed(0)}% of {formatCurrency(c.acv)} ACV
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold font-mono">{formatCurrency(c.totalCommission)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatCurrency(paidAmount)} earned
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{paidCount} of {totalPayouts} payouts received</span>
                                                    <span>{Math.round(progress)}%</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-2">
                                                    {c.payoutSchedule.map((p, i) => (
                                                        <div key={i} className="flex flex-col items-center text-center flex-1">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${p.status === 'PAID'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                                : p.status === 'CANCELLED'
                                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 line-through'
                                                                    : 'bg-muted text-muted-foreground'
                                                                }`}>
                                                                {p.status === 'PAID' ? '✓' : p.status === 'CANCELLED' ? '✕' : i + 1}
                                                            </div>
                                                            <p className="text-xs font-mono font-medium">{formatCurrency(p.amount)}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {p.status === 'PAID'
                                                                    ? formatDate(p.paidAt)
                                                                    : p.scheduledAt
                                                                        ? formatDate(p.scheduledAt)
                                                                        : `~${formatDate(estimatePayoutDate(c.createdAt, i))}`}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
