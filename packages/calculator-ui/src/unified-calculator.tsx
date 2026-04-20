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

function isServedArea(state: string, county: ServedCounty): boolean {
    return state === 'NY' && SERVED_COUNTIES.includes(county as (typeof SERVED_COUNTIES)[number]);
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

interface WizardParsedValues {
    buildingTypeId?: string;
    stateCode?: string;
    county?: ServedCounty;
    sqft?: number;
    frequency?: Frequency;
    productionRate?: number;
}

function parseWizardPrompt(prompt: string): WizardParsedValues {
    const text = prompt.toLowerCase();
    const out: WizardParsedValues = {};

    // Building type
    for (const bt of BUILDING_TYPES) {
        const name = bt.name.toLowerCase();
        const compact = name.replace(/[^a-z0-9]/g, '');
        if (text.includes(name) || text.includes(compact)) {
            out.buildingTypeId = bt.id;
            break;
        }
        const keyWords = name.split(/[\/\s]+/).filter((w) => w.length > 3);
        if (keyWords.some((w) => text.includes(w))) {
            out.buildingTypeId = bt.id;
            break;
        }
    }

    // State
    for (const s of STATES) {
        const codePattern = new RegExp(`\\b${s.code.toLowerCase()}\\b`, 'i');
        if (text.includes(s.name.toLowerCase()) || codePattern.test(text)) {
            out.stateCode = s.code;
            break;
        }
    }

    // County (NY service-area logic)
    if (text.includes('nassau')) out.county = 'nassau';
    else if (text.includes('suffolk')) out.county = 'suffolk';
    else if (text.includes('queens')) out.county = 'queens';
    else if (text.includes('other')) out.county = 'other';
    if ((out.county === 'nassau' || out.county === 'suffolk' || out.county === 'queens') && !out.stateCode) {
        out.stateCode = 'NY';
    }

    // Square footage
    const sqftMatch =
        text.match(/(\d[\d,]*)\s*(sq\s*ft|sqft|square\s*feet|square\s*foot|sf)\b/i) ||
        text.match(/(\d[\d,]*)\s*(k)\s*(sq\s*ft|sqft|square\s*feet|square\s*foot|sf)\b/i) ||
        text.match(/\b(\d{3,6})\b/);
    if (sqftMatch?.[1]) {
        const parsed = Number(sqftMatch[1].replace(/,/g, '')) * (sqftMatch?.[2] === 'k' ? 1000 : 1);
        if (Number.isFinite(parsed) && parsed >= 100) out.sqft = parsed;
    }

    // Frequency
    if (text.includes('one-time') || text.includes('one time') || text.includes('deep clean')) out.frequency = 'once';
    else {
        const fx = text.match(/\b([1-7])\s*x\b/);
        if (fx?.[1]) out.frequency = fx[1] as Frequency;
        else if (text.includes('daily')) out.frequency = '7';
        else if (text.includes('weekdays')) out.frequency = '5';
        else if (text.includes('weekly')) out.frequency = '1';
    }

    // Production rate override
    const prMatch = text.match(/production\s*rate[^\d]{0,10}(\d[\d,]*)/i) || text.match(/(\d[\d,]*)\s*(sqft\/hr|sqft per hour)/i);
    if (prMatch?.[1]) {
        const parsed = Number(prMatch[1].replace(/,/g, ''));
        if (Number.isFinite(parsed) && parsed > 0) out.productionRate = parsed;
    }

    return out;
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
    const [showAdvancedProduction, setShowAdvancedProduction] = useState(false);
    const [useProductionOverride, setUseProductionOverride] = useState(false);
    const [productionRateOverride, setProductionRateOverride] = useState<number>(0);
    const [showAdvancedTaskRates, setShowAdvancedTaskRates] = useState(false);
    const [taskRateOverrides, setTaskRateOverrides] = useState<Record<string, number>>({});
    const [wizardPrompt, setWizardPrompt] = useState('');
    const [wizardStatus, setWizardStatus] = useState('');
    const [wizardNudges, setWizardNudges] = useState<string[]>([]);
    const [showStickySummary, setShowStickySummary] = useState(false);

    const safeSqft = Math.max(100, sqft || 0);
    const selectedBuildingType = useMemo(
        () => BUILDING_TYPES.find((b) => b.id === buildingTypeId) ?? BUILDING_TYPES[0],
        [buildingTypeId]
    );

    useEffect(() => {
        setRooms(getDefaultRooms(buildingTypeId, safeSqft));
        initializedSqftRef.current = true;
        prevSqftRef.current = safeSqft;
        if (!useProductionOverride) {
            setProductionRateOverride(selectedBuildingType.productionRate);
        }
    }, [buildingTypeId, safeSqft, selectedBuildingType.productionRate, useProductionOverride]);

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

    useEffect(() => {
        const onScroll = () => setShowStickySummary(window.scrollY > 280);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const stateDefaults = useMemo(() => getStateDefaults(stateCode) ?? {}, [stateCode]);
    const hasTaskRateOverrides = useMemo(
        () => Object.values(taskRateOverrides).some((v) => Number.isFinite(v) && v > 0),
        [taskRateOverrides]
    );
    const inputs = useMemo(
        () => ({
            ...DEFAULT_INPUTS,
            ...stateDefaults,
            buildingTypeId,
            sqft: safeSqft,
            frequency,
            productionRateOverride: useProductionOverride && productionRateOverride > 0 ? productionRateOverride : undefined,
            taskMinutesPer1kOverrides: hasTaskRateOverrides ? taskRateOverrides : undefined,
        }),
        [stateDefaults, buildingTypeId, safeSqft, frequency, useProductionOverride, productionRateOverride, hasTaskRateOverrides, taskRateOverrides]
    );

    const results = useMemo(() => calculate(inputs, rooms), [inputs, rooms]);
    const inArea = useMemo(() => isServedArea(stateCode, county), [stateCode, county]);
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

    const applyWizardPrompt = () => {
        const parsed = parseWizardPrompt(wizardPrompt);
        let updates = 0;
        const missing: string[] = [];
        if (parsed.buildingTypeId) {
            setBuildingTypeId(parsed.buildingTypeId);
            updates++;
        } else {
            missing.push('building type');
        }
        if (parsed.stateCode) {
            setStateCode(parsed.stateCode);
            if (parsed.stateCode !== 'NY') setCounty('unknown');
            updates++;
        } else {
            missing.push('state');
        }
        const resolvedState = parsed.stateCode ?? stateCode;
        if (parsed.county && resolvedState === 'NY') {
            setCounty(parsed.county);
            updates++;
        }
        if (parsed.sqft) {
            setSqft(parsed.sqft);
            updates++;
        } else {
            missing.push('square footage');
        }
        if (parsed.frequency) {
            setFrequency(parsed.frequency);
            updates++;
        } else {
            missing.push('cleaning frequency');
        }
        if (parsed.productionRate) {
            setUseProductionOverride(true);
            setShowAdvancedProduction(true);
            setProductionRateOverride(parsed.productionRate);
            updates++;
        }

        if (updates > 0) {
            setWizardStatus(`Great start. I updated ${updates} field${updates > 1 ? 's' : ''}.`);
            const nudgePool: string[] = [];
            if (missing.includes('building type')) {
                nudgePool.push('What type of building is it? (office, medical, school, retail...)');
            }
            if (missing.includes('state')) {
                nudgePool.push('What state is the facility in?');
            }
            if (missing.includes('square footage')) {
                nudgePool.push('Approximately how many square feet is the facility?');
            }
            if (missing.includes('cleaning frequency')) {
                nudgePool.push('How often should it be cleaned? (example: 5x/week)');
            }
            setWizardNudges(nudgePool.slice(0, 3));
        } else {
            setWizardStatus('I can help fill this out. Give me a little more detail and I’ll do the rest.');
            setWizardNudges([
                'Tell me your building type and square footage.',
                'Add the state and cleaning frequency (like 3x/week or daily).',
                'Optional: include a target production rate in sqft/hour.',
            ]);
        }
    };

    const setTaskRateOverride = (taskId: string, value: number) => {
        setTaskRateOverrides((prev) => ({
            ...prev,
            [taskId]: Math.max(0, value),
        }));
    };

    return (
        <>
            {showStickySummary && (
                <div className="fixed top-[84px] left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                    <div className="rounded-xl border border-sky-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-slate-600">Live Bid Summary</div>
                            <div className="text-sm sm:text-base font-semibold text-sky-700">
                                {fmt(results.totalPricePerMonth)} <span className="text-slate-500 font-normal">/month</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                    <h3 className="font-semibold text-slate-900">AI Wizard</h3>
                    <p className="text-xs text-slate-500">Describe what you know. I’ll fill what I can and ask for only what’s missing.</p>
                    <textarea
                        value={wizardPrompt}
                        onChange={(e) => setWizardPrompt(e.target.value)}
                        placeholder="Example: 12,000 sqft medical clinic in Queens, New York, cleaned 5x/week, production rate 3200 sqft/hr."
                        className="w-full rounded-xl border border-slate-300 bg-white min-h-24 px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={applyWizardPrompt}
                            className="rounded-lg bg-sky-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-sky-800"
                        >
                            Auto-Fill With AI
                        </button>
                        {wizardStatus && <p className="text-xs text-slate-600">{wizardStatus}</p>}
                    </div>
                    {wizardNudges.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {wizardNudges.map((nudge) => (
                                <button
                                    key={nudge}
                                    type="button"
                                    onClick={() => setWizardPrompt((prev) => (prev ? `${prev}\n${nudge}` : nudge))}
                                    className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
                                >
                                    {nudge}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Building Type</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
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
                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                            <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center justify-between">
                                <span>More building types</span>
                                <span aria-hidden className="text-slate-500">▾</span>
                            </summary>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                {BUILDING_TYPES.slice(FEATURED_BUILDING_TYPES).map((b) => (
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
                        </details>
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

                    {mode === 'contractor' && stateCode === 'NY' && (
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
                                        <summary className="cursor-pointer text-xs font-medium text-sky-700 flex items-center justify-between">
                                            <span>Task Checklist</span>
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <span>{room.tasks.length} selected</span>
                                                <span aria-hidden>▾</span>
                                            </span>
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

                <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">Production Rate</h3>
                        <button
                            type="button"
                            onClick={() => setShowAdvancedProduction((v) => !v)}
                            className="text-xs font-medium text-sky-700 hover:text-sky-800"
                        >
                            {showAdvancedProduction ? 'Hide Advanced' : 'Show Advanced'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-600">
                        Default uses ISSA standard for <span className="font-medium">{selectedBuildingType.name}</span>:
                        <span className="font-semibold"> {selectedBuildingType.productionRate.toLocaleString('en-US')} sqft/hr</span>
                    </p>
                    {showAdvancedProduction && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={useProductionOverride}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setUseProductionOverride(checked);
                                        if (!checked) setProductionRateOverride(selectedBuildingType.productionRate);
                                    }}
                                />
                                Use custom production rate
                            </label>
                            {useProductionOverride && (
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Custom Production Rate (sqft/hour)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={productionRateOverride ? productionRateOverride.toLocaleString('en-US') : ''}
                                        onChange={(e) =>
                                            setProductionRateOverride(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)
                                        }
                                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white h-10 px-3 text-sm"
                                    />
                                </div>
                            )}
                            <div className="pt-1 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedTaskRates((v) => !v)}
                                    className="text-sm font-medium text-sky-700 hover:text-sky-800"
                                >
                                    {showAdvancedTaskRates ? 'Hide Task-Level ISSA Overrides' : 'Show Task-Level ISSA Overrides'}
                                </button>
                                <p className="mt-1 text-xs text-slate-500">
                                    Optional: override minutes per 1,000 sqft per task. Leave blank to use ISSA defaults.
                                </p>
                            </div>
                            {showAdvancedTaskRates && (
                                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Task-level rates (min / 1,000 sqft)</p>
                                        <button
                                            type="button"
                                            onClick={() => setTaskRateOverrides({})}
                                            className="text-xs font-medium text-slate-600 hover:text-slate-800"
                                        >
                                            Reset to ISSA defaults
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                                        {CLEANING_TASKS.map((task) => (
                                            <div key={task.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px] gap-2 items-center rounded-lg border border-slate-100 p-2">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{task.name}</p>
                                                    <p className="text-xs text-slate-500">Default ISSA: {task.minutesPer1kSqft} min / 1k sqft</p>
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={taskRateOverrides[task.id] ? String(taskRateOverrides[task.id]) : ''}
                                                    onChange={(e) => {
                                                        const parsed = Number(e.target.value.replace(/[^0-9.]/g, ''));
                                                        setTaskRateOverride(task.id, Number.isFinite(parsed) ? parsed : 0);
                                                    }}
                                                    placeholder={String(task.minutesPer1kSqft)}
                                                    className="w-full rounded-lg border border-slate-300 bg-white h-9 px-2.5 text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 h-fit lg:sticky lg:top-24">
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
                                            Save Bid & Create xiriOS account
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
                                        Save Bid & Create xiriOS account
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
                                          : 'Save Bid & Create xiriOS account'}
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
        </>
    );
}
