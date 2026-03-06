'use client';

import { QuoteLineItem } from '@xiri/shared';
import { Lead } from '@xiri/shared';
import { Location } from './types';
import { formatCurrency, FrequencyDisplay, computeTotals } from './helpers';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users } from 'lucide-react';

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
}

export default function StepTermsAndSubmit({
    selectedLead, locations, lineItems,
    contractTenure, paymentTerms, exitClause, notes,
    assignedTo, salesUsers, profileUid,
    onContractTenureChange, onPaymentTermsChange, onExitClauseChange, onNotesChange, onAssignedToChange,
}: StepTermsAndSubmitProps) {

    const totals = computeTotals(lineItems);

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

            {/* Terms */}
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
