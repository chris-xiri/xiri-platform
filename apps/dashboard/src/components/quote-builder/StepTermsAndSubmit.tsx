'use client';

import { useState, useEffect } from 'react';
import {
    type QuoteLineItem,
    type ProposalTerms,
    buildDefaultTerms,
    PROPOSAL_TERM_FIELDS,
} from '@xiri-facility-solutions/shared';
import { Lead } from '@xiri-facility-solutions/shared';
import { Location } from './types';
import { formatCurrency, FrequencyDisplay, computeTotals } from './helpers';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, FileText, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

interface StepTermsAndSubmitProps {
    selectedLead: (Lead & { id: string }) | null;
    locations: Location[];
    lineItems: QuoteLineItem[];
    contractTenure: number;
    paymentTerms: string;
    exitClause: string;
    notes: string;
    assignedTo: string;
    salesUsers: { uid: string; displayName: string; email: string }[];
    profileUid: string;
    onContractTenureChange: (v: number) => void;
    onPaymentTermsChange: (v: string) => void;
    onExitClauseChange: (v: string) => void;
    onNotesChange: (v: string) => void;
    onAssignedToChange: (v: string) => void;
    // T&C
    proposalTerms: ProposalTerms | null;
    onProposalTermsChange: (terms: ProposalTerms) => void;
    companyData?: Record<string, any> | null;
}

