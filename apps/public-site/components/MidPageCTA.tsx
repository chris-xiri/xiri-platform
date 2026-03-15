'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { LeadFormModal } from './LeadFormModal';
import { trackEvent } from '@/lib/tracking';
import { CTA } from '@/lib/constants';

interface MidPageCTAProps {
    headline?: string;
    subtext?: string;
    ctaText?: string;
    variant?: 'light' | 'dark' | 'gradient';
    trackingId: string;
}

export function MidPageCTA({
    headline = 'Ready to simplify your building?',
    subtext = 'Enter your zip code — we\'ll tell you if we cover your area and build a custom scope in 48 hours.',
    ctaText = `${CTA.primary} →`,
    variant = 'light',
    trackingId,
}: MidPageCTAProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClick = () => {
        trackEvent('click_cta', { element: `mid_page_${trackingId}`, source: 'homepage' });
        setIsModalOpen(true);
    };

    const styles = {
        light: {
            section: 'bg-sky-50 border-y border-sky-100',
            headline: 'text-slate-900',
            subtext: 'text-slate-600',
            button: 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-600/20 hover:shadow-xl hover:shadow-sky-600/30',
        },
        dark: {
            section: 'bg-slate-900',
            headline: 'text-white',
            subtext: 'text-slate-300',
            button: 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20',
        },
        gradient: {
            section: 'bg-gradient-to-r from-sky-600 to-sky-800',
            headline: 'text-white',
            subtext: 'text-sky-100',
            button: 'bg-white text-sky-700 hover:bg-sky-50 shadow-lg',
        },
    };

    const s = styles[variant];

    return (
        <>
            <section className={`py-12 ${s.section}`}>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h3 className={`text-2xl md:text-3xl font-heading font-bold mb-3 ${s.headline}`}>
                        {headline}
                    </h3>
                    <p className={`text-lg mb-6 max-w-2xl mx-auto ${s.subtext}`}>
                        {subtext}
                    </p>
                    <button
                        onClick={handleClick}
                        className={`inline-flex items-center gap-2 px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 transform hover:-translate-y-0.5 ${s.button}`}
                    >
                        {ctaText}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            <LeadFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
