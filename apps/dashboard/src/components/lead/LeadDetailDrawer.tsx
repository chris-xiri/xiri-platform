'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, orderBy, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead, LeadType, Contact } from '@xiri-facility-solutions/shared';
import { useFacilityTypes } from '@/lib/facilityTypes';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Building2, User, Mail, Phone, MapPin, Calendar, Clock,
    Briefcase, TrendingUp, Pencil, Check, X, Save, Loader2,
    FileText, ExternalLink, Plus, ChevronRight, Rocket, Send, Activity, LayoutDashboard, Calculator, Wrench, AlertTriangle, RefreshCcw
} from 'lucide-react';
import { format } from 'date-fns';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import LeadActivityFeed from './LeadActivityFeed';
import BookCallDialog from './BookCallDialog';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    getCapabilityLabel,
} from '@/lib/vendor-capabilities';

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
    'lost': 'bg-red-100 text-red-700 border-red-200',
    'churned': 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'walkthrough', 'proposal', 'quoted', 'won', 'lost', 'churned'] as const;

const LEAD_TYPE_LABELS: Record<string, string> = {
    'direct': 'Direct',
    'tenant': 'Tenant',
    'referral_partnership': 'Referral Partnership',
    'enterprise': 'Enterprise',
};

/* ─── Inline Capabilities Card for Drawer ─────────────────────── */

