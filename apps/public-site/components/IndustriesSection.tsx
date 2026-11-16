'use client';

import Link from "next/link";
import { trackEvent } from '@/lib/tracking';
import { FACILITY_TYPES, getFacilityHref } from '@/data/facility-types';
import { Stethoscope, Hospital, Building2 } from 'lucide-react';

// Featured industry cards — configured from the shared facility types
const FEATURED_INDUSTRIES = [
    {
        slugs: ['dental-offices'],
        title: 'Dental Offices & Oral Surgery',
        description: 'Built for Dentist-Owners & Office Managers. Nightly operatory terminal cleaning, sterilization area sanitization, chair-safe disinfection, and CDC/OSHA compliance.',
        cta: 'View Dental Office Hub',
        link: '/industries/healthcare/dental-offices',
        icon: Stethoscope,
        iconColor: 'text-sky-600',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-200',
        hoverColor: 'group-hover:text-sky-600',
        ctaColor: 'text-sky-700',
        watermark: 'DDS',
        watermarkColor: 'text-sky-900',
        trackingLabel: 'dental',
    },
    {
        slugs: ['medical-offices', 'urgent-care', 'surgery-centers'],
        title: 'Medical & Surgical Facilities',
        description: 'Private Practices, Urgent Care, & Ambulatory Surgery Centers. Focused on High-Level Disinfection, Infection Control & JCAHO Survey Readiness.',
        cta: 'View Medical Solutions',
        link: '/industries/healthcare/medical-offices',
        icon: Hospital,
        iconColor: 'text-teal-600',
        bgColor: 'bg-teal-50/70',
        borderColor: 'border-teal-100',
        hoverColor: 'group-hover:text-teal-600',
        ctaColor: 'text-teal-700',
        watermark: 'Rx',
        watermarkColor: 'text-teal-900',
        trackingLabel: 'medical',
    },
    {
        slugs: ['professional-offices', 'auto-dealerships', 'daycare-preschool'],
        title: 'Commercial, Auto & Education',
        description: 'Single-Tenant Buildings, Auto Dealerships, & Private Schools. Consolidated janitorial, floor care, and smart restroom supply management.',
        cta: 'View Commercial Solutions',
        link: '/industries/commercial/professional-offices',
        icon: Building2,
        iconColor: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        hoverColor: 'group-hover:text-sky-600',
        ctaColor: 'text-slate-800',
        watermark: 'HQ',
        watermarkColor: 'text-slate-900',
        trackingLabel: 'commercial',
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
                                    <div className={`absolute top-0 right-0 p-4 opacity-10 text-8xl font-bold ${industry.watermarkColor} leading-none -mr-4 -mt-4`}>{industry.watermark}</div>
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
