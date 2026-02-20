'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Target, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

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
                    where('staffRole', '==', 'sales'),
                ));

                let totalEarned = 0;
                let totalPending = 0;
                let nextPayout: { amount: number; date: Date } | null = null;
                const now = new Date();

                for (const doc of commSnap.docs) {
                    const data = doc.data();
                    for (const entry of data.payoutSchedule || []) {
                        if (entry.status === 'PAID') {
                            totalEarned += entry.amount;
                        } else if (entry.status === 'PENDING') {
                            totalPending += entry.amount;
                            const schedDate = entry.scheduledAt?.toDate?.() || new Date(entry.scheduledAt);
                            if (schedDate && (!nextPayout || schedDate < nextPayout.date)) {
                                nextPayout = { amount: entry.amount, date: schedDate };
                            }
                        }
                    }
                }

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
            </div>
        </ProtectedRoute>
    );
}
