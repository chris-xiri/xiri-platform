'use client';

import { useState, useEffect, useRef } from 'react';

/* ─── Simulated Demo Data ─────────────────────────────────────── */
const DEMO_FACILITY = {
    name: 'Sunrise Medical Plaza',
    serviceType: 'Medical · Nightly Janitorial',
    vendor: 'XIRI Facility Solutions',
    totalZones: 6,
    scheduledStart: '19:00',
    estimatedCleanMin: 150,
};


const SERVICES = [
    { icon: '🧹', name: 'Nightly Janitorial', desc: 'Verified every shift' },
    { icon: '🏥', name: 'Medical Cleaning', desc: 'CDC & OSHA compliant' },
    { icon: '🔧', name: 'Handyman Services', desc: 'Minor repairs' },
    { icon: '❄️', name: 'HVAC Maintenance', desc: 'Filter changes & inspections' },
    { icon: '🐛', name: 'Pest Control', desc: 'Scheduled treatments' },
    { icon: '📦', name: 'Supply Management', desc: 'Paper, soap, liners' },
];

/* ─── NFC Live Simulation ─────────────────────────────────────── */
const LIVE_ZONES = [
    { name: 'Main Lobby', tasks: 4 },
    { name: 'Restroom A', tasks: 4 },
    { name: 'Exam Room 1', tasks: 3 },
    { name: 'Exam Room 2', tasks: 3 },
    { name: 'Break Room', tasks: 4 },
    { name: 'Hallway & Offices', tasks: 3 },
];



/* ─── Helpers ──────────────────────────────────────────────────── */


/* ─── Intersection Observer Hook ──────────────────────────────── */
function useInView(options?: IntersectionObserverInit) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
        }, { threshold: 0.15, ...options });
        obs.observe(el);
        return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { ref, inView };
}

