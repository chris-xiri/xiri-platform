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
    Users, Mail, MailOpen, MousePointerClick, TrendingUp, AlertTriangle, Send
} from 'lucide-react';
import type { ContactRow } from '@/components/LeadList/LeadRow';

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
                data.bounced++;
                break;
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

/* ───────── Page Component ────────────────────────────────────────────── */

export default function SalesCRMPage() {
    const [showAddLead, setShowAddLead] = useState(false);
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [showProspector, setShowProspector] = useState(false);
    const [funnelCollapsed, setFunnelCollapsed] = useState(true);
    const [contactsData, setContactsData] = useState<ContactRow[]>([]);

    const handleContactsLoaded = useCallback((contacts: ContactRow[]) => {
        setContactsData(contacts);
    }, []);

    const funnel = useMemo(() => computeLeadFunnel(contactsData), [contactsData]);

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
                        {/* Stat Cards */}
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                            <Card className="shadow-none border">
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
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Open Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.opened, funnel.delivered || 1)}</p>
                                        </div>
                                        <MailOpen className="w-5 h-5 text-amber-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Click Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.clicked, funnel.delivered || 1)}</p>
                                        </div>
                                        <MousePointerClick className="w-5 h-5 text-emerald-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Delivery Rate</p>
                                            <p className="text-xl font-bold">{pct(funnel.delivered, funnel.sent || 1)}</p>
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-sky-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Funnel Mini Bar */}
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                            {[
                                { label: 'Sent', count: funnel.sent, color: 'bg-sky-500' },
                                { label: 'Delivered', count: funnel.delivered, color: 'bg-green-500' },
                                { label: 'Opened', count: funnel.opened, color: 'bg-amber-500' },
                                { label: 'Clicked', count: funnel.clicked, color: 'bg-emerald-600' },
                            ].map((step, i, arr) => (
                                <div key={step.label} className="flex items-center gap-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                                    <span className="text-muted-foreground">{step.label}</span>
                                    <span className="font-bold tabular-nums">{step.count}</span>
                                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-1" />}
                                </div>
                            ))}
                            {funnel.bounced > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-red-500">
                                    <XCircle className="w-3 h-3" /> {funnel.bounced} bounced
                                </div>
                            )}
                            {funnel.unsubscribed > 0 && (
                                <div className="flex items-center gap-1 ml-2 text-orange-500">
                                    <AlertTriangle className="w-3 h-3" /> {funnel.unsubscribed} unsubscribed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Pipeline Table ─────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden px-4 sm:px-6 py-2">
                    <LeadList
                        title="Sales Pipeline"
                        onRowClick={(contactId) => setDrawerContactId(contactId)}
                        onContactsLoaded={handleContactsLoaded}
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
