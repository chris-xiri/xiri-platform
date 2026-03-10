'use client';

import { useState } from 'react';
import { HOMEPAGE_FAQS } from '@/data/faqs';

export function HomepageFAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-20 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-3">
                        Common Questions
                    </p>
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900">
                        Questions facility managers ask before switching
                    </h2>
                </div>

                <div className="space-y-3">
                    {HOMEPAGE_FAQS.map((faq, i) => (
                        <div
                            key={i}
                            className="border border-slate-200 rounded-xl overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                            >
                                <span className="font-semibold text-slate-900 pr-4">{faq.q}</span>
                                <svg
                                    className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openIndex === i && (
                                <div className="px-6 pb-4 text-slate-600 leading-relaxed animate-fadeIn">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
