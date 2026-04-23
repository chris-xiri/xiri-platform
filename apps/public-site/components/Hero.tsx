'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LeadFormModal } from './LeadFormModal';
import { SITE, CTA } from '@/lib/constants';

interface HeroMediaSlide {
    imageSrc: string;
    alt: string;
    facilityName: string;
    facilityType: string;
    serviceFocus: string;
}

interface HeroProps {
    title: React.ReactNode;
    subtitle: React.ReactNode;
    ctaText?: string;
    ctaLink?: string;
    industryIcon?: string;
    industryLabel?: string;
    features?: { text: string; icon?: React.ReactNode }[];
    showSecondaryBtn?: boolean;
    variant?: 'light' | 'dark';
    showBrandEyebrow?: boolean;
    onCtaClick?: (e: React.MouseEvent) => void;
    secondaryCta?: { text: string; href: string };
    mediaSlides?: HeroMediaSlide[];
    backgroundImage?: string;
}

const DEFAULT_MEDIA_SLIDES: HeroMediaSlide[] = [
    {
        imageSrc: '/hero/office-lobby-cleaning.png',
        alt: 'Professional cleaning crew servicing an office lobby after hours',
        facilityName: 'Corporate Office',
        facilityType: 'Commercial Facility',
        serviceFocus: 'Nightly Commercial Cleaning'
    },
    {
        imageSrc: '/hero/medical-waiting-room-disinfecting.png',
        alt: 'Janitorial professional disinfecting a medical waiting room',
        facilityName: 'Urgent Care Center',
        facilityType: 'Medical Facility',
        serviceFocus: 'Disinfection & High-Touch Sanitizing'
    },
    {
        imageSrc: '/hero/school-hallway-cleaning.png',
        alt: 'Cleaning technician mopping a private school hallway',
        facilityName: 'Private School',
        facilityType: 'Education Facility',
        serviceFocus: 'After-Hours Hallway Cleaning'
    },
    {
        imageSrc: '/hero/restroom-sanitation.png',
        alt: 'Sanitized modern office restroom with professional cleaning cart',
        facilityName: 'Corporate Campus',
        facilityType: 'Commercial Facility',
        serviceFocus: 'Restroom Sanitation Protocol'
    },
    {
        imageSrc: '/hero/conference-room-cleaning.png',
        alt: 'After-hours conference room cleaning in a corporate office',
        facilityName: 'Corporate HQ',
        facilityType: 'Commercial Facility',
        serviceFocus: 'Conference Room Detail Cleaning'
    }
];

