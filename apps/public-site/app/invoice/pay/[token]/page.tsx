'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Initialize Firebase (public-site config)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

interface InvoiceData {
    id: string;
    clientBusinessName: string;
    lineItems: Array<{
        locationName: string;
        locationAddress?: string;
        serviceType: string;
        frequency: string;
        amount: number;
    }>;
    totalAmount: number;
    billingPeriod?: { start: string; end: string };
    dueDate?: any;
    status: string;
}

const PAYMENT_OPTIONS = [
    { id: 'ach', label: 'ACH / Bank Transfer', description: 'Direct bank transfer — no processing fees', icon: '🏦' },
    { id: 'check', label: 'Check', description: 'Mail a check to our office', icon: '📝' },
    { id: 'zelle', label: 'Zelle', description: 'Send via Zelle to billing@xiri.ai', icon: '💸' },
    { id: 'credit_card', label: 'Credit Card', description: 'Coming soon — Stripe integration', icon: '💳', disabled: true },
];

export default function InvoicePayPage() {
    const params = useParams();
    const token = params.token as string;

    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    useEffect(() => {
        async function fetchInvoice() {
            try {
                const db = getFirestore(app);
                const q = query(collection(db, 'invoices'), where('paymentToken', '==', token));
                const snap = await getDocs(q);

                if (snap.empty) {
                    setError('This invoice link is invalid or has expired.');
                    return;
                }

                const doc = snap.docs[0];
                const data = doc.data();

                // Only show client-safe data (no vendor rates, no margins)
                setInvoice({
                    id: doc.id,
                    clientBusinessName: data.clientBusinessName,
                    lineItems: (data.lineItems || []).map((li: any) => ({
                        locationName: li.locationName,
                        locationAddress: li.locationAddress,
                        serviceType: li.serviceType,
                        frequency: li.frequency,
                        amount: li.amount,
                    })),
                    totalAmount: data.totalAmount,
                    billingPeriod: data.billingPeriod,
                    dueDate: data.dueDate,
                    status: data.status,
                });
            } catch (err) {
                console.error('Error fetching invoice:', err);
                setError('Something went wrong. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        fetchInvoice();
    }, [token]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-500 text-sm">Loading your invoice...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="max-w-md text-center">
                    <div className="text-5xl mb-4">🔒</div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
                    <p className="text-gray-500 text-sm">{error}</p>
                    <p className="text-gray-400 text-xs mt-4">
                        If you believe this is an error, please contact your Facility Solutions Manager or email{' '}
                        <a href="mailto:billing@xiri.ai" className="text-sky-600 hover:underline">billing@xiri.ai</a>
                    </p>
                </div>
            </div>
        );
    }

    if (!invoice) return null;

    const isPaid = invoice.status === 'paid';

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-sky-700 tracking-tight">XIRI</h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-[3px] mt-0.5">Facility Solutions</p>
            </div>

            {/* Paid Status */}
            {isPaid && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <h2 className="text-lg font-bold text-green-800">Payment Received</h2>
                    <p className="text-sm text-green-600 mt-1">Thank you! This invoice has been paid.</p>
                </div>
            )}

            {/* Invoice Card */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Invoice Header */}
                <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sky-100 text-xs uppercase tracking-wider">Invoice for</p>
                            <h2 className="text-xl font-bold mt-0.5">{invoice.clientBusinessName}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-sky-100 text-xs uppercase tracking-wider">Amount Due</p>
                            <p className="text-2xl font-bold mt-0.5">{formatCurrency(invoice.totalAmount)}</p>
                        </div>
                    </div>
                    {invoice.billingPeriod && (
                        <p className="text-sky-200 text-xs mt-3">
                            Billing Period: {invoice.billingPeriod.start} — {invoice.billingPeriod.end}
                        </p>
                    )}
                </div>

                {/* Line Items */}
                <div className="px-6 py-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Services</h3>
                    <div className="space-y-2">
                        {invoice.lineItems.map((li, i) => (
                            <div key={i} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{li.serviceType}</p>
                                    <p className="text-xs text-gray-500">
                                        {li.locationName}
                                        {li.locationAddress && <span className="block text-gray-400">{li.locationAddress}</span>}
                                    </p>
                                    <p className="text-xs text-gray-400 capitalize">{li.frequency}</p>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(li.amount)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center pt-4 mt-2 border-t-2">
                        <p className="text-sm font-bold text-gray-900">Total</p>
                        <p className="text-xl font-bold text-sky-700">{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                </div>

                {/* Payment Section (only if not already paid) */}
                {!isPaid && (
                    <div className="border-t px-6 py-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Select Payment Method</h3>
                        <div className="space-y-2">
                            {PAYMENT_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    disabled={opt.disabled}
                                    onClick={() => setSelectedMethod(opt.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                                        ${selectedMethod === opt.id
                                            ? 'border-sky-500 bg-sky-50'
                                            : opt.disabled
                                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                                : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50/30'
                                        }
                                    `}
                                >
                                    <span className="text-2xl">{opt.icon}</span>
                                    <div>
                                        <p className={`text-sm font-medium ${selectedMethod === opt.id ? 'text-sky-700' : 'text-gray-900'}`}>
                                            {opt.label}
                                        </p>
                                        <p className="text-xs text-gray-500">{opt.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Payment Instructions (show when selected) */}
                        {selectedMethod && (
                            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-sm font-medium text-amber-800 mb-2">📋 Payment Instructions</p>
                                {selectedMethod === 'ach' && (
                                    <div className="text-sm text-amber-700 space-y-1">
                                        <p>Please initiate a bank transfer to our account. Your Facility Solutions Manager will provide the routing and account details.</p>
                                        <p className="text-xs text-amber-600 mt-2">Contact: <a href="mailto:billing@xiri.ai" className="underline">billing@xiri.ai</a></p>
                                    </div>
                                )}
                                {selectedMethod === 'check' && (
                                    <div className="text-sm text-amber-700 space-y-1">
                                        <p>Please make the check payable to <strong>Xiri Facility Solutions LLC</strong> and mail to:</p>
                                        <p className="font-mono text-xs mt-1">Xiri Facility Solutions<br />Attn: Accounting<br />[Address on file]</p>
                                    </div>
                                )}
                                {selectedMethod === 'zelle' && (
                                    <div className="text-sm text-amber-700 space-y-1">
                                        <p>Send your payment via Zelle to:</p>
                                        <p className="font-mono text-xs mt-1 font-bold">billing@xiri.ai</p>
                                        <p className="text-xs text-amber-600 mt-1">Please include your business name in the memo.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center mt-8">
                <p className="text-xs text-gray-400">
                    Xiri Facility Solutions • <a href="https://xiri.ai" className="text-sky-600 hover:underline">xiri.ai</a>
                </p>
                <p className="text-xs text-gray-300 mt-1">
                    Questions? Contact <a href="mailto:billing@xiri.ai" className="text-sky-500 hover:underline">billing@xiri.ai</a>
                </p>
            </div>
        </div>
    );
}
