'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Quote, QuoteLineItem } from '@xiri/shared';
import { SCOPE_TEMPLATES } from '@/data/scopeTemplates';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Check, X, Printer, FileText, MapPin,
    DollarSign, Calendar, Clock, Building2, AlertTriangle
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

export default function QuoteDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const [quote, setQuote] = useState<(Quote & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [converting, setConverting] = useState(false);

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

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const handleAccept = async () => {
        if (!quote || !profile) return;
        setConverting(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const now = new Date();

            // 1. Create Contract
            const contractRef = await addDoc(collection(db, 'contracts'), {
                leadId: quote.leadId,
                quoteId: quote.id,
                clientBusinessName: quote.leadBusinessName,
                clientAddress: '',
                signerName: '',
                signerTitle: '',
                totalMonthlyRate: quote.totalMonthlyRate,
                contractTenure: quote.contractTenure,
                startDate: serverTimestamp(),
                endDate: new Date(now.getFullYear(), now.getMonth() + quote.contractTenure, now.getDate()),
                paymentTerms: quote.paymentTerms,
                exitClause: quote.exitClause || '30-day written notice',
                status: 'active',
                createdBy: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 2. Create Work Orders (one per line item)
            for (const item of quote.lineItems) {
                // Find matching scope template for tasks
                const template = SCOPE_TEMPLATES.find(t => t.name.toLowerCase().includes(item.serviceType.toLowerCase()));
                const tasks = template
                    ? template.tasks.map((t, i) => ({ id: `task_${i}`, name: t.name, description: t.description, required: t.required }))
                    : [];

                await addDoc(collection(db, 'work_orders'), {
                    leadId: quote.leadId,
                    contractId: contractRef.id,
                    quoteLineItemId: item.id,
                    locationId: item.locationId,
                    locationName: item.locationName,
                    serviceType: item.serviceType,
                    scopeTemplateId: item.scopeTemplateId || null,
                    tasks,
                    vendorId: null,
                    vendorRate: null,
                    vendorHistory: [],
                    schedule: {
                        daysOfWeek: [false, true, true, true, true, true, false], // Mon-Fri
                        startTime: template?.defaultStartTime || '21:00',
                        frequency: item.frequency,
                    },
                    qrCodeSecret: crypto.randomUUID(),
                    clientRate: item.clientRate,
                    margin: null,
                    status: 'pending_assignment',
                    assignedBy: null,
                    notes: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            // 3. Update Quote status
            await updateDoc(doc(db, 'quotes', quote.id), {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 4. Update Lead status to 'won'
            await updateDoc(doc(db, 'leads', quote.leadId), {
                status: 'won',
                contractId: contractRef.id,
                wonAt: serverTimestamp(),
            });

            // 5. Log activity
            await addDoc(collection(db, 'activity_logs'), {
                type: 'QUOTE_ACCEPTED',
                quoteId: quote.id,
                leadId: quote.leadId,
                contractId: contractRef.id,
                workOrderCount: quote.lineItems.length,
                createdBy: userId,
                createdAt: serverTimestamp(),
            });

            // Refresh
            setQuote({ ...quote, status: 'accepted' });
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
                            ID: {quote.id?.slice(0, 8)} • Created {quote.createdAt?.toDate?.()?.toLocaleDateString() || '—'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                </div>
            </div>

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
                                        <th className="text-right py-2 font-medium">Monthly Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id} className="border-b last:border-0">
                                            <td className="py-3">
                                                <span className="font-medium">{item.serviceType}</span>
                                                {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                                            </td>
                                            <td className="py-3 capitalize text-sm">{item.frequency}</td>
                                            <td className="py-3 text-right font-medium">{formatCurrency(item.clientRate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t">
                                        <td colSpan={2} className="py-3 font-medium text-sm">Location Subtotal</td>
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
            {quote.status === 'draft' || quote.status === 'sent' ? (
                <Card className="print:hidden border-primary/30 bg-primary/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg">Ready to close?</h3>
                                <p className="text-sm text-muted-foreground">
                                    Accepting will create a Contract and generate Work Orders for the FSM.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={handleReject}
                                >
                                    <X className="w-4 h-4" /> Mark Rejected
                                </Button>
                                <Button
                                    className="gap-2 bg-green-600 hover:bg-green-700"
                                    onClick={handleAccept}
                                    disabled={converting}
                                >
                                    {converting ? (
                                        'Converting...'
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" /> Mark Accepted
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : quote.status === 'accepted' ? (
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
            ) : null}
        </div>
    );
}
