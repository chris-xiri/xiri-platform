'use client';

import Link from "next/link";
import { trackEvent } from '@/lib/tracking';
import { FACILITY_TYPES, getFacilityHref } from '@/data/facility-types';
import { Hospital, Car, Baby } from 'lucide-react';

// Featured industry cards — configured from the shared facility types
const FEATURED_INDUSTRIES = [
    {
        slugs: ['medical-offices', 'urgent-care', 'surgery-centers'],
        title: 'Medical Facilities',
        description: 'Urgent Care, Surgery Centers, & Private Practice. Focused on High-Level Disinfection, Infection Control & JCAHO Compliance.',
        cta: 'View Medical Solutions',
        link: '/industries/healthcare/medical-offices',
        icon: Hospital,
        iconColor: 'text-sky-600',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-100',
        hoverColor: 'group-hover:text-sky-600',
        ctaColor: 'text-sky-700',
        watermark: 'Rx',
        watermarkColor: 'text-sky-900',
        trackingLabel: 'medical',
    },
    {
        slugs: ['auto-dealerships'],
        title: 'Auto Dealerships',
        description: 'Showrooms & Service Centers. Focused on High-Gloss Floors & Customer Experience.',
        cta: 'View Auto Solutions',
        link: '/industries/automotive/auto-dealerships',
        icon: Car,
        iconColor: 'text-gray-700',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-100',
        hoverColor: 'group-hover:text-blue-600',
        ctaColor: 'text-blue-700',
        watermark: 'Au',
        watermarkColor: 'text-gray-900',
        trackingLabel: 'automotive',
    },
    {
        slugs: ['daycare-preschool', 'private-schools'],
        title: 'Education & Commercial',
        description: 'Daycares, Schools, & Offices. Focused on Safety, Green Cleaning, & Reliability.',
        cta: 'View Education Solutions',
        link: '/industries/education/daycare-preschool',
        icon: Baby,
        iconColor: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-100',
        hoverColor: 'group-hover:text-orange-600',
        ctaColor: 'text-orange-700',
        watermark: 'Ed',
        watermarkColor: 'text-orange-900',
        trackingLabel: 'education',
    },
];

export function IndustriesSection() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">Specialized for Your Industry</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">We don&apos;t do &quot;generic&quot; cleaning. We build custom scopes for your specific compliance needs.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {FEATURED_INDUSTRIES.map((industry) => {
                        const Icon = industry.icon;
                        return (
                            <Link key={industry.trackingLabel} href={industry.link} className="group block" onClick={() => trackEvent('industry_card_click', { industry: industry.trackingLabel })}>
                                <div className={`relative overflow-hidden rounded-2xl ${industry.bgColor} p-8 h-full border ${industry.borderColor} hover:shadow-xl hover:scale-[1.02] transition-all duration-300`}>
                                    <div className={`absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold ${industry.watermarkColor} leading-none -mr-8 -mt-8`}>{industry.watermark}</div>
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6"><Icon className={`w-8 h-8 ${industry.iconColor}`} /></div>
                                        <h3 className={`text-2xl font-bold font-heading text-gray-900 mb-2 ${industry.hoverColor} transition-colors`}>{industry.title}</h3>
                                        <p className="text-gray-600 mb-6">{industry.description}</p>
                                        <span className={`${industry.ctaColor} font-bold flex items-center gap-2`}>{industry.cta} <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
