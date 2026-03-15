'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowRight, X, Loader2 } from 'lucide-react';
import { isValidZip } from '@/data/validZips';
import { trackEvent } from '@/lib/tracking';
import { CTA } from '@/lib/constants';

/**
 * StickyMobileCTA — fixed bottom bar on mobile for key landing pages.
 *
 * Two modes:
 *   - "tenant"     → zip code input + "Get Free Audit" (for homepage, industries, services, blog)
 *   - "contractor"  → single "Apply Now — 5 Min" button (for /contractors/* pages)
 *
 * Scroll-aware: hides when scrolling down, shows when scrolling up (Intercom pattern).
 * Appears after scrolling past 400px. Dismissable per session.
 */
export function StickyMobileCTA() {
    const pathname = usePathname();
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [zip, setZip] = useState('');
    const [loading, setLoading] = useState(false);
    const tracked = useRef(false);
    const lastScrollY = useRef(0);
    const scrollDirection = useRef<'up' | 'down'>('up');

    // Determine mode from pathname
    const isContractorPage = pathname.startsWith('/contractors');
    const mode = isContractorPage ? 'contractor' : 'tenant';

    // Pages where we don't show the sticky bar
    const suppressedPages = ['/audit', '/onboarding', '/waitlist', '/quote', '/invoice', '/privacy', '/terms'];
    const isSuppressed = suppressedPages.some(p => pathname.startsWith(p));

    useEffect(() => {
        if (isSuppressed || dismissed) return;

        const handleScroll = () => {
            const currentY = window.scrollY;
            const threshold = 400;

            // Determine scroll direction (with 5px deadzone to prevent jitter)
            if (currentY > lastScrollY.current + 5) {
                scrollDirection.current = 'down';
            } else if (currentY < lastScrollY.current - 5) {
                scrollDirection.current = 'up';
            }

            lastScrollY.current = currentY;

            // Show: scrolled past threshold AND scrolling up
            // Hide: scrolling down OR haven't scrolled past threshold
            if (currentY > threshold && scrollDirection.current === 'up') {
                setVisible(true);
            } else if (scrollDirection.current === 'down' || currentY <= threshold) {
                setVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isSuppressed, dismissed]);

    // Track impression once
    useEffect(() => {
        if (visible && !tracked.current) {
            tracked.current = true;
            trackEvent('click_cta', { element: 'sticky_mobile_impression', source: mode });
        }
    }, [visible, mode]);

    if (isSuppressed || dismissed) return null;

    const handleTenantSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (zip.length !== 5) return;
        setLoading(true);
        trackEvent('lead_zip_submit', { zip, source: 'sticky_mobile' });

        if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
            (window as any).gtag('event', 'generate_lead', {
                source: 'sticky_mobile',
                zip_code: zip,
            });
        }

        if (!isValidZip(zip)) {
            trackEvent('lead_zip_rejected', { zip });
            router.push(`/waitlist?zip=${zip}`);
            return;
        }

        router.push(`/audit/start?zip=${zip}&service=general&source=sticky_mobile`);
    };

    const handleContractorClick = () => {
        trackEvent('click_cta', { element: 'sticky_mobile_apply', source: 'contractor' });
        router.push('/onboarding/start?source=sticky_mobile');
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ease-out ${
            visible ? 'translate-y-0' : 'translate-y-full'
        }`}>
            {/* Dismiss button */}
            <button
                onClick={() => setDismissed(true)}
                className="absolute -top-9 right-3 p-1.5 bg-white/90 rounded-full shadow-md border border-slate-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4 text-slate-500" />
            </button>

            <div className={`px-4 py-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] border-t ${
                mode === 'contractor'
                    ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 border-emerald-600'
                    : 'bg-gradient-to-r from-sky-700 to-sky-800 border-sky-600'
            }`}>
                {mode === 'tenant' ? (
                    <form onSubmit={handleTenantSubmit} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={zip}
                            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            placeholder="Zip Code"
                            maxLength={5}
                            className="flex-1 h-12 px-4 rounded-lg bg-white/95 text-slate-900 text-base font-bold placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-white/50 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading || zip.length < 5}
                            className="h-12 px-5 bg-white text-sky-700 font-bold text-sm rounded-lg hover:bg-sky-50 active:bg-sky-100 transition-colors disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                    Free Audit
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <button
                        onClick={handleContractorClick}
                        className="w-full h-12 bg-white text-emerald-700 font-bold text-sm rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                    >
                        {CTA.contractor} — Takes 5 Minutes
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
