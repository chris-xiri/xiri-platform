'use client';

import { useState } from 'react';

const HOMEPAGE_FAQS = [
    {
        q: "How is XIRI different from hiring a cleaning company?",
        a: "A cleaning company does one thing. XIRI replaces your cleaning company, your handyman, your supply vendor, and your compliance paperwork with one partner. We vet and manage the contractors, verify every shift, and send you one invoice."
    },
    {
        q: "What if I'm already under contract with another vendor?",
        a: "We can work with your existing schedule. Most transitions happen within 2-3 weeks with zero disruption to your operations. We'll conduct a free site audit first so you can compare apples to apples."
    },
    {
        q: "How do you verify cleaning quality every night?",
        a: "Our contractors complete a digital checklist after every shift that documents what was cleaned, restocked, and inspected. You get a verification report automatically — no chasing anyone for updates."
    },
    {
        q: "Is there a long-term contract?",
        a: "No. We work on month-to-month agreements. We earn your business every month, not through a contract — through results."
    },
    {
        q: "What areas do you serve?",
        a: "We currently serve Nassau County and the greater Long Island area, with plans to expand. Enter your zip code above to check if we've reached your area yet."
    },
];

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
