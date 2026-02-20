'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';
import { WorkOrder } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, MapPin, User2, Clock, AlertCircle, CheckCircle2, PauseCircle, Filter, Search, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
    pending_assignment: { variant: 'destructive', label: 'Needs Vendor', icon: AlertCircle },
    active: { variant: 'default', label: 'Active', icon: CheckCircle2 },
    paused: { variant: 'secondary', label: 'Paused', icon: PauseCircle },
    completed: { variant: 'outline', label: 'Completed', icon: CheckCircle2 },
    cancelled: { variant: 'secondary', label: 'Cancelled', icon: AlertCircle },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatFrequency(freq?: string, daysOfWeek?: boolean[]) {
    if (!freq) return '—';
    if (freq === 'custom_days' && daysOfWeek) {
        const days = daysOfWeek.map((on, i) => on ? DAY_NAMES[i] : null).filter(Boolean);
        const monFri = [false, true, true, true, true, true, false];
        if (JSON.stringify(daysOfWeek) === JSON.stringify(monFri)) return 'Mon–Fri';
        return days.join(', ') || 'Custom';
    }
    const labels: Record<string, string> = {
        one_time: 'One-Time', nightly: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly',
        monthly: 'Monthly', quarterly: 'Quarterly', custom_days: 'Custom',
    };
    return labels[freq] || freq;
}

