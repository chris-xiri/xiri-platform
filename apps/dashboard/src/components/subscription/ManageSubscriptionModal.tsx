'use client';

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FREE_TIER_LIMITS, FreeTierEligibilityResult } from '@xiri-facility-solutions/shared';
import { AlertCircle, CheckCircle2, ShieldAlert, Loader2, ArrowDownCircle, XCircle } from 'lucide-react';

interface ManageSubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
    onSuccess: () => void;
}

export default function ManageSubscriptionModal({
    open,
    onOpenChange,
    contract,
    onSuccess,
}: ManageSubscriptionModalProps) {
    const [activeTab, setActiveTab] = useState<'downgrade' | 'cancel'>('downgrade');
    const [loadingEligibility, setLoadingEligibility] = useState(false);
    const [eligibility, setEligibility] = useState<FreeTierEligibilityResult | null>(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Fetch real-time eligibility check on modal open
    useEffect(() => {
        if (!open || !contract?.id) return;
        async function fetchEligibility() {
            setLoadingEligibility(true);
            setErrorMsg(null);
            try {
                const checkFn = httpsCallable<any, { eligibility: FreeTierEligibilityResult }>(functions, 'checkFreeTierEligibility');
                const res = await checkFn({ contractId: contract.id, leadId: contract.leadId });
                setEligibility(res.data.eligibility);
            } catch (err: any) {
                console.error('Error checking Free Tier eligibility:', err);
                setErrorMsg('Could not verify account limits. Please try again.');
            } finally {
                setLoadingEligibility(false);
            }
        }
        fetchEligibility();
    }, [open, contract?.id, contract?.leadId]);

    const handleDowngrade = async () => {
        if (!contract?.id || !eligibility?.isEligible) return;
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const downgradeFn = httpsCallable<any, any>(functions, 'downgradeSubscription');
            const res = await downgradeFn({ contractId: contract.id, reason });

            if (!res.data.success) {
                if (res.data.error === 'LIMITS_EXCEEDED') {
                    setEligibility(res.data.eligibility);
                    setErrorMsg('Downgrade blocked: Current assets exceed Free Tier limits.');
                } else {
                    setErrorMsg(res.data.message || 'Failed to downgrade subscription.');
                }
                return;
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error('Downgrade error:', err);
            setErrorMsg(err.message || 'An error occurred while processing downgrade.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!contract?.id) return;
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const cancelFn = httpsCallable<any, any>(functions, 'cancelSubscription');
            const res = await cancelFn({ contractId: contract.id, reason });

            if (!res.data.success) {
                setErrorMsg(res.data.message || 'Failed to cancel subscription.');
                return;
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error('Cancellation error:', err);
            setErrorMsg(err.message || 'An error occurred while processing cancellation.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!contract) return null;

    const monthlyRate = contract.totalMonthlyRate || contract.monthlyRate || 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        Manage Subscription — {contract.clientBusinessName || contract.formalEntityName || 'Agreement'}
                    </DialogTitle>
                    <DialogDescription>
                        Current Plan: <span className="font-semibold text-foreground">${monthlyRate.toLocaleString()}/mo</span> • Status: <Badge variant="outline" className="ml-1 uppercase text-xs">{contract.status}</Badge>
                    </DialogDescription>
                </DialogHeader>

                {/* Segment Selector Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-sm font-medium">
                    <button
                        type="button"
                        onClick={() => setActiveTab('downgrade')}
                        className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'downgrade' ? 'bg-background shadow text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                        Downgrade to Free Tier ($0/mo)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cancel')}
                        className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'cancel' ? 'bg-background shadow text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <XCircle className="w-4 h-4 text-red-600" />
                        Cancel Subscription
                    </button>
                </div>

                {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* TAB 1: DOWNGRADE TO FREE TIER */}
                {activeTab === 'downgrade' && (
                    <div className="space-y-4 pt-1">
                        <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                Free Tier Limits & Policy
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">$0 / month</Badge>
                            </h4>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2 bg-white rounded border text-center">
                                    <p className="text-muted-foreground">Max Locations</p>
                                    <p className="font-bold text-base text-slate-900">{FREE_TIER_LIMITS.maxLocations}</p>
                                </div>
                                <div className="p-2 bg-white rounded border text-center">
                                    <p className="text-muted-foreground">Max Line Items</p>
                                    <p className="font-bold text-base text-slate-900">{FREE_TIER_LIMITS.maxLineItems}</p>
                                </div>
                                <div className="p-2 bg-white rounded border text-center">
                                    <p className="text-muted-foreground">Team Seats</p>
                                    <p className="font-bold text-base text-slate-900">{FREE_TIER_LIMITS.maxTeamMembers}</p>
                                </div>
                            </div>
                        </div>

                        {/* Audit / Eligibility Status */}
                        {loadingEligibility ? (
                            <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                                <p>Auditing account usage against Free Tier limits...</p>
                            </div>
                        ) : eligibility ? (
                            eligibility.isEligible ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm space-y-1">
                                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        Account is Eligible for Free Tier
                                    </div>
                                    <p className="text-xs text-emerald-700">
                                        Your active usage ({eligibility.usage.locationCount} location, {eligibility.usage.lineItemCount} line items, {eligibility.usage.teamMemberCount} seat) is within Free Tier limits. Downgrading will stop your monthly recurring charges immediately.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                                        <ShieldAlert className="w-5 h-5 text-red-600" />
                                        Downgrade Blocked — Asset Limit Exceeded
                                    </div>
                                    <p className="text-xs text-red-700">
                                        You cannot downgrade to the Free Tier until your active resources fall within the Free Tier limits. Please delete or deactivate the following excess items first:
                                    </p>
                                    <div className="space-y-2">
                                        {eligibility.exceededLimits.map((ex, idx) => (
                                            <div key={idx} className="p-2.5 bg-white border border-red-200 rounded text-xs flex items-center justify-between">
                                                <div>
                                                    <span className="font-semibold text-slate-800">{ex.label}</span>
                                                    <span className="text-muted-foreground ml-2">(Current: {ex.current} • Max: {ex.max})</span>
                                                </div>
                                                <Badge variant="destructive" className="font-mono">
                                                    Delete {ex.excess} excess item{ex.excess > 1 ? 's' : ''}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : null}

                        {/* Optional Reason */}
                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1 block">Reason for Downgrade (optional)</label>
                            <textarea
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Tell us why you are switching to Free Tier..."
                                className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button
                                onClick={handleDowngrade}
                                disabled={submitting || loadingEligibility || !eligibility?.isEligible}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm Downgrade to Free Tier
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* TAB 2: CANCEL SUBSCRIPTION */}
                {activeTab === 'cancel' && (
                    <div className="space-y-4 pt-1">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-2">
                            <div className="flex items-center gap-2 font-bold text-amber-900">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                Contract Cancellation Terms
                            </div>
                            <p className="text-xs text-amber-800">
                                Cancelling will terminate your active maintenance contract and stop all future monthly recurring invoices.
                            </p>
                            <div className="text-xs pt-1 border-t border-amber-200 flex justify-between font-medium">
                                <span>Exit Clause:</span>
                                <span className="font-bold">{contract.exitClause || '30-day written notice'}</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1 block">Reason for Cancellation (required)</label>
                            <textarea
                                rows={3}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Please specify the reason for cancelling this contract..."
                                className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Keep Active</Button>
                            <Button
                                variant="destructive"
                                onClick={handleCancel}
                                disabled={submitting || !reason.trim()}
                                className="gap-2"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm Subscription Cancellation
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
