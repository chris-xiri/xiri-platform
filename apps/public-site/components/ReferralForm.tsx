'use client';

import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { trackEvent } from '@/lib/tracking';
import { REFERRAL_PARTNERS, REFERRAL_FEE, WALKTHROUGH_BONUS, CLOSE_BONUS, RECURRING_BONUS } from '@/data/dlp-referral-partners';
import { CheckCircle, Loader2, Send, DollarSign, Clock } from 'lucide-react';

interface ReferralFormProps {
    /** Pre-selected trade slug, e.g. 'plumber-referral-partner' */
    tradeSlug?: string;
    /** Source page slug for attribution */
    source?: string;
}

/** Format phone as (XXX) XXX-XXXX while typing */
function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ReferralForm({ tradeSlug, source }: ReferralFormProps) {
    // ─── Your info (autocomplete pre-fills these from browser) ────
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [trade, setTrade] = useState(tradeSlug || '');

    // ─── Building info (only buildingName required) ──────────────
    const [buildingName, setBuildingName] = useState('');
    const [buildingAddress, setBuildingAddress] = useState('');
    const [managerName, setManagerName] = useState('');
    const [managerContact, setManagerContact] = useState('');
    const [notes, setNotes] = useState('');

    // ─── UI state ────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<1 | 2>(1);

    const tracked = useRef(false);
    useEffect(() => {
        if (!tracked.current) {
            trackEvent('referral_form_view', { trade: tradeSlug || 'generic', source: source || '' });
            tracked.current = true;
        }
    }, [tradeSlug, source]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !phone || !buildingName) return;

        setSubmitting(true);
        setError('');
        trackEvent('referral_form_submit', { trade: trade || 'unspecified', source: source || '' });

        try {
            await addDoc(collection(db, 'referral_leads'), {
                referrerName: name,
                referrerEmail: email,
                referrerPhone: phone,
                trade: trade || 'other',
                buildingName,
                buildingAddress,
                managerName,
                managerContact,
                notes,
                source: source || 'direct',
                status: 'new',
                createdAt: serverTimestamp(),
            });

            // Also add to main leads collection for CRM visibility
            await addDoc(collection(db, 'leads'), {
                name,
                email,
                phone,
                type: 'referral_partner',
                source: `refer/${source || 'direct'}`,
                trade: trade || 'other',
                buildingName,
                buildingAddress,
                managerName,
                managerContact,
                notes,
                status: 'new',
                createdAt: serverTimestamp(),
            });

            trackEvent('referral_form_success', {
                trade: trade || 'unspecified',
                source: source || '',
            });

            // Fire GA4 generate_lead for funnel attribution
            if (typeof window !== 'undefined' && (window as any).gtag) {
                (window as any).gtag('event', 'generate_lead', {
                    lead_type: 'referral_partner',
                    trade: trade || 'unspecified',
                    value: REFERRAL_FEE,
                    currency: 'USD',
                });
            }

            setSubmitted(true);
            sessionStorage.setItem('xiri_lead_submitted', '1');
        } catch (err) {
            console.error('Referral form error:', err);
            setError('Something went wrong. Please try again or call us at (516) 526-9585.');
            trackEvent('referral_form_error', { trade: trade || 'unspecified' });
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Success state ───────────────────────────────────────────
    if (submitted) {
        return (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Referral Received!</h3>
                <p className="text-slate-600 mb-4">
                    We&apos;ll reach out to the building within 24 hours. Here&apos;s your payout timeline:
                </p>
                <div className="bg-white rounded-xl p-4 border border-emerald-200 text-left text-sm mb-4">
                    <div className="space-y-3 text-slate-600">
                        <div className="flex items-start gap-2"><Clock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span>We contact the building within <strong>24 hours</strong></span></div>
                        <div className="flex items-start gap-2"><DollarSign className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span><strong className="text-emerald-700">${WALKTHROUGH_BONUS}</strong> paid when you join us for the building walkthrough</span></div>
                        <div className="flex items-start gap-2"><DollarSign className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span><strong className="text-emerald-700">${CLOSE_BONUS}</strong> paid when the cleaning contract goes live</span></div>
                        <div className="flex items-start gap-2"><Send className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /><span><strong className="text-emerald-700">${RECURRING_BONUS}/mo</strong> recurring for the life of the contract</span></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 border-t border-slate-100 pt-2">We&apos;ll email updates to <strong>{email}</strong></p>
                </div>
                <button
                    onClick={() => { setSubmitted(false); setBuildingName(''); setBuildingAddress(''); setManagerName(''); setManagerContact(''); setNotes(''); setStep(2); }}
                    className="text-emerald-600 font-semibold text-sm hover:text-emerald-700 underline"
                >
                    Refer another building →
                </button>
                <p className="text-xs text-slate-400 mt-3">Questions? <a href="mailto:chris@xiri.ai" className="text-sky-600 underline">chris@xiri.ai</a> or <a href="tel:+15165269585" className="text-sky-600 underline">(516) 526-9585</a></p>
            </div>
        );
    }

    const inputClass = "w-full h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow outline-none";
    const canProceed = name && email && phone;
    const canSubmit = canProceed && buildingName;

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6" />
                    <div>
                        <h3 className="text-lg font-bold">Refer a Building</h3>
                        <p className="text-emerald-100 text-sm">Earn a minimum of ${REFERRAL_FEE} + ${RECURRING_BONUS}/mo recurring</p>
                    </div>
                </div>
                {/* Progress indicator */}
                <div className="flex gap-2 mt-3">
                    <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
                    <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
                </div>
                <p className="text-emerald-200 text-xs mt-1">Step {step} of 2 — {step === 1 ? 'Your info' : 'Building info'}</p>
            </div>

            <div className="p-6">
                {step === 1 ? (
                    /* ─── Step 1: Your info (browser autocomplete handles this) ─── */
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">About You</p>
                        <div className="space-y-3">
                            <input
                                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="Full name"
                                autoComplete="name" name="name" id="referral-name"
                                className={inputClass}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                    autoComplete="email" name="email" id="referral-email"
                                    className={inputClass}
                                />
                                <input
                                    type="tel" required value={phone}
                                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                                    placeholder="(516) 555-1234"
                                    autoComplete="tel" name="phone" id="referral-phone"
                                    className={inputClass}
                                />
                            </div>
                            {!tradeSlug && (
                                <select
                                    value={trade} onChange={(e) => setTrade(e.target.value)}
                                    autoComplete="organization-title" name="trade" id="referral-trade"
                                    className={`${inputClass} ${!trade ? 'text-slate-400' : 'text-slate-900'}`}
                                >
                                    <option value="">Your trade / profession</option>
                                    {Object.entries(REFERRAL_PARTNERS).map(([slug, partner]) => (
                                        <option key={slug} value={slug}>{partner.title.replace(' Referral Partner Program', '').replace(' Referral Program', '')}</option>
                                    ))}
                                    <option value="other">Other</option>
                                </select>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={!canProceed}
                            onClick={() => setStep(2)}
                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next: Building Info →
                        </button>
                        <p className="text-xs text-slate-400 text-center">Takes about 60 seconds</p>
                    </div>
                ) : (
                    /* ─── Step 2: Building info ─────────────────────────────── */
                    <div className="space-y-4">
                        {/* Referrer badge */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Building to Refer</p>
                            <button type="button" onClick={() => setStep(1)} className="text-xs text-sky-600 hover:text-sky-700 font-medium">
                                ← Edit your info
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 border border-slate-200 flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            Referring as <strong className="text-slate-900">{name}</strong> · {email}
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text" required value={buildingName} onChange={(e) => setBuildingName(e.target.value)}
                                placeholder="Building or business name *"
                                autoComplete="organization" name="building" id="referral-building"
                                autoFocus
                                className={inputClass}
                            />
                            <input
                                type="text" value={buildingAddress} onChange={(e) => setBuildingAddress(e.target.value)}
                                placeholder="Building address (optional — helps us find it faster)"
                                autoComplete="street-address" name="address" id="referral-address"
                                className={inputClass}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)}
                                    placeholder="Manager name (optional)"
                                    name="manager-name" id="referral-manager-name"
                                    className={inputClass}
                                />
                                <input
                                    type="text" value={managerContact} onChange={(e) => setManagerContact(e.target.value)}
                                    placeholder="Manager phone or email (optional)"
                                    name="manager-contact" id="referral-manager-contact"
                                    className={inputClass}
                                />
                            </div>
                            <textarea
                                value={notes} onChange={(e) => setNotes(e.target.value)}
                                placeholder="Anything else? e.g. 'They complained about their current cleaner last week' (optional)"
                                rows={2}
                                name="notes" id="referral-notes"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none outline-none"
                            />
                        </div>

                        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                        <button
                            type="submit"
                            disabled={submitting || !canSubmit}
                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                            ) : (
                                <><Send className="w-4 h-4" /> Submit Referral — Earn ${REFERRAL_FEE}+</>
                            )}
                        </button>

                        <p className="text-xs text-slate-400 text-center">
                            Only the building name is required. We&apos;ll email you at <strong>{email}</strong> with updates.
                        </p>
                    </div>
                )}
            </div>
        </form>
    );
}
