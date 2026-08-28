'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Quote, QuoteLineItem, QuoteRevision, ROOM_TYPES, CLEANING_TASKS, computeDualPricing, getCreditPrice } from '@xiri-facility-solutions/shared';
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
    Send, Eye, MessageSquare, Mail, UserRoundCheck, RotateCcw, History,
    CreditCard, Landmark, FileCheck, Layers, Upload, ExternalLink, Trash2,
    ClipboardList, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: Promise<{ id: string }>;
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
    const { id } = use(params);
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
    const [viewMode, setViewMode] = useState<'sow' | 'standard'>('sow');

    // Work orders state
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const fsmDropdownRef = useRef<HTMLDivElement>(null);

    // Signed SOW upload state
    const [uploadingSow, setUploadingSow] = useState(false);
    const [sowProgress, setSowProgress] = useState(0);
    const sowFileInputRef = useRef<HTMLInputElement>(null);
    const sowAutoAcceptInputRef = useRef<HTMLInputElement>(null);

    // Click outside to close FSM dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fsmDropdownRef.current && !fsmDropdownRef.current.contains(e.target as Node)) {
                setShowFsmDropdown(false);
            }
        };
        if (showFsmDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showFsmDropdown]);

    useEffect(() => {
        async function fetchQuote() {
            try {
                const docSnap = await getDoc(doc(db, 'quotes', id));
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
    }, [id]);

    // Fetch related work orders
    useEffect(() => {
        if (!quote?.id) return;
        async function fetchWorkOrders() {
            try {
                const allWos: any[] = [];
                const seenIds = new Set<string>();

                // 1. Fetch by quoteId
                const woSnap = await getDocs(query(
                    collection(db, 'work_orders'),
                    where('quoteId', '==', quote!.id)
                ));
                woSnap.docs.forEach(d => {
                    seenIds.add(d.id);
                    allWos.push({ id: d.id, ...d.data() });
                });

                // 2. Also fetch by quoteLineItemId if quote has line items
                if (quote?.lineItems?.length) {
                    const lineItemIds = quote.lineItems.map(li => li.id).filter(Boolean);
                    for (let i = 0; i < lineItemIds.length; i += 30) {
                        const chunk = lineItemIds.slice(i, i + 30);
                        if (chunk.length > 0) {
                            const liWoSnap = await getDocs(query(
                                collection(db, 'work_orders'),
                                where('quoteLineItemId', 'in', chunk)
                            ));
                            liWoSnap.docs.forEach(d => {
                                if (!seenIds.has(d.id)) {
                                    seenIds.add(d.id);
                                    allWos.push({ id: d.id, ...d.data() });
                                }
                            });
                        }
                    }
                }
                setWorkOrders(allWos);
            } catch (err) {
                console.error('Error fetching work orders:', err);
            }
        }
        fetchWorkOrders();
    }, [quote?.id, quote?.lineItems]);

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

    const updateLeadOrCompany = async (id: string, data: Record<string, any>) => {
        if (!id) return;
        try {
            const leadRef = doc(db, 'leads', id);
            const leadSnap = await getDoc(leadRef);
            if (leadSnap.exists()) {
                await updateDoc(leadRef, data);
                return;
            }
            const companyRef = doc(db, 'companies', id);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
                await updateDoc(companyRef, data);
            }
        } catch (e) {
            console.warn('Could not update lead/company:', e);
        }
    };

    const handleUploadSowFile = async (e: React.ChangeEvent<HTMLInputElement>, autoAccept: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file || !quote) return;
        setUploadingSow(true);
        try {
            const storagePath = `signed_sow_documents/${quote.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setSowProgress(Math.round(progress));
                },
                (err) => {
                    console.error('SOW Upload failed:', err);
                    alert('Failed to upload signed SOW file.');
                    setUploadingSow(false);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    const now = new Date();
                    await updateDoc(doc(db, 'quotes', quote.id), {
                        signedSowUrl: downloadUrl,
                        signedSowName: file.name,
                        signedSowUploadedAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    // Cascade SOW document to all existing work orders for this quote
                    const woSnap = await getDocs(query(
                        collection(db, 'work_orders'),
                        where('quoteId', '==', quote.id)
                    ));
                    for (const woDoc of woSnap.docs) {
                        await updateDoc(doc(db, 'work_orders', woDoc.id), {
                            sowDocumentUrl: downloadUrl,
                            sowDocumentName: file.name,
                            sowUploadedAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        });
                    }

                    // Cascade SOW document to all existing contracts for this quote
                    const contractSnap = await getDocs(query(
                        collection(db, 'contracts'),
                        where('quoteId', '==', quote.id)
                    ));
                    for (const cDoc of contractSnap.docs) {
                        await updateDoc(doc(db, 'contracts', cDoc.id), {
                            signedSowUrl: downloadUrl,
                            signedSowName: file.name,
                            signedSowUploadedAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        });
                    }

                    setQuote(prev => prev ? ({
                        ...prev,
                        signedSowUrl: downloadUrl,
                        signedSowName: file.name,
                        signedSowUploadedAt: now,
                    } as any) : null);

                    setUploadingSow(false);
                    setSowProgress(0);

                    if (autoAccept && (quote.status === 'draft' || quote.status === 'sent')) {
                        await handleAccept();
                    }
                }
            );
        } catch (err) {
            console.error('Error uploading SOW:', err);
            setUploadingSow(false);
        }
    };

    const handleRemoveSow = async () => {
        if (!quote || !confirm('Are you sure you want to remove this attached SOW document?')) return;
        try {
            await updateDoc(doc(db, 'quotes', quote.id), {
                signedSowUrl: null,
                signedSowName: null,
                signedSowUploadedAt: null,
                updatedAt: serverTimestamp(),
            });
            setQuote(prev => prev ? ({
                ...prev,
                signedSowUrl: undefined,
                signedSowName: undefined,
                signedSowUploadedAt: undefined,
            } as any) : null);
        } catch (err) {
            console.error('Error removing SOW:', err);
        }
    };

    // BreezeDoc E-Sign Handlers
    const [breezeModalOpen, setBreezeModalOpen] = useState(false);
    const [breezeDocs, setBreezeDocs] = useState<any[]>([]);
    const [breezeLoading, setBreezeLoading] = useState(false);
    const [breezeSyncing, setBreezeSyncing] = useState(false);

    const fetchBreezeDocuments = async () => {
        setBreezeLoading(true);
        try {
            const res = await fetch('/api/breezedoc?action=documents');
            const json = await res.json();
            if (json.success && json.data?.data) {
                setBreezeDocs(json.data.data);
            }
        } catch (err) {
            console.error('Error fetching BreezeDoc documents:', err);
        } finally {
            setBreezeLoading(false);
        }
    };

    const handleLinkBreezeDoc = async (bDoc: any) => {
        if (!quote) return;
        try {
            const recipient = bDoc.recipients?.find((r: any) => r.party === 2) || bDoc.recipients?.[0];
            const recipientUrl = recipient?.slug ? `https://breezedoc.com/d/${recipient.slug}` : `https://breezedoc.com/documents/${bDoc.id}`;
            const isCompleted = !!bDoc.completed_at;

            const updates: any = {
                breezeDocId: bDoc.id,
                breezeDocSlug: bDoc.slug,
                breezeDocTitle: bDoc.title,
                breezeDocStatus: isCompleted ? 'completed' : 'sent',
                breezeDocRecipientUrl: recipientUrl,
                updatedAt: serverTimestamp(),
            };

            await updateDoc(doc(db, 'quotes', quote.id), updates);
            setQuote(prev => prev ? ({ ...prev, ...updates }) : null);
            setBreezeModalOpen(false);

            if (isCompleted && (quote.status === 'draft' || quote.status === 'sent')) {
                await handleAccept();
            }
        } catch (err) {
            console.error('Error linking BreezeDoc document:', err);
        }
    };

    const handleUnlinkBreezeDoc = async () => {
        if (!quote || !confirm('Unlink this BreezeDoc document from this quote?')) return;
        try {
            const updates = {
                breezeDocId: null,
                breezeDocSlug: null,
                breezeDocTitle: null,
                breezeDocStatus: null,
                breezeDocRecipientUrl: null,
                updatedAt: serverTimestamp(),
            };
            await updateDoc(doc(db, 'quotes', quote.id), updates);
            setQuote(prev => prev ? ({
                ...prev,
                breezeDocId: undefined,
                breezeDocSlug: undefined,
                breezeDocTitle: undefined,
                breezeDocStatus: undefined,
                breezeDocRecipientUrl: undefined,
            } as any) : null);
        } catch (err) {
            console.error('Error unlinking BreezeDoc:', err);
        }
    };

    const handleCheckBreezeStatus = async () => {
        const bId = (quote as any)?.breezeDocId;
        if (!bId || !quote) return;
        setBreezeSyncing(true);
        try {
            const res = await fetch(`/api/breezedoc?action=document&id=${bId}`);
            const json = await res.json();
            if (json.success && json.data) {
                const bDoc = json.data;
                const isCompleted = !!bDoc.completed_at;
                const recipient = bDoc.recipients?.find((r: any) => r.party === 2) || bDoc.recipients?.[0];
                const recipientUrl = recipient?.slug ? `https://breezedoc.com/d/${recipient.slug}` : `https://breezedoc.com/documents/${bDoc.id}`;

                const updates: any = {
                    breezeDocStatus: isCompleted ? 'completed' : 'sent',
                    breezeDocRecipientUrl: recipientUrl,
                    updatedAt: serverTimestamp(),
                };

                await updateDoc(doc(db, 'quotes', quote.id), updates);
                setQuote(prev => prev ? ({ ...prev, ...updates }) : null);

                if (isCompleted && (quote.status === 'draft' || quote.status === 'sent')) {
                    alert('BreezeDoc signature completed! Converting quote to Active Contract.');
                    await handleAccept();
                } else if (!isCompleted) {
                    alert(`BreezeDoc status: Pending client signature.`);
                }
            }
        } catch (err) {
            console.error('Error checking BreezeDoc status:', err);
        } finally {
            setBreezeSyncing(false);
        }
    };

    const handleAssignFsm = async (fsm: FsmUser) => {
        if (!quote) return;
        try {
            // Optimistic: update UI immediately
            setQuote({ ...quote, assignedFsmId: fsm.uid, assignedFsmName: fsm.displayName });
            setShowFsmDropdown(false);

            await updateDoc(doc(db, 'quotes', quote.id), {
                assignedFsmId: fsm.uid,
                assignedFsmName: fsm.displayName,
                updatedAt: serverTimestamp(),
            });

            // Safely update the lead or company
            if (quote.leadId) {
                await updateLeadOrCompany(quote.leadId, {
                    assignedFsmId: fsm.uid,
                });
            }

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
                    oneTimeCharges: quote.oneTimeCharges || 0,
                    contractTenure: quote.contractTenure,
                    startDate: (() => {
                        const dates = acceptedItems
                            .map((li: any) => li.serviceDate)
                            .filter(Boolean)
                            .sort();
                        return dates.length > 0 ? new Date(dates[0]) : serverTimestamp();
                    })(),
                    endDate: (() => {
                        const dates = acceptedItems
                            .map((li: any) => li.serviceDate)
                            .filter(Boolean)
                            .sort();
                        const start = dates.length > 0 ? new Date(dates[0]) : now;
                        return new Date(start.getFullYear(), start.getMonth() + quote.contractTenure, start.getDate());
                    })(),
                    paymentTerms: quote.paymentTerms,
                    exitClause: quote.exitClause || '30-day written notice',
                    status: 'active',
                    assignedFsmId: quote.assignedFsmId || null,
                    assignedFsmName: quote.assignedFsmName || null,
                    signedSowUrl: (quote as any).signedSowUrl || null,
                    signedSowName: (quote as any).signedSowName || null,
                    signedSowUploadedAt: (quote as any).signedSowUploadedAt || null,
                    createdBy: userId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                contractId = contractRef.id;
            }

            // 2. Create Work Orders ONLY for newly accepted (pending) items
            for (const item of pendingItems) {
                // Deduplication check: see if a work order already exists for this quoteLineItemId
                const existingWoSnap = await getDocs(query(
                    collection(db, 'work_orders'),
                    where('quoteId', '==', quote.id),
                    where('quoteLineItemId', '==', item.id)
                ));
                if (!existingWoSnap.empty) {
                    const existingDoc = existingWoSnap.docs[0];
                    await updateDoc(doc(db, 'work_orders', existingDoc.id), {
                        sowDocumentUrl: (quote as any).signedSowUrl || null,
                        sowDocumentName: (quote as any).signedSowName || null,
                        sowUploadedAt: (quote as any).signedSowUploadedAt || null,
                        updatedAt: serverTimestamp(),
                    });
                    continue;
                }

                // Prefer room-level tasks from calculator, then scopeTasks, then template
                let tasks;
                if ((item as any).rooms && (item as any).rooms.length > 0) {
                    // Flatten room tasks into WorkOrderTask format with room context
                    tasks = (item as any).rooms.flatMap((room: any) => {
                        const roomType = ROOM_TYPES.find(rt => rt.id === room.roomTypeId);
                        const roomLabel = room.customName || roomType?.name || room.roomTypeId;
                        return room.tasks.map((taskId: string) => {
                            const taskDef = CLEANING_TASKS.find((t: any) => t.id === taskId);
                            return {
                                id: `${room.id}_${taskId}`,
                                name: taskDef?.name || taskId,
                                description: taskDef?.description || '',
                                required: true,
                                roomId: room.id,
                                roomName: roomLabel,
                            };
                        });
                    });
                } else if (item.scopeTasks && item.scopeTasks.length > 0) {
                    tasks = item.scopeTasks.map((t: any, i: number) => ({
                        id: `task_${i}`, name: t.name, description: t.description || '', required: t.required,
                    }));
                } else {
                    const template = SCOPE_TEMPLATES.find(t => t.name.toLowerCase().includes(item.serviceType.toLowerCase()));
                    tasks = template
                        ? template.tasks.map((t, i) => ({ id: `task_${i}`, name: t.name, description: t.description, required: t.required }))
                        : [];
                }
                const template = SCOPE_TEMPLATES.find(t => t.name.toLowerCase().includes(item.serviceType.toLowerCase()));

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
                    // Calculator scope snapshot (for NFC checklists)
                    rooms: (item as any).rooms || null,
                    calculatorInputs: (item as any).calculatorInputs || null,
                    calculatorResults: (item as any).calculatorResults || null,
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
                    serviceStartDate: item.serviceDate || null,
                    sowDocumentUrl: (quote as any).signedSowUrl || null,
                    sowDocumentName: (quote as any).signedSowName || null,
                    sowUploadedAt: (quote as any).signedSowUploadedAt || null,
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

            // 4. Update Lead or Company status to 'won'
            if (quote.leadId) {
                await updateLeadOrCompany(quote.leadId, {
                    status: 'won',
                    contractId,
                    wonAt: serverTimestamp(),
                });
            }

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

            // 6. Create Sales Commission
            const recurringItems = acceptedItems.filter((li: any) => li.frequency !== 'one_time');
            const oneTimeItems = acceptedItems.filter((li: any) => li.frequency === 'one_time');
            const mrr = recurringItems.reduce((s: number, li: any) => s + (li.clientRate || 0), 0);
            const oneTimeTotal = oneTimeItems.reduce((s: number, li: any) => s + (li.clientRate || 0), 0);
            const totalRevenue = mrr + oneTimeTotal;
            if (totalRevenue > 0) {
                const tenure = quote.contractTenure || 12;
                const acv = (mrr * tenure) + oneTimeTotal; // recurring × tenure + one-time flat
                const isUpsell = quote.isUpsell === true;

                // Read configurable rates from Firestore
                let rateStandard = 0.05, ratePremium = 0.075, fsmUpsellRate = 0.05, mrrThreshold = 3000;
                try {
                    const cfgSnap = await getDoc(doc(db, 'settings', 'commissions'));
                    if (cfgSnap.exists()) {
                        const cfg = cfgSnap.data();
                        rateStandard = cfg.rateStandard ?? rateStandard;
                        ratePremium = cfg.ratePremium ?? ratePremium;
                        fsmUpsellRate = cfg.fsmUpsellRate ?? fsmUpsellRate;
                        mrrThreshold = cfg.mrrThreshold ?? mrrThreshold;
                    }
                } catch (e) { /* fallback to defaults */ }

                const commissionRate = isUpsell ? fsmUpsellRate : (mrr > mrrThreshold ? ratePremium : rateStandard);
                const totalCommission = Math.round(acv * commissionRate * 100) / 100;
                const staffId = quote.assignedTo || quote.createdBy || userId;

                // 50/25/25 payout schedule over 3 months
                const now2 = new Date();
                const payoutSchedule = [
                    { month: 0, amount: Math.round(totalCommission * 0.50 * 100) / 100, percentage: 50, status: 'PENDING', scheduledAt: new Date(now2.getFullYear(), now2.getMonth() + 1, 1) },
                    { month: 1, amount: Math.round(totalCommission * 0.25 * 100) / 100, percentage: 25, status: 'PENDING', scheduledAt: new Date(now2.getFullYear(), now2.getMonth() + 2, 1) },
                    { month: 2, amount: Math.round(totalCommission * 0.25 * 100) / 100, percentage: 25, status: 'PENDING', scheduledAt: new Date(now2.getFullYear(), now2.getMonth() + 3, 1) },
                ];

                const commRef = await addDoc(collection(db, 'commissions'), {
                    staffId,
                    staffRole: isUpsell ? 'fsm' : 'sales',
                    quoteId: quote.id,
                    leadId: quote.leadId,
                    type: isUpsell ? 'FSM_UPSELL' : 'SALES_NEW',
                    mrr,
                    acv,
                    rate: commissionRate,
                    totalCommission,
                    payoutSchedule,
                    clawbackWindowEnd: new Date(now2.getFullYear(), now2.getMonth() + 6, now2.getDate()),
                    status: 'ACTIVE',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                // Ledger entry for audit trail
                await addDoc(collection(db, 'commission_ledger'), {
                    commissionId: commRef.id,
                    type: 'PAYOUT_SCHEDULED',
                    amount: totalCommission,
                    staffId,
                    description: `Commission created for ${quote.leadBusinessName || 'client'} — ${formatCurrency(mrr)}/mo MRR, ${tenure}mo tenure`,
                    createdAt: serverTimestamp(),
                });
            }

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
            if (quote.leadId) {
                await updateLeadOrCompany(quote.leadId, {
                    status: 'lost',
                });
            }
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

    const rawSubtotal = quote.subtotalBeforeTax || quote.totalMonthlyRate || (quote.lineItems?.reduce((s, li) => s + (li.clientRate || 0), 0) || 0);
    const taxRate = (quote.totalTax && quote.subtotalBeforeTax) ? (quote.totalTax / quote.subtotalBeforeTax) : 0.08625;
    const dual = computeDualPricing(rawSubtotal, taxRate);

    // Extract all unit items or line items for the SOW breakdown
    const allUnitItems: { id: string; description: string; quantity: number; unit: string; unitPrice: number; subtotal: number }[] = [];
    (quote.lineItems || []).forEach(li => {
        if (li.unitItems && li.unitItems.length > 0) {
            li.unitItems.forEach(u => allUnitItems.push(u));
        } else {
            allUnitItems.push({
                id: li.id,
                description: li.serviceType + (li.description ? ` — ${li.description}` : ''),
                quantity: 1,
                unit: li.frequency === 'one_time' ? 'flat' : 'month',
                unitPrice: li.clientRate,
                subtotal: li.clientRate,
            });
        }
    });

    // Extract scope tasks
    const allScopeTasks: { name: string; description?: string }[] = [];
    (quote.lineItems || []).forEach(li => {
        if (li.scopeTasks && li.scopeTasks.length > 0) {
            li.scopeTasks.forEach(st => allScopeTasks.push(st));
        }
    });

    const primaryLocation = quote.lineItems?.[0];
    const quoteDateStr = quote.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
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
                            Created {quoteDateStr}
                        </p>
                    </div>
                </div>

                {/* Actions & View Switcher */}
                <div className="flex gap-2 items-center flex-wrap">
                    {/* SOW / Standard View Toggle */}
                    <div className="flex bg-muted/80 p-1 rounded-lg border text-xs mr-1 print:hidden">
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-md font-semibold transition-all ${viewMode === 'sow' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('sow')}
                        >
                            <FileCheck className="w-3.5 h-3.5 inline mr-1.5 text-blue-600" /> SOW View
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 rounded-md font-semibold transition-all ${viewMode === 'standard' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('standard')}
                        >
                            <Layers className="w-3.5 h-3.5 inline mr-1.5 text-slate-600" /> Standard View
                        </button>
                    </div>

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
                    {workOrders.length === 1 && (
                        <Button
                            size="sm"
                            className="gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                            onClick={() => router.push(`/operations/work-orders/${workOrders[0].id}`)}
                        >
                            <ClipboardList className="w-4 h-4" /> Open Work Order →
                        </Button>
                    )}
                    {workOrders.length > 1 && (
                        <Button
                            size="sm"
                            className="gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                            onClick={() => {
                                const el = document.getElementById('linked-work-orders-section');
                                el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            <ClipboardList className="w-4 h-4" /> View Work Orders ({workOrders.length}) ↓
                        </Button>
                    )}
                    {(quote as any).signedSowUrl && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 font-semibold border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                            onClick={() => window.open((quote as any).signedSowUrl, '_blank')}
                        >
                            <FileCheck className="w-4 h-4 text-emerald-600" /> Signed SOW (PDF)
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-2 font-medium" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print SOW
                    </Button>
                    {quote.version > 1 && (
                        <Badge variant="secondary" className="text-xs">v{quote.version}</Badge>
                    )}
                </div>
            </div>

            {/* Status Timeline + FSM Assignment */}
            <Card className="print:hidden">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
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
                        <div className="relative" ref={fsmDropdownRef}>
                            <Button
                                variant="outline"
                                size="sm"
                                className={`gap-2 ${quote.assignedFsmName ? 'border-green-200 text-green-700 hover:bg-green-50' : ''}`}
                                onClick={() => setShowFsmDropdown(!showFsmDropdown)}
                            >
                                <UserRoundCheck className="w-4 h-4" />
                                {quote.assignedFsmName ? (
                                    <><span>{quote.assignedFsmName}</span><span className="text-xs text-muted-foreground ml-1">✎</span></>
                                ) : 'Assign FSM'}
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
                                    <MessageSquare className="w-3.5 h-3.5" /> Client notes: &quot;{quote.clientResponseNotes}&quot;
                                </span>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* LINKED OPERATIONAL WORK ORDERS                                      */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {workOrders.length > 0 && (
                <Card id="linked-work-orders-section" className="border-indigo-200 bg-indigo-50/20 shadow-xs print:hidden">
                    <CardHeader className="pb-3 border-b bg-indigo-50/60 dark:bg-indigo-950/20">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                                    Operational Work Orders ({workOrders.length})
                                </CardTitle>
                                <CardDescription className="text-xs text-indigo-900/80 dark:text-indigo-300/80">
                                    Click any work order below to enter operations, manage vendor dispatch, inspect tasks, or attach contractor agreements.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold text-xs">
                                    {workOrders.filter(w => w.status === 'active').length} Active
                                </Badge>
                                {workOrders.some(w => !w.vendorId) && (
                                    <Badge variant="destructive" className="text-xs">
                                        {workOrders.filter(w => !w.vendorId).length} Needs Vendor
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {workOrders.map((wo) => {
                                const isWoOneTime = wo.schedule?.frequency === 'one_time' || wo.frequency === 'one_time';
                                return (
                                    <div
                                        key={wo.id}
                                        onClick={() => router.push(`/operations/work-orders/${wo.id}`)}
                                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                                        {wo.serviceType}
                                                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity shrink-0" />
                                                    </span>
                                                    {isWoOneTime && (
                                                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-semibold px-1.5 py-0 h-4 mt-1">
                                                            One-Time Project
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={wo.status === 'active' ? 'default' : wo.vendorId ? 'secondary' : 'destructive'}
                                                    className="text-[10px] uppercase font-semibold shrink-0"
                                                >
                                                    {wo.status === 'active' ? 'Active' : wo.vendorId ? 'Assigned' : 'Needs Vendor'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{wo.locationName}</span>
                                            </p>
                                            {(wo.locationAddress || wo.locationCity) && (
                                                <p className="text-[11px] text-muted-foreground ml-4.5 mb-2 truncate">
                                                    {[wo.locationAddress, wo.locationCity, wo.locationState].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs mt-2">
                                            <div>
                                                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Client Rate</span>
                                                <span className="font-bold text-slate-900">
                                                    {formatCurrency(wo.clientRate)}{isWoOneTime ? ' total' : '/mo'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Vendor</span>
                                                <span className="font-medium text-slate-700">
                                                    {wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || (
                                                        <span className="text-red-500 font-semibold">Unassigned</span>
                                                    )}
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs text-indigo-600 group-hover:bg-indigo-50 font-bold gap-1"
                                            >
                                                Open <ArrowRight className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE 1: STATEMENT OF WORK (SOW) & WORK AUTHORIZATION          */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'sow' ? (
                <div className="bg-white text-slate-900 border rounded-xl shadow-xs p-6 md:p-8 space-y-6 print:border-0 print:shadow-none print:p-0" id="quote-printable">
                    {/* SOW Top Header */}
                    <div className="flex items-start justify-between border-b pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black tracking-tight text-sky-700 font-sans">XIRI</span>
                                <span className="text-lg font-light tracking-wide text-slate-600 uppercase">FACILITY SOLUTIONS</span>
                            </div>
                            <p className="text-xs text-slate-500 font-normal mt-0.5">
                                XIRI Group LLC | New Hyde Park, NY | Facility Solutions & Commercial Services
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                DATE: {quoteDateStr}
                            </p>
                        </div>
                    </div>

                    {/* Blue Title Banner */}
                    <div className="border-b-2 border-sky-700 pb-2">
                        <h2 className="text-lg font-bold text-sky-800 tracking-wide uppercase">
                            STATEMENT OF WORK & WORK AUTHORIZATION
                        </h2>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-y-2 gap-x-4 text-xs">
                        <div className="md:col-span-2 font-bold text-slate-700 uppercase">CLIENT:</div>
                        <div className="md:col-span-10 font-semibold text-slate-900">{quote.leadBusinessName}</div>

                        <div className="md:col-span-2 font-bold text-slate-700 uppercase">ATTN:</div>
                        <div className="md:col-span-10 text-slate-800">
                            {quote.clientEmail ? `${quote.clientEmail}` : quote.leadBusinessName}
                        </div>

                        <div className="md:col-span-2 font-bold text-slate-700 uppercase">BILLING:</div>
                        <div className="md:col-span-10 text-slate-800">
                            {primaryLocation?.locationAddress
                                ? `${primaryLocation.locationAddress}, ${primaryLocation.locationCity || ''} ${primaryLocation.locationState || ''} ${primaryLocation.locationZip || ''}`.trim()
                                : 'On file with corporate accounts payable'}
                        </div>

                        <div className="md:col-span-2 font-bold text-slate-700 uppercase">LOCATION:</div>
                        <div className="md:col-span-10 text-slate-800 font-medium">
                            {primaryLocation?.locationName || quote.leadBusinessName} — {primaryLocation?.locationAddress || 'Primary Site'}
                        </div>

                        <div className="md:col-span-2 font-bold text-slate-700 uppercase">PROJECT:</div>
                        <div className="md:col-span-10 text-slate-900 font-semibold">
                            {quote.proposalTerms?.projectTitle || primaryLocation?.serviceType || 'Commercial Restroom & Facility Services'}
                        </div>
                    </div>

                    {/* Scope of Work Section with Blue Left Border */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            SCOPE OF WORK
                        </h3>
                        <div className="border-l-4 border-sky-700 pl-4 space-y-2 text-xs text-slate-800 leading-relaxed">
                            {allScopeTasks.length > 0 ? (
                                allScopeTasks.map((t, idx) => (
                                    <div key={idx} className="flex items-start gap-1.5">
                                        <span className="font-bold text-slate-900 min-w-[18px]">{idx + 1}.</span>
                                        <div>
                                            <strong className="text-slate-900">{t.name}:</strong>{' '}
                                            <span className="text-slate-700">{t.description || 'Completed to industry standard specifications and site safety guidelines.'}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-slate-900 min-w-[18px]">1.</span>
                                        <div>
                                            <strong className="text-slate-900">Work Preparation & Staging:</strong>{' '}
                                            <span>Unmount and prep designated hardware and fixtures across all specified service locations.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-slate-900 min-w-[18px]">2.</span>
                                        <div>
                                            <strong className="text-slate-900">Support & Structure Clearance:</strong>{' '}
                                            <span>Clear and adjust obstructions directly beneath fixtures for full clearance; re-secure undermount hardware.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-slate-900 min-w-[18px]">3.</span>
                                        <div>
                                            <strong className="text-slate-900">Precision Installation & Re-Assembly:</strong>{' '}
                                            <span>Precision-mount and secure components flush across all designated site locations.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-1.5">
                                        <span className="font-bold text-slate-900 min-w-[18px]">4.</span>
                                        <div>
                                            <strong className="text-slate-900">Insurance & Compliance:</strong>{' '}
                                            <span>Issuance of site-specific Certificate of Insurance (COI) naming client as Additional Insured.</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Dual-Pricing Line Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b text-slate-700 font-bold">
                                <tr>
                                    <th className="text-left py-2.5 px-3">Item / Scope Description</th>
                                    <th className="text-center py-2.5 px-3 w-16">Qty</th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-slate-900">
                                        Payment Method 1: ACH / Check
                                    </th>
                                    <th className="text-right py-2.5 px-3 font-semibold text-blue-800">
                                        Payment Method 2: Credit Card (+3%)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allUnitItems.map((item, i) => {
                                    const cashUnitPrice = item.unitPrice || 0;
                                    const cashSubtotal = item.subtotal || (cashUnitPrice * (item.quantity || 1));
                                    const creditUnitPrice = getCreditPrice(cashUnitPrice);
                                    const creditSubtotal = getCreditPrice(cashSubtotal);

                                    return (
                                        <tr key={item.id || i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-3 font-medium text-slate-900">
                                                {item.description}
                                            </td>
                                            <td className="py-3 px-3 text-center text-slate-600 font-mono">
                                                {item.quantity}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <div className="font-semibold text-slate-900 font-mono">
                                                    ${cashUnitPrice.toFixed(2)}{item.unit !== 'flat' && item.unit !== 'month' ? ` / ${item.unit}` : ''}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-mono">
                                                    (${cashSubtotal.toFixed(2)})
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right bg-blue-50/30">
                                                <div className="font-semibold text-blue-900 font-mono">
                                                    ${creditUnitPrice.toFixed(2)}{item.unit !== 'flat' && item.unit !== 'month' ? ` / ${item.unit}` : ''}
                                                </div>
                                                <div className="text-[11px] text-blue-700 font-mono">
                                                    (${creditSubtotal.toFixed(2)})
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ═══ SIDE-BY-SIDE DUAL PAYMENT SUMMARY BOXES ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Box 1: ACH / Wire / Check (Cash Price) */}
                        <div className="border border-sky-200 bg-sky-50/50 rounded-lg overflow-hidden shadow-2xs">
                            <div className="bg-sky-100/80 px-4 py-2 border-b border-sky-200">
                                <h4 className="text-xs font-bold text-sky-900 tracking-wider uppercase flex items-center gap-1.5">
                                    <Landmark className="w-3.5 h-3.5 text-sky-700" />
                                    PAYMENT METHOD 1: ACH / CHECK
                                </h4>
                            </div>
                            <div className="p-4 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-700">
                                    <span>Labor / Services Subtotal:</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.cashSubtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.cashTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-sky-200 font-bold text-sm text-sky-950">
                                    <span>TOTAL (ACH / Wire / Check):</span>
                                    <span className="font-mono text-base text-sky-800 font-bold">{formatCurrency(dual.cashTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Box 2: Credit Card (+3% Surcharge) */}
                        <div className="border border-blue-300 bg-blue-50/50 rounded-lg overflow-hidden shadow-2xs">
                            <div className="bg-blue-100/80 px-4 py-2 border-b border-blue-200">
                                <h4 className="text-xs font-bold text-blue-900 tracking-wider uppercase flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                                    PAYMENT METHOD 2: CREDIT CARD
                                </h4>
                            </div>
                            <div className="p-4 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-700">
                                    <span>Credit Card Subtotal (+3%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.creditSubtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.creditTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-blue-200 font-bold text-sm text-blue-950">
                                    <span>TOTAL (Credit Card):</span>
                                    <span className="font-mono text-base text-blue-800 font-bold">{formatCurrency(dual.creditTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms & Conditions (1-9 Clauses) */}
                    <div className="space-y-2 pt-3 border-t border-slate-200 text-[11px] text-slate-700 leading-relaxed">
                        <h4 className="text-xs font-bold text-slate-900 uppercase">TERMS & CONDITIONS</h4>
                        <ol className="space-y-1.5 list-none pl-0">
                            <li>
                                <strong>1. Binding Authorization & Invoicing:</strong> Execution authorizes XIRI Group LLC to perform the work without requiring a separate purchase order. Invoiced upon completion, due Net 15 days via ACH/Check ({formatCurrency(dual.cashTotal)}) or Credit Card ({formatCurrency(dual.creditTotal)}).
                            </li>
                            <li>
                                <strong>2. Site Access & Housekeeping:</strong> Client/Venue will provide unhindered facility access during the scheduled window. Work areas will be handed over broom-clean, with daily trade debris disposed of in designated on-site receptacles.
                            </li>
                            <li>
                                <strong>3. Completion & Acceptance:</strong> Client or its designated on-site representative shall inspect and sign off on completed work. In the absence of a written punch list delivered within forty-eight (48) hours of job completion, the work shall be deemed fully accepted and approved for invoicing.
                            </li>
                            <li>
                                <strong>4. Change Orders & Contingencies:</strong> Any additional work, scope adjustments, or contingency line items require written confirmation (including email) prior to execution.
                            </li>
                            <li>
                                <strong>5. Workmanship Warranty:</strong> XIRI Group LLC warrants installation labor for ninety (90) days following completion. Defective workmanship will be corrected promptly at no cost. Hardware components remain warranted solely by the manufacturer.
                            </li>
                            <li>
                                <strong>6. Insurance & COI:</strong> XIRI Group LLC maintains Commercial General Liability ($1,000,000 occurrence / $2,000,000 aggregate) and will provide a site-specific COI naming client and location as Additional Insureds prior to work commencing.
                            </li>
                            <li>
                                <strong>7. Mutual Indemnification:</strong> Each party agrees to defend, indemnify, and hold harmless the other party from third-party claims, liabilities, or damages arising out of the indemnifying party&apos;s gross negligence, willful misconduct, or material breach.
                            </li>
                            <li>
                                <strong>8. Limitation of Liability & Force Majeure:</strong> Except for gross negligence or indemnification obligations, neither party is liable for consequential or indirect damages. Total aggregate liability is capped at the total fees paid under this SOW.
                            </li>
                            <li>
                                <strong>9. Governing Law & Entire Agreement:</strong> Governed by the laws of the State of New York (Nassau County jurisdiction). This SOW constitutes the entire agreement between the parties regarding this project scope.
                            </li>
                        </ol>
                    </div>

                    {/* Dual Signatures Block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
                        <div className="space-y-4">
                            <p className="font-bold text-slate-900 uppercase">ACCEPTED & AUTHORIZED BY:</p>
                            <p className="font-semibold text-slate-800">{quote.leadBusinessName}</p>
                            <div className="border-b-2 border-slate-400 pt-6"></div>
                            <div className="space-y-1 text-slate-600">
                                <p>Authorized Signature: _______________________</p>
                                <p>Printed Name: {quote.clientEmail ? quote.clientEmail.split('@')[0] : 'Authorized Representative'}</p>
                                <p>Title: Director of Facilities / Operations</p>
                                <p>Date: {quoteDateStr}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="font-bold text-slate-900 uppercase">SUBMITTED & CONFIRMED BY:</p>
                            <p className="font-semibold text-slate-800">XIRI Group LLC</p>
                            <div className="border-b-2 border-slate-400 pt-6"></div>
                            <div className="space-y-1 text-slate-600">
                                <p>Authorized Signature: <span className="font-serif italic font-bold text-sky-900">Christopher Leung</span></p>
                                <p>Printed Name: Christopher Leung</p>
                                <p>Title: Managing Member</p>
                                <p>Date: {quoteDateStr}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ═══════════════════════════════════════════════════════════════ */
                /* VIEW MODE 2: STANDARD QUOTE PROPOSAL VIEW                       */
                /* ═══════════════════════════════════════════════════════════════ */
                <div className="print:shadow-none space-y-6" id="quote-printable">
                    {/* Client Info */}
                    <Card className="print:border print:shadow-none">
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Prepared For</p>
                                    <p className="text-lg font-bold">{quote.leadBusinessName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Quote Total (Cash / ACH)</p>
                                    <p className="text-3xl font-bold text-primary">{formatCurrency(dual.cashTotal)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dual Pricing Side-by-Side Cards (Standard View) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-sky-200 bg-sky-50/40">
                            <CardHeader className="py-3 px-4 border-b border-sky-100">
                                <CardTitle className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                                    <Landmark className="w-4 h-4 text-sky-700" />
                                    OPTION 1: ACH / WIRE / CHECK
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-1.5 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal:</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.cashSubtotal)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.cashTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t font-bold text-sm text-foreground">
                                    <span>Total (ACH / Check):</span>
                                    <span className="font-mono text-base text-sky-700 font-bold">{formatCurrency(dual.cashTotal)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-blue-200 bg-blue-50/40">
                            <CardHeader className="py-3 px-4 border-b border-blue-100">
                                <CardTitle className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-blue-700" />
                                    OPTION 2: CREDIT CARD (+3%)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-1.5 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal (+3%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.creditSubtotal)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono font-medium">{formatCurrency(dual.creditTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t font-bold text-sm text-foreground">
                                    <span>Total (Credit Card):</span>
                                    <span className="font-mono text-base text-blue-700 font-bold">{formatCurrency(dual.creditTotal)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

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
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground uppercase">
                                            <th className="text-left py-2 font-medium">Service</th>
                                            <th className="text-left py-2 font-medium">Frequency</th>
                                            <th className="text-left py-2 font-medium">Status</th>
                                            <th className="text-right py-2 font-medium">ACH Rate</th>
                                            <th className="text-right py-2 font-medium">Credit Rate (+3%)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-b last:border-0">
                                                <td className="py-3">
                                                    <span className="font-medium">{item.serviceType}</span>
                                                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                                                </td>
                                                <td className="py-3 text-sm">{formatFrequency(item.frequency, item.daysOfWeek)}</td>
                                                <td className="py-3 text-sm">
                                                    {item.lineItemStatus === 'accepted' ? (
                                                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">
                                                            <Check className="w-3 h-3" /> Accepted
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium">
                                                            <Clock className="w-3 h-3" /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right font-medium font-mono">{formatCurrency(item.clientRate)}</td>
                                                <td className="py-3 text-right font-medium font-mono text-blue-700">{formatCurrency(getCreditPrice(item.clientRate))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
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
                </div>
            )}

            {/* Executed / Signed Scope of Work (DocuSign / External Upload) */}
            <Card className="print:hidden border-slate-300 dark:border-slate-800 shadow-xs">
                <CardHeader className="pb-3 border-b bg-slate-50/60 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileCheck className="w-5 h-5 text-blue-600" />
                                Executed / Signed SOW (DocuSign & External)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Attach your signed DocuSign agreement, scanned SOW, or client authorization PDF for records and operations dispatch.
                            </CardDescription>
                        </div>
                        {(quote as any).signedSowUrl && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-medium">
                                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Document Attached
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {/* Hidden file inputs */}
                    <input
                        type="file"
                        ref={sowFileInputRef}
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => handleUploadSowFile(e, false)}
                    />
                    <input
                        type="file"
                        ref={sowAutoAcceptInputRef}
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => handleUploadSowFile(e, true)}
                    />

                    {uploadingSow && (
                        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-xs space-y-2">
                            <div className="flex justify-between font-semibold text-blue-900 dark:text-blue-200">
                                <span>Uploading signed SOW document to secure storage...</span>
                                <span>{sowProgress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div className="bg-blue-600 h-2 transition-all duration-300" style={{ width: `${sowProgress}%` }} />
                            </div>
                        </div>
                    )}

                    {(quote as any).signedSowUrl ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                                        {(quote as any).signedSowName || 'Signed_Statement_of_Work.pdf'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Attached {(quote as any).signedSowUploadedAt?.toDate?.()?.toLocaleDateString() || 'Recently'} • Available to Operations & Field Managers
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
                                    onClick={() => window.open((quote as any).signedSowUrl, '_blank')}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> View Signed SOW (PDF)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-xs text-slate-700"
                                    disabled={uploadingSow}
                                    onClick={() => sowFileInputRef.current?.click()}
                                >
                                    <Upload className="w-3.5 h-3.5" /> Replace
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-destructive hover:bg-destructive/10"
                                    onClick={handleRemoveSow}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-5 text-center space-y-3 bg-slate-50/40 dark:bg-slate-900/20">
                            <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                                <Upload className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Have a signed DocuSign or offline agreement?</p>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    Upload the executed PDF to permanently link the legal document to this quote, active contract, and dispatched work orders.
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 font-medium"
                                    disabled={uploadingSow}
                                    onClick={() => sowFileInputRef.current?.click()}
                                >
                                    <Upload className="w-4 h-4 text-blue-600" /> Upload Signed SOW (PDF)
                                </Button>
                                {(quote.status === 'draft' || quote.status === 'sent') && (
                                    <Button
                                        size="sm"
                                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                        disabled={uploadingSow || converting}
                                        onClick={() => sowAutoAcceptInputRef.current?.click()}
                                    >
                                        <Check className="w-4 h-4" /> Upload & Mark Quote Accepted
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* BreezeDoc E-Sign Section */}
                    <div className="pt-3 border-t">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-950 flex items-center justify-center font-bold text-blue-700 text-xs">
                                    BD
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground">BreezeDoc E-Sign Integration</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        {(quote as any).breezeDocId ? `Linked to document #${(quote as any).breezeDocId}` : 'Send or link an electronic signature envelope'}
                                    </p>
                                </div>
                            </div>

                            {(quote as any).breezeDocId ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={(quote as any).breezeDocStatus === 'completed' ? 'default' : 'outline'} className="text-xs">
                                        {(quote as any).breezeDocStatus === 'completed' ? '✓ Signed in BreezeDoc' : 'Pending Signature'}
                                    </Badge>
                                    {(quote as any).breezeDocRecipientUrl && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs gap-1"
                                            onClick={() => window.open((quote as any).breezeDocRecipientUrl, '_blank')}
                                        >
                                            <ExternalLink className="w-3 h-3" /> Sign / View
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs gap-1 border-blue-300 text-blue-800 bg-blue-50/50"
                                        disabled={breezeSyncing}
                                        onClick={handleCheckBreezeStatus}
                                    >
                                        <RotateCcw className={`w-3 h-3 ${breezeSyncing ? 'animate-spin' : ''}`} />
                                        {breezeSyncing ? 'Checking...' : 'Check Status'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs text-muted-foreground"
                                        onClick={handleUnlinkBreezeDoc}
                                    >
                                        Unlink
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                    onClick={() => {
                                        fetchBreezeDocuments();
                                        setBreezeModalOpen(true);
                                    }}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> Link BreezeDoc Document
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

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

            {/* BreezeDoc Link Modal */}
            {breezeModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between p-5 border-b bg-slate-50 dark:bg-slate-900">
                            <div>
                                <h2 className="text-base font-bold flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-blue-600" /> Link BreezeDoc Document
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Select an envelope or document from your BreezeDoc account to connect to this quote.
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setBreezeModalOpen(false)}>✕</Button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-3 flex-1">
                            {breezeLoading ? (
                                <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                    <RotateCcw className="w-6 h-6 animate-spin text-blue-600" />
                                    <span>Fetching documents from BreezeDoc...</span>
                                </div>
                            ) : breezeDocs.length === 0 ? (
                                <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
                                    <p>No documents found in your BreezeDoc account.</p>
                                    <Button size="sm" variant="outline" onClick={fetchBreezeDocuments}>
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {breezeDocs.map((bDoc: any) => {
                                        const isCompleted = !!bDoc.completed_at;
                                        const isLinked = (quote as any)?.breezeDocId === bDoc.id;

                                        return (
                                            <div
                                                key={bDoc.id}
                                                className={`p-3.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${isLinked ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20' : 'hover:border-slate-300 hover:bg-slate-50/50'}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold truncate text-foreground">
                                                        {bDoc.title || 'Untitled Document'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span>ID: #{bDoc.id}</span>
                                                        <span>•</span>
                                                        <span>{new Date(bDoc.created_at).toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <Badge variant={isCompleted ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                                                            {isCompleted ? 'Completed' : 'In Progress'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={isLinked ? 'secondary' : 'default'}
                                                    className="gap-1.5 text-xs shrink-0"
                                                    onClick={() => handleLinkBreezeDoc(bDoc)}
                                                >
                                                    {isLinked ? 'Linked ✓' : 'Connect'}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground"
                                onClick={fetchBreezeDocuments}
                                disabled={breezeLoading}
                            >
                                <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${breezeLoading ? 'animate-spin' : ''}`} /> Refresh Documents
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setBreezeModalOpen(false)}>Close</Button>
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
