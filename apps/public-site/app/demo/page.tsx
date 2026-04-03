'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Simulated Demo Data ─────────────────────────────────────── */

const SERVICES = [
    { icon: '🧹', name: 'Nightly Janitorial', desc: 'Verified every shift' },
    { icon: '🏥', name: 'Medical Cleaning', desc: 'CDC & OSHA compliant' },
    { icon: '🔧', name: 'Handyman Services', desc: 'Minor repairs' },
    { icon: '❄️', name: 'HVAC Maintenance', desc: 'Filter changes & inspections' },
    { icon: '🐛', name: 'Pest Control', desc: 'Scheduled treatments' },
    { icon: '📦', name: 'Supply Management', desc: 'Paper, soap, liners' },
];

/* ─── NFC Live Simulation — zone + task data ──────────────────── */
const LIVE_ZONES = [
    {
        name: 'Main Lobby',
        tasks: [
            'Vacuum & mop all floors',
            'Wipe reception desk & surfaces',
            'Empty trash & replace liners',
        ],
    },
    {
        name: 'Restroom A',
        tasks: [
            'Disinfect toilets, sinks & mirrors',
            'Restock paper & soap dispensers',
            'Mop & sanitize floors',
        ],
    },
    {
        name: 'Offices & Hallway',
        tasks: [
            'Vacuum carpet & dust surfaces',
            'Empty office trash cans',
            'Wipe door handles & light switches',
        ],
    },
];

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

/* ─── Continuous visibility observer (not one-shot) ───────────── */
function useIsVisible(options?: IntersectionObserverInit) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, { threshold: 0.1, ...options });
        obs.observe(el);
        return () => obs.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { ref, isVisible };
}

/* ─── Simulation State Types ──────────────────────────────────── */
type SimState = {
    activeZone: number;       // -1 = not started, >= LIVE_ZONES.length = done
    completedTasks: number;   // how many tasks checked in the active zone
    completedZones: number[]; // indices of fully verified zones
    blockedZone: number | null; // index of zone that got blocked (red scenario)
    lateWarning: boolean;       // crew-late banner visible (amber scenario)
    lateResolved: boolean;      // crew arrived after delay (amber scenario)
    auditPhase: 'idle' | 'arriving' | 'inspecting' | 'complete';
    auditZone: number;          // which zone the audit manager is currently inspecting (-1 = none)
    approvedZones: number[];    // zones the audit manager has signed off on
};

/* ─── Email Preview Phase ─────────────────────────────────────── */
type EmailPhase = 'simulation' | 'transitioning' | 'email' | 'sms' | 'crew-swap';
type EmailScenario = 'green' | 'amber' | 'red';
type PainPoint = 'inconsistent' | 'late-noshow' | 'poor-comms' | 'turnover';

const PAIN_POINTS: { id: PainPoint; label: string; icon: string; scenario: EmailScenario; solution: string; detail: string }[] = [
    { id: 'inconsistent', label: "Inconsistent cleaning quality", icon: '🔍', scenario: 'green', solution: "Our audit manager verifies every shift — this report proves the work, every night.", detail: "Our audit manager is on-site every night inspecting the work in person. NFC taps create a timestamped proof trail for every task in every zone. You get a morning report showing exactly what was cleaned, verified, and signed off on — proof the work was done, every single night." },
    { id: 'late-noshow', label: "No-shows or late arrivals", icon: '⏰', scenario: 'amber', solution: "NFC clock-in tells us the second they arrive.", detail: "When the cleaner taps in at your building, we know instantly. If nobody has checked in by the scheduled time, our system flags it and dispatches a replacement — before most companies even know there's a problem." },

    { id: 'poor-comms', label: "Poor communication", icon: '📢', scenario: 'green', solution: "You get a morning report — every single day.", detail: "No more chasing your cleaning company, leaving voicemails, or wondering if they even showed up. Our night manager documents everything on-site, and you get a detailed report in your inbox at 7 AM — issues resolved, tasks verified, zero phone tag." },
    { id: 'turnover', label: "Crew turnover & reliability", icon: '🔄', scenario: 'green', solution: "We replace cleaning companies fast — no disruption to you.", detail: "If your current cleaning company drops the ball — whether they quit, go silent, or underperform — we swap them out quickly from our vetted vendor network. Your building keeps getting cleaned on schedule, and you still get your morning report the next day like nothing changed." },
];