function DrawerCapabilities({ capabilities, onSave }: { capabilities: string[]; onSave: (caps: string[]) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState<string[]>(capabilities);
    const [saving, setSaving] = useState(false);

    // Sync when capabilities prop changes
    useEffect(() => { setSelected(capabilities); }, [capabilities]);

    const toggle = (val: string) => {
        setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(selected);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const grouped = (['cleaning', 'facility', 'specialty'] as const).map(g => ({
        group: g,
        label: CAPABILITY_GROUP_LABELS[g],
        items: VENDOR_CAPABILITIES.filter(c => c.group === g),
    }));

    return (
        <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Service Capabilities
                </CardTitle>
                {!editing && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { setSelected(capabilities); setEditing(true); }}>
                        <Pencil className="w-3 h-3" /> Edit
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {editing ? (
                    <div className="space-y-3">
                        {grouped.map(({ group, label, items }) => (
                            <div key={group}>
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">{label}</p>
                                <div className="flex flex-wrap gap-1">
                                    {items.map(cap => {
                                        const on = selected.includes(cap.value);
                                        return (
                                            <button
                                                key={cap.value}
                                                type="button"
                                                onClick={() => toggle(cap.value)}
                                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                                                    on
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted hover:border-primary/30'
                                                }`}
                                            >
                                                {cap.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2 justify-end pt-1">
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
                            <Button size="sm" className="h-6 text-xs gap-1" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                            </Button>
                        </div>
                    </div>
                ) : capabilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No capabilities — click Edit to add</p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {capabilities.map(cap => (
                            <Badge key={cap} variant="secondary" className="text-[11px]">
                                {getCapabilityLabel(cap)}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


interface LeadDetailDrawerProps {
    leadId: string | null;  // This is actually a contactId from the LeadList
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

export default function LeadDetailDrawer({ leadId: contactId, open, onClose }: LeadDetailDrawerProps) {
    const { facilityTypeLabels } = useFacilityTypes();
    const router = useRouter();
    // Contact data
    const [contact, setContact] = useState<Contact | null>(null);
    // Company data (the "lead" / company record)
    const [company, setCompany] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [notesEditing, setNotesEditing] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [quotesLoading, setQuotesLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [bookCallOpen, setBookCallOpen] = useState(false);

    // Fetch contact → then company
    useEffect(() => {
        if (!contactId || !open) {
            setContact(null);
            setCompany(null);
            setLoading(true);
            setActiveTab('overview');
            setBookCallOpen(false);
            return;
        }
        setLoading(true);

        // Listen to the contact document
        const unsubContact = onSnapshot(doc(db, 'contacts', contactId), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const contactData: Contact = {
                    id: snap.id,
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    companyId: data.companyId || '',
                    companyName: data.companyName || '',
                    role: data.role,
                    isPrimary: data.isPrimary ?? false,
                    unsubscribed: data.unsubscribed || false,
                    notes: data.notes || '',
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
                    createdBy: data.createdBy,
                    emailEngagement: data.emailEngagement,
                };
                setContact(contactData);

                // Fetch the associated company
                if (data.companyId) {
                    try {
                        const compSnap = await getDoc(doc(db, 'companies', data.companyId));
                        if (compSnap.exists()) {
                            const compData = compSnap.data();
                            setCompany({
                                id: compSnap.id,
                                ...compData,
                                createdAt: compData.createdAt?.toDate ? compData.createdAt.toDate() : new Date(compData.createdAt || Date.now()),
                                preferredAuditTimes: compData.preferredAuditTimes?.map((t: any) =>
                                    t?.toDate ? t.toDate() : new Date(t)
                                ),
                            } as Lead);
                        } else {
                            setCompany(null);
                        }
                    } catch (err) {
                        console.error('Failed to fetch company:', err);
                        setCompany(null);
                    }
                } else {
                    setCompany(null);
                }
            } else {
                setContact(null);
                setCompany(null);
            }
            setLoading(false);
        }, () => setLoading(false));

        return () => unsubContact();
    }, [contactId, open]);

    // Fetch quotes for the company (using companyId, or fallback to contactId for legacy leadId)
    useEffect(() => {
        const companyId = contact?.companyId;
        if (!companyId || !open) { setQuotes([]); return; }
        setQuotesLoading(true);

        // Try matching quotes by leadId (companies collection uses the same ID pattern)
        getDocs(query(
            collection(db, 'quotes'),
            where('leadId', '==', companyId),
            orderBy('createdAt', 'desc')
        )).then(snap => {
            setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(() => { }).finally(() => setQuotesLoading(false));
    }, [contact?.companyId, open]);

    // Update a field on the company document
    const updateCompanyField = useCallback(async (field: string, value: any) => {
        const companyId = contact?.companyId;
        if (!companyId) return;
        await updateDoc(doc(db, 'companies', companyId), { [field]: value, updatedAt: new Date() });
        // Re-fetch company to keep state fresh
        const compSnap = await getDoc(doc(db, 'companies', companyId));
        if (compSnap.exists()) {
            const compData = compSnap.data();
            setCompany({
                id: compSnap.id,
                ...compData,
                createdAt: compData.createdAt?.toDate ? compData.createdAt.toDate() : new Date(compData.createdAt || Date.now()),
                preferredAuditTimes: compData.preferredAuditTimes?.map((t: any) =>
                    t?.toDate ? t.toDate() : new Date(t)
                ),
            } as Lead);
        }
    }, [contact?.companyId]);

    // Update a field on the contact document
    const updateContactField = useCallback(async (field: string, value: any) => {
        if (!contactId) return;
        await updateDoc(doc(db, 'contacts', contactId), { [field]: value, updatedAt: new Date() });
    }, [contactId]);

    // Save email — clears bounce suppression if the address changed
    const handleEmailSave = useCallback(async (newEmail: string) => {
        if (!contactId) return;
        const emailChanged = newEmail.trim().toLowerCase() !== (contact?.email || '').trim().toLowerCase();
        const wasSuppressed = contact?.unsubscribed === true;

        // Always save the new email
        const contactUpdate: Record<string, any> = { email: newEmail, updatedAt: new Date() };

        // If the email actually changed and the contact was bounced, lift suppression
        if (emailChanged && wasSuppressed) {
            contactUpdate.unsubscribed = false;
            contactUpdate.unsubscribedAt = null;
            contactUpdate.unsubscribeReason = null;
            contactUpdate.lifecycleStatus = 'active';
            contactUpdate.lifecycleReason = null;
            contactUpdate.lifecycleUpdatedAt = new Date();
        }
        await updateDoc(doc(db, 'contacts', contactId), contactUpdate);

        // If suppression lifted, also restore the company to an actionable status
        if (emailChanged && wasSuppressed && contact?.companyId) {
            const companyUpdateData: Record<string, any> = {
                outreachStatus: null,
                unsubscribedAt: null,
                lostReason: null,
                updatedAt: new Date(),
            };
            // Only reset company status if it was auto-set to 'lost' due to bounce
            const companySnap = await getDoc(doc(db, 'companies', contact.companyId));
            if (companySnap.exists()) {
                const compData = companySnap.data();
                if (compData.status === 'lost' && compData.lostReason === 'hard_bounce') {
                    companyUpdateData.status = 'new';
                }
            }
            await updateDoc(doc(db, 'companies', contact.companyId), companyUpdateData);
        }
    }, [contactId, contact?.email, contact?.unsubscribed, contact?.companyId]);

    const handleStatusChange = async (newStatus: string) => {
        if (!contact?.companyId || newStatus === company?.status) return;
        setStatusUpdating(true);
        try {
            await updateCompanyField('status', newStatus);
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleLeadTypeChange = async (newType: string) => {
        if (!contact?.companyId || newType === company?.leadType) return;
        await updateCompanyField('leadType', newType);
    };

    const handleNotesSave = async () => {
        setNotesSaving(true);
        try {
            await updateContactField('notes', notesDraft);
        } finally {
            setNotesSaving(false);
        }
    };

    // Derived display values
    const displayName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : '';
    const businessName = company?.businessName || (company as any)?.name || contact?.companyName || '';
    const createdDate = contact ? toDate(contact.createdAt) : null;
    const companyId = contact?.companyId || '';

    return (
        <>
        <Sheet open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
            <SheetContent className="w-full sm:max-w-[680px] overflow-y-auto p-0" side="right">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <SheetTitle className="sr-only">Loading lead details</SheetTitle>
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                ) : !contact ? (
                    <div className="p-6 text-muted-foreground">
                        <SheetTitle className="sr-only">Lead not found</SheetTitle>
                        Lead not found
                    </div>
                ) : (
                    <>
                        {/* ─── Header (Contact-focused) ──── */}
                        <div className="sticky top-0 bg-card border-b px-5 py-4 z-10">
                            <div className="flex items-center gap-3 mb-2">
                                {/* Avatar — contact initials */}
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                                    {(contact.firstName?.charAt(0) || '').toUpperCase()}{(contact.lastName?.charAt(0) || '').toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    {/* Contact name — primary title */}
                                    <SheetTitle className="text-lg truncate">
                                        {displayName || 'Unnamed Contact'}
                                    </SheetTitle>
                                    {/* Company — secondary subtitle */}
                                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                                        <EditableField
                                            label="Business name"
                                            value={businessName}
                                            icon={() => null}
                                            onSave={(v) => updateCompanyField('businessName', v)}
                                            renderDisplay={(val) => (
                                                <span className="truncate text-muted-foreground">{val || 'Add company'}</span>
                                            )}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-muted-foreground"
                                    onClick={() => router.push(`/sales/crm/${contactId}`)}
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Full Page
                                </Button>
                            </div>
                            {/* Company selectors — compact row */}
                            <div className="flex items-center gap-2 pl-[52px]">
                                <select
                                    value={company?.status || 'new'}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    disabled={statusUpdating}
                                    className="text-xs font-medium px-2 py-0.5 rounded border bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label="Lead status"
                                >
                                    {STATUS_ORDER.map((s) => (
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                    ))}
                                </select>
                                <select
                                    value={company?.leadType || 'direct'}
                                    onChange={(e) => handleLeadTypeChange(e.target.value)}
                                    className="text-xs px-2 py-0.5 rounded border bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground"
                                    aria-label="Lead type"
                                >
                                    {Object.entries(LEAD_TYPE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* ─── Content ─────────────────────────── */}
                        <div className="p-5 space-y-4">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
                                <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                                    <TabsTrigger value="overview" className="gap-1 text-xs"><LayoutDashboard className="w-3.5 h-3.5" /> Overview</TabsTrigger>
                                    <TabsTrigger value="audit" className="gap-1 text-xs"><Calendar className="w-3.5 h-3.5" /> Audit</TabsTrigger>
                                    <TabsTrigger value="attribution" className="gap-1 text-xs"><TrendingUp className="w-3.5 h-3.5" /> Attribution</TabsTrigger>
                                    <TabsTrigger value="activity" className="gap-1 text-xs"><Activity className="w-3.5 h-3.5" /> Activity</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    {/* Contact — Inline Editable */}
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <User className="w-4 h-4" /> Contact
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2.5">
                                            {contact.unsubscribed && (
                                                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">
                                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <span className="font-semibold">Email bounced</span> — outreach blocked.
                                                        Update the email address below to lift suppression and re-enable sequence enrollment.
                                                    </div>
                                                </div>
                                            )}
                                            <EditableField
                                                label="First name"
                                                value={contact.firstName || ''}
                                                icon={User}
                                                onSave={(v) => updateContactField('firstName', v)}
                                                renderDisplay={(val) => (
                                                    <span>{displayName || 'Add contact name'}</span>
                                                )}
                                            />
                                            <EditableField
                                                label="Email"
                                                value={contact.email || ''}
                                                icon={Mail}
                                                type="email"
                                                linkPrefix="mailto:"
                                                onSave={handleEmailSave}
                                            />
                                            <EditableField
                                                label="Phone"
                                                value={contact.phone || ''}
                                                icon={Phone}
                                                type="tel"
                                                linkPrefix="tel:"
                                                onSave={(v) => updateContactField('phone', v)}
                                            />
                                            <EditableAddressField
                                                address={company?.address || ''}
                                                city={company?.city || ''}
                                                state={company?.state || ''}
                                                zip={company?.zip || company?.zipCode || ''}
                                                onSave={async (fields) => {
                                                    if (!companyId) return;
                                                    await updateDoc(doc(db, 'companies', companyId), {
                                                        address: fields.address,
                                                        city: fields.city,
                                                        state: fields.state,
                                                        zip: fields.zip,
                                                        updatedAt: new Date(),
                                                    });
                                                    // Re-fetch company
                                                    const compSnap = await getDoc(doc(db, 'companies', companyId));
                                                    if (compSnap.exists()) {
                                                        const compData = compSnap.data();
                                                        setCompany({
                                                            id: compSnap.id,
                                                            ...compData,
                                                            createdAt: compData.createdAt?.toDate ? compData.createdAt.toDate() : new Date(compData.createdAt || Date.now()),
                                                            preferredAuditTimes: compData.preferredAuditTimes?.map((t: any) =>
                                                                t?.toDate ? t.toDate() : new Date(t)
                                                            ),
                                                        } as Lead);
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>


                                    {/* Notes — Editable (stored on contact) */}
                                    <Card>
                                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Pencil className="w-4 h-4" /> Notes
                                            </CardTitle>
                                            {!notesEditing && (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                                                    onClick={() => { setNotesDraft(contact.notes || ''); setNotesEditing(true); }}>
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
                                                <p className={`text-sm ${contact.notes ? '' : 'text-muted-foreground italic'}`}>
                                                    {contact.notes || 'No notes yet — click Edit to add'}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Calculator Estimate — shown when company came from calculator */}
                                    {company?.calculatorData && (
                                        <Card className="border-sky-200 bg-sky-50/30">
                                            <CardHeader className="py-3 flex flex-row items-center justify-between">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Calculator className="w-4 h-4 text-sky-600" /> Calculator Estimate
                                                </CardTitle>
                                                <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700">
                                                    {company.source === 'calculator_client' ? 'Client Calculator' : 'Calculator'}
                                                </Badge>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                                    {company.facilityType && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Facility Type</p>
                                                            <p className="font-medium">{facilityTypeLabels[company.facilityType] || company.facilityType}</p>
                                                        </div>
                                                    )}
                                                    {(company.sqft || company.sqft === '0') && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Square Footage</p>
                                                            <p className="font-medium">{Number(company.sqft).toLocaleString()} sqft</p>
                                                        </div>
                                                    )}
                                                    {company.calculatorData.daysPerWeek && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Frequency</p>
                                                            <p className="font-medium">{company.calculatorData.daysPerWeek}x / week</p>
                                                        </div>
                                                    )}
                                                    {company.state && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">State</p>
                                                            <p className="font-medium">{company.state}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                {(company.calculatorData.monthlyLow || company.calculatorData.monthlyEstimate) && (
                                                    <div className="bg-card rounded-lg border p-3 text-center">
                                                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Monthly Estimate</p>
                                                        {company.calculatorData.monthlyLow ? (
                                                            <p className="text-lg font-bold text-sky-700">
                                                                {fmt(company.calculatorData.monthlyLow)} – {fmt(company.calculatorData.monthlyHigh!)}
                                                            </p>
                                                        ) : (
                                                            <p className="text-lg font-bold text-sky-700">
                                                                ~{fmt(company.calculatorData.monthlyEstimate!)}/mo
                                                            </p>
                                                        )}
                                                        {company.calculatorData.monthlyEstimate && (
                                                            <p className="text-xs text-muted-foreground">Mid-point: {fmt(company.calculatorData.monthlyEstimate)}/mo</p>
                                                        )}
                                                    </div>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full mt-3 h-8 text-xs gap-1.5 border-sky-300 text-sky-700 hover:bg-sky-100"
                                                    onClick={() => {
                                                        if (!companyId) return;
                                                        const params = new URLSearchParams({
                                                            new: 'true',
                                                            leadId: companyId,
                                                            ...(company.calculatorData?.monthlyEstimate ? { rate: String(company.calculatorData.monthlyEstimate) } : {}),
                                                            ...(company.facilityType ? { facilityType: company.facilityType } : {}),
                                                            ...(company.sqft ? { sqft: String(company.sqft) } : {}),
                                                        });
                                                        router.push(`/sales/quotes?${params.toString()}`);
                                                    }}
                                                >
                                                    <Rocket className="w-3 h-3" /> Create Quote from Estimate
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}

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
                                                onClick={() => router.push(`/sales/quotes?new=true&leadId=${companyId}`)}>
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

                                    {/* Meta */}
                                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                                        <p><span className="font-medium">Contact ID:</span> {contact.id}</p>
                                        {companyId && <p><span className="font-medium">Company ID:</span> {companyId}</p>}
                                        {createdDate && <p><span className="font-medium">Created:</span> {format(createdDate, 'MMM d, yyyy h:mm a')}</p>}
                                    </div>
                                </TabsContent>

                                <TabsContent value="audit" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Calendar className="w-4 h-4" /> Audit Booking
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {company?.preferredAuditTimes && company.preferredAuditTimes.length > 0 ? (
                                                <div className="space-y-2">
                                                    {company.preferredAuditTimes.map((time, idx) => {
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
                                            {company?.serviceInterest && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="capitalize">{company.serviceInterest.replace(/_/g, ' ')}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Book Discovery Call via TidyCal */}
                                    <Card>
                                        <CardContent className="py-4">
                                            <Button
                                                onClick={() => setBookCallOpen(true)}
                                                className="w-full gap-2"
                                                variant="outline"
                                            >
                                                <Calendar className="w-4 h-4" />
                                                Book Discovery Call
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attribution" className="space-y-4">
                                    {company?.attribution && (company.attribution.source || company.attribution.medium || company.attribution.campaign) ? (
                                        <Card>
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4" /> Attribution
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    {company.attribution.source && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Source</p>
                                                            <p className="font-medium capitalize">{company.attribution.source}</p>
                                                        </div>
                                                    )}
                                                    {company.attribution.medium && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Medium</p>
                                                            <p className="capitalize">{company.attribution.medium}</p>
                                                        </div>
                                                    )}
                                                    {company.attribution.campaign && (
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] uppercase text-muted-foreground">Campaign</p>
                                                            <p>{company.attribution.campaign}</p>
                                                        </div>
                                                    )}
                                                    {company.attribution.landingPage && (
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] uppercase text-muted-foreground">Landing Page</p>
                                                            <p className="text-xs text-primary break-all">{company.attribution.landingPage}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                                            <h3 className="font-medium text-sm">No Attribution Data</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Attribution data appears when leads come through tracked campaigns.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="activity">
                                    <LeadActivityFeed leadId={companyId || contactId!} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>

            {contact && (
                <BookCallDialog
                    open={bookCallOpen}
                    onClose={() => setBookCallOpen(false)}
                    entityId={companyId || contact.id!}
                    entityName={businessName || displayName || 'Lead'}
                    entityEmail={contact.email || ''}
                    entityType="lead"
                    onBooked={(booking) => {
                        console.log('Discovery call booked:', booking);
                    }}
                />
            )}
        </>
    );
}
