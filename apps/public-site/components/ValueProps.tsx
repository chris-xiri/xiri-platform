'use client';

import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';

interface ValuePropCard {
    id: string;
    outcome: string;
    angle: string;
    headline: string;
    reliefTitle: string;
    relief: string;
    focusTitle: string;
    singleTenantFocus: string;
    badge: string;
    role: string;
    visual: ReactNode;
}

const CARDS: ValuePropCard[] = [
    {
        id: "blind-spot",
        outcome: "Total Mental Peace",
        angle: "Your extra set of eyes.",
        headline: "We See What You Miss.",
        reliefTitle: "No More Surprises",
        relief: "Stop worrying about the \"quiet\" leaks or the hidden compliance risks. Your dedicated FSM acts as a professional consultant, identifying facility vulnerabilities before they become operational crises.",
        focusTitle: "We Find It First",
        singleTenantFocus: "We don't wait for you to report a problem. Our nightly audits and weekly walk-throughs are designed to find the issues you're too busy to notice.",
        badge: "Proactive Monitoring",
        role: "Facility Solutions Manager",
        visual: (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full font-sans text-xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                    <span className="font-bold text-gray-900">FSM Consultation Report</span>
                    <span className="text-gray-400">#8821</span>
                </div>
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[10px]">!</div>
                        <div>
                            <p className="font-medium text-gray-800">HVAC Filter Critical</p>
                            <p className="text-gray-500 text-[10px]">Main Intake Unit B</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-[10px]">✓</div>
                        <div>
                            <p className="font-medium text-gray-800">Entrance Matting</p>
                            <p className="text-gray-500 text-[10px]">Replaced for Winter Season</p>
                        </div>
                    </div>
                </div>
                {/* Proactive Alert UI */}
                <div className="mt-4 bg-sky-50 border border-sky-100 rounded-lg p-2 flex items-center gap-2 animate-pulse">
                    <div className="bg-sky-500 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <span className="text-[10px] font-bold text-sky-800">FSM spotted & resolved: HVAC filter replacement (Completed 2 AM)</span>
                </div>
            </div>
        )
    },
    {
        id: "admin-zero",
        outcome: "Operational Simplicity",
        angle: "Your jack of all trades.",
        headline: "One Partner. Every Service.",
        reliefTitle: "Focus On Your Real Job",
        relief: "Stop juggling 12 vendor relationships. Your FSM coordinates everything—from janitorial to HVAC to landscaping—so you can focus on running your business, not managing contractors.",
        focusTitle: "One Vendor, One Invoice",
        singleTenantFocus: "We consolidate all facility services under one relationship. One monthly invoice. One point of contact. Zero administrative chaos.",
        badge: "Single Point of Contact",
        role: "Facility Solutions Manager",
        visual: (
            <div className="flex flex-col gap-3 w-full">
                <div className="bg-gray-100 rounded-lg p-3 self-end max-w-[90%] rounded-br-none">
                    <p className="text-xs text-gray-600">Front glass broken. Need fixed ASAP.</p>
                </div>
                <div className="bg-sky-600 text-white rounded-lg p-3 self-start max-w-[90%] rounded-bl-none shadow-md">
                    <p className="text-xs font-medium">On it. Glazier is dispatched. ETA 45 mins. I'll handle the insurance paperwork.</p>
                </div>
                <div className="flex justify-center mt-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                        ✓ Ticket Closed by XIRI
                    </span>
                </div>
            </div>
        )
    },
    {
        id: "audit-ready",
        outcome: "Audit-Ready Confidence",
        angle: "Protocol governance, not just cleaning.",
        headline: "Verified Protocols. Every Morning.",
        reliefTitle: "Compliance You Can Prove",
        relief: "Your dashboard shows that your vendor followed CDC Guidelines for Healthcare Facilities and OSHA's Bloodborne Pathogen Standard (29 CFR 1910.1030). We verify and document the protocols so you have proof — not promises.",
        focusTitle: "Governed, Not Just Cleaned",
        singleTenantFocus: "Stop doing \"spot-checks.\" Our Quality Management System verifies high-level disinfection protocols, supply restocking, and scope compliance — every single night, with digital proof by morning.",
        badge: "Nightly Verification",
        role: "Night Auditor",
        visual: (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
                <div className="bg-black text-white p-3 flex justify-between items-center">
                    <span className="text-[10px] font-mono">LIVE FEED • 02:14 AM</span>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded p-2">
                        <p className="text-[10px] text-gray-500">High-Level Disinfection</p>
                        <p className="text-xs font-bold text-teal-600">VERIFIED</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                        <p className="text-[10px] text-gray-500">Quality Score</p>
                        <p className="text-xs font-bold text-teal-600">PASSED (98%)</p>
                    </div>
                </div>
                <div className="border-t border-gray-100 p-2 bg-gray-50 flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-[10px] font-bold text-gray-700">Sent to Client Dashboard</span>
                </div>
            </div>
        )
    }
];