/* ─── Main Page Component ─────────────────────────────────────── */
export default function DemoPage() {
    const [sim, setSim] = useState<SimState>({
        activeZone: -1,
        completedTasks: 0,
        completedZones: [],
        blockedZone: null,
        lateWarning: false,
        lateResolved: false,
        auditPhase: 'idle',
        auditZone: -1,
        approvedZones: [],
    });
    const [emailPhase, setEmailPhase] = useState<EmailPhase>('simulation');
    const [emailScenario, setEmailScenario] = useState<EmailScenario>('green');
    const [selectedPain, setSelectedPain] = useState<PainPoint | null>(null);
    const [solutionBridge, setSolutionBridge] = useState<{ solution: string; detail: string } | null>(null);
    const liveStartedRef = useRef(false);
    const sessionRef = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    // Section visibility
    const heroSection = useInView();
    const liveSection = useInView();
    const servicesSection = useInView();
    const ctaSection = useInView();

    // Track if bottom CTA is visible — hides sticky footer
    const ctaVisibility = useIsVisible();

    // Use a ref so the simulation closure always sees the latest scenario
    const scenarioRef = useRef(emailScenario);
    scenarioRef.current = emailScenario;

    const BLOCKED_ZONE_INDEX = 2; // "Offices & Hallway"

    const startLiveSimulation = useCallback(() => {
        if (liveStartedRef.current) return;
        liveStartedRef.current = true;

        const scenario = scenarioRef.current;
        let zoneIdx = 0;
        let taskIdx = 0;

        const initialState: SimState = {
            activeZone: 0, completedTasks: 0, completedZones: [],
            blockedZone: null, lateWarning: false, lateResolved: false,
            auditPhase: 'idle', auditZone: -1, approvedZones: [],
        };

        // Amber: show crew-late warning first, then start after a brief delay
        if (scenario === 'amber') {
            setSim({ ...initialState, activeZone: -1, lateWarning: true });
            // After 1.2s, resolve the late warning and start scanning
            setTimeout(() => {
                setSim(prev => ({ ...prev, activeZone: 0, lateWarning: false, lateResolved: true }));
            }, 1200);
            // Clear "resolved" badge after another 1.5s
            setTimeout(() => {
                setSim(prev => ({ ...prev, lateResolved: false }));
            }, 2700);
        } else {
            setSim(initialState);
        }

        // Delay the interval start for amber so the warning shows first
        const startDelay = scenario === 'amber' ? 1250 : 0;

        setTimeout(() => {
            const interval = setInterval(() => {
                const zone = LIVE_ZONES[zoneIdx];
                if (!zone) { clearInterval(interval); return; }

                // Red scenario: block the last zone
                if (scenario === 'red' && zoneIdx === BLOCKED_ZONE_INDEX) {
                    setSim(prev => ({
                        ...prev,
                        activeZone: LIVE_ZONES.length,
                        completedTasks: 0,
                        blockedZone: BLOCKED_ZONE_INDEX,
                    }));
                    clearInterval(interval);
                    return;
                }

                taskIdx++;

                if (taskIdx >= zone.tasks.length) {
                    const completedZoneIdx = zoneIdx;
                    zoneIdx++;
                    taskIdx = 0;

                    if (zoneIdx >= LIVE_ZONES.length) {
                        setSim(prev => ({
                            ...prev,
                            activeZone: LIVE_ZONES.length,
                            completedTasks: 0,
                            completedZones: [...prev.completedZones, completedZoneIdx],
                        }));
                        clearInterval(interval);
                    } else {
                        setSim(prev => ({
                            ...prev,
                            activeZone: zoneIdx,
                            completedTasks: 0,
                            completedZones: [...prev.completedZones, completedZoneIdx],
                        }));
                    }
                } else {
                    setSim(prev => ({ ...prev, completedTasks: taskIdx }));
                }
            }, 250);
        }, startDelay);
    }, []);

    // Select pain point → flash solution → then run tailored simulation
    const selectPainPoint = useCallback((pain: PainPoint) => {
        const mapping = PAIN_POINTS.find(p => p.id === pain);
        if (!mapping) return;
        setSelectedPain(pain);
        setEmailScenario(mapping.scenario);
        scenarioRef.current = mapping.scenario;
        setEmailPhase('simulation');
        liveStartedRef.current = false;
        setSim({ activeZone: -1, completedTasks: 0, completedZones: [], blockedZone: null, lateWarning: false, lateResolved: false, auditPhase: 'idle', auditZone: -1, approvedZones: [] });

        // Show solution bridge in the sim section
        setSolutionBridge({ solution: mapping.solution, detail: mapping.detail });

        // After 3s, keep bridge visible and start the tailored experience below it
        setTimeout(() => {
            if (pain === 'poor-comms') {
                setEmailPhase('email');
            } else if (pain === 'late-noshow') {
                setEmailPhase('sms');
            } else if (pain === 'turnover') {
                setEmailPhase('crew-swap');
            } else {
                startLiveSimulation();
            }
        }, 3500);

        // GA4 tracking
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'demo_pain_point_selected', {
                pain_point: pain,
            });
        }

        // Firestore click tracking (fire-and-forget)
        fetch('/api/demo-clicks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ painPoint: pain, sessionId: sessionRef.current }),
        }).catch(() => { /* silent */ });
    }, [startLiveSimulation]);

    // Transition to email preview after simulation completes
    const cleaningDone = sim.activeZone >= LIVE_ZONES.length;
    const allDone = cleaningDone && sim.auditPhase === 'complete';

    // Start audit manager phase after cleaner finishes (no blocked zones)
    useEffect(() => {
        if (!cleaningDone || sim.blockedZone !== null || sim.auditPhase !== 'idle') return;
        // Brief pause to let user see "Cleaning Complete", then start audit
        const timer = setTimeout(() => {
            setSim(prev => ({ ...prev, auditPhase: 'arriving' }));
            setTimeout(() => {
                setSim(prev => ({ ...prev, auditPhase: 'inspecting', auditZone: 0 }));
                // Tick through zones
                let aZone = 0;
                const auditInterval = setInterval(() => {
                    aZone++;
                    if (aZone >= LIVE_ZONES.length) {
                        clearInterval(auditInterval);
                        setSim(prev => ({
                            ...prev,
                            approvedZones: [...prev.approvedZones, aZone - 1],
                            auditPhase: 'complete',
                            auditZone: LIVE_ZONES.length,
                        }));
                    } else {
                        setSim(prev => ({
                            ...prev,
                            approvedZones: [...prev.approvedZones, aZone - 1],
                            auditZone: aZone,
                        }));
                    }
                }, 1200);
            }, 1500);
        }, 1200);
        return () => clearTimeout(timer);
    }, [cleaningDone, sim.blockedZone, sim.auditPhase]);

    // Transition to email preview after audit completes
    useEffect(() => {
        if (!allDone) return;
        // For 'inconsistent', keep the completed simulation + blurb visible — don't transition
        if (selectedPain === 'inconsistent') return;
        // Brief pause to let user see "All Verified", then transition
        const timer = setTimeout(() => {
            setEmailPhase('transitioning');
            // After fade-out, switch to email view
            setTimeout(() => setEmailPhase('email'), 400);
        }, 1800);
        return () => clearTimeout(timer);
    }, [allDone, selectedPain]);

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

    const displayCount = cleaningDone
        ? (sim.blockedZone !== null ? sim.completedZones.length : LIVE_ZONES.length)
        : Math.min(sim.completedZones.length, LIVE_ZONES.length);

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
                                    <h1 className="text-lg font-bold text-gray-900">See Verified Facility Management</h1>
                                    <p className="text-xs text-gray-400">How XIRI keeps your building clean & accountable</p>
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-md">Interactive Demo</span>
                        </div>
                    </div>
                </div>

                {/* Quiz-style diagnostic — engaging poll design */}
                <div className="bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-800 py-10">
                    <div className="max-w-3xl mx-auto px-4">
                        {/* Poll header */}
                        <div className="text-center mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
                                📊 Quick Poll
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
                                What frustrates you most<br className="sm:hidden" /> about your cleaning service?
                            </h2>
                            <p className="text-sm text-indigo-300/80">
                                Tap your answer — we&apos;ll show you how we solve it in real time.
                            </p>
                        </div>

                        {/* Poll options — stacked full-width */}
                        <div className="space-y-2.5">
                            {PAIN_POINTS.map((p, idx) => (
                                <button
                                    key={p.id}
                                    onClick={() => selectPainPoint(p.id)}
                                    className={`group w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-300 ${
                                        selectedPain === p.id
                                            ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/40 scale-[1.02]'
                                            : selectedPain === null
                                                ? 'bg-indigo-900/40 border-indigo-700/40 hover:bg-indigo-800/60 hover:border-indigo-600/60 hover:scale-[1.01] cursor-pointer'
                                                : 'bg-indigo-950/40 border-indigo-800/20 opacity-40 cursor-pointer hover:opacity-60'
                                    }`}
                                >
                                    <span className="text-2xl shrink-0">{p.icon}</span>
                                    <span className={`text-base font-semibold flex-1 ${
                                        selectedPain === p.id ? 'text-white' : 'text-indigo-100'
                                    }`}>{p.label}</span>
                                    {selectedPain === p.id ? (
                                        <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                                            <span className="text-white text-sm font-bold">✓</span>
                                        </span>
                                    ) : (
                                        <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            selectedPain === null ? 'border-indigo-600 group-hover:border-indigo-400' : 'border-indigo-800/30'
                                        }`}>
                                            <span className="text-xs text-indigo-400 font-bold">{String.fromCharCode(65 + idx)}</span>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Engagement nudge */}
                        {!selectedPain && (
                            <p className="text-center text-xs text-indigo-400/60 mt-4 animate-pulse">
                                👆 Pick the one that hits closest to home
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Solution Bridge — own section with distinct background ── */}
            {solutionBridge && (
                <div className="bg-gradient-to-b from-indigo-50/60 to-indigo-50/30 border-y border-indigo-100 py-8 animate-fadeIn">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-md">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-white text-lg">✦</span>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-indigo-900 mb-1">Here&apos;s how XIRI solves this:</p>
                                    <p className="text-base font-bold text-gray-900 mb-2">{solutionBridge.solution}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed">{solutionBridge.detail}</p>
                                    {!(emailPhase !== 'simulation' || sim.activeZone >= 0) && (
                                    <p className="text-xs text-indigo-400 mt-3 flex items-center gap-1.5">
                                        <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                                        {selectedPain === 'poor-comms' ? 'Loading your morning report…' :
                                         selectedPain === 'late-noshow' ? 'Starting SMS simulation…' :
                                         selectedPain === 'turnover' ? 'Starting crew swap timeline…' :
                                         'Starting simulation…'}
                                    </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Simulation / Email Section — separate visual block ── */}
            <div className={`${selectedPain ? 'bg-gray-50/50 border-y border-gray-100 py-8' : ''}`}>
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

                {/* ── Section 1: Live NFC Simulation → Email Preview ── */}
                <div
                    id="sim-section"
                    ref={liveSection.ref}
                    className={`transition-all duration-700 delay-100 ${!selectedPain || (emailPhase === 'simulation' && sim.activeZone < 0) ? 'hidden' : liveSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    {emailPhase === 'email' ? (
                        /* ── Email Preview (replaces live view) ── */
                        <div className="animate-fadeIn" key={emailScenario}>
                            <EmailPreviewCard scenario={emailScenario} painPoint={selectedPain} />
                        </div>
                    ) : emailPhase === 'sms' ? (
                        /* ── SMS Alert Simulation ── */
                        <div className="animate-fadeIn">
                            <SmsSimulationCard onComplete={() => {
                                setEmailPhase('transitioning');
                                setTimeout(() => setEmailPhase('email'), 400);
                            }} />
                        </div>
                    ) : emailPhase === 'crew-swap' ? (
                        /* ── Vendor Network CRM ── */
                        <div className="animate-fadeIn">
                            <VendorNetworkCard />
                        </div>
                    ) : (
                        /* ── Live View ── */
                        <div className={`transition-opacity duration-400 ${emailPhase === 'transitioning' ? 'opacity-0' : 'opacity-100'}`}>
                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        {sim.auditPhase === 'inspecting' || sim.auditPhase === 'arriving' ? 'Live View — Audit in Progress' :
                                         allDone ? 'Live View — Shift Verified' :
                                         'Live View — Shift in Progress'}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            cleaningDone && sim.blockedZone !== null ? 'bg-red-500' :
                                            allDone ? 'bg-green-500' :
                                            sim.auditPhase === 'inspecting' || sim.auditPhase === 'arriving' ? 'bg-amber-500 animate-pulse' :
                                            sim.activeZone >= 0 ? 'bg-blue-500 animate-pulse' :
                                            'bg-gray-300'
                                        }`} />
                                        <span className="text-xs text-gray-400">
                                            {cleaningDone && sim.blockedZone !== null ? 'Issue Detected' :
                                             allDone ? 'Cleaned & Approved' :
                                             sim.auditPhase === 'inspecting' ? 'Audit Manager Inspecting' :
                                             sim.auditPhase === 'arriving' ? 'Audit Manager On-Site' :
                                             cleaningDone ? 'Cleaning Complete' :
                                             sim.activeZone >= 0 ? 'Cleaning In Progress' : 'Waiting'}
                                        </span>
                                    </div>
                                </div>

                                {/* Crew info — switches to audit manager when cleaning is done */}
                                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                    {sim.auditPhase !== 'idle' ? (
                                        <div className="flex items-center gap-2 animate-fadeIn">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">DM</div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">David M. — Audit Manager</p>
                                                <p className="text-xs text-gray-400">
                                                    {sim.auditPhase === 'arriving' ? 'Arriving on-site…' :
                                                     sim.auditPhase === 'complete' ? 'Inspection complete ✓' :
                                                     `Inspecting zone ${Math.min(sim.auditZone + 1, LIVE_ZONES.length)}/${LIVE_ZONES.length}`}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">MR</div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Miguel R. — Clocked in</p>
                                                <p className="text-xs text-gray-400">Tonight, 9:14 PM · Est. 2h 30m</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                                            {sim.auditPhase !== 'idle' ? 'Approved' : cleaningDone ? 'Cleaned' : 'Zones'}
                                        </p>
                                        <p className="text-sm font-bold text-gray-900 font-mono">
                                            {sim.auditPhase !== 'idle'
                                                ? `${sim.approvedZones.length}/${LIVE_ZONES.length}`
                                                : `${displayCount}/${LIVE_ZONES.length}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="px-4 py-3">
                                    {/* Amber: crew-late warning banner */}
                                    {sim.lateWarning && (
                                        <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                                            <span className="text-sm">⚠️</span>
                                            <div>
                                                <p className="text-xs font-semibold text-amber-800">Crew running late — ETA 40 min</p>
                                                <p className="text-[11px] text-amber-600">Backup dispatcher notified. Standby…</p>
                                            </div>
                                        </div>
                                    )}
                                    {sim.lateResolved && (
                                        <div className="mb-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                                            <span className="text-sm">✅</span>
                                            <div>
                                                <p className="text-xs font-semibold text-green-800">Crew arrived — Miguel R. clocked in</p>
                                                <p className="text-[11px] text-green-600">XIRI resolved the delay. Scanning now…</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Progress bar */}
                                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                                                cleaningDone && sim.blockedZone !== null ? 'bg-red-500' :
                                                allDone ? 'bg-green-500' :
                                                sim.auditPhase === 'inspecting' || sim.auditPhase === 'arriving' ? 'bg-amber-500' :
                                                'bg-blue-500'
                                            }`}
                                            style={{ width: `${Math.max(Math.min((
                                                sim.auditPhase !== 'idle'
                                                    ? sim.approvedZones.length / LIVE_ZONES.length
                                                    : displayCount / LIVE_ZONES.length
                                            ) * 100, 100), 0)}%` }}
                                        />
                                    </div>

                                    {/* Zone list */}
                                    <div className="space-y-1.5">
                                        {LIVE_ZONES.map((zone, i) => {
                                            const isBlocked = sim.blockedZone === i;
                                            const isActive = i === sim.activeZone;
                                            const isDone = sim.completedZones.includes(i);
                                            const isPending = !isActive && !isDone && !isBlocked;

                                            return (
                                                <div key={i}>
                                                    {/* Zone header row */}
                                                    <div
                                                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-500 ${
                                                            isBlocked ? 'bg-red-50 border border-red-300' :
                                                            isActive ? 'bg-blue-50 border border-blue-200 rounded-b-none' :
                                                            isDone ? 'bg-green-50/60 border border-green-200/70' :
                                                            'bg-gray-50 border border-gray-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isBlocked ? (
                                                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                                                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </div>
                                                            ) : isDone ? (
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
                                                            <span className={`text-sm font-medium ${
                                                                isBlocked ? 'text-red-800' :
                                                                isDone ? 'text-green-800' : isActive ? 'text-blue-800' : 'text-gray-400'
                                                            }`}>
                                                                {zone.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] text-gray-400">{zone.tasks.length} tasks</span>
                                                            {isBlocked && (
                                                                <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                                                    🔒 LOCKED
                                                                </span>
                                                            )}
                                                            {isActive && sim.auditPhase === 'idle' && (
                                                                <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded animate-pulse">
                                                                    SCANNING
                                                                </span>
                                                            )}
                                                            {isDone && (() => {
                                                                const isAuditTarget = sim.auditPhase === 'inspecting' && sim.auditZone === i;
                                                                const isApproved = sim.approvedZones.includes(i);
                                                                if (isApproved) return (
                                                                    <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                                                        ✓ APPROVED
                                                                    </span>
                                                                );
                                                                if (isAuditTarget) return (
                                                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded animate-pulse">
                                                                        🔍 INSPECTING
                                                                    </span>
                                                                );
                                                                return (
                                                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                                                        ✓ CLEANED
                                                                    </span>
                                                                );
                                                            })()}
                                                            {isPending && (
                                                                <span className="text-[10px] text-gray-300">pending</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded task list — only for active zone */}
                                                    {isActive && (
                                                        <div className="border border-t-0 border-blue-200 bg-blue-50/40 rounded-b-lg px-3 py-2 space-y-1">
                                                            {zone.tasks.map((task, tIdx) => {
                                                                const taskDone = tIdx < sim.completedTasks;
                                                                const taskActive = tIdx === sim.completedTasks;
                                                                return (
                                                                    <div
                                                                        key={tIdx}
                                                                        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-all duration-300 ${
                                                                            taskDone ? 'opacity-100' :
                                                                            taskActive ? 'opacity-100 bg-white/60' :
                                                                            'opacity-40'
                                                                        }`}
                                                                    >
                                                                        {taskDone ? (
                                                                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        ) : taskActive ? (
                                                                            <div className="w-4 h-4 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                                                                        )}
                                                                        <span className={`text-xs ${
                                                                            taskDone ? 'text-green-700 line-through' :
                                                                            taskActive ? 'text-blue-700 font-medium' :
                                                                            'text-gray-400'
                                                                        }`}>
                                                                            {task}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Completion message — scenario-aware */}
                                    {cleaningDone && sim.blockedZone !== null && (
                                        <div className="mt-4 text-center py-3 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-sm font-bold text-red-700">🔴 Issue Detected — {LIVE_ZONES[sim.blockedZone]?.name} locked</p>
                                            <p className="text-xs text-red-600 mt-0.5">Generating action-required report…</p>
                                        </div>
                                    )}

                                    {/* Audit manager arriving banner */}
                                    {sim.auditPhase === 'arriving' && (
                                        <div className="mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                                            <span className="text-sm">📋</span>
                                            <div>
                                                <p className="text-xs font-semibold text-amber-800">Audit Manager arriving on-site</p>
                                                <p className="text-[11px] text-amber-600">David M. will inspect and approve each zone…</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cleaning done, audit in progress */}
                                    {cleaningDone && sim.blockedZone === null && sim.auditPhase === 'inspecting' && (
                                        <div className="mt-4 text-center py-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-sm font-bold text-amber-700">📋 Cleaning complete — Audit in progress</p>
                                            <p className="text-xs text-amber-600 mt-0.5">Audit manager verifying each zone…</p>
                                        </div>
                                    )}

                                    {/* Fully complete — audit approved */}
                                    {allDone && sim.blockedZone === null && (
                                        <div className="mt-4 text-center py-3 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="text-sm font-bold text-green-700">✅ Shift Complete — All zones cleaned & approved</p>
                                            <p className="text-xs text-green-600 mt-0.5">{selectedPain === 'inconsistent' ? 'Proof the work was done tonight.' : 'Generating your morning report…'}</p>
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
                    )}
                </div>
            </div>
            </div>

            {/* ── Services Section — only show after pain point selected ── */}
            {selectedPain && (
            <div className="bg-white border-y border-gray-200 py-8 animate-fadeIn">
            <div className="max-w-3xl mx-auto px-4 space-y-8">
                {/* ── Services ── */}
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
                                <span className="font-bold">One invoice.</span> Cleaning + maintenance + supplies + compliance verification. Stop juggling 20 vendors.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            )}

            {/* ── CTA Section — only show after pain point selected ── */}
            {selectedPain && (
            <div className="bg-gradient-to-b from-gray-50 to-white py-8 animate-fadeIn">
            <div className="max-w-3xl mx-auto px-4 space-y-4">
                <div
                    ref={(el) => {
                        // Combine both refs on this element
                        (ctaSection.ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
                        (ctaVisibility.ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
                    }}
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
                                href="sms:+15163990350?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more%20about%20verified%20cleaning%20for%20my%20building."
                                className="block w-full py-4 rounded-lg bg-white text-indigo-900 font-bold text-base shadow-lg hover:bg-indigo-50 transition-all mb-2.5"
                            >
                                💬 Text Chris
                            </a>

                            <a
                                href="tel:+15163990350"
                                className="block w-full py-3.5 rounded-lg border border-indigo-300/40 text-indigo-100 font-medium text-sm hover:bg-indigo-800/30 transition-all mb-2.5"
                            >
                                📞 Call: (516) 399-0350
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
            </div>
            )}

            {/* ── Sticky Bottom CTA Bar — hidden until pain point selected and when bottom CTA is visible ── */}
            {selectedPain && (
            <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-2.5 safe-area-inset-bottom transition-all duration-300 ${
                ctaVisibility.isVisible ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
            }`}>
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                    <a
                        href="sms:+15163990350?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more."
                        className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm text-center shadow-sm hover:bg-indigo-700 transition-all"
                    >
                        💬 Text Chris
                    </a>
                    <a
                        href="tel:+15163990350"
                        className="py-2.5 px-4 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
                    >
                        📞 Call
                    </a>
                </div>
            </div>
            )}

            {/* ── CSS animation ── */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .animate-shrink {
                    animation: shrink 3s linear forwards;
                }
            `}</style>
        </div>
    );
}

/* ─── Email Scenario Configs ──────────────────────────────────── */

const EMAIL_SCENARIOS: Record<EmailScenario, {
    subject: string;
    badge: { label: string; icon: string; bg: string; text: string };
    completion: string;
    completionColor: string;
    zonesLabel: string;
    issueBlock: React.ReactNode;
    bottomNote: string;
}> = {
    green: {
        subject: '[No Action Needed] Medical Office — Cleaned 3/3 Zones',
        badge: { label: 'All Good', icon: '✅', bg: 'bg-green-100', text: 'text-green-800' },
        completion: '100%',
        completionColor: 'text-green-600',
        zonesLabel: '3/3',
        issueBlock: (
            <div className="mt-4 px-3 py-2.5 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                <p className="text-xs text-green-800">
                    <span className="font-semibold">No issues tonight.</span> All zones scanned and verified on time. No action required from you.
                </p>
            </div>
        ),
        bottomNote: 'This is a "Green" report — everything went perfectly. No action needed from you.',
    },
    amber: {
        subject: '[Resolved] Medical Office — Issue Handled, All Zones Completed',
        badge: { label: 'Issue Resolved', icon: '⚠️', bg: 'bg-amber-100', text: 'text-amber-800' },
        completion: '100%',
        completionColor: 'text-amber-600',
        zonesLabel: '3/3',
        issueBlock: (
            <div className="mt-4 space-y-2">
                <div className="px-3 py-2.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                    <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Issues Resolved By XIRI</p>
                    <div className="bg-white rounded px-2.5 py-2 mt-1.5">
                        <p className="text-xs text-gray-700">
                            ✅ <span className="font-semibold">Crew arrived 40 minutes late</span>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Backup dispatcher notified at 8:02 PM. Miguel arrived by 8:54 PM and completed all zones.</p>
                    </div>
                </div>
                <div className="px-3 py-2 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                    <p className="text-xs text-green-800">
                        <span className="font-semibold">Result:</span> All zones completed. No action needed from you — we handled it.
                    </p>
                </div>
            </div>
        ),
        bottomNote: 'This is an "Amber" report — something went wrong, but XIRI resolved it before reaching you.',
    },
    red: {
        subject: '[Action Needed] Medical Office — Your Input Required',
        badge: { label: 'Action Needed', icon: '🔴', bg: 'bg-red-100', text: 'text-red-800' },
        completion: '67%',
        completionColor: 'text-red-600',
        zonesLabel: '2/3',
        issueBlock: (
            <div className="mt-4 space-y-2">
                <div className="px-3 py-2.5 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                    <p className="text-xs font-semibold text-red-800 mb-1">🔴 Action Required</p>
                    <div className="bg-white rounded px-2.5 py-2 mt-1.5">
                        <p className="text-xs text-gray-700">
                            🔴 <span className="font-semibold">Suite 201 was locked — could not access</span>
                        </p>
                        <p className="text-[11px] text-red-700 font-medium mt-1">
                            We need your help: Please provide a key or access code for Suite 201 so we can complete this zone.
                        </p>
                    </div>
                </div>
                <a
                    href="sms:+15163990350?body=Hi%20Chris%2C%20regarding%20the%20locked%20Suite%20201%20—"
                    className="block text-center py-2.5 rounded-lg bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition-all"
                >
                    Respond to XIRI
                </a>
            </div>
        ),
        bottomNote: 'This is a "Red" report — we need your help to clear a blocker. Reply and we handle the rest.',
    },
};

/* ─── SMS Simulation Component (No-shows / Late Arrivals) ──────── */

function SmsSimulationCard({ onComplete }: { onComplete: () => void }) {
    const [visibleMessages, setVisibleMessages] = useState(0);

    const messages = [
        { from: 'system', text: '⚠️ Alert: No clock-in detected at 200 Main St. Scheduled start was 6:00 PM.', time: '6:12 PM', icon: '🔔' },
        { from: 'xiri', text: 'We see it. Contacting the assigned crew now.', time: '6:13 PM', icon: '👤' },
        { from: 'system', text: '📍 Crew unreachable. Dispatching backup — Miguel R. is 22 min away.', time: '6:18 PM', icon: '🔔' },
        { from: 'xiri', text: 'Backup confirmed ✅ Miguel R. en route. ETA 6:40 PM.', time: '6:19 PM', icon: '👤' },
        { from: 'system', text: '✅ Miguel R. clocked in via NFC at 200 Main St.', time: '6:38 PM', icon: '🔔' },
        { from: 'xiri', text: 'Shift covered. You\'ll get the morning report as usual — no action needed from you.', time: '6:39 PM', icon: '👤' },
    ];

    useEffect(() => {
        if (visibleMessages < messages.length) {
            const timer = setTimeout(() => setVisibleMessages(v => v + 1), 1400);
            return () => clearTimeout(timer);
        } else {
            const done = setTimeout(onComplete, 2500);
            return () => clearTimeout(done);
        }
    }, [visibleMessages, messages.length, onComplete]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">📲 XIRI Alert System</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Real-time no-show detection & backup dispatch</p>
                </div>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">LIVE</span>
            </div>
            <div className="p-4 space-y-3 min-h-[260px]">
                {messages.slice(0, visibleMessages).map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-2.5 animate-fadeIn ${msg.from === 'xiri' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.from !== 'xiri' && (
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{msg.icon}</div>
                        )}
                        <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                            msg.from === 'xiri'
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                            <p>{msg.text}</p>
                            <p className={`text-[9px] mt-1 ${msg.from === 'xiri' ? 'text-indigo-200' : 'text-gray-400'}`}>{msg.time}</p>
                        </div>
                        {msg.from === 'xiri' && (
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">👤</div>
                        )}
                    </div>
                ))}
                {visibleMessages < messages.length && (
                    <div className="flex items-center gap-2 text-gray-400 pl-9">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>
            {visibleMessages >= messages.length && (
                <div className="px-4 py-3 border-t border-gray-100 bg-green-50">
                    <p className="text-xs text-green-700 font-medium text-center">✅ Crisis averted — generating your morning report…</p>
                </div>
            )}
        </div>
    );
}

/* ─── Crew Swap Component (Turnover & Reliability) ─────────────── */

function VendorNetworkCard() {
    const [visibleRows, setVisibleRows] = useState(0);
    const [contactedIdx, setContactedIdx] = useState<number | null>(null);
    const [confirmedIdx, setConfirmedIdx] = useState<number | null>(null);

    const vendors = [
        { name: 'Elite Clean Services LLC', location: 'Queens, NY', rating: 4.9, crews: 12, years: 14, coverage: ['GL', 'WC', 'BG'], status: 'available' },
        { name: 'Pinnacle Facility Group LLC', location: 'Brooklyn, NY', rating: 4.7, crews: 8, years: 9, coverage: ['GL', 'WC', 'BG'], status: 'available' },
        { name: 'Metro Shine Cleaning LLC', location: 'Bronx, NY', rating: 4.8, crews: 6, years: 11, coverage: ['GL', 'WC', 'BG'], status: 'available' },
        { name: 'FirstRate Janitorial LLC', location: 'Manhattan, NY', rating: 4.6, crews: 15, years: 7, coverage: ['GL', 'WC'], status: 'available' },
        { name: 'ClearPath Cleaning Co. LLC', location: 'Long Island, NY', rating: 4.5, crews: 4, years: 3, coverage: ['GL'], status: 'busy' },
    ];

    const PICK = 2; // Contact + confirm the 3rd vendor (Metro Shine)

    useEffect(() => {
        if (visibleRows < vendors.length) {
            const timer = setTimeout(() => setVisibleRows(v => v + 1), 600);
            return () => clearTimeout(timer);
        } else {
            const contactTimer = setTimeout(() => setContactedIdx(PICK), 1200);
            return () => clearTimeout(contactTimer);
        }
    }, [visibleRows, vendors.length]);

    useEffect(() => {
        if (contactedIdx !== null) {
            const confirmTimer = setTimeout(() => setConfirmedIdx(PICK), 2000);
            return () => clearTimeout(confirmTimer);
        }
    }, [contactedIdx]);

    const coverageLabel: Record<string, string> = {
        GL: 'General Liability',
        WC: "Worker's Comp",
        BG: 'Background Checked',
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">🏢 XIRI Vendor Network</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Vetted cleaning companies ready to deploy in your area</p>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">38 AVAILABLE</span>
                </div>
            </div>

            {/* Vendor rows */}
            <div className="divide-y divide-gray-100">
                {vendors.map((v, i) => {
                    const visible = i < visibleRows;
                    const isContacted = contactedIdx === i;
                    const isConfirmed = confirmedIdx === i;
                    return (
                        <div
                            key={i}
                            className={`px-4 py-3 transition-all duration-500 ${
                                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 h-0 overflow-hidden py-0'
                            } ${
                                isConfirmed ? 'bg-green-50' : isContacted ? 'bg-blue-50' : ''
                            }`}
                        >
                            {/* Top row: name, meta, status */}
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 leading-tight">{v.name}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{v.location} · {v.years} yrs in business · Crew Size: {v.crews}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                    <span className="text-[11px] font-semibold text-gray-700">⭐ {v.rating}</span>
                                    {isConfirmed ? (
                                        <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">✓ CONFIRMED</span>
                                    ) : isContacted ? (
                                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse">CONTACTING…</span>
                                    ) : v.status === 'busy' ? (
                                        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">BUSY</span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">AVAILABLE</span>
                                    )}
                                </div>
                            </div>
                            {/* Coverage pills */}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {v.coverage.map(c => (
                                    <span key={c} className="text-[9px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                        ✓ {coverageLabel[c] || c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Showing X of Y */}
            {visibleRows >= vendors.length && confirmedIdx === null && contactedIdx === null && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40 text-center">
                    <p className="text-[10px] text-gray-400">Showing top 5 of 38 vetted companies in your area</p>
                </div>
            )}

            {confirmedIdx !== null ? (
                <div className="px-4 py-3 border-t border-gray-100 bg-green-50">
                    <p className="text-xs text-green-700 font-medium text-center">✅ {vendors[confirmedIdx].name} confirmed — new crew taking over nightly janitorial cleaning</p>
                </div>
            ) : contactedIdx !== null ? (
                <div className="px-4 py-3 border-t border-gray-100 bg-blue-50">
                    <p className="text-xs text-blue-700 font-medium text-center">📞 Reaching out to {vendors[contactedIdx].name}…</p>
                </div>
            ) : visibleRows >= vendors.length ? (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500 font-medium text-center">Selecting best match for your building…</p>
                </div>
            ) : null}
        </div>
    );
}

/* ─── Email Preview Component ─────────────────────────────────── */

function EmailPreviewCard({ scenario, painPoint }: { scenario: EmailScenario; painPoint: PainPoint | null }) {
    const cfg = EMAIL_SCENARIOS[scenario];
    const isRed = scenario === 'red';
    const isGreen = scenario === 'green';

    const painLabel = PAIN_POINTS.find(p => p.id === painPoint)?.label ?? '';

    const zones = LIVE_ZONES.map((z, i) => {
        const locked = isRed && z.name === 'Offices & Hallway';
        return {
            name: z.name,
            tasks: locked ? `0/${z.tasks.length}` : `${z.tasks.length}/${z.tasks.length}`,
            time: locked ? '—' : `${9}:${String(14 + i * 18).padStart(2, '0')} PM`,
            icon: locked ? '🔴' : '✅',
        };
    });

    return (
        <div>
            {/* Context label */}
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    scenario === 'green' ? 'bg-green-500' :
                    scenario === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {scenario === 'red' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v4m0 4h.01" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        )}
                    </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">Shift Complete — Here&apos;s your morning report</p>
            </div>

            {/* Email chrome */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                {/* Email header bar */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>📧</span>
                        <span className="font-medium text-gray-600">From:</span>
                        <span>XIRI Facility Solutions</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                        {cfg.subject}
                    </p>
                </div>

                {/* Email body */}
                <div className="p-4">
                    {/* Tier badge + header */}
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${cfg.badge.bg} ${cfg.badge.text} text-xs font-semibold`}>
                            {cfg.badge.icon} {cfg.badge.label}
                        </span>
                        <span className="text-xs text-gray-400">March 12, 2026</span>
                    </div>

                    {isGreen ? (
                        /* ── GREEN: Simple, quick-acknowledge layout ── */
                        <>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                <p className="text-3xl font-bold text-green-600 mb-1">100%</p>
                                <p className="text-xs text-green-700 font-medium">All 3 zones cleaned & approved</p>
                                <p className="text-[11px] text-gray-500 mt-2">Cleaner: Miguel R. · All zones cleaned · 9:14 – 11:38 PM</p>
                                <p className="text-[11px] text-gray-500">Audit Manager: David M. · All zones approved ✓</p>
                            </div>
                            {cfg.issueBlock}
                        </>
                    ) : (
                        /* ── AMBER / RED: Full detail layout ── */
                        <>
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className={`text-xl font-bold ${cfg.completionColor}`}>{cfg.completion}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Completion</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold text-gray-900">{cfg.zonesLabel}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Zones</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-sm font-semibold text-gray-900">Miguel R.</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">9:14 – 11:38 PM</p>
                                </div>
                            </div>

                            {/* Zones table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="grid grid-cols-3 bg-gray-50 px-3 py-2">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Zone</span>
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Tasks</span>
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Time</span>
                                </div>
                                {zones.map((z, i) => (
                                    <div key={i} className="grid grid-cols-3 px-3 py-2 border-t border-gray-100">
                                        <span className="text-xs text-gray-700">{z.icon} {z.name}</span>
                                        <span className="text-xs text-gray-600 text-center">{z.tasks}</span>
                                        <span className="text-xs text-gray-400 text-right">{z.time}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Scenario-specific issue block */}
                            {cfg.issueBlock}
                        </>
                    )}
                </div>

                {/* Pain-point-aware CTA */}
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60 text-center">
                    {painLabel && (
                        <p className="text-xs text-gray-500 mb-2">
                            You said: <span className="font-medium text-gray-700">&ldquo;{painLabel}&rdquo;</span>
                        </p>
                    )}
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                        {scenario === 'green' ? 'This report proves the work — every night.' :
                         scenario === 'amber' ? 'Issues get caught and resolved before you wake up.' :
                         'You see the problem instantly — before anyone complains.'}
                    </p>
                    <a
                        href="sms:+15163990350?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20demo.%20I%27m%20interested%20in%20learning%20more."
                        className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        💬 Text Chris to learn more →
                    </a>
                </div>
            </div>

            <p className="text-[11px] text-gray-400 text-center mt-3">
                This is what lands in your inbox at 7 AM — every morning, automatically.
            </p>
        </div>
    );
}
