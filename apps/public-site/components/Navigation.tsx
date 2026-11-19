'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    Calculator,
    ChevronDown,
    ClipboardList,
    DollarSign,
    FileCheck2,
    FileText,
    FlaskConical,
    ShieldCheck,
    Users,
    Building2,
    Sparkles,
    Wrench,
} from 'lucide-react';
import { trackEvent } from '@/lib/tracking';
import { CTA } from '@/lib/constants';
import { FACILITY_TYPES, groupFacilityTypes, getFacilityHref, SERVICE_GROUPS } from '@/data/facility-types';
import { INDUSTRY_PILLARS } from '@/lib/industry-pillars';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeadFormModal } from './LeadFormModal';

const BUYER_TOOLS = [
    {
        href: '/calculator',
        label: 'Cost Calculator',
        description: 'Estimate fair monthly & per-sqft cleaning rates',
        icon: Calculator,
        badge: 'Popular',
        iconClass: 'bg-sky-50 text-sky-600',
    },
    {
        href: '/tools/janitorial-rfp',
        label: 'Janitorial RFP Builder',
        description: 'Generate a shareable PDF or DOCX scope RFP',
        icon: FileText,
        iconClass: 'bg-indigo-50 text-indigo-600',
    },
    {
        href: '/tools/janitorial-transition-guide',
        label: 'Vendor Switch Toolkit',
        description: '60-day transition plan & cancellation template',
        icon: ClipboardList,
        iconClass: 'bg-sky-50 text-sky-600',
    },
    {
        href: '/tools/compliance-checker',
        label: 'Compliance Checker',
        description: 'Score OSHA, HIPAA & JCAHO audit readiness',
        icon: FileCheck2,
        iconClass: 'bg-emerald-50 text-emerald-600',
    },
    {
        href: '/tools/sds-lookup',
        label: 'SDS & Chemical Lookup',
        description: 'Review VOC, PPE & product safety notes',
        icon: FlaskConical,
        iconClass: 'bg-amber-50 text-amber-600',
    },
] as const;

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const [openDropdown, setOpenDropdown] = useState<'industries' | 'services' | 'tools' | 'partners' | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSection, setMobileSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setMobileSection(prev => (prev === section ? null : section));
    };

    const closeAllMenus = () => {
        setOpenDropdown(null);
        setMobileOpen(false);
    };

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
            const docRef = await addDoc(collection(db, 'vendors'), {
                status: 'new',
                source: 'web_nav_cta',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                onboarding: {
                    status: 'started',
                    currentStep: '0', // Starts at Language Selection
                },
            });

            router.push(`/onboarding/${docRef.id}`);
        } catch (err: any) {
            console.error('Error creating vendor:', err);
            setLoading(false);
        }
    };

    const groupedFacilities = groupFacilityTypes();

    const isIndustriesActive = pathname?.startsWith('/industries');
    const isServicesActive = pathname?.startsWith('/services');
    const isSolutionsActive = pathname?.startsWith('/solutions');
    const isToolsActive = pathname?.startsWith('/calculator') || pathname?.startsWith('/tools');
    const isPartnersActive = pathname?.startsWith('/contractors') || pathname?.startsWith('/refer');

    return (
        <header className="fixed top-0 z-50 w-full font-sans">
            {/* Trust Bar - Sticky Top (hidden on contractor pages and calculator tool pages) */}
            {!pathname.startsWith('/contractors') && !pathname.startsWith('/calculator') && (
                <div className="bg-[#0f172a] text-white text-[12px] md:text-[13px] font-bold tracking-[0.15em] text-center py-2 md:py-2.5 relative z-50 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 flex items-center justify-center whitespace-nowrap">
                        {/* Mobile: Compact signal + 1-Tap SMS */}
                        <span className="md:hidden">FULLY INSURED</span>
                        <span className="md:hidden mx-2 text-sky-500 opacity-60">·</span>
                        <a
                            href="sms:+1-516-399-0350?&body=Hi%20XIRI%2C%20I%27d%20like%20to%20schedule%20a%20site%20walkthrough%20%2F%20quote."
                            onClick={() => trackEvent('sms_walkthrough_click', { source: 'top_trust_bar_mobile' })}
                            className="md:hidden text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                        >
                            TEXT (516) 399-0350
                        </a>

                        {/* Desktop: Full message + SMS Walkthrough link */}
                        <span className="hidden md:inline">NATIONWIDE SCALE</span>
                        <span className="hidden md:inline mx-4 text-sky-500 opacity-60">|</span>
                        <span className="hidden md:inline">LOCAL PRECISION</span>
                        <span className="hidden md:inline mx-4 text-sky-500 opacity-60">|</span>
                        <span className="hidden md:inline">FULLY INSURED</span>
                        <span className="hidden md:inline mx-4 text-sky-500 opacity-60">|</span>
                        <a
                            href="sms:+1-516-399-0350?&body=Hi%20XIRI%2C%20I%27d%20like%20to%20schedule%20a%20site%20walkthrough%20%2F%20quote."
                            onClick={() => trackEvent('sms_walkthrough_click', { source: 'top_trust_bar_desktop' })}
                            className="hidden md:inline text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            TEXT FOR WALKTHROUGH: (516) 399-0350
                        </a>
                    </div>
                </div>
            )}

            {/* MAIN NAV */}
            <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center gap-4">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="shrink-0 whitespace-nowrap text-2xl sm:text-3xl font-heading font-bold text-sky-700 tracking-tight flex items-baseline gap-2"
                            onClick={() => {
                                closeAllMenus();
                                handleNavClick('/', 'XIRI');
                            }}
                        >
                            <span>XIRI</span>
                            <span className="text-[11px] font-sans font-medium tracking-wider text-gray-500">
                                FACILITY SOLUTIONS
                            </span>
                        </Link>

                        {/* Desktop Navigation Links */}
                        <div className="hidden lg:flex items-center gap-6 xl:gap-7">
                            {/* Industries Dropdown */}
                            <div
                                className="relative"
                                onMouseEnter={() => setOpenDropdown('industries')}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <button
                                    type="button"
                                    aria-expanded={openDropdown === 'industries'}
                                    onClick={() => setOpenDropdown(prev => (prev === 'industries' ? null : 'industries'))}
                                    className={`whitespace-nowrap text-[15px] font-medium transition-colors inline-flex items-center gap-1 py-2 ${
                                        isIndustriesActive || openDropdown === 'industries'
                                            ? 'text-sky-600'
                                            : 'text-gray-600 hover:text-sky-600'
                                    }`}
                                >
                                    <span>Industries</span>
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                            openDropdown === 'industries' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                <div
                                    className={`absolute top-full -left-24 xl:-left-4 pt-3 w-[740px] max-w-[calc(100vw-2rem)] transition-all duration-200 origin-top-left ${
                                        openDropdown === 'industries'
                                            ? 'opacity-100 scale-100 visible'
                                            : 'opacity-0 scale-95 invisible pointer-events-none'
                                    }`}
                                >
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-4 grid grid-cols-5 gap-1">
                                            {Object.entries(groupedFacilities).map(([group, facilities]) => {
                                                const pillarSlug = facilities[0]?.pillar || '';
                                                return (
                                                    <div key={group}>
                                                        <Link
                                                            href={`/industries/${pillarSlug}`}
                                                            className="px-2 py-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider hover:text-sky-700 transition-colors block"
                                                            onClick={() => {
                                                                setOpenDropdown(null);
                                                                handleNavClick(`/industries/${pillarSlug}`, group);
                                                            }}
                                                        >
                                                            {group} →
                                                        </Link>
                                                        {facilities.map(facility => (
                                                            <Link
                                                                key={facility.slug}
                                                                href={getFacilityHref(facility)}
                                                                className="block px-2 py-1.5 text-sm text-gray-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleNavClick(getFacilityHref(facility), facility.label);
                                                                }}
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
                                className="relative"
                                onMouseEnter={() => setOpenDropdown('services')}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <button
                                    type="button"
                                    aria-expanded={openDropdown === 'services'}
                                    onClick={() => setOpenDropdown(prev => (prev === 'services' ? null : 'services'))}
                                    className={`whitespace-nowrap text-[15px] font-medium transition-colors inline-flex items-center gap-1 py-2 ${
                                        isServicesActive || openDropdown === 'services'
                                            ? 'text-sky-600'
                                            : 'text-gray-600 hover:text-sky-600'
                                    }`}
                                >
                                    <span>Services</span>
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                            openDropdown === 'services' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                <div
                                    className={`absolute top-full -left-16 xl:-left-4 pt-3 w-[660px] max-w-[calc(100vw-2rem)] transition-all duration-200 origin-top-left ${
                                        openDropdown === 'services'
                                            ? 'opacity-100 scale-100 visible'
                                            : 'opacity-0 scale-95 invisible pointer-events-none'
                                    }`}
                                >
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-2 grid grid-cols-3 gap-1">
                                            {Object.entries(SERVICE_GROUPS).map(([group, groupData]) => (
                                                <div key={group} className="pb-2">
                                                    <Link
                                                        href={groupData.href}
                                                        className="px-3 py-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider hover:text-sky-700 transition-colors block"
                                                        onClick={() => {
                                                            setOpenDropdown(null);
                                                            handleNavClick(groupData.href, group);
                                                        }}
                                                    >
                                                        {group} →
                                                    </Link>
                                                    {groupData.services.map(service => (
                                                        <Link
                                                            key={service.slug}
                                                            href={`/services/${service.slug}`}
                                                            className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                                            onClick={() => {
                                                                setOpenDropdown(null);
                                                                handleNavClick(`/services/${service.slug}`, service.label);
                                                            }}
                                                        >
                                                            {service.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                            <Link
                                                href="/services"
                                                className="text-xs text-sky-600 font-semibold hover:text-sky-700 transition-colors"
                                                onClick={() => {
                                                    setOpenDropdown(null);
                                                    handleNavClick('/services', 'View All Services');
                                                }}
                                            >
                                                View All Services →
                                            </Link>
                                            <Link
                                                href="/calculator"
                                                className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors inline-flex items-center gap-1"
                                                onClick={() => {
                                                    setOpenDropdown(null);
                                                    handleNavClick('/calculator', 'Pricing');
                                                }}
                                            >
                                                <Calculator className="w-3.5 h-3.5" />
                                                Get a Price Estimate →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Solutions Link */}
                            <Link
                                href="/solutions"
                                className={`whitespace-nowrap text-[15px] font-medium transition-colors py-2 ${
                                    isSolutionsActive ? 'text-sky-600' : 'text-gray-600 hover:text-sky-600'
                                }`}
                                onClick={() => handleNavClick('/solutions', 'Solutions')}
                            >
                                Solutions
                            </Link>

                            {/* Tools Dropdown (consolidates Cost Calculator + Buyer Tools) */}
                            <div
                                className="relative"
                                onMouseEnter={() => setOpenDropdown('tools')}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <button
                                    type="button"
                                    aria-expanded={openDropdown === 'tools'}
                                    onClick={() => setOpenDropdown(prev => (prev === 'tools' ? null : 'tools'))}
                                    className={`whitespace-nowrap text-[15px] font-medium transition-colors inline-flex items-center gap-1 py-2 ${
                                        isToolsActive || openDropdown === 'tools'
                                            ? 'text-sky-600'
                                            : 'text-gray-600 hover:text-sky-600'
                                    }`}
                                >
                                    <span>Tools</span>
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                            openDropdown === 'tools' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                <div
                                    className={`absolute top-full right-0 xl:left-0 pt-3 w-[360px] transition-all duration-200 origin-top ${
                                        openDropdown === 'tools'
                                            ? 'opacity-100 scale-100 visible'
                                            : 'opacity-0 scale-95 invisible pointer-events-none'
                                    }`}
                                >
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-2 space-y-0.5">
                                            {BUYER_TOOLS.map(tool => {
                                                const Icon = tool.icon;
                                                return (
                                                    <Link
                                                        key={tool.href}
                                                        href={tool.href}
                                                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group/item"
                                                        onClick={() => {
                                                            setOpenDropdown(null);
                                                            handleNavClick(tool.href, tool.label);
                                                        }}
                                                    >
                                                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tool.iconClass}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-sm text-gray-900 group-hover/item:text-sky-700 transition-colors">
                                                                    {tool.label}
                                                                </p>
                                                                {'badge' in tool && tool.badge && (
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                                                                        {tool.badge}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                                            <Link
                                                href="/tools"
                                                className="text-xs text-sky-600 font-semibold hover:text-sky-700 transition-colors"
                                                onClick={() => {
                                                    setOpenDropdown(null);
                                                    handleNavClick('/tools', 'View All Free Tools');
                                                }}
                                            >
                                                View All Buyer Tools →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* For Contractors Dropdown — signup + referrals */}
                            <div
                                className="relative"
                                onMouseEnter={() => setOpenDropdown('partners')}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <button
                                    type="button"
                                    aria-expanded={openDropdown === 'partners'}
                                    onClick={() => setOpenDropdown(prev => (prev === 'partners' ? null : 'partners'))}
                                    className={`whitespace-nowrap text-[15px] font-medium transition-colors inline-flex items-center gap-1 py-2 ${
                                        isPartnersActive || openDropdown === 'partners'
                                            ? 'text-sky-600'
                                            : 'text-gray-600 hover:text-sky-600'
                                    }`}
                                >
                                    <span>For Contractors</span>
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                            openDropdown === 'partners' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>

                                <div
                                    className={`absolute top-full right-0 pt-3 w-[320px] transition-all duration-200 origin-top-right ${
                                        openDropdown === 'partners'
                                            ? 'opacity-100 scale-100 visible'
                                            : 'opacity-0 scale-95 invisible pointer-events-none'
                                    }`}
                                >
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5 p-2 space-y-0.5">
                                        <Link
                                            href="/contractors"
                                            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-sky-50 transition-colors"
                                            onClick={() => {
                                                setOpenDropdown(null);
                                                handleNavClick('/contractors', 'For Contractors');
                                            }}
                                        >
                                            <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                                                <Users className="w-4 h-4" />
                                            </span>
                                            <div>
                                                <p className="font-semibold text-sm text-gray-900">Join Our Network</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Apply as a vetted cleaning crew</p>
                                            </div>
                                        </Link>
                                        <Link
                                            href="/refer"
                                            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-emerald-50 transition-colors"
                                            onClick={() => {
                                                setOpenDropdown(null);
                                                handleNavClick('/refer', 'Refer & Earn');
                                            }}
                                        >
                                            <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <DollarSign className="w-4 h-4" />
                                            </span>
                                            <div>
                                                <p className="font-semibold text-sm text-emerald-700">Refer &amp; Earn $500</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Refer a building, earn cash + recurring</p>
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button + Mobile/Tablet Hamburger */}
                        <div className="flex items-center gap-3 shrink-0">
                            {pathname?.startsWith('/contractors') || pathname?.includes('/partners') ? (
                                <button
                                    type="button"
                                    onClick={handleContractorStart}
                                    disabled={loading}
                                    className="hidden md:inline-flex items-center justify-center whitespace-nowrap bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm shadow-sky-600/20 hover:bg-sky-700 hover:shadow-md hover:shadow-sky-600/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Loading...' : CTA.contractor}
                                </button>
                            ) : pathname?.startsWith('/refer') ? (
                                <a
                                    href="#refer-form"
                                    className="hidden md:inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/30 transition-all duration-200"
                                    onClick={() => handleNavClick('#refer-form', 'Refer a Building')}
                                >
                                    <DollarSign className="w-4 h-4" />
                                    Refer a Building
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    className="hidden md:inline-flex items-center justify-center whitespace-nowrap bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm shadow-sky-600/20 hover:bg-sky-700 hover:shadow-md hover:shadow-sky-600/30 transition-all duration-200"
                                    onClick={() => {
                                        handleNavClick('modal_open', 'Get Building Scope');
                                        setIsAuditModalOpen(true);
                                    }}
                                >
                                    {CTA.primary}
                                </button>
                            )}

                            {/* Mobile / Tablet Hamburger */}
                            <button
                                type="button"
                                className="lg:hidden flex flex-col justify-center items-center w-11 h-11 rounded-lg hover:bg-gray-100 transition-colors gap-1.5"
                                onClick={() => setMobileOpen(!mobileOpen)}
                                aria-label="Toggle menu"
                                aria-expanded={mobileOpen}
                            >
                                <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                                <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
                                <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile / Tablet Menu Panel */}
                {mobileOpen && (
                    <div className="lg:hidden border-t border-gray-100 bg-white max-h-[80vh] overflow-y-auto shadow-lg">
                        <div className="divide-y divide-gray-100">
                            {/* Industries — Accordion */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection('industries')}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Building2 className="w-4 h-4 text-sky-600" />
                                        <span className="text-[15px] font-semibold text-gray-900">Industries</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                            mobileSection === 'industries' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {mobileSection === 'industries' && (
                                    <div className="px-5 pb-4 space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {INDUSTRY_PILLARS.map(pillar => (
                                                <Link
                                                    key={pillar.slug}
                                                    href={`/industries/${pillar.slug}`}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 active:bg-sky-200 transition-colors"
                                                    onClick={() => setMobileOpen(false)}
                                                >
                                                    {pillar.name.replace(' Facilities', '')}
                                                </Link>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3">
                                            {FACILITY_TYPES.slice(0, 8).map(f => (
                                                <Link
                                                    key={f.slug}
                                                    href={getFacilityHref(f)}
                                                    className="text-sm text-gray-600 py-2 active:text-sky-700 transition-colors"
                                                    onClick={() => setMobileOpen(false)}
                                                >
                                                    {f.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Services — Accordion */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection('services')}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-4 h-4 text-sky-600" />
                                        <span className="text-[15px] font-semibold text-gray-900">Services</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                            mobileSection === 'services' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {mobileSection === 'services' && (
                                    <div className="px-5 pb-4">
                                        <div className="grid grid-cols-2 gap-x-3">
                                            {Object.values(SERVICE_GROUPS)
                                                .flatMap(g => g.services)
                                                .slice(0, 6)
                                                .map(s => (
                                                    <Link
                                                        key={s.slug}
                                                        href={`/services/${s.slug}`}
                                                        className="text-sm text-gray-600 py-2 active:text-sky-700 transition-colors"
                                                        onClick={() => setMobileOpen(false)}
                                                    >
                                                        {s.label}
                                                    </Link>
                                                ))}
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                            <Link href="/services" className="text-xs text-sky-600 font-semibold" onClick={() => setMobileOpen(false)}>
                                                All Services →
                                            </Link>
                                            <Link href="/calculator" className="text-xs text-emerald-600 font-semibold" onClick={() => setMobileOpen(false)}>
                                                Price Estimate →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Solutions — Direct link */}
                            <Link
                                href="/solutions"
                                className="flex items-center gap-3 px-5 py-4 active:bg-gray-50 transition-colors"
                                onClick={() => setMobileOpen(false)}
                            >
                                <ShieldCheck className="w-4 h-4 text-sky-600" />
                                <span className="text-[15px] font-semibold text-gray-900">Solutions</span>
                            </Link>

                            {/* Tools — Accordion */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection('tools')}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Wrench className="w-4 h-4 text-sky-600" />
                                        <span className="text-[15px] font-semibold text-gray-900">Tools</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                            mobileSection === 'tools' ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {mobileSection === 'tools' && (
                                    <div className="px-5 pb-4 space-y-1">
                                        {BUYER_TOOLS.map(tool => (
                                            <Link
                                                key={tool.href}
                                                href={tool.href}
                                                className="flex items-center justify-between py-2 text-sm text-gray-700 active:text-sky-700 transition-colors"
                                                onClick={() => setMobileOpen(false)}
                                            >
                                                <span>{tool.label}</span>
                                                {'badge' in tool && tool.badge && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                                                        {tool.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        ))}
                                        <div className="pt-2 mt-2 border-t border-gray-100">
                                            <Link href="/tools" className="text-xs text-sky-600 font-semibold" onClick={() => setMobileOpen(false)}>
                                                View All Buyer Tools →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* For Contractors — Direct link */}
                            <Link
                                href="/contractors"
                                className="flex items-center gap-3 px-5 py-4 active:bg-gray-50 transition-colors"
                                onClick={() => setMobileOpen(false)}
                            >
                                <Users className="w-4 h-4 text-sky-600" />
                                <span className="text-[15px] font-semibold text-gray-900">For Contractors</span>
                            </Link>

                            {/* Refer & Earn — Highlighted */}
                            <Link
                                href="/refer"
                                className="flex items-center gap-3 px-5 py-4 active:bg-emerald-50 transition-colors"
                                onClick={() => setMobileOpen(false)}
                            >
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                <span className="text-[15px] font-bold text-emerald-700">Refer &amp; Earn $500</span>
                            </Link>
                        </div>

                        {/* Mobile CTA — Full width at bottom */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            {pathname?.startsWith('/contractors') || pathname?.includes('/partners') ? (
                                <button
                                    type="button"
                                    className="w-full bg-sky-600 text-white py-3.5 rounded-xl font-semibold text-[15px] shadow-md shadow-sky-600/20 active:bg-sky-700 transition-colors"
                                    onClick={() => {
                                        setMobileOpen(false);
                                        handleContractorStart();
                                    }}
                                >
                                    {loading ? 'Loading...' : CTA.contractor}
                                </button>
                            ) : pathname?.startsWith('/refer') ? (
                                <a
                                    href="#refer-form"
                                    className="block w-full text-center bg-emerald-600 text-white py-3.5 rounded-xl font-semibold text-[15px] shadow-md shadow-emerald-600/20 active:bg-emerald-700 transition-colors"
                                    onClick={() => {
                                        setMobileOpen(false);
                                        handleNavClick('#refer-form', 'Refer a Building');
                                    }}
                                >
                                    Refer a Building
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    className="w-full bg-sky-600 text-white py-3.5 rounded-xl font-semibold text-[15px] shadow-md shadow-sky-600/20 active:bg-sky-700 transition-colors"
                                    onClick={() => {
                                        setMobileOpen(false);
                                        handleNavClick('modal_open', 'Get Building Scope');
                                        setIsAuditModalOpen(true);
                                    }}
                                >
                                    {CTA.primary}
                                </button>
                            )}
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
