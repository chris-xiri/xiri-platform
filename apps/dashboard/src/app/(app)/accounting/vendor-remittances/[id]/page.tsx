'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { VendorRemittance, PaymentMethod } from '@xiri/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Send, CheckCircle2, FileText,
    CreditCard, Building2
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    sent: { variant: 'default', label: 'Sent to Vendor' },
    paid: { variant: 'outline', label: 'Paid' },
    void: { variant: 'secondary', label: 'Void' },
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'ach', label: 'ACH / Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'venmo', label: 'Venmo' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
];

export default function VendorRemittanceDetailPage({ params }: PageProps) {
    const { profile } = useAuth();
    const [rem, setRem] = useState<(VendorRemittance & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Send modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [vendorEmail, setVendorEmail] = useState('');
    const [sending, setSending] = useState(false);

    // Pay modal
    const [showPayModal, setShowPayModal] = useState(false);
    const [payMethod, setPayMethod] = useState<PaymentMethod>('ach');
    const [payReference, setPayReference] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        async function fetch() {
            try {
                const snap = await getDoc(doc(db, 'vendor_remittances', params.id));
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as VendorRemittance & { id: string };
                    setRem(data);
                    setVendorEmail(data.vendorEmail || '');
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

    // Send remittance to vendor
    const handleSend = async () => {
        if (!rem || !profile || !vendorEmail) return;
        setSending(true);
        try {
            const userId = profile.uid || profile.email || 'unknown';
            await updateDoc(doc(db, 'vendor_remittances', rem.id), {
                status: 'sent',
                vendorEmail,
                sentAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Queue email via Firestore (picked up by Cloud Function with Resend)
            await addDoc(collection(db, 'mail_queue'), {
                to: vendorEmail,
                subject: `Remittance Statement from XIRI Facility Solutions — ${rem.billingPeriod?.start || 'Monthly'}`,
                templateType: 'vendor_remittance',
                templateData: {
                    vendorName: rem.vendorName,
                    totalAmount: rem.totalAmount,
                    billingPeriod: rem.billingPeriod,
                    lineItems: rem.lineItems,
                },
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'VENDOR_REMITTANCE_SENT',
                remittanceId: rem.id,
                vendorName: rem.vendorName,
                sentTo: vendorEmail,
                sentBy: userId,
                createdAt: serverTimestamp(),
            });

            setRem({ ...rem, status: 'sent', vendorEmail });
            setShowSendModal(false);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setSending(false);
        }
    };

    // Mark vendor as paid
    const handleMarkPaid = async () => {
        if (!rem || !profile) return;
        setUpdating(true);
        try {
            const userId = profile.uid || profile.email || 'unknown';
            await updateDoc(doc(db, 'vendor_remittances', rem.id), {
                status: 'paid',
                paidAt: new Date(payDate),
                paymentMethod: payMethod,
                paymentReference: payReference || null,
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'VENDOR_PAYOUT_COMPLETED',
                remittanceId: rem.id,
                vendorName: rem.vendorName,
                totalAmount: rem.totalAmount,
                paymentMethod: payMethod,
                paymentReference: payReference,
                paidBy: userId,
                createdAt: serverTimestamp(),
            });

            setRem({ ...rem, status: 'paid', paymentMethod: payMethod, paymentReference: payReference });
            setShowPayModal(false);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!rem) return <div className="p-8 text-center">Remittance not found</div>;

    const config = STATUS_CONFIG[rem.status] || STATUS_CONFIG.pending;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/accounting/vendor-remittances" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            Vendor Remittance
                            <Badge variant={config.variant}>{config.label}</Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {rem.vendorName} • {rem.billingPeriod?.start || '—'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {(rem.status === 'pending') && (
                        <Button onClick={() => setShowSendModal(true)} disabled={updating} className="gap-2">
                            <Send className="w-4 h-4" /> Send to Vendor
                        </Button>
                    )}
                    {(rem.status === 'pending' || rem.status === 'sent') && (
                        <Button onClick={() => setShowPayModal(true)} disabled={updating} className="gap-2 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-4 h-4" /> Mark Paid
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Vendor Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" /> Vendor Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Vendor</p>
                                <p className="font-medium">{rem.vendorName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Billing Period</p>
                                <p className="font-medium">{rem.billingPeriod?.start} to {rem.billingPeriod?.end}</p>
                            </div>
                            {rem.vendorEmail && (
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase mb-1">Email</p>
                                    <p className="text-xs">{rem.vendorEmail}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Linked Invoice</p>
                                <Link href={`/accounting/invoices/${rem.invoiceId}`} className="text-xs text-primary hover:underline">
                                    View Client Invoice →
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                Services ({rem.lineItems?.length || 0})
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
                                    {(rem.lineItems || []).map((li, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="px-4 py-3 font-medium">{li.serviceType}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-muted-foreground">{li.locationName}</span>
                                                {li.locationAddress && (
                                                    <span className="block text-xs text-muted-foreground/70">{li.locationAddress}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground capitalize">{li.frequency}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(li.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 bg-muted/20">
                                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-base">Total Owed</td>
                                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatCurrency(rem.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                    {/* Payment Info */}
                    {rem.status === 'paid' && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {rem.paymentMethod && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Method</span>
                                        <span className="font-medium capitalize">{rem.paymentMethod.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {rem.paymentReference && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Reference</span>
                                        <span className="font-mono text-xs">{rem.paymentReference}</span>
                                    </div>
                                )}
                                {rem.paidAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Paid On</span>
                                        <span>{rem.paidAt?.toDate?.()?.toLocaleDateString() || '—'}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Timeline */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>Created</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {rem.createdAt?.toDate?.()?.toLocaleDateString() || '—'}
                                </span>
                            </div>
                            {(rem.status === 'sent' || rem.status === 'paid') && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Sent to Vendor</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {rem.sentAt?.toDate?.()?.toLocaleDateString() || '—'}
                                    </span>
                                </div>
                            )}
                            {rem.status === 'paid' && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>Paid</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {rem.paidAt?.toDate?.()?.toLocaleDateString() || '—'}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Send to Vendor Modal */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold">Send Remittance to Vendor</h2>
                                <p className="text-sm text-muted-foreground">{rem.vendorName} • {formatCurrency(rem.totalAmount)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label className="text-sm">Vendor Email</Label>
                                <Input
                                    type="email"
                                    placeholder="vendor@company.com"
                                    value={vendorEmail}
                                    onChange={(e) => setVendorEmail(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                                <p>📧 The vendor will receive a remittance statement showing the services they performed, locations, and the total amount owed to them.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
                            <Button onClick={handleSend} disabled={!vendorEmail || sending} className="gap-2">
                                {sending ? 'Sending...' : 'Send Remittance'}
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark Paid Modal */}
            {showPayModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold">Record Vendor Payment</h2>
                                <p className="text-sm text-muted-foreground">{rem.vendorName} • {formatCurrency(rem.totalAmount)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowPayModal(false)}>✕</Button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label className="text-sm">Payment Method</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                    value={payMethod}
                                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                                >
                                    {PAYMENT_METHODS.map(pm => (
                                        <option key={pm.value} value={pm.value}>{pm.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-sm">Reference / Confirmation #</Label>
                                <Input
                                    placeholder="Transaction ID, check #"
                                    value={payReference}
                                    onChange={(e) => setPayReference(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-sm">Date Paid</Label>
                                <Input
                                    type="date"
                                    value={payDate}
                                    onChange={(e) => setPayDate(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
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
