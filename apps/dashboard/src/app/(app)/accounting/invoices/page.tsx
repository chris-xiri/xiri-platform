'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Receipt, DollarSign, AlertTriangle, CheckCircle2,
    Clock, Plus, ChevronRight
} from 'lucide-react';
import InvoiceGenerator from '@/components/InvoiceGenerator';

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    paid: { variant: 'outline', label: 'Paid' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    void: { variant: 'secondary', label: 'Void' },
};

export default function InvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<(Invoice & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGenerator, setShowGenerator] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice & { id: string }));
            setInvoices(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    // Stats
    const totalOutstanding = invoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPaid = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + i.totalAmount, 0);
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    const totalMargin = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.grossMargin || 0), 0);

    if (loading) return <div className="p-8 flex justify-center">Loading invoices...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Invoices</h1>
                    <p className="text-sm text-muted-foreground">Consolidated client billing & vendor payouts</p>
                </div>
                <Button className="gap-2" onClick={() => setShowGenerator(true)}>
                    <Plus className="w-4 h-4" /> Generate Invoice
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <p className="text-xs text-muted-foreground uppercase">Outstanding</p>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <p className="text-xs text-muted-foreground uppercase">Collected</p>
                        </div>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <p className="text-xs text-muted-foreground uppercase">Overdue</p>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <p className="text-xs text-muted-foreground uppercase">Gross Margin</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalMargin)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Invoice Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">{invoices.length} Invoices</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {invoices.length === 0 ? (
                        <div className="py-16 text-center">
                            <Receipt className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium mb-1">No invoices yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Generate your first invoice from active work orders.
                            </p>
                            <Button onClick={() => setShowGenerator(true)} className="gap-2">
                                <Plus className="w-4 h-4" /> Generate Invoice
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Client</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Margin</th>
                                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-2.5 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => {
                                        const config = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                                        return (
                                            <tr
                                                key={inv.id}
                                                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                                                onClick={() => router.push(`/accounting/invoices/${inv.id}`)}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">{inv.clientBusinessName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {inv.lineItems?.length || 0} line items
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {inv.billingPeriod?.start || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatCurrency(inv.totalAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`font-medium ${(inv.grossMargin || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCurrency(inv.grossMargin || 0)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant={config.variant}>{config.label}</Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generator Modal */}
            {showGenerator && (
                <InvoiceGenerator
                    onClose={() => setShowGenerator(false)}
                    onCreated={(id) => {
                        setShowGenerator(false);
                        router.push(`/accounting/invoices/${id}`);
                    }}
                />
            )}
        </div>
    );
}