/* ─── Main Page Component ─────────────────────────────────────── */
export default function DemoPage() {
    // Live NFC simulation
    const [liveZoneIdx, setLiveZoneIdx] = useState(-1);
    const liveStartedRef = useRef(false);

    // Section visibility
    const heroSection = useInView();
    const liveSection = useInView();
    const servicesSection = useInView();
    const ctaSection = useInView();

    useEffect(() => {
        if (liveSection.inView) startLiveSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveSection.inView]);

    useEffect(() => {
        const fallback = setTimeout(() => startLiveSimulation(), 3000);
        return () => clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function startLiveSimulation() {
        if (liveStartedRef.current) return;
        liveStartedRef.current = true;
        let idx = 0;
        const interval = setInterval(() => {
            setLiveZoneIdx(idx);
            idx++;
            if (idx >= LIVE_ZONES.length) clearInterval(interval);
        }, 1200);
    }

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'XIRI Verified Facility Management', text: 'See what verified cleaning looks like — zone by zone, task by task.', url: window.location.href });
            } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 pb-16">
            {/* ── Header ── */}
            <div
                ref={heroSection.ref}
                className={`transition-all duration-700 ${heroSection.inView ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="border-b border-gray-200 bg-white">
                    <div className="max-w-3xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900">Command Center</h1>
                                    <p className="text-xs text-gray-400">Real-time cleaning operations monitoring</p>
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-md">Live Demo</span>
                        </div>
                    </div>
                </div>

                {/* Hook — warm traffic copy */}
                <div className="bg-gray-50/80 border-b border-gray-100">
                    <div className="max-w-3xl mx-auto px-4 py-4">
                        <h2 className="text-base font-semibold text-gray-900">
                            Here&apos;s what your dashboard looks like — <em className="not-italic text-indigo-600">tonight</em>.
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            Every zone scanned. Every task verified. You see it all on your phone.
                        </p>
                        {/* Mini CTA right after hook */}
                        <a
                            href="sms:+15165269585?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more."
                            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            💬 Ready to talk? Text Chris →
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* ── Section 1: Live NFC Simulation (MOVED UP) ── */}
                <div
                    ref={liveSection.ref}
                    className={`transition-all duration-700 delay-100 ${liveSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">Live View — Shift in Progress</h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${liveZoneIdx >= 0 && liveZoneIdx < LIVE_ZONES.length ? 'bg-blue-500 animate-pulse' : liveZoneIdx >= LIVE_ZONES.length - 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-xs text-gray-400">
                                    {liveZoneIdx >= LIVE_ZONES.length - 1 ? 'Verified' : liveZoneIdx >= 0 ? 'In Progress' : 'Waiting'}
                                </span>
                            </div>
                        </div>

                        {/* Crew info */}
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">MR</div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Miguel R. — Clocked in</p>
                                    <p className="text-xs text-gray-400">Tonight, 9:14 PM · Est. 2h 30m</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Zones</p>
                                <p className="text-sm font-bold text-gray-900 font-mono">
                                    {Math.max(Math.min(liveZoneIdx + 1, LIVE_ZONES.length), 0)}/{LIVE_ZONES.length}
                                </p>
                            </div>
                        </div>

                        <div className="px-4 py-3">
                            {/* Progress bar */}
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${liveZoneIdx >= LIVE_ZONES.length - 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.max(Math.min(((liveZoneIdx + 1) / LIVE_ZONES.length) * 100, 100), 0)}%` }}
                                />
                            </div>

                            {/* Zone list */}
                            <div className="space-y-1.5">
                                {LIVE_ZONES.map((zone, i) => {
                                    const isActive = i === liveZoneIdx && liveZoneIdx < LIVE_ZONES.length;
                                    const isDone = i < liveZoneIdx || (liveZoneIdx >= LIVE_ZONES.length - 1 && i <= liveZoneIdx);
                                    const isPending = !isActive && !isDone;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-500 ${
                                                isActive ? 'bg-blue-50 border border-blue-200 scale-[1.01]' :
                                                isDone ? 'bg-green-50/60 border border-green-200/70' :
                                                'bg-gray-50 border border-gray-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {isDone ? (
                                                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center transition-all duration-500">
                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                ) : isActive ? (
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-gray-200 bg-white" />
                                                )}
                                                <span className={`text-sm font-medium ${isDone ? 'text-green-800' : isActive ? 'text-blue-800' : 'text-gray-400'}`}>
                                                    {zone.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-400">{zone.tasks} tasks</span>
                                                {isActive && (
                                                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded animate-pulse">
                                                        SCANNING
                                                    </span>
                                                )}
                                                {isDone && (
                                                    <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                                        ✓ VERIFIED
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span className="text-[10px] text-gray-300">pending</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Completion message */}
                            {liveZoneIdx >= LIVE_ZONES.length - 1 && (
                                <div className="mt-4 text-center py-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm font-bold text-green-700">✅ Shift Complete — All zones verified</p>
                                    <p className="text-xs text-green-600 mt-0.5">Morning report will be sent automatically at 7:00 AM</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-400 text-center mt-3">
                        This is a simulation of what happens during a real cleaning shift.
                        <br />
                        Your crew taps NFC tags in each zone — you see it all on your phone.
                    </p>
                </div>



                {/* ── Section 3: Services ── */}
                <div
                    ref={servicesSection.ref}
                    className={`transition-all duration-700 delay-100 ${servicesSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                            <h3 className="text-sm font-semibold text-gray-900">One Partner. Everything Covered.</h3>
                            <p className="text-xs text-gray-400 mt-0.5">We&apos;re not just a cleaning company — we&apos;re your outsourced facility manager.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-px bg-gray-100 p-px">
                            {SERVICES.map(svc => (
                                <div key={svc.name} className="bg-white p-3 text-center">
                                    <span className="text-xl block mb-1">{svc.icon}</span>
                                    <p className="text-xs font-semibold text-gray-900 leading-tight">{svc.name}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{svc.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-3 border-t border-gray-100">
                            <p className="text-sm text-indigo-600 leading-relaxed">
                                <span className="font-bold">One invoice.</span> Cleaning + maintenance + supplies + compliance verification. Stop juggling 4 vendors.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Section 4: CTA ── */}
                <div
                    ref={ctaSection.ref}
                    className={`transition-all duration-700 delay-100 ${ctaSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    {/* Scarcity */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
                        <p className="text-sm text-amber-800 leading-relaxed">
                            <span className="font-bold">📍 We have one spot left in your area.</span> We&apos;re onboarding a location nearby this month and looking to add one more building in the route. Reach out while we&apos;re still scheduling.
                        </p>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}>
                        <div className="px-6 py-8 text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">
                                See This For Your Building
                            </h2>
                            <p className="text-sm text-indigo-200/80 mb-6 leading-relaxed">
                                Free 15-minute walkthrough. We&apos;ll scope your building and show you exactly what verified cleaning looks like — no obligation.
                            </p>

                            <a
                                href="sms:+15165269585?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more%20about%20verified%20cleaning%20for%20my%20building."
                                className="block w-full py-4 rounded-lg bg-white text-indigo-900 font-bold text-base shadow-lg hover:bg-indigo-50 transition-all mb-2.5"
                            >
                                💬 Text Chris
                            </a>

                            <a
                                href="tel:+15165269585"
                                className="block w-full py-3.5 rounded-lg border border-indigo-300/40 text-indigo-100 font-medium text-sm hover:bg-indigo-800/30 transition-all mb-2.5"
                            >
                                📞 Call: (516) 526-9585
                            </a>

                            <a
                                href="mailto:chris@xiri.ai?subject=Interested%20in%20XIRI%20Facility%20Management&body=Hi%20Chris%2C%0A%0AI%20saw%20the%20XIRI%20demo%20and%20I%27m%20interested%20in%20learning%20more%20about%20verified%20cleaning%20for%20my%20building.%0A%0ABuilding%20name%3A%20%0AAddress%3A%20%0A%0AThanks!"
                                className="block w-full py-3.5 rounded-lg border border-indigo-300/40 text-indigo-100 font-medium text-sm hover:bg-indigo-800/30 transition-all mb-3"
                            >
                                ✉️ Email Chris
                            </a>

                            <button
                                onClick={handleShare}
                                className="w-full py-3 rounded-lg text-indigo-300/60 font-medium text-sm hover:text-indigo-200 transition-all cursor-pointer"
                            >
                                📤 Share with your decision maker
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sticky Bottom CTA Bar ── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-2.5 safe-area-inset-bottom">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                    <a
                        href="sms:+15165269585?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more."
                        className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm text-center shadow-sm hover:bg-indigo-700 transition-all"
                    >
                        💬 Text Chris
                    </a>
                    <a
                        href="tel:+15165269585"
                        className="py-2.5 px-4 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
                    >
                        📞 Call
                    </a>
                </div>
            </div>
        </div>
    );
}
