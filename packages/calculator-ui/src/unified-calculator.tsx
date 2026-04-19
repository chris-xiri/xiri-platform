'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    BUILDING_TYPES,
    CLEANING_TASKS,
    DEFAULT_INPUTS,
    FREQUENCIES,
    ROOM_TYPES,
    STATES,
    calculate,
    getDefaultRooms,
    getStateDefaults,
    type Frequency,
    type RoomScope,
} from '@xiri-facility-solutions/shared';

export type UnifiedCalculatorMode = 'client' | 'contractor';

export interface ContractorCapturePayload {
    name: string;
    email: string;
    company: string;
    phone: string;
    state: string;
    county: string;
    buildingTypeId: string;
    sqft: number;
    frequency: Frequency;
    estimate: number;
    inArea: boolean;
    osUrl: string;
    onboardingUrl: string;
}

const SERVED_COUNTIES = ['nassau', 'suffolk', 'queens'] as const;
type ServedCounty = (typeof SERVED_COUNTIES)[number] | 'other' | 'unknown';
const FEATURED_BUILDING_TYPES = 6;

function isServedArea(county: ServedCounty): boolean {
    return SERVED_COUNTIES.includes(county as (typeof SERVED_COUNTIES)[number]);
}

function buildXiriOsUrl(params: {
    state: string;
    buildingTypeId: string;
    sqft: number;
    frequency: Frequency;
    estimate: number;
}) {
    const q = new URLSearchParams({
        source: 'xiri_ai_calculator',
        utm_source: 'xiri_ai',
        utm_medium: 'calculator',
        utm_campaign: 'contractor_monetization',
        state: params.state,
        buildingTypeId: params.buildingTypeId,
        sqft: String(params.sqft || 0),
        frequency: params.frequency,
        estimate: String(Math.round(params.estimate || 0)),
    });
    return `https://os.xiri.ai/app/login?mode=signup&${q.toString()}`;
}

function buildVendorOnboardingUrl(county: ServedCounty) {
    const q = new URLSearchParams({
        source: 'calculator_contractor_managed',
        trade: 'janitorial',
        zone: county === 'unknown' ? 'nassau' : county,
        state: 'NY',
    });
    return `/onboarding/start?${q.toString()}`;
}

interface UnifiedCalculatorProps {
    mode?: UnifiedCalculatorMode;
    onContractorCapture?: (payload: ContractorCapturePayload) => Promise<void> | void;
}

