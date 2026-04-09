"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead, LeadType, FACILITY_TYPE_LABELS, FACILITY_TYPE_OPTIONS } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import {
    ArrowLeft,
    Building2,
    Phone,
    MapPin,
    TrendingUp,
    Loader2,
    Tag,
    Pencil,
    Check,
    X,
    FileText,
    Wrench,
} from 'lucide-react';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    getCapabilityLabel,
} from '@/lib/vendor-capabilities';
import { format } from 'date-fns';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CompanyHub from './CompanyHub';



// Helper to safely convert Firestore Timestamp to Date
function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    try {
        return new Date(value);
    } catch {
        return null;
    }
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



const LEAD_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
    'direct': { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Direct' },
    'tenant': { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Tenant' },
    'referral_partnership': { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Referral Partnership' },
    'enterprise': { color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Enterprise' },
};

/* ─── Inline Editable Field ─────────────────────────────────────── */

function EditableField({
    label,
    value,
    icon: Icon,
    onSave,
    type = 'text',
    linkPrefix,
    renderDisplay,
    multiline,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    onSave: (val: string) => Promise<void>;
    type?: string;
    linkPrefix?: string;
    renderDisplay?: (val: string) => React.ReactNode;
    multiline?: boolean;
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
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {multiline ? (
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-y"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
                    />
                ) : (
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        type={type}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                    />
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
                    <X className="w-3.5 h-3.5 text-red-500" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {renderDisplay ? renderDisplay(value) : linkPrefix && value ? (
                <a href={`${linkPrefix}${value}`} className="text-base text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{value}</a>
            ) : (
                <span className={`text-base ${value ? 'font-medium' : 'text-muted-foreground italic'}`}>{value || `Add ${label.toLowerCase()}`}</span>
            )}
            <Pencil className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-opacity ml-auto flex-shrink-0" />
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
            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium text-muted-foreground">Search Address</label>
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
                                    minHeight: '36px',
                                    fontSize: '14px',
                                    backgroundColor: 'hsl(var(--input))',
                                    borderColor: 'hsl(var(--border))',
                                    color: 'hsl(var(--foreground))',
                                    '&:hover': { borderColor: 'hsl(var(--ring))' },
                                }),
                                input: (base: any) => ({ ...base, margin: 0, padding: 0, color: 'hsl(var(--foreground))' }),
                                singleValue: (base: any) => ({ ...base, color: 'hsl(var(--foreground))' }),
                                placeholder: (base: any) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
                                menu: (base: any) => ({
                                    ...base,
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    zIndex: 50,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                }),
                                menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                                option: (base: any, state: any) => ({
                                    ...base,
                                    backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'hsl(var(--popover))',
                                    color: 'hsl(var(--foreground))',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    borderRadius: '4px',
                                    '&:active': { backgroundColor: 'hsl(var(--accent))' },
                                }),
                            },
                        }}
                    />
                </div>
                <div className="grid grid-cols-1 gap-2">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Street Address</label>
                        <Input className="h-8 text-sm" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="123 Main St" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">City</label>
                            <Input className="h-8 text-sm" value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} placeholder="City" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">State</label>
                            <Input className="h-8 text-sm" value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })} placeholder="NY" maxLength={2} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">ZIP</label>
                            <Input className="h-8 text-sm" value={draft.zip} onChange={e => handleZipChange(e.target.value)} placeholder="10001" maxLength={5} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                    </Button>
                </div>
            </div>
        );
    }

    const displayParts = [address, [city, state].filter(Boolean).join(', '), zip].filter(Boolean);

    return (
        <div className="group cursor-pointer" onClick={startEditing}>
            <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <p className={`text-base ${address ? 'font-medium' : 'text-muted-foreground italic'}`}>
                        {address || 'Add address'}
                    </p>
                    {(city || state || zip) && (
                        <p className="text-sm text-muted-foreground">
                            {[city, state].filter(Boolean).join(', ')}{zip ? ` ${zip}` : ''}
                        </p>
                    )}
                </div>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-opacity flex-shrink-0 mt-1" />
            </div>
        </div>
    );
}

/* ─── Service Capabilities Card (reusable) ────────────────────── */

