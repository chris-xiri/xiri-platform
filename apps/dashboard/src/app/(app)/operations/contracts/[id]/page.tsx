'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, DollarSign, Calendar, MapPin, User, Clock, Building2, Printer, Eye, EyeOff, History, ChevronRight, Pencil, Check, X } from 'lucide-react';
import ContractPreview from '@/components/ContractPreview';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

const STATUS_BADGE: Record<string, { variant: any; label: string; color: string }> = {
    draft: { variant: 'secondary', label: 'Draft', color: 'text-gray-500' },
    active: { variant: 'outline', label: 'Active', color: 'text-green-600' },
    amended: { variant: 'default', label: 'Amended', color: 'text-blue-600' },
    superseded: { variant: 'secondary', label: 'Superseded', color: 'text-gray-400' },
    terminated: { variant: 'destructive', label: 'Terminated', color: 'text-red-600' },
    expired: { variant: 'secondary', label: 'Expired', color: 'text-gray-500' },
};

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (d: any): string => {
    if (!d) return '—';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ContractDetailPage() {
    const params = useParams();
    const router = useRouter();
    const contractId = params.id as string;

    const [contract, setContract] = useState<any>(null);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [lead, setLead] = useState<any>(null);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [linkedQuotes, setLinkedQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [editingEntity, setEditingEntity] = useState(false);
    const [entityName, setEntityName] = useState('');
    const [entityAddress, setEntityAddress] = useState('');
    const [signerName, setSignerName] = useState('');
    const [signerTitle, setSignerTitle] = useState('');
    const [signerEmail, setSignerEmail] = useState('');
    const [signerPhone, setSignerPhone] = useState('');
    const [savingEntity, setSavingEntity] = useState(false);

    useEffect(() => {
        if (!contractId) return;

        async function fetchData() {
            try {
                // Fetch contract
                const contractDoc = await getDoc(doc(db, 'contracts', contractId));
                if (!contractDoc.exists()) {
                    setLoading(false);
                    return;
                }
                const contractData: any = { id: contractDoc.id, ...contractDoc.data() };
                setContract(contractData);

                // Fetch related work orders (try contractId first, then fall back to leadId)
                let woSnap = await getDocs(query(
                    collection(db, 'work_orders'),
                    where('contractId', '==', contractId),
                    orderBy('createdAt', 'desc'),
                ));
                let woData = woSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Fall back: match by leadId if no work orders found by contractId
                if (woData.length === 0 && contractData.leadId) {
                    const woByLead = await getDocs(query(
                        collection(db, 'work_orders'),
                        where('leadId', '==', contractData.leadId),
                        orderBy('createdAt', 'desc'),
                    ));
                    woData = woByLead.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                setWorkOrders(woData);

                // Fetch lead info
                const leadId = contractData.leadId;
                if (leadId) {
                    const leadDoc = await getDoc(doc(db, 'leads', leadId));
                    if (leadDoc.exists()) {
                        setLead({ id: leadDoc.id, ...leadDoc.data() });
                    }
                }

                // Fetch activity logs for this contract
                try {
                    const logsSnap = await getDocs(query(
                        collection(db, 'activity_logs'),
                        where('contractId', '==', contractId),
                        orderBy('createdAt', 'desc'),
                    ));
                    setActivityLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                } catch { setActivityLogs([]); }

                // Fetch linked quotes (versions)
                const quoteIds = contractData.quoteIds || (contractData.quoteId ? [contractData.quoteId] : []);
                if (quoteIds.length > 0) {
                    const quoteDocs = await Promise.all(
                        quoteIds.map((qid: string) => getDoc(doc(db, 'quotes', qid)))
                    );
                    setLinkedQuotes(
                        quoteDocs
                            .filter(d => d.exists())
                            .map(d => ({ id: d.id, ...d.data() }))
                            .sort((a: any, b: any) => (b.version || 1) - (a.version || 1))
                    );
                }
            } catch (err) {
                console.error('Error fetching contract:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [contractId]);

    if (loading) return <div className="p-8 flex justify-center">Loading contract...</div>;
    if (!contract) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Contract not found</h2>
                <p className="text-muted-foreground mb-4">The contract ID may be invalid.</p>
                <Button variant="outline" onClick={() => router.push('/operations/contracts')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contracts
                </Button>
            </div>
        );
    }

    const badge = STATUS_BADGE[contract.status] || STATUS_BADGE.draft;
    const monthlyRate = contract.totalMonthlyRate || contract.monthlyRate || 0;
    const oneTimeCharges = (contract as any).oneTimeCharges || 0;
    const tenure = contract.contractTenure || contract.tenure || 0;
    const acv = (monthlyRate * 12) + oneTimeCharges;
    const tcv = (monthlyRate * tenure) + oneTimeCharges;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/operations/contracts')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">
                            {contract.formalEntityName || contract.clientBusinessName || contract.clientName || 'Contract'}
                        </h1>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {contract.formalEntityName && contract.clientBusinessName && (
                            <span className="mr-2">DBA: {contract.clientBusinessName}</span>
                        )}
                        Contract ID: {contract.id}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPreview(!showPreview)}>
                        {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showPreview ? 'Hide Contract' : 'View Contract'}
                    </Button>
                    {showPreview && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                            <Printer className="w-4 h-4" /> Print
                        </Button>
                    )}
                </div>
            </div>

            {/* Contract Party Details — editable pre-send review */}
            <Card className="border-amber-200 bg-amber-50/30">
                <CardContent className="pt-4 pb-4">
                    {editingEntity ? (
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Contract Party Details (review before sending)</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Formal Entity Name</label>
                                    <Input
                                        value={entityName}
                                        onChange={(e) => setEntityName(e.target.value)}
                                        placeholder="e.g. XYZ Medical Group, LLC"
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Entity Address</label>
                                    <Input
                                        value={entityAddress}
                                        onChange={(e) => setEntityAddress(e.target.value)}
                                        placeholder="123 Main St, Suite 100, Dallas, TX 75001"
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Signer Name</label>
                                    <Input
                                        value={signerName}
                                        onChange={(e) => setSignerName(e.target.value)}
                                        placeholder="John Smith"
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Signer Title / Designation</label>
                                    <Input
                                        value={signerTitle}
                                        onChange={(e) => setSignerTitle(e.target.value)}
                                        placeholder="Office Manager"
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Signer Email</label>
                                    <Input
                                        value={signerEmail}
                                        onChange={(e) => setSignerEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        className="bg-white"
                                        type="email"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Signer Phone</label>
                                    <Input
                                        value={signerPhone}
                                        onChange={(e) => setSignerPhone(e.target.value)}
                                        placeholder="(214) 555-1234"
                                        className="bg-white"
                                        type="tel"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={savingEntity}
                                    onClick={async () => {
                                        setSavingEntity(true);
                                        try {
                                            await updateDoc(doc(db, 'contracts', contractId), {
                                                formalEntityName: entityName.trim() || null,
                                                formalEntityAddress: entityAddress.trim() || null,
                                                signerName: signerName.trim(),
                                                signerTitle: signerTitle.trim(),
                                                signerEmail: signerEmail.trim() || null,
                                                signerPhone: signerPhone.trim() || null,
                                                updatedAt: serverTimestamp(),
                                            });
                                            setContract({
                                                ...contract,
                                                formalEntityName: entityName.trim() || null,
                                                formalEntityAddress: entityAddress.trim() || null,
                                                signerName: signerName.trim(),
                                                signerTitle: signerTitle.trim(),
                                                signerEmail: signerEmail.trim() || null,
                                                signerPhone: signerPhone.trim() || null,
                                            });
                                            setEditingEntity(false);
                                        } catch (err) {
                                            console.error('Error saving entity:', err);
                                        } finally {
                                            setSavingEntity(false);
                                        }
                                    }}
                                >
                                    <Check className="w-3.5 h-3.5" /> Save
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditingEntity(false)}>
                                    <X className="w-3.5 h-3.5" /> Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Contract Party</p>
                                {contract.formalEntityName ? (
                                    <p className="font-semibold text-sm">{contract.formalEntityName}</p>
                                ) : (
                                    <p className="text-sm text-amber-700">⚠ Set the legal entity name before sending</p>
                                )}
                                {contract.formalEntityAddress && <p className="text-xs text-muted-foreground">{contract.formalEntityAddress}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Signer: {contract.signerName || '—'} • {contract.signerTitle || '—'}
                                    {contract.signerEmail && <span> • {contract.signerEmail}</span>}
                                    {contract.signerPhone && <span> • {contract.signerPhone}</span>}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                    setEntityName(contract.formalEntityName || contract.clientBusinessName || '');
                                    setEntityAddress(contract.formalEntityAddress || contract.clientAddress || '');
                                    setSignerName(contract.signerName || '');
                                    setSignerTitle(contract.signerTitle || '');
                                    setSignerEmail(contract.signerEmail || '');
                                    setSignerPhone(contract.signerPhone || '');
                                    setEditingEntity(true);
                                }}
                            >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Contract Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-500" />
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(monthlyRate)}</p>
                                <p className="text-xs text-muted-foreground">Monthly Rate</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">{tenure} mo</p>
                                <p className="text-xs text-muted-foreground">Contract Term</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-500" />
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(acv)}</p>
                                <p className="text-xs text-muted-foreground">Annual Contract Value</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-500" />
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(tcv)}</p>
                                <p className="text-xs text-muted-foreground">Total Contract Value</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Contract Details */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="w-4 h-4" /> Contract Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Start Date</span>
                            <span className="font-medium">{formatDate(contract.startDate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">End Date</span>
                            <span className="font-medium">{formatDate(contract.endDate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Payment Terms</span>
                            <span className="font-medium">{contract.paymentTerms || 'Net 30'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Exit Clause</span>
                            <span className="font-medium">{contract.exitClause || '30-day notice'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Created</span>
                            <span className="font-medium">{formatDate(contract.createdAt)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Client Info from Lead */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="w-4 h-4" /> Client Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Business Name</span>
                            <span className="font-medium">{contract.clientBusinessName || contract.clientName || '—'}</span>
                        </div>
                        {lead && (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Contact</span>
                                    <span className="font-medium">{lead.contactName || lead.name || '—'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="font-medium">{lead.email || lead.contactEmail || '—'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Phone</span>
                                    <span className="font-medium">{lead.phone || lead.contactPhone || '—'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Address</span>
                                    <span className="font-medium text-right max-w-[60%]">{lead.address || '—'}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Contract Preview */}
            {showPreview && (
                <ContractPreview contract={contract} lead={lead} workOrders={workOrders} />
            )}

            {/* Contract History & Versions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Activity Timeline */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <History className="w-4 h-4" /> Contract History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activityLogs.length === 0 ? (
                            <div className="space-y-3">
                                {/* Always show creation event from contract itself */}
                                <div className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5" />
                                        <div className="w-0.5 flex-1 bg-border" />
                                    </div>
                                    <div className="pb-4">
                                        <p className="text-sm font-medium">Contract Created</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(contract.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {activityLogs.map((log, idx) => {
                                    const isLast = idx === activityLogs.length - 1;
                                    let icon = '🔵';
                                    let color = 'bg-blue-500';
                                    let title = log.type?.replace(/_/g, ' ') || 'Event';
                                    let detail = '';

                                    if (log.type === 'CONTRACT_AMENDED') {
                                        icon = '📝'; color = 'bg-blue-500';
                                        title = 'Contract Amended';
                                        const parts = [];
                                        if (log.newServicesCount > 0) parts.push(`+${log.newServicesCount} added`);
                                        if (log.cancelledServicesCount > 0) parts.push(`${log.cancelledServicesCount} cancelled`);
                                        if (log.modifiedServicesCount > 0) parts.push(`${log.modifiedServicesCount} modified`);
                                        detail = parts.join(', ') || 'Services updated';
                                    } else if (log.type === 'QUOTE_ACCEPTED') {
                                        icon = '✅'; color = 'bg-green-500';
                                        title = log.isAmendment ? 'Quote Revision Accepted' : 'Quote Accepted';
                                        detail = `${log.workOrderCount || 0} work orders created`;
                                    } else if (log.type === 'CONTRACT_SIGNED') {
                                        icon = '✍️'; color = 'bg-purple-500';
                                        title = 'Contract Signed';
                                    } else if (log.type === 'CONTRACT_TERMINATED') {
                                        icon = '🚫'; color = 'bg-red-500';
                                        title = 'Contract Terminated';
                                    }

                                    return (
                                        <div key={log.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-2.5 h-2.5 rounded-full ${color} mt-1.5`} />
                                                {!isLast && <div className="w-0.5 flex-1 bg-border" />}
                                            </div>
                                            <div className={isLast ? '' : 'pb-4'}>
                                                <p className="text-sm font-medium">{title}</p>
                                                {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                                                <p className="text-[10px] text-muted-foreground/60">{formatDate(log.createdAt)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Linked Quote Versions */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="w-4 h-4" /> Quote Versions ({linkedQuotes.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {linkedQuotes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No linked quotes found.</p>
                        ) : (
                            <div className="space-y-2">
                                {linkedQuotes.map((q: any) => {
                                    const qBadge = STATUS_BADGE[q.status] || STATUS_BADGE.draft;
                                    return (
                                        <div
                                            key={q.id}
                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/sales/quotes/${q.id}`)}
                                        >
                                            <div>
                                                <p className="text-sm font-medium">Version {q.version || 1}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {q.lineItems?.length || 0} services — {formatCurrency(q.totalMonthlyRate)}/mo
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={qBadge.variant} className="text-xs">{qBadge.label}</Badge>
                                                <span className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
