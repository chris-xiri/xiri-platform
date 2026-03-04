'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    DollarSign, Clock, Building2, Loader2, Check, Save,
    Layers, Timer, Zap, FlipVertical,
} from 'lucide-react';
import { PricingConfig, DEFAULT_PRICING_CONFIG, FLOOR_TYPE_LABELS, SHIFT_LABELS, ADD_ON_LABELS } from '@/data/janitorialPricing';

const FACILITY_LABELS: Record<string, string> = {
    office_general: 'Office (General)',
    medical_private: 'Medical (Private)',
    medical_dental: 'Medical (Dental)',
    medical_veterinary: 'Medical (Vet)',
    medical_urgent_care: 'Medical (Urgent Care)',
    medical_surgery: 'Medical (Surgery)',
    medical_dialysis: 'Medical (Dialysis)',
    auto_dealer_showroom: 'Auto (Showroom)',
    auto_service_center: 'Auto (Service)',
    edu_daycare: 'Education (Daycare)',
    edu_private_school: 'Education (School)',
    fitness_gym: 'Fitness / Gym',
    retail_storefront: 'Retail',
    lab_cleanroom: 'Lab (Cleanroom)',
    lab_bsl: 'Lab (BSL)',
    manufacturing_light: 'Manufacturing',
    other: 'Other',
};

