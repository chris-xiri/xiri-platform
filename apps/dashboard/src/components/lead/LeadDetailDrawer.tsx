'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead } from '@xiri/shared';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Building2, User, Mail, Phone, MapPin, Calendar, Clock,
    Briefcase, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    try { return new Date(value); } catch { return null; }
}

const STATUS_COLORS: Record<string, string> = {
    'new': 'bg-blue-100 text-blue-800 border-blue-200',
    'contacted': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'qualified': 'bg-green-100 text-green-800 border-green-200',
    'walkthrough': 'bg-purple-100 text-purple-800 border-purple-200',
    'proposal': 'bg-orange-100 text-orange-800 border-orange-200',
    'quoted': 'bg-sky-100 text-sky-800 border-sky-200',
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 text-gray-800 border-gray-200',
    'churned': 'bg-red-100 text-red-800 border-red-200',
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
    'medical_urgent_care': 'Urgent Care',
    'medical_private': 'Private Practice',
    'medical_surgery': 'Surgery Center',
    'medical_dialysis': 'Dialysis Center',
    'auto_dealer_showroom': 'Auto Dealership',
    'auto_service_center': 'Auto Service Center',
    'edu_daycare': 'Daycare',
    'edu_private_school': 'Private School',
    'office_general': 'General Office',
    'fitness_gym': 'Fitness Gym',
    'other': 'Other'
};

interface LeadDetailDrawerProps {
    leadId: string | null;
    open: boolean;
    onClose: () => void;
}

export default function LeadDetailDrawer({ leadId, open, onClose }: LeadDetailDrawerProps) {
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!leadId || !open) { setLead(null); setLoading(true); return; }
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'leads', leadId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setLead({
                    id: snap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    preferredAuditTimes: data.preferredAuditTimes?.map((t: any) =>
                        t?.toDate ? t.toDate() : new Date(t)
                    ),
                } as Lead);
            }
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, [leadId, open]);

    const createdDate = lead ? toDate(lead.createdAt) : null;
    const firstAuditTime = lead?.preferredAuditTimes?.[0] ? toDate(lead.preferredAuditTimes[0]) : null;

    return (
        <Sheet open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
            <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto p-0" side="right">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                ) : !lead ? (
                    <div className="p-6 text-muted-foreground">Lead not found</div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-card border-b px-5 py-4 z-10">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <SheetTitle className="text-lg">{lead.businessName}</SheetTitle>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                            {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                                        </span>
                                    </div>
                                </div>
                                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[lead.status]}`}>
                                    {lead.status}
                                </Badge>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            {/* Contact */}
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <User className="w-4 h-4" /> Contact
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {lead.contactName && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                                            {lead.contactName}
                                        </div>
                                    )}
                                    {lead.email && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                            <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
                                        </div>
                                    )}
                                    {lead.contactPhone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                            <a href={`tel:${lead.contactPhone}`} className="text-primary hover:underline">{lead.contactPhone}</a>
                                        </div>
                                    )}
                                    {lead.address && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                            {lead.address}
                                        </div>
                                    )}
                                    {lead.zipCode && (
                                        <div className="text-xs text-muted-foreground pl-6">ZIP: {lead.zipCode}</div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Audit Booking */}
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Audit Booking
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {lead.preferredAuditTimes && lead.preferredAuditTimes.length > 0 ? (
                                        <div className="space-y-2">
                                            {lead.preferredAuditTimes.map((time, idx) => {
                                                const d = toDate(time);
                                                return d ? (
                                                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg text-sm">
                                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">{format(d, 'EEEE, MMMM d, yyyy')}</p>
                                                            <p className="text-xs text-muted-foreground">{format(d, 'h:mm a')}</p>
                                                        </div>
                                                        {idx === 0 && <Badge variant="secondary" className="ml-auto text-[10px]">Primary</Badge>}
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No audit times scheduled</p>
                                    )}
                                    {lead.serviceInterest && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="capitalize">{lead.serviceInterest.replace(/_/g, ' ')}</span>
                                        </div>
                                    )}
                                    {lead.notes && (
                                        <div className="text-sm p-3 bg-muted/30 rounded-lg border">{lead.notes}</div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Attribution */}
                            {lead.attribution && (lead.attribution.source || lead.attribution.medium || lead.attribution.campaign) && (
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" /> Attribution
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            {lead.attribution.source && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-muted-foreground">Source</p>
                                                    <p className="font-medium capitalize">{lead.attribution.source}</p>
                                                </div>
                                            )}
                                            {lead.attribution.medium && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-muted-foreground">Medium</p>
                                                    <p className="capitalize">{lead.attribution.medium}</p>
                                                </div>
                                            )}
                                            {lead.attribution.campaign && (
                                                <div className="col-span-2">
                                                    <p className="text-[10px] uppercase text-muted-foreground">Campaign</p>
                                                    <p>{lead.attribution.campaign}</p>
                                                </div>
                                            )}
                                            {lead.attribution.landingPage && (
                                                <div className="col-span-2">
                                                    <p className="text-[10px] uppercase text-muted-foreground">Landing Page</p>
                                                    <p className="text-xs text-primary break-all">{lead.attribution.landingPage}</p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Meta */}
                            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                                <p><span className="font-medium">ID:</span> {lead.id}</p>
                                {createdDate && <p><span className="font-medium">Created:</span> {format(createdDate, 'MMM d, yyyy h:mm a')}</p>}
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
