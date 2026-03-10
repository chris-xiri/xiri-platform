'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { isValidZip } from '@/data/validZips';
import { trackEvent } from '@/lib/tracking';

/**
 * ExitIntentPopup — shows once per session when the user moves their
 * cursor above the browser viewport (desktop) or scrolls up rapidly (mobile).
 *
 * Suppressed on pages where the user is already in a conversion flow
 * (audit, onboarding, waitlist, quote, invoice, privacy, terms).
 *
 * Also suppressed if the user has already submitted a lead form
 * (checked via sessionStorage flag).
 */
export function ExitIntentPopup() {
    const pathname = usePathname();
    const router = useRouter();
    const [shown, setShown] = useState(false);
    const [zip, setZip] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const hasTriggered = useRef(false);

    const suppressedPages = ['/audit', '/onboarding', '/waitlist', '/quote', '/invoice', '/privacy', '/terms'];
    const isSuppressed = suppressedPages.some(p => pathname.startsWith(p));

    const showPopup = useCallback(() => {
        if (hasTriggered.current || isSuppressed) return;
        // Don't show if user already submitted a lead
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('xiri_lead_submitted')) return;
        // Don't show if already dismissed this session
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('xiri_exit_dismissed')) return;

        hasTriggered.current = true;
        setShown(true);
        trackEvent('click_cta', { element: 'exit_intent_shown', source: pathname });
    }, [isSuppressed, pathname]);

    useEffect(() => {
        if (isSuppressed) return;

        // Desktop: mouseleave on document
        const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 5) {
                showPopup();
            }
        };

        // Mobile: rapid scroll up (>300px in <300ms)
        let lastScrollY = window.scrollY;
        let lastTime = Date.now();
        const handleScroll = () => {
            const now = Date.now();
            const delta = lastScrollY - window.scrollY;
            const dt = now - lastTime;

            if (delta > 300 && dt < 300 && window.scrollY > 200) {
                showPopup();
            }
            lastScrollY = window.scrollY;
            lastTime = now;
        };

        document.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            document.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isSuppressed, showPopup]);

    const handleDismiss = () => {
        setShown(false);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('xiri_exit_dismissed', '1');
        }
        trackEvent('click_cta', { element: 'exit_intent_dismissed', source: pathname });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (zip.length !== 5) {
            setError('Enter a valid 5-digit zip code.');
            return;
        }

        setLoading(true);
        trackEvent('lead_zip_submit', { zip, source: 'exit_intent' });

        if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
            (window as any).gtag('event', 'generate_lead', {
                source: 'exit_intent',
                zip_code: zip,
            });
        }

        if (!isValidZip(zip)) {
            trackEvent('lead_zip_rejected', { zip });
            router.push(`/waitlist?zip=${zip}`);
            return;
        }

        router.push(`/audit/start?zip=${zip}&service=general&source=exit_intent`);
    };

    if (!shown) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleDismiss}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Close */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>

                {/* Header */}
                <div className="bg-gradient-to-br from-sky-600 to-sky-800 px-8 pt-8 pb-6 text-white text-center">
                    <div className="text-4xl mb-3">🏢</div>
                    <h3 className="text-2xl font-bold mb-2">
                        Wait — get a free cleaning scope
                    </h3>
                    <p className="text-sky-100 text-sm">
                        Enter your zip and we&apos;ll build a custom cleaning plan for your building. No commitment.
                    </p>
                </div>

                {/* Form */}
                <div className="px-8 py-6">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={zip}
                                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                placeholder="Enter Facility Zip Code"
                                maxLength={5}
                                className="w-full h-14 px-5 rounded-xl bg-gray-50 border-2 border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none text-lg font-bold text-gray-900 tracking-wider placeholder:text-gray-400 placeholder:font-normal placeholder:text-base placeholder:tracking-normal transition-all"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm font-medium">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || zip.length < 5}
                            className="w-full h-14 bg-sky-600 text-white font-bold text-lg rounded-xl hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Get My Free Scope
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-xs text-center text-gray-400 mt-4">
                        Takes 30 seconds. No email required.
                    </p>
                </div>
            </div>
        </div>
    );
}
