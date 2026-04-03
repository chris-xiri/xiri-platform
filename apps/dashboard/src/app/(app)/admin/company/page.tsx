'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { PROPOSAL_TERM_FIELDS, FREQUENCIES, DEFAULT_INPUTS } from '@xiri-facility-solutions/shared';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Save, CheckCircle, Loader2, Calculator, Mail } from 'lucide-react';

export default function CompanySettingsPage() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [data, setData] = useState<Record<string, any>>({});
    const [companyId, setCompanyId] = useState<string | null>(null);

    // Email signature settings (stored in settings/emailSignature)
    const [sigData, setSigData] = useState({
        closing: 'Best',
        name: 'Chris Leung',
        title: 'XIRI Facility Solutions',
        email: 'chris@xiri.ai',
        phone: '516-399-0350',
    });
    const [sigSaving, setSigSaving] = useState(false);
    const [sigSaved, setSigSaved] = useState(false);

    useEffect(() => {
        async function load() {
            if (!profile) { setLoading(false); return; }

            // Single-tenant: XIRI Facility Solutions
            const cid = 'xiri-facility-solutions';
            setCompanyId(cid);

            try {
                const companyRef = doc(db, 'companies', cid);
                const snap = await getDoc(companyRef);
                if (snap.exists()) {
                    setData(snap.data());
                } else {
                    // Auto-create the company doc on first visit
                    const initialData = {
                        name: 'XIRI Facility Solutions',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        createdBy: profile.uid,
                    };
                    await setDoc(companyRef, initialData);
                    setData(initialData);
                }

                // Ensure user profile is linked to company
                if (!profile.companyId) {
                    await updateDoc(doc(db, 'users', profile.uid), { companyId: cid });
                }
            } catch (err) {
                console.error('Failed to load company settings:', err);
            }
            setLoading(false);

            // Load email signature settings
            try {
                const sigSnap = await getDoc(doc(db, 'settings', 'emailSignature'));
                if (sigSnap.exists()) {
                    setSigData(prev => ({ ...prev, ...sigSnap.data() }));
                }
            } catch (err) {
                console.error('Failed to load email signature settings:', err);
            }
        }
        load();
    }, [profile]);

    const update = (key: string, value: string | boolean | number) => {
        setData(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    // Nested update for calculatorDefaults.* keys
    const updateCalc = (field: string, value: string | number) => {
        setData(prev => ({
            ...prev,
            calculatorDefaults: {
                ...(prev.calculatorDefaults || {}),
                [field]: value,
            },
        }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!companyId) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'companies', companyId), {
                ...data,
                updatedAt: serverTimestamp(),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save company settings:', err);
            alert('Failed to save. Check console for details.');
        }
        setSaving(false);
    };

    const updateSig = (key: string, value: string) => {
        setSigData(prev => ({ ...prev, [key]: value }));
        setSigSaved(false);
    };

    const handleSaveSig = async () => {
        setSigSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'emailSignature'), {
                ...sigData,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            setSigSaved(true);
            setTimeout(() => setSigSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save email signature:', err);
            alert('Failed to save. Check console for details.');
        }
        setSigSaving(false);
    };

    const calcDefaults = data.calculatorDefaults || {};

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!companyId) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Unable to load company settings.</p>
                        <p className="text-xs text-muted-foreground mt-1">Please try refreshing the page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="w-6 h-6" /> Company Settings
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Default proposal terms &amp; company info. These pre-fill every new quote.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>

            {/* Company Info */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Company Information</CardTitle>
                    <CardDescription className="text-xs">Used on proposals and contracts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Company Name</Label>
                            <Input
                                value={data.name || ''}
                                onChange={e => update('name', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Legal Entity Name</Label>
                            <Input
                                value={data.legalName || ''}
                                onChange={e => update('legalName', e.target.value)}
                                placeholder="e.g. XIRI Facility Solutions LLC"
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Phone</Label>
                            <Input value={data.phone || ''} onChange={e => update('phone', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs">Email</Label>
                            <Input value={data.email || ''} onChange={e => update('email', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs">Address</Label>
                            <Input value={data.address || ''} onChange={e => update('address', e.target.value)} className="mt-1" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quote Calculator Defaults */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Calculator className="w-4 h-4" /> Quote Calculator Defaults
                    </CardTitle>
                    <CardDescription className="text-xs">
                        These values pre-fill the Building Scope calculator when creating new quotes.
                        State-based wages still auto-fill when a lead&apos;s state is known.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Default Wage Rate ($/hr)</Label>
                            <Input
                                type="number"
                                step="0.50"
                                min="0"
                                value={calcDefaults.wageRate ?? DEFAULT_INPUTS.wageRate}
                                onChange={e => updateCalc('wageRate', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Payroll Tax %</Label>
                            <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="50"
                                value={calcDefaults.payrollTaxPercent ?? DEFAULT_INPUTS.payrollTaxPercent}
                                onChange={e => updateCalc('payrollTaxPercent', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Overhead %</Label>
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={calcDefaults.overheadPercent ?? DEFAULT_INPUTS.overheadPercent}
                                onChange={e => updateCalc('overheadPercent', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Profit Margin %</Label>
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={calcDefaults.profitPercent ?? DEFAULT_INPUTS.profitPercent}
                                onChange={e => updateCalc('profitPercent', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Supply Cost ($/sqft/visit)</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={calcDefaults.supplyCostPerSqft ?? DEFAULT_INPUTS.supplyCostPerSqft}
                                onChange={e => updateCalc('supplyCostPerSqft', parseFloat(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Default Frequency</Label>
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                value={calcDefaults.frequency || DEFAULT_INPUTS.frequency}
                                onChange={e => updateCalc('frequency', e.target.value)}
                            >
                                {FREQUENCIES.filter(f => f.group === 'recurring').map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Default Supply Policy</Label>
                        <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                            value={calcDefaults.supplyPolicy || DEFAULT_INPUTS.supplyPolicy}
                            onChange={e => updateCalc('supplyPolicy', e.target.value)}
                        >
                            <option value="company">Company Provides All</option>
                            <option value="client">Client Provides</option>
                            <option value="shared">Shared (50/50)</option>
                        </select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        💡 State-based wage auto-fill from BLS data will override this default when a lead&apos;s state is known.
                    </p>
                </CardContent>
            </Card>

            {/* Proposal Terms & Conditions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Default Proposal Terms</CardTitle>
                    <CardDescription className="text-xs">
                        These defaults pre-fill the T&amp;C section on every new quote. Adjustable per-deal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {PROPOSAL_TERM_FIELDS.map(field => (
                        <div key={field.key}>
                            <Label className="text-xs">{field.label}</Label>
                            <textarea
                                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-xs mt-1 resize-none"
                                value={data[field.key] || ''}
                                onChange={e => update(field.key, e.target.value)}
                                placeholder={`Enter default ${field.label.toLowerCase()}...`}
                            />
                        </div>
                    ))}

                    <Separator />

                    {/* Supplies Policy */}
                    <div>
                        <Label className="text-xs">Supplies Policy</Label>
                        <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                            value={data.suppliesPolicy || 'we_provide'}
                            onChange={e => update('suppliesPolicy', e.target.value)}
                        >
                            <option value="we_provide">We Provide All Supplies</option>
                            <option value="customer_provides">Customer Provides Supplies</option>
                            <option value="both">Shared (Both Provide)</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Supplies We Provide</Label>
                            <textarea
                                className="w-full min-h-[50px] rounded-md border border-input bg-background px-3 py-2 text-xs mt-1 resize-none"
                                value={data.suppliesWeProvide || ''}
                                onChange={e => update('suppliesWeProvide', e.target.value)}
                                placeholder="e.g. Cleaning chemicals, paper products..."
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Supplies Customer Provides</Label>
                            <textarea
                                className="w-full min-h-[50px] rounded-md border border-input bg-background px-3 py-2 text-xs mt-1 resize-none"
                                value={data.suppliesCustomerProvides || ''}
                                onChange={e => update('suppliesCustomerProvides', e.target.value)}
                                placeholder="e.g. Specialty products, towels..."
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Boolean toggles */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={data.bonded ?? false}
                                onChange={e => update('bonded', e.target.checked)}
                                className="rounded border-input"
                            />
                            <div>
                                <span className="text-xs font-medium">Bonded</span>
                                <p className="text-[10px] text-muted-foreground">Include bond info in proposals</p>
                            </div>
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                            <input
                                type="checkbox"
                                checked={data.uniformedPersonnel ?? false}
                                onChange={e => update('uniformedPersonnel', e.target.checked)}
                                className="rounded border-input"
                            />
                            <div>
                                <span className="text-xs font-medium">Uniformed Personnel</span>
                                <p className="text-[10px] text-muted-foreground">Staff wear company uniforms</p>
                            </div>
                        </label>
                    </div>
                    {data.bonded && (
                        <div>
                            <Label className="text-xs">Bond Amount</Label>
                            <Input
                                value={data.bondAmount || ''}
                                onChange={e => update('bondAmount', e.target.value)}
                                placeholder="e.g. $1,000,000"
                                className="mt-1"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Email Signature Settings */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Email Signature
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Auto-appended to all outgoing emails via Resend
                            </CardDescription>
                        </div>
                        <Button size="sm" onClick={handleSaveSig} disabled={sigSaving} className="gap-2">
                            {sigSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : sigSaved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                            {sigSaving ? 'Saving...' : sigSaved ? 'Saved!' : 'Save Signature'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Closing</Label>
                            <Input
                                value={sigData.closing}
                                onChange={e => updateSig('closing', e.target.value)}
                                placeholder="e.g. Best, Regards, Thanks"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Full Name</Label>
                            <Input
                                value={sigData.name}
                                onChange={e => updateSig('name', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Title / Company</Label>
                            <Input
                                value={sigData.title}
                                onChange={e => updateSig('title', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Email</Label>
                            <Input
                                value={sigData.email}
                                onChange={e => updateSig('email', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Phone</Label>
                            <Input
                                value={sigData.phone}
                                onChange={e => updateSig('phone', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Live Preview */}
                    <div>
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div
                            className="mt-2 p-4 rounded-lg border bg-white text-sm"
                            dangerouslySetInnerHTML={{
                                __html: `
                                    <div style="font-size: 14px; color: #1e293b; line-height: 1.6;">
                                        <p style="margin: 0;">${sigData.closing},</p>
                                        <p style="margin: 4px 0 0 0; font-weight: 600;">${sigData.name}  |  ${sigData.title}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">
                                            <a href="mailto:${sigData.email}" style="color: #64748b; text-decoration: none;">${sigData.email}</a>
                                            &nbsp;|&nbsp;
                                            <a href="tel:${sigData.phone.replace(/\D/g, '')}" style="color: #64748b; text-decoration: none;">${sigData.phone}</a>
                                        </p>
                                    </div>
                                `,
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
