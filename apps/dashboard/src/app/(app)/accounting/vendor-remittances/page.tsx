'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VendorRemittance } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, FileText, Send, CheckCircle2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    sent: { variant: 'default', label: 'Sent' },
    paid: { variant: 'outline', label: 'Paid' },
    void: { variant: 'secondary', label: 'Void' },
};

export default function VendorRemittancesPage() {
    const router = useRouter();
    const [remittances, setRemittances] = useState<(VendorRemittance & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        const q = query(collection(db, 'vendor_remittances'), orderBy('createdAt', 'desc'), limit(100));
        const unsub = onSnapshot(q, (snap) => {
            setRemittances(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRemittance & { id: string })));
            setLoading(false);
        });
        return unsub;
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const filtered = filter === 'all'
        ? remittances
        : remittances.filter(r => r.status === filter);

    // Summary cards
    const totalPending = remittances.filter(r => r.status === 'pending' || r.status === 'sent').reduce((s, r) => s + r.totalAmount, 0);
    const totalPaid = remittances.filter(r => r.status === 'paid').reduce((s, r) => s + r.totalAmount, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Vendor Remittances</h1>
                <p className="text-sm text-muted-foreground">Auto-generated statements for your vendors</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Send className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Paid Out</p>
                            <p className="text-xl font-bold">{formatCurrency(totalPaid)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Remittances</p>
                            <p className="text-xl font-bold">{remittances.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['all', 'pending', 'sent', 'paid', 'void'].map(f => (
                    <Button
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className="capitalize"
                    >
                        {f} ({f === 'all' ? remittances.length : remittances.filter(r => r.status === f).length})
                    </Button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No vendor remittances found. They are auto-created when you generate a client invoice.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map(rem => {
                        const config = STATUS_CONFIG[rem.status] || STATUS_CONFIG.pending;
                        return (
                            <Card
                                key={rem.id}
                                className="cursor-pointer hover:border-primary/50 transition-all"
                                onClick={() => router.push(`/accounting/vendor-remittances/${rem.id}`)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-muted">
                                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{rem.vendorName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {rem.lineItems?.length || 0} services • {rem.billingPeriod?.start || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold">{formatCurrency(rem.totalAmount)}</span>
                                        <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
