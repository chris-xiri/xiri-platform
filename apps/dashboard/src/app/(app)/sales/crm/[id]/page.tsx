"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { functions } from '@/lib/firebase';
import { Lead, LeadType } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowLeft,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Clock,
    Briefcase,
    TrendingUp,
    Loader2,
    Play,
    Tag,
    CheckCircle2,
    AlertTriangle,
    Send,
    Rocket,
    XCircle,
    Activity,
    Target,
    Eye,
    Pencil,
    Check,
    X,
    FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CompanyHub from './CompanyHub';

// ─── Targeted template interface ──────────────────────────
interface TargetedTemplate {
    id: string;
    name: string;
    description?: string;
    subject: string;
    body: string;
    category?: string;
}

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

const LEAD_TYPE_CONFIG: Record<string, { color: string; label: string; sequence: string }> = {
    'direct': { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Direct', sequence: '4 emails over 14 days (Day 0, 3, 7, 14)' },
    'tenant': { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Tenant', sequence: '4 emails over 14 days (Day 0, 3, 7, 14)' },
    'referral_partnership': { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Referral Partnership', sequence: '3 emails over 10 days (Day 0, 4, 10)' },
    'enterprise': { color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Enterprise', sequence: '5 emails over 21 days (Day 0, 4, 8, 14, 21)' },
};

const OUTREACH_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    'PENDING': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Sequence Pending' },
    'IN_PROGRESS': { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Sequence Active' },
    'COMPLETED': { color: 'bg-green-100 text-green-700 border-green-200', label: 'Sequence Completed' },
    'NEEDS_MANUAL': { color: 'bg-red-100 text-red-700 border-red-200', label: 'Needs Manual Outreach' },
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

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSequenceDialog, setShowSequenceDialog] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);
    const [sequenceMessage, setSequenceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [activities, setActivities] = useState<{ id: string; type: string; description: string; createdAt: any; metadata?: any }[]>([]);

    // ─── Sequence picker state ──────────────────────────────
    const [availableSequences, setAvailableSequences] = useState<{ id: string; name: string; description?: string; steps: any[]; leadTypes?: string[] }[]>([]);
    const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
    const [contactSequenceHistory, setContactSequenceHistory] = useState<Record<string, any>>({});
    const [loadingSequences, setLoadingSequences] = useState(false);
    const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);

    // ─── Targeted email send state ──────────────────────────
    const [showSendDialog, setShowSendDialog] = useState(false);
    const [targetedTemplates, setTargetedTemplates] = useState<TargetedTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [previewingEmail, setPreviewingEmail] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

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

    // ─── Fetch targeted templates ────────────────────────────
    const fetchTargetedTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const snap = await getDocs(collection(db, 'templates'));
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as TargetedTemplate));
            setTargetedTemplates(all.filter(t => t.category === 'lead_targeted'));
        } catch (err) {
            console.error('Error fetching targeted templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, []);

    // ─── Fetch available sequences + contact history ─────────
    const fetchSequencesAndHistory = useCallback(async () => {
        setLoadingSequences(true);
        try {
            // Fetch all sequences
            const seqSnap = await getDocs(collection(db, 'sequences'));
            const seqs = seqSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setAvailableSequences(seqs);

            // Fetch primary contact to get sequenceHistory
            const contactsQ = query(
                collection(db, 'contacts'),
                where('companyId', '==', leadId),
                where('isPrimary', '==', true)
            );
            const contactSnap = await getDocs(contactsQ);
            if (!contactSnap.empty) {
                const contactData = contactSnap.docs[0].data();
                setPrimaryContactId(contactSnap.docs[0].id);
                setContactSequenceHistory(contactData.sequenceHistory || {});
            } else {
                // Fall back: no primary contact, no history
                setContactSequenceHistory({});
            }
        } catch (err) {
            console.error('Error fetching sequences:', err);
        } finally {
            setLoadingSequences(false);
        }
    }, [leadId]);

    // ─── Send targeted email handler ────────────────────────
    const handleSendTargetedEmail = async () => {
        if (!selectedTemplateId || !lead) return;
        setSendingEmail(true);
        setSequenceMessage(null);
        try {
            const sendSingle = httpsCallable(functions, 'sendSingleLeadEmail');
            const result = await sendSingle({ leadId, templateId: selectedTemplateId });
            const data = result.data as any;
            setSequenceMessage({ type: 'success', text: data.message || 'Email sent successfully' });
            setShowSendDialog(false);
            setSelectedTemplateId('');
            setPreviewingEmail(false);
            await fetchLead();
            await fetchActivities();
        } catch (error: any) {
            const message = error?.message || 'Failed to send email';
            setSequenceMessage({ type: 'error', text: message });
        } finally {
            setSendingEmail(false);
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

    const handleStatusChange = async (newStatus: string) => {
        if (!lead) return;
        setUpdatingStatus(true);
        try {
            await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
            setLead({ ...lead, status: newStatus as any });
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleLeadTypeChange = async (newType: string) => {
        if (!lead) return;
        try {
            await updateDoc(doc(db, 'leads', leadId), { leadType: newType });
            setLead({ ...lead, leadType: newType as LeadType });
        } catch (error) {
            console.error('Error updating lead type:', error);
        }
    };

    const handleStartSequence = async () => {
        if (!selectedSequenceId) return;
        setStartingSequence(true);
        setSequenceMessage(null);
        try {
            // If not already qualified, qualify first
            if (lead?.status !== 'qualified') {
                await updateDoc(doc(db, 'leads', leadId), { status: 'qualified' });
            }

            const startSequence = httpsCallable(functions, 'startLeadSequence');
            const result = await startSequence({
                leadId,
                contactId: primaryContactId || undefined,
                sequenceId: selectedSequenceId,
            });
            const data = result.data as any;

            setSequenceMessage({ type: 'success', text: data.message });
            setShowSequenceDialog(false);
            setSelectedSequenceId('');
            await fetchLead(); // Refresh lead data
            await fetchActivities();
        } catch (error: any) {
            const message = error?.message || 'Failed to start sequence';
            setSequenceMessage({ type: 'error', text: message });
        } finally {
            setStartingSequence(false);
        }
    };

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
    const outreachStatus = (lead as any).outreachStatus;
    const outreachConfig = outreachStatus ? OUTREACH_STATUS_CONFIG[outreachStatus] : null;
    const canStartSequence = !outreachStatus || outreachStatus === 'COMPLETED' || outreachStatus === 'NEEDS_MANUAL';
    const hasEmail = lead.email && lead.email.trim().length > 0;

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/sales/dashboard')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to CRM
                        </Button>
                        <div>
                            <EditableField
                                label="Business name"
                                value={lead.businessName || ''}
                                icon={Building2}
                                onSave={(v) => updateField('businessName', v)}
                                renderDisplay={(val) => (
                                    <h1 className="text-3xl font-bold">{val || 'Unnamed Business'}</h1>
                                )}
                            />
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-muted-foreground">
                                    {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                                </span>
                                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                    {typeConfig.label}
                                </Badge>
                                {outreachConfig && (
                                    <Badge variant="outline" className={`text-xs ${outreachConfig.color}`}>
                                        <Send className="w-3 h-3 mr-1" />
                                        {outreachConfig.label}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        {/* Status Selector */}
                        <Select value={lead.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="walkthrough">Walkthrough</SelectItem>
                                <SelectItem value="proposal">Proposal</SelectItem>
                                <SelectItem value="quoted">Quoted</SelectItem>
                                <SelectItem value="won">Won</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Send Email (one-off) */}
                        <Button
                            variant="outline"
                            className="gap-2"
                            disabled={!hasEmail}
                            onClick={() => {
                                fetchTargetedTemplates();
                                setShowSendDialog(true);
                            }}
                        >
                            <Mail className="w-4 h-4" />
                            Email
                        </Button>

                        {/* Start Sequence CTA */}
                        <Button
                            onClick={() => {
                                fetchSequencesAndHistory();
                                setShowSequenceDialog(true);
                            }}
                            disabled={!canStartSequence || !hasEmail}
                            className="gap-2"
                            variant={canStartSequence && hasEmail ? "default" : "outline"}
                        >
                            <Play className="w-4 h-4" />
                            {lead.status === 'qualified' ? 'Start Sequence' : 'Qualify & Start Sequence'}
                        </Button>
                    </div>
                </div>

                {/* Feedback Messages */}
                {sequenceMessage && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${sequenceMessage.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {sequenceMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <AlertTriangle className="w-4 h-4" />
                        )}
                        {sequenceMessage.text}
                        <button className="ml-auto text-xs hover:underline" onClick={() => setSequenceMessage(null)}>
                            Dismiss
                        </button>
                    </div>
                )}

                {/* No email warning */}
                {!hasEmail && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-4 h-4" />
                        No email on file — email sequences cannot be started until an email is added.
                    </div>
                )}

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
                                    <label className="text-sm font-medium text-muted-foreground">Contact</label>
                                    <EditableField label="Contact name" value={lead.contactName || ''} icon={User} onSave={(v) => updateField('contactName', v)} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                                    <EditableField label="Email" value={lead.email || ''} icon={Mail} type="email" linkPrefix="mailto:" onSave={(v) => updateField('email', v)} />
                                </div>
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

                        {/* Lead Type */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Tag className="w-4 h-4" /> Lead Type
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Select value={leadType} onValueChange={handleLeadTypeChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="direct">Direct</SelectItem>
                                        <SelectItem value="tenant">Tenant</SelectItem>
                                        <SelectItem value="referral_partnership">Referral Partnership</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Sequence: {typeConfig.sequence}</p>
                            </CardContent>
                        </Card>

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

            {/* Start Sequence Confirmation Dialog */}
            <AlertDialog open={showSequenceDialog} onOpenChange={(open: boolean) => { setShowSequenceDialog(open); if (!open) setSelectedSequenceId(''); }}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Play className="w-5 h-5" />
                            Start Email Sequence
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>
                                    Choose a sequence to start an automated email drip campaign for <strong>{lead.businessName}</strong>.
                                </p>

                                {loadingSequences ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : availableSequences.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-muted-foreground">
                                        <Rocket className="w-7 h-7 mx-auto mb-2 opacity-30" />
                                        No sequences found. Create one in{' '}
                                        <a href="/admin/email-templates" className="text-primary hover:underline font-medium">Email Templates → Sequences</a>.
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Sequence</label>
                                            <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a sequence..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableSequences.map(seq => {
                                                        const alreadyEnrolled = !!contactSequenceHistory[seq.id];
                                                        return (
                                                            <SelectItem
                                                                key={seq.id}
                                                                value={seq.id}
                                                                disabled={alreadyEnrolled}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span>{seq.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        ({seq.steps?.length || 0} emails)
                                                                    </span>
                                                                    {alreadyEnrolled && (
                                                                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 ml-1">
                                                                            Already enrolled
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Selected sequence details */}
                                        {selectedSequenceId && (() => {
                                            const seq = availableSequences.find(s => s.id === selectedSequenceId);
                                            if (!seq) return null;
                                            const dayList = seq.steps?.map((s: any) => `Day ${s.dayOffset}`).join(', ') || '';
                                            return (
                                                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Sequence:</span>
                                                        <span className="font-medium">{seq.name}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Steps:</span>
                                                        <span className="font-medium">{seq.steps?.length || 0} emails</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Schedule:</span>
                                                        <span className="font-medium">{dayList}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Recipient:</span>
                                                        <span className="font-medium">{lead.email}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {lead.status !== 'qualified' && (
                                            <p className="text-xs text-amber-600">
                                                This will also update the lead status to <strong>Qualified</strong>.
                                            </p>
                                        )}

                                        {/* Enrollment history */}
                                        {Object.keys(contactSequenceHistory).length > 0 && (
                                            <div className="border-t pt-3">
                                                <p className="text-xs font-medium text-muted-foreground mb-2">Previous Enrollments</p>
                                                <div className="space-y-1">
                                                    {Object.entries(contactSequenceHistory).map(([seqId, entry]: [string, any]) => (
                                                        <div key={seqId} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1.5 rounded">
                                                            <span className="font-medium">{entry.sequenceName || seqId}</span>
                                                            <Badge variant="outline" className="text-[9px]">
                                                                {entry.status === 'in_progress' ? 'Active' : entry.status || 'Enrolled'}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={startingSequence}>Cancel</AlertDialogCancel>
                        <Button onClick={handleStartSequence} disabled={startingSequence || !selectedSequenceId} className="gap-2">
                            {startingSequence ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            {startingSequence ? 'Starting...' : 'Start Sequence'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Send Targeted Email Dialog ─── */}
            <AlertDialog open={showSendDialog} onOpenChange={(open: boolean) => { setShowSendDialog(open); if (!open) { setSelectedTemplateId(''); setPreviewingEmail(false); } }}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Send Targeted Email
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>
                                    Choose a template to send a one-off email to <strong>{lead.businessName}</strong> ({lead.email}).
                                </p>

                                {loadingTemplates ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : targetedTemplates.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        No targeted templates found. Create one in{' '}
                                        <a href="/admin/email-templates" className="text-primary hover:underline font-medium">Settings → Email Templates</a>.
                                    </div>
                                ) : (
                                    <>
                                        {/* Template selector */}
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Template</label>
                                            <Select value={selectedTemplateId} onValueChange={(v: string) => { setSelectedTemplateId(v); setPreviewingEmail(false); }}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {targetedTemplates.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            <div className="flex flex-col">
                                                                <span>{t.name}</span>
                                                                {t.description && <span className="text-[10px] text-muted-foreground">{t.description}</span>}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Preview */}
                                        {selectedTemplateId && (() => {
                                            const tpl = targetedTemplates.find(t => t.id === selectedTemplateId);
                                            if (!tpl) return null;

                                            // Simple preview merge
                                            const mergeVars: Record<string, string> = {
                                                businessName: lead.businessName || '',
                                                contactName: lead.contactName || '',
                                                facilityType: lead.facilityType || '',
                                                address: lead.address || '',
                                                squareFootage: (lead as any).squareFootage || '',
                                            };
                                            const previewSubject = tpl.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => mergeVars[k] || `{{${k}}}`);
                                            const previewBody = tpl.body.replace(/\{\{(\w+)\}\}/g, (_, k) => mergeVars[k] || `{{${k}}}`);

                                            return (
                                                <div className="space-y-3">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1.5"
                                                        onClick={() => setPreviewingEmail(!previewingEmail)}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {previewingEmail ? 'Hide Preview' : 'Preview Email'}
                                                    </Button>

                                                    {previewingEmail && (
                                                        <div className="border rounded-lg bg-white dark:bg-background overflow-hidden">
                                                            <div className="px-4 py-2.5 bg-muted/30 border-b text-[11px] space-y-0.5">
                                                                <div>From: <span className="font-medium">XIRI Facility Solutions &lt;chris@xiri.ai&gt;</span></div>
                                                                <div>To: <span className="font-medium">{lead.contactName} &lt;{lead.email}&gt;</span></div>
                                                                <div>Subject: <span className="font-semibold text-xs">{previewSubject}</span></div>
                                                            </div>
                                                            <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">
                                                                {previewBody}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Template:</span>
                                                            <span className="font-medium">{tpl.name}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Subject:</span>
                                                            <span className="font-medium">{previewSubject}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Recipient:</span>
                                                            <span className="font-medium">{lead.email}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sendingEmail}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleSendTargetedEmail}
                            disabled={sendingEmail || !selectedTemplateId}
                            className="gap-2"
                        >
                            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sendingEmail ? 'Sending...' : 'Send Email'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ProtectedRoute>
    );
}
