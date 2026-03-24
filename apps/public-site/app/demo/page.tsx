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

interface DemoTask { name: string; completed: boolean; hasPhoto: boolean; auditStatus?: 'good' | 'acceptable' | 'unacceptable' | null; auditNote?: string | null }
interface DemoZone { zoneName: string; scannedAt: string | null; tasks: DemoTask[] }
interface DemoSession {
    id: string;
    personName: string;
    personPhone: string;
    initials: string;
    role: 'cleaner';
    clockInAt: string;
    clockOutAt: string | null;
    zonesCompleted: number;
    zonesTotal: number;
    zones: DemoZone[];
    status: 'verified' | 'flagged' | 'incomplete' | 'in_progress';
    mgrName?: string;
    mgrClockOut?: string;
    auditScore?: number;
}

const DEMO_ZONES: DemoZone[] = [
    { zoneName: 'Main Lobby', scannedAt: '2026-03-16T21:14:00', tasks: [{ name: 'Vacuum carpet', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Wipe reception desk', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Empty trash', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Clean glass doors', completed: true, hasPhoto: true, auditStatus: 'good' }] },
    { zoneName: 'Restroom A', scannedAt: '2026-03-16T21:32:00', tasks: [{ name: 'Sanitize fixtures', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Mop floors', completed: true, hasPhoto: true, auditStatus: 'acceptable', auditNote: 'Slight residue near drain' }, { name: 'Restock supplies', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Empty trash', completed: true, hasPhoto: false, auditStatus: 'good' }] },
    { zoneName: 'Exam Room 1', scannedAt: '2026-03-16T21:51:00', tasks: [{ name: 'Disinfect surfaces', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Sanitize exam table', completed: true, hasPhoto: true, auditStatus: 'good' }, { name: 'Mop floor', completed: true, hasPhoto: false, auditStatus: 'good' }] },
    { zoneName: 'Exam Room 2', scannedAt: '2026-03-16T22:12:00', tasks: [{ name: 'Disinfect surfaces', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Sanitize exam table', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Mop floor', completed: true, hasPhoto: false, auditStatus: 'good' }] },
    { zoneName: 'Break Room', scannedAt: '2026-03-16T22:34:00', tasks: [{ name: 'Wipe counters', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Clean microwave', completed: true, hasPhoto: false, auditStatus: 'acceptable', auditNote: 'Inside needs second wipe' }, { name: 'Empty trash', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Mop floor', completed: true, hasPhoto: false, auditStatus: 'good' }] },
    { zoneName: 'Hallway & Offices', scannedAt: '2026-03-16T23:01:00', tasks: [{ name: 'Vacuum carpet', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Dust surfaces', completed: true, hasPhoto: false, auditStatus: 'good' }, { name: 'Empty trash', completed: true, hasPhoto: false, auditStatus: 'good' }] },
];

const DEMO_ZONES_INCOMPLETE = DEMO_ZONES.map((z, i) =>
    i === 5 ? { ...z, scannedAt: null, tasks: z.tasks.map((t, ti) => ti < 2 ? { ...t, completed: false, auditStatus: null as 'good' | 'acceptable' | 'unacceptable' | null } : t) } : { ...z, scannedAt: z.scannedAt?.replace('16', '12') || null }
);

const DEMO_SESSIONS: DemoSession[] = [
    {
        id: 'session-1', personName: 'Miguel R.', personPhone: '(516) 555-0142', initials: 'MR', role: 'cleaner',
        clockInAt: '2026-03-16T21:14:00', clockOutAt: '2026-03-16T23:42:00',
        zonesCompleted: 6, zonesTotal: 6, zones: DEMO_ZONES, status: 'verified',
        mgrName: 'David K.', mgrClockOut: '2026-03-17T00:15:00', auditScore: 4.7,
    },
    {
        id: 'session-2', personName: 'Miguel R.', personPhone: '(516) 555-0142', initials: 'MR', role: 'cleaner',
        clockInAt: '2026-03-13T21:08:00', clockOutAt: '2026-03-13T23:21:00',
        zonesCompleted: 6, zonesTotal: 6,
        zones: DEMO_ZONES.map(z => ({ ...z, scannedAt: z.scannedAt?.replace('16', '13') || null })),
        status: 'flagged', mgrName: 'David K.', mgrClockOut: '2026-03-13T23:58:00', auditScore: 3.8,
    },
    {
        id: 'session-3', personName: 'Jose T.', personPhone: '(516) 555-0198', initials: 'JT', role: 'cleaner',
        clockInAt: '2026-03-12T21:22:00', clockOutAt: '2026-03-12T23:35:00',
        zonesCompleted: 5, zonesTotal: 6, zones: DEMO_ZONES_INCOMPLETE, status: 'incomplete',
    },
];

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

/* ─── Status Config (light theme) ────────────────────────────── */
const STATUS_CONFIG = {
    verified:    { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Verified', icon: '✓' },
    flagged:     { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Flagged', icon: '⚠' },
    incomplete:  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Incomplete', icon: '!' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'In Progress', icon: '●' },
    waiting:     { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Waiting', icon: '◷' },
} as const;

/* ─── Helpers ──────────────────────────────────────────────── */
const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—';
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 1) return '< 1m';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/* ─── ZoneProgress (light theme) ─────────────────────────────── */
function ZoneProgress({ completed, total }: { completed: number; total: number }) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden min-w-[60px]">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs font-mono text-gray-400 shrink-0">{completed}/{total}</span>
        </div>
    );
}

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
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [expandedAuditZones, setExpandedAuditZones] = useState<Set<string>>(new Set());

    // Live NFC simulation
    const [liveActive, setLiveActive] = useState(false);
    const [liveZoneIdx, setLiveZoneIdx] = useState(-1);
    const [liveStarted, setLiveStarted] = useState(false);

    // Section visibility
    const heroSection = useInView();
    const tonightSection = useInView();
    const liveSection = useInView();
    const servicesSection = useInView();
    const ctaSection = useInView();

    useEffect(() => {
        if (liveSection.inView && !liveStarted) startLiveSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveSection.inView, liveStarted]);

    useEffect(() => {
        const fallback = setTimeout(() => { if (!liveStarted) startLiveSimulation(); }, 3000);
        return () => clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function startLiveSimulation() {
        if (liveStarted) return;
        setLiveStarted(true);
        setLiveActive(true);
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

    // Split sessions into manager-reviewed and cleaning
    const managerReviewed = DEMO_SESSIONS.filter(s => s.mgrName);
    const cleaningOnly = DEMO_SESSIONS.filter(s => !s.mgrName);

    return (
        <div className="min-h-screen bg-white text-gray-900">
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

                {/* Hook text */}
                <div className="bg-gray-50/80 border-b border-gray-100">
                    <div className="max-w-3xl mx-auto px-4 py-4">
                        <h2 className="text-base font-semibold text-gray-900">
                            Was your building <em className="not-italic text-indigo-600">actually</em> cleaned last night?
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            Most building owners have no idea. Below is what verified facility management looks like.
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* ── Table 1: Manager Reviewed ── */}
                <div
                    ref={tonightSection.ref}
                    className={`transition-all duration-700 delay-100 ${tonightSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    {managerReviewed.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm mb-6">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    👤 Manager Reviewed
                                    <span className="text-xs font-normal text-gray-400">({managerReviewed.length} shifts)</span>
                                </h3>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {managerReviewed.map((session) => {
                                    const style = STATUS_CONFIG[session.status];
                                    const isExpanded = expandedRow === session.id;

                                    return (
                                        <div key={session.id}>
                                            <button
                                                onClick={() => setExpandedRow(isExpanded ? null : session.id)}
                                                className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''}`}
                                            >
                                                {/* Row 1: Status + Building + Score */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                                                            <span className="text-[10px]">{style.icon}</span> {style.label}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-900">{DEMO_FACILITY.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {session.auditScore != null && (
                                                            <span className={`text-sm font-semibold ${session.auditScore >= 4 ? 'text-green-600' : session.auditScore >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                {session.auditScore.toFixed(1)}
                                                            </span>
                                                        )}
                                                        <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Row 2: Details */}
                                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                                    <span>{fmtDate(session.clockInAt)}</span>
                                                    <span className="font-mono">{fmtTime(session.clockInAt)} → {fmtTime(session.clockOutAt)}</span>
                                                    <span>{getDuration(session.clockInAt, session.clockOutAt)}</span>
                                                </div>

                                                {/* Row 3: Zone progress */}
                                                <div className="mt-2">
                                                    <ZoneProgress completed={session.zonesCompleted} total={session.zonesTotal} />
                                                </div>
                                            </button>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-4">
                                                    {/* Crew info */}
                                                    <div className="flex items-center gap-3 mb-3 text-xs">
                                                        <span className="flex items-center gap-1 text-gray-900 font-medium">
                                                            <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">{session.initials}</span>
                                                            {session.personName}
                                                        </span>
                                                        <span className="text-gray-400">{session.personPhone}</span>
                                                    </div>

                                                    {/* Night Manager bar */}
                                                    {session.mgrName && (
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 rounded-lg border border-gray-200 bg-white px-3 py-2 mb-4">
                                                            <span className="flex items-center gap-1 text-gray-900 font-medium">👤 {session.mgrName}</span>
                                                            <span>Inspected {fmtTime(session.clockOutAt)} → {fmtTime(session.mgrClockOut || null)}</span>
                                                            <span className={`font-semibold ${session.auditScore && session.auditScore >= 4 ? 'text-green-600' : session.auditScore && session.auditScore >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                Score {session.auditScore?.toFixed(1)}/5
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Zone breakdown */}
                                                    <h4 className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider mb-2">Zone Progress</h4>
                                                    {session.mgrName && (
                                                        <div className="grid gap-1 mb-1 text-[10px] text-gray-400" style={{ gridTemplateColumns: 'minmax(100px, 1.2fr) 70px 1fr' }}>
                                                            <span>Zone</span>
                                                            <span className="text-right">🧹 Cleaned</span>
                                                            <span className="text-right">👤 Manager Audit</span>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1">
                                                        {session.zones.map((zone, zi) => {
                                                            const zoneKey = `${session.id}-${zi}`;
                                                            const isAuditExpanded = expandedAuditZones.has(zoneKey);
                                                            const worstStatus = zone.tasks.reduce((worst, t) => {
                                                                if (t.auditStatus === 'unacceptable') return 'unacceptable';
                                                                if (t.auditStatus === 'acceptable' && worst !== 'unacceptable') return 'acceptable';
                                                                return worst;
                                                            }, 'good' as string);
                                                            const hasIssues = worstStatus === 'acceptable' || worstStatus === 'unacceptable';

                                                            return (
                                                                <div key={zi} className="grid items-start text-sm py-1.5 px-2 rounded hover:bg-gray-100/50"
                                                                    style={{ gridTemplateColumns: session.mgrName ? 'minmax(100px, 1.2fr) 70px 1fr' : 'minmax(100px, 1fr) 70px' }}>
                                                                    {/* Zone name */}
                                                                    <div className="flex items-center gap-2">
                                                                        {zone.scannedAt ? (
                                                                            <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        )}
                                                                        <span className={zone.scannedAt ? 'font-medium text-gray-900' : 'text-gray-400'}>{zone.zoneName}</span>
                                                                    </div>
                                                                    {/* Cleaned timestamp */}
                                                                    <span className="text-xs font-mono text-gray-400 text-right">{fmtTime(zone.scannedAt)}</span>
                                                                    {/* Manager audit */}
                                                                    {session.mgrName && (
                                                                        <div>
                                                                            <div className="flex items-center justify-end gap-1.5">
                                                                                {hasIssues ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                                                                        onClick={(e) => { e.stopPropagation(); setExpandedAuditZones(prev => { const next = new Set(prev); next.has(zoneKey) ? next.delete(zoneKey) : next.add(zoneKey); return next; }); }}
                                                                                    >
                                                                                        <svg className={`w-3 h-3 text-gray-300 transition-transform ${isAuditExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                                        </svg>
                                                                                        {worstStatus === 'acceptable' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">🟡 OK</span>}
                                                                                        {worstStatus === 'unacceptable' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">🔴 Bad</span>}
                                                                                    </button>
                                                                                ) : (
                                                                                    <>
                                                                                        {zone.scannedAt && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">🟢 Good</span>}
                                                                                        {!zone.scannedAt && <span className="text-xs text-gray-300">pending</span>}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            {/* Per-task breakdown */}
                                                                            {isAuditExpanded && hasIssues && (
                                                                                <div className="mt-1.5 space-y-0.5 pl-1 border-l-2 border-amber-300 ml-1">
                                                                                    {zone.tasks.map((task, ti) => (
                                                                                        <div key={ti} className="flex items-start gap-1.5 text-[11px]">
                                                                                            <span>{task.auditStatus === 'good' ? '🟢' : task.auditStatus === 'acceptable' ? '🟡' : task.auditStatus === 'unacceptable' ? '🔴' : '⚪'}</span>
                                                                                            <span className="text-gray-500">{task.name}</span>
                                                                                            {task.auditNote && <span className="text-gray-700 italic">— {task.auditNote}</span>}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ──── Table 2: Cleaning Progress ──── */}
                    {cleaningOnly.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    🧹 Cleaning Progress
                                    <span className="text-xs font-normal text-gray-400">({cleaningOnly.length} shifts)</span>
                                </h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {cleaningOnly.map((session) => {
                                    const style = STATUS_CONFIG[session.status];
                                    const isExpanded = expandedRow === session.id;

                                    return (
                                        <div key={session.id}>
                                            <button
                                                onClick={() => setExpandedRow(isExpanded ? null : session.id)}
                                                className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                                                            <span className="text-[10px]">{style.icon}</span> {style.label}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-900">{DEMO_FACILITY.name}</span>
                                                    </div>
                                                    <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                                    <span>{fmtDate(session.clockInAt)}</span>
                                                    <span className="font-mono">{fmtTime(session.clockInAt)} → {fmtTime(session.clockOutAt)}</span>
                                                    <span>{getDuration(session.clockInAt, session.clockOutAt)}</span>
                                                </div>
                                                <div className="mt-2">
                                                    <ZoneProgress completed={session.zonesCompleted} total={session.zonesTotal} />
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-4">
                                                    <div className="flex items-center gap-3 mb-3 text-xs">
                                                        <span className="flex items-center gap-1 text-gray-900 font-medium">
                                                            <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">{session.initials}</span>
                                                            {session.personName}
                                                        </span>
                                                        <span className="text-gray-400">{session.personPhone}</span>
                                                    </div>
                                                    <h4 className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider mb-2">Zone Progress</h4>
                                                    <div className="space-y-1">
                                                        {session.zones.map((zone, zi) => (
                                                            <div key={zi} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-gray-100/50">
                                                                <div className="flex items-center gap-2">
                                                                    {zone.scannedAt ? (
                                                                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    )}
                                                                    <span className={zone.scannedAt ? 'font-medium text-gray-900' : 'text-gray-400'}>{zone.zoneName}</span>
                                                                </div>
                                                                <span className="text-xs font-mono text-gray-400">{fmtTime(zone.scannedAt)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <p className="text-[11px] text-gray-400 text-center mt-3">
                        All times automatically recorded via NFC check-in
                    </p>
                </div>

                {/* ── Live NFC Simulation ── */}
                <div
                    ref={liveSection.ref}
                    className={`transition-all duration-700 delay-100 ${liveSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">Live View — Shift in Progress</h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${liveActive && liveZoneIdx < LIVE_ZONES.length ? 'bg-blue-500 animate-pulse' : liveZoneIdx >= LIVE_ZONES.length - 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-xs text-gray-400">
                                    {liveZoneIdx >= LIVE_ZONES.length - 1 ? 'Verified' : liveActive ? 'In Progress' : 'Waiting'}
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
                                    {Math.min(liveZoneIdx + 1, LIVE_ZONES.length)}/{LIVE_ZONES.length}
                                </p>
                            </div>
                        </div>

                        <div className="px-4 py-3">
                            {/* Progress bar */}
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${liveZoneIdx >= LIVE_ZONES.length - 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(((liveZoneIdx + 1) / LIVE_ZONES.length) * 100, 100)}%` }}
                                />
                            </div>

                            {/* Zone list */}
                            <div className="space-y-1.5">
                                {LIVE_ZONES.map((zone, i) => {
                                    const isActive = i === liveZoneIdx && liveZoneIdx < LIVE_ZONES.length;
                                    const isDone = i < liveZoneIdx || liveZoneIdx >= LIVE_ZONES.length - 1;
                                    const isPending = i > liveZoneIdx;

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
                                <span className="font-bold">One invoice.</span> Cleaning + maintenance + supplies + compliance verification. Stop juggling 4 vendors.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── CTA Section ── */}
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
                                href="sms:+15165269585?body=Hi%20Chris%2C%20I%20saw%20the%20XIRI%20card.%20I%27m%20interested%20in%20learning%20more%20about%20verified%20cleaning%20for%20my%20building."
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
                                href="mailto:chris@xiri.ai?subject=Interested%20in%20XIRI%20Facility%20Management&body=Hi%20Chris%2C%0A%0AI%20tapped%20your%20NFC%20card%20and%20I%27m%20interested%20in%20learning%20more%20about%20verified%20cleaning%20for%20my%20building.%0A%0ABuilding%20name%3A%20%0AAddress%3A%20%0A%0AThanks!"
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
    );
}