export default function WorkOrdersPage() {
    const { profile, hasRole } = useAuth();
    const [workOrders, setWorkOrders] = useState<(WorkOrder & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
    const [filterMode, setFilterMode] = useState<'mine' | 'all'>(
        // FSMs default to "My Work Orders", admins default to "All"
        'all' // Will be set properly after profile loads
    );

    // Set default filter once profile loads
    useEffect(() => {
        if (profile) {
            const isAdmin = profile.roles?.includes('admin');
            const isSales = profile.roles?.some((r: string) => ['sales', 'sales_exec', 'sales_mgr'].includes(r));
            // Admins and sales see all; FSMs default to theirs
            setFilterMode((isAdmin || isSales) ? 'all' : 'mine');
        }
    }, [profile]);

    useEffect(() => {
        const q = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));
            setWorkOrders(data);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching work orders:', err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    // Apply user filter, then search
    const userFiltered = filterMode === 'mine' && profile
        ? workOrders.filter(wo => wo.assignedFsmId === profile.uid || (wo as any).createdBy === profile.uid)
        : workOrders;

    const filteredOrders = searchQuery.trim()
        ? userFiltered.filter(wo => {
            const q = searchQuery.toLowerCase();
            const vendorName = wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || '';
            return (
                wo.serviceType?.toLowerCase().includes(q) ||
                wo.locationName?.toLowerCase().includes(q) ||
                vendorName.toLowerCase().includes(q)
            );
        })
        : userFiltered;

    const pending = filteredOrders.filter(wo => wo.status === 'pending_assignment');
    const active = filteredOrders.filter(wo => wo.status === 'active');
    const isAdmin = profile?.roles?.includes('admin');
    const isSales = profile?.roles?.some((r: string) => ['sales', 'sales_exec', 'sales_mgr'].includes(r));

    if (loading) return <div className="p-8 flex justify-center">Loading work orders...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Work Orders</h1>
                    <p className="text-sm text-muted-foreground">Manage vendor assignments and service fulfillment</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filter Toggle */}
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                        <Button
                            variant={filterMode === 'mine' ? 'default' : 'ghost'}
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setFilterMode('mine')}
                        >
                            <User2 className="w-3.5 h-3.5" /> My Orders
                        </Button>
                        {isAdmin && (
                            <Button
                                variant={filterMode === 'all' ? 'default' : 'ghost'}
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setFilterMode('all')}
                            >
                                <Filter className="w-3.5 h-3.5" /> All
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold">{pending.length}</p>
                                <p className="text-xs text-muted-foreground">Needs Vendor</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <div>
                                <p className="text-2xl font-bold">{active.length}</p>
                                <p className="text-xs text-muted-foreground">Active</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold">{filteredOrders.length}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(active.reduce((s, wo) => s + (wo.clientRate || 0), 0))}
                                </p>
                                <p className="text-xs text-muted-foreground">Active Monthly Revenue</p>
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
                        placeholder="Search by service, location, or vendor..."
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

            {/* Work Orders Grouped by Client */}
            {filteredOrders.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-1">
                            {filterMode === 'mine' ? 'No work orders assigned to you' : 'No work orders yet'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {filterMode === 'mine'
                                ? 'Work orders will appear here when a quote is accepted with you assigned as FSM.'
                                : 'Work orders are created automatically when a Sales quote is accepted.'}
                        </p>
                    </CardContent>
                </Card>
            ) : (() => {
                // Group work orders by client (leadId)
                const grouped = filteredOrders.reduce((acc, wo) => {
                    const key = wo.leadId || 'unlinked';
                    if (!acc[key]) acc[key] = { clientName: (wo as any).clientBusinessName || wo.locationName || 'Unknown Client', orders: [] };
                    acc[key].orders.push(wo);
                    return acc;
                }, {} as Record<string, { clientName: string; orders: typeof filteredOrders }>);

                return (
                    <div className="space-y-3">
                        {Object.entries(grouped).map(([leadId, group]) => {
                            const isExpanded = expandedClients[leadId] ?? true;
                            const clientRevenue = group.orders.reduce((s, wo) => s + (wo.clientRate || 0), 0);
                            const needsVendor = group.orders.filter(wo => wo.status === 'pending_assignment').length;

                            return (
                                <Card key={leadId}>
                                    {/* Client Header — clickable */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors border-b"
                                        onClick={() => setExpandedClients(prev => ({ ...prev, [leadId]: !isExpanded }))}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                            <Building2 className="w-5 h-5 text-primary" />
                                            <div>
                                                <p className="font-semibold text-sm">{group.clientName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {group.orders.length} work order{group.orders.length !== 1 ? 's' : ''}
                                                    {needsVendor > 0 && <span className="text-red-500 ml-2">• {needsVendor} needs vendor</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-sm">{formatCurrency(clientRevenue)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                                        </div>
                                    </div>

                                    {/* Collapsible Work Orders */}
                                    {isExpanded && (
                                        <CardContent className="p-0">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider bg-muted/10">
                                                        <th className="px-4 py-2 font-medium">Service</th>
                                                        <th className="px-4 py-2 font-medium">Location</th>
                                                        <th className="px-4 py-2 font-medium">Vendor</th>
                                                        <th className="px-4 py-2 font-medium">Client Rate</th>
                                                        <th className="px-4 py-2 font-medium">Vendor Rate</th>
                                                        <th className="px-4 py-2 font-medium">Margin</th>
                                                        <th className="px-4 py-2 font-medium">Status</th>
                                                        <th className="px-4 py-2 font-medium"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.orders.map((wo) => {
                                                        const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending_assignment;
                                                        const margin = wo.vendorRate ? wo.clientRate - wo.vendorRate : null;
                                                        return (
                                                            <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                                                <td className="px-4 py-2.5">
                                                                    <span className="font-medium text-sm">{wo.serviceType}</span>
                                                                    <p className="text-xs text-muted-foreground">{formatFrequency(wo.schedule?.frequency, wo.schedule?.daysOfWeek)}</p>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <div className="flex items-center gap-1.5 text-sm">
                                                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        {wo.locationName}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    {wo.vendorId ? (
                                                                        <span className="text-sm">{wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Assigned'}</span>
                                                                    ) : (
                                                                        <span className="text-sm text-red-500 font-medium">Unassigned</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2.5 font-medium text-sm">{formatCurrency(wo.clientRate)}</td>
                                                                <td className="px-4 py-2.5 text-sm">
                                                                    {wo.vendorRate ? formatCurrency(wo.vendorRate) : '—'}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-sm">
                                                                    {margin !== null ? (
                                                                        <span className={margin > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                                            {formatCurrency(margin)}
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <Badge variant={config.variant}>{config.label}</Badge>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <Link href={`/operations/work-orders/${wo.id}`}>
                                                                        <Button variant="ghost" size="sm">View</Button>
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
}