export function UnifiedCalculator({ mode = 'client', onContractorCapture }: UnifiedCalculatorProps) {
    const [buildingTypeId, setBuildingTypeId] = useState(DEFAULT_INPUTS.buildingTypeId);
    const [stateCode, setStateCode] = useState('NY');
    const [county, setCounty] = useState<ServedCounty>('unknown');
    const [sqft, setSqft] = useState(10000);
    const [frequency, setFrequency] = useState<Frequency>('5');

    const [rooms, setRooms] = useState<RoomScope[]>([]);
    const prevSqftRef = useRef(10000);
    const initializedSqftRef = useRef(false);

    const [showCaptureForm, setShowCaptureForm] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [captureError, setCaptureError] = useState('');
    const [captureSaving, setCaptureSaving] = useState(false);
    const [captureIntent, setCaptureIntent] = useState<'onboarding' | 'os' | null>(null);

    const safeSqft = Math.max(100, sqft || 0);

    useEffect(() => {
        setRooms(getDefaultRooms(buildingTypeId, safeSqft));
        initializedSqftRef.current = true;
        prevSqftRef.current = safeSqft;
    }, [buildingTypeId]);

    useEffect(() => {
        if (!initializedSqftRef.current || rooms.length === 0) {
            return;
        }
        const prev = prevSqftRef.current;
        if (prev <= 0 || prev === safeSqft) return;
        setRooms((prevRooms) => {
            const total = prevRooms.reduce((sum, r) => sum + (r.sqft || 0), 0);
            if (total <= 0) return prevRooms;
            return prevRooms.map((r) => ({
                ...r,
                sqft: Math.max(0, Math.round(((r.sqft || 0) / total) * safeSqft)),
            }));
        });
        prevSqftRef.current = safeSqft;
    }, [safeSqft, rooms.length]);

    const stateDefaults = useMemo(() => getStateDefaults(stateCode) ?? {}, [stateCode]);
    const inputs = useMemo(
        () => ({
            ...DEFAULT_INPUTS,
            ...stateDefaults,
            buildingTypeId,
            sqft: safeSqft,
            frequency,
        }),
        [stateDefaults, buildingTypeId, safeSqft, frequency]
    );

    const results = useMemo(() => calculate(inputs, rooms), [inputs, rooms]);
    const inArea = useMemo(() => isServedArea(county), [county]);
    const osUrl = useMemo(
        () =>
            buildXiriOsUrl({
                state: stateCode,
                buildingTypeId,
                sqft: safeSqft,
                frequency,
                estimate: results.totalPricePerMonth,
            }),
        [stateCode, buildingTypeId, safeSqft, frequency, results.totalPricePerMonth]
    );
    const onboardingUrl = useMemo(() => buildVendorOnboardingUrl(county), [county]);

    const capturePayload = useMemo<ContractorCapturePayload>(
        () => ({
            name: contactName.trim(),
            email: contactEmail.trim(),
            company: companyName.trim(),
            phone: contactPhone.trim(),
            state: stateCode,
            county,
            buildingTypeId,
            sqft: safeSqft,
            frequency,
            estimate: results.totalPricePerMonth,
            inArea,
            osUrl,
            onboardingUrl,
        }),
        [
            contactName,
            contactEmail,
            companyName,
            contactPhone,
            stateCode,
            county,
            buildingTypeId,
            safeSqft,
            frequency,
            results.totalPricePerMonth,
            inArea,
            osUrl,
            onboardingUrl,
        ]
    );

    const fmt = (n: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n || 0);

    const roomTotalSqft = useMemo(() => rooms.reduce((sum, r) => sum + (r.sqft || 0), 0), [rooms]);

    const setRoomSqft = (roomId: string, value: number) => {
        setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, sqft: Math.max(0, value) } : r)));
    };

    const toggleRoomTask = (roomId: string, taskId: string) => {
        setRooms((prev) =>
            prev.map((r) => {
                if (r.id !== roomId) return r;
                const has = r.tasks.includes(taskId);
                const nextTasks = has ? r.tasks.filter((t) => t !== taskId) : [...r.tasks, taskId];
                return { ...r, tasks: nextTasks };
            })
        );
    };

    const saveCapture = async (): Promise<boolean> => {
        if (!capturePayload.email) {
            setCaptureError('Email is required to continue.');
            return false;
        }
        setCaptureError('');
        try {
            setCaptureSaving(true);
            if (onContractorCapture) await onContractorCapture(capturePayload);
            return true;
        } catch {
            setCaptureError('Could not save your info. Please try again.');
            return false;
        } finally {
            setCaptureSaving(false);
        }
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Building Type</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {BUILDING_TYPES.slice(0, FEATURED_BUILDING_TYPES).map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => setBuildingTypeId(b.id)}
                                className={`rounded-xl border px-3 py-2 text-left text-sm flex items-center gap-2 min-h-14 ${
                                    buildingTypeId === b.id
                                        ? 'border-sky-500 bg-sky-50 text-sky-800'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-lg leading-none">{b.icon}</span>
                                <div className="font-medium">{b.name}</div>
                            </button>
                        ))}
                    </div>
                    {BUILDING_TYPES.length > FEATURED_BUILDING_TYPES && (
                        <div className="mt-3">
                            <label className="text-xs uppercase tracking-wide text-slate-500">More Building Types</label>
                            <select
                                value={buildingTypeId}
                                onChange={(e) => setBuildingTypeId(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                            >
                                {BUILDING_TYPES.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <h3 className="font-semibold text-slate-900">Size & Frequency</h3>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">State</label>
                        <select
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                        >
                            {STATES.map((s) => (
                                <option key={s.code} value={s.code}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">Square Footage</label>
                        <input
                            value={sqft ? sqft.toLocaleString('en-US') : ''}
                            onChange={(e) => setSqft(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-wide text-slate-500">Cleaning Frequency</label>
                        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                            {FREQUENCIES.filter((f) => f.group === 'recurring').map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => setFrequency(f.value)}
                                    className={`min-w-14 rounded-lg border px-3 py-2 text-sm whitespace-nowrap ${
                                        frequency === f.value
                                            ? 'border-sky-500 bg-sky-50 text-sky-800'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    {f.value}x
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === 'contractor' && (
                        <div>
                            <label className="text-xs uppercase tracking-wide text-slate-500">Your Service Area</label>
                            <select
                                value={county}
                                onChange={(e) => setCounty(e.target.value as ServedCounty)}
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                            >
                                <option value="unknown">Select county</option>
                                <option value="nassau">Nassau County, New York</option>
                                <option value="suffolk">Suffolk County, New York</option>
                                <option value="queens">Queens County, New York</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">Cleaning Scope</h3>
                        <span className="text-xs rounded-full bg-sky-100 text-sky-800 px-2 py-0.5">{rooms.length} rooms</span>
                    </div>
                    <div className="space-y-2">
                        {rooms.map((room) => {
                            const roomType = ROOM_TYPES.find((r) => r.id === room.roomTypeId);
                            const selectedTasks = CLEANING_TASKS.filter((t) => room.tasks.includes(t.id));
                            return (
                                <div key={room.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                                        <div className="flex items-start gap-2">
                                            <span className="mt-0.5 text-base leading-none">{roomType?.icon || '•'}</span>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{roomType?.name || room.roomTypeId}</p>
                                                <p className="text-xs text-slate-500">{room.tasks.length} tasks selected</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={(room.sqft || 0).toLocaleString('en-US')}
                                                onChange={(e) => setRoomSqft(room.id, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                                                className="w-24 rounded-lg border border-slate-300 bg-white h-9 px-2 text-sm text-right"
                                            />
                                            <span className="text-xs text-slate-500">sqft</span>
                                        </div>
                                    </div>
                                    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                                        <summary className="cursor-pointer list-none text-xs font-medium text-sky-700 flex items-center justify-between">
                                            <span>Smart Tasks</span>
                                            <span className="text-slate-500">{room.tasks.length} selected</span>
                                        </summary>
                                        <div className="mt-2 space-y-1 max-h-48 overflow-auto">
                                            {CLEANING_TASKS.map((task) => {
                                                const checked = room.tasks.includes(task.id);
                                                return (
                                                    <label key={task.id} className="flex items-center gap-2 px-1.5 py-1 text-sm text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleRoomTask(room.id, task.id)}
                                                        />
                                                        <span>{task.name}</span>
                                                    </label>
                                                );
                                            })}
                                            <div className="pt-2 border-t border-slate-100">
                                                <p className="text-xs text-slate-500">Selected:</p>
                                                <p className="text-xs text-slate-700">
                                                    {selectedTasks.map((t) => t.name).join(', ') || 'No tasks selected'}
                                                </p>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500 text-right">
                        Room total: {roomTotalSqft.toLocaleString('en-US')} / {safeSqft.toLocaleString('en-US')} sqft
                    </p>
                </section>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 h-fit xl:sticky xl:top-24">
                <h3 className="font-semibold text-slate-900">Bid Summary</h3>
                <div>
                    <p className="text-3xl font-bold text-sky-700">{fmt(results.totalPricePerMonth)}</p>
                    <p className="text-sm text-slate-500">/month</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Per Visit</p>
                        <p className="font-semibold">{fmt(results.pricePerVisit)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Visits / Mo</p>
                        <p className="font-semibold">{results.visitsPerMonth}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Hrs / Visit</p>
                        <p className="font-semibold">{results.hoursPerVisit.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-500">Per Sqft</p>
                        <p className="font-semibold">${results.pricePerSqft.toFixed(3)}</p>
                    </div>
                </div>

                {mode === 'contractor' ? (
                    <div className="space-y-2">
                        {!showCaptureForm ? (
                            <>
                                {inArea ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCaptureIntent('onboarding');
                                                setShowCaptureForm(true);
                                            }}
                                            className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800"
                                        >
                                            Continue To Vendor Onboarding
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCaptureIntent('os');
                                                setShowCaptureForm(true);
                                            }}
                                            className="block w-full text-center rounded-xl border border-sky-300 text-sky-700 font-semibold py-2.5 hover:bg-sky-50"
                                        >
                                            Save Bid & Create XIRI OS Account
                                        </button>
                                        <p className="text-xs text-slate-500">In Nassau, Suffolk, and Queens we can onboard you directly into our managed network.</p>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCaptureIntent('os');
                                            setShowCaptureForm(true);
                                        }}
                                        className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800"
                                    >
                                        Save Bid & Create XIRI OS Account
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Your info</p>
                                    <input
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        placeholder="Contact name"
                                        className="w-full rounded-lg border border-slate-300 bg-white h-9 px-3 text-sm"
                                    />
                                    <input
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="Company name"
                                        className="w-full rounded-lg border border-slate-300 bg-white h-9 px-3 text-sm"
                                    />
                                    <input
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        placeholder="Email *"
                                        className="w-full rounded-lg border border-slate-300 bg-white h-9 px-3 text-sm"
                                    />
                                    <input
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        placeholder="Phone"
                                        className="w-full rounded-lg border border-slate-300 bg-white h-9 px-3 text-sm"
                                    />
                                    {captureError && <p className="text-xs text-rose-600">{captureError}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (captureSaving) return;
                                        const ok = await saveCapture();
                                        if (!ok) return;
                                        window.location.href = captureIntent === 'onboarding' ? onboardingUrl : osUrl;
                                    }}
                                    className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800"
                                >
                                    {captureSaving
                                        ? 'Saving...'
                                        : captureIntent === 'onboarding'
                                          ? 'Continue To Vendor Onboarding'
                                          : 'Save Bid & Create XIRI OS Account'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (captureSaving) return;
                                        setShowCaptureForm(false);
                                        setCaptureIntent(null);
                                        setCaptureError('');
                                    }}
                                    className="block w-full text-center rounded-xl border border-slate-300 text-slate-700 font-semibold py-2.5 hover:bg-slate-50"
                                >
                                    Back
                                </button>
                                {!inArea && (
                                    <p className="text-xs text-slate-500">Outside our current managed-service area, continue in XIRI OS.</p>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <a href="/#audit" className="block w-full text-center rounded-xl bg-sky-700 text-white font-semibold py-2.5 hover:bg-sky-800">
                        Get Free Site Audit
                    </a>
                )}
            </aside>
        </div>
    );
}
