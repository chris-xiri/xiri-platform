'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

    useEffect(() => {
        async function fetchQuote() {
            try {
                const db = getFirestore(app);
                const q = query(collection(db, 'quotes'), where('reviewToken', '==', token));
                const snap = await getDocs(q);

                if (snap.empty) {
                    setError('This quote link is invalid or has expired.');
                    return;
                }

                const doc = snap.docs[0];
                const data = doc.data();

                if (data.status !== 'sent') {
                    setResponded(true);
                    setResponseType(data.status === 'accepted' ? 'accepted' : 'changes_requested');
                }

                setQuote({ id: doc.id, ...data } as QuoteData);

                // Mark as viewed
                if (!data.viewedAt) {
                    await updateDoc(doc.ref, { viewedAt: new Date() });
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
            await respondToQuoteFn({ reviewToken: token, action: 'accept', notes: '' });
            setResponded(true);
            setResponseType('accepted');
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
            await respondToQuoteFn({ reviewToken: token, action: 'request_changes', notes });
            setResponded(true);
            setResponseType('changes_requested');
        } catch (err) {
            console.error('Error requesting changes:', err);
            alert('Something went wrong. Please try again or contact us.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

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
                    <p className="text-sm text-gray-400 mt-4">Need help? Contact us at <a href="mailto:info@xiri.ai" className="text-sky-600 underline">info@xiri.ai</a></p>
                </div>
            </div>
        );
    }

    if (!quote) return null;

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
                            <p className="text-gray-500">Thank you for choosing XIRI Facility Solutions. Your dedicated Facility Solutions Manager will be in touch shortly to coordinate getting started.</p>
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
                        <p className="text-xs text-gray-400">XIRI Facility Solutions • <a href="https://xiri.ai" className="text-sky-600">xiri.ai</a></p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-700 to-sky-600 text-white">
                <div className="max-w-3xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">XIRI</h1>
                            <p className="text-sky-200 text-xs uppercase tracking-[3px] mt-0.5">Facility Solutions</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-sky-200 uppercase tracking-wider">Service Proposal</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(quote.totalMonthlyRate)}<span className="text-sm font-normal text-sky-200">/month</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 -mt-4">
                {/* Client Info */}
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Prepared For</p>
                    <p className="text-xl font-bold text-gray-900">{quote.leadBusinessName}</p>
                    <p className="text-sm text-gray-500 mt-1">{quote.contractTenure}-month agreement • {quote.paymentTerms}</p>
                </div>

                {/* Services */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-4">
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Proposed Services</h3>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase border-b">
                                <th className="text-left px-6 py-3 font-medium">Location</th>
                                <th className="text-left px-6 py-3 font-medium">Service</th>
                                <th className="text-left px-6 py-3 font-medium">Frequency</th>
                                <th className="text-right px-6 py-3 font-medium">Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quote.lineItems.map((item, i) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                                    <td className="px-6 py-4 text-sm">{item.locationName}</td>
                                    <td className="px-6 py-4 text-sm font-medium">{item.serviceType}</td>
                                    <td className="px-6 py-4 text-sm capitalize">{item.frequency}</td>
                                    <td className="px-6 py-4 text-sm text-right font-semibold">{formatCurrency(item.clientRate)}/mo</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-6 py-4 bg-sky-50 border-t flex justify-between items-center">
                        <span className="font-medium text-gray-700">Total Monthly Investment</span>
                        <span className="text-2xl font-bold text-sky-700">{formatCurrency(quote.totalMonthlyRate)}<span className="text-sm font-normal text-gray-500">/month</span></span>
                    </div>
                </div>

                {/* Terms */}
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Agreement Terms</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
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
                    <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
                        <h3 className="font-semibold text-gray-900 mb-4 text-center">How would you like to proceed?</h3>
                        <div className="flex gap-4">
                            <button
                                onClick={handleAccept}
                                disabled={submitting}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-4 font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Processing...' : '✓ Accept Proposal'}
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
                        <a href="https://xiri.ai" className="text-sky-600 hover:underline">xiri.ai</a> • <a href="mailto:info@xiri.ai" className="text-sky-600 hover:underline">info@xiri.ai</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
