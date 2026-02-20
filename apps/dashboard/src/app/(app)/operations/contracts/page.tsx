'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Contract } from '@xiri/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Calendar, DollarSign, Search, ChevronDown, ChevronRight, X } from 'lucide-react';

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    active: { variant: 'outline', label: 'Active' },
    amended: { variant: 'default', label: 'Amended' },
    superseded: { variant: 'secondary', label: 'Superseded' },
    terminated: { variant: 'destructive', label: 'Terminated' },
    expired: { variant: 'secondary', label: 'Expired' },
};

interface ClientGroup {
    clientBusinessName: string;
    leadId: string;
    latest: Contract & { id: string };
    older: (Contract & { id: string })[];
}

export default function ContractsPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const [contracts, setContracts] = useState<(Contract & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

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
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);

    const isFsm = profile?.roles?.some((r: string) => r === 'fsm');
    const isAdmin = profile?.roles?.includes('admin');
    const isSales = profile?.roles?.some((r: string) => ['sales', 'sales_exec', 'sales_mgr'].includes(r));

    // FSMs see only their assigned contracts; sales sees all (they need visibility into their deals); admins see all
    const roleFiltered = (isFsm && !isAdmin)
        ? contracts.filter(c => (c as any).assignedFsmId === profile?.uid)
        : contracts;

    // Search
    const filtered = searchQuery.trim()
        ? roleFiltered.filter(c => c.clientBusinessName?.toLowerCase().includes(searchQuery.toLowerCase()))
        : roleFiltered;

    // Group by client (leadId) — 1 contract per client, amendments grouped below
    const groupsByClient: ClientGroup[] = [];
    const groupMap = new Map<string, ClientGroup>();

    filtered.forEach(c => {
        const key = c.leadId || c.clientBusinessName; // group by leadId, fallback to name
        if (!groupMap.has(key)) {
            const group: ClientGroup = {
                clientBusinessName: c.clientBusinessName,
                leadId: c.leadId,
                latest: c,
                older: [],
            };
            groupMap.set(key, group);
            groupsByClient.push(group);
        } else {
            // Already sorted desc, so the first one we encounter is the latest
            groupMap.get(key)!.older.push(c);
        }
    });

    const toggleClient = (key: string) => {
        setExpandedClients(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Stats
    const activeContracts = contracts.filter(c => c.status === 'active');

    if (loading) return <div className="p-8 flex justify-center">Loading contracts...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Contracts</h1>
                    <p className="text-sm text-muted-foreground">Active client agreements and their terms</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold">{activeContracts.length}</p>
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
                                    {formatCurrency(activeContracts.reduce((s, c) => s + (c.totalMonthlyRate || (c as any).monthlyRate || 0), 0))}
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
                                <p className="text-2xl font-bold">{groupsByClient.length}</p>
                                <p className="text-xs text-muted-foreground">Clients</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search Bar — CRM Style */}
            <div className="px-3 py-2 border border-border rounded-lg bg-muted/20 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by client name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
            {/* Grouped Contracts */}
            {groupsByClient.length === 0 ? (
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
                <div className="space-y-3">
                    {groupsByClient.map(group => {
                        const key = group.leadId || group.clientBusinessName;
                        const isExpanded = expandedClients[key] || false;
                        const badge = STATUS_BADGE[group.latest.status] || STATUS_BADGE.draft;
                        const created = group.latest.createdAt?.toDate?.()
                            ? group.latest.createdAt.toDate().toLocaleDateString()
                            : '—';

                        return (
                            <Card key={key} className="overflow-hidden">
                                {/* Latest Version (always visible, highlighted) */}
                                <div
                                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/operations/contracts/${group.latest.id}`)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-semibold text-base">{group.clientBusinessName || (group.latest as any).clientName || '—'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(group.latest.totalMonthlyRate || (group.latest as any).monthlyRate || 0)}/mo • {group.latest.contractTenure || (group.latest as any).tenure || '—'} months • {group.latest.paymentTerms || 'Net 30'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={badge.variant}>{badge.label}</Badge>
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

                                {/* Amendments Toggle */}
                                {group.older.length > 0 && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleClient(key);
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
                                                {group.older.map(olderContract => {
                                                    const olderBadge = STATUS_BADGE[olderContract.status] || STATUS_BADGE.draft;
                                                    const olderCreated = olderContract.createdAt?.toDate?.()
                                                        ? olderContract.createdAt.toDate().toLocaleDateString()
                                                        : '—';
                                                    return (
                                                        <div
                                                            key={olderContract.id}
                                                            className="px-4 py-3 border-b last:border-0 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer flex items-center justify-between"
                                                            onClick={() => router.push(`/operations/contracts/${olderContract.id}`)}
                                                        >
                                                            <div className="pl-4">
                                                                <p className="text-sm text-muted-foreground">
                                                                    {formatCurrency(olderContract.totalMonthlyRate || (olderContract as any).monthlyRate || 0)}/mo • {olderContract.contractTenure || (olderContract as any).tenure || '—'} months
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
        </div>
    );
}
