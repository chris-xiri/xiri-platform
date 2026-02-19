'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contract } from '@xiri/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, DollarSign } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    active: { variant: 'outline', label: 'Active' },
    amended: { variant: 'default', label: 'Amended' },
    terminated: { variant: 'destructive', label: 'Terminated' },
    expired: { variant: 'secondary', label: 'Expired' },
};

export default function ContractsPage() {
    const [contracts, setContracts] = useState<(Contract & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract & { id: string }));
            setContracts(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    if (loading) return <div className="p-8 flex justify-center">Loading contracts...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Contracts</h1>
                <p className="text-sm text-muted-foreground">Active client agreements and their terms</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold">{contracts.filter(c => c.status === 'active').length}</p>
                                <p className="text-xs text-muted-foreground">Active Contracts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(contracts.filter(c => c.status === 'active').reduce((s, c) => s + c.totalMonthlyRate, 0))}
                                </p>
                                <p className="text-xs text-muted-foreground">Monthly Contract Value</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">{contracts.length}</p>
                                <p className="text-xs text-muted-foreground">Total Contracts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Contracts Table */}
            {contracts.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-1">No contracts yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Contracts are created when a Sales quote is accepted by the client.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium">Client</th>
                                    <th className="px-4 py-3 font-medium">Monthly Rate</th>
                                    <th className="px-4 py-3 font-medium">Tenure</th>
                                    <th className="px-4 py-3 font-medium">Payment Terms</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contracts.map((contract) => {
                                    const badge = STATUS_BADGE[contract.status] || STATUS_BADGE.draft;
                                    const created = contract.createdAt?.toDate?.()
                                        ? contract.createdAt.toDate().toLocaleDateString()
                                        : '—';
                                    return (
                                        <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-medium">{contract.clientBusinessName}</td>
                                            <td className="px-4 py-3 font-medium">{formatCurrency(contract.totalMonthlyRate)}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{contract.contractTenure} months</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{contract.paymentTerms}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={badge.variant}>{badge.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{created}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
