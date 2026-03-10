'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { trackEvent } from '@/lib/tracking';
import { CTA } from '@/lib/constants';
import { FACILITY_TYPES, groupFacilityTypes, getFacilityHref, SERVICE_GROUPS } from '@/data/facility-types';
import { INDUSTRY_PILLARS } from '@/lib/industry-pillars';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LeadFormModal } from './LeadFormModal';

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const [industriesOpen, setIndustriesOpen] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);
    const [partnersOpen, setPartnersOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleNavClick = (destination: string, label: string) => {
        trackEvent('click_cta', {
            element: `nav_${label.toLowerCase().replace(/\s+/g, '_')}`,
            page: window.location.pathname,
            destination,
            position: 'header',
            text: label,
        });
    };

    const handleContractorStart = async () => {
        setLoading(true);
        handleNavClick('/onboarding', 'Apply to Join');

        try {
            // Create a blank Vendor Record to initialize the onboarding flow
            const docRef = await addDoc(collection(db, "vendors"), {
                status: 'new',
                source: 'web_nav_cta',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                onboarding: {
                    status: 'started',
                    currentStep: '0' // Starts at Language Selection
                }
            });

            router.push(`/onboarding/${docRef.id}`);

        } catch (err: any) {
            console.error("Error creating vendor:", err);
            setLoading(false);
        }
    };

    const groupedFacilities = groupFacilityTypes();



    return (
        <header className="fixed top-0 z-50 w-full font-sans shadow-md">
            {/* Trust Bar - Sticky Top */}
            <div className="bg-[#0f172a] text-white text-[14px] md:text-[14px] font-bold tracking-[0.15em] text-center py-2.5 relative z-50 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
                    {/* Mobile: Short single line */}
                    <span className="md:hidden">NATIONWIDE SCALE · FULLY INSURED</span>

                    {/* Desktop: Full message */}
                    <span className="hidden md:inline">NATIONWIDE SCALE</span>
                    <span className="hidden md:inline mx-4 text-sky-500 opacity-60">|</span>
                    <span className="hidden md:inline">LOCAL PRECISION</span>
                    <span className="hidden md:inline mx-4 text-sky-500 opacity-60">|</span>
                    <span className="hidden md:inline">FULLY BONDED & INSURED</span>

                    <span className="mx-2 md:mx-4 text-sky-500 opacity-60">|</span>

                    {/* Compliance Section */}
                    <span className="text-sky-400">AUDIT-READY 24/7</span>
                </div>
            </div>

            {/* MAIN NAV */}
            <nav className="bg-white border-b border-gray-100 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="text-3xl font-heading font-bold text-sky-700 tracking-tight flex items-center gap-2"
                            onClick={() => handleNavClick('/', 'XIRI')}
                        >
                            XIRI
                            <span className="text-xs font-sans font-normal text-gray-500 mt-1.5 hidden sm:block">FACILITY SOLUTIONS</span>
                        </Link>

                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center space-x-7">
                            {/* Industries Dropdown */}
                            <div
                                className="relative group"
                                onMouseEnter={() => setIndustriesOpen(true)}
                                onMouseLeave={() => setIndustriesOpen(false)}
                            >
                                <button className="text-gray-600 text-[15px] font-medium hover:text-sky-600 transition-colors flex items-center gap-1 py-2 group-hover:text-sky-600">
                                    Industries
                                    <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`absolute top-full -left-4 pt-4 w-[780px] transition-all duration-200 origin-top-left ${industriesOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-4 grid grid-cols-5 gap-1">
                                            {Object.entries(groupedFacilities).map(([group, facilities]) => {
                                                const pillarSlug = facilities[0]?.pillar || '';
                                                return (
                                                    <div key={group}>
                                                        <Link
                                                            href={`/industries/${pillarSlug}`}
                                                            className="px-2 py-1.5 text-xs font-bold text-sky-500 uppercase tracking-wider hover:text-sky-700 transition-colors block"
                                                            onClick={() => handleNavClick(`/industries/${pillarSlug}`, group)}
                                                        >
                                                            {group} →
                                                        </Link>
                                                        {facilities.map((facility) => (
                                                            <Link
                                                                key={facility.slug}
                                                                href={getFacilityHref(facility)}
                                                                className="block px-2 py-1.5 text-sm text-gray-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                                                onClick={() => handleNavClick(getFacilityHref(facility), facility.label)}
                                                            >
                                                                {facility.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
                                            Serving medical, commercial, and specialized facilities
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Services Dropdown */}
                            <div
                                className="relative group"
                                onMouseEnter={() => setServicesOpen(true)}
                                onMouseLeave={() => setServicesOpen(false)}
                            >
                                <button className="text-gray-600 text-[15px] font-medium hover:text-sky-600 transition-colors flex items-center gap-1 py-2 group-hover:text-sky-600">
                                    Services
                                    <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`absolute top-full -left-4 pt-4 w-[480px] transition-all duration-200 origin-top-left ${servicesOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-2 grid grid-cols-2 gap-1">
                                            {Object.entries(SERVICE_GROUPS).map(([group, groupData]) => (
                                                <div key={group} className="pb-2">
                                                    <Link
                                                        href={groupData.href}
                                                        className="px-3 py-1.5 text-xs font-bold text-sky-500 uppercase tracking-wider hover:text-sky-700 transition-colors block"
                                                        onClick={() => handleNavClick(groupData.href, group)}
                                                    >
                                                        {group} →
                                                    </Link>
                                                    {groupData.services.map((service) => (
                                                        <Link
                                                            key={service.slug}
                                                            href={`/services/${service.slug}`}
                                                            className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                                            onClick={() => handleNavClick(`/services/${service.slug}`, service.label)}
                                                        >
                                                            {service.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                            <Link href="/services" className="text-xs text-sky-600 font-semibold hover:text-sky-700 transition-colors"
                                                onClick={() => handleNavClick('/services', 'View All Services')}
                                            >
                                                View All Services →
                                            </Link>
                                            <Link href="/calculator" className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors flex items-center gap-1"
                                                onClick={() => handleNavClick('/calculator', 'Pricing')}
                                            >
                                                💰 Get a Price Estimate →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* For Contractors Dropdown — signup + referrals */}
                            <div
                                className="relative group"
                                onMouseEnter={() => setPartnersOpen(true)}
                                onMouseLeave={() => setPartnersOpen(false)}
                            >
                                <button className="text-gray-600 text-[15px] font-medium hover:text-sky-600 transition-colors flex items-center gap-1 py-2 group-hover:text-sky-600">
                                    For Contractors
                                    <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`absolute top-full right-0 pt-4 w-[340px] transition-all duration-200 origin-top-right ${partnersOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5 p-2">
                                        <Link
                                            href="/contractors"
                                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-sky-50 transition-colors"
                                            onClick={() => { setPartnersOpen(false); handleNavClick('/contractors', 'For Contractors'); }}
                                        >
                                            <span className="text-2xl mt-0.5">🧹</span>
                                            <div>
                                                <p className="font-semibold text-sm text-gray-900">For Contractors</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Join our cleaning crew network</p>
                                            </div>
                                        </Link>
                                        <Link
                                            href="/refer"
                                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors"
                                            onClick={() => { setPartnersOpen(false); handleNavClick('/refer', 'Refer & Earn'); }}
                                        >
                                            <span className="text-2xl mt-0.5">💰</span>
                                            <div>
                                                <p className="font-semibold text-sm text-emerald-700">Refer &amp; Earn $500</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Refer a building, earn cash + recurring</p>
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button + Mobile Hamburger */}
                        <div className="flex items-center gap-4">
                            {pathname === '/contractors' || pathname?.includes('/partners') ? (
                                <button
                                    onClick={handleContractorStart}
                                    disabled={loading}
                                    className="bg-sky-600 text-white px-6 py-2.5 rounded-full font-medium shadow-md shadow-sky-600/20 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Loading...' : 'See Available Jobs'}
                                </button>
                            ) : pathname?.startsWith('/refer') ? (
                                <a
                                    href="#refer-form"
                                    className="hidden md:inline-flex bg-emerald-600 text-white px-6 py-2.5 rounded-full font-medium shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                    onClick={() => handleNavClick('#refer-form', 'Refer a Building')}
                                >
                                    💰 Refer a Building
                                </a>
                            ) : (
                                <>
                                    <span className="hidden lg:block text-sm font-medium text-gray-500">
                                        Need a quote?
                                    </span>
                                    <button
                                        className="hidden md:inline-flex bg-sky-600 text-white px-6 py-2.5 rounded-full font-medium shadow-md shadow-sky-600/20 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                        onClick={() => {
                                            handleNavClick('modal_open', 'Get Building Scope');
                                            setIsAuditModalOpen(true);
                                        }}
                                    >
                                        {CTA.primary}
                                    </button>
                                </>
                            )}

                            {/* Mobile Hamburger */}
                            <button
                                className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
                                onClick={() => setMobileOpen(!mobileOpen)}
                                aria-label="Toggle menu"
                            >
                                <span className={`block w-6 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                                <span className={`block w-6 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
                                <span className={`block w-6 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Panel */}
                {mobileOpen && (
                    <div className="md:hidden border-t border-gray-100 bg-white max-h-[70vh] overflow-y-auto">
                        <div className="px-4 py-4 space-y-4">
                            {/* Facility Types */}
                            <div>
                                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2">Facility Types</p>
                                {/* Horizontal Pillar Links (Mobile) */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {INDUSTRY_PILLARS.map(pillar => (
                                        <Link
                                            key={pillar.slug}
                                            href={`/industries/${pillar.slug}`}
                                            className="px-3 py-1 text-xs font-bold rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            {pillar.name.replace(' Facilities', '').replace(' & ', ' & ')}
                                        </Link>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    {FACILITY_TYPES.slice(0, 8).map(f => (
                                        <Link key={f.slug} href={getFacilityHref(f)} className="text-sm text-gray-700 py-1.5 hover:text-sky-600" onClick={() => setMobileOpen(false)}>
                                            {f.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Services */}
                            <div>
                                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2">Services</p>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.values(SERVICE_GROUPS).flatMap(g => g.services).slice(0, 6).map(s => (
                                        <Link key={s.slug} href={`/services/${s.slug}`} className="text-sm text-gray-700 py-1.5 hover:text-sky-600" onClick={() => setMobileOpen(false)}>
                                            {s.label}
                                        </Link>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <Link href="/services" className="text-xs text-sky-600 font-semibold inline-block" onClick={() => setMobileOpen(false)}>
                                        View All Services →
                                    </Link>
                                    <Link href="/calculator" className="text-xs text-emerald-600 font-semibold inline-block" onClick={() => setMobileOpen(false)}>
                                        💰 Get a Price Estimate →
                                    </Link>
                                </div>
                            </div>

                            {/* For Contractors */}
                            <div className="border-t border-gray-100 pt-3 space-y-3">
                                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider">For Contractors</p>
                                <Link href="/contractors" className="block text-sm font-medium text-gray-700 hover:text-sky-600" onClick={() => setMobileOpen(false)}>🧹 Join Our Cleaning Network</Link>
                                <Link href="/refer" className="block text-sm font-semibold text-emerald-600 hover:text-emerald-700" onClick={() => setMobileOpen(false)}>💰 Refer & Earn $500</Link>
                            </div>

                            {/* Mobile CTA */}
                            <button
                                className="w-full bg-sky-600 text-white py-3 rounded-xl font-medium text-sm shadow-md"
                                onClick={() => {
                                    setMobileOpen(false);
                                    handleNavClick('modal_open', 'Get Building Scope');
                                    setIsAuditModalOpen(true);
                                }}
                            >
                                {CTA.primary}
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            <LeadFormModal
                isOpen={isAuditModalOpen}
                onClose={() => setIsAuditModalOpen(false)}
            />
        </header>
    );
}
