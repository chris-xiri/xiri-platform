'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { trackEvent } from '@/lib/tracking';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const FACILITY_TYPES = [
    { group: "Medical", label: "Medical Offices", slug: "medical-offices" },
    { group: "Medical", label: "Urgent Care Centers", slug: "urgent-care" },
    { group: "Medical", label: "Surgery Centers", slug: "surgery-centers" },
    { group: "Automotive", label: "Auto Dealerships", slug: "auto-dealerships" },
    { group: "Education", label: "Daycares & Preschools", slug: "daycare-preschool" }
];

import { LeadFormModal } from './LeadFormModal';

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const [industriesOpen, setIndustriesOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

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

    // Group facilities by category
    const groupedFacilities = FACILITY_TYPES.reduce((acc, facility) => {
        if (!acc[facility.group]) {
            acc[facility.group] = [];
        }
        acc[facility.group].push(facility);
        return acc;
    }, {} as Record<string, typeof FACILITY_TYPES>);

    return (
        <header className="fixed top-0 z-50 w-full font-sans shadow-md">
            {/* Trust Bar - Sticky Top */}
            <div className="bg-[#0f172a] text-white text-[14px] md:text-[14px] font-bold tracking-[0.15em] text-center py-2.5 relative z-50 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
                    {/* Nationwide Section */}
                    <span className="hidden md:inline">NATIONWIDE SCALE</span>
                    <span className="md:hidden">NATIONWIDE SCALE</span>

                    <span className="mx-2 md:mx-4 text-sky-500 opacity-60">|</span>

                    {/* Precision/Local Section */}
                    <span className="hidden md:inline">LOCAL PRECISION</span>
                    <span className="md:hidden">LOCAL PRECISION</span>

                    <span className="mx-2 md:mx-4 text-sky-500 opacity-60">|</span>

                    {/* Security Section */}
                    <span>FULLY BONDED & INSURED</span>

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
                        <div className="hidden md:flex items-center space-x-10">
                            {/* Industries Dropdown */}
                            <div
                                className="relative group"
                                onMouseEnter={() => setIndustriesOpen(true)}
                                onMouseLeave={() => setIndustriesOpen(false)}
                            >
                                <button className="text-gray-600 font-medium hover:text-sky-600 transition-colors flex items-center gap-1.5 py-2 group-hover:text-sky-600">
                                    Facility Types
                                    <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`absolute top-full -left-4 pt-4 w-72 transition-all duration-200 origin-top-left ${industriesOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                                    <div className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                        <div className="p-2 space-y-1">
                                            {/* Render Groups */}
                                            {Object.entries(groupedFacilities).map(([group, facilities]) => (
                                                <div key={group} className="pb-2 last:pb-0">
                                                    <div className="px-3 py-1.5 text-xs font-bold text-sky-500 uppercase tracking-wider">
                                                        {group}
                                                    </div>
                                                    {facilities.map((facility) => (
                                                        <Link
                                                            key={facility.slug}
                                                            href={`/${facility.slug}`}
                                                            className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                                            onClick={() => handleNavClick(`/${facility.slug}`, facility.label)}
                                                        >
                                                            {facility.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-50 px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
                                            Trusted by 500+ NYC facilities
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Link
                                href="/contractors"
                                className="text-gray-600 font-medium hover:text-sky-600 transition-colors"
                                onClick={() => handleNavClick('/contractors', 'Our Contractors')}
                            >
                                For Contractors
                            </Link>
                        </div>

                        {/* CTA Button */}
                        <div className="flex items-center gap-4">
                            {pathname === '/contractors' || pathname?.includes('/partners') ? (
                                <button
                                    onClick={handleContractorStart}
                                    disabled={loading}
                                    className="bg-sky-600 text-white px-6 py-2.5 rounded-full font-medium shadow-md shadow-sky-600/20 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Starting...' : 'Apply to Join Network'}
                                </button>
                            ) : (
                                <>
                                    <span className="hidden lg:block text-sm font-medium text-gray-500">
                                        Need a quote?
                                    </span>
                                    <button
                                        className="bg-sky-600 text-white px-6 py-2.5 rounded-full font-medium shadow-md shadow-sky-600/20 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                                        onClick={() => {
                                            handleNavClick('modal_open', 'Get Audit');
                                            setIsAuditModalOpen(true);
                                        }}
                                    >
                                        Get Facility Audit
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <LeadFormModal
                isOpen={isAuditModalOpen}
                onClose={() => setIsAuditModalOpen(false)}
            />
        </header>
    );
}
