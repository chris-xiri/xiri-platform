'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import {
    Users,
    Mail,
    Phone,
    ClipboardList,
    ExternalLink,
    DollarSign,
    FileSignature,
    FileText,
    Activity,
    ChevronDown,
    ChevronRight,
    Send,
    XCircle,
    Play,
} from 'lucide-react';
import { format } from 'date-fns';

function toDate(val: any): Date | null {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return val;
    return new Date(val);
}

const WO_STATUS: Record<string, { label: string; cls: string }> = {
    pending_assignment: { label: 'Needs Vendor', cls: 'bg-red-100 text-red-700 border-red-200' },
    active: { label: 'Active', cls: 'bg-green-100 text-green-700 border-green-200' },
    paused: { label: 'Paused', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    terminated: { label: 'Terminated', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

interface CompanyHubProps {
    companyId: string;
    activities: { id: string; type: string; description: string; createdAt: any; metadata?: any }[];
}

export default function CompanyHub({ companyId, activities }: CompanyHubProps) {
    const router = useRouter();
    const [contacts, setContacts] = useState<any[]>([]);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [showTimeline, setShowTimeline] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [cSnap, woSnap, qSnap, conSnap] = await Promise.all([
                getDocs(query(collection(db, 'contacts'), where('companyId', '==', companyId))),
                getDocs(query(collection(db, 'work_orders'), where('leadId', '==', companyId), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, 'quotes'), where('leadId', '==', companyId), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, 'contracts'), where('leadId', '==', companyId), orderBy('createdAt', 'desc'))),
            ]);
            setContacts(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setWorkOrders(woSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setQuotes(qSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setContracts(conSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error fetching company hub data:', err);
        }
    }, [companyId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const activeWOs = workOrders.filter(wo => wo.status === 'active' || wo.status === 'pending_assignment');
    const totalMRR = activeWOs.reduce((s: number, wo: any) => s + (wo.clientRate || 0), 0);

    return (
        <div className="space-y-4">
            {/* ═══ Stats Row ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-500" />
                        <div><p className="text-xs text-muted-foreground">Contacts</p><p className="text-lg font-semibold">{contacts.length}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-purple-500" />
                        <div><p className="text-xs text-muted-foreground">Work Orders</p><p className="text-lg font-semibold">{workOrders.length}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                        <FileSignature className="w-5 h-5 text-amber-500" />
                        <div><p className="text-xs text-muted-foreground">Contracts</p><p className="text-lg font-semibold">{contracts.length}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div><p className="text-xs text-muted-foreground">Active MRR</p><p className="text-lg font-semibold">{fmt(totalMRR)}</p></div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Contacts ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4" /> Contacts ({contacts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No contacts on file</p>
                    ) : (
                        <div className="divide-y">
                            {contacts.map((c: any) => (
                                <div key={c.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                                            {(c.firstName?.[0] || c.name?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : c.name || 'Unnamed'}
                                            </p>
                                            {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                                        {c.email && (
                                            <a href={`mailto:${c.email}`} className="hover:text-primary flex items-center gap-1">
                                                <Mail className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{c.email}</span>
                                            </a>
                                        )}
                                        {c.phone && (
                                            <a href={`tel:${c.phone}`} className="hover:text-primary flex items-center gap-1">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{c.phone}</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══ Work Orders ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> Work Orders ({workOrders.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {workOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No work orders yet</p>
                    ) : (
                        <div className="overflow-x-auto -mx-6">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left py-2 px-4 font-medium">Service</th>
                                        <th className="text-left py-2 px-4 font-medium">Frequency</th>
                                        <th className="text-left py-2 px-4 font-medium">Vendor</th>
                                        <th className="text-right py-2 px-4 font-medium">Client Rate</th>
                                        <th className="text-left py-2 px-4 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workOrders.map((wo: any) => {
                                        const st = WO_STATUS[wo.status] || { label: wo.status, cls: 'bg-gray-100 text-gray-600' };
                                        return (
                                            <tr
                                                key={wo.id}
                                                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                                                onClick={() => router.push('/operations/work-orders')}
                                            >
                                                <td className="py-2.5 px-4 font-medium">
                                                    {(wo.serviceType || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                                </td>
                                                <td className="py-2.5 px-4 text-muted-foreground">{wo.frequency || '—'}</td>
                                                <td className="py-2.5 px-4 text-muted-foreground">
                                                    {wo.vendorName || <span className="text-red-500 text-xs">Unassigned</span>}
                                                </td>
                                                <td className="py-2.5 px-4 text-right">{wo.clientRate ? fmt(wo.clientRate) : '—'}</td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>
                                                        {st.label}
                                                    </span>
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

            {/* ═══ Quick Links: Quotes & Contracts ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card
                    className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => quotes.length > 0 && router.push(`/sales/quotes/${quotes[0].id}`)}
                >
                    <CardContent className="py-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div>
                                <p className="text-sm font-medium">Quotes</p>
                                <p className="text-xs text-muted-foreground">{quotes.length} total</p>
                            </div>
                        </div>
                        {quotes.length > 0 && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
                    </CardContent>
                </Card>
                <Card
                    className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => contracts.length > 0 && router.push(`/sales/quotes/${contracts[0]?.quoteId || contracts[0]?.id}`)}
                >
                    <CardContent className="py-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileSignature className="w-5 h-5 text-amber-500" />
                            <div>
                                <p className="text-sm font-medium">Contracts</p>
                                <p className="text-xs text-muted-foreground">{contracts.length} total</p>
                            </div>
                        </div>
                        {contracts.length > 0 && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Collapsible Activity Timeline ═══ */}
            <Card>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTimeline(!showTimeline)}>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Activity Timeline ({activities.length})
                        {showTimeline
                            ? <ChevronDown className="w-4 h-4 ml-auto" />
                            : <ChevronRight className="w-4 h-4 ml-auto" />
                        }
                    </CardTitle>
                </CardHeader>
                {showTimeline && (
                    <CardContent>
                        {activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                        ) : (
                            <div className="space-y-0">
                                {activities.map((act, i) => {
                                    const date = toDate(act.createdAt);
                                    const isLast = i === activities.length - 1;
                                    return (
                                        <div key={act.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    act.type === 'OUTREACH_SENT' ? 'bg-green-100 text-green-600' :
                                                    act.type === 'OUTREACH_FAILED' ? 'bg-red-100 text-red-600' :
                                                    act.type === 'SEQUENCE_STARTED' ? 'bg-blue-100 text-blue-600' :
                                                    act.type === 'OUTREACH_QUEUED' ? 'bg-amber-100 text-amber-600' :
                                                    'bg-muted text-muted-foreground'
                                                }`}>
                                                    {act.type === 'OUTREACH_SENT' ? <Send className="w-3.5 h-3.5" /> :
                                                        act.type === 'OUTREACH_FAILED' ? <XCircle className="w-3.5 h-3.5" /> :
                                                        act.type === 'SEQUENCE_STARTED' ? <Play className="w-3.5 h-3.5" /> :
                                                        <Activity className="w-3.5 h-3.5" />}
                                                </div>
                                                {!isLast && <div className="w-px bg-border flex-1 min-h-[16px]" />}
                                            </div>
                                            <div className="pb-4">
                                                <p className="text-xs font-medium">
                                                    {act.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                                                {date && (
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        {format(date, 'MMM d, yyyy h:mm a')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
