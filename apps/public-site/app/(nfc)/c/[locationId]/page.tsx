'use client';

import { useState, useEffect, use } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

interface TaskDetail {
    name: string;
    completed: boolean;
    hasPhoto: boolean;
}

interface ZoneDetail {
    zoneName: string;
    scannedAt: string | null;
    tasks: TaskDetail[];
}

interface SessionEntry {
    initials: string;
    role: 'cleaner' | 'night_manager';
    clockInAt: string | null;
    clockOutAt: string | null;
    zonesCompleted: number;
    zonesTotal: number;
    zones: ZoneDetail[];
}

interface ComplianceData {
    locationName: string;
    vendorName: string;
    totalZones: number;
    sessions: SessionEntry[];
    summary: {
        totalSessions: number;
        totalAudits: number;
        completionRate: number;
    };
}

export default function ComplianceLogPage({ params }: { params: Promise<{ locationId: string }> }) {
    const { locationId } = use(params);
    const [data, setData] = useState<ComplianceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function load() {
            try {
                const functions = getFunctions(app);
                const fn = httpsCallable(functions, 'getComplianceLog');
                const result = await fn({ locationId });
                setData(result.data as ComplianceData);
            } catch (err: any) {
                console.error('Failed to load compliance log:', err);
                setError(err?.message || 'Failed to load compliance log.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [locationId]);

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

    const toggleZone = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedZones(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-base text-gray-500">Loading compliance log...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6">
                <div className="max-w-md text-center space-y-3">
                    <p className="text-lg text-red-600 font-medium">Unable to load compliance log</p>
                    <p className="text-sm text-gray-500">{error || 'Please try again.'}</p>
                </div>
            </div>
        );
    }

    const { summary } = data;
    const cleanerSessions = data.sessions.filter(s => s.role === 'cleaner');
    const lastCleaned = cleanerSessions.length > 0 ? cleanerSessions[0].clockInAt : null;
    const uniqueDates = new Set(cleanerSessions.map(s => s.clockInAt ? new Date(s.clockInAt).toDateString() : ''));
    uniqueDates.delete('');

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)' }}>
                <div className="max-w-2xl mx-auto px-5 py-5">
                    <div className="flex items-center justify-between">
                        <img src="/logo-combined-white.svg" alt="XIRI Facility Solutions" className="h-8" />
                        <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Digital Compliance Log</span>
                    </div>
                </div>
            </div>
            {/* Location bar */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-heading">{data.locationName}</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Service Provider: <span className="font-medium text-gray-700">{data.vendorName}</span></p>
                    </div>
                    <p className="text-xs text-gray-400">Last 30 days</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
                {/* Status Banner */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-lg font-bold text-green-900">Site Actively Serviced</p>
                            <p className="text-sm text-green-700">
                                Last cleaned: {lastCleaned ? fmtDate(lastCleaned) + ' at ' + fmtTime(lastCleaned) : 'No records yet'}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-3xl font-bold text-green-900">{uniqueDates.size}</p>
                            <p className="text-sm text-green-700">days serviced</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-green-900">{summary.completionRate}%</p>
                            <p className="text-sm text-green-700">completion rate</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-green-900">{data.totalZones}</p>
                            <p className="text-sm text-green-700">zones per visit</p>
                        </div>
                    </div>
                </div>

                {/* Service Log Table */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-900">Service Records — Last 30 Days</h2>
                        <p className="text-xs text-gray-400">Tap any row for details ↓</p>
                    </div>

                    {cleanerSessions.length === 0 ? (
                        <div className="border border-gray-200 rounded-lg p-8 text-center">
                            <p className="text-base text-gray-400">No service records yet.</p>
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Table header */}
                            <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-200 px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                <div className="col-span-3">Date</div>
                                <div className="col-span-2">Time In</div>
                                <div className="col-span-2">Time Out</div>
                                <div className="col-span-1">Dur.</div>
                                <div className="col-span-2">Staff</div>
                                <div className="col-span-1 text-center">Status</div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Table rows */}
                            {cleanerSessions.map((session, idx) => {
                                const isExpanded = expandedRow === idx;
                                const allComplete = session.zonesCompleted >= session.zonesTotal;
                                const tasksCompleted = session.zones.reduce((sum, z) => sum + z.tasks.filter(t => t.completed).length, 0);
                                const tasksTotal = session.zones.reduce((sum, z) => sum + z.tasks.length, 0);

                                return (
                                    <div key={idx}>
                                        {/* Row */}
                                        <button
                                            onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                            className={`w-full grid grid-cols-12 px-4 py-3.5 text-left items-center border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                        >
                                            <div className="col-span-3 text-sm font-medium text-gray-900">{fmtDate(session.clockInAt)}</div>
                                            <div className="col-span-2 text-sm text-gray-700">{fmtTime(session.clockInAt)}</div>
                                            <div className="col-span-2 text-sm text-gray-700">{fmtTime(session.clockOutAt)}</div>
                                            <div className="col-span-1 text-sm text-gray-700">{getDuration(session.clockInAt, session.clockOutAt)}</div>
                                            <div className="col-span-2 text-sm text-gray-700 font-medium">{session.initials}</div>
                                            <div className="col-span-1 text-center">
                                                {allComplete ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-base">✓</span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                                                        {session.zonesCompleted}/{session.zonesTotal}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </button>

                                        {/* Expanded zone details */}
                                        {isExpanded && (
                                            <div className="bg-blue-50/50 border-b border-gray-200 px-6 py-4">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                                    Zone Details — {tasksCompleted}/{tasksTotal} tasks completed
                                                </p>
                                                <div className="space-y-2">
                                                    {session.zones.map((zone, zi) => {
                                                        const zoneComplete = zone.tasks.every(t => t.completed);
                                                        const zoneKey = `${idx}-${zi}`;
                                                        const isZoneOpen = expandedZones.has(zoneKey);
                                                        const zoneDone = zone.tasks.filter(t => t.completed).length;

                                                        return (
                                                            <div key={zi} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                {/* Zone header — click to expand tasks */}
                                                                <button
                                                                    onClick={(e) => toggleZone(zoneKey, e)}
                                                                    className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isZoneOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                        </svg>
                                                                        <span className="text-sm font-semibold text-gray-900">{zone.zoneName}</span>
                                                                        <span className="text-xs text-gray-400">{zoneDone}/{zone.tasks.length} tasks</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {zone.scannedAt && (
                                                                            <span className="text-xs text-gray-400">{fmtTime(zone.scannedAt)}</span>
                                                                        )}
                                                                        {zoneComplete ? (
                                                                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">Complete</span>
                                                                        ) : (
                                                                            <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">Partial</span>
                                                                        )}
                                                                    </div>
                                                                </button>

                                                                {/* Zone tasks — collapsible */}
                                                                {isZoneOpen && (
                                                                    <div className="border-t border-gray-100 px-4 pb-3.5 pt-3">
                                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                                            {zone.tasks.map((task, ti) => (
                                                                                <div key={ti} className="flex items-center gap-2 text-sm py-0.5">
                                                                                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${task.completed ? 'bg-green-600 border-green-600' : 'border-gray-300 bg-white'}`}>
                                                                                        {task.completed && (
                                                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                            </svg>
                                                                                        )}
                                                                                    </span>
                                                                                    <span className={task.completed ? 'text-gray-900' : 'text-gray-400'}>{task.name}</span>
                                                                                    {task.hasPhoto && <span className="text-xs text-blue-500">📷</span>}
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
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {summary.totalAudits > 0 && (
                        <p className="text-sm text-gray-500 mt-3">
                            {summary.totalAudits} internal audit{summary.totalAudits > 1 ? 's' : ''} also conducted during this period.
                        </p>
                    )}
                </div>

                <div className="border-t border-gray-200 pt-4 pb-6 text-center space-y-2">
                    <img src="/logo-combined.svg" alt="XIRI" className="h-6 mx-auto opacity-40" />
                    <p className="text-xs text-gray-300">All times automatically recorded via NFC check-in</p>
                </div>
            </div>
        </div>
    );
}
