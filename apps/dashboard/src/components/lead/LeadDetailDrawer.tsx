'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead } from '@xiri/shared';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Building2, User, Mail, Phone, MapPin, Calendar, Clock,
    Briefcase, TrendingUp, Pencil, Check, X, Save, Loader2
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

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'walkthrough', 'proposal', 'quoted', 'won', 'lost', 'churned'] as const;

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

/* ─── Inline Editable Field ───────────────────────────────────────── */

function EditableField({
    label,
    value,
    icon: Icon,
    onSave,
    type = 'text',
    linkPrefix,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    onSave: (val: string) => Promise<void>;
    type?: string;
    linkPrefix?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (draft === value) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(draft);
            setEditing(false);
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => { setDraft(value); setEditing(false); };

    if (editing) {
        return (
            <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    type={type}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-green-600" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel}>
                    <X className="w-3 h-3 text-red-500" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm group cursor-pointer" onClick={() => setEditing(true)}>
            <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            {linkPrefix && value ? (
                <a href={`${linkPrefix}${value}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{value}</a>
            ) : (
                <span className={value ? '' : 'text-muted-foreground italic'}>{value || `Add ${label.toLowerCase()}`}</span>
            )}
            <Pencil className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-opacity ml-auto flex-shrink-0" />
        </div>
    );
}

/* ─── Main Drawer ──────────────────────────────────────────────────── */

export default function LeadDetailDrawer({ leadId, open, onClose }: LeadDetailDrawerProps) {
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [notesEditing, setNotesEditing] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);

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

    const updateField = useCallback(async (field: string, value: any) => {
        if (!leadId) return;
        await updateDoc(doc(db, 'leads', leadId), { [field]: value, updatedAt: new Date() });
    }, [leadId]);

    const handleStatusChange = async (newStatus: string) => {
        if (!leadId || newStatus === lead?.status) return;
        setStatusUpdating(true);
        try {
            await updateField('status', newStatus);
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleNotesSave = async () => {
        setNotesSaving(true);
        try {
            await updateField('notes', notesDraft);
            setNotesEditing(false);
        } finally {
            setNotesSaving(false);
        }
    };

    const createdDate = lead ? toDate(lead.createdAt) : null;

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
                        {/* ─── Header ──────────────────────────── */}
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

                            {/* Status Quick Actions */}
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {STATUS_ORDER.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => handleStatusChange(s)}
                                        disabled={statusUpdating || s === lead.status}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all
                                            ${s === lead.status
                                                ? STATUS_COLORS[s] + ' ring-1 ring-offset-1'
                                                : 'bg-muted/30 text-muted-foreground hover:bg-muted border-transparent hover:border-border'
                                            }
                                            ${statusUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ─── Content ─────────────────────────── */}
                        <div className="p-5 space-y-4">
                            {/* Contact — Inline Editable */}
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <User className="w-4 h-4" /> Contact
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2.5">
                                    <EditableField
                                        label="Contact name"
                                        value={lead.contactName || ''}
                                        icon={User}
                                        onSave={(v) => updateField('contactName', v)}
                                    />
                                    <EditableField
                                        label="Email"
                                        value={lead.email || ''}
                                        icon={Mail}
                                        type="email"
                                        linkPrefix="mailto:"
                                        onSave={(v) => updateField('email', v)}
                                    />
                                    <EditableField
                                        label="Phone"
                                        value={lead.contactPhone || ''}
                                        icon={Phone}
                                        type="tel"
                                        linkPrefix="tel:"
                                        onSave={(v) => updateField('contactPhone', v)}
                                    />
                                    <EditableField
                                        label="Address"
                                        value={lead.address || ''}
                                        icon={MapPin}
                                        onSave={(v) => updateField('address', v)}
                                    />
                                    <EditableField
                                        label="ZIP code"
                                        value={lead.zipCode || ''}
                                        icon={MapPin}
                                        onSave={(v) => updateField('zipCode', v)}
                                    />
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
                                </CardContent>
                            </Card>

                            {/* Notes — Editable */}
                            <Card>
                                <CardHeader className="py-3 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Pencil className="w-4 h-4" /> Notes
                                    </CardTitle>
                                    {!notesEditing && (
                                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                                            onClick={() => { setNotesDraft(lead.notes || ''); setNotesEditing(true); }}>
                                            <Pencil className="w-3 h-3" /> Edit
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {notesEditing ? (
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                                                value={notesDraft}
                                                onChange={(e) => setNotesDraft(e.target.value)}
                                                placeholder="Add notes about this lead..."
                                                autoFocus
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNotesEditing(false)}>
                                                    Cancel
                                                </Button>
                                                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleNotesSave} disabled={notesSaving}>
                                                    {notesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                    Save
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className={`text-sm ${lead.notes ? '' : 'text-muted-foreground italic'}`}>
                                            {lead.notes || 'No notes yet — click Edit to add'}
                                        </p>
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
