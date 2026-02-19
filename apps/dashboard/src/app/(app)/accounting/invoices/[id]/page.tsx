'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Receipt, DollarSign, Send, CheckCircle2,
    Clock, Building2, FileText, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    paid: { variant: 'outline', label: 'Paid' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    void: { variant: 'secondary', label: 'Void' },
};

export default function InvoiceDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const [invoice, setInvoice] = useState<(Invoice & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        async function fetch() {
            try {
                const snap = await getDoc(doc(db, 'invoices', params.id));
                if (snap.exists()) {
                    setInvoice({ id: snap.id, ...snap.data() } as Invoice & { id: string });
                }
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, [params.id]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const handleStatusChange = async (newStatus: string) => {
        if (!invoice || !profile) return;
        setUpdating(true);
        try {
            const updates: any = {
                status: newStatus,
                updatedAt: serverTimestamp(),
            };
            if (newStatus === 'paid') {
                updates.paidAt = serverTimestamp();
            }
            await updateDoc(doc(db, 'invoices', invoice.id), updates);
            await addDoc(collection(db, 'activity_logs'), {
                type: 'INVOICE_STATUS_CHANGE',
                invoiceId: invoice.id,
                clientBusinessName: invoice.clientBusinessName,
                fromStatus: invoice.status,
                toStatus: newStatus,
                changedBy: profile.uid || profile.email || 'unknown',
                createdAt: serverTimestamp(),
            });
            setInvoice({ ...invoice, ...updates, status: newStatus as any });
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

    const config = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/accounting/invoices" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            Invoice
                            <Badge variant={config.variant}>{config.label}</Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {invoice.clientBusinessName} • {invoice.billingPeriod?.start || '—'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {invoice.status === 'draft' && (
                        <Button onClick={() => handleStatusChange('sent')} disabled={updating} className="gap-2">
                            <Send className="w-4 h-4" /> Mark Sent
                        </Button>
                    )}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                        <Button onClick={() => handleStatusChange('paid')} disabled={updating} className="gap-2 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-4 h-4" /> Mark Paid
                        </Button>
                    )}
                    {invoice.status !== 'void' && invoice.status !== 'paid' && (
                        <Button variant="outline" onClick={() => handleStatusChange('void')} disabled={updating} size="sm">
                            Void
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Client Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" /> Client Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Business</p>
                                <p className="font-medium">{invoice.clientBusinessName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Billing Period</p>
                                <p className="font-medium">
                                    {invoice.billingPeriod?.start} to {invoice.billingPeriod?.end}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Due Date</p>
                                <p className="font-medium">
                                    {invoice.dueDate?.toDate?.()
                                        ? invoice.dueDate.toDate().toLocaleDateString()
                                        : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Invoice ID</p>
                                <p className="font-mono text-xs">{invoice.id.slice(0, 12)}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                Line Items ({invoice.lineItems?.length || 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Service</th>
                                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Location</th>
                                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Freq</th>
                                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(invoice.lineItems || []).map((li, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="px-4 py-3 font-medium">{li.serviceType}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{li.locationName}</td>
                                            <td className="px-4 py-3 text-muted-foreground capitalize">{li.frequency}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(li.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/20">
                                        <td colSpan={3} className="px-4 py-3 text-right font-medium">Subtotal</td>
                                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(invoice.subtotal)}</td>
                                    </tr>
                                    {invoice.adjustments !== undefined && invoice.adjustments !== 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-sm text-muted-foreground">Adjustments</td>
                                            <td className="px-4 py-2 text-right text-sm">{formatCurrency(invoice.adjustments!)}</td>
                                        </tr>
                                    )}
                                    <tr className="border-t-2">
                                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-base">Total Due</td>
                                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatCurrency(invoice.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Vendor Payouts */}
                    {invoice.vendorPayouts && invoice.vendorPayouts.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                                    Vendor Payouts ({invoice.vendorPayouts.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vendor</th>
                                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Service</th>
                                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                                            <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.vendorPayouts.map((vp, i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="px-4 py-3 font-medium">{vp.vendorName}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{vp.serviceType}</td>
                                                <td className="px-4 py-3 text-right font-medium">{formatCurrency(vp.amount)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant={vp.status === 'paid' ? 'outline' : 'secondary'} className="text-xs capitalize">
                                                        {vp.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-muted/20">
                                            <td colSpan={2} className="px-4 py-3 text-right font-medium">Total Payouts</td>
                                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(invoice.totalPayouts)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Summary */}
                <div className="space-y-4">
                    {/* Financial Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Client Charges</span>
                                <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Vendor Payouts</span>
                                <span className="font-medium text-red-600">−{formatCurrency(invoice.totalPayouts)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <span className="font-medium">Gross Margin</span>
                                <span className={`text-lg font-bold ${(invoice.grossMargin || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(invoice.grossMargin || 0)}
                                </span>
                            </div>
                            {invoice.totalAmount > 0 && (
                                <p className="text-xs text-muted-foreground text-right">
                                    {Math.round(((invoice.grossMargin || 0) / invoice.totalAmount) * 100)}% margin
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Status Timeline */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>Created</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {invoice.createdAt?.toDate?.()?.toLocaleDateString() || '—'}
                                </span>
                            </div>
                            {invoice.status !== 'draft' && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Sent</span>
                                </div>
                            )}
                            {invoice.status === 'paid' && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>Paid</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {invoice.paidAt?.toDate?.()?.toLocaleDateString() || '—'}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
