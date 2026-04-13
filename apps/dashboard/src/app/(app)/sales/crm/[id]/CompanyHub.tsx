'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import LeadDetailDrawer from '@/components/lead/LeadDetailDrawer';
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
    MailOpen,
    MousePointerClick,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
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

/* ─── Email Engagement Card ────────────────────────────────────── */

const EMAIL_EVENT_TYPES = ['EMAIL_DELIVERED', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'EMAIL_COMPLAINED'] as const;

function EmailEngagementCard({ activities, contacts }: { activities: CompanyHubProps['activities']; contacts: any[] }) {
    const [expanded, setExpanded] = useState(false);

    // Filter email-related activities
    const emailActivities = activities.filter(a =>
        EMAIL_EVENT_TYPES.includes(a.type as any) || a.type === 'OUTREACH_SENT'
    );

    // Show the card if there are email activities OR if a sequence was started
    const hasSequence = activities.some(a => a.type === 'SEQUENCE_STARTED');
    if (emailActivities.length === 0 && !hasSequence) return null;

    // Empty state — sequence enrolled but first email hasn't sent yet
    if (emailActivities.length === 0 && hasSequence) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Email Engagement
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (sequence enrolled — awaiting first send)
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        The email sequence has been started. Stats will appear here once the first email is sent.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Aggregate counts
    const sent = activities.filter(a => a.type === 'OUTREACH_SENT').length;
    const delivered = activities.filter(a => a.type === 'EMAIL_DELIVERED').length;
    const opened = activities.filter(a => a.type === 'EMAIL_OPENED').length;
    const clicked = activities.filter(a => a.type === 'EMAIL_CLICKED').length;
    const bounced = activities.filter(a => a.type === 'EMAIL_BOUNCED' || a.type === 'EMAIL_COMPLAINED').length;

    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    const clickRate = opened > 0 ? Math.round((clicked / opened) * 100) : 0;

    // Per-contact breakdown
    const contactMap = new Map<string, { name: string; email: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number }>();

    for (const act of activities) {
        const contactId = act.metadata?.contactId;
        if (!contactId) continue;
        if (act.type !== 'OUTREACH_SENT' && !EMAIL_EVENT_TYPES.includes(act.type as any)) continue;

        if (!contactMap.has(contactId)) {
            const contact = contacts.find(c => c.id === contactId);
            const name = contact
                ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.contactName || contact.name || 'Unknown'
                : 'Unknown';
            contactMap.set(contactId, { name, email: contact?.email || act.metadata?.to || '', sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });
        }

        const entry = contactMap.get(contactId)!;
        if (act.type === 'OUTREACH_SENT') entry.sent++;
        else if (act.type === 'EMAIL_DELIVERED') entry.delivered++;
        else if (act.type === 'EMAIL_OPENED') entry.opened++;
        else if (act.type === 'EMAIL_CLICKED') entry.clicked++;
        else if (act.type === 'EMAIL_BOUNCED' || act.type === 'EMAIL_COMPLAINED') entry.bounced++;
    }

    const contactBreakdown = Array.from(contactMap.entries())
        .sort((a, b) => (b[1].opened + b[1].clicked) - (a[1].opened + a[1].clicked));

    const stats = [
        { label: 'Sent', value: sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Delivered', value: delivered, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Opened', value: opened, icon: MailOpen, color: 'text-violet-600', bg: 'bg-violet-50', sub: openRate > 0 ? `${openRate}%` : undefined },
        { label: 'Clicked', value: clicked, icon: MousePointerClick, color: 'text-amber-600', bg: 'bg-amber-50', sub: clickRate > 0 ? `${clickRate}%` : undefined },
        { label: 'Bounced', value: bounced, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    ];

    return (
        <Card>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Email Engagement
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({sent} sent · {openRate}% open rate)
                    </span>
                    {expanded
                        ? <ChevronDown className="w-4 h-4 ml-auto" />
                        : <ChevronRight className="w-4 h-4 ml-auto" />
                    }
                </CardTitle>
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-4">
                    {/* Aggregate Stats */}
                    <div className="grid grid-cols-5 gap-2">
                        {stats.map(s => (
                            <div key={s.label} className={`rounded-lg ${s.bg} p-2.5 text-center`}>
                                <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                                {s.sub && <p className={`text-[10px] font-semibold ${s.color}`}>{s.sub}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Per-Contact Breakdown */}
                    {contactBreakdown.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Per-Contact Breakdown
                            </p>
                            <div className="space-y-2">
                                {contactBreakdown.map(([cId, cs]) => (
                                    <div key={cId} className="rounded-lg border p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{cs.name}</p>
                                                {cs.email && <p className="text-xs text-muted-foreground truncate">{cs.email}</p>}
                                            </div>
                                            {cs.bounced > 0 && (
                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">Bounced</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Send className="w-3 h-3 text-blue-500" /> {cs.sent}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-green-500" /> {cs.delivered}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MailOpen className="w-3 h-3 text-violet-500" /> {cs.opened}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MousePointerClick className="w-3 h-3 text-amber-500" /> {cs.clicked}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

export default function CompanyHub({ companyId, activities }: CompanyHubProps) {
    const router = useRouter();
    const [contacts, setContacts] = useState<any[]>([]);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [showTimeline, setShowTimeline] = useState(false);
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);

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
                                            {(c.firstName?.[0] || c.contactName?.[0] || c.name?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p
                                                className="text-sm font-medium truncate cursor-pointer hover:text-primary hover:underline transition-colors"
                                                onClick={() => setDrawerContactId(c.id)}
                                            >
                                                {c.firstName || c.lastName
                                                    ? [c.firstName, c.lastName].filter(Boolean).join(' ')
                                                    : c.contactName || c.name || 'Unnamed'}
                                            </p>
                                            {(c.role || c.title) && <p className="text-xs text-muted-foreground truncate">{c.role || c.title}</p>}
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

            {/* ═══ Collapsible Email Engagement ═══ */}
            <EmailEngagementCard activities={activities} contacts={contacts} />

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
                                                    act.type === 'EMAIL_DELIVERED' ? 'bg-green-100 text-green-600' :
                                                    act.type === 'EMAIL_OPENED' ? 'bg-violet-100 text-violet-600' :
                                                    act.type === 'EMAIL_CLICKED' ? 'bg-amber-100 text-amber-600' :
                                                    act.type === 'EMAIL_BOUNCED' ? 'bg-red-100 text-red-600' :
                                                    act.type === 'EMAIL_COMPLAINED' ? 'bg-red-100 text-red-600' :
                                                    'bg-muted text-muted-foreground'
                                                }`}>
                                                    {act.type === 'OUTREACH_SENT' ? <Send className="w-3.5 h-3.5" /> :
                                                        act.type === 'OUTREACH_FAILED' ? <XCircle className="w-3.5 h-3.5" /> :
                                                        act.type === 'SEQUENCE_STARTED' ? <Play className="w-3.5 h-3.5" /> :
                                                        act.type === 'EMAIL_DELIVERED' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                                        act.type === 'EMAIL_OPENED' ? <MailOpen className="w-3.5 h-3.5" /> :
                                                        act.type === 'EMAIL_CLICKED' ? <MousePointerClick className="w-3.5 h-3.5" /> :
                                                        act.type === 'EMAIL_BOUNCED' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                                        act.type === 'EMAIL_COMPLAINED' ? <AlertTriangle className="w-3.5 h-3.5" /> :
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
            <LeadDetailDrawer
                leadId={drawerContactId}
                open={!!drawerContactId}
                onClose={() => setDrawerContactId(null)}
            />
        </div>
    );
}
