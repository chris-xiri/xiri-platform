'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice, PaymentMethod, VendorRemittance } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, DollarSign, Send, CheckCircle2,
    Building2, FileText, CreditCard, ExternalLink, Copy
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

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'ach', label: 'ACH / Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'venmo', label: 'Venmo' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
];

export default function InvoiceDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { profile, hasRole } = useAuth();
    const [invoice, setInvoice] = useState<(Invoice & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Send modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendEmail, setSendEmail] = useState('');
    const [sendContactName, setSendContactName] = useState('');
    const [sending, setSending] = useState(false);

    // Mark Paid modal
    const [showPaidModal, setShowPaidModal] = useState(false);
    const [paidMethod, setPaidMethod] = useState<PaymentMethod>('ach');
    const [paidReference, setPaidReference] = useState('');
    const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

    // Vendor remittances
    const [remittances, setRemittances] = useState<(VendorRemittance & { id: string })[]>([]);

    useEffect(() => {
        async function fetch() {
            try {
                const snap = await getDoc(doc(db, 'invoices', params.id));
                if (snap.exists()) {
                    const inv = { id: snap.id, ...snap.data() } as Invoice & { id: string };
                    setInvoice(inv);
                    setSendEmail(inv.clientEmail || '');
                    setSendContactName(inv.clientContactName || '');

                    // Fetch linked vendor remittances
                    const remQ = query(collection(db, 'vendor_remittances'), where('invoiceId', '==', snap.id));
                    const remSnap = await getDocs(remQ);
                    setRemittances(remSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRemittance & { id: string })));
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

    // Send invoice to client
    const handleSend = async () => {
        if (!invoice || !profile || !sendEmail) return;
        setSending(true);
        try {
            const userId = profile.uid || profile.email || 'unknown';
            // Generate payment token if not exists
            const paymentToken = invoice.paymentToken || crypto.randomUUID();
            const paymentUrl = `${window.location.origin.replace('dashboard', 'www')}/invoice/pay/${paymentToken}`;

            await updateDoc(doc(db, 'invoices', invoice.id), {
                status: 'sent',
                clientEmail: sendEmail,
                clientContactName: sendContactName,
                paymentToken,
                sentAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Queue email via Firestore (picked up by Cloud Function with Resend)
            await addDoc(collection(db, 'mail_queue'), {
                to: sendEmail,
                subject: `Invoice from XIRI Facility Solutions — ${invoice.billingPeriod?.start || 'Monthly'}`,
                templateType: 'client_invoice',
                templateData: {
                    clientName: sendContactName || invoice.clientBusinessName,
                    businessName: invoice.clientBusinessName,
                    totalAmount: invoice.totalAmount,
                    billingPeriod: invoice.billingPeriod,
                    dueDate: invoice.dueDate,
                    paymentUrl,
                    lineItems: invoice.lineItems,
                },
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'INVOICE_SENT',
                invoiceId: invoice.id,
                clientBusinessName: invoice.clientBusinessName,
                sentTo: sendEmail,
                sentBy: userId,
                createdAt: serverTimestamp(),
            });

            setInvoice({ ...invoice, status: 'sent', clientEmail: sendEmail, paymentToken });
            setShowSendModal(false);
        } catch (err) {
            console.error('Error sending:', err);
        } finally {
            setSending(false);
        }
    };

    // Mark invoice as paid
    const handleMarkPaid = async () => {
        if (!invoice || !profile) return;
        setUpdating(true);
        try {
            const userId = profile.uid || profile.email || 'unknown';
            await updateDoc(doc(db, 'invoices', invoice.id), {
                status: 'paid',
                paidAt: new Date(paidDate),
                paymentMethod: paidMethod,
                paymentReference: paidReference || null,
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'INVOICE_PAID',
                invoiceId: invoice.id,
                clientBusinessName: invoice.clientBusinessName,
                totalAmount: invoice.totalAmount,
                paymentMethod: paidMethod,
                paymentReference: paidReference,
                markedBy: userId,
                createdAt: serverTimestamp(),
            });

            setInvoice({ ...invoice, status: 'paid', paymentMethod: paidMethod, paymentReference: paidReference });
            setShowPaidModal(false);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setUpdating(false);
        }
    };

    // Void invoice
    const handleVoid = async () => {
        if (!invoice || !profile) return;
        setUpdating(true);
        try {
            const userId = profile.uid || profile.email || 'unknown';
            await updateDoc(doc(db, 'invoices', invoice.id), {
                status: 'void',
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'activity_logs'), {
                type: 'INVOICE_VOIDED',
                invoiceId: invoice.id,
                clientBusinessName: invoice.clientBusinessName,
                voidedBy: userId,
                createdAt: serverTimestamp(),
            });
            setInvoice({ ...invoice, status: 'void' });
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

    const config = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
    const canSeeMargins = hasRole('admin'); // TODO: expand when 'accounting'/'fsm' roles are added to UserRole

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
                        <Button onClick={() => setShowSendModal(true)} disabled={updating} className="gap-2">
                            <Send className="w-4 h-4" /> Send to Client
                        </Button>
                    )}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                        <Button onClick={() => setShowPaidModal(true)} disabled={updating} className="gap-2 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-4 h-4" /> Mark Paid
                        </Button>
                    )}
                    {invoice.status !== 'void' && invoice.status !== 'paid' && (
                        <Button variant="outline" onClick={handleVoid} disabled={updating} size="sm">
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
                                <p className="text-xs text-muted-foreground uppercase mb-1">Contact</p>
                                <p className="font-medium">{invoice.clientContactName || '—'}</p>
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
                                        : typeof invoice.dueDate === 'string' ? invoice.dueDate : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Invoice ID</p>
                                <p className="font-mono text-xs">{invoice.id.slice(0, 12)}</p>
                            </div>
                            {invoice.clientEmail && (
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase mb-1">Email</p>
                                    <p className="text-xs">{invoice.clientEmail}</p>
                                </div>
                            )}
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
                                    {(invoice.totalTax ?? 0) > 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-sm text-muted-foreground">Sales Tax</td>
                                            <td className="px-4 py-2 text-right text-sm">{formatCurrency(invoice.totalTax!)}</td>
                                        </tr>
                                    )}
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

                    {/* Vendor Payouts — only visible to admin/accounting/fsm */}
                    {canSeeMargins && invoice.vendorPayouts && invoice.vendorPayouts.length > 0 && (
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

                    {/* Linked Vendor Remittances */}
                    {canSeeMargins && remittances.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Vendor Remittances ({remittances.length})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {remittances.map(rem => (
                                    <Link
                                        key={rem.id}
                                        href={`/accounting/vendor-remittances/${rem.id}`}
                                        className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-all"
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{rem.vendorName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {rem.lineItems?.length || 0} line items
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-sm">{formatCurrency(rem.totalAmount)}</span>
                                            <Badge variant={rem.status === 'paid' ? 'outline' : 'secondary'} className="text-xs capitalize">
                                                {rem.status}
                                            </Badge>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                        </div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Summary */}
                <div className="space-y-4">
                    {/* Financial Summary */}
                    {canSeeMargins && (
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
                    )}

                    {/* Payment Info */}
                    {invoice.status === 'paid' && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {invoice.paymentMethod && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Method</span>
                                        <span className="font-medium capitalize">{invoice.paymentMethod.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {invoice.paymentReference && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Reference</span>
                                        <span className="font-mono text-xs">{invoice.paymentReference}</span>
                                    </div>
                                )}
                                {invoice.paidAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Paid On</span>
                                        <span>{invoice.paidAt?.toDate?.()?.toLocaleDateString() || '—'}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment Link */}
                    {invoice.paymentToken && invoice.status !== 'void' && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Payment Link</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2 text-xs"
                                    onClick={() => {
                                        const url = `${window.location.origin.replace('dashboard', 'www')}/invoice/pay/${invoice.paymentToken}`;
                                        navigator.clipboard.writeText(url);
                                    }}
                                >
                                    <Copy className="w-3 h-3" /> Copy Payment Link
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Status Timeline */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>Created</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {invoice.createdAt?.toDate?.()?.toLocaleDateString() || '—'}
                                </span>
                            </div>
                            {(invoice.status !== 'draft') && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Sent</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {invoice.sentAt?.toDate?.()?.toLocaleDateString() || '—'}
                                    </span>
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

            {/* Send to Client Modal */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold">Send Invoice to Client</h2>
                                <p className="text-sm text-muted-foreground">{invoice.clientBusinessName} • {formatCurrency(invoice.totalAmount)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label className="text-sm">Contact Name</Label>
                                <Input
                                    placeholder="John Smith"
                                    value={sendContactName}
                                    onChange={(e) => setSendContactName(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-sm">Email Address</Label>
                                <Input
                                    type="email"
                                    placeholder="john@business.com"
                                    value={sendEmail}
                                    onChange={(e) => setSendEmail(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                                <p>📧 The client will receive an email with their invoice summary and a secure payment link where they can choose how to pay (ACH, Zelle, Venmo, etc.)</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
                            <Button onClick={handleSend} disabled={!sendEmail || sending} className="gap-2">
                                {sending ? 'Sending...' : 'Send Invoice'}
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark Paid Modal */}
            {showPaidModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold">Record Payment</h2>
                                <p className="text-sm text-muted-foreground">{invoice.clientBusinessName} • {formatCurrency(invoice.totalAmount)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowPaidModal(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label className="text-sm">Payment Method</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                    value={paidMethod}
                                    onChange={(e) => setPaidMethod(e.target.value as PaymentMethod)}
                                >
                                    {PAYMENT_METHODS.map(pm => (
                                        <option key={pm.value} value={pm.value}>{pm.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-sm">Reference / Confirmation #</Label>
                                <Input
                                    placeholder="Check #1234 or transaction ID"
                                    value={paidReference}
                                    onChange={(e) => setPaidReference(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-sm">Date Received</Label>
                                <Input
                                    type="date"
                                    value={paidDate}
                                    onChange={(e) => setPaidDate(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowPaidModal(false)}>Cancel</Button>
                            <Button
                                onClick={handleMarkPaid}
                                disabled={updating}
                                className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                                {updating ? 'Recording...' : 'Confirm Payment'}
                                <CheckCircle2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
