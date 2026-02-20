'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Quote, QuoteLineItem, QuoteRevision } from '@xiri/shared';
import { SCOPE_TEMPLATES } from '@/data/scopeTemplates';
import QuoteBuilder from '@/components/QuoteBuilder';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Check, X, Printer, FileText, MapPin, Plus,
    DollarSign, Calendar, Clock, Building2, AlertTriangle,
    Send, Eye, MessageSquare, Mail, UserRoundCheck, RotateCcw, History
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    accepted: { variant: 'outline', label: 'Accepted' },
    rejected: { variant: 'destructive', label: 'Rejected' },
    expired: { variant: 'secondary', label: 'Expired' },
};

interface FsmUser {
    uid: string;
    displayName: string;
    email: string;
}

export default function QuoteDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const [quote, setQuote] = useState<(Quote & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [converting, setConverting] = useState(false);

    // Send-to-client state
    const [showSendModal, setShowSendModal] = useState(false);
    const [clientEmail, setClientEmail] = useState('');
    const [clientName, setClientName] = useState('');
    const [sending, setSending] = useState(false);

    // FSM assignment state
    const [fsmUsers, setFsmUsers] = useState<FsmUser[]>([]);
    const [showFsmDropdown, setShowFsmDropdown] = useState(false);

    // Revision state
    const [revising, setRevising] = useState(false);
    const [showReviseBuilder, setShowReviseBuilder] = useState(false);

    // Work orders state
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    useEffect(() => {
        async function fetchQuote() {
            try {
                const docSnap = await getDoc(doc(db, 'quotes', params.id));
                if (docSnap.exists()) {
                    setQuote({ id: docSnap.id, ...docSnap.data() } as Quote & { id: string });
                }
            } catch (err) {
                console.error('Error fetching quote:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchQuote();
    }, [params.id]);

    // Fetch related work orders
    useEffect(() => {
        if (!quote?.lineItems?.length) return;
        async function fetchWorkOrders() {
            try {
                const lineItemIds = quote!.lineItems.map(li => li.id);
                // Firestore 'in' queries limited to 30, chunk if needed
                const chunks = [];
                for (let i = 0; i < lineItemIds.length; i += 30) {
                    chunks.push(lineItemIds.slice(i, i + 30));
                }
                const allWos: any[] = [];
                for (const chunk of chunks) {
                    const woSnap = await getDocs(query(
                        collection(db, 'work_orders'),
                        where('quoteLineItemId', 'in', chunk),
                    ));
                    woSnap.docs.forEach(d => allWos.push({ id: d.id, ...d.data() }));
                }
                setWorkOrders(allWos);
            } catch (err) {
                console.error('Error fetching work orders:', err);
            }
        }
        fetchWorkOrders();
    }, [quote?.lineItems]);

    // Fetch FSM users for dropdown
    useEffect(() => {
        async function fetchFsmUsers() {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const fsms: FsmUser[] = [];
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.roles?.includes('fsm') || data.roles?.includes('admin')) {
                        fsms.push({ uid: d.id, displayName: data.displayName, email: data.email });
                    }
                });
                setFsmUsers(fsms);
            } catch (err) {
                console.error('Error fetching FSM users:', err);
            }
        }
        fetchFsmUsers();
    }, []);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formatFrequency = (freq: string, daysOfWeek?: boolean[]) => {
        if (freq === 'custom_days' && daysOfWeek) {
            const days = daysOfWeek.map((on, i) => on ? DAY_NAMES[i] : null).filter(Boolean);
            // Check common patterns
            const monFri = [false, true, true, true, true, true, false];
            if (JSON.stringify(daysOfWeek) === JSON.stringify(monFri)) return 'Mon–Fri';
            return days.join(', ') || 'Custom';
        }
        const labels: Record<string, string> = {
            nightly: 'Nightly', weekly: 'Weekly', biweekly: 'Bi-Weekly',
            monthly: 'Monthly', quarterly: 'Quarterly', custom_days: 'Custom',
        };
        return labels[freq] || freq;
    };

    const handleSendToClient = async () => {
        if (!quote || !clientEmail) return;
        setSending(true);
        try {
            const functions = getFunctions();
            const sendQuoteEmailFn = httpsCallable(functions, 'sendQuoteEmail');
            await sendQuoteEmailFn({ quoteId: quote.id, clientEmail, clientName });

            setQuote({ ...quote, status: 'sent', clientEmail, sentAt: new Date() });
            setShowSendModal(false);
        } catch (err) {
            console.error('Error sending quote email:', err);
            alert('Failed to send email. Check console for details.');
        } finally {
            setSending(false);
        }
    };

    const handleAssignFsm = async (fsm: FsmUser) => {
        if (!quote) return;
        try {
            await updateDoc(doc(db, 'quotes', quote.id), {
                assignedFsmId: fsm.uid,
                assignedFsmName: fsm.displayName,
                updatedAt: serverTimestamp(),
            });
            // Also update the lead
            await updateDoc(doc(db, 'leads', quote.leadId), {
                assignedFsmId: fsm.uid,
            });

            // Cascade to existing contracts for this lead
            const contractSnap = await getDocs(query(
                collection(db, 'contracts'),
                where('leadId', '==', quote.leadId)
            ));
            for (const contractDoc of contractSnap.docs) {
                await updateDoc(doc(db, 'contracts', contractDoc.id), {
                    assignedFsmId: fsm.uid,
                    assignedFsmName: fsm.displayName,
                    updatedAt: serverTimestamp(),
                });
            }

            // Cascade to existing work orders for this lead
            const woSnap = await getDocs(query(
                collection(db, 'work_orders'),
                where('leadId', '==', quote.leadId)
            ));
            for (const woDoc of woSnap.docs) {
                await updateDoc(doc(db, 'work_orders', woDoc.id), {
                    assignedFsmId: fsm.uid,
                    updatedAt: serverTimestamp(),
                });
            }

            setQuote({ ...quote, assignedFsmId: fsm.uid, assignedFsmName: fsm.displayName });
            setShowFsmDropdown(false);

            await addDoc(collection(db, 'activity_logs'), {
                type: 'FSM_ASSIGNED',
                quoteId: quote.id,
                leadId: quote.leadId,
                fsmId: fsm.uid,
                fsmName: fsm.displayName,
                assignedBy: profile?.uid || 'unknown',
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Error assigning FSM:', err);
        }
    };

    const handleAccept = async () => {
        if (!quote || !profile) return;
        setConverting(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const now = new Date();

            // Categorize line items by status
            const pendingItems = (quote.lineItems || []).filter(
                (li: QuoteLineItem) => !li.lineItemStatus || li.lineItemStatus === 'pending'
            );
            const cancelledItems = (quote.lineItems || []).filter(
                (li: QuoteLineItem) => li.lineItemStatus === 'cancelled'
            );
            const modifiedItems = (quote.lineItems || []).filter(
                (li: QuoteLineItem) => li.lineItemStatus === 'modified'
            );

            if (pendingItems.length === 0 && cancelledItems.length === 0 && modifiedItems.length === 0) {
                alert('No changes to process. All line items are unchanged.');
                setConverting(false);
                return;
            }

            // Check for existing contract for this lead
            const contractQuery = await getDocs(query(
                collection(db, 'contracts'),
                where('leadId', '==', quote.leadId),
                where('status', 'in', ['active', 'draft', 'amended'])
            ));

            let contractId: string;
            const acceptedItems = pendingItems.map(item => ({
                ...item,
                lineItemStatus: 'accepted' as const,
                acceptedInVersion: quote.version,
            }));

            if (contractQuery.docs.length > 0) {
                // ─── AMEND existing contract ────────────────────────────
                const existingContract = contractQuery.docs[0];
                contractId = existingContract.id;
                const existingData = existingContract.data();
                let existingLineItems: QuoteLineItem[] = existingData.lineItems || [];
                const existingQuoteIds = existingData.quoteIds || [existingData.quoteId];
                let currentRate = existingData.totalMonthlyRate || 0;

                // Process CANCELLED items: remove from contract + terminate work orders
                for (const cancelled of cancelledItems) {
                    // Remove from contract line items
                    existingLineItems = existingLineItems.filter(li => li.id !== cancelled.id);
                    currentRate -= (cancelled.clientRate || 0);

                    // Find and terminate matching work order
                    const woQuery = await getDocs(query(
                        collection(db, 'work_orders'),
                        where('contractId', '==', contractId),
                        where('quoteLineItemId', '==', cancelled.id)
                    ));
                    for (const woDoc of woQuery.docs) {
                        await updateDoc(doc(db, 'work_orders', woDoc.id), {
                            status: 'terminated',
                            terminatedAt: serverTimestamp(),
                            terminatedBy: userId,
                            terminationReason: 'Service cancelled by client via quote revision',
                            updatedAt: serverTimestamp(),
                        });
                    }
                }

                // Process MODIFIED items: update contract line items + work orders
                for (const modified of modifiedItems) {
                    const oldItem = existingLineItems.find(li => li.id === modified.id);
                    if (oldItem) {
                        // Adjust rate difference
                        currentRate = currentRate - (oldItem.clientRate || 0) + (modified.clientRate || 0);
                        // Replace the old version with the modified one
                        existingLineItems = existingLineItems.map(li =>
                            li.id === modified.id
                                ? { ...modified, lineItemStatus: 'accepted' as const, modifiedInVersion: quote.version }
                                : li
                        );
                    }

                    // Update matching work order
                    const woQuery = await getDocs(query(
                        collection(db, 'work_orders'),
                        where('contractId', '==', contractId),
                        where('quoteLineItemId', '==', modified.id)
                    ));
                    for (const woDoc of woQuery.docs) {
                        await updateDoc(doc(db, 'work_orders', woDoc.id), {
                            clientRate: modified.clientRate,
                            schedule: {
                                daysOfWeek: modified.daysOfWeek || [false, true, true, true, true, true, false],
                                frequency: modified.frequency,
                                startTime: woDoc.data().schedule?.startTime || '21:00',
                            },
                            updatedAt: serverTimestamp(),
                        });
                    }
                }

                // Add newly accepted items
                const newMonthlyRate = currentRate + pendingItems.reduce((s, li) => s + (li.clientRate || 0), 0);

                await updateDoc(doc(db, 'contracts', contractId), {
                    lineItems: [...existingLineItems, ...acceptedItems],
                    totalMonthlyRate: Math.max(newMonthlyRate, 0),
                    quoteIds: existingQuoteIds.includes(quote.id) ? existingQuoteIds : [...existingQuoteIds, quote.id],
                    status: 'amended',
                    // Ensure FSM assignment carries through from quote
                    ...(quote.assignedFsmId ? { assignedFsmId: quote.assignedFsmId, assignedFsmName: quote.assignedFsmName || '' } : {}),
                    updatedAt: serverTimestamp(),
                });

                await addDoc(collection(db, 'activity_logs'), {
                    type: 'CONTRACT_AMENDED',
                    contractId,
                    quoteId: quote.id,
                    leadId: quote.leadId,
                    newServicesCount: pendingItems.length,
                    cancelledServicesCount: cancelledItems.length,
                    modifiedServicesCount: modifiedItems.length,
                    newMonthlyRate: Math.max(newMonthlyRate, 0),
                    amendedBy: userId,
                    createdAt: serverTimestamp(),
                });
            } else {
                // ─── CREATE new contract ─────────────────────────────────
                const contractRef = await addDoc(collection(db, 'contracts'), {
                    leadId: quote.leadId,
                    quoteId: quote.id,
                    quoteIds: [quote.id],
                    clientBusinessName: quote.leadBusinessName,
                    clientAddress: '',
                    signerName: '',
                    signerTitle: '',
                    lineItems: acceptedItems,
                    totalMonthlyRate: quote.totalMonthlyRate,
                    contractTenure: quote.contractTenure,
                    startDate: serverTimestamp(),
                    endDate: new Date(now.getFullYear(), now.getMonth() + quote.contractTenure, now.getDate()),
                    paymentTerms: quote.paymentTerms,
                    exitClause: quote.exitClause || '30-day written notice',
                    status: 'active',
                    assignedFsmId: quote.assignedFsmId || null,
                    assignedFsmName: quote.assignedFsmName || null,
                    createdBy: userId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                contractId = contractRef.id;
            }

            // 2. Create Work Orders ONLY for newly accepted (pending) items
            for (const item of pendingItems) {
                const template = SCOPE_TEMPLATES.find(t => t.name.toLowerCase().includes(item.serviceType.toLowerCase()));
                const tasks = template
                    ? template.tasks.map((t, i) => ({ id: `task_${i}`, name: t.name, description: t.description, required: t.required }))
                    : [];

                await addDoc(collection(db, 'work_orders'), {
                    leadId: quote.leadId,
                    contractId,
                    quoteId: quote.id,
                    quoteLineItemId: item.id,
                    locationId: item.locationId,
                    locationName: item.locationName,
                    locationAddress: item.locationAddress || '',
                    locationCity: item.locationCity || '',
                    locationState: item.locationState || '',
                    locationZip: item.locationZip || '',
                    serviceType: item.serviceType,
                    scopeTemplateId: item.scopeTemplateId || null,
                    tasks,
                    vendorId: null,
                    vendorRate: null,
                    vendorHistory: [],
                    schedule: {
                        daysOfWeek: item.daysOfWeek || [false, true, true, true, true, true, false],
                        startTime: template?.defaultStartTime || '21:00',
                        frequency: item.frequency,
                    },
                    clientRate: item.clientRate,
                    margin: null,
                    status: 'pending_assignment',
                    assignedFsmId: quote.assignedFsmId || null,
                    createdBy: userId,
                    notes: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            // 3. Update quote — mark items with final statuses
            const updatedLineItems = (quote.lineItems || []).map((li: QuoteLineItem) => {
                if (li.lineItemStatus === 'cancelled') {
                    return { ...li }; // keep as cancelled for audit
                }
                if (li.lineItemStatus === 'modified') {
                    return { ...li, lineItemStatus: 'accepted' as const, modifiedInVersion: quote.version };
                }
                if (!li.lineItemStatus || li.lineItemStatus === 'pending') {
                    return { ...li, lineItemStatus: 'accepted' as const, acceptedInVersion: quote.version };
                }
                return li;
            });

            await updateDoc(doc(db, 'quotes', quote.id), {
                lineItems: updatedLineItems,
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 4. Update Lead status to 'won'
            await updateDoc(doc(db, 'leads', quote.leadId), {
                status: 'won',
                contractId,
                wonAt: serverTimestamp(),
            });

            // 5. Log activity
            await addDoc(collection(db, 'activity_logs'), {
                type: 'QUOTE_ACCEPTED',
                quoteId: quote.id,
                leadId: quote.leadId,
                contractId,
                workOrderCount: pendingItems.length,
                cancelledCount: cancelledItems.length,
                modifiedCount: modifiedItems.length,
                isAmendment: contractQuery.docs.length > 0,
                createdBy: userId,
                createdAt: serverTimestamp(),
            });

            setQuote({ ...quote, status: 'accepted', lineItems: updatedLineItems });
        } catch (err) {
            console.error('Error accepting quote:', err);
        } finally {
            setConverting(false);
        }
    };

    const handleReject = async () => {
        if (!quote || !profile) return;
        try {
            await updateDoc(doc(db, 'quotes', quote.id), {
                status: 'rejected',
                updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'leads', quote.leadId), {
                status: 'lost',
            });
            await addDoc(collection(db, 'activity_logs'), {
                type: 'QUOTE_REJECTED',
                quoteId: quote.id,
                leadId: quote.leadId,
                createdBy: profile.uid || profile.email || 'unknown',
                createdAt: serverTimestamp(),
            });
            setQuote({ ...quote, status: 'rejected' });
        } catch (err) {
            console.error('Error rejecting quote:', err);
        }
    };

    const handleRevise = () => {
        setShowReviseBuilder(true);
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!quote) return <div className="p-8 flex justify-center">Quote not found</div>;

    const badge = STATUS_BADGE[quote.status] || STATUS_BADGE.draft;

    // Group line items by location
    const locationMap = new Map<string, QuoteLineItem[]>();
    quote.lineItems?.forEach((item) => {
        const existing = locationMap.get(item.locationId) || [];
        existing.push(item);
        locationMap.set(item.locationId, existing);
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/sales/quotes" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            Quote for {quote.leadBusinessName}
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Created {quote.createdAt?.toDate?.()?.toLocaleDateString() || '—'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 items-center">
                    {(quote.status === 'draft' || quote.status === 'sent') && (
                        <>
                            <Button
                                variant="outline" size="sm"
                                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={handleReject}
                            >
                                <X className="w-4 h-4" /> Reject
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                className="gap-2 border-green-600/50 text-green-700 hover:bg-green-50"
                                onClick={handleAccept}
                                disabled={converting}
                            >
                                {converting ? 'Converting...' : <><Check className="w-4 h-4" /> Accept</>}
                            </Button>
                            <div className="w-px h-6 bg-border" />
                        </>
                    )}
                    {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'rejected' || quote.status === 'accepted') && (
                        <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleRevise} disabled={revising}>
                            <RotateCcw className="w-4 h-4" /> {revising ? 'Revising...' : 'Revise Quote'}
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                    {quote.version > 1 && (
                        <Badge variant="secondary" className="text-xs">v{quote.version}</Badge>
                    )}
                </div>
            </div>

            {/* Status Timeline + FSM Assignment */}
            <Card className="print:hidden">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        {/* Timeline */}
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-muted-foreground">Created</span>
                            </div>
                            <div className="w-8 h-px bg-border" />
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${quote.sentAt ? 'bg-green-500' : 'bg-muted'}`} />
                                <span className={quote.sentAt ? '' : 'text-muted-foreground'}>
                                    Sent {quote.sentAt ? (quote.sentAt?.toDate?.()?.toLocaleDateString() || '') : ''}
                                </span>
                            </div>
                            <div className="w-8 h-px bg-border" />
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${quote.viewedAt ? 'bg-green-500' : 'bg-muted'}`} />
                                <span className={quote.viewedAt ? '' : 'text-muted-foreground'}>Viewed</span>
                            </div>
                            <div className="w-8 h-px bg-border" />
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${quote.status === 'accepted' ? 'bg-green-500' : quote.status === 'rejected' ? 'bg-red-500' : 'bg-muted'}`} />
                                <span className={quote.clientResponseAt ? '' : 'text-muted-foreground'}>
                                    {quote.status === 'accepted' ? 'Accepted ✓' : quote.status === 'rejected' ? 'Rejected' : 'Response'}
                                </span>
                            </div>
                        </div>

                        {/* FSM Assignment */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setShowFsmDropdown(!showFsmDropdown)}
                            >
                                <UserRoundCheck className="w-4 h-4" />
                                {quote.assignedFsmName || 'Assign FSM'}
                            </Button>
                            {showFsmDropdown && (
                                <div className="absolute right-0 mt-1 w-56 bg-background border rounded-lg shadow-xl z-50 py-1">
                                    {fsmUsers.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3">No FSM users found</p>
                                    ) : (
                                        fsmUsers.map(fsm => (
                                            <button
                                                key={fsm.uid}
                                                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                                                onClick={() => handleAssignFsm(fsm)}
                                            >
                                                <span>{fsm.displayName}</span>
                                                {quote.assignedFsmId === fsm.uid && <Check className="w-4 h-4 text-green-600" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Client email info */}
                    {quote.clientEmail && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" /> Sent to {quote.clientEmail}
                            {quote.clientResponseNotes && (
                                <span className="ml-4 flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5" /> Client notes: "{quote.clientResponseNotes}"
                                </span>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quote Content (Print-friendly) */}
            <div className="print:shadow-none" id="quote-printable">
                {/* Company Header for print */}
                <div className="hidden print:block mb-8 border-b pb-4">
                    <h1 className="text-3xl font-bold text-sky-700">XIRI FACILITY SOLUTIONS</h1>
                    <p className="text-sm text-gray-600">Professional Facility Management</p>
                </div>

                {/* Client Info */}
                <Card className="print:border print:shadow-none">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Prepared For</p>
                                <p className="text-lg font-bold">{quote.leadBusinessName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Quote Total</p>
                                <p className="text-3xl font-bold text-primary">{formatCurrency(quote.totalMonthlyRate)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Service Breakdown by Location */}
                {Array.from(locationMap.entries()).map(([locId, items]) => (
                    <Card key={locId} className="print:border print:shadow-none">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <CardTitle className="text-base">{items[0]?.locationName}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground uppercase">
                                        <th className="text-left py-2 font-medium">Service</th>
                                        <th className="text-left py-2 font-medium">Frequency</th>
                                        <th className="text-left py-2 font-medium">Status</th>
                                        <th className="text-right py-2 font-medium">Monthly Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id} className="border-b last:border-0">
                                            <td className="py-3">
                                                <span className="font-medium">{item.serviceType}</span>
                                                {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                                                {item.isUpsell && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Upsell</span>}
                                            </td>
                                            <td className="py-3 text-sm">{formatFrequency(item.frequency, item.daysOfWeek)}</td>
                                            <td className="py-3 text-sm">
                                                {item.lineItemStatus === 'accepted' ? (
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">
                                                        <Check className="w-3 h-3" /> Accepted
                                                    </span>
                                                ) : item.lineItemStatus === 'rejected' ? (
                                                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-medium">
                                                        <X className="w-3 h-3" /> Rejected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium">
                                                        <Clock className="w-3 h-3" /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right font-medium">{formatCurrency(item.clientRate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t">
                                        <td colSpan={3} className="py-3 font-medium text-sm">Location Subtotal</td>
                                        <td className="py-3 text-right font-bold">
                                            {formatCurrency(items.reduce((s, i) => s + i.clientRate, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>
                ))}

                {/* Terms */}
                <Card className="print:border print:shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Contract Terms</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Tenure</p>
                            <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {quote.contractTenure} Months</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Payment Terms</p>
                            <p className="font-medium">{quote.paymentTerms}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Exit Clause</p>
                            <p className="font-medium">{quote.exitClause || 'N/A'}</p>
                        </div>
                    </CardContent>
                </Card>

                {quote.notes && (
                    <Card className="print:border print:shadow-none">
                        <CardContent className="p-6">
                            <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
                            <p className="text-sm">{quote.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Conversion Actions (hidden in print) */}
            {quote.status === 'accepted' && (
                <Card className="print:hidden border-green-600/30 bg-green-50 dark:bg-green-950/20">
                    <CardContent className="p-6 flex items-center gap-3">
                        <Check className="w-6 h-6 text-green-600" />
                        <div>
                            <h3 className="font-bold text-green-700 dark:text-green-400">Quote Accepted</h3>
                            <p className="text-sm text-muted-foreground">
                                Contract and Work Orders have been generated. The FSM can now assign vendors in the Operations tab.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Send to Client (bottom — preferred action) */}
            {quote.status === 'draft' && (
                <Card className="print:hidden border-blue-600/30 bg-blue-50 dark:bg-blue-950/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-blue-600" />
                                    Send to Client for Review
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Email the proposal — the client can accept or request changes without logging in.
                                </p>
                            </div>
                            <Button className="gap-2" onClick={() => setShowSendModal(true)}>
                                <Send className="w-4 h-4" /> Send to Client
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Send to Client Modal */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Send className="w-5 h-5 text-primary" /> Send Quote to Client
                                </h2>
                                <p className="text-sm text-muted-foreground">{quote.leadBusinessName} • {formatCurrency(quote.totalMonthlyRate)}/mo</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label className="text-sm">Client Email *</Label>
                                <Input
                                    type="email"
                                    placeholder="client@example.com"
                                    value={clientEmail}
                                    onChange={(e) => setClientEmail(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-sm">Client Name (optional)</Label>
                                <Input
                                    placeholder="John Smith"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">What the client will receive:</p>
                                <ul className="space-y-1 ml-3 list-disc">
                                    <li>Branded email with full service breakdown</li>
                                    <li>Link to review and respond (no login needed)</li>
                                    <li>Options to "Accept" or "Request Changes"</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
                            <Button
                                onClick={handleSendToClient}
                                disabled={!clientEmail || sending}
                                className="gap-2"
                            >
                                {sending ? 'Sending...' : <><Send className="w-4 h-4" /> Send Email</>}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Related Work Orders */}
            {workOrders.length > 0 && (
                <Card className="print:hidden">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            Work Orders ({workOrders.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {workOrders.map((wo: any) => (
                                <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium">{wo.serviceType}</p>
                                        <p className="text-xs text-muted-foreground">{wo.locationName}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={wo.status === 'active' ? 'default' : wo.status === 'pending_assignment' ? 'secondary' : 'outline'}>
                                            {wo.status?.replace(/_/g, ' ')}
                                        </Badge>
                                        {wo.vendorId ? (
                                            <span className="text-xs text-green-700">Assigned</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Unassigned</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Version History */}
            {quote.revisionHistory && quote.revisionHistory.length > 0 && (
                <Card className="print:hidden">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <History className="w-4 h-4 text-muted-foreground" />
                            Version History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Current version */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-3 mb-2">
                                <Badge variant="default" className="text-xs">v{quote.version}</Badge>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Current Version</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatCurrency(quote.totalMonthlyRate)}/mo • {quote.lineItems?.length || 0} services
                                    </p>
                                </div>
                            </div>
                            {/* Per-item attribution summary */}
                            <div className="mt-2 space-y-1.5 pl-10">
                                {(quote.lineItems || []).map((li: QuoteLineItem) => (
                                    <div key={li.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{li.serviceType}</span>
                                            {li.isUpsell && (
                                                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Upsell</span>
                                            )}
                                            {li.addedByRole === 'fsm' && (
                                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">FSM</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {li.lineItemStatus === 'accepted' ? (
                                                <span className="text-green-600">✓ v{li.acceptedInVersion || '1'}</span>
                                            ) : li.lineItemStatus === 'rejected' ? (
                                                <span className="text-red-500">✗</span>
                                            ) : (
                                                <span className="text-amber-600">⏳</span>
                                            )}
                                            <span className="font-mono">{formatCurrency(li.clientRate)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Previous versions */}
                        {[...quote.revisionHistory].reverse().map((rev: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-muted/20 border">
                                <div className="flex items-center gap-3 mb-1">
                                    <Badge variant="secondary" className="text-xs">v{rev.version}</Badge>
                                    <div className="flex-1">
                                        <p className="text-sm">{formatCurrency(rev.totalMonthlyRate)}/mo • {rev.lineItems?.length || 0} services</p>
                                        <p className="text-xs text-muted-foreground">
                                            {rev.changedAt?.toDate?.()?.toLocaleDateString() || '—'} by {rev.changedBy}
                                        </p>
                                    </div>
                                </div>
                                {rev.notes && (
                                    <p className="text-xs text-muted-foreground italic pl-10 mt-1">"{rev.notes}"</p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            {/* Revise Quote Builder */}
            {showReviseBuilder && quote && (
                <QuoteBuilder
                    onClose={() => setShowReviseBuilder(false)}
                    onCreated={(quoteId) => {
                        setShowReviseBuilder(false);
                        // Force full refresh to get updated data
                        window.location.reload();
                    }}
                    existingQuote={{
                        quoteId: quote.id,
                        leadId: quote.leadId,
                        leadBusinessName: quote.leadBusinessName,
                        lineItems: quote.lineItems || [],
                        locations: (() => {
                            // Extract unique locations from line items
                            const seen = new Set<string>();
                            return (quote.lineItems || [])
                                .filter(li => {
                                    if (seen.has(li.locationId)) return false;
                                    seen.add(li.locationId);
                                    return true;
                                })
                                .map(li => ({
                                    id: li.locationId,
                                    name: li.locationName,
                                    address: '',
                                    city: '',
                                    state: '',
                                    zip: '',
                                }));
                        })(),
                        contractTenure: quote.contractTenure,
                        paymentTerms: quote.paymentTerms,
                        exitClause: quote.exitClause || '',
                        notes: quote.notes || '',
                        version: quote.version || 1,
                    }}
                />
            )}
        </div>
    );
}
