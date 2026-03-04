'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Calculator, ArrowRight } from 'lucide-react';
import {
    PricingConfig,
    DEFAULT_PRICING_CONFIG,
    FloorBreakdown,
    EstimateParams,
    EstimateResult,
    calculateJanitorialEstimate,
    FLOOR_TYPE_LABELS,
    FLOOR_TYPE_INFO,
    SHIFT_LABELS,
    ADD_ON_LABELS,
} from '@/data/janitorialPricing';
import type { FacilityType } from '@xiri/shared';

// ─── Facility type labels for the dropdown ───────────────────────────
const FACILITY_LABELS: Record<string, string> = {
    office_general: 'Office (General)',
    medical_private: 'Medical (Private Practice)',
    medical_dental: 'Medical (Dental)',
    medical_veterinary: 'Medical (Veterinary)',
    medical_urgent_care: 'Medical (Urgent Care)',
    medical_surgery: 'Medical (Surgery Center)',
    medical_dialysis: 'Medical (Dialysis)',
    auto_dealer_showroom: 'Auto (Showroom)',
    auto_service_center: 'Auto (Service Center)',
    edu_daycare: 'Education (Daycare)',
    edu_private_school: 'Education (Private School)',
    fitness_gym: 'Fitness / Gym',
    retail_storefront: 'Retail Storefront',
    lab_cleanroom: 'Lab (Cleanroom)',
    lab_bsl: 'Lab (BSL)',
    manufacturing_light: 'Manufacturing (Light)',
    other: 'Other',
};

interface JanitorialPricingCalcProps {
    facilityType?: string;
    initialSqft?: number;
    onApplyRate: (rate: number, sqft: number) => void;
}

