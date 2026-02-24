'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Save, RotateCcw, Percent, Clock, Shield } from 'lucide-react';

interface CommissionConfig {
    rateStandard: number;
    ratePremium: number;
    mrrThreshold: number;
    fsmUpsellRate: number;
    clawbackMonths: number;
    payoutSplit: number[];
    updatedAt?: any;
    updatedBy?: string;
}

const DEFAULTS: CommissionConfig = {
    rateStandard: 0.05,
    ratePremium: 0.075,
    mrrThreshold: 3000,
    fsmUpsellRate: 0.05,
    clawbackMonths: 6,
    payoutSplit: [50, 25, 25],
};

export default function CommissionsSettingsPage() {
    const { profile } = useAuth();
    const [config, setConfig] = useState<CommissionConfig>(DEFAULTS);
    const [original, setOriginal] = useState<CommissionConfig>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const snap = await getDoc(doc(db, 'settings', 'commissions'));
                if (snap.exists()) {
                    const data = snap.data() as CommissionConfig;
                    setConfig(data);
                    setOriginal(data);
                    if (data.updatedAt?.toDate) {
                        setLastUpdated(data.updatedAt.toDate().toLocaleString());
                    }
                }
            } catch (err) {
                console.error('Failed to load commission config:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const hasChanges = JSON.stringify(config) !== JSON.stringify(original);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'settings', 'commissions'), {
                ...config,
                updatedAt: serverTimestamp(),
                updatedBy: profile?.uid || 'unknown',
            });
            setOriginal(config);
            setSaved(true);
            setLastUpdated(new Date().toLocaleString());
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save commission config:', err);
            alert('Failed to save. Check console for details.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => setConfig(original);

    const pctDisplay = (val: number) => `${(val * 100).toFixed(1)}%`;

    if (loading) return <div className="flex justify-center p-12">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <DollarSign className="w-6 h-6" /> Commission Rates
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure commission rates, thresholds, and payout schedules.
                        {lastUpdated && <span className="ml-2">Last updated: {lastUpdated}</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="gap-1.5"
                    >
                        <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {/* Sales Commission Rates */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Percent className="w-4 h-4 text-blue-600" /> Sales Commission Rates
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Base Rate (Standard Tier)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={(config.rateStandard * 100).toFixed(1)}
                                    onChange={(e) => setConfig({ ...config, rateStandard: parseFloat(e.target.value) / 100 })}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Applied to deals with MRR ≤ ${config.mrrThreshold.toLocaleString()}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Premium Rate (Higher Tier)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={(config.ratePremium * 100).toFixed(1)}
                                    onChange={(e) => setConfig({ ...config, ratePremium: parseFloat(e.target.value) / 100 })}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Applied to deals with MRR &gt; ${config.mrrThreshold.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <Label className="text-sm font-medium">MRR Threshold</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                                type="number"
                                step="500"
                                min="0"
                                value={config.mrrThreshold}
                                onChange={(e) => setConfig({ ...config, mrrThreshold: parseInt(e.target.value) || 0 })}
                                className="w-32"
                            />
                            <span className="text-sm text-muted-foreground">/ month</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Deals above this MRR get the premium rate. ACV equivalent: ${(config.mrrThreshold * 12).toLocaleString()}/yr
                        </p>
                    </div>

                    {/* Visual Preview */}
                    <div className="bg-muted/50 rounded-lg p-4 mt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Preview</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                                <span>$2,000/mo deal (12mo):</span>
                                <Badge variant="outline">{pctDisplay(config.rateStandard)} → ${(2000 * 12 * config.rateStandard).toLocaleString()}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>$5,000/mo deal (12mo):</span>
                                <Badge variant="outline">{pctDisplay(config.ratePremium)} → ${(5000 * 12 * config.ratePremium).toLocaleString()}</Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* FSM Upsell Rate */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Percent className="w-4 h-4 text-amber-600" /> FSM Upsell Commission
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={(config.fsmUpsellRate * 100).toFixed(1)}
                            onChange={(e) => setConfig({ ...config, fsmUpsellRate: parseFloat(e.target.value) / 100 })}
                            className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">% of annualized upsell value</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        One-time payout when FSM closes an upsell.
                    </p>
                </CardContent>
            </Card>

            {/* Clawback & Payout Schedule */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-600" /> Payout Schedule & Clawback
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Payout Split</Label>
                            <div className="flex items-center gap-2">
                                {config.payoutSplit.map((pct, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={pct}
                                            onChange={(e) => {
                                                const newSplit = [...config.payoutSplit];
                                                newSplit[i] = parseInt(e.target.value) || 0;
                                                setConfig({ ...config, payoutSplit: newSplit });
                                            }}
                                            className="w-16 text-center"
                                        />
                                        {i < config.payoutSplit.length - 1 && <span className="text-muted-foreground">/</span>}
                                    </div>
                                ))}
                                <span className="text-xs text-muted-foreground ml-1">
                                    = {config.payoutSplit.reduce((a, b) => a + b, 0)}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                % paid in month 1, 2, 3 after first invoice payment
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Clawback Window</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min="0"
                                    max="24"
                                    value={config.clawbackMonths}
                                    onChange={(e) => setConfig({ ...config, clawbackMonths: parseInt(e.target.value) || 0 })}
                                    className="w-20"
                                />
                                <span className="text-sm text-muted-foreground">months</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Unpaid payouts are cancelled if client churns within this window.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Security Note */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Admin-Only Setting</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                        All changes are logged. Commission rates are read by Cloud Functions when a quote is accepted, ensuring consistent calculations.
                    </p>
                </div>
            </div>
        </div>
    );
}
