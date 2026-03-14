'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Monitor, Wifi, Calendar, Clock, Building2,
    CheckCircle2, XCircle, AlertCircle,
    ChevronDown, ChevronRight, User, AlertOctagon, LogIn,
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder } from '@xiri-facility-solutions/shared';

// --- Types ---
interface NfcSessionLive {
    id: string;
    siteLocationId: string;
    workOrderId?: string;
    locationName: string;
    personName: string;
    personPhone?: string;
    personRole: 'cleaner' | 'night_manager';
    clockInAt: any;
    clockOutAt?: any;
    zoneScanResults: { zoneId: string; zoneName: string; scannedAt: any; tasks?: any[]; tasksCompleted?: any[] }[];
    auditScore?: number | null;
    auditNotes?: string | null;
    createdAt: any;
}

interface MorningReport {
    id: string;
    workOrderId: string;
    locationName: string;
    clientEmail: string;
    tier: 'green' | 'amber' | 'red';
    sentAt: any;
    zonesCompleted: number;
    zonesTotal: number;
    subject?: string;
    crewName?: string;
    clockIn?: string;
    clockOut?: string | null;
    zones?: { zoneName: string; tasksCompleted: number; tasksTotal: number; scannedAt: string | null }[];
    issues?: { type: string; summary: string; resolved: boolean; actionNeeded?: string }[];
}

type TonightStatus = 'waiting' | 'on_site' | 'in_progress' | 'running_over' | 'pending_review' | 'flagged' | 'verified' | 'incomplete' | 'late' | 'no_show';