export default function StepTermsAndSubmit({
    selectedLead, locations, lineItems,
    contractTenure, paymentTerms, exitClause, notes,
    assignedTo, salesUsers, profileUid,
    onContractTenureChange, onPaymentTermsChange, onExitClauseChange, onNotesChange, onAssignedToChange,
    proposalTerms, onProposalTermsChange, companyData,
}: StepTermsAndSubmitProps) {

    const totals = computeTotals(lineItems);
    const [termsExpanded, setTermsExpanded] = useState(false);
    const [enabledTerms, setEnabledTerms] = useState<Record<string, boolean>>({});

    // Initialize proposal terms from company defaults on mount
    useEffect(() => {
        if (!proposalTerms && companyData) {
            const defaults = buildDefaultTerms(companyData);
            onProposalTermsChange(defaults);
            // Auto-enable terms that have values
            const enabled: Record<string, boolean> = {};
            PROPOSAL_TERM_FIELDS.forEach(f => {
                const val = defaults[f.key];
                enabled[f.key] = typeof val === 'string' ? val.length > 0 : !!val;
            });
            setEnabledTerms(enabled);
        } else if (proposalTerms) {
            // Restore enabled state from existing terms
            const enabled: Record<string, boolean> = {};
            PROPOSAL_TERM_FIELDS.forEach(f => {
                const val = proposalTerms[f.key];
                enabled[f.key] = typeof val === 'string' ? val.length > 0 : !!val;
            });
            setEnabledTerms(enabled);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyData]);

    const updateTerm = (key: keyof ProposalTerms, value: string | boolean) => {
        if (!proposalTerms) return;
        onProposalTermsChange({ ...proposalTerms, [key]: value });
    };

    const toggleTerm = (key: string) => {
        setEnabledTerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="space-y-6">
            {/* Summary */}
            <Card className="bg-muted/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quote Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Client</span>
                        <span className="font-medium">{selectedLead?.businessName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Locations</span>
                        <span className="font-medium">{locations.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Services</span>
                        <span className="font-medium">{lineItems.length}</span>
                    </div>

                    {/* Recurring Services */}
                    {totals.recurringItems.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurring Services</p>
                            {totals.recurringItems.map(li => (
                                <div key={li.id} className="flex justify-between text-xs text-muted-foreground">
                                    <span>{li.serviceType} — {li.locationName} ({FrequencyDisplay(li)})</span>
                                    <span className="font-medium text-foreground">{formatCurrency(li.clientRate)}/mo</span>
                                </div>
                            ))}
                        </>
                    )}

                    {/* One-Time Services */}
                    {totals.oneTimeItems.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">One-Time Services</p>
                            {totals.oneTimeItems.map(li => (
                                <div key={li.id} className="flex justify-between text-xs text-muted-foreground">
                                    <span>{li.serviceType} — {li.locationName}</span>
                                    <span className="font-medium text-foreground">{formatCurrency(li.clientRate)}</span>
                                </div>
                            ))}
                        </>
                    )}

                    <Separator />

                    {totals.recurringItems.length > 0 && (
                        <div className="flex justify-between">
                            <span className="font-medium">Monthly Recurring (incl. tax)</span>
                            <span className="text-xl font-bold text-primary">{formatCurrency(totals.totalMonthly)}/mo</span>
                        </div>
                    )}
                    {totals.oneTimeItems.length > 0 && (
                        <div className="flex justify-between">
                            <span className="font-medium">One-Time Charges (incl. tax)</span>
                            <span className="text-xl font-bold text-amber-600">{formatCurrency(totals.totalOneTime)}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Contract Terms */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Contract Tenure</Label>
                    <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                        value={contractTenure}
                        onChange={(e) => onContractTenureChange(Number(e.target.value))}
                    >
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                        <option value={18}>18 Months</option>
                        <option value={24}>24 Months</option>
                        <option value={36}>36 Months</option>
                    </select>
                </div>
                <div>
                    <Label>Payment Due Day</Label>
                    <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                        value={paymentTerms}
                        onChange={(e) => onPaymentTermsChange(e.target.value)}
                    >
                        <option value="Pay on the 1st">Pay on the 1st</option>
                        <option value="Pay on the 5th">Pay on the 5th</option>
                        <option value="Pay on the 10th">Pay on the 10th</option>
                        <option value="Pay on the 15th">Pay on the 15th</option>
                        <option value="Pay on the 20th">Pay on the 20th</option>
                        <option value="Pay on the 25th">Pay on the 25th</option>
                        <option value="Pay on the last day">Pay on the last day</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Invoice issued on the 1st of each month, or at service start (pro-rated).
                    </p>
                </div>
            </div>

            <div>
                <Label>Exit Clause</Label>
                <Input value={exitClause} onChange={(e) => onExitClauseChange(e.target.value)} className="mt-1" />
            </div>

            {/* ═══ PROPOSAL TERMS & CONDITIONS ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <button
                        type="button"
                        className="flex items-center gap-2 w-full text-left"
                        onClick={() => setTermsExpanded(!termsExpanded)}
                    >
                        {termsExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Proposal Terms & Conditions</CardTitle>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                            {Object.values(enabledTerms).filter(Boolean).length} of {PROPOSAL_TERM_FIELDS.length} enabled
                        </span>
                    </button>
                </CardHeader>
                {termsExpanded && (
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Toggle terms on/off and edit text. Defaults come from Company Settings.
                        </p>
                        {PROPOSAL_TERM_FIELDS.map(field => {
                            const isEnabled = enabledTerms[field.key] ?? false;
                            const value = proposalTerms?.[field.key] ?? '';
                            const isString = typeof value === 'string' || typeof value === 'undefined';

                            return (
                                <div key={field.key} className={`rounded-lg border p-3 transition-colors ${isEnabled ? 'bg-background' : 'bg-muted/30 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-xs font-medium">{field.label}</Label>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                            onClick={() => toggleTerm(field.key)}
                                            title={isEnabled ? 'Disable this term' : 'Enable this term'}
                                        >
                                            {isEnabled
                                                ? <ToggleRight className="w-5 h-5 text-primary" />
                                                : <ToggleLeft className="w-5 h-5" />
                                            }
                                        </button>
                                    </div>
                                    {isEnabled && isString && (
                                        <textarea
                                            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-xs resize-none"
                                            value={value as string}
                                            onChange={e => updateTerm(field.key, e.target.value)}
                                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                                        />
                                    )}
                                </div>
                            );
                        })}

                        {/* Boolean fields: bonded & uniformed */}
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={proposalTerms?.bonded ?? false}
                                    onChange={e => updateTerm('bonded', e.target.checked as any)}
                                    className="rounded border-input"
                                />
                                <span className="text-xs font-medium">Bonded</span>
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={proposalTerms?.uniformedPersonnel ?? false}
                                    onChange={e => updateTerm('uniformedPersonnel', e.target.checked as any)}
                                    className="rounded border-input"
                                />
                                <span className="text-xs font-medium">Uniformed Personnel</span>
                            </label>
                        </div>
                        {proposalTerms?.bonded && (
                            <div>
                                <Label className="text-xs">Bond Amount</Label>
                                <Input
                                    value={proposalTerms?.bondAmount ?? ''}
                                    onChange={e => updateTerm('bondAmount', e.target.value)}
                                    placeholder="e.g. $1,000,000"
                                    className="mt-1 text-xs"
                                />
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Commission Assignment */}
            <div>
                <Label className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Commission Assigned To
                </Label>
                <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                    value={assignedTo}
                    onChange={(e) => onAssignedToChange(e.target.value)}
                >
                    {salesUsers.map(u => (
                        <option key={u.uid} value={u.uid}>
                            {u.displayName}{u.uid === profileUid ? ' (You)' : ''}
                        </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                    Sales commission will be calculated when the quote is accepted.
                </p>
            </div>

            <div>
                <Label>Notes (optional)</Label>
                <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Any additional notes about this quote..."
                />
            </div>
        </div>
    );
}
