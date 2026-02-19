'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WorkOrder } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, MapPin, User2, Clock, AlertCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
    pending_assignment: { variant: 'destructive', label: 'Needs Vendor', icon: AlertCircle },
    active: { variant: 'default', label: 'Active', icon: CheckCircle2 },
    paused: { variant: 'secondary', label: 'Paused', icon: PauseCircle },
    completed: { variant: 'outline', label: 'Completed', icon: CheckCircle2 },
    cancelled: { variant: 'secondary', label: 'Cancelled', icon: AlertCircle },
};

export default function WorkOrdersPage() {
    const [workOrders, setWorkOrders] = useState<(WorkOrder & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));
            setWorkOrders(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const pending = workOrders.filter(wo => wo.status === 'pending_assignment');
    const active = workOrders.filter(wo => wo.status === 'active');

    if (loading) return <div className="p-8 flex justify-center">Loading work orders...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Work Orders</h1>
                <p className="text-sm text-muted-foreground">Manage vendor assignments and service fulfillment</p>
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
                                <p className="text-2xl font-bold">{workOrders.length}</p>
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

            {/* Work Orders Table */}
            {workOrders.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium mb-1">No work orders yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Work orders are created automatically when a Sales quote is accepted.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium">Service</th>
                                    <th className="px-4 py-3 font-medium">Location</th>
                                    <th className="px-4 py-3 font-medium">Vendor</th>
                                    <th className="px-4 py-3 font-medium">Client Rate</th>
                                    <th className="px-4 py-3 font-medium">Vendor Rate</th>
                                    <th className="px-4 py-3 font-medium">Margin</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {workOrders.map((wo) => {
                                    const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending_assignment;
                                    const margin = wo.vendorRate ? wo.clientRate - wo.vendorRate : null;
                                    return (
                                        <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="font-medium">{wo.serviceType}</span>
                                                <p className="text-xs text-muted-foreground capitalize">{wo.schedule?.frequency}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {wo.locationName}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {wo.vendorId ? (
                                                    <span className="text-sm">{wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Assigned'}</span>
                                                ) : (
                                                    <span className="text-sm text-red-500 font-medium">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-sm">{formatCurrency(wo.clientRate)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {wo.vendorRate ? formatCurrency(wo.vendorRate) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {margin !== null ? (
                                                    <span className={margin > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                        {formatCurrency(margin)}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={config.variant}>{config.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
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
                </Card>
            )}
        </div>
    );
}
