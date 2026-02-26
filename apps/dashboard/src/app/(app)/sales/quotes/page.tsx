'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Quote } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, FileText, DollarSign, Calendar, Building2, ChevronRight, ChevronDown, Search } from 'lucide-react';
import QuoteBuilder from '@/components/QuoteBuilder';

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    accepted: { variant: 'outline', label: 'Accepted' },
    rejected: { variant: 'destructive', label: 'Rejected' },
    expired: { variant: 'secondary', label: 'Expired' },
    changes_requested: { variant: 'default', label: 'Changes Requested' },
};

const CLIENT_COLORS = [
    { border: '#6366f1', bg: '#eef2ff' },
    { border: '#0ea5e9', bg: '#f0f9ff' },
    { border: '#10b981', bg: '#ecfdf5' },
    { border: '#f59e0b', bg: '#fffbeb' },
    { border: '#ef4444', bg: '#fef2f2' },
    { border: '#8b5cf6', bg: '#f5f3ff' },
    { border: '#ec4899', bg: '#fdf2f8' },
    { border: '#14b8a6', bg: '#f0fdfa' },
];

interface QuoteGroup {
    leadBusinessName: string;
    leadId: string;
    latest: Quote & { id: string };
    older: (Quote & { id: string })[];
}

export default function QuotesPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const [quotes, setQuotes] = useState<(Quote & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBuilder, setShowBuilder] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedLeads, setExpandedLeads] = useState<Record<string, boolean>>({});

    const isFsm = profile?.roles?.some((r: string) => r === 'fsm') && !profile?.roles?.some((r: string) => r === 'admin');

    useEffect(() => {
        const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote & { id: string }));
            // FSMs only see quotes assigned to them
            if (isFsm && profile?.uid) {
                data = data.filter(q => q.assignedFsmId === profile.uid);
            }
            setQuotes(data);
            setLoading(false);
        });
        return () => unsub();
    }, [isFsm, profile?.uid]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    // Search
    const filtered = searchQuery.trim()
        ? quotes.filter(q => q.leadBusinessName?.toLowerCase().includes(searchQuery.toLowerCase()))
        : quotes;

    // Group by lead (leadId) — latest version first, older collapsed
    const groupsByLead: QuoteGroup[] = [];
    const groupMap = new Map<string, QuoteGroup>();

    filtered.forEach(q => {
        const key = q.leadId || q.leadBusinessName;
        if (!groupMap.has(key)) {
            const group: QuoteGroup = {
                leadBusinessName: q.leadBusinessName,
                leadId: q.leadId,
                latest: q,
                older: [],
            };
            groupMap.set(key, group);
            groupsByLead.push(group);
        } else {
            groupMap.get(key)!.older.push(q);
        }
    });

    const toggleLead = (key: string) => {
        setExpandedLeads(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) return <div className="p-8 flex justify-center">Loading quotes...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Quotes</h1>
                    <p className="text-sm text-muted-foreground">Create and manage client proposals</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search client..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-[200px]"
                        />
                    </div>
                    <Button onClick={() => setShowBuilder(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        New Quote
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">{groupsByLead.length}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Clients</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                            <p className="text-xl font-bold leading-none">
                                {formatCurrency(quotes.filter(q => q.status === 'accepted').reduce((sum, q) => {
                                    if (q.lineItems && q.lineItems.length > 0) {
                                        return sum + q.lineItems
                                            .filter((li: any) => li.frequency !== 'one_time')
                                            .reduce((s: number, li: any) => s + (li.clientRate || 0), 0);
                                    }
                                    return sum + q.totalMonthlyRate;
                                }, 0))}
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

            {/* Grouped Quotes */}
            {groupsByLead.length === 0 ? (
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
                <div className="space-y-4">
                    {groupsByLead.map((group, clientIdx) => {
                        const key = group.leadId || group.leadBusinessName;
                        const isExpanded = expandedLeads[key] || false;
                        const badge = STATUS_BADGE[group.latest.status] || STATUS_BADGE.draft;
                        const created = group.latest.createdAt?.toDate?.()
                            ? group.latest.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—';
                        const color = CLIENT_COLORS[clientIdx % CLIENT_COLORS.length];

                        return (
                            <Card key={key} className="overflow-hidden border-l-4" style={{ borderLeftColor: color.border }}>
                                {/* Latest Version (always visible, highlighted) */}
                                <div
                                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                    style={{ backgroundColor: color.bg }}
                                    onClick={() => router.push(`/sales/quotes/${group.latest.id}`)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                style={{ backgroundColor: color.border }}
                                            >
                                                {clientIdx + 1}
                                            </span>
                                            <div>
                                                <p className="font-semibold">{group.leadBusinessName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {group.latest.lineItems?.length || 0} services • {formatCurrency(group.latest.totalMonthlyRate)}/mo
                                                    <span className="ml-2 text-muted-foreground/60">v{group.latest.version || 1}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                                            <span className="text-xs text-muted-foreground">{created}</span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>

                                    {/* Line item breakdown for scanability */}
                                    {group.latest.lineItems && group.latest.lineItems.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-dashed space-y-0.5">
                                            {group.latest.lineItems.map((li: any, idx: number) => (
                                                <p key={li.id || idx} className="text-xs text-muted-foreground">
                                                    {li.serviceType} — {formatCurrency(li.clientRate)}/mo
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Older Versions Toggle */}
                                {group.older.length > 0 && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleLead(key);
                                            }}
                                            className="w-full px-4 py-2 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
                                        >
                                            {isExpanded
                                                ? <ChevronDown className="w-3 h-3" />
                                                : <ChevronRight className="w-3 h-3" />
                                            }
                                            {group.older.length} previous version{group.older.length > 1 ? 's' : ''}
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t">
                                                {group.older.map(olderQuote => {
                                                    const olderBadge = STATUS_BADGE[olderQuote.status] || STATUS_BADGE.draft;
                                                    const olderCreated = olderQuote.createdAt?.toDate?.()
                                                        ? olderQuote.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        : '—';
                                                    return (
                                                        <div
                                                            key={olderQuote.id}
                                                            className="px-4 py-3 border-b last:border-0 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer flex items-center justify-between"
                                                            onClick={() => router.push(`/sales/quotes/${olderQuote.id}`)}
                                                        >
                                                            <div className="pl-4">
                                                                <p className="text-sm text-muted-foreground">
                                                                    v{olderQuote.version || 1} • {formatCurrency(olderQuote.totalMonthlyRate)}/mo • {olderQuote.lineItems?.length || 0} services
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant={olderBadge.variant} className="text-xs">{olderBadge.label}</Badge>
                                                                <span className="text-xs text-muted-foreground">{olderCreated}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </Card>
                        );
                    })}
                </div>
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