const FACILITY_TYPES = [
    { name: 'Urgent Care Center', type: 'Medical', icon: '🏥' },
    { name: 'Auto Dealership', type: 'Automotive', icon: '🚘' },
    { name: 'Private School', type: 'Education', icon: '🎓' },
    { name: 'Corporate Office', type: 'Commercial', icon: '🏢' }
];

interface Props {
    title?: string;
}

export function ValuePropsSection({ title }: Props) {
    const [activeTab, setActiveTab] = useState<string>('blind-spot');
    const [facilityIndex, setFacilityIndex] = useState<number>(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);

    const activeCard = CARDS.find(card => card.id === activeTab) || CARDS[0];
    const activeIndex = CARDS.findIndex(card => card.id === activeTab);
    const currentFacility = FACILITY_TYPES[facilityIndex];

    // Cycle through facility types every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setFacilityIndex((prev) => (prev + 1) % FACILITY_TYPES.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Swipe handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    }, []);

    const handleTouchEnd = useCallback(() => {
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            const currentIdx = CARDS.findIndex(c => c.id === activeTab);
            if (diff > 0 && currentIdx < CARDS.length - 1) {
                // Swipe left → next
                setActiveTab(CARDS[currentIdx + 1].id);
            } else if (diff < 0 && currentIdx > 0) {
                // Swipe right → prev
                setActiveTab(CARDS[currentIdx - 1].id);
            }
        }
    }, [activeTab]);

    // Update the visual for Card 1 to use dynamic facility
    const getBlindSpotVisual = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full font-sans text-xs transition-all duration-500">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                <span className="font-bold text-gray-900">FSM Consultation Report</span>
                <span className="text-gray-400">#{currentFacility.name.slice(0, 4).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded">
                <span className="text-lg">{currentFacility.icon}</span>
                <div>
                    <p className="font-bold text-gray-900 text-[11px]">{currentFacility.name}</p>
                    <p className="text-gray-500 text-[10px]">{currentFacility.type} Facility</p>
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[10px]">!</div>
                    <div>
                        <p className="font-medium text-gray-800">HVAC Filter Critical</p>
                        <p className="text-gray-500 text-[10px]">Main Intake Unit B</p>
                    </div>
                </div>
                <div className="flex items-start gap-2 opacity-50">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-[10px]">✓</div>
                    <div>
                        <p className="font-medium text-gray-800">Entrance Matting</p>
                        <p className="text-gray-500 text-[10px]">Replaced for Winter Season</p>
                    </div>
                </div>
            </div>
            {/* Proactive Alert UI */}
            <div className="mt-4 bg-sky-50 border border-sky-100 rounded-lg p-2 flex items-center gap-2 animate-pulse">
                <div className="bg-sky-500 rounded-full p-1">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <span className="text-[10px] font-bold text-sky-800">FSM spotted & resolved: HVAC filter replacement (Completed 2 AM)</span>
            </div>
        </div>
    );

    // Update CARDS array to use the dynamic visual
    const CARDS_WITH_DYNAMIC_VISUAL: ValuePropCard[] = [
        {
            id: "blind-spot",
            outcome: "Total Mental Peace",
            angle: "Your extra set of eyes.",
            headline: "We See What You Miss.",
            reliefTitle: "No More Surprises",
            relief: "Stop worrying about the \"quiet\" leaks or the hidden compliance risks. Your dedicated FSM acts as a professional consultant, identifying facility vulnerabilities before they become operational crises.",
            focusTitle: "We Find It First",
            singleTenantFocus: "We don't wait for you to report a problem. Our nightly audits and weekly walk-throughs are designed to find the issues you're too busy to notice.",
            badge: "Proactive Monitoring",
            role: "Facility Solutions Manager",
            visual: getBlindSpotVisual()
        },
        CARDS[1], // Admin-Zero (unchanged)
        CARDS[2]  // Audit-Ready (unchanged)
    ];

    const activeCardWithVisual = CARDS_WITH_DYNAMIC_VISUAL.find(card => card.id === activeTab) || CARDS_WITH_DYNAMIC_VISUAL[0];

    return (
        <section className="bg-gradient-to-b from-white to-gray-50 py-16 md:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-8 md:mb-12">
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-4 tracking-tight">
                        {title || 'Why Facilities Trust XIRI'}
                    </h2>
                    <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                        We don't just "staff" vendors. We engineer a facility management system that runs without you.
                    </p>
                </div>

                {/* Tab Navigation — scrollable on mobile */}
                <div className="flex justify-center mb-6 md:mb-10">
                    <div className="inline-flex bg-white rounded-2xl p-1.5 md:p-2 shadow-lg border border-gray-200 gap-1 md:gap-2 overflow-x-auto max-w-full no-scrollbar">
                        {CARDS_WITH_DYNAMIC_VISUAL.map((card, index) => (
                            <button
                                key={card.id}
                                onClick={() => setActiveTab(card.id)}
                                className={`
                                    px-4 py-3 md:px-8 md:py-4 rounded-xl font-bold text-sm md:text-base transition-all duration-300 flex items-center gap-2 md:gap-3 whitespace-nowrap flex-shrink-0
                                    ${activeTab === card.id
                                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 scale-105'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <span className={`text-xs font-mono ${activeTab === card.id ? 'text-sky-200' : 'text-gray-400'}`}>
                                    0{index + 1}
                                </span>
                                <span className="hidden sm:inline">{card.headline}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active Tab Content — swipeable */}
                <div
                    ref={contentRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 lg:p-12 shadow-xl border border-gray-100"
                >
                    <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">

                        {/* Content Column */}
                        <div className="space-y-5 md:space-y-6 order-2 lg:order-1">
                            <div>
                                <span className="inline-block px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3">
                                    {activeCardWithVisual.angle}
                                </span>
                                <h3 className="text-2xl md:text-4xl font-heading font-bold text-gray-900 mb-4 leading-tight">
                                    {activeCardWithVisual.headline}
                                </h3>
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-100 text-teal-800 text-sm font-bold">
                                    <span>✨</span>
                                    <span>{activeCardWithVisual.outcome}</span>
                                </div>
                            </div>

                            <div className="space-y-5 md:space-y-6 pt-4">
                                <div className="relative pl-5 md:pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-sky-400 before:to-teal-400 before:rounded-full">
                                    <h4 className="font-bold text-gray-900 mb-2 text-base">
                                        {activeCardWithVisual.reliefTitle}
                                    </h4>
                                    <p className="text-gray-600 leading-relaxed text-sm">
                                        {activeCardWithVisual.relief}
                                    </p>
                                </div>
                                <div className="relative pl-5 md:pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-sky-400 before:to-teal-400 before:rounded-full">
                                    <h4 className="font-bold text-gray-900 mb-2 text-base">
                                        {activeCardWithVisual.focusTitle}
                                    </h4>
                                    <p className="text-gray-600 leading-relaxed text-sm">
                                        {activeCardWithVisual.singleTenantFocus}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 md:pt-6 border-t border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Managed By</p>
                                    <p className="text-sm md:text-base font-bold text-gray-900">
                                        {activeCardWithVisual.role}
                                    </p>
                                </div>
                                <div className="hidden sm:block">
                                    <span className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg shadow-lg">
                                        {activeCardWithVisual.badge}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Visual Column */}
                        <div className="relative order-1 lg:order-2">
                            <div className="absolute inset-0 bg-gradient-to-tr from-sky-100 to-teal-50 rounded-2xl md:rounded-[3rem] transform rotate-3 scale-105 -z-10 opacity-50"></div>
                            <div className="bg-gray-50 border-2 border-gray-100 rounded-2xl md:rounded-[3rem] p-4 md:p-8 min-h-[280px] md:min-h-[450px] flex items-center justify-center relative overflow-hidden shadow-2xl">
                                {/* Decorative Grid */}
                                <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:24px_24px]"></div>

                                <div className="relative z-10 w-full max-w-md transform transition-all duration-700 ease-out">
                                    {activeCardWithVisual.visual}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Swipe indicator dots (mobile) + swipe hint */}
                <div className="flex flex-col items-center gap-2 mt-6 lg:hidden">
                    <p className="text-xs text-gray-400 font-medium">Swipe to explore</p>
                    <div className="flex gap-2">
                        {CARDS_WITH_DYNAMIC_VISUAL.map((card) => (
                            <button
                                key={card.id}
                                onClick={() => setActiveTab(card.id)}
                                className={`h-2 rounded-full transition-all ${activeTab === card.id ? 'bg-sky-600 w-8' : 'bg-gray-300 w-2'
                                    }`}
                                aria-label={`Switch to ${card.headline}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
