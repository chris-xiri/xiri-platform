'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quote } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, DollarSign, Calendar, Building2 } from 'lucide-react';
import QuoteBuilder from '@/components/QuoteBuilder';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    accepted: { variant: 'outline', label: 'Accepted' },
    rejected: { variant: 'destructive', label: 'Rejected' },
    expired: { variant: 'secondary', label: 'Expired' },
};

export default function QuotesPage() {
    const [quotes, setQuotes] = useState<(Quote & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBuilder, setShowBuilder] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote & { id: string }));
            setQuotes(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    if (loading) return <div className="p-8 flex justify-center">Loading quotes...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Quotes</h1>
                    <p className="text-sm text-muted-foreground">Create and manage client proposals</p>
                </div>
                <Button onClick={() => setShowBuilder(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Quote
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold">{quotes.length}</p>
                                <p className="text-xs text-muted-foreground">Total Quotes</p>
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
                                    {formatCurrency(quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.totalMonthlyRate, 0))}
                                </p>
                                <p className="text-xs text-muted-foreground">Won Monthly Revenue</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <div>
                                <p className="text-2xl font-bold">{quotes.filter(q => q.status === 'sent').length}</p>
                                <p className="text-xs text-muted-foreground">Pending Response</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-yellow-600" />
                            <div>
                                <p className="text-2xl font-bold">{quotes.filter(q => q.status === 'draft').length}</p>
                                <p className="text-xs text-muted-foreground">Drafts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quote Table */}
            {quotes.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-1">No quotes yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Create your first client proposal to get started.</p>
                        <Button onClick={() => setShowBuilder(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> New Quote
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium">Client</th>
                                    <th className="px-4 py-3 font-medium">Line Items</th>
                                    <th className="px-4 py-3 font-medium">Monthly Rate</th>
                                    <th className="px-4 py-3 font-medium">Tenure</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Created</th>
                                    <th className="px-4 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((quote) => {
                                    const badge = STATUS_BADGE[quote.status] || STATUS_BADGE.draft;
                                    const created = quote.createdAt?.toDate?.()
                                        ? quote.createdAt.toDate().toLocaleDateString()
                                        : '—';
                                    return (
                                        <tr key={quote.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="font-medium">{quote.leadBusinessName}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {quote.lineItems?.length || 0} services
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {formatCurrency(quote.totalMonthlyRate)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {quote.contractTenure} months
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={badge.variant}>{badge.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{created}</td>
                                            <td className="px-4 py-3">
                                                <Link href={`/sales/quotes/${quote.id}`}>
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* Quote Builder Modal */}
            {showBuilder && (
                <QuoteBuilder
                    onClose={() => setShowBuilder(false)}
                    onCreated={(quoteId) => {
                        setShowBuilder(false);
                        // Could navigate to the new quote
                    }}
                />
            )}
        </div>
    );
}
