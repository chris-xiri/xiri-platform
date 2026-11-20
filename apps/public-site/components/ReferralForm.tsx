'use client';

import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { trackEvent } from '@/lib/tracking';
import { REFERRAL_PARTNERS, REFERRAL_FEE, WALKTHROUGH_BONUS, CLOSE_BONUS, RECURRING_BONUS } from '@/data/dlp-referral-partners';
import { CheckCircle, Loader2, Send, DollarSign, Clock } from 'lucide-react';
import AddressAutocompleteInput from '@/components/AddressAutocompleteInput';

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

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ReferralForm({ tradeSlug, source }: ReferralFormProps) {
    // ─── Your info (autocomplete pre-fills these from browser) ────
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [trade, setTrade] = useState(tradeSlug || '');

    // ─── Building info (buildingName + buildingAddress required) ──
    const [buildingName, setBuildingName] = useState('');
    const [buildingAddress, setBuildingAddress] = useState('');
    const [managerName, setManagerName] = useState('');
    const [managerEmail, setManagerEmail] = useState('');
    const [managerPhone, setManagerPhone] = useState('');
    const [notes, setNotes] = useState('');

    // ─── UI state ────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<1 | 2>(1);

    const tracked = useRef(false);
    const submittingRef = useRef(false);

    useEffect(() => {
        if (!tracked.current) {
            trackEvent('referral_form_view', { trade: tradeSlug || 'generic', source: source || '' });
            tracked.current = true;
        }
    }, [tradeSlug, source]);

    const validateStepOne = (): string | null => {
        if (!name.trim()) return 'Please enter your full name.';
        if (!email.trim() || !isValidEmail(email)) return 'Please enter a valid email address.';
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) return 'Please enter a valid 10-digit phone number.';
        return null;
    };

    const handleNextStep = () => {
        const validationError = validateStepOne();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Allow pressing Enter on Step 1 to advance to Step 2 cleanly
        if (step === 1) {
            handleNextStep();
            return;
        }

        if (submittingRef.current) return;

        const stepOneError = validateStepOne();
        if (stepOneError) {
            setError(stepOneError);
            setStep(1);
            return;
        }

        if (!buildingName.trim()) {
            setError('Please enter the building or business name.');
            return;
        }

        if (!buildingAddress.trim()) {
            setError('Please enter the building address.');
            return;
        }

        if (managerEmail.trim() && !isValidEmail(managerEmail)) {
            setError('Please enter a valid manager email address (or leave it blank).');
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setError('');
        trackEvent('referral_form_submit', { trade: trade || 'unspecified', source: source || '' });

        try {
            // Write only to `referral_leads` (public create is allowed by Firestore rules).
            // The `onReferralLeadWritten` Cloud Function queues the building into `prospect_queue`
            // (source: 'referral', tagged with referrer details), syncs the referrer into `vendors`,
            // emails the referrer a summary of their submission, and alerts the internal team via Admin SDK.
            await addDoc(collection(db, 'referral_leads'), {
                referrerName: name.trim(),
                referrerEmail: email.trim().toLowerCase(),
                referrerPhone: phone.trim(),
                trade: trade || 'other',
                buildingName: buildingName.trim(),
                buildingAddress: buildingAddress.trim(),
                managerName: managerName.trim(),
                managerEmail: managerEmail.trim().toLowerCase(),
                managerPhone: managerPhone.trim(),
                notes: notes.trim(),
                source: source || 'direct',
                status: 'new',
                payoutStatus: 'new',
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
            setError('Something went wrong. Please try again or call us at (516) 399-0350.');
            trackEvent('referral_form_error', { trade: trade || 'unspecified' });
        } finally {
            submittingRef.current = false;
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
                    We&apos;ll reach out to <strong>{buildingName}</strong> within 24 hours. Here&apos;s your payout timeline:
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
                    type="button"
                    onClick={() => {
                        setSubmitted(false);
                        setError('');
                        setBuildingName('');
                        setBuildingAddress('');
                        setManagerName('');
                        setManagerEmail('');
                        setManagerPhone('');
                        setNotes('');
                        setStep(2);
                    }}
                    className="text-emerald-600 font-semibold text-sm hover:text-emerald-700 underline"
                >
                    Refer another building →
                </button>
                <p className="text-xs text-slate-400 mt-3">Questions? <a href="mailto:chris@xiri.ai" className="text-sky-600 underline">chris@xiri.ai</a> or <a href="tel:+15163990350" className="text-sky-600 underline">(516) 399-0350</a></p>
            </div>
        );
    }

    const inputClass = "w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow outline-none";
    const labelClass = "block text-xs font-medium text-slate-700 mb-1";

    return (
        <form onSubmit={handleSubmit} noValidate className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 flex-shrink-0" />
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
                            <div>
                                <label htmlFor="referral-name" className={labelClass}>Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                                    placeholder="Your full name"
                                    autoComplete="name"
                                    name="name"
                                    id="referral-name"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="referral-email" className={labelClass}>Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                                    placeholder="you@company.com"
                                    autoComplete="email"
                                    name="email"
                                    id="referral-email"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="referral-phone" className={labelClass}>Phone *</label>
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => { setPhone(formatPhone(e.target.value)); if (error) setError(''); }}
                                    placeholder="(516) 555-1234"
                                    autoComplete="tel"
                                    name="phone"
                                    id="referral-phone"
                                    className={inputClass}
                                />
                            </div>
                            {!tradeSlug && (
                                <div>
                                    <label htmlFor="referral-trade" className={labelClass}>Your Trade / Profession</label>
                                    <select
                                        value={trade}
                                        onChange={(e) => setTrade(e.target.value)}
                                        autoComplete="organization-title"
                                        name="trade"
                                        id="referral-trade"
                                        className={`${inputClass} ${!trade ? 'text-slate-400' : 'text-slate-900'}`}
                                    >
                                        <option value="">Select your trade / profession</option>
                                        {Object.entries(REFERRAL_PARTNERS).map(([slug, partner]) => (
                                            <option key={slug} value={slug}>{partner.title.replace(' Referral Partner Program', '').replace(' Referral Program', '')}</option>
                                        ))}
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {error && (
                            <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
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
                            <button
                                type="button"
                                onClick={() => { setError(''); setStep(1); }}
                                className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                            >
                                ← Edit your info
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 border border-slate-200 flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <span className="break-words min-w-0">
                                Referring as <strong className="text-slate-900">{name}</strong> · {email} · {phone}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="referral-building" className={labelClass}>Building or Business Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={buildingName}
                                    onChange={(e) => { setBuildingName(e.target.value); if (error) setError(''); }}
                                    placeholder="e.g. Garden City Dental Group"
                                    autoComplete="organization"
                                    name="building"
                                    id="referral-building"
                                    autoFocus
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label htmlFor="referral-address" className={labelClass}>Building Address *</label>
                                <AddressAutocompleteInput
                                    id="referral-address"
                                    name="address"
                                    required
                                    value={buildingAddress}
                                    onChange={(val) => { setBuildingAddress(val); if (error) setError(''); }}
                                    placeholder="Start typing street address..."
                                    className={inputClass}
                                />
                            </div>

                            <div className="pt-1 border-t border-slate-100">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
                                    Building Manager Contact <span className="font-normal normal-case text-slate-400">(optional)</span>
                                </p>
                                <div className="space-y-2.5">
                                    <input
                                        type="text"
                                        value={managerName}
                                        onChange={(e) => setManagerName(e.target.value)}
                                        placeholder="Manager name"
                                        name="manager-name"
                                        id="referral-manager-name"
                                        className={inputClass}
                                    />
                                    <input
                                        type="email"
                                        value={managerEmail}
                                        onChange={(e) => { setManagerEmail(e.target.value); if (error) setError(''); }}
                                        placeholder="Manager email"
                                        name="manager-email"
                                        id="referral-manager-email"
                                        className={inputClass}
                                    />
                                    <input
                                        type="tel"
                                        value={managerPhone}
                                        onChange={(e) => setManagerPhone(formatPhone(e.target.value))}
                                        placeholder="Manager phone"
                                        name="manager-phone"
                                        id="referral-manager-phone"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="referral-notes" className={labelClass}>
                                    Notes <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. 'New tenant moving in next month' or 'Unhappy with current cleaner'"
                                    rows={2}
                                    name="notes"
                                    id="referral-notes"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none outline-none"
                                />
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                            ) : (
                                <><Send className="w-4 h-4" /> Submit Referral — Earn ${REFERRAL_FEE}+</>
                            )}
                        </button>

                        <p className="text-xs text-slate-400 text-center">
                            Building name and address are required. We&apos;ll email you at <strong>{email}</strong> with updates.
                        </p>
                    </div>
                )}
            </div>
        </form>
    );
}
