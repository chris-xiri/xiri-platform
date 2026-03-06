'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { trackEvent } from '@/lib/tracking';
import { STATE_WAGES, scaleRates, NY_MIN_WAGE } from '@/data/state-wages';
import {
    type FloorBreakdown,
    calculate,
    getCostTier,
    formatCurrency,
    FACILITY_LABELS,
    PRODUCTION_RATES,
    FLOOR_TYPES,
    SHIFT_OPTIONS,
    ADDON_OPTIONS,
    FIXTURE_MINUTES,
    MIN_HOURS,
    FREQUENCY_MULTIPLIERS,
    DEFAULT_FLOORS,
} from '@/lib/calculator';
import { Building, ShowerHead, Clock, Mail, Calculator, CheckCircle } from 'lucide-react';


// ─── Props ────────────────────────────────────────────────────────────
interface PublicCalculatorProps {
    /** 'client' shows client rate (what they pay), 'contractor' shows sub rate (what they earn) */
    mode?: 'client' | 'contractor';
}

// ─── Component ────────────────────────────────────────────────────────
export default function PublicCalculator({ mode = 'client' }: PublicCalculatorProps) {
    const isContractor = mode === 'contractor';

    // ─── Inputs ───────────────────────────────────────────────────────
    const [stateCode, setStateCode] = useState('NY');
    const [facilityType, setFacilityType] = useState('office_general');
    const [sqft, setSqft] = useState(0);
    const [daysPerWeek, setDaysPerWeek] = useState(5);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [floorMode, setFloorMode] = useState<'percent' | 'sqft'>('percent');
    const [floorBreakdown, setFloorBreakdown] = useState<FloorBreakdown[]>(DEFAULT_FLOORS);
    const [restroomFixtures, setRestroomFixtures] = useState(6);
    const [trashBins, setTrashBins] = useState(8);
    const [shift, setShift] = useState('afterHours');
    const [addOns, setAddOns] = useState<Record<string, boolean>>({
        kitchen: false, highTouchDisinfection: false, entryWayMats: false,
    });

    // ─── Email gate ───────────────────────────────────────────────────
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [email, setEmail] = useState('');
    const [emailName, setEmailName] = useState('');
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const [emailSubmitted, setEmailSubmitted] = useState(false);

    // ─── GA: track page view ──────────────────────────────────────────
    const tracked = useRef(false);
    useEffect(() => {
        if (!tracked.current) {
            trackEvent('calculator_view', { calculator_type: mode });
            tracked.current = true;
        }
    }, [mode]);

    // ─── Pricing from dashboard settings ──────────────────────────────
    const [configClientRate, setConfigClientRate] = useState<number | null>(null);
    const [configWagePremium, setConfigWagePremium] = useState<number | null>(null);
    useEffect(() => {
        async function loadPricingConfig() {
            try {
                const snap = await getDoc(doc(db, 'pricing_config', 'janitorial'));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data?.costStack?.clientRate) {
                        setConfigClientRate(data.costStack.clientRate);
                    }
                    if (data?.wagePremium) {
                        setConfigWagePremium(data.wagePremium);
                    }
                }
            } catch {
                // Fall back to hardcoded rates — no-op
            }
        }
        loadPricingConfig();
    }, []);

    // ─── Rate calculation ─────────────────────────────────────────────
    const stateWage = STATE_WAGES.find(s => s.code === stateCode)?.minWage || NY_MIN_WAGE;
    // Use dashboard wage premium if available, otherwise fall back to hardcoded
    const effectivePremium = configWagePremium || undefined;
    const scaledRates = scaleRates(stateWage, effectivePremium);
    // If dashboard pricing is available, use it as the NY baseline and scale proportionally
    const hourlyRate = useMemo(() => {
        if (isContractor) return scaledRates.subRate;
        if (configClientRate && configClientRate > 0) {
            // Scale the dashboard NY rate proportionally for other states
            const scale = stateWage / NY_MIN_WAGE;
            return Math.round(configClientRate * scale * 100) / 100;
        }
        return scaledRates.clientRate;
    }, [isContractor, configClientRate, scaledRates, stateWage]);
    const costTier = getCostTier(stateWage);

    // ─── Floor helpers ────────────────────────────────────────────────
    const toggleFloor = (type: string) => {
        setFloorBreakdown(prev => {
            if (prev.find(f => f.type === type)) return prev.filter(f => f.type !== type);
            return [...prev, { type, percent: 0 }];
        });
    };
    const updateFloor = (type: string, val: number) => {
        setFloorBreakdown(prev => prev.map(f => f.type === type ? { ...f, percent: val } : f));
    };

    const normalizedFloors = useMemo(() => {
        if (floorMode === 'percent') return floorBreakdown;
        const total = floorBreakdown.reduce((s, f) => s + f.percent, 0);
        if (total === 0) return floorBreakdown.map(f => ({ ...f, percent: 0 }));
        return floorBreakdown.map(f => ({ ...f, percent: (f.percent / total) * 100 }));
    }, [floorBreakdown, floorMode]);

    const effectiveFloors = showAdvanced ? normalizedFloors : DEFAULT_FLOORS;
    const effectiveFixtures = showAdvanced ? restroomFixtures : 6;
    const effectiveTrash = showAdvanced ? trashBins : 8;
    const effectiveShift = showAdvanced ? shift : 'afterHours';
    const effectiveAddOns = showAdvanced ? addOns : { kitchen: false, highTouchDisinfection: false, entryWayMats: false };

    // ─── Estimate ─────────────────────────────────────────────────────
    const estimate = useMemo(() => {
        if (sqft <= 0) return null;
        return calculate(hourlyRate, facilityType, sqft, effectiveFloors, effectiveFixtures, effectiveTrash, daysPerWeek, effectiveShift, effectiveAddOns);
    }, [hourlyRate, facilityType, sqft, effectiveFloors, effectiveFixtures, effectiveTrash, daysPerWeek, effectiveShift, effectiveAddOns]);

    // ─── GA: track estimate ───────────────────────────────────────────
    const lastTrackedEstimate = useRef<string>('');
    useEffect(() => {
        if (!estimate) return;
        const key = `${stateCode}-${facilityType}-${sqft}-${daysPerWeek}-${estimate.monthly.mid}`;
        if (key === lastTrackedEstimate.current) return;
        lastTrackedEstimate.current = key;
        trackEvent('calculator_estimate', {
            calculator_type: mode,
            state: stateCode,
            facility_type: facilityType,
            sqft,
            days_per_week: daysPerWeek,
            monthly_estimate: estimate.monthly.mid,
            advanced_mode: showAdvanced,
        });
    }, [estimate, stateCode, facilityType, sqft, daysPerWeek, mode, showAdvanced]);

    // ─── Email submission ─────────────────────────────────────────────
    const handleEmailSubmit = async () => {
        if (!email || !estimate) return;
        setEmailSubmitting(true);
        try {
            const collectionName = isContractor ? 'vendors' : 'leads';
            const docData = isContractor ? {
                status: 'new',
                source: 'calculator_contractor',
                email,
                name: emailName || '',
                calculatorData: {
                    state: stateCode,
                    facilityType,
                    sqft,
                    daysPerWeek,
                    monthlyEstimate: estimate.monthly.mid,
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            } : {
                source: 'calculator_client',
                status: 'new',
                email,
                name: emailName || '',
                facilityType,
                sqft: String(sqft),
                state: stateCode,
                calculatorData: {
                    daysPerWeek,
                    monthlyEstimate: estimate.monthly.mid,
                    monthlyLow: estimate.monthly.low,
                    monthlyHigh: estimate.monthly.high,
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const docRef = await addDoc(collection(db, collectionName), docData);
            // Auto-generate activity note for client leads
            if (!isContractor) {
                const facilityLabel = FACILITY_LABELS[facilityType] || facilityType;
                const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
                await addDoc(collection(db, 'lead_activities'), {
                    leadId: docRef.id,
                    type: 'calculator_estimate',
                    source: 'system',
                    note: `Calculator estimate: ${Number(sqft).toLocaleString()} sqft ${facilityLabel}, ${daysPerWeek}x/week, ${fmtNum(estimate.monthly.low)}–${fmtNum(estimate.monthly.high)}/mo (${stateCode}). Source: public calculator.`,
                    createdAt: serverTimestamp(),
                });
            }
            trackEvent('calculator_email_submit', { calculator_type: mode, state: stateCode, facility_type: facilityType });
            setEmailSubmitted(true);
        } catch (err) {
            console.error('Failed to save lead:', err);
        }
        setEmailSubmitting(false);
    };

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
    const totalPct = floorBreakdown.reduce((s, f) => s + f.percent, 0);

    return (
        <div className="space-y-6">
            {/* ═══ SIMPLE MODE ═══ */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                {/* State + Cost Tier */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Your State</label>
                        <select
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                            className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                        >
                            {STATE_WAGES.map(s => (
                                <option key={s.code} value={s.code}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium">Labor Market</p>
                        <p className="text-lg font-bold text-slate-900">{costTier}</p>
                        <p className="text-xs text-slate-400">{STATE_WAGES.find(s => s.code === stateCode)?.name}</p>
                    </div>
                </div>

                {/* Facility Type + Sqft */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Facility Type</label>
                        <select
                            value={facilityType}
                            onChange={(e) => setFacilityType(e.target.value)}
                            className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-sky-500 transition-shadow"
                        >
                            {Object.entries(FACILITY_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Square Footage</label>
                        <input
                            type="number"
                            value={sqft || ''}
                            onChange={(e) => setSqft(parseInt(e.target.value) || 0)}
                            placeholder="e.g. 10,000"
                            className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-sky-500 transition-shadow"
                        />
                    </div>
                </div>

                {/* Frequency */}
                <div>
                    <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Cleaning Frequency</label>
                    <div className="flex flex-wrap gap-2">
                        {[{ d: 7, label: '7x' }, { d: 6, label: '6x' }, { d: 5, label: '5x' }, { d: 4, label: '4x' }, { d: 3, label: '3x' }, { d: 2, label: '2x' }, { d: 1, label: '1x' }].map(({ d, label }) => (
                            <button
                                key={d}
                                onClick={() => setDaysPerWeek(d)}
                                className={`h-11 px-4 rounded-xl text-sm font-semibold transition-all ${daysPerWeek === d
                                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {label}<span className="text-xs font-normal opacity-70">/wk</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                        {daysPerWeek === 7 ? 'Nightly — recommended for medical & high-traffic facilities' :
                            daysPerWeek >= 5 ? 'Standard for most commercial spaces' :
                                daysPerWeek >= 3 ? 'Common for low-traffic offices' :
                                    'Weekly — best for small or low-traffic spaces'}
                    </p>
                </div>
            </div>

            {/* ═══ ADVANCED TOGGLE ═══ */}
            <button
                onClick={() => {
                    setShowAdvanced(!showAdvanced);
                    trackEvent('calculator_advanced_toggle', { opened: !showAdvanced ? 'true' : 'false', calculator_type: mode });
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
                {!showAdvanced && <span className="text-xs text-slate-400 font-normal">(floor types, fixtures, shift, add-ons)</span>}
            </button>

            {/* ═══ ADVANCED OPTIONS ═══ */}
            {showAdvanced && (
                <div className="space-y-4">
                    {/* Floor Breakdown */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-lg"><Building className="w-5 h-5 inline" /></span> Floor Breakdown
                            </h3>
                            <button
                                onClick={() => {
                                    if (floorMode === 'percent' && sqft > 0) {
                                        // Convert % → sqft
                                        setFloorBreakdown(prev => prev.map(f => ({
                                            ...f,
                                            percent: Math.round(f.percent * sqft / 100),
                                        })));
                                    } else if (floorMode === 'sqft') {
                                        // Convert sqft → %
                                        const totalSqft = floorBreakdown.reduce((s, f) => s + f.percent, 0);
                                        if (totalSqft > 0) {
                                            setFloorBreakdown(prev => prev.map(f => ({
                                                ...f,
                                                percent: Math.round((f.percent / totalSqft) * 100),
                                            })));
                                        }
                                    }
                                    setFloorMode(floorMode === 'percent' ? 'sqft' : 'percent');
                                }}
                                className="text-xs text-sky-600 hover:underline font-medium"
                            >
                                {floorMode === 'percent' ? 'Switch to sqft' : 'Switch to %'}
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {FLOOR_TYPES.map(ft => {
                                const entry = floorBreakdown.find(f => f.type === ft.key);
                                const isActive = !!entry;
                                return (
                                    <div key={ft.key} className="space-y-1.5">
                                        <div className="relative group">
                                            <button
                                                onClick={() => toggleFloor(ft.key)}
                                                className={`w-full text-center text-xs px-2 py-2 rounded-xl transition-all font-medium ${isActive
                                                    ? 'bg-sky-100 text-sky-700 border border-sky-300 shadow-sm'
                                                    : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-300'
                                                    }`}
                                            >
                                                {ft.label}
                                            </button>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 p-3 bg-slate-900 text-white rounded-lg shadow-xl text-xs">
                                                <p className="font-semibold text-sky-300">{ft.method}</p>
                                                <p className="text-slate-300 mt-1">Includes: {ft.includes}</p>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45"></div>
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full h-9 rounded-xl border border-slate-300 bg-white pl-2 pr-8 text-xs text-center focus:ring-2 focus:ring-sky-500"
                                                    value={entry!.percent || ''}
                                                    onChange={(e) => updateFloor(ft.key, parseInt(e.target.value) || 0)}
                                                    placeholder={floorMode === 'percent' ? '0' : '0'}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium pointer-events-none">
                                                    {floorMode === 'percent' ? '%' : 'sqft'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {floorMode === 'percent' ? (
                            <p className={`text-xs mt-2 ${totalPct === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                                Total: {totalPct}%{totalPct !== 100 && ' (should equal 100%)'}
                            </p>
                        ) : (
                            <p className={`text-xs mt-2 ${totalPct === sqft ? 'text-green-600' : totalPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                Total: {totalPct.toLocaleString()} sqft{sqft > 0 && totalPct !== sqft && ` of ${sqft.toLocaleString()} sqft`}{sqft > 0 && totalPct === sqft && ' ✓'}
                            </p>
                        )}
                    </div>

                    {/* Fixtures + Shift */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-lg"><ShowerHead className="w-5 h-5 inline" /></span> Fixtures
                            </h3>
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1">
                                    Restroom Fixtures <span className="opacity-60">(3 min each)</span>
                                </label>
                                <input type="number" value={restroomFixtures || ''} onChange={(e) => setRestroomFixtures(parseInt(e.target.value) || 0)}
                                    placeholder="toilets + sinks + urinals"
                                    className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-sky-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1">
                                    Trash Bins <span className="opacity-60">(1 min each)</span>
                                </label>
                                <input type="number" value={trashBins || ''} onChange={(e) => setTrashBins(parseInt(e.target.value) || 0)}
                                    className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-sky-500" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-lg"><Clock className="w-5 h-5 inline" /></span> Shift Timing
                            </h3>
                            <div className="space-y-2">
                                {SHIFT_OPTIONS.map(s => (
                                    <button key={s.key} onClick={() => setShift(s.key)}
                                        className={`w-full h-10 rounded-xl text-sm font-medium transition-all flex items-center justify-between px-4 ${shift === s.key
                                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}>
                                        <span>{s.label}</span>
                                        {s.modifier > 1 && (
                                            <span className={`text-xs ${shift === s.key ? 'text-sky-200' : 'text-slate-400'}`}>+{Math.round((s.modifier - 1) * 100)}%</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Add-ons */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <span className="text-lg">➕</span> Add-on Services
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {ADDON_OPTIONS.map(a => (
                                <button key={a.key} onClick={() => setAddOns(prev => ({ ...prev, [a.key]: !prev[a.key] }))}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${addOns[a.key]
                                        ? 'bg-sky-100 text-sky-700 border-sky-300 shadow-sm'
                                        : 'bg-slate-100 text-slate-600 border-transparent hover:border-slate-300'
                                        }`}>
                                    {addOns[a.key] ? '✓ ' : ''}{a.label}
                                    <span className="opacity-60 ml-1">+{Math.round(a.modifier * 100)}%</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ESTIMATE RESULT ═══ */}
            {estimate && sqft > 0 ? (
                <div className={`rounded-2xl p-8 text-white shadow-xl ${isContractor
                    ? 'bg-gradient-to-br from-emerald-600 to-emerald-800'
                    : 'bg-gradient-to-br from-sky-600 to-sky-800'
                    }`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">
                            {isContractor ? 'Estimated Earnings' : 'Your Estimate'}
                        </h3>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">±20% accuracy</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white/10 rounded-xl p-4 text-center backdrop-blur-sm">
                            <p className={`text-xs font-medium ${isContractor ? 'text-emerald-200' : 'text-sky-200'}`}>
                                {isContractor ? 'Per Visit' : 'Per Visit'}
                            </p>
                            <p className="text-2xl font-bold mt-1">{fmt(estimate.perVisit)}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 text-center backdrop-blur-sm">
                            <p className={`text-xs font-medium ${isContractor ? 'text-emerald-200' : 'text-sky-200'}`}>Visits / Month</p>
                            <p className="text-2xl font-bold mt-1">{estimate.daysPerMonth}</p>
                            <p className={`text-[10px] ${isContractor ? 'text-emerald-300' : 'text-sky-300'}`}>{daysPerWeek}x/wk × 4.33</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 text-center backdrop-blur-sm">
                            <p className={`text-xs font-medium ${isContractor ? 'text-emerald-200' : 'text-sky-200'}`}>
                                {isContractor ? 'Annual Earnings' : 'Annual Estimate'}
                            </p>
                            <p className="text-2xl font-bold mt-1">{fmt(estimate.monthly.mid * 12)}</p>
                        </div>
                    </div>

                    {/* Monthly total */}
                    <div className="bg-white rounded-2xl p-6 text-center text-slate-900">
                        <p className="text-sm text-slate-500 mb-1">
                            {isContractor ? 'Estimated Monthly Earnings' : 'Estimated Monthly Cost'}
                        </p>
                        <p className="text-4xl font-bold">
                            {fmt(estimate.monthly.low)} – {fmt(estimate.monthly.high)}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                            Mid-point: <span className="font-bold text-slate-900">{fmt(estimate.monthly.mid)}/mo</span>
                        </p>
                        {stateCode !== 'NY' && (
                            <p className="text-xs text-slate-400 mt-2">
                                Adjusted for {STATE_WAGES.find(s => s.code === stateCode)?.name} ({costTier.toLowerCase()})
                            </p>
                        )}
                        {!showAdvanced && (
                            <p className="text-xs text-slate-400 mt-2">
                                <button onClick={() => setShowAdvanced(true)} className="text-sky-600 hover:underline font-medium">
                                    Refine this estimate →
                                </button>{' '}
                                Add floor types, fixtures, and shift details.
                            </p>
                        )}
                    </div>

                    {/* ─── Soft Gate: Email CTA ─── */}
                    <div className="mt-6 text-center space-y-3">
                        <button
                            onClick={() => {
                                setShowEmailModal(true);
                                trackEvent('calculator_cta_click', { cta: 'email_breakdown', calculator_type: mode });
                            }}
                            className={`inline-block px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg ${isContractor
                                ? 'bg-white text-emerald-700 hover:bg-emerald-50'
                                : 'bg-white text-sky-700 hover:bg-sky-50'
                                }`}
                        >
                            <Mail className="w-5 h-5 inline mr-1" /> Email Me a Detailed Breakdown
                        </button>
                        <p className={`text-xs ${isContractor ? 'text-emerald-200' : 'text-sky-200'}`}>
                            Includes per-sqft costs, frequency comparison, and {isContractor ? 'bidding tips' : 'industry benchmarks'}.
                        </p>

                        {/* Secondary CTA */}
                        <div className="pt-2">
                            <a
                                href={isContractor ? '/contractors' : '/#audit'}
                                onClick={() => trackEvent('calculator_cta_click', { cta: isContractor ? 'join_network' : 'get_quote', calculator_type: mode })}
                                className="text-sm font-semibold underline underline-offset-4 text-white/80 hover:text-white transition-colors"
                            >
                                {isContractor ? 'See Available Jobs in Your Area →' : 'Or get a custom quote with a free site walkthrough →'}
                            </a>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="text-4xl mb-3"><Calculator className="w-10 h-10 mx-auto text-slate-400" /></div>
                    <p className="text-slate-500 font-medium">Enter your square footage above to see an instant estimate</p>
                    <p className="text-slate-400 text-sm mt-1">Results update in real-time as you adjust inputs</p>
                </div>
            )}

            {/* ═══ EMAIL MODAL ═══ */}
            {showEmailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !emailSubmitting && setShowEmailModal(false)}>
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {emailSubmitted ? (
                            <div className="text-center">
                                <div className="text-5xl mb-4"><CheckCircle className="w-12 h-12 mx-auto text-emerald-500" /></div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">You&apos;re all set!</h3>
                                <p className="text-slate-600 text-sm mb-6">
                                    We&apos;ll send your detailed breakdown to <strong>{email}</strong>.
                                    {isContractor
                                        ? ' Check your inbox for bidding tips and available jobs in your area.'
                                        : ' A specialist may also reach out to help you finalize your scope.'}
                                </p>
                                <button onClick={() => setShowEmailModal(false)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors">
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-slate-900 mb-1"><Mail className="w-5 h-5 inline mr-1" /> Get Your Detailed Breakdown</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    We&apos;ll email you a complete breakdown including per-sqft analysis,
                                    frequency comparison, and {isContractor ? 'what similar jobs are paying in your area' : 'how your facility compares to industry averages'}.
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1">Name (optional)</label>
                                        <input
                                            type="text"
                                            value={emailName}
                                            onChange={(e) => setEmailName(e.target.value)}
                                            placeholder="Your name"
                                            className="w-full h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 font-medium mb-1">Email *</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@company.com"
                                            required
                                            className="w-full h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleEmailSubmit}
                                        disabled={!email || emailSubmitting}
                                        className="w-full h-12 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {emailSubmitting ? 'Sending...' : 'Send My Breakdown'}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 text-center mt-3">
                                    No spam. Just your estimate breakdown.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