export default function PricingSettingsPage() {
    const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const snap = await getDoc(doc(db, 'pricing_config', 'janitorial'));
                if (snap.exists()) {
                    setConfig(snap.data() as PricingConfig);
                }
            } catch (err) {
                console.error('Failed to load pricing config:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'pricing_config', 'janitorial'), {
                ...config,
                updatedAt: serverTimestamp(),
            });
            setSaved(true);
            setDirty(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save pricing config:', err);
            alert('Failed to save. Check console.');
        } finally {
            setSaving(false);
        }
    };

    const update = <K extends keyof PricingConfig>(key: K, value: PricingConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    };

    const updateNested = (section: 'costStack' | 'fixtures', key: string, value: number) => {
        setConfig(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: value },
        }));
        setDirty(true);
    };

    const updateRate = (section: 'productionRates' | 'floorModifiers' | 'shiftModifiers' | 'addOns', key: string, value: number) => {
        setConfig(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: value },
        }));
        setDirty(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Pricing Settings</h2>
                    <p className="text-muted-foreground text-sm">
                        Configure the janitorial pricing calculator used in quotes.
                        Changes apply immediately to new estimates.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {saved && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <Check className="w-4 h-4" /> Saved
                        </span>
                    )}
                    <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <Badge variant="outline" className="text-xs">
                Service: {config.label || 'Janitorial Cleaning'}
            </Badge>

            {/* Wage Premium */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="w-4 h-4" />
                        Wage Premium Above Minimum
                    </CardTitle>
                    <CardDescription>
                        Multiplier applied to state minimum wages before rate scaling.
                        Cleaners typically earn 20–30% above minimum wage.
                        This affects the <strong>public site calculator</strong>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 max-w-md">
                        <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Premium (%)</Label>
                            <Input
                                type="number"
                                step="5"
                                className="mt-1"
                                value={Math.round((config.wagePremium - 1) * 100)}
                                onChange={(e) => {
                                    const pct = parseInt(e.target.value) || 0;
                                    update('wagePremium', 1 + pct / 100);
                                }}
                            />
                        </div>
                        <div className="text-sm text-muted-foreground pt-5">
                            = <span className="font-semibold text-foreground">{config.wagePremium.toFixed(2)}x</span> multiplier
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        Example: NY min wage ($20/hr) × {config.wagePremium.toFixed(2)} = ${(20 * config.wagePremium).toFixed(0)}/hr effective base
                    </p>
                </CardContent>
            </Card>

            {/* Cost Stack */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="w-4 h-4" />
                        Cost Stack
                    </CardTitle>
                    <CardDescription>Hourly rates that make up the pricing model</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="text-xs text-muted-foreground">Client Rate ($/hr)</Label>
                            <div className="relative mt-1">
                                <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    className="pl-7"
                                    value={config.costStack.clientRate}
                                    onChange={(e) => updateNested('costStack', 'clientRate', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">Billed to client</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Subcontractor ($/hr)</Label>
                            <div className="relative mt-1">
                                <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    className="pl-7"
                                    value={config.costStack.subcontractorRate}
                                    onChange={(e) => updateNested('costStack', 'subcontractorRate', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">Paid to sub</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Cleaner Pay ($/hr)</Label>
                            <div className="relative mt-1">
                                <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    className="pl-7"
                                    value={config.costStack.cleanerRate}
                                    onChange={(e) => updateNested('costStack', 'cleanerRate', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">Cleaner earns</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Minimum Hours</Label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={config.costStack.minHours}
                                onChange={(e) => updateNested('costStack', 'minHours', parseFloat(e.target.value) || 1)}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Per visit minimum</p>
                        </div>
                    </div>
                    {/* Margin indicator */}
                    {config.costStack.clientRate > 0 && config.costStack.subcontractorRate > 0 && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">
                                XIRI Margin: <span className="font-semibold text-foreground">
                                    {Math.round((1 - config.costStack.subcontractorRate / config.costStack.clientRate) * 100)}%
                                </span>
                                {' '}(${(config.costStack.clientRate - config.costStack.subcontractorRate).toFixed(0)}/hr)
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Production Rates */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="w-4 h-4" />
                        Production Rates (sqft/hr)
                    </CardTitle>
                    <CardDescription>
                        How many square feet a cleaner can cover per hour by facility type. Lower = more labor-intensive.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Object.entries(config.productionRates).map(([key, value]) => (
                            <div key={key}>
                                <Label className="text-[10px] text-muted-foreground truncate block">
                                    {FACILITY_LABELS[key] || key}
                                </Label>
                                <Input
                                    type="number"
                                    className="h-8 text-xs mt-0.5"
                                    value={value}
                                    onChange={(e) => updateRate('productionRates', key, parseInt(e.target.value) || 0)}
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Fixtures */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Timer className="w-4 h-4" />
                        Fixture Times
                    </CardTitle>
                    <CardDescription>Time added per fixture on top of base sqft cleaning</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                        <div>
                            <Label className="text-xs text-muted-foreground">Restroom Fixture (min)</Label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={config.fixtures.restroomFixtureMinutes}
                                onChange={(e) => updateNested('fixtures', 'restroomFixtureMinutes', parseFloat(e.target.value) || 0)}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Per toilet, sink, or urinal</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Trash Bin (min)</Label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={config.fixtures.trashBinMinutes}
                                onChange={(e) => updateNested('fixtures', 'trashBinMinutes', parseFloat(e.target.value) || 0)}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Per trash bin</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Floor Modifiers + Shift Modifiers side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Floor Modifiers */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Layers className="w-4 h-4" />
                            Floor Type Modifiers
                        </CardTitle>
                        <CardDescription>Production rate multiplier by floor type (1.0 = no change)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(config.floorModifiers).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                                <Label className="text-xs text-muted-foreground w-24 shrink-0">
                                    {FLOOR_TYPE_LABELS[key] || key}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.05"
                                    className="h-8 text-xs w-20"
                                    value={value}
                                    onChange={(e) => updateRate('floorModifiers', key, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                    {value < 1 ? `${Math.round((1 - value) * 100)}% slower` : value > 1 ? `${Math.round((value - 1) * 100)}% faster` : 'baseline'}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Shift Modifiers */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="w-4 h-4" />
                            Shift Timing Modifiers
                        </CardTitle>
                        <CardDescription>Cost multiplier by shift (1.0 = no premium)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(config.shiftModifiers).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                                <Label className="text-xs text-muted-foreground w-24 shrink-0">
                                    {SHIFT_LABELS[key] || key}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.05"
                                    className="h-8 text-xs w-20"
                                    value={value}
                                    onChange={(e) => updateRate('shiftModifiers', key, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                    {value > 1 ? `+${Math.round((value - 1) * 100)}% premium` : 'no premium'}
                                </span>
                            </div>
                        ))}

                        <Separator className="my-4" />

                        {/* Add-ons in same card */}
                        <div>
                            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                                <Zap className="w-3.5 h-3.5" />
                                Add-on Modifiers
                            </h4>
                            <p className="text-[10px] text-muted-foreground mb-3">Extra time added as % of base</p>
                            {Object.entries(config.addOns).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-3 mb-2">
                                    <Label className="text-xs text-muted-foreground w-36 shrink-0">
                                        {ADD_ON_LABELS[key] || key}
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 text-xs w-20"
                                        value={value}
                                        onChange={(e) => updateRate('addOns', key, parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                        +{Math.round(value * 100)}% time
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Save bar (sticky at bottom when dirty) */}
            {dirty && (
                <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-4 -mx-6 flex items-center justify-between">
                    <p className="text-sm text-amber-600">You have unsaved changes</p>
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            )}
        </div>
    );
}
