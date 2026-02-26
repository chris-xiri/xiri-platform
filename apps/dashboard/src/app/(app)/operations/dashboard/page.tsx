'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ClipboardList, Users, TrendingUp, DollarSign, Clock, CheckCircle,
    Calendar, AlertTriangle, MapPin, ArrowRight
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder } from '@xiri/shared';
import Link from 'next/link';

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
    payoutSchedule: { month: number; amount: number; percentage: number; status: string; scheduledAt: any; paidAt?: any }[];
    createdAt: any;
}

export default function OperationsDashboardPage() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [woStats, setWoStats] = useState({ total: 0, active: 0, needsVendor: 0, paused: 0, startingSoon: 0 });
    const [contractStats, setContractStats] = useState({ active: 0, mrr: 0, avgMargin: 0 });
    const [commRecords, setCommRecords] = useState<CommissionRecord[]>([]);
    const [leadNames, setLeadNames] = useState<Record<string, string>>({});
    const [upcomingStarts, setUpcomingStarts] = useState<(WorkOrder & { id: string })[]>([]);
    const [commTotals, setCommTotals] = useState({ earned: 0, pending: 0 });

    useEffect(() => {
        if (!profile?.uid) return;
        async function fetchData() {
            try {
                // Work Orders
                const woSnap = await getDocs(collection(db, 'work_orders'));
                const wos = woSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));
                const active = wos.filter(wo => wo.status === 'active');
                const needsVendor = wos.filter(wo => wo.status === 'pending_assignment');
                const paused = wos.filter(wo => wo.status === 'paused');

                // Starting soon (within 14 days)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const twoWeeks = new Date(today);
                twoWeeks.setDate(twoWeeks.getDate() + 14);
                const startingSoon = wos.filter(wo => {
                    const start = (wo as any).serviceStartDate;
                    if (!start) return false;
                    const startDate = typeof start === 'string' ? new Date(start) : (start.toDate?.() || new Date(start));
                    return startDate >= today && startDate <= twoWeeks;
                });

                setWoStats({
                    total: wos.length,
                    active: active.length,
                    needsVendor: needsVendor.length,
                    paused: paused.length,
                    startingSoon: startingSoon.length,
                });
                setUpcomingStarts(startingSoon.slice(0, 5));

                // Contracts
                const contractSnap = await getDocs(query(collection(db, 'contracts'), where('status', '==', 'active')));
                const contracts = contractSnap.docs.map(d => d.data());
                const totalMrr = contracts.reduce((s, c) => s + (c.totalMonthlyRate || 0), 0);

                setContractStats({
                    active: contracts.length,
                    mrr: totalMrr,
                    avgMargin: 0,
                });

                // Commissions for current user (FSM upsell commissions)
                const commSnap = await getDocs(query(
                    collection(db, 'commissions'),
                    where('staffId', '==', profile!.uid),
                ));

                let earned = 0;
                let pending = 0;
                const rows: CommissionRecord[] = [];

                for (const d of commSnap.docs) {
                    const data = d.data();
                    rows.push({ id: d.id, ...data } as CommissionRecord);
                    for (const entry of data.payoutSchedule || []) {
                        if (entry.status === 'PAID') earned += entry.amount;
                        else if (entry.status === 'PENDING') pending += entry.amount;
                    }
                }

                rows.sort((a, b) => {
                    const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return bDate.getTime() - aDate.getTime();
                });
                setCommRecords(rows);
                setCommTotals({ earned, pending });

                // Lead names
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
                console.error('Error fetching ops dashboard:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [profile?.uid]);

    return (
        <ProtectedRoute resource="operations/work-orders">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Operations Dashboard</h1>
                    <p className="text-muted-foreground">Work orders, contracts, and commission tracking</p>
                </div>

                {/* Operations KPIs */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total WOs</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : woStats.total}</div>
                            <p className="text-xs text-muted-foreground">All work orders</p>
                        </CardContent>
                    </Card>

                    <Card className="border-green-200 dark:border-green-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{loading ? '...' : woStats.active}</div>
                            <p className="text-xs text-muted-foreground">Vendor assigned & running</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 dark:border-red-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Needs Vendor</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{loading ? '...' : woStats.needsVendor}</div>
                            <p className="text-xs text-muted-foreground">Pending assignment</p>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 dark:border-amber-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Starting Soon</CardTitle>
                            <Calendar className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{loading ? '...' : woStats.startingSoon}</div>
                            <p className="text-xs text-muted-foreground">Within 14 days</p>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Portfolio MRR</CardTitle>
                            <DollarSign className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{loading ? '...' : formatCurrency(contractStats.mrr)}</div>
                            <p className="text-xs text-muted-foreground">{contractStats.active} active contracts</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Upcoming Starts */}
                {upcomingStarts.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-amber-500" />
                                <CardTitle>Starting Soon — Vendor Sourcing Deadlines</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {upcomingStarts.map(wo => {
                                    const start = (wo as any).serviceStartDate;
                                    const startDate = typeof start === 'string' ? new Date(start) : (start?.toDate?.() || new Date(start));
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    startDate.setHours(0, 0, 0, 0);
                                    const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                                    return (
                                        <Link key={wo.id} href={`/operations/work-orders/${wo.id}`} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                                            <div>
                                                <p className="font-medium">{wo.serviceType}</p>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5" /> {wo.locationName}
                                                </p>
                                            </div>
                                            <div className="text-right flex items-center gap-3">
                                                {!wo.vendorId && (
                                                    <Badge variant="destructive" className="text-xs">No Vendor</Badge>
                                                )}
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                    {daysUntil}d to start
                                                </Badge>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* My Commissions */}
                <h2 className="text-xl font-semibold mt-2">My Commissions</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-green-200 dark:border-green-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Earned (Paid)</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {loading ? '...' : formatCurrency(commTotals.earned)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 dark:border-amber-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {loading ? '...' : formatCurrency(commTotals.pending)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Commission Deals Table */}
                {commRecords.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-green-500" />
                                <CardTitle>My Deals & Payouts</CardTitle>
                            </div>
                            <p className="text-sm text-muted-foreground">Upsell and retention commissions</p>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left p-3 font-medium">Client</th>
                                            <th className="text-left p-3 font-medium">Type</th>
                                            <th className="text-right p-3 font-medium">MRR</th>
                                            <th className="text-right p-3 font-medium">ACV</th>
                                            <th className="text-right p-3 font-medium">Rate</th>
                                            <th className="text-right p-3 font-medium">Commission</th>
                                            <th className="text-center p-3 font-medium">Status</th>
                                            <th className="text-center p-3 font-medium">Payouts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {commRecords.map(c => {
                                            const paidCount = c.payoutSchedule.filter(p => p.status === 'PAID').length;
                                            const totalPayouts = c.payoutSchedule.length;
                                            const typeLabel = c.type === 'SALES_NEW' ? 'New Sale' : c.type === 'FSM_UPSELL' ? 'Upsell' : c.type === 'FSM_RETENTION' ? 'NRR Bonus' : c.type;

                                            return (
                                                <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                                                    <td className="p-3 font-medium">{leadNames[c.leadId] || c.leadId || '—'}</td>
                                                    <td className="p-3">
                                                        <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                                                    </td>
                                                    <td className="p-3 text-right font-mono">{formatCurrency(c.mrr)}</td>
                                                    <td className="p-3 text-right font-mono">{formatCurrency(c.acv)}</td>
                                                    <td className="p-3 text-right">{(c.rate * 100).toFixed(0)}%</td>
                                                    <td className="p-3 text-right font-mono font-semibold">{formatCurrency(c.totalCommission)}</td>
                                                    <td className="p-3 text-center">
                                                        <Badge variant={c.status === 'COMPLETED' ? 'default' : c.status === 'ACTIVE' ? 'secondary' : 'outline'} className="text-xs">
                                                            {c.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {c.payoutSchedule.map((p, i) => (
                                                                <div
                                                                    key={i}
                                                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${p.status === 'PAID'
                                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                                            : p.status === 'CANCELLED'
                                                                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                                                                : 'bg-muted text-muted-foreground'
                                                                        }`}
                                                                    title={`Payout ${i + 1}: ${formatCurrency(p.amount)} — ${p.status}`}
                                                                >
                                                                    {p.status === 'PAID' ? '✓' : p.status === 'CANCELLED' ? '✕' : i + 1}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">{paidCount}/{totalPayouts} paid</p>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {commRecords.length === 0 && !loading && (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No commissions yet. Upsell commissions will appear here when quotes are accepted.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
