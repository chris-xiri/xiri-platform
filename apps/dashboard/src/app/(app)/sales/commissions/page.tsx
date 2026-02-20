'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DollarSign, CheckCircle, Clock, TrendingUp,
    ArrowRight, Calendar, Trophy, Zap
} from 'lucide-react';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
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

/**
 * Estimate payout dates when actual scheduledAt is not yet set.
 * Logic: quote accepted → ~60 days for first invoice payment → then 30-day intervals.
 * This gives sales reps visibility into expected payouts immediately after closing.
 */
function estimatePayoutDate(createdAt: any, payoutIndex: number): Date | null {
    if (!createdAt) return null;
    const base = createdAt.toDate?.() || new Date(createdAt);
    const estimated = new Date(base);
    // ~60 days to first invoice paid, then +30 days per subsequent payout
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

interface Commission {
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

export default function MyCommissionsPage() {
    const { profile, user } = useAuth();
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [leadNames, setLeadNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMyCommissions() {
            if (!user?.uid) return;

            try {
                // Fetch commissions for the logged-in user
                const q = query(
                    collection(db, 'commissions'),
                    where('staffId', '==', user.uid),
                );
                const snap = await getDocs(q);
                const rows: Commission[] = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                } as Commission));

                rows.sort((a, b) => {
                    const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return bDate.getTime() - aDate.getTime();
                });

                setCommissions(rows);

                // Fetch lead/client names
                const leadIds = [...new Set(rows.map(r => r.leadId).filter(Boolean))];
                const names: Record<string, string> = {};
                for (const lid of leadIds) {
                    try {
                        const leadDoc = await getDoc(doc(db, 'leads', lid));
                        if (leadDoc.exists()) {
                            const data = leadDoc.data();
                            names[lid] = data.businessName || data.companyName || data.name || lid;
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

        fetchMyCommissions();
    }, [user?.uid]);

    // ─── Aggregate Stats ─────────────────────────────────────────────────
    const totalEarned = commissions.reduce((sum, c) =>
        sum + c.payoutSchedule.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0), 0);
    const totalPending = commissions.reduce((sum, c) =>
        sum + c.payoutSchedule.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0), 0);
    const totalLifetime = totalEarned + totalPending;

    // ─── Build Upcoming Payouts Timeline ─────────────────────────────────
    const upcomingPayouts: {
        commission: Commission;
        payout: PayoutEntry;
        payoutIndex: number;
        clientName: string;
    }[] = [];

    commissions.forEach(c => {
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

    // Sort by actual or estimated date
    upcomingPayouts.sort((a, b) => {
        const aDate = a.payout.scheduledAt
            ? (a.payout.scheduledAt.toDate?.() || new Date(a.payout.scheduledAt)).getTime()
            : (estimatePayoutDate(a.commission.createdAt, a.payoutIndex)?.getTime() || Infinity);
        const bDate = b.payout.scheduledAt
            ? (b.payout.scheduledAt.toDate?.() || new Date(b.payout.scheduledAt)).getTime()
            : (estimatePayoutDate(b.commission.createdAt, b.payoutIndex)?.getTime() || Infinity);
        return aDate - bDate;
    });

    // Group by month (use estimated dates when actual ones aren't available)
    const payoutsByMonth: Record<string, typeof upcomingPayouts> = {};
    upcomingPayouts.forEach(item => {
        const actualDate = item.payout.scheduledAt;
        const estDate = estimatePayoutDate(item.commission.createdAt, item.payoutIndex);
        const dateToUse = actualDate || estDate;
        const key = dateToUse ? monthLabel(dateToUse) : 'TBD';
        if (!payoutsByMonth[key]) payoutsByMonth[key] = [];
        payoutsByMonth[key].push(item);
    });

    // ─── Recently Paid ───────────────────────────────────────────────────
    const recentPaid: typeof upcomingPayouts = [];
    commissions.forEach(c => {
        c.payoutSchedule.forEach((p, i) => {
            if (p.status === 'PAID') {
                recentPaid.push({
                    commission: c,
                    payout: p,
                    payoutIndex: i,
                    clientName: leadNames[c.leadId] || 'Client',
                });
            }
        });
    });
    recentPaid.sort((a, b) => {
        const aDate = a.payout.paidAt
            ? (a.payout.paidAt.toDate?.() || new Date(a.payout.paidAt)).getTime()
            : 0;
        const bDate = b.payout.paidAt
            ? (b.payout.paidAt.toDate?.() || new Date(b.payout.paidAt)).getTime()
            : 0;
        return bDate - aDate;
    });

    return (
        <ProtectedRoute resource="sales/commissions">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold">My Commissions</h1>
                    <p className="text-muted-foreground">Your payout schedule and earnings timeline</p>
                </div>

                {/* Hero Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Total Earned</CardTitle>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                                {loading ? '—' : formatCurrency(totalEarned)}
                            </div>
                            <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-1">Paid to you</p>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Coming Your Way</CardTitle>
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                                {loading ? '—' : formatCurrency(totalPending)}
                            </div>
                            <p className="text-xs text-blue-600/70 dark:text-blue-500/70 mt-1">Scheduled payouts</p>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Lifetime Value</CardTitle>
                            <Trophy className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                                {loading ? '—' : formatCurrency(totalLifetime)}
                            </div>
                            <p className="text-xs text-purple-600/70 dark:text-purple-500/70 mt-1">
                                {commissions.length} deal{commissions.length !== 1 ? 's' : ''} closed
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Payout Timeline */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-500" />
                            <CardTitle>Payout Timeline</CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground">When you'll get paid — month by month</p>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-muted-foreground text-center py-8">Loading your payouts...</p>
                        ) : Object.keys(payoutsByMonth).length === 0 ? (
                            <div className="text-center py-12">
                                <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">No pending payouts yet</p>
                                <p className="text-sm text-muted-foreground/70 mt-1">Close a deal and your payout schedule will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(payoutsByMonth).map(([month, items], monthIdx) => {
                                    const monthTotal = items.reduce((sum, i) => sum + i.payout.amount, 0);

                                    return (
                                        <div key={month} className="relative">
                                            {/* Month Header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-lg">{month}</p>
                                                        <p className="text-xs text-muted-foreground">{items.length} payout{items.length !== 1 ? 's' : ''} {items.some(i => !i.payout.scheduledAt) ? '(estimated)' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                        {formatCurrency(monthTotal)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Payout Items */}
                                            <div className="ml-5 border-l-2 border-blue-200 dark:border-blue-800 pl-6 space-y-3">
                                                {items.map((item, i) => (
                                                    <div
                                                        key={`${item.commission.id}-${item.payoutIndex}`}
                                                        className="relative bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow"
                                                    >
                                                        {/* Connector dot */}
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

                                            {/* Month separator */}
                                            {monthIdx < Object.keys(payoutsByMonth).length - 1 && (
                                                <div className="flex items-center justify-center my-4">
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Active Deals Breakdown */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-500" />
                            <CardTitle>Your Deals</CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground">Commission breakdown per deal</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <p className="text-muted-foreground text-center py-8">Loading...</p>
                        ) : commissions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No deals yet — your first commission awaits!</p>
                        ) : (
                            <div className="divide-y">
                                {commissions.map(c => {
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

                                            {/* Payout Progress Bar */}
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

                                                {/* Payout Steps */}
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
                        )}
                    </CardContent>
                </Card>

                {/* Recently Paid */}
                {recentPaid.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <CardTitle>Recently Paid</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {recentPaid.slice(0, 5).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4">
                                        <div>
                                            <p className="font-medium">{item.clientName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Payout {item.payoutIndex + 1} • Paid {formatDate(item.payout.paidAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold font-mono text-green-600 dark:text-green-400">
                                                +{formatCurrency(item.payout.amount)}
                                            </span>
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
