'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { trackEvent } from '@/lib/tracking';
import { SITE } from '@/lib/constants';

// Initialize Firebase (public-site has its own config)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const functions = getFunctions(app);

interface QuoteData {
    id: string;
    leadBusinessName: string;
    lineItems: Array<{
        locationName: string;
        serviceType: string;
        frequency: string;
        clientRate: number;
    }>;
    totalMonthlyRate: number;
    contractTenure: number;
    paymentTerms: string;
    exitClause?: string;
    status: string;
}

export default function QuoteReviewPage() {
    const params = useParams();
    const token = params.token as string;

    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [responded, setResponded] = useState(false);
    const [responseType, setResponseType] = useState<'accepted' | 'changes_requested' | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showChangesForm, setShowChangesForm] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'ach_check' | 'credit_card'>('ach_check');

    useEffect(() => {
        async function fetchQuote() {
            try {
                const db = getFirestore(app);
                const q = query(collection(db, 'quotes'), where('reviewToken', '==', token));
                const snap = await getDocs(q);

                if (snap.empty) {
                    setError('This quote link is invalid or has expired.');
                } else {
                    const docData = snap.docs[0].data();
                    setQuote({ id: snap.docs[0].id, ...docData } as QuoteData);
                    if (docData.status === 'accepted') {
                        setResponded(true);
                        setResponseType('accepted');
                    }
                }
            } catch (err) {
                console.error('Error loading quote:', err);
                setError('Unable to load this quote. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        if (token) fetchQuote();
    }, [token]);

    const handleAccept = async () => {
        setSubmitting(true);
        try {
            const respondToQuoteFn = httpsCallable(functions, 'respondToQuote');
            trackEvent('quote_accept', { token, paymentMethod });
            await respondToQuoteFn({ reviewToken: token, action: 'accept', notes: '', paymentMethod });
            setResponded(true);
            setResponseType('accepted');
            trackEvent('quote_response_success', { action: 'accept', token, paymentMethod });
        } catch (err) {
            console.error('Error accepting quote:', err);
            alert('Something went wrong. Please try again or contact us.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestChanges = async () => {
        setSubmitting(true);
        try {
            const respondToQuoteFn = httpsCallable(functions, 'respondToQuote');
            trackEvent('quote_request_changes', { token });
            await respondToQuoteFn({ reviewToken: token, action: 'request_changes', notes });
            setResponded(true);
            setResponseType('changes_requested');
            trackEvent('quote_response_success', { action: 'changes_requested', token });
        } catch (err) {
            console.error('Error requesting changes:', err);
            alert('Something went wrong. Please try again or contact us.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading your proposal...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Quote Not Found</h2>
                    <p className="text-gray-500">{error}</p>
                    <p className="text-sm text-gray-400 mt-4">Need help? Contact us at <a href="mailto:chris@xiri.ai" className="text-sky-600 underline">chris@xiri.ai</a></p>
                </div>
            </div>
        );
    }

    if (!quote) return null;

    const cashSubtotal = quote.totalMonthlyRate || 0;
    const cashTax = Math.round(cashSubtotal * 0.08625 * 100) / 100;
    const cashTotal = Math.round((cashSubtotal + cashTax) * 100) / 100;

    const creditSubtotal = Math.round(cashSubtotal * 1.03 * 100) / 100;
    const creditTax = Math.round(creditSubtotal * 0.08625 * 100) / 100;
    const creditTotal = Math.round((creditSubtotal + creditTax) * 100) / 100;

    // Success states
    if (responded) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    {responseType === 'accepted' ? (
                        <>
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Proposal Accepted!</h2>
                            <p className="text-gray-500 text-sm">
                                Thank you for choosing XIRI Facility Solutions. You selected <strong>{paymentMethod === 'credit_card' ? 'Payment Method 2: Credit Card' : 'Payment Method 1: ACH / Wire / Check'}</strong> ({paymentMethod === 'credit_card' ? formatCurrency(creditTotal) : formatCurrency(cashTotal)}).
                            </p>
                            <p className="text-gray-500 text-sm mt-2">
                                Your dedicated Facility Solutions Manager will be in touch shortly to coordinate onboarding and next steps.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Feedback Received</h2>
                            <p className="text-gray-500">Thank you for your feedback. Our team will review your notes and get back to you with an updated proposal.</p>
                        </>
                    )}
                    <div className="mt-6 pt-4 border-t">
                        <p className="text-xs text-gray-400">XIRI Facility Solutions • <a href={SITE.url} className="text-sky-600">xiri.ai</a></p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-800 to-sky-700 text-white">
                <div className="max-w-3xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">XIRI</h1>
                            <p className="text-sky-200 text-xs uppercase tracking-[3px] mt-0.5">Facility Solutions</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-sky-200 uppercase tracking-wider">Statement of Work</p>
                            <p className="text-2xl font-bold mt-1 font-mono">{formatCurrency(paymentMethod === 'credit_card' ? creditTotal : cashTotal)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 -mt-4 space-y-4">
                {/* Client Info */}
                <div className="bg-white rounded-xl shadow-xs border p-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Prepared For</p>
                    <p className="text-xl font-bold text-gray-900">{quote.leadBusinessName}</p>
                    <p className="text-sm text-gray-500 mt-1">{quote.contractTenure}-month agreement • {quote.paymentTerms}</p>
                </div>

                {/* ═══ DUAL PAYMENT METHOD COMPARISON / SELECTION ═══ */}
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                        Select Authorized Payment Method
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Option 1: ACH / Wire / Check */}
                        <div
                            onClick={() => setPaymentMethod('ach_check')}
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${paymentMethod === 'ach_check' ? 'border-sky-600 bg-sky-50/70 shadow-sm ring-2 ring-sky-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-sky-900">
                                    Method 1: ACH / Wire / Check
                                </span>
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    checked={paymentMethod === 'ach_check'}
                                    onChange={() => setPaymentMethod('ach_check')}
                                    className="h-4 w-4 text-sky-600 accent-sky-600"
                                />
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                                <div className="flex justify-between">
                                    <span>Labor / Services:</span>
                                    <span className="font-mono">{formatCurrency(cashSubtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono">{formatCurrency(cashTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t font-bold text-sm text-gray-900">
                                    <span>Total (Cash Rate):</span>
                                    <span className="font-mono text-base text-sky-700 font-bold">{formatCurrency(cashTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Option 2: Credit Card */}
                        <div
                            onClick={() => setPaymentMethod('credit_card')}
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${paymentMethod === 'credit_card' ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
                                    Method 2: Credit Card (+3%)
                                </span>
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    checked={paymentMethod === 'credit_card'}
                                    onChange={() => setPaymentMethod('credit_card')}
                                    className="h-4 w-4 text-blue-600 accent-blue-600"
                                />
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                                <div className="flex justify-between">
                                    <span>Credit Subtotal (+3%):</span>
                                    <span className="font-mono">{formatCurrency(creditSubtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Sales Tax (8.625%):</span>
                                    <span className="font-mono">{formatCurrency(creditTax)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t font-bold text-sm text-gray-900">
                                    <span>Total (Credit Card):</span>
                                    <span className="font-mono text-base text-blue-700 font-bold">{formatCurrency(creditTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Services */}
                <div className="bg-white rounded-xl shadow-xs border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Proposed Scope & Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50/60">
                                <th className="text-left px-6 py-3 font-medium">Location</th>
                                <th className="text-left px-6 py-3 font-medium">Service</th>
                                <th className="text-left px-6 py-3 font-medium">Frequency</th>
                                <th className="text-right px-6 py-3 font-medium text-slate-800">ACH / Check</th>
                                <th className="text-right px-6 py-3 font-medium text-blue-700">Credit (+3%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quote.lineItems.map((item, i) => {
                                const creditRate = Math.round(item.clientRate * 1.03 * 100) / 100;
                                return (
                                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                                        <td className="px-6 py-4 text-sm">{item.locationName}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.serviceType}</td>
                                        <td className="px-6 py-4 text-sm capitalize text-gray-600">{item.frequency}</td>
                                        <td className="px-6 py-4 text-sm text-right font-semibold font-mono text-slate-900">
                                            {formatCurrency(item.clientRate)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-semibold font-mono text-blue-800 bg-blue-50/20">
                                            {formatCurrency(creditRate)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Terms */}
                <div className="bg-white rounded-xl shadow-xs border p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Agreement Terms</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Duration</p>
                            <p className="font-medium">{quote.contractTenure} Months</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Payment</p>
                            <p className="font-medium">{quote.paymentTerms}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Exit Clause</p>
                            <p className="font-medium">{quote.exitClause || '30-day written notice'}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                {!showChangesForm ? (
                    <div className="bg-white rounded-xl shadow-xs border p-6 mb-8">
                        <h3 className="font-semibold text-gray-900 mb-4 text-center">Ready to authorize this project?</h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleAccept}
                                disabled={submitting}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-4 font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Processing...' : `✓ Authorize via ${paymentMethod === 'credit_card' ? 'Credit Card' : 'ACH / Check'} (${formatCurrency(paymentMethod === 'credit_card' ? creditTotal : cashTotal)})`}
                            </button>
                            <button
                                onClick={() => setShowChangesForm(true)}
                                className="flex-1 bg-white border-2 border-gray-300 hover:border-sky-500 rounded-lg px-6 py-4 font-semibold text-lg text-gray-700 hover:text-sky-700 transition-colors"
                            >
                                Request Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
                        <h3 className="font-semibold text-gray-900 mb-2">What changes would you like?</h3>
                        <p className="text-sm text-gray-500 mb-4">Let us know what you'd like to adjust — services, pricing, schedule, or anything else.</p>
                        <textarea
                            className="w-full border rounded-lg p-4 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            placeholder="Please describe the changes you'd like to see..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowChangesForm(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleRequestChanges}
                                disabled={!notes.trim() || submitting}
                                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Sending...' : 'Send Feedback'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pb-8">
                    <p className="text-xs text-gray-400">
                        XIRI Facility Solutions • Professional Facility Management<br />
                        <a href={SITE.url} className="text-sky-600 hover:underline">xiri.ai</a> • <a href="mailto:chris@xiri.ai" className="text-sky-600 hover:underline">chris@xiri.ai</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