export function Hero({
    title,
    subtitle,
    ctaText = CTA.primary,
    ctaLink = "#audit",
    industryIcon = "🏢",
    industryLabel = "Commercial • Medical • Auto",
    features,
    showSecondaryBtn = true,
    variant = 'light',
    showBrandEyebrow = true,
    onCtaClick,
    secondaryCta,
    mediaSlides,
    backgroundImage
}: HeroProps) {
    const slides = backgroundImage
        ? [{
            ...DEFAULT_MEDIA_SLIDES[0],
            imageSrc: backgroundImage
        }]
        : mediaSlides && mediaSlides.length > 0
            ? mediaSlides
            : DEFAULT_MEDIA_SLIDES;
    const [mediaIndex, setMediaIndex] = useState<number>(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const currentSlide = slides[mediaIndex % slides.length];

    const isDark = variant === 'dark';

    // Cycle through media slides every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setMediaIndex((prev) => (prev + 1) % slides.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [slides.length]);

    const renderSecondaryCtaLabel = (text: string) => {
        const normalized = text.replace(/\s*[→]\s*$/, '').trim();
        return (
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                <span>{normalized}</span>
                <span aria-hidden="true">→</span>
            </span>
        );
    };

    return (
        <section className={`relative overflow-hidden border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-br from-sky-50 to-white border-gray-100'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Text Content */}
                    <div className="max-w-xl">
                        <h1 className={`text-4xl md:text-5xl font-heading font-bold tracking-tight leading-[1.1] mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {showBrandEyebrow && (
                                <span className="block text-sm md:text-base font-semibold tracking-[0.2em] uppercase text-sky-600 mb-3">
                                    {SITE.name}
                                </span>
                            )}
                            {title}
                        </h1>
                        <p className={`text-base md:text-lg mb-8 leading-relaxed max-w-lg ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                            {subtitle}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
                            {onCtaClick ? (
                                <button
                                    onClick={onCtaClick}
                                    className="inline-flex justify-center items-center text-center min-h-[72px] bg-sky-600 text-white px-8 py-4 rounded-full text-lg font-medium shadow-lg shadow-sky-600/20 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                >
                                    <span className="leading-tight">{ctaText}</span>
                                </button>
                            ) : ctaLink ? (
                                <a
                                    href={ctaLink}
                                    className="inline-flex justify-center items-center text-center min-h-[72px] bg-sky-600 text-white px-8 py-4 rounded-full text-lg font-medium shadow-lg shadow-sky-600/20 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                >
                                    <span className="leading-tight">{ctaText}</span>
                                </a>
                            ) : (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="inline-flex justify-center items-center text-center min-h-[72px] bg-sky-600 text-white px-8 py-4 rounded-full text-lg font-medium shadow-lg shadow-sky-600/20 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                >
                                    <span className="leading-tight">{ctaText}</span>
                                </button>
                            )}
                            {secondaryCta ? (
                                <Link
                                    href={secondaryCta.href}
                                    className="inline-flex justify-center items-center text-center min-h-[72px] px-8 py-4 rounded-full text-lg font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 transition-all duration-300 border border-sky-200"
                                >
                                    {renderSecondaryCtaLabel(secondaryCta.text)}
                                </Link>
                            ) : showSecondaryBtn ? (
                                <Link
                                    href="/contractors"
                                    className="inline-flex justify-center items-center text-center min-h-[72px] px-8 py-4 rounded-full text-lg font-medium text-gray-600 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300"
                                >
                                    For Contractors
                                </Link>
                            ) : null}
                        </div>

                        {/* Mobile Photo Rail */}
                        <div className="mt-8 lg:hidden -mx-1">
                            <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory">
                                {slides.map((slide, index) => (
                                    <button
                                        key={`${slide.imageSrc}-${index}`}
                                        type="button"
                                        onClick={() => setMediaIndex(index)}
                                        className={`relative shrink-0 w-[260px] h-[162px] rounded-2xl overflow-hidden border snap-start transition-all duration-300 ${
                                            index === mediaIndex ? 'border-sky-400 shadow-md shadow-sky-200/60' : 'border-gray-200'
                                        }`}
                                    >
                                        <img
                                            src={slide.imageSrc}
                                            alt={slide.alt}
                                            className="w-full h-full object-cover"
                                            loading={index === 0 ? 'eager' : 'lazy'}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 text-left">
                                            <p className="text-white text-sm font-semibold leading-tight">{slide.facilityName}</p>
                                            <p className="text-sky-200 text-xs">{slide.serviceFocus}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-6 text-sm text-gray-500 font-medium">
                            {features ? (
                                features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        {feature.icon || (
                                            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        {feature.text}
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Nightly Audits
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        100% Insured
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Visual / Graphic (Right Side) */}
                    <div className="hidden lg:block relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-sky-100/50 to-transparent rounded-3xl transform rotate-3 scale-105 -z-10"></div>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/5 border border-gray-100 aspect-[4/3] relative group">
                            <img
                                src={currentSlide.imageSrc}
                                alt={currentSlide.alt}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                loading="eager"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

                            <div className="absolute left-6 bottom-6 right-6">
                                <div className="inline-flex items-center rounded-full bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 mb-3 shadow-sm">
                                    {currentSlide.facilityType}
                                </div>
                                <p className="text-3xl font-bold text-white leading-tight">{currentSlide.facilityName}</p>
                                <p className="text-sky-200 font-medium mt-1">{currentSlide.serviceFocus}</p>
                            </div>

                            <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-xs font-bold text-gray-700">System Operational</span>
                                </div>
                            </div>

                            <div className="absolute top-6 left-6 bg-sky-600/95 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow">
                                Cleaning Verified
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Internal Modal */}
            <LeadFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </section>
    );
}
