'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { SiteVisit, AreaRating, SiteVisitActionItem, WorkOrder } from '@xiri/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft, ArrowRight, MapPin, Star, CheckCircle2, Plus,
    Trash2, Building2, MessageSquare, TrendingUp, Send, PartyPopper
} from 'lucide-react';

const STEPS = ['Check-in', 'Walkthrough', 'Client', 'Actions', 'Summary'];

const FACILITY_AREAS = [
    'Lobby / Reception',
    'Restrooms',
    'Break Room / Kitchen',
    'Offices / Exam Rooms',
    'Hallways / Corridors',
    'Exterior / Parking',
];

export default function ConductVisitFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const preselectedWO = searchParams.get('workOrderId');

    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Work order selection
    const [activeWOs, setActiveWOs] = useState<(WorkOrder & { id: string })[]>([]);
    const [selectedWO, setSelectedWO] = useState<(WorkOrder & { id: string }) | null>(null);
    const [loadingWOs, setLoadingWOs] = useState(true);

    // Step 1: Check-in
    const [checkedIn, setCheckedIn] = useState(false);

    // Step 2: Walkthrough
    const [areaRatings, setAreaRatings] = useState<AreaRating[]>(
        FACILITY_AREAS.map(area => ({ area, rating: 0, notes: '' }))
    );

    // Step 3: Client touchpoint
    const [clientContactMade, setClientContactMade] = useState(false);
    const [clientContactName, setClientContactName] = useState('');
    const [clientSatisfaction, setClientSatisfaction] = useState(0);
    const [clientFeedback, setClientFeedback] = useState('');

    // Step 4: Action items
    const [actionItems, setActionItems] = useState<SiteVisitActionItem[]>([]);
    const [newAction, setNewAction] = useState('');
    const [newActionAssign, setNewActionAssign] = useState<'vendor' | 'client' | 'xiri'>('vendor');
    const [newActionPriority, setNewActionPriority] = useState<'low' | 'medium' | 'high'>('medium');

    // Step 3.5: Upsell
    const [upsellNotes, setUpsellNotes] = useState('');

    // Fetch active work orders
    useEffect(() => {
        async function fetch() {
            try {
                const q = query(
                    collection(db, 'work_orders'),
                    where('status', 'in', ['active', 'in_progress'])
                );
                const snap = await getDocs(q);
                const wos = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));
                setActiveWOs(wos);

                if (preselectedWO) {
                    const match = wos.find(w => w.id === preselectedWO);
                    if (match) {
                        setSelectedWO(match);
                        setCheckedIn(true);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingWOs(false);
            }
        }
        fetch();
    }, [preselectedWO]);

    // Calculate overall condition
    const ratedAreas = areaRatings.filter(a => a.rating > 0);
    const overallCondition = ratedAreas.length > 0
        ? Math.round(ratedAreas.reduce((s, a) => s + a.rating, 0) / ratedAreas.length)
        : 0;

    // Check if this is the first visit to this work order
    const [isFirstVisit, setIsFirstVisit] = useState(true);
    useEffect(() => {
        if (!selectedWO) return;
        async function checkFirst() {
            try {
                const q = query(
                    collection(db, 'site_visits'),
                    where('workOrderId', '==', selectedWO!.id)
                );
                const snap = await getDocs(q);
                setIsFirstVisit(snap.empty);
            } catch { }
        }
        checkFirst();
    }, [selectedWO]);

    function setRating(index: number, rating: number) {
        setAreaRatings(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], rating };
            return copy;
        });
    }

    function setAreaNotes(index: number, notes: string) {
        setAreaRatings(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], notes };
            return copy;
        });
    }

    function addActionItem() {
        if (!newAction.trim()) return;
        setActionItems(prev => [...prev, {
            id: `ai_${Date.now()}`,
            description: newAction.trim(),
            assignedTo: newActionAssign,
            priority: newActionPriority,
            status: 'open',
        }]);
        setNewAction('');
    }

    function removeActionItem(id: string) {
        setActionItems(prev => prev.filter(a => a.id !== id));
    }

    async function handleSubmit() {
        if (!selectedWO || !profile) return;
        setSubmitting(true);

        try {
            const visitData: Omit<SiteVisit, 'id'> = {
                workOrderId: selectedWO.id,
                leadId: selectedWO.leadId || '',
                locationName: selectedWO.locationName || '',
                clientBusinessName: selectedWO.locationName || '',
                checkedInAt: serverTimestamp(),
                checkedInMethod: 'manual',
                areaRatings: areaRatings.filter(a => a.rating > 0),
                overallCondition,
                clientContactMade,
                clientContactName: clientContactMade ? clientContactName : undefined,
                clientSatisfaction: clientContactMade ? clientSatisfaction : undefined,
                clientFeedback: clientContactMade ? clientFeedback : undefined,
                upsellOpportunities: upsellNotes ? [upsellNotes] : [],
                actionItems,
                fsmId: profile.uid || '',
                fsmName: profile.displayName || profile.email || 'FSM',
                visitDate: new Date().toISOString().split('T')[0],
                isFirstVisit,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'site_visits'), visitData);
            setSubmitted(true);
        } catch (err) {
            console.error('Error saving site visit:', err);
        } finally {
            setSubmitting(false);
        }
    }

    // ── Celebration screen ──
    if (submitted) {
        return (
            <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
                <div className="text-6xl animate-bounce">
                    <PartyPopper className="w-16 h-16 mx-auto text-green-500" />
                </div>
                <h1 className="text-2xl font-bold">Visit Complete!</h1>
                <p className="text-muted-foreground">
                    Site visit for <span className="font-medium text-foreground">{selectedWO?.locationName}</span> has been recorded.
                </p>
                <div className="flex items-center justify-center gap-2 text-amber-500">
                    {Array.from({ length: overallCondition }).map((_, i) => (
                        <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-sm text-muted-foreground ml-2">Overall Condition</span>
                </div>
                {actionItems.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {actionItems.length} action item{actionItems.length > 1 ? 's' : ''} created
                    </p>
                )}
                {isFirstVisit && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                        ★ First Visit Recorded
                    </Badge>
                )}
                <div className="pt-4">
                    <Button onClick={() => router.push('/operations/site-visits')} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Site Visits
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.push('/operations/site-visits')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-lg font-bold">Conduct Site Visit</h1>
                    {selectedWO && (
                        <p className="text-sm text-muted-foreground">{selectedWO.locationName}</p>
                    )}
                </div>
                {isFirstVisit && selectedWO && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200 ml-auto">
                        ★ First Visit
                    </Badge>
                )}
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex-1">
                        <div
                            className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-muted'
                                }`}
                        />
                        <p className={`text-[10px] mt-1 text-center ${i === step ? 'text-primary font-medium' : 'text-muted-foreground'
                            }`}>{label}</p>
                    </div>
                ))}
            </div>

            {/* ──────── Step 0: Check-in ──────── */}
            {step === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" /> Select & Check In
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loadingWOs ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                            </div>
                        ) : activeWOs.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No active work orders. Create work orders first.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {activeWOs.map(wo => (
                                    <div
                                        key={wo.id}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedWO?.id === wo.id
                                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                            : 'hover:border-primary/50'
                                            }`}
                                        onClick={() => { setSelectedWO(wo); setCheckedIn(true); }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium text-sm">{wo.locationName}</p>
                                                    <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                                                </div>
                                            </div>
                                            {selectedWO?.id === wo.id && (
                                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {checkedIn && selectedWO && (
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Checked in at {selectedWO.locationName}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ──────── Step 1: Walkthrough ──────── */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500" /> Facility Walkthrough
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {areaRatings.map((area, idx) => (
                            <div key={area.area} className="p-3 rounded-lg border space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium text-sm">{area.area}</p>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setRating(idx, n)}
                                                className="focus:outline-none"
                                            >
                                                <Star
                                                    className={`w-5 h-5 transition-colors ${n <= area.rating
                                                        ? 'text-amber-400 fill-amber-400'
                                                        : 'text-gray-300 dark:text-gray-600'
                                                        }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {area.rating > 0 && area.rating <= 3 && (
                                    <Input
                                        placeholder="What needs attention?"
                                        value={area.notes || ''}
                                        onChange={(e) => setAreaNotes(idx, e.target.value)}
                                        className="text-sm"
                                    />
                                )}
                            </div>
                        ))}

                        {overallCondition > 0 && (
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground mb-1">Overall Condition</p>
                                <div className="flex items-center justify-center gap-1">
                                    {Array.from({ length: overallCondition }).map((_, i) => (
                                        <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                                    ))}
                                    <span className="text-lg font-bold ml-2">{overallCondition}/5</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ──────── Step 2: Client Touchpoint ──────── */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" /> Client Touchpoint
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Button
                                variant={clientContactMade ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setClientContactMade(true)}
                            >
                                Met with Client
                            </Button>
                            <Button
                                variant={!clientContactMade ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setClientContactMade(false)}
                            >
                                Client Unavailable
                            </Button>
                        </div>

                        {clientContactMade && (
                            <div className="space-y-4 pt-2">
                                <div>
                                    <Label className="text-sm">Contact Name</Label>
                                    <Input
                                        placeholder="Who did you speak with?"
                                        value={clientContactName}
                                        onChange={(e) => setClientContactName(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label className="text-sm">Client Satisfaction</Label>
                                    <div className="flex gap-1 mt-2">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setClientSatisfaction(n)}
                                                className="focus:outline-none"
                                            >
                                                <Star
                                                    className={`w-8 h-8 transition-colors ${n <= clientSatisfaction
                                                        ? 'text-green-500 fill-green-500'
                                                        : 'text-gray-300 dark:text-gray-600'
                                                        }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-sm">Client Feedback / Notes</Label>
                                    <textarea
                                        className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Any feedback or concerns mentioned?"
                                        value={clientFeedback}
                                        onChange={(e) => setClientFeedback(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Upsell Radar */}
                        <div className="border-t pt-4">
                            <Label className="text-sm flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                Upsell Opportunities
                            </Label>
                            <textarea
                                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="E.g. 'Parking lot needs pressure washing', 'Client asked about window cleaning'"
                                value={upsellNotes}
                                onChange={(e) => setUpsellNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ──────── Step 3: Action Items ──────── */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-500" /> Action Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Existing items */}
                        {actionItems.map(item => (
                            <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                                <div className="flex-1">
                                    <p className="text-sm">{item.description}</p>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px]">{item.assignedTo}</Badge>
                                        <Badge
                                            variant={item.priority === 'high' ? 'destructive' : 'secondary'}
                                            className="text-[10px]"
                                        >
                                            {item.priority}
                                        </Badge>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeActionItem(item.id)}
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </Button>
                            </div>
                        ))}

                        {/* Add new */}
                        <div className="space-y-3 border-t pt-4">
                            <Input
                                placeholder="Describe the action needed..."
                                value={newAction}
                                onChange={(e) => setNewAction(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label className="text-[10px] text-muted-foreground">Assign To</Label>
                                    <div className="flex gap-1 mt-1">
                                        {(['vendor', 'client', 'xiri'] as const).map(v => (
                                            <Button
                                                key={v}
                                                variant={newActionAssign === v ? 'default' : 'outline'}
                                                size="sm"
                                                className="flex-1 text-xs capitalize"
                                                onClick={() => setNewActionAssign(v)}
                                            >
                                                {v}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <Label className="text-[10px] text-muted-foreground">Priority</Label>
                                    <div className="flex gap-1 mt-1">
                                        {(['low', 'medium', 'high'] as const).map(p => (
                                            <Button
                                                key={p}
                                                variant={newActionPriority === p ? 'default' : 'outline'}
                                                size="sm"
                                                className={`flex-1 text-xs capitalize ${newActionPriority === p && p === 'high' ? 'bg-red-600 hover:bg-red-700' : ''
                                                    }`}
                                                onClick={() => setNewActionPriority(p)}
                                            >
                                                {p}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full gap-2"
                                onClick={addActionItem}
                                disabled={!newAction.trim()}
                            >
                                <Plus className="w-4 h-4" /> Add Action Item
                            </Button>
                        </div>

                        {actionItems.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                No action items yet. Add any follow-ups needed.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ──────── Step 4: Summary ──────── */}
            {step === 4 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Send className="w-4 h-4 text-green-500" /> Visit Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Site */}
                        <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="font-medium">{selectedWO?.locationName}</p>
                            <p className="text-xs text-muted-foreground">{selectedWO?.serviceType}</p>
                        </div>

                        {/* Condition */}
                        <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1">Facility Condition</p>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: overallCondition }).map((_, i) => (
                                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                                ))}
                                <span className="text-sm font-bold ml-1">{overallCondition}/5</span>
                            </div>
                            {ratedAreas.filter(a => a.notes).length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {ratedAreas.filter(a => a.notes).map(a => (
                                        <p key={a.area} className="text-xs text-muted-foreground">
                                            <span className="font-medium">{a.area}:</span> {a.notes}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Client */}
                        <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1">Client Contact</p>
                            {clientContactMade ? (
                                <div>
                                    <p className="text-sm">
                                        Met with <span className="font-medium">{clientContactName || 'contact'}</span>
                                    </p>
                                    {clientSatisfaction > 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {Array.from({ length: clientSatisfaction }).map((_, i) => (
                                                <Star key={i} className="w-3 h-3 text-green-500 fill-green-500" />
                                            ))}
                                            <span className="text-xs text-muted-foreground ml-1">satisfaction</span>
                                        </div>
                                    )}
                                    {clientFeedback && (
                                        <p className="text-xs text-muted-foreground mt-1">"{clientFeedback}"</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Client unavailable</p>
                            )}
                        </div>

                        {/* Upsell */}
                        {upsellNotes && (
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
                                <p className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> Upsell Opportunity
                                </p>
                                <p className="text-sm">{upsellNotes}</p>
                            </div>
                        )}

                        {/* Action Items */}
                        {actionItems.length > 0 && (
                            <div className="p-3 rounded-lg bg-muted/20">
                                <p className="text-xs text-muted-foreground mb-2">Action Items ({actionItems.length})</p>
                                {actionItems.map(item => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm py-1">
                                        <span className="text-xs">•</span>
                                        <span className="flex-1">{item.description}</span>
                                        <Badge variant="outline" className="text-[10px]">{item.assignedTo}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isFirstVisit && (
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
                                ★ This is the first site visit — make sure all stakeholders attended!
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
                {step > 0 && (
                    <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                )}
                <div className="flex-1" />
                {step < 4 ? (
                    <Button
                        onClick={() => setStep(s => s + 1)}
                        disabled={step === 0 && !checkedIn}
                        className="gap-2"
                    >
                        Next <ArrowRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || ratedAreas.length === 0}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                        {submitting ? 'Saving...' : 'Submit Visit'}
                        <Send className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