const STATUS_STYLES: Record<TonightStatus, { bg: string; text: string; label: string; icon: any }> = {
    waiting:        { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Waiting', icon: Clock },
    on_site:        { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', label: 'On Site', icon: LogIn },
    in_progress:    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'In Progress', icon: Wifi },
    running_over:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Running Over', icon: Clock },
    pending_review: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Pending Review', icon: Clock },
    flagged:        { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Flagged', icon: AlertCircle },
    verified:       { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Verified', icon: CheckCircle2 },
    incomplete:     { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Incomplete', icon: AlertCircle },
    late:           { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Late', icon: AlertCircle },
    no_show:        { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'No-Show', icon: XCircle },
};

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    red:   { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

const formatTime = (d: any): string => {
    if (!d) return '—';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (d: any): string => {
    if (!d) return '—';
    const date = d.toDate?.() || new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatScheduleTime = (t: string | undefined): string => {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

function isTodayScheduled(daysOfWeek?: boolean[]): boolean {
    if (!daysOfWeek || daysOfWeek.length < 7) return true;
    return daysOfWeek[new Date().getDay()] === true;
}

function ZoneProgress({ completed, total }: { completed: number; total: number }) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{completed}/{total}</span>
        </div>
    );
}

export default function CommandCenterPage() {
    const { profile } = useAuth();

    const [activeWorkOrders, setActiveWorkOrders] = useState<(WorkOrder & { id: string })[]>([]);
    const [tonightSessionsRaw, setTonightSessionsRaw] = useState<NfcSessionLive[]>([]);

    // Separate cleaner and manager sessions
    const tonightSessions = useMemo(() => tonightSessionsRaw.filter(s => s.personRole !== 'night_manager'), [tonightSessionsRaw]);
    const managerSessions = useMemo(() => tonightSessionsRaw.filter(s => s.personRole === 'night_manager'), [tonightSessionsRaw]);
    const [nfcSites, setNfcSites] = useState<Record<string, any>>({});
    const [auditFeedback, setAuditFeedback] = useState<Record<string, Record<string, any>>>({});  // siteId -> { zone_0_night_manager: {...}, ... }
    const [morningReports, setMorningReports] = useState<MorningReport[]>([]);
    const [monitoringConfig, setMonitoringConfig] = useState<{ graceMinutes: number; noShowMinutes: number }>({ graceMinutes: 60, noShowMinutes: 120 });
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [ccTab, setCcTab] = useState<'tonight' | 'history'>('tonight');

    const [historyDateFrom, setHistoryDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [historyDateTo, setHistoryDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [tierFilter, setTierFilter] = useState<'all' | 'green' | 'amber' | 'red'>('all');
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [expandedTonight, setExpandedTonight] = useState<string | null>(null);
    const [expandedAuditZones, setExpandedAuditZones] = useState<Set<string>>(new Set());

    // ── Fetch active work orders + NFC sites ──────────────────────────
    useEffect(() => {
        if (!profile?.uid) return;
        async function load() {
            try {
                const woSnap = await getDocs(query(
                    collection(db, 'work_orders'),
                    where('status', '==', 'active'),
                ));
                setActiveWorkOrders(woSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string })));

                // Load monitoring settings from Firestore
                try {
                    const configSnap = await getDoc(doc(db, 'settings', 'monitoring'));
                    if (configSnap.exists()) {
                        const cfg = configSnap.data();
                        setMonitoringConfig({
                            graceMinutes: cfg.graceMinutes ?? 60,
                            noShowMinutes: cfg.noShowMinutes ?? 120,
                        });
                    }
                } catch { /* use defaults */ }

                const nfcSnap = await getDocs(collection(db, 'nfc_sites'));
                const sites: Record<string, any> = {};
                nfcSnap.docs.forEach(d => { sites[d.id] = d.data(); });
                setNfcSites(sites);
            } catch (err) {
                console.error('Error loading command center data:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [profile?.uid]);

    // ── Real-time NFC sessions (tonight) ──────────────────────────────
    useEffect(() => {
        // Use noon as cutoff to capture early-start sessions (3 PM, 4 PM, etc.)
        const cutoff = new Date();
        cutoff.setHours(12, 0, 0, 0);
        if (new Date() < cutoff) {
            cutoff.setDate(cutoff.getDate() - 1);
        }

        const q = query(
            collection(db, 'nfc_sessions'),
            where('createdAt', '>=', Timestamp.fromDate(cutoff)),
            orderBy('createdAt', 'desc'),
        );

        const unsub = onSnapshot(q, (snap) => {
            setTonightSessionsRaw(snap.docs.map(d => ({ id: d.id, ...d.data() } as NfcSessionLive)));
        });

        return () => unsub();
    }, []);

    // ── History data ──────────────────────────────────────────────────
    useEffect(() => {
        if (ccTab !== 'history') return;
        setHistoryLoading(true);

        const from = new Date(historyDateFrom); from.setHours(0, 0, 0, 0);
        const to = new Date(historyDateTo); to.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, 'morning_reports'),
            where('sentAt', '>=', Timestamp.fromDate(from)),
            where('sentAt', '<=', Timestamp.fromDate(to)),
            orderBy('sentAt', 'desc'),
        );

        const unsub = onSnapshot(q, (snap) => {
            setMorningReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as MorningReport)));
            setHistoryLoading(false);
        });

        return () => unsub();
    }, [ccTab, historyDateFrom, historyDateTo]);

    // ── Fetch audit_feedback when manager sessions exist (real-time) ───
    useEffect(() => {
        if (managerSessions.length === 0) return;
        const siteIds = [...new Set(managerSessions.map(s => s.siteLocationId))];
        const unsubs: (() => void)[] = [];
        const fb: Record<string, Record<string, any>> = {};

        for (const siteId of siteIds) {
            try {
                const unsub = onSnapshot(collection(db, 'nfc_sites', siteId, 'audit_feedback'), (snap) => {
                    if (!snap.empty) {
                        fb[siteId] = {};
                        snap.docs.forEach(d => { fb[siteId][d.id] = d.data(); });
                    }
                    setAuditFeedback(prev => ({ ...prev, ...fb }));
                });
                unsubs.push(unsub);
            } catch { /* ignore */ }
        }

        return () => unsubs.forEach(u => u());
    }, [managerSessions]);

    // ── Derive audit score from per-zone task ratings ─────────────────
    function deriveAuditScore(siteId: string): number | null {
        const siteFeedback = auditFeedback[siteId];
        if (!siteFeedback) return null;
        const SCORE_MAP: Record<string, number> = { good: 5, acceptable: 3, unacceptable: 1 };
        let total = 0, count = 0;
        Object.values(siteFeedback).forEach((zoneFb: any) => {
            if (zoneFb.personRole !== 'night_manager' || !zoneFb.tasks) return;
            Object.values(zoneFb.tasks).forEach((task: any) => {
                if (task.auditStatus && SCORE_MAP[task.auditStatus] != null) {
                    total += SCORE_MAP[task.auditStatus];
                    count++;
                }
            });
        });
        return count > 0 ? Math.round((total / count) * 10) / 10 : null;
    }

    // ── Check if any zone has non-good ratings ───────────────────────────
    function hasAnyIssues(siteId: string): boolean {
        const siteFeedback = auditFeedback[siteId];
        if (!siteFeedback) return false;
        return Object.values(siteFeedback).some((zoneFb: any) => {
            if (zoneFb.personRole !== 'night_manager' || !zoneFb.tasks) return false;
            return Object.values(zoneFb.tasks).some((task: any) =>
                task.auditStatus === 'acceptable' || task.auditStatus === 'unacceptable'
            );
        });
    }

    // ── Derive per-zone score ─────────────────────────────────────────
    type TaskDetail = { taskName: string; auditStatus: string | null; note: string | null };
    type ZoneAudit = { status: 'good' | 'acceptable' | 'unacceptable' | null; hasNotes: boolean; noteText?: string; taskDetails: TaskDetail[]; zoneNotes?: string };
    function getZoneAuditSummary(siteId: string, zoneId: string): ZoneAudit {
        const zoneFb = auditFeedback[siteId]?.[`${zoneId}_night_manager`];
        if (!zoneFb?.tasks) return { status: null, hasNotes: false, taskDetails: [] };
        const taskDetails: TaskDetail[] = Object.values(zoneFb.tasks).map((t: any) => ({
            taskName: t.taskName || 'Task',
            auditStatus: t.auditStatus || null,
            note: t.note || null,
        }));
        const statuses = taskDetails.map(t => t.auditStatus).filter(Boolean);
        const notes = taskDetails.map(t => t.note).filter(Boolean);
        const zoneNotes = zoneFb.auditNotes;
        // Worst status wins for the zone
        let status: 'good' | 'acceptable' | 'unacceptable' | null = null;
        if (statuses.includes('unacceptable')) status = 'unacceptable';
        else if (statuses.includes('acceptable')) status = 'acceptable';
        else if (statuses.length > 0) status = 'good';
        return { status, hasNotes: notes.length > 0 || !!zoneNotes, noteText: zoneNotes || notes[0] || undefined, taskDetails, zoneNotes: zoneNotes || undefined };
    }

    // ── Tonight's grid ────────────────────────────────────────────────
    const tonightGrid = useMemo(() => {
        return activeWorkOrders
            .filter(wo => isTodayScheduled(wo.schedule?.daysOfWeek))
            .map(wo => {
                const siteId = (wo as any).nfcSiteId || wo.locationId || `${wo.leadId}_loc`;
                const site = nfcSites[siteId];
                const totalZones = site?.zones?.length || 0;
                const session = tonightSessions.find(s => s.siteLocationId === siteId);
                const mgrSession = managerSessions.find(s => s.siteLocationId === siteId);
                const zonesScanned = session?.zoneScanResults?.length || 0;

                let status: TonightStatus = 'waiting';
                const estCleanMin = site?.estimatedCleanMinutes || 120;

                if (session) {
                    const clockInTime = session.clockInAt?.toDate?.() || new Date(session.clockInAt);
                    const elapsedMin = (Date.now() - clockInTime.getTime()) / 60000;

                    if (session.clockOutAt || zonesScanned >= totalZones) {
                        if (zonesScanned >= totalZones) {
                            // Crew done — check for separate night manager session
                            if (mgrSession?.clockOutAt) {
                                // Manager has completed their audit — flag if ANY zone has non-good ratings
                                status = hasAnyIssues(siteId) ? 'flagged' : 'verified';
                            } else {
                                status = 'pending_review';
                            }
                        } else {
                            status = 'incomplete';
                        }
                    } else if (elapsedMin > estCleanMin * 2 && zonesScanned < totalZones) {
                        status = 'incomplete';
                    } else if (elapsedMin > estCleanMin * 1.5 && zonesScanned < totalZones) {
                        status = 'running_over';
                    } else if (zonesScanned > 0) {
                        status = 'in_progress';
                    } else {
                        status = 'on_site';
                    }
                } else {
                    const startTime = wo.schedule?.startTime || '19:00';
                    const [h, m] = startTime.split(':').map(Number);
                    const scheduledStart = new Date();
                    scheduledStart.setHours(h, m, 0, 0);
                    const now = new Date();
                    const noShowMin = (wo as any).monitoringNoShowMinutes || monitoringConfig.noShowMinutes;
                    const graceMin = (wo as any).monitoringGraceMinutes || monitoringConfig.graceMinutes;

                    if (now > new Date(scheduledStart.getTime() + noShowMin * 60000)) status = 'no_show';
                    else if (now > new Date(scheduledStart.getTime() + graceMin * 60000)) status = 'late';
                }

                return {
                    wo, siteId, session, mgrSession, totalZones, zonesScanned, status,
                    vendorName: site?.vendorName || wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || '—',
                };
            }).sort((a, b) => {
                // Sort by severity: critical issues float to top
                const SEVERITY_ORDER: Record<TonightStatus, number> = {
                    no_show: 0, late: 1, incomplete: 2, running_over: 3, waiting: 4, on_site: 5, in_progress: 6, pending_review: 7, flagged: 8, verified: 9,
                };
                return SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkOrders, tonightSessions, managerSessions, nfcSites, auditFeedback]);

    const statusCounts = useMemo(() => {
        const c = { total: tonightGrid.length, waiting: 0, on_site: 0, in_progress: 0, running_over: 0, pending_review: 0, flagged: 0, verified: 0, incomplete: 0, late: 0, no_show: 0 };
        tonightGrid.forEach(r => { c[r.status]++; });
        return c;
    }, [tonightGrid]);

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;

    return (
        <ProtectedRoute resource="operations/work-orders">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Monitor className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Command Center</h1>
                            <p className="text-sm text-muted-foreground">Real-time cleaning operations monitoring</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Button variant={ccTab === 'tonight' ? 'default' : 'ghost'} size="sm" className="gap-1.5 text-xs" onClick={() => setCcTab('tonight')}>
                            <Wifi className="w-3.5 h-3.5" /> Tonight
                        </Button>
                        <Button variant={ccTab === 'history' ? 'default' : 'ghost'} size="sm" className="gap-1.5 text-xs" onClick={() => setCcTab('history')}>
                            <Calendar className="w-3.5 h-3.5" /> History
                        </Button>
                    </div>
                </div>

                {/* ── Tonight Tab ── */}
                {ccTab === 'tonight' ? (() => {
                    const MANAGER_STATUSES: TonightStatus[] = ['pending_review', 'verified', 'flagged'];
                    const cleanerRows = tonightGrid.filter(r => !MANAGER_STATUSES.includes(r.status));
                    const managerRows = tonightGrid.filter(r => MANAGER_STATUSES.includes(r.status));

                    // Shared row renderer
                    const renderRow = (row: typeof tonightGrid[0], showScoreCol: boolean) => {
                        const style = STATUS_STYLES[row.status];
                        const Icon = style.icon;
                        const isTonightExpanded = expandedTonight === row.wo.id;
                        const site = nfcSites[row.siteId];
                        const lastTap = row.session?.zoneScanResults?.length
                            ? row.session.zoneScanResults[row.session.zoneScanResults.length - 1] : null;
                        const cleanedAt = row.session?.clockOutAt || (lastTap?.scannedAt);
                        const verifiedAt = row.mgrSession?.clockOutAt;
                        const colSpan = showScoreCol ? 8 : 7;

                        return (
                            <React.Fragment key={row.wo.id}>
                                <tr
                                    className={`border-b last:border-0 hover:bg-muted/10 transition-colors cursor-pointer ${
                                        row.status === 'no_show' ? 'bg-red-50/50 dark:bg-red-900/5' :
                                        row.status === 'late' ? 'bg-amber-50/50 dark:bg-amber-900/5' :
                                        row.status === 'incomplete' ? 'bg-orange-50/50 dark:bg-orange-900/5' : ''
                                    }`}
                                    onClick={() => setExpandedTonight(isTonightExpanded ? null : row.wo.id)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {isTonightExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                            <Badge className={`${style.bg} ${style.text} border-0 gap-1 font-medium`}>
                                                <Icon className="w-3 h-3" /> {style.label}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-sm">{row.wo.locationName}</p>
                                        <p className="text-xs text-muted-foreground">{row.wo.serviceType}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{row.vendorName}</td>
                                    <td className="px-4 py-3"><ZoneProgress completed={row.zonesScanned} total={row.totalZones} /></td>
                                    <td className="px-4 py-3 text-sm font-mono">{formatScheduleTime(row.wo.schedule?.startTime)}</td>
                                    <td className="px-4 py-3 text-sm font-mono">{cleanedAt ? formatTime(cleanedAt) : '—'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {verifiedAt ? (
                                            <span className="font-mono">{formatTime(verifiedAt)}</span>
                                        ) : row.status === 'pending_review' ? (
                                            <span className="text-xs text-purple-600 dark:text-purple-400">Awaiting</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    {showScoreCol && (
                                        <td className="px-4 py-3 text-sm">
                                            {(() => {
                                                const score = deriveAuditScore(row.siteId);
                                                if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
                                                const color = score >= 4 ? 'text-green-600' : score >= 3 ? 'text-amber-600' : 'text-red-600';
                                                return <span className={`font-semibold ${color}`}>{score.toFixed(1)}</span>;
                                            })()}
                                        </td>
                                    )}
                                </tr>
                                {isTonightExpanded && (
                                    <tr key={`${row.wo.id}-detail`}>
                                        <td colSpan={colSpan} className="bg-muted/20 px-6 py-4">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Left: Shift Info */}
                                            <div className="space-y-3">
                                                {/* Cleaner Contact */}
                                                {row.session?.personName && (
                                                    <div className="flex items-center gap-3 text-xs">
                                                        <span className="flex items-center gap-1 text-foreground font-medium">
                                                            <User className="w-3.5 h-3.5" />{row.session.personName}
                                                        </span>
                                                        {row.session.personPhone && (
                                                            <a href={`tel:${row.session.personPhone}`} className="text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                                📞 {row.session.personPhone}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Activity */}
                                                {(() => {
                                                    const clockIn = row.session?.clockInAt;
                                                    const clockOut = row.session?.clockOutAt;
                                                    const estMin = site?.estimatedCleanMinutes || 120;

                                                    if (!clockIn) {
                                                        return <p className="text-xs text-muted-foreground">No crew has clocked in yet.</p>;
                                                    }

                                                    const clockInDate = clockIn?.toDate ? clockIn.toDate() : new Date(clockIn);
                                                    const expectedDone = new Date(clockInDate.getTime() + estMin * 60000);

                                                    if (clockOut) {
                                                        const clockOutDate = clockOut?.toDate ? clockOut.toDate() : new Date(clockOut);
                                                        const durationMin = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
                                                        return (
                                                            <p className="text-xs text-muted-foreground">
                                                                Clocked in at {formatTime(clockIn)} and finished at {formatTime(clockOut)} ({durationMin} min).
                                                            </p>
                                                        );
                                                    }

                                                    const nowMs = Date.now();
                                                    const elapsedMin = Math.round((nowMs - clockInDate.getTime()) / 60000);
                                                    const remainingMin = estMin - elapsedMin;

                                                    return (
                                                        <p className="text-xs text-muted-foreground">
                                                            Clocked in at {formatTime(clockIn)}.
                                                            Expected to finish by {formatTime(expectedDone)}
                                                            {remainingMin > 0
                                                                ? ` (${remainingMin} min remaining).`
                                                                : ` (${Math.abs(remainingMin)} min over).`
                                                            }
                                                        </p>
                                                    );
                                                })()}



                                                {/* Night Manager — Compact Bar */}
                                                {row.mgrSession && (() => {
                                                    const derivedScore = deriveAuditScore(row.siteId);
                                                    const scoreLabel = derivedScore != null ? `${derivedScore.toFixed(1)}/5` : '—';
                                                    const scoreColor = derivedScore == null ? 'text-muted-foreground' : derivedScore >= 4 ? 'text-green-600' : derivedScore >= 3 ? 'text-amber-600' : 'text-red-600';
                                                    return (
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground rounded-lg border px-3 py-2">
                                                            <span className="flex items-center gap-1 text-foreground font-medium">👤 {row.mgrSession.personName}</span>
                                                            <span>Inspected {formatTime(row.mgrSession.clockInAt)} → {row.mgrSession.clockOutAt ? formatTime(row.mgrSession.clockOutAt) : '…'}</span>
                                                            <span className={`font-semibold ${scoreColor}`}>Score {scoreLabel}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Right: Zone Breakdown — Cleaner + Manager Side-by-Side */}
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Zone Progress</h4>
                                                {/* Column headers */}
                                                {row.mgrSession && (
                                                    <div className="grid gap-1 mb-1 text-[10px] text-muted-foreground" style={{ gridTemplateColumns: 'minmax(100px, 1.2fr) 70px 1fr' }}>
                                                        <span>Zone</span>
                                                        <span className="text-right">🧹 Cleaned</span>
                                                        <span className="text-right">👤 Manager Audit</span>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    {(site?.zones || []).map((zone: any, zi: number) => {
                                                        const scanned = row.session?.zoneScanResults?.find((z: any) => z.zoneName === zone.name || z.zoneId === zone.id);
                                                        const audit = getZoneAuditSummary(row.siteId, zone.id);
                                                        const mgrScanned = row.mgrSession?.zoneScanResults?.find((z: any) => z.zoneName === zone.name || z.zoneId === zone.id);
                                                        return (
                                                            <div key={zi} className="grid items-start text-sm py-1.5 px-2 rounded hover:bg-muted/30" style={{ gridTemplateColumns: row.mgrSession ? 'minmax(100px, 1.2fr) 70px 1fr' : 'minmax(100px, 1fr) 70px' }}>
                                                                {/* Zone name */}
                                                                <div className="flex items-center gap-2">
                                                                    {scanned
                                                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                                                        : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                                                    }
                                                                    <span className={scanned ? 'font-medium' : 'text-muted-foreground'}>{zone.name}</span>
                                                                </div>
                                                                {/* Cleaned timestamp */}
                                                                <span className="text-xs font-mono text-muted-foreground text-right">
                                                                    {scanned ? formatTime(scanned.scannedAt) : '—'}
                                                                </span>
                                                                {/* Manager audit rating */}
                                                                {row.mgrSession && (() => {
                                                                    const auditKey = `${row.wo.id}_${zone.id}`;
                                                                    const isAuditExpanded = expandedAuditZones.has(auditKey);
                                                                    const hasIssues = audit.status === 'acceptable' || audit.status === 'unacceptable';
                                                                    return (
                                                                    <div>
                                                                        <div className="flex items-center justify-end gap-1.5">
                                                                            {hasIssues ? (
                                                                                <button
                                                                                    type="button"
                                                                                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                                                                                    onClick={(e) => { e.stopPropagation(); setExpandedAuditZones(prev => { const next = new Set(prev); next.has(auditKey) ? next.delete(auditKey) : next.add(auditKey); return next; }); }}
                                                                                >
                                                                                    <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${isAuditExpanded ? 'rotate-90' : ''}`} />
                                                                                    {audit.status === 'acceptable' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-400">🟡 OK</span>}
                                                                                    {audit.status === 'unacceptable' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium dark:bg-red-900/30 dark:text-red-400">🔴 Bad</span>}
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    {audit.status === 'good' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium dark:bg-green-900/30 dark:text-green-400">🟢 Good</span>}
                                                                                    {!audit.status && mgrScanned && <span className="text-xs text-muted-foreground">—</span>}
                                                                                    {!audit.status && !mgrScanned && <span className="text-xs text-muted-foreground/50">pending</span>}
                                                                                </>
                                                                            )}
                                                                            {mgrScanned && <span className="text-[10px] font-mono text-muted-foreground">{formatTime(mgrScanned.scannedAt)}</span>}
                                                                        </div>
                                                                        {/* Collapsible per-task breakdown */}
                                                                        {isAuditExpanded && hasIssues && audit.taskDetails.length > 0 && (
                                                                            <div className="mt-1.5 space-y-0.5 pl-1 border-l-2 border-amber-300 dark:border-amber-700 ml-1">
                                                                                {audit.taskDetails.map((task, ti) => (
                                                                                    <div key={ti} className="flex items-start gap-1.5 text-[11px]">
                                                                                        <span>{task.auditStatus === 'good' ? '🟢' : task.auditStatus === 'acceptable' ? '🟡' : task.auditStatus === 'unacceptable' ? '🔴' : '⚪'}</span>
                                                                                        <span className="text-muted-foreground">{task.taskName}</span>
                                                                                        {task.note && <span className="text-foreground italic">— {task.note}</span>}
                                                                                    </div>
                                                                                ))}
                                                                                {audit.zoneNotes && (
                                                                                    <div className="text-[11px] text-foreground italic mt-1 pl-4">📝 {audit.zoneNotes}</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                )}
                            </React.Fragment>
                        );
                    };

                    // Section dividers for cleaner table
                    const SECTION_MAP_CLEANER: Record<string, string> = {
                        no_show: 'Needs Attention', late: 'Needs Attention', incomplete: 'Needs Attention',
                        running_over: 'Running Over',
                        waiting: 'Active', on_site: 'Active', in_progress: 'Active',
                    };
                    const SECTION_MAP_MANAGER: Record<string, string> = {
                        pending_review: 'Pending Review',
                        flagged: 'Flagged',
                        verified: 'Verified',
                    };
                    const SECTION_STYLE: Record<string, string> = {
                        'Needs Attention': 'text-red-600 dark:text-red-400 bg-red-50/60 dark:bg-red-900/10',
                        'Running Over': 'text-yellow-700 dark:text-yellow-400 bg-yellow-50/60 dark:bg-yellow-900/10',
                        'Active': 'text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10',
                        'Pending Review': 'text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-900/10',
                        'Flagged': 'text-orange-700 dark:text-orange-400 bg-orange-50/60 dark:bg-orange-900/10',
                        'Verified': 'text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-900/10',
                    };

                    return (
                        <div className="space-y-6">
                            {/* ── Table 1: Cleaning Progress ── */}
                            <Card>
                                <CardContent className="p-0">
                                    <div className="px-4 py-3 border-b bg-muted/30">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            🧹 Cleaning Progress
                                            <span className="text-xs font-normal text-muted-foreground">({cleanerRows.length} sites)</span>
                                        </h3>
                                    </div>
                                    {cleanerRows.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground text-sm">All sites have been cleaned and reviewed tonight.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase tracking-wider">
                                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                                        <th className="px-4 py-2.5 font-medium">Building</th>
                                                        <th className="px-4 py-2.5 font-medium">Vendor</th>
                                                        <th className="px-4 py-2.5 font-medium min-w-[140px]">Zones</th>
                                                        <th className="px-4 py-2.5 font-medium">Scheduled</th>
                                                        <th className="px-4 py-2.5 font-medium">Cleaned</th>
                                                        <th className="px-4 py-2.5 font-medium">Verified</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        let lastSection = '';

                                                        return cleanerRows.map(row => {
                                                            const section = SECTION_MAP_CLEANER[row.status] || '';
                                                            const showSectionHeader = section !== lastSection;
                                                            if (showSectionHeader) lastSection = section;
                                                            const sectionCount = cleanerRows.filter(r => (SECTION_MAP_CLEANER[r.status] || '') === section).length;
                                                            return (
                                                                <React.Fragment key={`s-${row.wo.id}`}>
                                                                    {showSectionHeader && (
                                                                        <tr>
                                                                            <td colSpan={6} className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${SECTION_STYLE[section] || ''}`}>
                                                                                {section} <span className="font-normal opacity-70">({sectionCount})</span>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                    {renderRow(row, false)}
                                                                </React.Fragment>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Table 2: Manager Reviewed ── */}
                            <Card>
                                <CardContent className="p-0">
                                    <div className="px-4 py-3 border-b bg-muted/30">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            👤 Manager Reviewed
                                            <span className="text-xs font-normal text-muted-foreground">({managerRows.length} sites)</span>
                                        </h3>
                                    </div>
                                    {managerRows.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground text-sm">No sites have been reviewed by the night manager yet.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase tracking-wider">
                                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                                        <th className="px-4 py-2.5 font-medium">Building</th>
                                                        <th className="px-4 py-2.5 font-medium">Vendor</th>
                                                        <th className="px-4 py-2.5 font-medium min-w-[140px]">Zones</th>
                                                        <th className="px-4 py-2.5 font-medium">Scheduled</th>
                                                        <th className="px-4 py-2.5 font-medium">Cleaned</th>
                                                        <th className="px-4 py-2.5 font-medium">Verified</th>
                                                        <th className="px-4 py-2.5 font-medium">Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        let lastSection = '';
                                                        return managerRows.map(row => {
                                                            const section = SECTION_MAP_MANAGER[row.status] || '';
                                                            const showSectionHeader = section !== lastSection;
                                                            if (showSectionHeader) lastSection = section;
                                                            const sectionCount = managerRows.filter(r => (SECTION_MAP_MANAGER[r.status] || '') === section).length;
                                                            return (
                                                                <React.Fragment key={`ms-${row.wo.id}`}>
                                                                    {showSectionHeader && (
                                                                        <tr>
                                                                            <td colSpan={8} className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${SECTION_STYLE[section] || ''}`}>
                                                                                {section} <span className="font-normal opacity-70">({sectionCount})</span>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                    {renderRow(row, true)}
                                                                </React.Fragment>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    );
                })() : null}

                {/* ── History Tab ── */}
                {ccTab === 'history' && (
                    <>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground">From</label>
                                <Input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="h-8 w-[160px] text-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground">To</label>
                                <Input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="h-8 w-[160px] text-sm" />
                            </div>
                            <div className="flex items-center gap-1">
                                {['7d', '30d', '90d'].map(range => (
                                    <Button key={range} variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                                        const days = parseInt(range);
                                        const to = new Date(), from = new Date();
                                        from.setDate(from.getDate() - days);
                                        setHistoryDateFrom(from.toISOString().split('T')[0]);
                                        setHistoryDateTo(to.toISOString().split('T')[0]);
                                    }}>
                                        {range}
                                    </Button>
                                ))}
                            </div>

                            {/* Tier Filter */}
                            <div className="border-l border-border pl-3 ml-1 flex items-center gap-1">
                                {(['all', 'green', 'amber', 'red'] as const).map(tier => {
                                    const count = tier === 'all' ? morningReports.length : morningReports.filter(r => r.tier === tier).length;
                                    const isActive = tierFilter === tier;
                                    const colors: Record<string, string> = {
                                        all: '',
                                        green: isActive ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700' : '',
                                        amber: isActive ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700' : '',
                                        red: isActive ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700' : '',
                                    };
                                    return (
                                        <Button
                                            key={tier}
                                            variant={isActive && tier === 'all' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`text-xs h-8 gap-1 ${colors[tier]}`}
                                            onClick={() => setTierFilter(tier)}
                                        >
                                            {tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1)}
                                            <span className="text-[10px] opacity-70">({count})</span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        <Card>
                            <CardContent className="p-0">
                                {historyLoading ? (
                                    <div className="py-12 text-center text-muted-foreground">Loading...</div>
                                ) : morningReports.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">
                                        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No reports in this range</p>
                                        <p className="text-xs mt-1">Morning reports are generated daily at 5:30 AM ET.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase tracking-wider">
                                                    <th className="px-4 py-2.5 font-medium">Date</th>
                                                    <th className="px-4 py-2.5 font-medium">Building</th>
                                                    <th className="px-4 py-2.5 font-medium">Status</th>
                                                    <th className="px-4 py-2.5 font-medium min-w-[140px]">Zones</th>
                                                    <th className="px-4 py-2.5 font-medium">Crew</th>
                                                    <th className="px-4 py-2.5 font-medium">Subject</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {morningReports.filter(r => tierFilter === 'all' || r.tier === tierFilter).map(r => {
                                                    const ts = TIER_STYLES[r.tier] || TIER_STYLES.green;
                                                    const isExpanded = expandedReport === r.id;
                                                    return (
                                                        <>
                                                            <tr
                                                                key={r.id}
                                                                className="border-b last:border-0 hover:bg-muted/10 transition-colors cursor-pointer"
                                                                onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                                                            >
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className="flex items-center gap-1">
                                                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                        <span className="font-mono">{formatDate(r.sentAt)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 font-medium">{r.locationName}</td>
                                                                <td className="px-4 py-3">
                                                                    <Badge className={`${ts.bg} ${ts.text} border-0 font-medium uppercase text-[10px]`}>{r.tier}</Badge>
                                                                </td>
                                                                <td className="px-4 py-3"><ZoneProgress completed={r.zonesCompleted} total={r.zonesTotal} /></td>
                                                                <td className="px-4 py-3 text-xs text-muted-foreground">{r.crewName || '—'}</td>
                                                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[250px]">{r.subject || '—'}</td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr key={`${r.id}-detail`}>
                                                                    <td colSpan={6} className="bg-muted/20 px-6 py-4">
                                                                        <div className="grid md:grid-cols-2 gap-6">
                                                                            {/* Left: Crew & Timing */}
                                                                            <div className="space-y-3">
                                                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Shift Details</h4>
                                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                    <div>
                                                                                        <span className="text-xs text-muted-foreground">Crew</span>
                                                                                        <p className="font-medium flex items-center gap-1"><User className="w-3.5 h-3.5" /> {r.crewName || '—'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-xs text-muted-foreground">Clock In</span>
                                                                                        <p className="font-mono">{r.clockIn || '—'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-xs text-muted-foreground">Clock Out</span>
                                                                                        <p className="font-mono">{r.clockOut || '—'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-xs text-muted-foreground">Client Email</span>
                                                                                        <p className="text-xs">{r.clientEmail}</p>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Issues */}
                                                                                {r.issues && r.issues.length > 0 && (
                                                                                    <div className="mt-3">
                                                                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Issues</h4>
                                                                                        {r.issues.map((issue, idx) => (
                                                                                            <div key={idx} className={`rounded-lg p-3 text-sm ${
                                                                                                issue.resolved
                                                                                                    ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                                                                                                    : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                                                                            }`}>
                                                                                                <div className="flex items-start gap-2">
                                                                                                    <AlertOctagon className={`w-4 h-4 mt-0.5 shrink-0 ${issue.resolved ? 'text-amber-500' : 'text-red-500'}`} />
                                                                                                    <div>
                                                                                                        <p className="font-medium">{issue.summary}</p>
                                                                                                        {issue.actionNeeded && (
                                                                                                            <p className="text-xs mt-1 font-semibold text-red-700 dark:text-red-400">⚡ {issue.actionNeeded}</p>
                                                                                                        )}
                                                                                                        <Badge variant="outline" className="mt-1 text-[10px]">
                                                                                                            {issue.resolved ? '✓ Resolved' : '⏳ Pending'}
                                                                                                        </Badge>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Right: Zone Breakdown */}
                                                                            <div>
                                                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Zone Breakdown</h4>
                                                                                <div className="space-y-1.5">
                                                                                    {(r.zones || []).map((z, zi) => (
                                                                                        <div key={zi} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/30">
                                                                                            <div className="flex items-center gap-2">
                                                                                                {z.tasksCompleted === z.tasksTotal
                                                                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                                                                    : z.tasksCompleted > 0
                                                                                                        ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                                                                                        : <XCircle className="w-3.5 h-3.5 text-red-400" />
                                                                                                }
                                                                                                <span className="font-medium">{z.zoneName}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3">
                                                                                                <span className="text-xs text-muted-foreground">
                                                                                                    {z.tasksCompleted}/{z.tasksTotal} tasks
                                                                                                </span>
                                                                                                <span className="text-xs font-mono text-muted-foreground w-[60px] text-right">
                                                                                                    {z.scannedAt || '—'}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
