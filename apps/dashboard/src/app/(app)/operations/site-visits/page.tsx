'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { SiteVisit, WorkOrder } from '@xiri/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    MapPin, ClipboardCheck, Star, AlertTriangle, Plus,
    Calendar, TrendingUp, CheckCircle2, Clock, Building2
} from 'lucide-react';

export default function SiteVisitsPage() {
    const router = useRouter();
    const { profile } = useAuth();
    const [visits, setVisits] = useState<(SiteVisit & { id: string })[]>([]);
    const [activeWOs, setActiveWOs] = useState<(WorkOrder & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch recent site visits
                const visitsQ = query(
                    collection(db, 'site_visits'),
                    orderBy('createdAt', 'desc'),
                    limit(20)
                );
                const visitsSnap = await getDocs(visitsQ);
                setVisits(visitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SiteVisit & { id: string })));

                // Fetch active work orders (these are the sites to visit)
                const woQ = query(
                    collection(db, 'work_orders'),
                    where('status', 'in', ['active', 'in_progress'])
                );
                const woSnap = await getDocs(woQ);
                setActiveWOs(woSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string })));
            } catch (err) {
                console.error('Error fetching site visit data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Stats
    const thisMonth = visits.filter(v => {
        const d = v.visitDate;
        const now = new Date();
        return d?.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    });
    const avgCondition = thisMonth.length > 0
        ? (thisMonth.reduce((sum, v) => sum + (v.overallCondition || 0), 0) / thisMonth.length).toFixed(1)
        : '—';
    const openActions = visits.reduce((sum, v) => sum + (v.actionItems?.filter(a => a.status === 'open')?.length || 0), 0);
    const avgSatisfaction = thisMonth.filter(v => v.clientSatisfaction).length > 0
        ? (thisMonth.filter(v => v.clientSatisfaction).reduce((sum, v) => sum + v.clientSatisfaction!, 0) / thisMonth.filter(v => v.clientSatisfaction).length).toFixed(1)
        : '—';

    // Determine overdue sites (active WO with no visit in 7+ days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const overdueWOs = activeWOs.filter(wo => {
        const lastVisit = visits.find(v => v.workOrderId === wo.id);
        return !lastVisit || (lastVisit.visitDate < sevenDaysAgoStr);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <MapPin className="w-6 h-6 text-primary" />
                        Site Visits
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Weekly facility inspections & client relationship management
                    </p>
                </div>
                <Button
                    className="gap-2"
                    onClick={() => router.push('/operations/site-visits/conduct')}
                >
                    <Plus className="w-4 h-4" /> Conduct Visit
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6 text-center">
                        <ClipboardCheck className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold">{thisMonth.length}</p>
                        <p className="text-xs text-muted-foreground">Visits This Month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <Star className="w-6 h-6 mx-auto text-amber-500 mb-2" />
                        <p className="text-2xl font-bold">{avgCondition}</p>
                        <p className="text-xs text-muted-foreground">Avg Condition</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold">{avgSatisfaction}</p>
                        <p className="text-xs text-muted-foreground">Client Satisfaction</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${openActions > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`} />
                        <p className="text-2xl font-bold">{openActions}</p>
                        <p className="text-xs text-muted-foreground">Open Action Items</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue Visits */}
            {overdueWOs.length > 0 && (
                <Card className="border-red-200 dark:border-red-900/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4" />
                            Overdue Visits ({overdueWOs.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {overdueWOs.map(wo => (
                                <div
                                    key={wo.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                    onClick={() => router.push(`/operations/site-visits/conduct?workOrderId=${wo.id}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Building2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                        <div>
                                            <p className="font-medium text-sm">{wo.locationName}</p>
                                            <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                                        </div>
                                    </div>
                                    <Badge variant="destructive" className="text-[10px]">
                                        Overdue
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Active Sites — Schedule */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Active Sites ({activeWOs.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeWOs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No active work orders. Sites will appear here once work orders are fulfilled.
                        </p>
                    ) : (
                        <div className="grid gap-2">
                            {activeWOs.map(wo => {
                                const lastVisit = visits.find(v => v.workOrderId === wo.id);
                                return (
                                    <div
                                        key={wo.id}
                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                                        onClick={() => router.push(`/operations/site-visits/conduct?workOrderId=${wo.id}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-sm">{wo.locationName}</p>
                                                <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {lastVisit ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {Array.from({ length: lastVisit.overallCondition || 0 }).map((_, i) => (
                                                            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{lastVisit.visitDate}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px]">
                                                    <Clock className="w-3 h-3 mr-1" /> Never visited
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Visits */}
            {visits.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                            Recent Visits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {visits.slice(0, 10).map(v => (
                                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                                    <div>
                                        <p className="font-medium text-sm">{v.locationName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {v.fsmName} • {v.visitDate}
                                            {v.isFirstVisit && <span className="ml-1 text-blue-500 font-medium">★ First Visit</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {v.clientContactMade && (
                                            <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400 border-green-200">
                                                Client Met
                                            </Badge>
                                        )}
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: v.overallCondition || 0 }).map((_, i) => (
                                                <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                                            ))}
                                        </div>
                                        {v.actionItems?.filter(a => a.status === 'open').length > 0 && (
                                            <Badge variant="destructive" className="text-[10px]">
                                                {v.actionItems.filter(a => a.status === 'open').length} open
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
