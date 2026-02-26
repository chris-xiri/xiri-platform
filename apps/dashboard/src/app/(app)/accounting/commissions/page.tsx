'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DollarSign, Search, Filter, CheckCircle, Clock,
    XCircle, TrendingUp, AlertTriangle, ChevronDown
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    PARTIALLY_CANCELLED: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const PAYOUT_ICONS: Record<string, React.ReactNode> = {
    PAID: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
    PENDING: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    CANCELLED: <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />,
};

interface CommissionRow {
    id: string;
    staffId: string;
    staffRole: string;
    quoteId: string;
    leadId: string;
    type: string;
    mrr: number;
    acv: number;
    rate: number;
    totalCommission: number;
    status: string;
    payoutSchedule: {
        month: number;
        amount: number;
        percentage: number;
        status: string;
        scheduledAt: any;
        paidAt: any;
    }[];
    createdAt: any;
}

export default function AccountingCommissionsPage() {
    const { profile } = useAuth();
    const [commissions, setCommissions] = useState<CommissionRow[]>([]);
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [staffNames, setStaffNames] = useState<Record<string, string>>({});
    const [leadNames, setLeadNames] = useState<Record<string, string>>({});

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch all commissions
                const commSnap = await getDocs(collection(db, 'commissions'));
                const rows: CommissionRow[] = commSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                } as CommissionRow));
                rows.sort((a, b) => {
                    const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return bDate.getTime() - aDate.getTime();
                });
                setCommissions(rows);

                // Fetch staff names
                const usersSnap = await getDocs(collection(db, 'users'));
                const names: Record<string, string> = {};
                usersSnap.forEach(d => {
                    const data = d.data();
                    names[d.id] = data.displayName || data.email || d.id;
                });
                setStaffNames(names);

                // Fetch lead names
                const leadIds = [...new Set(rows.map(r => r.leadId).filter(Boolean))];
                const leadsMap: Record<string, string> = {};
                for (const lid of leadIds) {
                    try {
                        const leadSnap = await getDocs(query(collection(db, 'leads'), where('__name__', '==', lid)));
                        if (!leadSnap.empty) {
                            leadsMap[lid] = leadSnap.docs[0].data().businessName || lid;
                        }
                    } catch { /* ignore */ }
                }
                setLeadNames(leadsMap);

                // Fetch recent ledger entries
                const ledgerSnap = await getDocs(query(
                    collection(db, 'commission_ledger'),
                    orderBy('createdAt', 'desc'),
                ));
                setLedger(ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('Error fetching commissions:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Summary stats
    const totalEarned = commissions.reduce((sum, c) =>
        sum + c.payoutSchedule.filter((p: any) => p.status === 'PAID').reduce((s: number, p: any) => s + p.amount, 0), 0);
    const totalPending = commissions.reduce((sum, c) =>
        sum + c.payoutSchedule.filter((p: any) => p.status === 'PENDING').reduce((s: number, p: any) => s + p.amount, 0), 0);
    const totalCancelled = commissions.reduce((sum, c) =>
        sum + c.payoutSchedule.filter((p: any) => p.status === 'CANCELLED').reduce((s: number, p: any) => s + p.amount, 0), 0);

    // Filter
    const filtered = commissions.filter(c => {
        if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
        if (filterType !== 'ALL' && c.type !== filterType) return false;
        if (searchTerm) {
            const staffName = staffNames[c.staffId] || '';
            const leadName = leadNames[c.leadId] || '';
            const q = searchTerm.toLowerCase();
            if (!staffName.toLowerCase().includes(q) && !leadName.toLowerCase().includes(q) && !c.quoteId.includes(q)) return false;
        }
        return true;
    });

    const typeLabel = (t: string) => {
        switch (t) {
            case 'SALES_NEW': return 'New Sale';
            case 'FSM_UPSELL': return 'FSM Upsell';
            case 'FSM_RETENTION': return 'NRR Bonus';
            default: return t;
        }
    };

    return (
        <ProtectedRoute resource="accounting/commissions">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Commissions</h1>
                    <p className="text-muted-foreground">Track all commission payouts across the team</p>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-green-200 dark:border-green-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {loading ? '...' : formatCurrency(totalEarned)}
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
                                {loading ? '...' : formatCurrency(totalPending)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 dark:border-red-900">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cancelled (Clawback)</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {loading ? '...' : formatCurrency(totalCancelled)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by rep, client, quote..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PARTIALLY_CANCELLED">Partially Cancelled</option>
                    </select>
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="ALL">All Types</option>
                        <option value="SALES_NEW">New Sale</option>
                        <option value="FSM_UPSELL">FSM Upsell</option>
                        <option value="FSM_RETENTION">NRR Bonus</option>
                    </select>
                </div>

                {/* Commissions Table */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="text-left p-3 font-medium">Rep</th>
                                        <th className="text-left p-3 font-medium">Client</th>
                                        <th className="text-left p-3 font-medium">Type</th>
                                        <th className="text-right p-3 font-medium">MRR</th>
                                        <th className="text-right p-3 font-medium">ACV</th>
                                        <th className="text-right p-3 font-medium">Rate</th>
                                        <th className="text-right p-3 font-medium">Commission</th>
                                        <th className="text-center p-3 font-medium">Status</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">No commissions found</td></tr>
                                    ) : filtered.map(c => (
                                        <>
                                            <tr
                                                key={c.id}
                                                className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                                                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                                            >
                                                <td className="p-3 font-medium">{staffNames[c.staffId] || c.staffId}</td>
                                                <td className="p-3">{leadNames[c.leadId] || c.leadId || '—'}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className="text-xs">{typeLabel(c.type)}</Badge>
                                                </td>
                                                <td className="p-3 text-right font-mono">{formatCurrency(c.mrr)}</td>
                                                <td className="p-3 text-right font-mono">{formatCurrency(c.acv)}</td>
                                                <td className="p-3 text-right">{(c.rate * 100).toFixed(0)}%</td>
                                                <td className="p-3 text-right font-mono font-semibold">{formatCurrency(c.totalCommission)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>
                                                        {c.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`} />
                                                </td>
                                            </tr>
                                            {expandedId === c.id && (
                                                <tr key={`${c.id}-detail`}>
                                                    <td colSpan={9} className="bg-muted/10 p-4">
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">PAYOUT SCHEDULE</p>
                                                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                                                                <span>Payout</span>
                                                                <span className="text-right">Amount</span>
                                                                <span className="text-center">Scheduled</span>
                                                                <span className="text-center">Status</span>
                                                            </div>
                                                            {c.payoutSchedule.map((p, i) => (
                                                                <div key={i} className="grid grid-cols-4 gap-2 text-sm items-center py-1">
                                                                    <span>Payout {i + 1} ({p.percentage}%)</span>
                                                                    <span className="text-right font-mono">{formatCurrency(p.amount)}</span>
                                                                    <span className="text-center text-xs text-muted-foreground">
                                                                        {p.scheduledAt
                                                                            ? (p.scheduledAt.toDate?.() || new Date(p.scheduledAt)).toLocaleDateString()
                                                                            : 'Awaiting invoice'}
                                                                    </span>
                                                                    <span className="flex items-center justify-center gap-1">
                                                                        {PAYOUT_ICONS[p.status]}
                                                                        <span className={`text-xs ${STATUS_COLORS[p.status] || ''} px-1.5 py-0.5 rounded`}>
                                                                            {p.status}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
