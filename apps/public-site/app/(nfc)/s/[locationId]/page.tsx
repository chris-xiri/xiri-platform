'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────
interface SiteInfo {
    locationName: string;
    vendorName: string;
}

interface SessionInfo {
    sessionId: string;
    personRole: 'cleaner' | 'night_manager';
    locationName: string;
    vendorName: string;
    bidFrequency?: string | null;
    daysOfWeek?: boolean[] | null;
    zones: { id: string; name: string; tagId: string; tagLocationHint?: string; roomTypeNames: string[]; tasks?: { id: string; name: string; roomType: string; frequency?: string }[] }[];
    expiresAt: string;
}

interface StoredSiteAuth {
    locationId: string;
    locationName: string;
    vendorName: string;
    personName: string;
    siteKeyStored: string;
    onboardedAt: string;
}

// ─── Local Storage Helpers ───────────────────────────────────
function getStoredAuth(locationId: string): StoredSiteAuth | null {
    try {
        const raw = localStorage.getItem(`xiri_site_${locationId}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function storeAuth(auth: StoredSiteAuth) {
    localStorage.setItem(`xiri_site_${auth.locationId}`, JSON.stringify(auth));
}

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

function storeSession(locationId: string, session: SessionInfo) {
    localStorage.setItem(`xiri_session_${locationId}`, JSON.stringify(session));
}

// ─── Page Component ──────────────────────────────────────────
export default function StartPage({ params }: { params: Promise<{ locationId: string }> }) {
    const { locationId } = use(params);

    const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
    const [storedAuth, setStoredAuth] = useState<StoredSiteAuth | null>(null);
    const [existingSession, setExistingSession] = useState<SessionInfo | null>(null);

    // Form state
    const [siteKey, setSiteKey] = useState('');
    const [personName, setPersonName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [clockedIn, setClockedIn] = useState(false);
    const [session, setSession] = useState<SessionInfo | null>(null);

    // Load site info + check stored auth
    useEffect(() => {
        async function load() {
            // Check for existing session first
            const existingSess = getActiveSession(locationId);
            if (existingSess) {
                setExistingSession(existingSess);
                setClockedIn(true);
                setSession(existingSess);
                setLoading(false);
                return;
            }

            // Load site info from Firestore (public read — just locationName + vendorName)
            try {
                const siteDoc = await getDoc(doc(db, 'nfc_sites', locationId));
                if (siteDoc.exists()) {
                    const data = siteDoc.data();
                    setSiteInfo({
                        locationName: data.locationName || 'Unknown Location',
                        vendorName: data.vendorName || '',
                    });
                } else {
                    setError('Location not found. Check the NFC tag.');
                }
            } catch (err) {
                console.error('Failed to load site info:', err);
                setError('Failed to load location info.');
            }

            // Check stored auth
            const auth = getStoredAuth(locationId);
            if (auth) {
                setStoredAuth(auth);
                setPersonName(auth.personName);
                setSiteKey(auth.siteKeyStored);
            }

            setLoading(false);
        }
        load();
    }, [locationId]);

    // Handle clock-in (calls Cloud Function)
    const handleClockIn = async () => {
        if (!siteKey.trim()) {
            setError('Please enter the site key.');
            return;
        }
        if (!personName.trim()) {
            setError('Please enter your name.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const functions = getFunctions(app);
            const validateFn = httpsCallable(functions, 'validateSiteKey');

            const result = await validateFn({
                locationId,
                siteKey: siteKey.trim().toUpperCase(),
                personName: personName.trim(),
                deviceFingerprint: navigator.userAgent,
            });

            const sessionData = result.data as SessionInfo;

            // Store auth for future visits
            storeAuth({
                locationId,
                locationName: sessionData.locationName,
                vendorName: sessionData.vendorName,
                personName: personName.trim(),
                siteKeyStored: siteKey.trim().toUpperCase(),
                onboardedAt: new Date().toISOString(),
            });

            // Store session
            storeSession(locationId, sessionData);
            setSession(sessionData);
            setClockedIn(true);
        } catch (err: any) {
            console.error('Clock-in failed:', err);
            const message = err?.message || err?.code || 'Clock-in failed';
            if (message.includes('permission-denied') || message.includes('Invalid site key')) {
                setError('Invalid site key. Please check and try again.');
                // Clear stored auth if key was invalid
                localStorage.removeItem(`xiri_site_${locationId}`);
                setStoredAuth(null);
                setSiteKey('');
            } else if (message.includes('revoked')) {
                setError('Access has been revoked. Contact your supervisor for a new site key.');
                localStorage.removeItem(`xiri_site_${locationId}`);
                setStoredAuth(null);
                setSiteKey('');
            } else {
                setError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─── Clocked In ──────────────────────────────────────────
    if (clockedIn && session) {
        return (
            <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
                {/* Success */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Clocked In!</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {new Date(new Date(session.expiresAt).getTime() - 12 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <div className="p-5 space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="text-2xl">📍</div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">{session.locationName}</p>
                                <p className="text-xs text-gray-500">{session.vendorName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Compliance Log Link */}
                <a
                    href={`/c/${locationId}`}
                    className="block w-full text-center py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                >
                    📋 View Compliance Log
                </a>

                {/* Zone List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                        Tonight&apos;s Zones ({session.zones.length})
                    </h2>
                    <div className="space-y-2">
                        {session.zones.map((zone, i) => {
                            // Check if zone was already completed in this session
                            const isZoneDone = (() => {
                                try {
                                    const raw = localStorage.getItem(`xiri_zone_${session.sessionId}_${zone.id}`);
                                    return !!raw;
                                } catch { return false; }
                            })();

                            return (
                                <a
                                    key={zone.id}
                                    href={`/z/${locationId}/${zone.id}`}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                        isZoneDone
                                            ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
                                            : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50/50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                                        isZoneDone
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-sky-100 text-sky-700'
                                    }`}>
                                        {isZoneDone ? '✓' : i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isZoneDone ? 'text-green-700' : 'text-gray-900'}`}>{zone.name}</p>
                                        {zone.tagLocationHint && (
                                            <p className="text-[10px] text-gray-400">📍 {zone.tagLocationHint}</p>
                                        )}
                                        <p className="text-[10px] text-gray-400">
                                            {zone.roomTypeNames.join(' • ')}
                                        </p>
                                    </div>
                                    <div className={`text-xs shrink-0 ${isZoneDone ? 'text-green-500' : 'text-sky-500'}`}>
                                        {isZoneDone ? '✅ Done' : 'Tap →'}
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 text-center pt-2">
                        Walk to each zone and tap the NFC tag to check in.
                    </p>
                </div>
            </div>
        );
    }

    // ─── Error (no site found) ───────────────────────────────
    if (!siteInfo) {
        return (
            <div className="max-w-sm mx-auto text-center px-4 py-10 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold text-gray-900">Location Not Found</h1>
                <p className="text-sm text-gray-500">{error || 'This NFC tag is not configured.'}</p>
            </div>
        );
    }

    // ─── Onboarding / Clock-In Form ──────────────────────────
    const isReturningUser = !!storedAuth;

    return (
        <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
            {/* Welcome Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-6 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-100 flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-sky-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    {isReturningUser ? (
                        <>
                            <h1 className="text-xl font-bold text-gray-900">
                                Welcome back, {storedAuth.personName}!
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">{siteInfo.locationName}</p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-xl font-bold text-gray-900">
                                Welcome to {siteInfo.locationName}!
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                You&apos;re with <strong>{siteInfo.vendorName}</strong>
                            </p>
                        </>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    {/* Site Key */}
                    {!isReturningUser && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                🔑 Site Key
                            </label>
                            <input
                                type="text"
                                value={siteKey}
                                onChange={e => setSiteKey(e.target.value.toUpperCase())}
                                placeholder="Enter site key"
                                maxLength={10}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-2xl tracking-[0.3em] font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent uppercase"
                                autoFocus
                            />
                            <p className="text-[10px] text-gray-400 text-center">
                                Ask your supervisor for this code
                            </p>
                        </div>
                    )}

                    {/* Name */}
                    {!isReturningUser && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                👤 Your Name
                            </label>
                            <input
                                type="text"
                                value={personName}
                                onChange={e => setPersonName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            />
                        </div>
                    )}



                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                            <p className="text-xs text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleClockIn}
                        disabled={submitting || (!isReturningUser && (!siteKey.trim() || !personName.trim()))}
                        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
                    >
                        {submitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Clocking in...
                            </>
                        ) : (
                            <>
                                ⏰ Clock In
                            </>
                        )}
                    </button>

                    {isReturningUser && (
                        <button
                            onClick={() => {
                                setStoredAuth(null);
                                setSiteKey('');
                                setPersonName('');
                                localStorage.removeItem(`xiri_site_${locationId}`);
                            }}
                            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                        >
                            Not {storedAuth?.personName}? Switch user
                        </button>
                    )}

                    {/* Compliance log link */}
                    <a
                        href={`/c/${locationId}`}
                        className="block w-full text-center text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                    >
                        📋 View Compliance Log
                    </a>
                </div>
            </div>
        </div>
    );
}