export default function JanitorialPricingCalc({
    facilityType: initialFacilityType,
    initialSqft,
    onApplyRate,
}: JanitorialPricingCalcProps) {
    const [expanded, setExpanded] = useState(false);
    const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);

    // ─── Calculator inputs ───────────────────────────────────────────
    const [facilityType, setFacilityType] = useState(initialFacilityType || 'other');
    const [sqft, setSqft] = useState(initialSqft || 0);
    const [floorMode, setFloorMode] = useState<'percent' | 'sqft'>('percent');
    const [floorBreakdown, setFloorBreakdown] = useState<FloorBreakdown[]>([
        { type: 'carpet', percent: 50 },
        { type: 'resilient', percent: 40 },
        { type: 'tileStone', percent: 10 },
    ]);
    const [restroomFixtures, setRestroomFixtures] = useState(6);
    const [trashBins, setTrashBins] = useState(8);
    const [daysPerWeek, setDaysPerWeek] = useState(5);
    const [shift, setShift] = useState('afterHours');
    const [addOns, setAddOns] = useState<Record<string, boolean>>({
        kitchen: false,
        highTouchDisinfection: false,
        entryWayMats: false,
    });

    // ─── Load config from Firestore ──────────────────────────────────
    useEffect(() => {
        async function loadConfig() {
            try {
                const snap = await getDoc(doc(db, 'pricing_config', 'janitorial'));
                if (snap.exists()) {
                    setConfig(snap.data() as PricingConfig);
                }
            } catch (err) {
                console.warn('Failed to load pricing config, using defaults');
            }
        }
        loadConfig();
    }, []);

    // Sync with props when they change
    useEffect(() => {
        if (initialFacilityType) setFacilityType(initialFacilityType);
    }, [initialFacilityType]);

    useEffect(() => {
        if (initialSqft && initialSqft > 0) setSqft(initialSqft);
    }, [initialSqft]);

    // ─── Floor breakdown helpers ─────────────────────────────────────
    const updateFloorType = (type: string, value: number) => {
        setFloorBreakdown(prev =>
            prev.map(f => f.type === type ? { ...f, percent: value } : f)
        );
    };

    const toggleFloorType = (type: string) => {
        setFloorBreakdown(prev => {
            const exists = prev.find(f => f.type === type);
            if (exists) {
                return prev.filter(f => f.type !== type);
            }
            return [...prev, { type, percent: 0 }];
        });
    };

    // Convert sqft values to percents for calculation
    const normalizedFloorBreakdown = useMemo(() => {
        if (floorMode === 'percent') return floorBreakdown;
        // In sqft mode, convert to percents
        const totalSqft = floorBreakdown.reduce((s, f) => s + f.percent, 0); // "percent" field holds sqft in sqft mode
        if (totalSqft === 0) return floorBreakdown.map(f => ({ ...f, percent: 0 }));
        return floorBreakdown.map(f => ({
            ...f,
            percent: (f.percent / totalSqft) * 100,
        }));
    }, [floorBreakdown, floorMode]);

    // ─── Calculate estimate ──────────────────────────────────────────
    const estimate = useMemo<EstimateResult | null>(() => {
        if (sqft <= 0) return null;

        const params: EstimateParams = {
            facilityType,
            sqft,
            floorBreakdown: normalizedFloorBreakdown,
            restroomFixtures,
            trashBins,
            daysPerWeek,
            shift,
            addOns,
        };

        return calculateJanitorialEstimate(config, params);
    }, [config, facilityType, sqft, normalizedFloorBreakdown, restroomFixtures, trashBins, daysPerWeek, shift, addOns]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    // ─── Collapsed preview ───────────────────────────────────────────
    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-md hover:bg-muted/50"
            >
                <Calculator className="w-3.5 h-3.5" />
                <span>Quick Estimate Calculator</span>
                {estimate && (
                    <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                        ~{formatCurrency(estimate.monthly.mid)}/mo
                    </Badge>
                )}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </button>
        );
    }

    // ─── Expanded calculator ─────────────────────────────────────────
    return (
        <div className="border rounded-lg bg-muted/30 mt-2 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <span>Quick Estimate (±20%)</span>
                <span className="ml-auto text-muted-foreground text-[10px]">${config.costStack.clientRate}/hr</span>
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            <div className="px-3 pb-3 space-y-3 border-t">
                {/* Row 1: Facility Type + Sqft */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Facility Type</Label>
                        <select
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={facilityType}
                            onChange={(e) => setFacilityType(e.target.value)}
                        >
                            {Object.entries(FACILITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Square Footage</Label>
                        <Input
                            type="number"
                            placeholder="e.g. 10000"
                            className="h-8 text-xs"
                            value={sqft || ''}
                            onChange={(e) => setSqft(parseInt(e.target.value) || 0)}
                        />
                    </div>
                </div>

                {/* Row 2: Floor Breakdown */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Floor Breakdown</Label>
                        <button
                            onClick={() => {
                                if (floorMode === 'percent' && sqft > 0) {
                                    setFloorBreakdown(prev => prev.map(f => ({ ...f, percent: Math.round(f.percent * sqft / 100) })));
                                } else if (floorMode === 'sqft') {
                                    const totalSqft = floorBreakdown.reduce((s, f) => s + f.percent, 0);
                                    if (totalSqft > 0) {
                                        setFloorBreakdown(prev => prev.map(f => ({ ...f, percent: Math.round((f.percent / totalSqft) * 100) })));
                                    }
                                }
                                setFloorMode(floorMode === 'percent' ? 'sqft' : 'percent');
                            }}
                            className="text-[10px] text-primary hover:underline font-medium"
                        >
                            {floorMode === 'percent' ? '% → sqft' : 'sqft → %'}
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(FLOOR_TYPE_LABELS).map(([type, label]) => {
                            const entry = floorBreakdown.find(f => f.type === type);
                            const isActive = !!entry;
                            const info = FLOOR_TYPE_INFO[type];
                            return (
                                <div key={type} className="space-y-0.5">
                                    <div className="relative group">
                                        <button
                                            onClick={() => toggleFloorType(type)}
                                            className={`text-[10px] w-full text-center px-1 py-0.5 rounded transition-colors ${isActive
                                                ? 'bg-primary/10 text-primary font-medium border border-primary/30'
                                                : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                        {info && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 w-48 p-2 bg-popover text-popover-foreground border rounded-md shadow-lg text-[10px]">
                                                <p className="font-semibold">{info.method}</p>
                                                <p className="text-muted-foreground mt-0.5">Includes: {info.includes}</p>
                                            </div>
                                        )}
                                    </div>
                                    {isActive && (
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                className="h-6 text-[10px] text-center pl-1 pr-6"
                                                value={entry!.percent || ''}
                                                onChange={(e) => updateFloorType(type, parseInt(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none">
                                                {floorMode === 'percent' ? '%' : 'sqft'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {floorMode === 'percent' ? (
                        <p className={`text-[10px] mt-0.5 ${floorBreakdown.reduce((s, f) => s + f.percent, 0) === 100
                            ? 'text-green-600'
                            : 'text-amber-600'
                            }`}>
                            Total: {floorBreakdown.reduce((s, f) => s + f.percent, 0)}%
                            {floorBreakdown.reduce((s, f) => s + f.percent, 0) !== 100 && ' (should be 100%)'}
                        </p>
                    ) : (
                        <p className={`text-[10px] mt-0.5 ${floorBreakdown.reduce((s, f) => s + f.percent, 0) === sqft
                            ? 'text-green-600'
                            : floorBreakdown.reduce((s, f) => s + f.percent, 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'
                            }`}>
                            Total: {floorBreakdown.reduce((s, f) => s + f.percent, 0).toLocaleString()} sqft
                            {sqft > 0 && floorBreakdown.reduce((s, f) => s + f.percent, 0) !== sqft && ` of ${sqft.toLocaleString()} sqft`}
                            {sqft > 0 && floorBreakdown.reduce((s, f) => s + f.percent, 0) === sqft && ' ✓'}
                        </p>
                    )}
                </div>

                {/* Row 3: Fixtures */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Restroom Fixtures <span className="normal-case opacity-70">({config.fixtures.restroomFixtureMinutes}min each)</span>
                        </Label>
                        <Input
                            type="number"
                            className="h-8 text-xs"
                            value={restroomFixtures || ''}
                            onChange={(e) => setRestroomFixtures(parseInt(e.target.value) || 0)}
                            placeholder="toilets + sinks + urinals"
                        />
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Trash Bins <span className="normal-case opacity-70">({config.fixtures.trashBinMinutes}min each)</span>
                        </Label>
                        <Input
                            type="number"
                            className="h-8 text-xs"
                            value={trashBins || ''}
                            onChange={(e) => setTrashBins(parseInt(e.target.value) || 0)}
                        />
                    </div>
                </div>

                {/* Row 4: Days/Week + Shift */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Days / Week</Label>
                        <div className="flex gap-1 mt-0.5">
                            {[5, 3, 2, 1].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDaysPerWeek(d)}
                                    className={`flex-1 h-7 rounded text-xs font-medium transition-colors ${daysPerWeek === d
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                        }`}
                                >
                                    {d}x
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift Timing</Label>
                        <div className="flex gap-1 mt-0.5">
                            {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setShift(key)}
                                    className={`flex-1 h-7 rounded text-[10px] font-medium transition-colors ${shift === key
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 5: Add-ons */}
                <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Add-ons</Label>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {Object.entries(ADD_ON_LABELS).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setAddOns(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors border ${addOns[key]
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                                    }`}
                            >
                                {addOns[key] ? '✓ ' : ''}{label}
                                <span className="opacity-60 ml-1">+{Math.round((config.addOns[key] || 0) * 100)}%</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Estimate Result ─── */}
                {estimate && sqft > 0 && (
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                        <div className="flex items-baseline justify-between">
                            <div className="text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground text-sm">~{estimate.hoursPerVisit} hrs</span>/visit
                                <span className="mx-1">×</span>
                                ${config.costStack.clientRate}/hr
                                <span className="mx-1">=</span>
                                <span className="font-semibold text-foreground">{formatCurrency(estimate.perVisit)}</span>/visit
                            </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            × {estimate.daysPerMonth} visits/mo
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                            <div>
                                <p className="text-xs text-muted-foreground">Monthly estimate</p>
                                <p className="text-lg font-bold text-foreground">
                                    {formatCurrency(estimate.monthly.low)} – {formatCurrency(estimate.monthly.high)}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => onApplyRate(estimate.monthly.mid, sqft)}
                            >
                                Use {formatCurrency(estimate.monthly.mid)}/mo
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}

                {!estimate && sqft <= 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                        Enter square footage to see estimate
                    </p>
                )}
            </div>
        </div>
    );
}
