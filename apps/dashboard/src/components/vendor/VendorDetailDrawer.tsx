'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri-facility-solutions/shared';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    LayoutDashboard, Briefcase,
    ShieldCheck, Activity, Phone, Mail, MapPin, Globe,
    Copy, Check, Rocket, AlertTriangle, Pencil, X, Plus, MoreHorizontal, Save, Loader2,
    StickyNote, ClipboardList, Users as UsersIcon, Clock, DollarSign as DollarIcon, MapPinned, Award, FileText
} from 'lucide-react';

import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

import VendorContacts from '@/components/vendor/VendorContacts';
import VendorAssignments from '@/components/vendor/VendorAssignments';
import VendorFinancials from '@/components/vendor/VendorFinancials';
import VendorCompliance from '@/components/vendor/VendorCompliance';
import EditVendorDialog from '@/components/vendor/EditVendorDialog';
import VendorStatusTimeline from '@/components/vendor/VendorStatusTimeline';
import VendorActivityFeed from '@/components/vendor/VendorActivityFeed';
import ScheduleFollowUpDialog from '@/components/vendor/ScheduleFollowUpDialog';
import CapabilityPicker from '@/components/vendor/CapabilityPicker';
import {
    getCapabilityLabel,
    SERVICE_COUNTIES, COUNTY_REGION_LABELS,
    getCertificationsForCapabilities,
    type ServiceCounty, type CertificationOption,
} from '@/lib/vendor-capabilities';

const LanguageBadge = ({ lang }: { lang?: 'en' | 'es' }) => {
    if (lang === 'es') return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">🇪🇸 ES</Badge>;
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">🇺🇸 EN</Badge>;
};

const InlineEditField = ({
    vendorId, field, value, icon: Icon, type = 'text', prefix, linkHref,
}: {
    vendorId: string; field: string; value?: string; icon: React.ElementType;
    type?: 'text' | 'email' | 'tel' | 'url'; prefix?: string; linkHref?: string;
}) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (val === (value || '')) { setEditing(false); return; }
        setSaving(true);
        try {
            await updateDoc(doc(db, 'vendors', vendorId), { [field]: val || null, updatedAt: new Date() });
        } catch (e) { console.error('Save failed:', e); }
        setSaving(false);
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                    autoFocus type={type} value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
                    onBlur={save} disabled={saving}
                    className="flex-1 text-sm px-2 py-0.5 border rounded-md bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={`Enter ${field}...`}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditing(true)}>
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            {value ? (
                linkHref ? (
                    <a href={linkHref} onClick={(e) => e.stopPropagation()} target={type === 'url' ? '_blank' : undefined} rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[250px]">
                        {prefix}{value}
                    </a>
                ) : <span className="text-sm">{prefix}{value}</span>
            ) : <span className="text-sm text-muted-foreground italic">Add {field}...</span>}
            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};

interface VendorDetailDrawerProps {
    vendorId: string | null;
    open: boolean;
    onClose: () => void;
}

