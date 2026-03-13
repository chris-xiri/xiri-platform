'use client';

import { useState, useEffect, use, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ─── Types ───────────────────────────────────────────────────
interface SessionInfo {
    sessionId: string;
    personRole: 'cleaner' | 'night_manager';
    locationName: string;
    vendorName: string;
    bidFrequency?: string | null;
    daysOfWeek?: boolean[] | null;
    zones: ZoneInfo[];
    expiresAt: string;
}

interface ZoneInfo {
    id: string;
    name: string;
    tagId: string;
    tagLocationHint?: string;
    roomTypeNames: string[];
    tasks?: { id: string; name: string; roomType: string; frequency?: string }[];
}

interface TaskItem {
    id: string;
    name: string;
    roomName: string;
    completed: boolean;
    dueToday: boolean;
    frequency?: string;
    // Audit-specific (manager only)
    auditStatus?: 'good' | 'acceptable' | 'unacceptable' | null;
    photo?: string | null;
    note?: string;
    noteLocked?: boolean;
    // Cleaner-facing audit feedback (from manager)
    managerNote?: string | null;
}

// ─── Local Storage Helpers ───────────────────────────────────
function getActiveSession(locationId: string): SessionInfo | null {
    try {
        const raw = localStorage.getItem(`xiri_session_${locationId}`);
        if (!raw) return null;
        const session = JSON.parse(raw) as SessionInfo;
        if (new Date(session.expiresAt) < new Date()) {
            localStorage.removeItem(`xiri_session_${locationId}`);
            return null;
        }
        return session;
    } catch { return null; }
}

/** Get saved zone scan results from localStorage */
function getSavedZoneResult(sessionId: string, zoneId: string): {
    tasks: { id: string; completed: boolean; auditStatus?: string | null; photo?: string | null; note?: string }[];
    auditNotes?: string;
    submittedAt?: string;
} | null {
    try {
        const raw = localStorage.getItem(`xiri_zone_${sessionId}_${zoneId}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/** Save zone scan results to localStorage */
function saveZoneResult(sessionId: string, zoneId: string, tasks: TaskItem[], auditNotes?: string, scanStartedAt?: string) {
    const data = {
        tasks: tasks.map(t => ({
            id: t.id,
            completed: t.completed,
            auditStatus: t.auditStatus || null,
            photo: t.photo || null,
            note: t.note || '',
        })),
        auditNotes: auditNotes || '',
        submittedAt: new Date().toISOString(),
        scanStartedAt: scanStartedAt || '',
    };
    localStorage.setItem(`xiri_zone_${sessionId}_${zoneId}`, JSON.stringify(data));
}

/** Frequency label helper */
function freqLabel(freq?: string): string | null {
    if (!freq) return null;
    const f = parseFloat(freq);
    if (isNaN(f)) return null;
    if (f >= 5) return null; // Daily — no label needed
    if (f >= 3) return '3x/wk';
    if (f >= 2) return '2x/wk';
    if (f >= 1) return '1x/wk';
    if (f >= 0.5) return '2x/mo';
    if (f >= 0.25) return '1x/mo';
    if (f >= 0.083) return 'Quarterly';
    return 'Annual';
}

/**
 * Determine if a task is due today based on:
 * - its frequency (times/week: "5", "3", "1", "0.25", etc.)
 * - the service schedule (daysOfWeek)
 * - today's date
 */
function isDueToday(
    taskFreq: string | undefined,
    bidFreq: string | null | undefined,
    daysOfWeek: boolean[] | null | undefined,
): boolean {
    // No frequency info → assume due (backwards compat)
    if (!taskFreq || !bidFreq) return true;

    const freq = parseFloat(taskFreq);
    const bid = parseFloat(bidFreq);
    if (isNaN(freq) || isNaN(bid)) return true;

    // If task matches bid frequency → due every service day
    if (freq >= bid) return true;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Get active service days (indices where service happens)
    const serviceDays = daysOfWeek
        ? daysOfWeek.map((active, i) => active ? i : -1).filter(i => i >= 0)
        : [1, 2, 3, 4, 5]; // Default Mon-Fri

    // If today isn't a service day at all, nothing is due
    if (!serviceDays.includes(dayOfWeek)) return false;

    const todayIndex = serviceDays.indexOf(dayOfWeek);
    const totalServiceDays = serviceDays.length;

    // Distribute task across service days evenly
    if (freq >= 1) {
        // e.g. 3x/week on 5 service days → due on service days 0, 2, 4 (Mon, Wed, Fri)
        const step = totalServiceDays / freq;
        for (let i = 0; i < freq; i++) {
            if (Math.round(i * step) === todayIndex) return true;
        }
        return false;
    }

    // Monthly or less (freq < 1): due on first service day of the period
    if (freq <= 0.25) {
        // Monthly: due first service day of the month
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        for (let d = firstOfMonth; d.getMonth() === now.getMonth(); d.setDate(d.getDate() + 1)) {
            if (serviceDays.includes(d.getDay())) {
                return d.getDate() === now.getDate();
            }
        }
        return false;
    }

    if (freq <= 0.5) {
        // 2x/month: 1st and 15th (or nearest service day)
        return now.getDate() <= 2 || (now.getDate() >= 15 && now.getDate() <= 16);
    }

    return true; // fallback
}

/** Build TaskItem[] from zone data with dueToday awareness */
function buildTaskItems(
    zoneData: ZoneInfo,
    bidFreq?: string | null,
    daysOfWeek?: boolean[] | null,
): TaskItem[] {
    if (zoneData.tasks && zoneData.tasks.length > 0) {
        return zoneData.tasks.map(t => ({
            id: t.id,
            name: t.name,
            roomName: t.roomType,
            completed: false,
            dueToday: isDueToday(t.frequency, bidFreq, daysOfWeek),
            frequency: t.frequency,
            auditStatus: null,
            photo: null,
        }));
    }
    return zoneData.roomTypeNames.map((name, i) => ({
        id: `task_${i}`,
        name: `Clean ${name}`,
        roomName: name,
        completed: false,
        dueToday: true, // No frequency info → assume due
        auditStatus: null,
        photo: null,
    }));
}

/** Compress an image file to a JPEG base64 string (max 800px, ~80% quality) */
async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = (h / w) * MAX; w = MAX; }
                else { w = (w / h) * MAX; h = MAX; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// ─── Page Component ──────────────────────────────────────────
export default function ZonePage({
    params
}: {
    params: Promise<{ locationId: string; zoneId: string }>
}) {
    const { locationId, zoneId } = use(params);

    const [session, setSession] = useState<SessionInfo | null>(null);
    const [zone, setZone] = useState<ZoneInfo | null>(null);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [justSubmitted, setJustSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [scanStartedAt, setScanStartedAt] = useState<string>('');

    // Audit-specific state
    const [auditNotes, setAuditNotes] = useState('');
    const [activePhotoTaskId, setActivePhotoTaskId] = useState<string | null>(null);
    const [submittedAt, setSubmittedAt] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isManager = session?.personRole === 'night_manager';

    // Load session + zone info
    useEffect(() => {
        async function load() {
            const sess = getActiveSession(locationId);
            if (!sess) {
                setError('no_session');
                setLoading(false);
                return;
            }

            setSession(sess);

            const zoneData = sess.zones.find(z => z.id === zoneId);
            if (!zoneData) {
                try {
                    const siteDoc = await getDoc(doc(db, 'nfc_sites', locationId));
                    if (siteDoc.exists()) {
                        const zones = siteDoc.data().zones || [];
                        const found = zones.find((z: any) => z.id === zoneId);
                        if (found) {
                            const zInfo: ZoneInfo = {
                                id: found.id,
                                name: found.name,
                                tagId: found.tagId,
                                tagLocationHint: found.tagLocationHint,
                                roomTypeNames: found.roomIds || found.roomTypeNames || [],
                                tasks: found.tasks || [],
                            };
                            setZone(zInfo);
                            const fallbackTasks = buildTaskItems(zInfo, sess.bidFrequency, sess.daysOfWeek);
                            const savedFallback = getSavedZoneResult(sess.sessionId, zoneId);
                            if (savedFallback) {
                                setTasks(fallbackTasks.map(t => {
                                    const s = savedFallback.tasks.find((st: any) => st.id === t.id);
                                    return s ? { ...t, completed: s.completed, auditStatus: (s.auditStatus as TaskItem['auditStatus']) || null, photo: s.photo || null } : t;
                                }));
                                setAuditNotes(savedFallback.auditNotes || '');
                                setSubmitted(true);
                            } else {
                                setTasks(fallbackTasks);
                            }
                        } else {
                            setError('zone_not_found');
                        }
                    }
                } catch {
                    setError('zone_not_found');
                }
                setLoading(false);
                return;
            }

            setZone(zoneData);
            const builtTasks = buildTaskItems(zoneData, sess.bidFrequency, sess.daysOfWeek);

            // Load cross-role feedback from Firestore
            // Cleaners see manager notes, managers see cleaner notes
            const oppositeRole = sess.personRole === 'cleaner' ? 'night_manager' : 'cleaner';
            const feedbackDocId = `${zoneId}_${oppositeRole}`;
            try {
                const feedbackDoc = await getDoc(doc(db, 'nfc_sites', locationId, 'audit_feedback', feedbackDocId));
                if (feedbackDoc.exists()) {
                    const feedback = feedbackDoc.data();
                    const dismissedKey = `xiri_dismissed_notes_${locationId}`;
                    const dismissed: string[] = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
                    const taskFeedback = feedback.tasks || {};
                    for (const task of builtTasks) {
                        const fb = taskFeedback[task.id];
                        if (fb?.note && !dismissed.includes(task.id)) {
                            task.managerNote = fb.note;
                        }
                        // For managers: merge cleaner's completion status
                        if (sess.personRole === 'night_manager' && fb) {
                            task.completed = fb.completed ?? false;
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load feedback:', err);
            }

            // Restore previous results if any
            const saved = getSavedZoneResult(sess.sessionId, zoneId);
            if (saved) {
                const restoredTasks = builtTasks.map(t => {
                    const savedTask = saved.tasks.find((s: any) => s.id === t.id);
                    if (savedTask) {
                        return {
                            ...t,
                            // For managers: keep cleaner's completion status from Firestore, don't overwrite
                            completed: sess.personRole === 'night_manager' ? t.completed : savedTask.completed,
                            auditStatus: (savedTask.auditStatus as TaskItem['auditStatus']) || null,
                            photo: savedTask.photo || null,
                            note: savedTask.note || '',
                        };
                    }
                    return t;
                });
                setTasks(restoredTasks);
                setAuditNotes(saved.auditNotes || '');
                setSubmittedAt(saved.submittedAt || '');
                setSubmitted(true); // Show as already submitted
            } else {
                setTasks(builtTasks);
                setScanStartedAt(new Date().toISOString());
            }
            setLoading(false);
        }
        load();
    }, [locationId, zoneId]);

    // ─── Cleaner: toggle task completion ─────────────────────
    const toggleTask = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        ));
    };

    // ─── Manager: set audit status (traffic light) ────────────
    const setAuditTaskStatus = (taskId: string, status: 'good' | 'acceptable' | 'unacceptable') => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, auditStatus: t.auditStatus === status ? null : status } : t
        ));
    };

    // ─── Manager: set task note ──────────────────────────────
    const setTaskNote = (taskId: string, note: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, note } : t
        ));
    };

    // ─── Cleaner: dismiss manager note ───────────────────────
    const dismissManagerNote = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, managerNote: null } : t
        ));
        // Remember dismissal in localStorage
        try {
            const key = `xiri_dismissed_notes_${locationId}`;
            const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
            if (!dismissed.includes(taskId)) {
                dismissed.push(taskId);
                localStorage.setItem(key, JSON.stringify(dismissed));
            }
        } catch { /* ignore */ }
    };

    // ─── Photo handling (per task) ────────────────────────────
    const triggerPhotoCapture = (taskId: string) => {
        setActivePhotoTaskId(taskId);
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !activePhotoTaskId) return;

        const file = files[0];
        try {
            const compressed = await compressImage(file);
            setTasks(prev => prev.map(t =>
                t.id === activePhotoTaskId ? { ...t, photo: compressed } : t
            ));
        } catch (err) {
            console.error('Failed to process image:', err);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setActivePhotoTaskId(null);
    };

    const removeTaskPhoto = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, photo: null } : t
        ));
    };

    const lockTaskNote = (taskId: string) => {
        setTasks(tasks.map(t =>
            t.id === taskId && t.note?.trim() ? { ...t, noteLocked: true } : t
        ));
    };

    // ─── Submit ─────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!session || !zone) return;
        setSubmitting(true);
        setError('');

        try {
            const functions = getFunctions(app);
            const updateFn = httpsCallable(functions, 'updateZoneScan');

            await updateFn({
                sessionId: session.sessionId,
                zoneId: zone.id,
                zoneName: zone.name,
                personRole: session.personRole,
                scanStartedAt: scanStartedAt || null,
                tasksCompleted: tasks.map(t => ({
                    taskId: t.id,
                    taskName: t.name,
                    completed: isManager ? (t.auditStatus === 'good' || t.auditStatus === 'acceptable') : t.completed,
                    dueToday: t.dueToday,
                    frequency: t.frequency || null,
                    photo: t.photo || null,
                    note: t.note?.trim() || null,
                    ...(isManager ? {
                        auditStatus: t.auditStatus,
                    } : {}),
                })),
                auditNotes: auditNotes.trim() || null,
            });

            // Save results locally for persistence
            const now = new Date().toISOString();
            saveZoneResult(session.sessionId, zone.id, tasks, auditNotes, scanStartedAt);
            setSubmittedAt(now);
            setSubmitted(true);
            setJustSubmitted(true);
        } catch (err: any) {
            console.error('Submit failed:', err);
            setError(err?.message || 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const photosCount = tasks.filter(t => t.photo).length;
    const dueTasks = tasks.filter(t => t.dueToday);
    const notDueTasks = tasks.filter(t => !t.dueToday);
    const completedCount = isManager
        ? dueTasks.filter(t => t.auditStatus !== null).length
        : dueTasks.filter(t => t.completed).length;
    const notesCount = tasks.filter(t => t.note?.trim()).length;
    const canSubmit = isManager
        ? dueTasks.length > 0 && (completedCount > 0 || photosCount > 0 || notesCount > 0)
        : dueTasks.length > 0 && dueTasks.every(t => t.completed);

    // ─── Loading ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─── No Session ──────────────────────────────────────────
    if (error === 'no_session') {
        return (
            <div className="max-w-sm mx-auto text-center py-10 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold text-gray-900">Clock In First</h1>
                <p className="text-sm text-gray-500">
                    Please tap the <strong>Start tag</strong> at the entrance to clock in before scanning zone tags.
                </p>
                <a
                    href={`/s/${locationId}`}
                    className="inline-block px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium"
                >
                    Go to Clock-In →
                </a>
            </div>
        );
    }

    // ─── Zone Not Found ──────────────────────────────────────
    if (error === 'zone_not_found' || !zone) {
        return (
            <div className="max-w-sm mx-auto text-center py-10 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold text-gray-900">Zone Not Found</h1>
                <p className="text-sm text-gray-500">This NFC tag isn&apos;t linked to a zone.</p>
            </div>
        );
    }

    // ─── Just Submitted — Success Page ───────────────────────
    if (justSubmitted && submitted) {
        const duration = scanStartedAt && submittedAt
            ? Math.round((new Date(submittedAt).getTime() - new Date(scanStartedAt).getTime()) / 60000)
            : null;
        return (
            <div className="max-w-sm mx-auto text-center py-10 space-y-5">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                    {isManager ? 'Audit Submitted!' : 'Zone Complete!'}
                </h1>
                <div className="space-y-1">
                    <p className="text-sm text-gray-600 font-medium">{zone.name}</p>
                    <p className="text-sm text-gray-500">
                        {completedCount}/{dueTasks.length} tasks {isManager ? 'reviewed' : 'completed'}
                    </p>
                    {photosCount > 0 && (
                        <p className="text-xs text-gray-400">📸 {photosCount} photo{photosCount > 1 ? 's' : ''} attached</p>
                    )}
                    {duration !== null && duration > 0 && (
                        <p className="text-xs text-gray-400">⏱ {duration} min in zone</p>
                    )}
                    {submittedAt && (
                        <p className="text-xs text-gray-400">
                            Submitted at {new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
                <div className={`p-4 rounded-xl ${isManager ? 'bg-amber-50 border border-amber-100' : 'bg-purple-50 border border-purple-100'}`}>
                    <p className={`text-sm font-medium ${isManager ? 'text-amber-800' : 'text-purple-800'}`}>
                        📱 Walk to the next zone and tap its NFC tag
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setJustSubmitted(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                        ✏️ Edit Responses
                    </button>
                    <a
                        href={`/s/${locationId}`}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 text-center"
                    >
                        ← All Zones
                    </a>
                </div>
            </div>
        );
    }

    // ─── Submitted Banner (shown above editable task list) ──
    const submittedBanner = submitted ? (
        <div className="max-w-sm mx-auto mb-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">
                        {isManager ? 'Audit Submitted' : 'Zone Complete'} ✓
                    </p>
                    <p className="text-[11px] text-green-600">
                        {completedCount}/{dueTasks.length} tasks {isManager ? 'reviewed' : 'done'}
                        {photosCount > 0 && ` · ${photosCount} photo${photosCount > 1 ? 's' : ''}`}
                        {submittedAt && ` · ${new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                </div>
                <a
                    href={`/s/${locationId}`}
                    className="text-[11px] text-green-600 hover:text-green-800 font-medium shrink-0"
                >
                    ← Zones
                </a>
            </div>
        </div>
    ) : null;

    return (
        <div className="max-w-sm mx-auto space-y-4">
            {/* Submitted banner */}
            {submittedBanner}
            {/* Zone header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`p-5 ${isManager
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50'
                    : 'bg-gradient-to-br from-purple-50 to-blue-50'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isManager ? 'bg-amber-100' : 'bg-purple-100'
                        }`}>
                            {isManager ? (
                                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">{zone.name}</h1>
                            <p className="text-xs text-gray-500">
                                {session?.locationName}
                                {isManager && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-semibold">
                                        AUDIT MODE
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    {zone.tagLocationHint && (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            📍 {zone.tagLocationHint}
                        </p>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                        {isManager ? 'Audit Progress' : 'Progress'}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{completedCount}/{dueTasks.length} today</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            isManager
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : 'bg-gradient-to-r from-purple-500 to-blue-500'
                        }`}
                        style={{ width: `${dueTasks.length > 0 ? (completedCount / dueTasks.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Task List — Due Today */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                    {isManager ? 'Verify Each Task' : 'Tasks Due Today'}
                </h2>

                {dueTasks.map(task => (
                    <div key={task.id}>
                        {isManager ? (
                            /* ─── Manager Audit Row ─────────────────── */
                            <div className={`p-3 rounded-xl border transition-all ${
                                task.auditStatus === 'good' ? 'border-green-200 bg-green-50' :
                                task.auditStatus === 'acceptable' ? 'border-amber-200 bg-amber-50' :
                                task.auditStatus === 'unacceptable' ? 'border-red-200 bg-red-50' :
                                'border-gray-100'
                            }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="flex-1 text-sm font-medium text-gray-900">{task.name}</p>
                                    {freqLabel(task.frequency) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{freqLabel(task.frequency)}</span>}
                                    <span className="text-[10px] text-gray-400">{task.roomName}</span>
                                </div>
                                {/* Cleaner completion indicator */}
                                <div className="flex items-center gap-1 mb-2">
                                    {task.completed ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Cleaner: Done</span>
                                    ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">– Cleaner: Not done</span>
                                    )}
                                </div>
                                {/* Cleaner feedback note */}
                                {task.managerNote && (
                                    <div className="mb-2 flex items-start gap-1.5 bg-purple-50 border border-purple-200 rounded-lg p-2">
                                        <span className="text-[10px]">🧹</span>
                                        <p className="flex-1 text-[11px] text-purple-800">Cleaner: {task.managerNote}</p>
                                        <button
                                            onClick={() => dismissManagerNote(task.id)}
                                            className="text-[10px] text-purple-400 hover:text-purple-600 shrink-0"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                                {/* Traffic light rating */}
                                <div className="flex gap-1.5 mb-2">
                                    {!task.completed && (
                                        <p className="w-full text-[11px] text-gray-400 italic py-2 text-center">Cleaner hasn&apos;t completed this task yet</p>
                                    )}
                                    {task.completed && (<>
                                    <button
                                        onClick={() => setAuditTaskStatus(task.id, 'good')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                                            task.auditStatus === 'good'
                                                ? 'bg-green-500 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                                        }`}
                                    >
                                        🟢 Good
                                    </button>
                                    <button
                                        onClick={() => setAuditTaskStatus(task.id, 'acceptable')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                                            task.auditStatus === 'acceptable'
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
                                        }`}
                                    >
                                        🟡 OK
                                    </button>
                                    <button
                                        onClick={() => setAuditTaskStatus(task.id, 'unacceptable')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                                            task.auditStatus === 'unacceptable'
                                                ? 'bg-red-500 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'
                                        }`}
                                    >
                                        🔴 Bad
                                    </button>
                                    </>)}
                                </div>
                                {/* Per-task photo */}
                                {task.photo ? (
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                        <img src={task.photo} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeTaskPhoto(task.id)}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => triggerPhotoCapture(task.id)}
                                        className="text-[11px] text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
                                    >
                                        📷 Add photo
                                    </button>
                                )}
                                {/* Per-task note input */}
                                <div className="mt-1">
                                    {task.note && task.noteLocked ? (
                                        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                            <p className="flex-1 text-[11px] text-amber-800 whitespace-pre-wrap">{task.note.trim()}</p>
                                            <button
                                                onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, noteLocked: false } : t))}
                                                className="text-[10px] text-amber-400 hover:text-amber-600 shrink-0"
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    ) : task.note ? (
                                        <div className="flex items-start gap-1">
                                            <textarea
                                                value={task.note}
                                                onChange={e => setTaskNote(task.id, e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); lockTaskNote(task.id); } }}
                                                className="flex-1 text-[11px] p-1.5 rounded-lg border border-gray-200 text-gray-700 resize-none focus:outline-none focus:border-amber-300"
                                                rows={2}
                                                placeholder="Note for cleaner..."
                                                autoFocus
                                            />
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => lockTaskNote(task.id)}
                                                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setTaskNote(task.id, '')}
                                                    className="text-[10px] text-gray-300 hover:text-gray-500"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setTaskNote(task.id, ' ')}
                                            className="text-[11px] text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
                                        >
                                            📝 Add note
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* ─── Cleaner Task Row ──────────────────── */
                            <>
                            <button
                                onClick={() => toggleTask(task.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                    task.completed
                                        ? 'border-green-200 bg-green-50'
                                        : 'border-gray-100 hover:border-purple-200'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                    task.completed
                                        ? 'border-green-500 bg-green-500'
                                        : 'border-gray-300'
                                }`}>
                                    {task.completed && (
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm ${task.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                        {task.name}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {freqLabel(task.frequency) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{freqLabel(task.frequency)}</span>}
                                        <p className="text-[10px] text-gray-400">{task.roomName}</p>
                                    </div>
                                    {/* Manager feedback note */}
                                    {task.managerNote && (
                                        <div className="mt-1 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                            <span className="text-[10px]">📋</span>
                                            <p className="flex-1 text-[11px] text-amber-800">{task.managerNote}</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); dismissManagerNote(task.id); }}
                                                className="text-[10px] text-amber-400 hover:text-amber-600 shrink-0"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </button>
                            {/* Cleaner: per-task photo + note */}
                            <div className="pl-12 pb-1 space-y-1">
                                {/* Per-task photo */}
                                {task.photo ? (
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                                        <img src={task.photo} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeTaskPhoto(task.id)}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => triggerPhotoCapture(task.id)}
                                        className="text-[11px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-1"
                                    >
                                        📷 Add photo
                                    </button>
                                )}
                                {/* Per-task note */}
                                {task.note && task.noteLocked ? (
                                    <div className="flex items-start gap-1.5 bg-purple-50 border border-purple-200 rounded-lg p-2">
                                        <p className="flex-1 text-[11px] text-purple-800 whitespace-pre-wrap">{task.note.trim()}</p>
                                        <button
                                            onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, noteLocked: false } : t))}
                                            className="text-[10px] text-purple-400 hover:text-purple-600 shrink-0"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                ) : task.note ? (
                                    <div className="flex items-start gap-1">
                                        <textarea
                                            value={task.note}
                                            onChange={e => setTaskNote(task.id, e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); lockTaskNote(task.id); } }}
                                            className="flex-1 text-[11px] p-1.5 rounded-lg border border-gray-200 text-gray-700 resize-none focus:outline-none focus:border-purple-300"
                                            rows={2}
                                            placeholder="Add a note..."
                                            autoFocus
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={() => lockTaskNote(task.id)}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500 text-white hover:bg-purple-600"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => setTaskNote(task.id, '')}
                                                className="text-[10px] text-gray-300 hover:text-gray-500"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setTaskNote(task.id, ' ')}
                                        className="text-[11px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-1"
                                    >
                                        📝 Add note
                                    </button>
                                )}
                            </div>
                            </>
                        )}
                    </div>
                ))}

                {/* Not Due Today — greyed out */}
                {notDueTasks.length > 0 && (
                    <>
                        <div className="border-t border-dashed border-gray-200 pt-3 mt-3">
                            <p className="text-[11px] text-gray-400 mb-2">Not scheduled for today</p>
                        </div>
                        {notDueTasks.map(task => (
                            <div key={task.id} className="p-3 rounded-xl border border-gray-50 bg-gray-50/50 opacity-50">
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-sm text-gray-400">{task.name}</p>
                                    {freqLabel(task.frequency) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{freqLabel(task.frequency)}</span>}
                                    <span className="text-[10px] text-gray-300">{task.roomName}</span>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Hidden file input for per-task photo capture */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
            />

            {/* Notes (both roles) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">
                    {isManager ? '📝 Audit Notes (optional)' : '📝 Additional Notes (optional)'}
                </h2>
                <textarea
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder={isManager ? 'Any observations, issues, or comments...' : 'Any issues or things to flag...'}
                    rows={3}
                    className={`w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none ${
                        isManager
                            ? 'focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                            : 'focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20'
                    }`}
                />
            </div>

            {/* Error */}
            {error && error !== 'no_session' && error !== 'zone_not_found' && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={submitting || (!canSubmit && !submitted)}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    (canSubmit || submitted)
                        ? isManager
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-xl'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-xl'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
                {submitting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                    </>
                ) : (canSubmit || submitted) ? (
                    submitted
                        ? (isManager ? '📋 Update Audit' : '✅ Update Zone')
                        : (isManager ? '📋 Submit Audit' : '✅ Complete Zone')
                ) : (
                    isManager
                        ? 'Rate a task, add photo, or note first'
                        : `Complete all ${dueTasks.length} tasks first`
                )}
            </button>
        </div>
    );
}
