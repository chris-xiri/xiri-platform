'use client';

import Link from "next/link";
import { trackEvent } from '@/lib/tracking';

export function IndustriesSection() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">Specialized for Your Industry</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">We don&apos;t do &quot;generic&quot; cleaning. We build custom scopes for your specific compliance needs.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Medical Card */}
                    <Link href="/medical-offices" className="group block" onClick={() => trackEvent('industry_card_click', { industry: 'medical' })}>
                        <div className="relative overflow-hidden rounded-2xl bg-sky-50 p-8 h-full border border-sky-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-sky-900 leading-none -mr-8 -mt-8">Rx</div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🏥</div>
                                <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-sky-600 transition-colors">Medical Facilities</h3>
                                <p className="text-gray-600 mb-6">Urgent Care, Surgery Centers, &amp; Private Practice. Focused on High-Level Disinfection, Infection Control &amp; JCAHO Compliance.</p>
                                <span className="text-sky-700 font-bold flex items-center gap-2">View Medical Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                            </div>
                        </div>
                    </Link>

                    {/* Automotive Card */}
                    <Link href="/auto-dealerships" className="group block" onClick={() => trackEvent('industry_card_click', { industry: 'automotive' })}>
                        <div className="relative overflow-hidden rounded-2xl bg-gray-50 p-8 h-full border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-gray-900 leading-none -mr-8 -mt-8">Au</div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🚘</div>
                                <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">Auto Dealerships</h3>
                                <p className="text-gray-600 mb-6">Showrooms &amp; Service Centers. Focused on High-Gloss Floors &amp; Customer Experience.</p>
                                <span className="text-blue-700 font-bold flex items-center gap-2">View Auto Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                            </div>
                        </div>
                    </Link>

                    {/* Commercial/School Card */}
                    <Link href="/daycare-preschool" className="group block" onClick={() => trackEvent('industry_card_click', { industry: 'education' })}>
                        <div className="relative overflow-hidden rounded-2xl bg-orange-50 p-8 h-full border border-orange-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-orange-900 leading-none -mr-8 -mt-8">Ed</div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🧸</div>
                                <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">Education &amp; Commercial</h3>
                                <p className="text-gray-600 mb-6">Daycares, Schools, &amp; Offices. Focused on Safety, Green Cleaning, &amp; Reliability.</p>
                                <span className="text-orange-700 font-bold flex items-center gap-2">View Education Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </section>
    );
}
