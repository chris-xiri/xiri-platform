'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead, LeadType } from '@xiri/shared';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Building2, User, Mail, Phone, MapPin, Calendar, Clock,
    Briefcase, TrendingUp, Pencil, Check, X, Save, Loader2,
    FileText, ExternalLink, Plus, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

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

const LEAD_TYPE_LABELS: Record<LeadType, string> = {
    'direct': 'Direct',
    'tenant': 'Tenant',
    'referral_partnership': 'Referral Partnership',
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

const QUOTE_BADGE: Record<string, { color: string; label: string }> = {
    draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
    sent: { color: 'bg-blue-100 text-blue-700', label: 'Sent' },
    accepted: { color: 'bg-green-100 text-green-700', label: 'Accepted' },
    rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    expired: { color: 'bg-gray-100 text-gray-500', label: 'Expired' },
    changes_requested: { color: 'bg-amber-100 text-amber-700', label: 'Changes' },
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

/* ─── Inline Editable Field ───────────────────────────────────────── */

function EditableField({
    label,
    value,
    icon: Icon,
    onSave,
    type = 'text',
    linkPrefix,
    renderDisplay,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    onSave: (val: string) => Promise<void>;
    type?: string;
    linkPrefix?: string;
    renderDisplay?: (val: string) => React.ReactNode;
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
            {renderDisplay ? renderDisplay(value) : linkPrefix && value ? (
                <a href={`${linkPrefix}${value}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{value}</a>
            ) : (
                <span className={value ? '' : 'text-muted-foreground italic'}>{value || `Add ${label.toLowerCase()}`}</span>
            )}
            <Pencil className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-opacity ml-auto flex-shrink-0" />
        </div>
    );
}

/* ─── Editable Address with Google Places Autocomplete ──────────── */

function EditableAddressField({
    address,
    city,
    state,
    zip,
    onSave,
}: {
    address: string;
    city: string;
    state: string;
    zip: string;
    onSave: (fields: { address: string; city: string; state: string; zip: string }) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({ address, city, state, zip });
    const [autocompleteValue, setAutocompleteValue] = useState<any>(null);

    const handlePlaceSelect = (selected: any) => {
        setAutocompleteValue(selected);
        if (selected?.value?.place_id) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ placeId: selected.value.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const components = results[0].address_components;
                    let streetNumber = '';
                    let route = '';
                    let newCity = '';
                    let newState = '';
                    let newZip = '';

                    components.forEach((c: any) => {
                        if (c.types.includes('street_number')) streetNumber = c.long_name;
                        if (c.types.includes('route')) route = c.long_name;
                        if (c.types.includes('locality')) newCity = c.long_name;
                        if (c.types.includes('sublocality_level_1') && !newCity) newCity = c.long_name;
                        if (c.types.includes('administrative_area_level_1')) newState = c.short_name;
                        if (c.types.includes('postal_code')) newZip = c.long_name;
                    });

                    setDraft({
                        address: `${streetNumber} ${route}`.trim(),
                        city: newCity,
                        state: newState,
                        zip: newZip,
                    });
                }
            });
        }
    };

    const handleZipChange = async (zipVal: string) => {
        setDraft(prev => ({ ...prev, zip: zipVal }));
        if (/^\d{5}$/.test(zipVal)) {
            try {
                const res = await fetch(`https://api.zippopotam.us/us/${zipVal}`);
                if (res.ok) {
                    const data = await res.json();
                    const place = data.places?.[0];
                    if (place) {
                        setDraft(prev => ({
                            ...prev,
                            city: place['place name'] || prev.city || '',
                            state: place['state abbreviation'] || prev.state || '',
                        }));
                    }
                }
            } catch { /* ignore lookup errors */ }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            setEditing(false);
        } catch (e) {
            console.error('Address save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraft({ address, city, state, zip });
        setAutocompleteValue(null);
        setEditing(false);
    };

    const startEditing = () => {
        setDraft({ address, city, state, zip });
        setAutocompleteValue(null);
        setEditing(true);
    };

    if (editing) {
        return (
            <div className="space-y-2.5 py-1">
                <div>
                    <label className="text-[10px] uppercase text-muted-foreground font-medium">Search Address</label>
                    <GooglePlacesAutocomplete
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                        autocompletionRequest={{
                            componentRestrictions: { country: ['us'] },
                        }}
                        selectProps={{
                            value: autocompleteValue,
                            onChange: handlePlaceSelect,
                            placeholder: 'Start typing address...',
                            styles: {
                                control: (base: any) => ({
                                    ...base,
                                    minHeight: '32px',
                                    fontSize: '14px',
                                    backgroundColor: 'hsl(var(--input))',
                                    borderColor: 'hsl(var(--border))',
                                    color: 'hsl(var(--foreground))',
                                    '&:hover': { borderColor: 'hsl(var(--ring))' },
                                }),
                                input: (base: any) => ({
                                    ...base,
                                    margin: 0,
                                    padding: 0,
                                    color: 'hsl(var(--foreground))',
                                }),
                                singleValue: (base: any) => ({
                                    ...base,
                                    color: 'hsl(var(--foreground))',
                                }),
                                placeholder: (base: any) => ({
                                    ...base,
                                    color: 'hsl(var(--muted-foreground))',
                                }),
                                menu: (base: any) => ({
                                    ...base,
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    zIndex: 50,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    opacity: 1,
                                }),
                                menuPortal: (base: any) => ({
                                    ...base,
                                    zIndex: 9999,
                                }),
                                menuList: (base: any) => ({
                                    ...base,
                                    padding: '4px',
                                }),
                                option: (base: any, state: any) => ({
                                    ...base,
                                    backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'hsl(var(--popover))',
                                    color: 'hsl(var(--foreground))',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    '&:active': { backgroundColor: 'hsl(var(--accent))' },
                                }),
                                noOptionsMessage: (base: any) => ({
                                    ...base,
                                    color: 'hsl(var(--muted-foreground))',
                                }),
                                loadingMessage: (base: any) => ({
                                    ...base,
                                    color: 'hsl(var(--muted-foreground))',
                                }),
                            },
                        }}
                    />
                </div>
                <div className="grid grid-cols-1 gap-2">
                    <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-medium">Street Address</label>
                        <Input className="h-7 text-sm" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="123 Main St" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">City</label>
                            <Input className="h-7 text-sm" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="City" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">State</label>
                            <Input className="h-7 text-sm" value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })} placeholder="NY" maxLength={2} />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">ZIP</label>
                            <Input className="h-7 text-sm" value={draft.zip} onChange={e => handleZipChange(e.target.value)} placeholder="10001" maxLength={5} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCancel}>Cancel</Button>
                    <Button size="sm" className="h-6 text-xs gap-1" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm group cursor-pointer" onClick={startEditing}>
                <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className={address ? '' : 'text-muted-foreground italic'}>{address || 'Add address'}</span>
                <Pencil className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-opacity ml-auto flex-shrink-0" />
            </div>
            {(city || state || zip) && (
                <div className="flex items-center gap-2 text-sm pl-[22px] text-muted-foreground cursor-pointer" onClick={startEditing}>
                    {[city, state].filter(Boolean).join(', ')}{zip ? ` ${zip}` : ''}
                </div>
            )}
        </div>
    );
}

/* ─── Main Drawer ──────────────────────────────────────────────────── */

export default function LeadDetailDrawer({ leadId, open, onClose }: LeadDetailDrawerProps) {
    const router = useRouter();
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [notesEditing, setNotesEditing] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [quotesLoading, setQuotesLoading] = useState(false);

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

    // Fetch quotes for this lead
    useEffect(() => {
        if (!leadId || !open) { setQuotes([]); return; }
        setQuotesLoading(true);
        getDocs(query(
            collection(db, 'quotes'),
            where('leadId', '==', leadId),
            orderBy('createdAt', 'desc')
        )).then(snap => {
            setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(() => { }).finally(() => setQuotesLoading(false));
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
            <SheetContent className="w-full sm:max-w-[680px] overflow-y-auto p-0" side="right">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                ) : !lead ? (
                    <div className="p-6 text-muted-foreground">Lead not found</div>
                ) : (
                    <>
                        {/* ─── Header (matches VendorDetailDrawer) ──── */}
                        <div className="sticky top-0 bg-card border-b px-5 py-4 z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                                    {lead.businessName?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <EditableField
                                        label="Business name"
                                        value={lead.businessName || ''}
                                        icon={() => null}
                                        onSave={(v) => updateField('businessName', v)}
                                        renderDisplay={(val) => (
                                            <SheetTitle className="text-lg truncate group-[]:cursor-pointer">{val || 'Unnamed Lead'}</SheetTitle>
                                        )}
                                    />
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <select
                                            value={lead.status}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            disabled={statusUpdating}
                                            className="text-xs font-medium px-2 py-0.5 rounded border bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            {STATUS_ORDER.map((s) => (
                                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={lead.facilityType || ''}
                                            onChange={(e) => updateField('facilityType', e.target.value)}
                                            className="text-xs px-2 py-0.5 rounded border bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary text-muted-foreground"
                                        >
                                            {Object.entries(FACILITY_TYPE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={lead.leadType || 'direct'}
                                            onChange={(e) => updateField('leadType', e.target.value)}
                                            className="text-xs px-2 py-0.5 rounded border bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary text-muted-foreground"
                                        >
                                            {Object.entries(LEAD_TYPE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
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
                                    <EditableAddressField
                                        address={lead.address || ''}
                                        city={lead.city || ''}
                                        state={lead.state || ''}
                                        zip={lead.zip || lead.zipCode || ''}
                                        onSave={async (fields) => {
                                            if (!leadId) return;
                                            await updateDoc(doc(db, 'leads', leadId), {
                                                address: fields.address,
                                                city: fields.city,
                                                state: fields.state,
                                                zip: fields.zip,
                                                updatedAt: new Date(),
                                            });
                                        }}
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

                            {/* Quotes — Linked Records */}
                            <Card>
                                <CardHeader className="py-3 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Quotes
                                        {quotes.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px] ml-1">{quotes.length}</Badge>
                                        )}
                                    </CardTitle>
                                    <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                                        onClick={() => router.push('/sales/quotes')}>
                                        <Plus className="w-3 h-3" /> Create Quote
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {quotesLoading ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : quotes.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No quotes yet for this lead</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {quotes.map((q) => {
                                                const badge = QUOTE_BADGE[q.status] || QUOTE_BADGE.draft;
                                                const created = q.createdAt?.toDate?.()
                                                    ? q.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                    : '—';
                                                return (
                                                    <div
                                                        key={q.id}
                                                        className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors group"
                                                        onClick={() => router.push(`/sales/quotes/${q.id}`)}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">
                                                                    v{q.version || 1} — {fmt(q.totalMonthlyRate || 0)}/mo
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {q.lineItems?.length || 0} services • {created}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                                                                {badge.label}
                                                            </span>
                                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-opacity" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
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
