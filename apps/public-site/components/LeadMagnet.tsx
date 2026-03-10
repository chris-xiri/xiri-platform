'use client';

import { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { trackEvent } from '@/lib/tracking';
import { Loader2, CheckCircle, Download, ArrowRight } from 'lucide-react';

interface LeadMagnetProps {
    /** Name of the lead magnet (for tracking and Firestore) */
    magnetName: string;
    /** User-facing title */
    title: string;
    /** Short description */
    description: string;
    /** CTA button text */
    ctaText?: string;
    /** URL to download (optional — if omitted, shows "check your email") */
    downloadUrl?: string;
    /** Visual variant */
    variant?: 'blue' | 'green' | 'dark';
}

/**
 * LeadMagnet — email capture component for blog posts and guides.
 * Renders inline as a content upgrade offer. On submit, writes to
 * Firestore `lead_magnet_downloads` and fires GA4 `generate_lead`.
 */
export function LeadMagnet({
    magnetName,
    title,
    description,
    ctaText = 'Send It to Me',
    downloadUrl,
    variant = 'blue',
}: LeadMagnetProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const tracked = useRef(false);

    useEffect(() => {
        if (!tracked.current) {
            tracked.current = true;
            trackEvent('click_cta', { element: `lead_magnet_view_${magnetName}`, source: 'blog' });
        }
    }, [magnetName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);

        try {
            await addDoc(collection(db, 'lead_magnet_downloads'), {
                email,
                magnetName,
                downloadUrl: downloadUrl || null,
                createdAt: serverTimestamp(),
            });

            // Also add to leads collection for CRM visibility
            await addDoc(collection(db, 'leads'), {
                email,
                source: `lead_magnet_${magnetName}`,
                status: 'new',
                name: '',
                facilityType: '',
                sqft: '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            trackEvent('lead_submission_success', { source: `lead_magnet_${magnetName}` });

            if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
                (window as any).gtag('event', 'generate_lead', {
                    source: `lead_magnet_${magnetName}`,
                    currency: 'USD',
                });
            }

            // Mark session as converted (suppresses exit intent)
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('xiri_lead_submitted', '1');
            }

            setSuccess(true);
        } catch (err) {
            console.error('Failed to save lead magnet download:', err);
        }

        setLoading(false);
    };

    const styles = {
        blue: {
            container: 'bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200',
            icon: 'text-sky-600 bg-sky-100',
            button: 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20',
            accent: 'text-sky-600',
        },
        green: {
            container: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200',
            icon: 'text-emerald-600 bg-emerald-100',
            button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
            accent: 'text-emerald-600',
        },
        dark: {
            container: 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700',
            icon: 'text-sky-400 bg-slate-700',
            button: 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20',
            accent: 'text-sky-400',
        },
    };

    const s = styles[variant];
    const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
    const subtextColor = variant === 'dark' ? 'text-slate-300' : 'text-slate-600';

    return (
        <div className={`rounded-2xl border p-6 md:p-8 my-10 ${s.container}`}>
            {success ? (
                <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h4 className={`text-xl font-bold mb-2 ${textColor}`}>Check your inbox!</h4>
                    <p className={`text-sm mb-4 ${subtextColor}`}>
                        We&apos;ve sent it to <strong>{email}</strong>.
                    </p>
                    {downloadUrl && (
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors shadow-lg ${s.button}`}
                        >
                            <Download className="w-4 h-4" />
                            Download Now
                        </a>
                    )}
                </div>
            ) : (
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    {/* Left: Copy */}
                    <div className="flex-1">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3 ${s.icon}`}>
                            <Download className="w-3.5 h-3.5" />
                            Free Download
                        </div>
                        <h4 className={`text-xl font-bold mb-2 ${textColor}`}>{title}</h4>
                        <p className={`text-sm ${subtextColor}`}>{description}</p>
                    </div>

                    {/* Right: Form */}
                    <form onSubmit={handleSubmit} className="flex-shrink-0 w-full md:w-72 space-y-3">
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow"
                        />
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className={`w-full h-11 rounded-xl text-white font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${s.button}`}
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {ctaText}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                        <p className={`text-xs text-center ${variant === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            No spam. Unsubscribe anytime.
                        </p>
                    </form>
                </div>
            )}
        </div>
    );
}
