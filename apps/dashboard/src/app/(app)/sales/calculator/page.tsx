'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Calculator, Building2, DollarSign, ArrowRight, Printer,
    Search, X, FileText,
} from 'lucide-react';
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

// ─── Facility type labels ────────────────────────────────────────────
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

export default function PricingCalculatorPage() {
    const router = useRouter();
    const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);

    // ─── Calculator inputs ───────────────────────────────────────────
    const [facilityName, setFacilityName] = useState('');
    const [facilityType, setFacilityType] = useState('office_general');
    const [sqft, setSqft] = useState<number>(0);
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
                if (snap.exists()) setConfig(snap.data() as PricingConfig);
            } catch { /* use defaults */ }
        }
        loadConfig();
    }, []);

    // ─── Floor breakdown helpers ─────────────────────────────────────
    const updateFloorType = (type: string, value: number) => {
        setFloorBreakdown(prev =>
            prev.map(f => f.type === type ? { ...f, percent: value } : f)
        );
    };

    const toggleFloorType = (type: string) => {
        setFloorBreakdown(prev => {
            const exists = prev.find(f => f.type === type);
            if (exists) return prev.filter(f => f.type !== type);
            return [...prev, { type, percent: 0 }];
        });
    };

    const normalizedFloorBreakdown = useMemo(() => {
        if (floorMode === 'percent') return floorBreakdown;
        const totalSqft = floorBreakdown.reduce((s, f) => s + f.percent, 0);
        if (totalSqft === 0) return floorBreakdown.map(f => ({ ...f, percent: 0 }));
        return floorBreakdown.map(f => ({
            ...f,
            percent: (f.percent / totalSqft) * 100,
        }));
    }, [floorBreakdown, floorMode]);

    // ─── Calculate estimate ──────────────────────────────────────────
    const estimate = useMemo<EstimateResult | null>(() => {
        if (sqft <= 0) return null;
        return calculateJanitorialEstimate(config, {
            facilityType,
            sqft,
            floorBreakdown: normalizedFloorBreakdown,
            restroomFixtures,
            trashBins,
            daysPerWeek,
            shift,
            addOns,
        });
    }, [config, facilityType, sqft, normalizedFloorBreakdown, restroomFixtures, trashBins, daysPerWeek, shift, addOns]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const handlePrint = () => window.print();

    const handleReset = () => {
        setFacilityName('');
        setFacilityType('office_general');
        setSqft(0);
        setFloorBreakdown([
            { type: 'carpet', percent: 50 },
            { type: 'resilient', percent: 40 },
            { type: 'tileStone', percent: 10 },
        ]);
        setRestroomFixtures(6);
        setTrashBins(8);
        setDaysPerWeek(5);
        setShift('afterHours');
        setAddOns({ kitchen: false, highTouchDisinfection: false, entryWayMats: false });
    };

    return (
        <div className="space-y-6 max-w-3xl print:max-w-none">
            {/* Header */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="w-6 h-6" />
                        Pricing Calculator
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Estimate janitorial cleaning costs. Adjust inputs below and see live results.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                        <X className="w-3.5 h-3.5" /> Reset
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                        <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                </div>
            </div>

            {/* Print header */}
            <div className="hidden print:block">
                <h1 className="text-xl font-bold">XIRI Facility Solutions — Pricing Estimate</h1>
                {facilityName && <p className="text-sm text-muted-foreground">{facilityName}</p>}
                <p className="text-xs text-muted-foreground mt-1">Generated {new Date().toLocaleDateString()}</p>
            </div>

            <Badge variant="outline" className="text-xs">
                Rate: ${config.costStack.clientRate}/hr • Min {config.costStack.minHours}hr/visit
            </Badge>

            {/* Facility Info */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="w-4 h-4" />
                        Facility Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label className="text-xs text-muted-foreground">Facility Name (optional)</Label>
                            <Input
                                className="mt-1"
                                placeholder="e.g. Flagstar Financial HQ"
                                value={facilityName}
                                onChange={(e) => setFacilityName(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Facility Type</Label>
                            <select
                                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-sm"
                                value={facilityType}
                                onChange={(e) => setFacilityType(e.target.value)}
                            >
                                {Object.entries(FACILITY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Square Footage</Label>
                            <Input
                                type="number"
                                className="mt-1"
                                placeholder="e.g. 10000"
                                value={sqft || ''}
                                onChange={(e) => setSqft(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Floor Breakdown */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-muted-foreground">Floor Breakdown</Label>
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
                                className="text-xs text-primary hover:underline font-medium print:hidden"
                            >
                                {floorMode === 'percent' ? 'Switch to sqft' : 'Switch to %'}
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(FLOOR_TYPE_LABELS).map(([type, label]) => {
                                const entry = floorBreakdown.find(f => f.type === type);
                                const isActive = !!entry;
                                const info = FLOOR_TYPE_INFO[type];
                                return (
                                    <div key={type} className="space-y-1">
                                        <div className="relative group">
                                            <button
                                                onClick={() => toggleFloorType(type)}
                                                className={`text-xs w-full text-center px-1.5 py-1 rounded transition-colors print:border ${isActive
                                                    ? 'bg-primary/10 text-primary font-medium border border-primary/30'
                                                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                            {info && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-56 p-2.5 bg-popover text-popover-foreground border rounded-lg shadow-lg text-xs">
                                                    <p className="font-semibold">{info.method}</p>
                                                    <p className="text-muted-foreground mt-0.5">Includes: {info.includes}</p>
                                                </div>
                                            )}
                                        </div>
                                        {isActive && (
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    className="h-7 text-xs text-center pl-1 pr-8"
                                                    value={entry!.percent || ''}
                                                    onChange={(e) => updateFloorType(type, parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                                                    {floorMode === 'percent' ? '%' : 'sqft'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {floorMode === 'percent' ? (
                            <p className={`text-xs mt-1 ${floorBreakdown.reduce((s, f) => s + f.percent, 0) === 100
                                ? 'text-green-600'
                                : 'text-amber-600'
                                }`}>
                                Total: {floorBreakdown.reduce((s, f) => s + f.percent, 0)}%
                                {floorBreakdown.reduce((s, f) => s + f.percent, 0) !== 100 && ' (should be 100%)'}
                            </p>
                        ) : (
                            <p className={`text-xs mt-1 ${floorBreakdown.reduce((s, f) => s + f.percent, 0) === sqft
                                ? 'text-green-600'
                                : floorBreakdown.reduce((s, f) => s + f.percent, 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'
                                }`}>
                                Total: {floorBreakdown.reduce((s, f) => s + f.percent, 0).toLocaleString()} sqft
                                {sqft > 0 && floorBreakdown.reduce((s, f) => s + f.percent, 0) !== sqft && ` of ${sqft.toLocaleString()} sqft`}
                                {sqft > 0 && floorBreakdown.reduce((s, f) => s + f.percent, 0) === sqft && ' ✓'}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Fixtures + Schedule */}
            <div className="grid grid-cols-2 gap-6">
                {/* Fixtures */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Fixtures</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">
                                Restroom Fixtures <span className="opacity-70">({config.fixtures.restroomFixtureMinutes}min ea)</span>
                            </Label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={restroomFixtures || ''}
                                onChange={(e) => setRestroomFixtures(parseInt(e.target.value) || 0)}
                                placeholder="toilets + sinks + urinals"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">
                                Trash Bins <span className="opacity-70">({config.fixtures.trashBinMinutes}min ea)</span>
                            </Label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={trashBins || ''}
                                onChange={(e) => setTrashBins(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Schedule */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Schedule</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs text-muted-foreground">Days / Week</Label>
                            <div className="flex gap-1.5 mt-1.5">
                                {[5, 3, 2, 1].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDaysPerWeek(d)}
                                        className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${daysPerWeek === d
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
                            <Label className="text-xs text-muted-foreground">Shift Timing</Label>
                            <div className="flex gap-1.5 mt-1.5">
                                {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setShift(key)}
                                        className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors ${shift === key
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add-ons */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Add-ons</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(ADD_ON_LABELS).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setAddOns(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${addOns[key]
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                                    }`}
                            >
                                {addOns[key] ? '✓ ' : ''}{label}
                                <span className="opacity-60 ml-1.5 text-xs">+{Math.round((config.addOns[key] || 0) * 100)}%</span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ─── Estimate Result ─── */}
            {estimate && sqft > 0 ? (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-primary" />
                            Estimate
                            <Badge variant="outline" className="ml-2 text-[10px]">±20%</Badge>
                        </CardTitle>
                        {facilityName && (
                            <CardDescription>{facilityName} • {sqft.toLocaleString()} sqft</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Breakdown */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-background rounded-lg border">
                                <p className="text-xs text-muted-foreground">Hours / Visit</p>
                                <p className="text-2xl font-bold">{estimate.hoursPerVisit}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {(sqft / (estimate.hoursPerVisit || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft/hr effective
                                </p>
                            </div>
                            <div className="p-3 bg-background rounded-lg border">
                                <p className="text-xs text-muted-foreground">Per Visit</p>
                                <p className="text-2xl font-bold">{formatCurrency(estimate.perVisit)}</p>
                                <p className="text-[10px] text-muted-foreground">{estimate.hoursPerVisit}hrs × ${config.costStack.clientRate}/hr</p>
                            </div>
                            <div className="p-3 bg-background rounded-lg border">
                                <p className="text-xs text-muted-foreground">Visits / Month</p>
                                <p className="text-2xl font-bold">{estimate.daysPerMonth}</p>
                                <p className="text-[10px] text-muted-foreground">{daysPerWeek}x/wk × 4.33</p>
                            </div>
                        </div>

                        {/* Monthly total */}
                        <div className="p-4 bg-background rounded-lg border text-center">
                            <p className="text-sm text-muted-foreground mb-1">Monthly Estimate</p>
                            <p className="text-3xl font-bold">
                                {formatCurrency(estimate.monthly.low)} – {formatCurrency(estimate.monthly.high)}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Mid: <span className="font-semibold text-foreground">{formatCurrency(estimate.monthly.mid)}/mo</span>
                            </p>
                        </div>

                        {/* Per-sqft breakdown */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>${(estimate.perVisit / sqft).toFixed(4)}/sqft/visit</span>
                            <span>${(estimate.monthly.mid / sqft).toFixed(2)}/sqft/month</span>
                            <span>${(estimate.monthly.mid * 12 / sqft).toFixed(2)}/sqft/year</span>
                        </div>

                        {/* Create Quote CTA */}
                        <div className="pt-2 print:hidden">
                            <Button
                                className="w-full gap-2"
                                size="lg"
                                onClick={() => {
                                    const params = new URLSearchParams({
                                        new: 'true',
                                        rate: String(estimate.monthly.mid),
                                        sqft: String(sqft),
                                        facilityType,
                                        ...(facilityName ? { facilityName } : {}),
                                    });
                                    router.push(`/sales/quotes?${params.toString()}`);
                                }}
                            >
                                <FileText className="w-4 h-4" />
                                Create Quote from Estimate ({formatCurrency(estimate.monthly.mid)}/mo)
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Enter square footage above to see the estimate</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