function ServiceCapabilitiesCard({ capabilities, onSave }: { capabilities: string[]; onSave: (caps: string[]) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState<string[]>(capabilities);
    const [saving, setSaving] = useState(false);

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
            <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="flex items-center gap-2 text-base">
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
                    <div className="space-y-4">
                        {grouped.map(({ group, label, items }) => (
                            <div key={group}>
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">{label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {items.map(cap => {
                                        const on = selected.includes(cap.value);
                                        return (
                                            <button
                                                key={cap.value}
                                                type="button"
                                                onClick={() => toggle(cap.value)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
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
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                            </Button>
                        </div>
                    </div>
                ) : capabilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No capabilities set — click Edit to add</p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {capabilities.map(cap => (
                            <Badge key={cap} variant="secondary" className="text-xs">
                                {getCapabilityLabel(cap)}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState<{ id: string; type: string; description: string; createdAt: any; metadata?: any }[]>([]);

    const fetchLead = async () => {
        try {
            const leadDoc = await getDoc(doc(db, 'companies', leadId));
            if (leadDoc.exists()) {
                const data = leadDoc.data();
                setLead({
                    id: leadDoc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    preferredAuditTimes: data.preferredAuditTimes?.map((t: any) =>
                        t?.toDate ? t.toDate() : new Date(t)
                    )
                } as Lead);
            } else {
                router.push('/sales/crm');
            }
        } catch (error) {
            console.error('Error fetching lead:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async () => {
        try {
            const q = query(
                collection(db, 'lead_activities'),
                where('leadId', '==', leadId),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        } catch (err) {
            console.error('Error fetching activities:', err);
        }
    };





    useEffect(() => {
        fetchLead();
        fetchActivities();
    }, [leadId]);

    // ─── Generic field update helper ─────────────────────────
    const updateField = useCallback(async (field: string, value: any) => {
        if (!leadId) return;
        await updateDoc(doc(db, 'companies', leadId), { [field]: value, updatedAt: new Date() });
        // Re-fetch updated lead data
        await fetchLead();
    }, [leadId]);





    if (loading) {
        return (
            <ProtectedRoute resource="sales/crm">
                <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading lead...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!lead) return null;

    const createdDate = toDate(lead.createdAt);
    const leadType = (lead as any).leadType || 'direct';
    const typeConfig = LEAD_TYPE_CONFIG[leadType] || LEAD_TYPE_CONFIG['direct'];

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/sales/crm')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to CRM
                        </Button>
                        <div>
                            <EditableField
                                label="Business name"
                                value={lead.businessName || (lead as any).name || ''}
                                icon={Building2}
                                onSave={(v) => updateField('businessName', v)}
                                renderDisplay={(val) => (
                                    <h1 className="text-3xl font-bold">{val || 'Unnamed Business'}</h1>
                                )}
                            />
                            <div className="flex items-center gap-2 mt-0.5">
                                <select
                                    value={lead.facilityType || 'other'}
                                    onChange={async (e) => {
                                        await updateField('facilityType', e.target.value);
                                    }}
                                    className="text-sm text-muted-foreground bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 cursor-pointer transition-colors outline-none focus:ring-1 focus:ring-primary/30"
                                >
                                    {FACILITY_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                    {typeConfig.label}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <Badge variant="outline" className={`text-sm ${STATUS_COLORS[lead.status] || ''}`}>
                        {lead.status?.charAt(0).toUpperCase() + lead.status?.slice(1)}
                    </Badge>
                </div>

                {/* ═══ Company Dashboard Hub ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-auto">
                    {/* Left Column — Hub: Contacts, Work Orders, Quotes, Contracts, Timeline */}
                    <div className="lg:col-span-2">
                        <CompanyHub companyId={leadId} activities={activities} />
                    </div>

                    {/* Right Column — Company Details & Attribution */}
                    <div className="space-y-4">
                        {/* Company Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Building2 className="w-4 h-4" /> Company Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                                    <EditableField label="Phone" value={lead.contactPhone || ''} icon={Phone} type="tel" linkPrefix="tel:" onSave={(v) => updateField('contactPhone', v)} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Sq Ft</label>
                                    <EditableField label="Square footage" value={String((lead as any).squareFootage || '')} icon={Building2} onSave={(v) => updateField('squareFootage', v ? Number(v) : '')} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                                    <EditableAddressField
                                        address={lead.address || ''}
                                        city={(lead as any).city || ''}
                                        state={(lead as any).state || ''}
                                        zip={lead.zipCode || ''}
                                        onSave={async (fields) => {
                                            await updateDoc(doc(db, 'companies', leadId), {
                                                address: fields.address,
                                                city: fields.city,
                                                state: fields.state,
                                                zipCode: fields.zip,
                                                updatedAt: new Date(),
                                            });
                                            await fetchLead();
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                                    <EditableField
                                        label="Notes"
                                        value={lead.notes || ''}
                                        icon={FileText}
                                        multiline
                                        onSave={(v) => updateField('notes', v)}
                                        renderDisplay={(val) => (
                                            <span className={val ? 'text-sm' : 'text-muted-foreground italic text-sm'}>
                                                {val || 'Add notes'}
                                            </span>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Service Capabilities — only for vendor/subcontractor companies, not leads */}
                        {leadType === 'vendor' && (
                            <ServiceCapabilitiesCard
                                capabilities={(lead as any).serviceCapabilities || []}
                                onSave={async (caps) => {
                                    await updateField('serviceCapabilities', caps);
                                }}
                            />
                        )}


                        {/* Attribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="w-4 h-4" /> Attribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {lead.attribution?.source && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Source</label>
                                        <p className="text-sm font-medium capitalize">{lead.attribution.source}</p>
                                    </div>
                                )}
                                {lead.attribution?.medium && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Medium</label>
                                        <p className="text-sm capitalize">{lead.attribution.medium}</p>
                                    </div>
                                )}
                                {lead.attribution?.campaign && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Campaign</label>
                                        <p className="text-sm">{lead.attribution.campaign}</p>
                                    </div>
                                )}
                                {lead.attribution?.landingPage && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Landing Page</label>
                                        <p className="text-xs text-blue-600 break-all">{lead.attribution.landingPage}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Company Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">ID</label>
                                    <p className="text-xs font-mono bg-muted/50 p-2 rounded">{lead.id}</p>
                                </div>
                                {createdDate && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                                        <p className="text-sm">{format(createdDate, 'MMM d, yyyy h:mm a')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>


        </ProtectedRoute>
    );
}
