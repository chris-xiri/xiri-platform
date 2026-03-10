'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Users, DollarSign, Search, CheckCircle, Clock, Building2,
    Phone, Mail, Filter, ChevronDown, ArrowUpCircle, AlertCircle,
} from 'lucide-react';

// Payout constants — must match public-site/data/dlp-referral-partners.ts
const WALKTHROUGH_BONUS = 100;
const CLOSE_BONUS = 400;
const REFERRAL_FEE = 500;
const RECURRING_BONUS = 50;

type PayoutStatus = 'new' | 'walkthrough_scheduled' | 'walkthrough_paid' | 'close_paid' | 'recurring';

interface ReferralLead {
    id: string;
    referrerName: string;
    referrerEmail: string;
    referrerPhone: string;
    trade: string;
    buildingName: string;
    buildingAddress?: string;
    managerName?: string;
    managerContact?: string;
    notes?: string;
    source: string;
    status: string;
    payoutStatus?: PayoutStatus;
    walkthroughPaidAt?: Timestamp;
    closePaidAt?: Timestamp;
    totalPaid?: number;
    createdAt: Timestamp;
}

const STATUS_CONFIG: Record<PayoutStatus, { label: string; color: string; icon: React.ReactNode }> = {
    new: { label: 'New Referral', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    walkthrough_scheduled: { label: 'Walkthrough Scheduled', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="w-3.5 h-3.5" /> },
    walkthrough_paid: { label: `Walkthrough Paid ($${WALKTHROUGH_BONUS})`, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    close_paid: { label: `Closed — Fully Paid ($${REFERRAL_FEE})`, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    recurring: { label: `Active — $${RECURRING_BONUS}/mo Recurring`, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
};

const NEXT_ACTION: Record<PayoutStatus, { label: string; next: PayoutStatus; amount: number } | null> = {
    new: { label: `Mark Walkthrough Scheduled`, next: 'walkthrough_scheduled', amount: 0 },
    walkthrough_scheduled: { label: `Pay $${WALKTHROUGH_BONUS} Walkthrough Bonus`, next: 'walkthrough_paid', amount: WALKTHROUGH_BONUS },
    walkthrough_paid: { label: `Pay $${CLOSE_BONUS} Close Bonus`, next: 'close_paid', amount: CLOSE_BONUS },
    close_paid: { label: `Activate $${RECURRING_BONUS}/mo Recurring`, next: 'recurring', amount: 0 },
    recurring: null,
};

export default function ReferralPartnersPage() {
    const [referrals, setReferrals] = useState<ReferralLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'referral_leads'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReferralLead));
            setReferrals(data);
            setLoading(false);
        });
        return unsub;
    }, []);

    const advanceStatus = async (referral: ReferralLead) => {
        const currentStatus = referral.payoutStatus || 'new';
        const action = NEXT_ACTION[currentStatus];
        if (!action) return;

        setUpdating(referral.id);
        try {
            const updates: any = {
                payoutStatus: action.next,
                updatedAt: serverTimestamp(),
            };
            if (action.next === 'walkthrough_paid') {
                updates.walkthroughPaidAt = serverTimestamp();
                updates.totalPaid = (referral.totalPaid || 0) + WALKTHROUGH_BONUS;
            }
            if (action.next === 'close_paid') {
                updates.closePaidAt = serverTimestamp();
                updates.totalPaid = (referral.totalPaid || 0) + CLOSE_BONUS;
            }
            await updateDoc(doc(db, 'referral_leads', referral.id), updates);
        } catch (err) {
            console.error('Failed to update referral:', err);
        } finally {
            setUpdating(null);
        }
    };

    // Derived stats
    const totalReferrals = referrals.length;
    const totalPaidOut = referrals.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
    const activeRecurring = referrals.filter(r => r.payoutStatus === 'recurring').length;
    const pendingPayouts = referrals.filter(r => !r.payoutStatus || r.payoutStatus === 'new' || r.payoutStatus === 'walkthrough_scheduled').length;

    // Filter
    const filtered = referrals.filter(r => {
        const matchesSearch = !searchTerm ||
            r.referrerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.buildingName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.referrerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.trade?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || (r.payoutStatus || 'new') === filterStatus;
        return matchesSearch && matchesStatus;
    });

    if (loading) return <div className="flex justify-center p-12 text-muted-foreground">Loading referrals...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6" /> Referral Partners
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track referral leads, manage walkthrough/close payouts, and monitor recurring bonuses.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium">Total Referrals</p>
                        <p className="text-2xl font-bold mt-1">{totalReferrals}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium">Total Paid Out</p>
                        <p className="text-2xl font-bold mt-1 text-emerald-600">${totalPaidOut.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium">Active Recurring</p>
                        <p className="text-2xl font-bold mt-1 text-purple-600">{activeRecurring}</p>
                        {activeRecurring > 0 && <p className="text-xs text-muted-foreground">${activeRecurring * RECURRING_BONUS}/mo</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium">Pending Action</p>
                        <p className="text-2xl font-bold mt-1 text-amber-600">{pendingPayouts}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by referrer, building, email, or trade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                    ))}
                </select>
            </div>

            {/* Referral Cards */}
            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {searchTerm || filterStatus !== 'all'
                            ? 'No referrals match your filters.'
                            : 'No referrals yet. They\'ll appear here once someone submits the referral form.'}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((referral) => {
                        const status = referral.payoutStatus || 'new';
                        const statusCfg = STATUS_CONFIG[status];
                        const action = NEXT_ACTION[status];
                        const isUpdating = updating === referral.id;
                        const createdDate = referral.createdAt?.toDate?.()
                            ? referral.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Unknown';

                        return (
                            <Card key={referral.id} className="overflow-hidden">
                                <div className="flex flex-col lg:flex-row">
                                    {/* Main info */}
                                    <div className="flex-1 p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                                    <h3 className="font-semibold text-base">{referral.buildingName}</h3>
                                                </div>
                                                {referral.buildingAddress && (
                                                    <p className="text-sm text-muted-foreground ml-6">{referral.buildingAddress}</p>
                                                )}
                                            </div>
                                            <Badge className={`${statusCfg.color} flex items-center gap-1 text-xs whitespace-nowrap`}>
                                                {statusCfg.icon} {statusCfg.label}
                                            </Badge>
                                        </div>

                                        {/* Referrer info */}
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className="font-medium text-foreground">{referral.referrerName}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Mail className="w-3.5 h-3.5" />
                                                <a href={`mailto:${referral.referrerEmail}`} className="hover:text-foreground">{referral.referrerEmail}</a>
                                            </span>
                                            {referral.referrerPhone && (
                                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    <a href={`tel:${referral.referrerPhone}`} className="hover:text-foreground">{referral.referrerPhone}</a>
                                                </span>
                                            )}
                                        </div>

                                        {/* Meta row */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            <Badge variant="outline" className="text-xs">{referral.trade?.replace(/-referral-partner$/, '').replace(/-/g, ' ')}</Badge>
                                            <span>Referred {createdDate}</span>
                                            {referral.managerName && <span>Manager: {referral.managerName}</span>}
                                            {referral.managerContact && <span>Contact: {referral.managerContact}</span>}
                                            {referral.notes && <span className="italic">"{referral.notes}"</span>}
                                        </div>
                                    </div>

                                    {/* Action panel */}
                                    <div className="lg:w-64 border-t lg:border-t-0 lg:border-l bg-muted/30 p-4 flex flex-col justify-between gap-3">
                                        {/* Payout progress */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase">Payout Progress</p>
                                            <div className="flex items-center gap-2 text-sm">
                                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                                <span className="font-bold text-emerald-600">${referral.totalPaid || 0}</span>
                                                <span className="text-muted-foreground">/ ${REFERRAL_FEE}</span>
                                            </div>
                                            {/* Simple progress bar */}
                                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                                    style={{ width: `${Math.min(((referral.totalPaid || 0) / REFERRAL_FEE) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Next Action Button */}
                                        {action && (
                                            <Button
                                                size="sm"
                                                onClick={() => advanceStatus(referral)}
                                                disabled={isUpdating}
                                                className="w-full text-xs"
                                                variant={action.amount > 0 ? 'default' : 'outline'}
                                            >
                                                {isUpdating ? 'Updating...' : action.label}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