export default function VendorDetailDrawer({ vendorId, open, onClose }: VendorDetailDrawerProps) {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const ONBOARDING_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

    // Notes editing state
    const [notesEditing, setNotesEditing] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [notesSaving, setNotesSaving] = useState(false);

    // Onboarding data editing state
    const [onboardingEditing, setOnboardingEditing] = useState(false);
    const [onboardingDraft, setOnboardingDraft] = useState<Record<string, any>>({});
    const [onboardingSaving, setOnboardingSaving] = useState(false);

    const handleNotesSave = async () => {
        if (!vendor?.id) return;
        setNotesSaving(true);
        try {
            await updateDoc(doc(db, 'vendors', vendor.id), { notes: notesDraft, updatedAt: new Date() });
            setNotesEditing(false);
        } catch (e) { console.error('Notes save failed:', e); }
        setNotesSaving(false);
    };

    const startOnboardingEdit = () => {
        const ob = (vendor as any)?.onboarding || {};
        setOnboardingDraft({
            teamSize: ob.teamSize || '',
            serviceCounties: ob.serviceCounties || [],
            experienceRaw: ob.experienceRaw || '',
            experienceSummary: ob.experienceSummary || '',
            responseTime: ob.responseTime || '',
            certifications: ob.certifications || [],
            availability: ob.availability || '',
            notes: ob.notes || '',
        });
        setOnboardingEditing(true);
    };

    const handleOnboardingSave = async () => {
        if (!vendor?.id) return;
        setOnboardingSaving(true);
        try {
            const cleaned: Record<string, any> = {};
            Object.entries(onboardingDraft).forEach(([k, v]) => {
                if (Array.isArray(v)) {
                    if (v.length > 0) cleaned[k] = v;
                } else if (typeof v === 'string' && v.trim()) {
                    cleaned[k] = v.trim();
                }
            });
            await updateDoc(doc(db, 'vendors', vendor.id), {
                onboarding: cleaned,
                updatedAt: new Date(),
            });
            setOnboardingEditing(false);
        } catch (e) { console.error('Onboarding save failed:', e); }
        setOnboardingSaving(false);
    };

    // Address editing state
    const [editingAddress, setEditingAddress] = useState(false);
    const [addressDraft, setAddressDraft] = useState({ address: '', city: '', state: '', zip: '' });
    const [autocompleteValue, setAutocompleteValue] = useState<any>(null);
    const [savingAddress, setSavingAddress] = useState(false);

    const startAddressEdit = useCallback(() => {
        if (!vendor) return;
        setAddressDraft({
            address: vendor.streetAddress || vendor.address || '',
            city: vendor.city || '',
            state: vendor.state || '',
            zip: vendor.zip || '',
        });
        setAutocompleteValue(null);
        setEditingAddress(true);
    }, [vendor]);

    const handlePlaceSelect = (selected: any) => {
        setAutocompleteValue(selected);
        if (selected?.value?.place_id) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ placeId: selected.value.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const components = results[0].address_components;
                    let streetNumber = '', route = '', newCity = '', newState = '', newZip = '';
                    components.forEach((c: any) => {
                        if (c.types.includes('street_number')) streetNumber = c.long_name;
                        if (c.types.includes('route')) route = c.long_name;
                        if (c.types.includes('locality')) newCity = c.long_name;
                        if (c.types.includes('sublocality_level_1') && !newCity) newCity = c.long_name;
                        if (c.types.includes('administrative_area_level_1')) newState = c.short_name;
                        if (c.types.includes('postal_code')) newZip = c.long_name;
                    });
                    setAddressDraft({ address: `${streetNumber} ${route}`.trim(), city: newCity, state: newState, zip: newZip });
                }
            });
        }
    };

    const saveAddress = async () => {
        if (!vendor?.id) return;
        setSavingAddress(true);
        try {
            await updateDoc(doc(db, 'vendors', vendor.id), {
                streetAddress: addressDraft.address || null,
                address: addressDraft.address || null,
                city: addressDraft.city || null,
                state: addressDraft.state || null,
                zip: addressDraft.zip || null,
                updatedAt: new Date(),
            });
            setEditingAddress(false);
        } catch (e) { console.error('Address save failed:', e); }
        setSavingAddress(false);
    };

    const handleZipChange = async (zipVal: string) => {
        setAddressDraft(prev => ({ ...prev, zip: zipVal }));
        if (/^\d{5}$/.test(zipVal)) {
            try {
                const res = await fetch(`https://api.zippopotam.us/us/${zipVal}`);
                if (res.ok) {
                    const data = await res.json();
                    const place = data.places?.[0];
                    if (place) {
                        setAddressDraft(prev => ({
                            ...prev,
                            city: place['place name'] || prev.city || '',
                            state: place['state abbreviation'] || prev.state || '',
                        }));
                    }
                }
            } catch { /* ignore lookup errors */ }
        }
    };

    useEffect(() => {
        if (!vendorId || !open) { setVendor(null); setLoading(true); return; }
        setLoading(true);
        setActiveTab('overview');
        const unsubscribe = onSnapshot(doc(db, 'vendors', vendorId), (snap) => {
            if (snap.exists()) setVendor({ id: snap.id, ...snap.data() } as Vendor);
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribe();
    }, [vendorId, open]);

    return (
        <Sheet open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
            <SheetContent className="w-full sm:max-w-[680px] overflow-y-auto p-0" side="right">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                ) : !vendor ? (
                    <div className="p-6 text-muted-foreground">Vendor not found</div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-card border-b px-5 py-4 z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                                    {vendor.businessName?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <SheetTitle className="text-lg truncate">{vendor.businessName}</SheetTitle>
                                        <LanguageBadge lang={vendor.preferredLanguage} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <select
                                            value={vendor.status}
                                            onChange={async (e) => {
                                                try { await updateDoc(doc(db, 'vendors', vendor.id!), { status: e.target.value, updatedAt: new Date() }); }
                                                catch (err) { console.error('Failed:', err); }
                                            }}
                                            className="text-xs font-medium px-2 py-0.5 rounded border bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <option value="pending_review">Sourced</option>
                                            <option value="qualified">Qualified</option>
                                            <option value="awaiting_onboarding">Awaiting Form</option>
                                            <option value="compliance_review">Compliance Review</option>
                                            <option value="pending_verification">Verifying Docs</option>
                                            <option value="onboarding_scheduled">Onboarding Call</option>
                                            <option value="ready_for_assignment">✅ Ready</option>
                                            <option value="active">Active</option>
                                            <option value="suspended">⚠️ Suspended</option>
                                            <option value="dismissed">🚫 Dismissed</option>
                                        </select>
                                        {vendor.outreachStatus && (
                                            <Badge variant="outline" className={
                                                vendor.outreachStatus === 'SENT' ? 'border-green-400 text-green-600' :
                                                    vendor.outreachStatus === 'FAILED' ? 'border-red-500 text-red-600' :
                                                        vendor.outreachStatus === 'PENDING' ? 'border-purple-400 text-purple-600' :
                                                            vendor.outreachStatus === 'NEEDS_CONTACT' ? 'border-amber-400 text-amber-600' :
                                                                vendor.outreachStatus === 'ENRICHING' ? 'border-blue-400 text-blue-600' : ''
                                            }>
                                                {vendor.outreachStatus === 'SENT' && 'Outreach Sent'}
                                                {vendor.outreachStatus === 'FAILED' && <><AlertTriangle className="w-3 h-3 mr-1" /> Failed</>}
                                                {vendor.outreachStatus === 'PENDING' && 'Queued'}
                                                {vendor.outreachStatus === 'NEEDS_CONTACT' && <><AlertTriangle className="w-3 h-3 mr-1" /> Needs Contact</>}
                                                {vendor.outreachStatus === 'ENRICHING' && 'Enriching...'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick actions */}
                            <div className="flex gap-2 flex-wrap">
                                {vendor.status === 'pending_review' && (
                                    <>
                                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                            onClick={async () => { await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'qualified', updatedAt: new Date() }); }}>
                                            <Check className="w-3 h-3 mr-1" /> Qualify
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                            onClick={async () => { await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'dismissed', updatedAt: new Date() }); }}>
                                            Dismiss
                                        </Button>
                                    </>
                                )}
                                {vendor.status === 'qualified' && vendor.email && (
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={startingSequence}
                                        onClick={async () => {
                                            setStartingSequence(true);
                                            try {
                                                const ref = doc(db, 'vendors', vendor.id!);
                                                await updateDoc(ref, { status: 'pending_review', outreachStatus: null });
                                                setTimeout(async () => { await updateDoc(ref, { status: 'qualified' }); setStartingSequence(false); }, 500);
                                            } catch { setStartingSequence(false); }
                                        }}>
                                        <Rocket className="w-3 h-3 mr-1" /> {startingSequence ? 'Starting...' : 'Send Outreach'}
                                    </Button>
                                )}
                                {vendor.status === 'awaiting_onboarding' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${ONBOARDING_BASE_URL}/onboarding/${vendor.id}`);
                                            setCopied(true); setTimeout(() => setCopied(false), 2000);
                                        }}>
                                        {copied ? <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Onboarding Link</>}
                                    </Button>
                                )}
                                <EditVendorDialog vendor={vendor} />
                                <ScheduleFollowUpDialog vendorId={vendor.id} entityName={vendor.businessName} />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            <VendorStatusTimeline status={vendor.status} />
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
                                <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                                    <TabsTrigger value="overview" className="gap-1 text-xs"><LayoutDashboard className="w-3.5 h-3.5" /> Overview</TabsTrigger>
                                    <TabsTrigger value="contacts" className="gap-1 text-xs"><UsersIcon className="w-3.5 h-3.5" /> Contacts</TabsTrigger>
                                    <TabsTrigger value="assignments" className="gap-1 text-xs"><Briefcase className="w-3.5 h-3.5" /> Jobs</TabsTrigger>
                                    <TabsTrigger value="financials" className="gap-1 text-xs"><DollarIcon className="w-3.5 h-3.5" /> Financial</TabsTrigger>
                                    <TabsTrigger value="compliance" className="gap-1 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Compliance</TabsTrigger>
                                    <TabsTrigger value="activity" className="gap-1 text-xs"><Activity className="w-3.5 h-3.5" /> Activity</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3"><CardTitle className="text-sm">Business Details</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Contact</div>
                                                    <div className="space-y-2 pl-1">
                                                        <InlineEditField vendorId={vendor.id!} field="phone" value={vendor.phone} icon={Phone} type="tel" linkHref={vendor.phone ? `tel:${vendor.phone}` : undefined} />
                                                        <InlineEditField vendorId={vendor.id!} field="email" value={vendor.email} icon={Mail} type="email" linkHref={vendor.email ? `mailto:${vendor.email}` : undefined} />
                                                        <InlineEditField vendorId={vendor.id!} field="website" value={vendor.website} icon={Globe} type="url" linkHref={vendor.website ? (vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`) : undefined} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Address</div>
                                                        {!editingAddress && (
                                                            <button onClick={startAddressEdit} className="text-muted-foreground hover:text-foreground">
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {editingAddress ? (
                                                        <div className="space-y-2 pl-1">
                                                            <div>
                                                                <label className="text-[10px] uppercase text-muted-foreground font-medium">Street Address</label>
                                                                <GooglePlacesAutocomplete
                                                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                                                    autocompletionRequest={{ componentRestrictions: { country: ['us'] } }}
                                                                    selectProps={{
                                                                        value: autocompleteValue,
                                                                        onChange: handlePlaceSelect,
                                                                        placeholder: addressDraft.address || '123 Main St',
                                                                        isClearable: true,
                                                                        styles: {
                                                                            control: (base: any) => ({ ...base, minHeight: '28px', fontSize: '14px', backgroundColor: 'white', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', '&:hover': { borderColor: 'hsl(var(--ring))' } }),
                                                                            input: (base: any) => ({ ...base, margin: 0, padding: 0, color: 'hsl(var(--foreground))' }),
                                                                            singleValue: (base: any) => ({ ...base, color: 'hsl(var(--foreground))' }),
                                                                            placeholder: (base: any) => ({ ...base, color: addressDraft.address ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }),
                                                                            menu: (base: any) => ({ ...base, backgroundColor: 'white', border: '1px solid hsl(var(--border))', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }),
                                                                            menuList: (base: any) => ({ ...base, padding: '4px', backgroundColor: 'white' }),
                                                                            option: (base: any, state: any) => ({ ...base, backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'white', color: 'hsl(var(--foreground))', cursor: 'pointer', fontSize: '13px', padding: '8px 12px', borderRadius: '4px', '&:active': { backgroundColor: 'hsl(var(--accent))' } }),
                                                                            noOptionsMessage: (base: any) => ({ ...base, color: 'hsl(var(--muted-foreground))', backgroundColor: 'white' }),
                                                                            loadingMessage: (base: any) => ({ ...base, color: 'hsl(var(--muted-foreground))', backgroundColor: 'white' }),
                                                                        },
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-muted-foreground font-medium">City</label>
                                                                    <Input className="h-7 text-sm" value={addressDraft.city} onChange={e => setAddressDraft({ ...addressDraft, city: e.target.value })} placeholder="City" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-muted-foreground font-medium">State</label>
                                                                    <Input className="h-7 text-sm" value={addressDraft.state} onChange={e => setAddressDraft({ ...addressDraft, state: e.target.value })} placeholder="NY" maxLength={2} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase text-muted-foreground font-medium">Zip</label>
                                                                    <Input className="h-7 text-sm" value={addressDraft.zip} onChange={e => handleZipChange(e.target.value)} placeholder="10001" maxLength={5} />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 pt-1">
                                                                <Button size="sm" className="h-7 text-xs gap-1" onClick={saveAddress} disabled={savingAddress}>
                                                                    {savingAddress ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingAddress(false)}>
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1 pl-1 cursor-pointer" onClick={startAddressEdit}>
                                                            <div className="flex items-center gap-2 text-sm group">
                                                                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <span className={vendor.streetAddress || vendor.address ? '' : 'text-muted-foreground italic'}>
                                                                    {vendor.streetAddress || vendor.address || 'Add address...'}
                                                                </span>
                                                                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                            {(vendor.city || vendor.state || vendor.zip) && (
                                                                <div className="text-sm text-muted-foreground pl-6">
                                                                    {[vendor.city, vendor.state].filter(Boolean).join(', ')}{vendor.zip ? ` ${vendor.zip}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                Capabilities
                                                <CapabilityPicker
                                                    selected={vendor.capabilities || []}
                                                    onChange={(caps) => {
                                                        updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: caps, updatedAt: new Date() });
                                                    }}
                                                />
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1.5">
                                                {vendor.capabilities?.map((cap, i) => (
                                                    <Badge key={i} variant="secondary" className="group cursor-pointer text-xs" onClick={() => {
                                                        const updated = vendor.capabilities!.filter((_, idx) => idx !== i);
                                                        updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: updated, updatedAt: new Date() });
                                                    }}>
                                                        {getCapabilityLabel(cap)}
                                                        <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                                    </Badge>
                                                ))}
                                                {(!vendor.capabilities || vendor.capabilities.length === 0) && (
                                                    <span className="text-xs text-muted-foreground italic">No capabilities — click Edit</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Notes — Inline Editable */}
                                    <Card>
                                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <StickyNote className="w-4 h-4" /> Notes
                                            </CardTitle>
                                            {!notesEditing && (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                                                    onClick={() => { setNotesDraft((vendor as any).notes || ''); setNotesEditing(true); }}>
                                                    <Pencil className="w-3 h-3" /> Edit
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            {notesEditing ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        className="min-h-[80px] text-sm resize-y"
                                                        value={notesDraft}
                                                        onChange={(e) => setNotesDraft(e.target.value)}
                                                        placeholder="Add notes about this vendor..."
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
                                                <p className={`text-sm whitespace-pre-wrap ${(vendor as any).notes ? '' : 'text-muted-foreground italic'}`}>
                                                    {(vendor as any).notes || 'No notes yet — click Edit to add'}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Onboarding Data — Structured */}
                                    <Card>
                                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <ClipboardList className="w-4 h-4" /> Onboarding
                                            </CardTitle>
                                            {!onboardingEditing && (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={startOnboardingEdit}>
                                                    <Pencil className="w-3 h-3" /> Edit
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            {onboardingEditing ? (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><UsersIcon className="w-3 h-3" /> Team Size</label>
                                                            <Input className="h-7 text-sm mt-0.5" value={onboardingDraft.teamSize} onChange={(e) => setOnboardingDraft({ ...onboardingDraft, teamSize: e.target.value })} placeholder="e.g. 3 techs" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Response Time</label>
                                                            <Input className="h-7 text-sm mt-0.5" value={onboardingDraft.responseTime} onChange={(e) => setOnboardingDraft({ ...onboardingDraft, responseTime: e.target.value })} placeholder="e.g. Same day" />
                                                        </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><FileText className="w-3 h-3" /> Previous Experience</label>
                                                        <Textarea
                                                            className="min-h-[80px] text-sm resize-y mt-0.5"
                                                            value={onboardingDraft.experienceRaw}
                                                            onChange={(e) => setOnboardingDraft({ ...onboardingDraft, experienceRaw: e.target.value })}
                                                            placeholder="Describe their experience, past clients, years in business, notable projects..."
                                                        />
                                                        {onboardingDraft.experienceSummary && (
                                                            <div className="mt-1.5 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                                                <p className="text-[10px] uppercase text-blue-600 font-semibold mb-0.5">AI Summary</p>
                                                                <p className="text-xs text-blue-800 whitespace-pre-wrap">{onboardingDraft.experienceSummary}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><MapPinned className="w-3 h-3" /> Service Area</label>
                                                        <div className="mt-1 space-y-1">
                                                            <div className="flex flex-wrap gap-1">
                                                                {(onboardingDraft.serviceCounties || []).map((c: string) => {
                                                                    const county = SERVICE_COUNTIES.find(sc => sc.value === c);
                                                                    return (
                                                                        <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                                                                            {county?.label || c}
                                                                            <button type="button" className="hover:text-destructive" onClick={() => setOnboardingDraft({ ...onboardingDraft, serviceCounties: onboardingDraft.serviceCounties.filter((v: string) => v !== c) })}><X className="w-3 h-3" /></button>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full"><Plus className="w-3 h-3" /> Add Counties</Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[280px] p-0" align="start">
                                                                    <div className="max-h-[280px] overflow-y-auto p-2 space-y-3" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                                                                        {(['nyc', 'long_island', 'hudson_valley', 'nj'] as const).map(region => {
                                                                            const counties = SERVICE_COUNTIES.filter(c => c.region === region);
                                                                            return (
                                                                                <div key={region}>
                                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">{COUNTY_REGION_LABELS[region]}</p>
                                                                                    <div className="space-y-0.5">
                                                                                        {counties.map(c => {
                                                                                            const sel = (onboardingDraft.serviceCounties || []).includes(c.value);
                                                                                            return (
                                                                                                <button key={c.value} type="button" onClick={() => {
                                                                                                    const cur = onboardingDraft.serviceCounties || [];
                                                                                                    setOnboardingDraft({ ...onboardingDraft, serviceCounties: sel ? cur.filter((v: string) => v !== c.value) : [...cur, c.value] });
                                                                                                }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${sel ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                                                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-primary border-primary' : 'border-input'}`}>
                                                                                                        {sel && <Check className="w-3 h-3 text-primary-foreground" />}
                                                                                                    </div>
                                                                                                    {c.label}
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><Award className="w-3 h-3" /> Certifications</label>
                                                        {(() => {
                                                            const relevantCerts = getCertificationsForCapabilities(vendor.capabilities || []);
                                                            if (relevantCerts.length === 0) return <p className="text-xs text-muted-foreground italic mt-1">Add capabilities first to see relevant certifications</p>;
                                                            return (
                                                                <div className="mt-1 space-y-1">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {(onboardingDraft.certifications || []).map((c: string) => {
                                                                            const cert = relevantCerts.find(rc => rc.value === c) || { label: c };
                                                                            return (
                                                                                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                                                    {cert.label}
                                                                                    <button type="button" className="hover:text-destructive" onClick={() => setOnboardingDraft({ ...onboardingDraft, certifications: onboardingDraft.certifications.filter((v: string) => v !== c) })}><X className="w-3 h-3" /></button>
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full"><Plus className="w-3 h-3" /> Add Certifications</Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-[320px] p-0" align="start">
                                                                            <div className="max-h-[280px] overflow-y-auto p-2 space-y-0.5" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                                                                                {relevantCerts.map(cert => {
                                                                                    const sel = (onboardingDraft.certifications || []).includes(cert.value);
                                                                                    return (
                                                                                        <button key={cert.value} type="button" onClick={() => {
                                                                                            const cur = onboardingDraft.certifications || [];
                                                                                            setOnboardingDraft({ ...onboardingDraft, certifications: sel ? cur.filter((v: string) => v !== cert.value) : [...cur, cert.value] });
                                                                                        }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${sel ? 'bg-green-50 text-green-700 font-medium' : 'hover:bg-muted'}`}>
                                                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-green-600 border-green-600' : 'border-input'}`}>
                                                                                                {sel && <Check className="w-3 h-3 text-white" />}
                                                                                            </div>
                                                                                            {cert.label}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Availability</label>
                                                        <Input className="h-7 text-sm mt-0.5" value={onboardingDraft.availability} onChange={(e) => setOnboardingDraft({ ...onboardingDraft, availability: e.target.value })} placeholder="e.g. Mon-Fri 7am-5pm, can do weekends" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase text-muted-foreground font-medium">Onboarding Notes</label>
                                                        <Textarea
                                                            className="min-h-[60px] text-sm resize-y mt-0.5"
                                                            value={onboardingDraft.notes}
                                                            onChange={(e) => setOnboardingDraft({ ...onboardingDraft, notes: e.target.value })}
                                                            placeholder="Additional notes from onboarding call..."
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOnboardingEditing(false)}>Cancel</Button>
                                                        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleOnboardingSave} disabled={onboardingSaving}>
                                                            {onboardingSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                            Save
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (() => {
                                                const ob = (vendor as any)?.onboarding || {};
                                                const hasData = Object.values(ob).some((v: any) => v && String(v).trim());
                                                if (!hasData) {
                                                    return (
                                                        <div className="text-center py-3">
                                                            <p className="text-xs text-muted-foreground italic">No onboarding data yet</p>
                                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 mt-2" onClick={startOnboardingEdit}>
                                                                <Plus className="w-3 h-3" /> Add Onboarding Data
                                                            </Button>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        {ob.teamSize && <div><p className="text-[10px] uppercase text-muted-foreground">Team Size</p><p className="font-medium">{ob.teamSize}</p></div>}
                                                        {ob.responseTime && <div><p className="text-[10px] uppercase text-muted-foreground">Response Time</p><p className="font-medium">{ob.responseTime}</p></div>}

                                                        {ob.experienceRaw && <div className="col-span-2"><p className="text-[10px] uppercase text-muted-foreground">Previous Experience</p>{ob.experienceSummary && <div className="p-2 bg-blue-50 border border-blue-200 rounded-md mb-1"><p className="text-[10px] uppercase text-blue-600 font-semibold mb-0.5">AI Summary</p><p className="text-xs text-blue-800 whitespace-pre-wrap">{ob.experienceSummary}</p></div>}<p className="whitespace-pre-wrap text-xs text-muted-foreground">{ob.experienceRaw}</p></div>}

                                                        {ob.serviceCounties?.length > 0 && <div className="col-span-2"><p className="text-[10px] uppercase text-muted-foreground">Service Area</p><div className="flex flex-wrap gap-1 mt-0.5">{ob.serviceCounties.map((c: string) => { const county = SERVICE_COUNTIES.find(sc => sc.value === c); return <span key={c} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{county?.label || c}</span>; })}</div></div>}
                                                        {ob.certifications?.length > 0 && <div className="col-span-2"><p className="text-[10px] uppercase text-muted-foreground">Certifications</p><div className="flex flex-wrap gap-1 mt-0.5">{ob.certifications.map((c: string) => { const cert = getCertificationsForCapabilities(vendor.capabilities || []).find(rc => rc.value === c); return <span key={c} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{cert?.label || c}</span>; })}</div></div>}
                                                        {ob.availability && <div className="col-span-2"><p className="text-[10px] uppercase text-muted-foreground">Availability</p><p className="font-medium">{ob.availability}</p></div>}
                                                        {ob.notes && <div className="col-span-2 border-t pt-2 mt-1"><p className="text-[10px] uppercase text-muted-foreground">Onboarding Notes</p><p className="whitespace-pre-wrap">{ob.notes}</p></div>}
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="contacts"><VendorContacts vendor={vendor} /></TabsContent>
                                <TabsContent value="assignments"><VendorAssignments vendor={vendor} /></TabsContent>
                                <TabsContent value="financials"><VendorFinancials vendor={vendor} /></TabsContent>
                                <TabsContent value="compliance"><VendorCompliance vendor={vendor} /></TabsContent>
                                <TabsContent value="activity"><VendorActivityFeed vendorId={vendor.id!} /></TabsContent>
                            </Tabs>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
