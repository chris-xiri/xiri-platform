'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trackClick } from '@/lib/tracking';

const FACILITY_TYPES = [
    { group: "Medical", label: "Urgent Care / Walk-In Clinic", slug: "urgent-care" },
    { group: "Medical", label: "Medical Suite", slug: "medical-suite" },
    { group: "Medical", label: "Medical Condo", slug: "medical-condo" },
    { group: "Medical", label: "Home-Based Medical Office", slug: "home-medical-office" },
    { group: "Medical", label: "Ambulatory Surgery Center", slug: "surgery-center" },
    { group: "Automotive", label: "Auto Dealership", slug: "auto-dealership" },
    { group: "Education", label: "Daycare / Preschool", slug: "daycare" },
    { group: "Education", label: "Private School", slug: "private-school" },
    { group: "General", label: "Professional Office", slug: "professional-office" },
    { group: "General", label: "Gym / Fitness Center", slug: "gym" },
];

export default function Navigation() {
    const [industriesOpen, setIndustriesOpen] = useState(false);

    const handleNavClick = (destination: string, label: string) => {
        trackClick({
            element: `nav_${label.toLowerCase().replace(/\s+/g, '_')}`,
            page: window.location.pathname,
            destination,
            position: 'header',
            text: label,
        });
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
        <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Logo */}
                    <Link
                        href="/"
                        className="text-2xl font-bold text-blue-600"
                        onClick={() => handleNavClick('/', 'XIRI')}
                    >
                        XIRI
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex space-x-8 items-center">
                        {/* Industries Dropdown */}
                        <div
                            className="relative"
                            onMouseEnter={() => setIndustriesOpen(true)}
                            onMouseLeave={() => setIndustriesOpen(false)}
                        >
                            <button className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1 py-2">
                                Facility Types
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {industriesOpen && (
                                <div className="absolute top-full left-0 pt-1 w-64 z-50">
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                                        {Object.entries(groupedFacilities).map(([group, facilities]) => (
                                            <div key={group}>
                                                <div className="px-4 py-2 text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-gray-100">
                                                    {group}
                                                </div>
                                                {facilities.map((facility) => (
                                                    <Link
                                                        key={facility.slug}
                                                        href={`/${facility.slug}`}
                                                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        onClick={() => handleNavClick(`/${facility.slug}`, facility.label)}
                                                    >
                                                        {facility.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/contractors"
                            className="text-gray-700 hover:text-blue-600 transition-colors"
                            onClick={() => handleNavClick('/contractors', 'Our Contractors')}
                        >
                            Our Contractors
                        </Link>
                    </div>

                    {/* CTA Button */}
                    <Link
                        href="/medical-offices#survey"
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => handleNavClick('/medical-offices#survey', 'Get Started')}
                    >
                        Get Started
                    </Link>
                </div>
            </div>
        </nav>
    );
}
