'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, Loader2, DollarSign, CreditCard } from 'lucide-react';

type PaymentMethod = 'venmo' | 'paypal' | 'ach';

export default function PaymentInfoPage({ params }: { params: { id: string } }) {
    const referralId = params.id;

    const [loading, setLoading] = useState(true);
    const [referralData, setReferralData] = useState<any>(null);
    const [notFound, setNotFound] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [method, setMethod] = useState<PaymentMethod>('venmo');
    const [venmoHandle, setVenmoHandle] = useState('');
    const [paypalEmail, setPaypalEmail] = useState('');
    const [routingNumber, setRoutingNumber] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const docRef = doc(db, 'referral_leads', referralId);
                const snap = await getDoc(docRef);
                if (!snap.exists()) {
                    setNotFound(true);
                } else {
                    const data = snap.data();
                    setReferralData(data);
                    // Pre-fill if already submitted
                    if (data.paymentInfo) {
                        setMethod(data.paymentInfo.method || 'venmo');
                        setVenmoHandle(data.paymentInfo.venmoHandle || '');
                        setPaypalEmail(data.paymentInfo.paypalEmail || '');
                        setRoutingNumber(data.paymentInfo.routingNumber || '');
                        setAccountNumber(data.paymentInfo.accountNumber || '');
                        setAccountName(data.paymentInfo.accountName || '');
                        setSubmitted(true);
                    }
                }
            } catch (err) {
                console.error('Error loading referral:', err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [referralId]);

    const canSubmit = () => {
        if (method === 'venmo') return venmoHandle.trim().length > 0;
        if (method === 'paypal') return paypalEmail.trim().length > 0;
        if (method === 'ach') return routingNumber.trim().length >= 9 && accountNumber.trim().length > 0 && accountName.trim().length > 0;
        return false;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit()) return;

        setSubmitting(true);
        try {
            const paymentInfo: Record<string, string> = { method };
            if (method === 'venmo') paymentInfo.venmoHandle = venmoHandle.trim();
            if (method === 'paypal') paymentInfo.paypalEmail = paypalEmail.trim();
            if (method === 'ach') {
                paymentInfo.routingNumber = routingNumber.trim();
                paymentInfo.accountNumber = accountNumber.trim();
                paymentInfo.accountName = accountName.trim();
            }

            await updateDoc(doc(db, 'referral_leads', referralId), {
                paymentInfo,
                paymentInfoUpdatedAt: serverTimestamp(),
            });

            setSubmitted(true);
        } catch (err) {
            console.error('Error saving payment info:', err);
            alert('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ──
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // ── Not found ──
    if (notFound) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Referral Not Found</h1>
                    <p className="text-slate-600">This referral link may be invalid or expired. Contact us at <a href="mailto:chris@xiri.ai" className="text-emerald-600 underline">chris@xiri.ai</a>.</p>
                </div>
            </div>
        );
    }

    // ── Already submitted ──
    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Info Saved!</h1>
                    <p className="text-slate-600 mb-4">
                        We have your {method === 'venmo' ? 'Venmo' : method === 'paypal' ? 'PayPal' : 'bank'} details on file.
                        We&apos;ll send your payment after the walkthrough at <strong>{referralData?.buildingName}</strong>.
                    </p>
                    <button
                        onClick={() => setSubmitted(false)}
                        className="text-emerald-600 font-semibold text-sm hover:text-emerald-700 underline"
                    >
                        Update payment info →
                    </button>
                </div>
            </div>
        );
    }

    const methodOptions: { value: PaymentMethod; label: string; icon: string }[] = [
        { value: 'venmo', label: 'Venmo', icon: '💸' },
        { value: 'paypal', label: 'PayPal', icon: '🅿️' },
        { value: 'ach', label: 'Bank Transfer (ACH)', icon: '🏦' },
    ];

    const inputClass = "w-full h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow outline-none";

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-6 h-6" />
                        <div>
                            <h1 className="text-lg font-bold">Payment Information</h1>
                            <p className="text-emerald-100 text-sm">For your referral of {referralData?.buildingName}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Referrer info */}
                    <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 border border-slate-200 flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Hi <strong>{referralData?.referrerName}</strong> — tell us where to send your payout</span>
                    </div>

                    {/* Method selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {methodOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setMethod(opt.value)}
                                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                                        method === opt.value
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="block text-lg mb-1">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Method-specific fields */}
                    <div className="space-y-3">
                        {method === 'venmo' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Venmo Username</label>
                                <input
                                    type="text"
                                    value={venmoHandle}
                                    onChange={(e) => setVenmoHandle(e.target.value)}
                                    placeholder="@your-venmo-handle"
                                    className={inputClass}
                                    required
                                />
                            </div>
                        )}

                        {method === 'paypal' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">PayPal Email</label>
                                <input
                                    type="email"
                                    value={paypalEmail}
                                    onChange={(e) => setPaypalEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className={inputClass}
                                    required
                                />
                            </div>
                        )}

                        {method === 'ach' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Holder Name</label>
                                    <input
                                        type="text"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        placeholder="John Smith"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Routing Number</label>
                                    <input
                                        type="text"
                                        value={routingNumber}
                                        onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                        placeholder="9 digits"
                                        maxLength={9}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                                    <input
                                        type="text"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Account number"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !canSubmit()}
                        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : (
                            <>Save Payment Info</>
                        )}
                    </button>

                    <p className="text-xs text-slate-400 text-center">
                        Your payment information is stored securely. Questions? <a href="mailto:chris@xiri.ai" className="text-emerald-600 underline">chris@xiri.ai</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
