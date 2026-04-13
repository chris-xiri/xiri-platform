'use client';

import { useState, useMemo, useCallback } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LeadList from '@/components/LeadList';
import { AddLeadDialog } from '@/components/AddLeadDialog';
import LeadDetailDrawer from '@/components/lead/LeadDetailDrawer';
import ProspectorPanel from '@/components/ProspectorPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Plus, Radar, ChevronDown, ChevronUp, ArrowRight, XCircle,
    Users, Mail, MailOpen, MousePointerClick, TrendingUp, AlertTriangle, X,
} from 'lucide-react';
import type { ContactRow } from '@/components/LeadList/LeadRow';
import type { EngagementFilter } from '@/components/LeadList';

/* ───────── Funnel Helper ─────────────────────────────────────────────── */

interface LeadFunnel {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
}

function computeLeadFunnel(contacts: ContactRow[]): LeadFunnel {
    const data: LeadFunnel = { total: contacts.length, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    for (const c of contacts) {
        if (c.unsubscribed) data.unsubscribed++;
        const eng = c.emailEngagement;
        if (!eng?.lastEvent) continue;
        data.sent++;
        switch (eng.lastEvent) {
            case 'clicked':
                data.clicked++;
                data.opened++;
                data.delivered++;
                break;
            case 'opened':
                data.opened++;
                data.delivered++;
                break;
            case 'delivered':
                data.delivered++;
                break;
            case 'bounced':
            case 'spam':
                data.bounced++;
                break;
        }
    }
    return data;
}

function pct(n: number, d: number): string {
    return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

const ENGAGEMENT_LABELS: Record<NonNullable<EngagementFilter>, string> = {
    clicked: 'Clicked',
    opened: 'Opened (includes clicked)',
    delivered: 'Delivered (includes opened & clicked)',
    bounced: 'Bounced / Spam',
};

/* ───────── Page Component ────────────────────────────────────────────── */

export default function SalesCRMPage() {
    const [showAddLead, setShowAddLead] = useState(false);
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [showProspector, setShowProspector] = useState(false);
    const [funnelCollapsed, setFunnelCollapsed] = useState(true);
    const [contactsData, setContactsData] = useState<ContactRow[]>([]);
    const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>(null);

    const handleContactsLoaded = useCallback((contacts: ContactRow[]) => {
        setContactsData(contacts);
    }, []);

    const funnel = useMemo(() => computeLeadFunnel(contactsData), [contactsData]);

    // Toggle engagement filter — clicking the same segment twice clears it
    const handleEngagementClick = (filter: NonNullable<EngagementFilter>) => {
        setEngagementFilter(prev => prev === filter ? null : filter);
        // Auto-expand funnel if collapsed so user can see their selection
        setFunnelCollapsed(false);
    };

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
                {/* ─── Header ────────────────────────────────────────────── */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b bg-card">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Sales CRM</h1>
                            <p className="text-sm text-muted-foreground">
                                {contactsData.length} contacts • Email engagement funnel + pipeline
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showProspector ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => setShowProspector(!showProspector)}
                            >
                                <Radar className="w-3 h-3" />
                                Prospector
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => setFunnelCollapsed(prev => !prev)}
                            >
                                {funnelCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                {funnelCollapsed ? 'Show Funnel' : 'Hide Funnel'}
                            </Button>
                            <Button onClick={() => setShowAddLead(true)} className="gap-2" size="sm">
                                <Plus className="w-4 h-4" />
                                Add Contact
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Prospector dropdown panel ─────────────────────────── */}
                {showProspector && (
                    <div className="flex-shrink-0 border-b bg-muted/10 max-h-[50vh] overflow-auto">
                        <div className="p-3">
                            <ProspectorPanel
                                isOpen={showProspector}
                                onClose={() => setShowProspector(false)}
                            />
                        </div>
                    </div>
                )}

                {/* ─── Collapsible Email Engagement Funnel ────────────────── */}
                {!funnelCollapsed && (
                    <div className="flex-shrink-0 px-4 sm:px-6 py-4 space-y-4 border-b bg-muted/20">
                        {/* Stat Cards — clickable to filter */}
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                            {/* Total Contacts — clears the filter */}
                            <Card
                                onClick={() => setEngagementFilter(null)}
                                className={`shadow-none border cursor-pointer transition-all hover:shadow-sm hover:border-primary/40 active:scale-[.98]
                                    ${engagementFilter === null ? 'ring-2 ring-primary/30 border-primary/40' : ''}`}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Contacts</p>
                                            <p className="text-xl font-bold">{funnel.total}</p>
                                        </div>
                                        <Users className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Opened */}
                            <Card
                                onClick={() => handleEngagementClick('opened')}
                                title="Click to filter: contacts who opened"
                                className={`shadow-none border cursor-pointer transition-all hover:shadow-sm hover:border-amber-400/60 active:scale-[.98]
                                    ${engagementFilter === 'opened' ? 'ring-2 ring-amber-400/50 border-amber-400/60 bg-amber-50/30' : ''}`}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Open Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.opened, funnel.delivered || 1)}</p>
                                            <p className="text-xs text-amber-600 font-medium mt-0.5 tabular-nums">{funnel.opened} contacts</p>
                                        </div>
                                        <MailOpen className="w-5 h-5 text-amber-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Clicked */}
                            <Card
                                onClick={() => handleEngagementClick('clicked')}
                                title="Click to filter: contacts who clicked"
                                className={`shadow-none border cursor-pointer transition-all hover:shadow-sm hover:border-emerald-400/60 active:scale-[.98]
                                    ${engagementFilter === 'clicked' ? 'ring-2 ring-emerald-400/50 border-emerald-400/60 bg-emerald-50/30' : ''}`}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Click Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.clicked, funnel.delivered || 1)}</p>
                                            <p className="text-xs text-emerald-600 font-medium mt-0.5 tabular-nums">{funnel.clicked} contacts</p>
                                        </div>
                                        <MousePointerClick className="w-5 h-5 text-emerald-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Delivery Rate */}
                            <Card
                                onClick={() => handleEngagementClick('delivered')}
                                title="Click to filter: contacts who were delivered to"
                                className={`shadow-none border cursor-pointer transition-all hover:shadow-sm hover:border-sky-400/60 active:scale-[.98]
                                    ${engagementFilter === 'delivered' ? 'ring-2 ring-sky-400/50 border-sky-400/60 bg-sky-50/30' : ''}`}
                            >
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Delivery Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.delivered, funnel.sent || 1)}</p>
                                            <p className="text-xs text-sky-600 font-medium mt-0.5 tabular-nums">{funnel.delivered} contacts</p>
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-sky-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Funnel Mini Bar — each step is clickable */}
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                            {([
                                { label: 'Sent', count: funnel.sent, color: 'bg-sky-500', filter: null as EngagementFilter },
                                { label: 'Delivered', count: funnel.delivered, color: 'bg-green-500', filter: 'delivered' as EngagementFilter },
                                { label: 'Opened', count: funnel.opened, color: 'bg-amber-500', filter: 'opened' as EngagementFilter },
                                { label: 'Clicked', count: funnel.clicked, color: 'bg-emerald-600', filter: 'clicked' as EngagementFilter },
                            ] as const).map((step, i, arr) => {
                                const isActive = engagementFilter === step.filter;
                                return (
                                    <div key={step.label} className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => step.filter ? handleEngagementClick(step.filter) : setEngagementFilter(null)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all
                                                ${isActive
                                                    ? 'bg-foreground/10 ring-1 ring-foreground/20 font-semibold'
                                                    : 'hover:bg-foreground/5'
                                                }`}
                                        >
                                            <div className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                                            <span className="text-muted-foreground">{step.label}</span>
                                            <span className="font-bold tabular-nums">{step.count}</span>
                                        </button>
                                        {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-1" />}
                                    </div>
                                );
                            })}
                            {funnel.bounced > 0 && (
                                <button
                                    onClick={() => handleEngagementClick('bounced')}
                                    className={`flex items-center gap-1 ml-2 px-2 py-1 rounded-full transition-all
                                        ${engagementFilter === 'bounced'
                                            ? 'bg-red-100 ring-1 ring-red-300 font-semibold text-red-600'
                                            : 'text-red-500 hover:bg-red-50'
                                        }`}
                                >
                                    <XCircle className="w-3 h-3" /> {funnel.bounced} bounced
                                </button>
                            )}
                            {funnel.unsubscribed > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-orange-500">
                                    <AlertTriangle className="w-3 h-3" /> {funnel.unsubscribed} unsubscribed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Active Engagement Filter Banner ────────────────────── */}
                {engagementFilter && (
                    <div className="flex-shrink-0 px-4 sm:px-6 py-2 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                        <p className="text-xs text-primary font-medium">
                            Filtering by: <span className="font-bold">{ENGAGEMENT_LABELS[engagementFilter]}</span>
                        </p>
                        <button
                            onClick={() => setEngagementFilter(null)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-3 h-3" /> Clear filter
                        </button>
                    </div>
                )}

                {/* ─── Pipeline Table ─────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden px-4 sm:px-6 py-2">
                    <LeadList
                        title="Sales Pipeline"
                        onRowClick={(contactId) => setDrawerContactId(contactId)}
                        onContactsLoaded={handleContactsLoaded}
                        engagementFilter={engagementFilter}
                    />
                </div>
            </div>

            <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} />

            <LeadDetailDrawer
                leadId={drawerContactId}
                open={!!drawerContactId}
                onClose={() => setDrawerContactId(null)}
            />
        </ProtectedRoute>
    );
}
