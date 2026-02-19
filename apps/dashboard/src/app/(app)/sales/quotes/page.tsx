'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quote } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText, DollarSign, Calendar, Building2, ChevronRight } from 'lucide-react';
import QuoteBuilder from '@/components/QuoteBuilder';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    accepted: { variant: 'outline', label: 'Accepted' },
    rejected: { variant: 'destructive', label: 'Rejected' },
    expired: { variant: 'secondary', label: 'Expired' },
};

export default function QuotesPage() {
    const router = useRouter();
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

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">{quotes.length}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">
                                {formatCurrency(quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.totalMonthlyRate, 0))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Won MRR</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">{quotes.filter(q => q.status === 'sent').length}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-yellow-600 shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">{quotes.filter(q => q.status === 'draft').length}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Drafts</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quote Table — Clickable Rows */}
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
                                    <th className="px-4 py-2.5 font-medium">Client</th>
                                    <th className="px-4 py-2.5 font-medium">Services</th>
                                    <th className="px-4 py-2.5 font-medium">Monthly</th>
                                    <th className="px-4 py-2.5 font-medium">Status</th>
                                    <th className="px-4 py-2.5 font-medium">Ver</th>
                                    <th className="px-4 py-2.5 font-medium">Date</th>
                                    <th className="px-4 py-2.5 font-medium w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((quote) => {
                                    const badge = STATUS_BADGE[quote.status] || STATUS_BADGE.draft;
                                    const created = quote.createdAt?.toDate?.()
                                        ? quote.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : '—';
                                    return (
                                        <tr
                                            key={quote.id}
                                            className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer group"
                                            onClick={() => router.push(`/sales/quotes/${quote.id}`)}
                                        >
                                            <td className="px-4 py-2.5">
                                                <span className="font-medium text-sm">{quote.leadBusinessName}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                                {quote.lineItems?.length || 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm font-medium">
                                                {formatCurrency(quote.totalMonthlyRate)}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Badge variant={badge.variant} className="text-xs px-1.5 py-0">
                                                    {badge.label}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs text-muted-foreground">
                                                    v{quote.version || 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{created}</td>
                                            <td className="px-4 py-2.5">
                                                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
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
                        router.push(`/sales/quotes/${quoteId}`);
                    }}
                />
            )}
        </div>
    );
}
