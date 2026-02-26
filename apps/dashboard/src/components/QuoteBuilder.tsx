'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, QuoteLineItem, getTaxRate, calculateTax } from '@xiri/shared';
import { SCOPE_TEMPLATES } from '@/data/scopeTemplates';
import { XIRI_SERVICES, SERVICE_CATEGORIES, ServiceCategory } from '@/data/serviceTypes';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    X, ArrowLeft, ArrowRight, Check, Building2, MapPin,
    Plus, Trash2, DollarSign, FileText, ClipboardList, Users
} from 'lucide-react';

interface QuoteBuilderProps {
    onClose: () => void;
    onCreated: (quoteId: string) => void;
    existingQuote?: {
        quoteId: string;
        leadId: string;
        leadBusinessName: string;
        lineItems: QuoteLineItem[];
        locations?: { id: string; name: string; address: string; city: string; state: string; zip: string }[];
        contractTenure: number;
        paymentTerms: string;
        exitClause: string;
        notes?: string;
        version: number;
    };
}

interface Location {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
}

const STEPS = ['Select Client', 'Locations', 'Services & Pricing', 'Terms & Submit'];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Strip undefined values recursively before Firestore writes
const stripUndefined = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && typeof obj.toDate !== 'function') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, stripUndefined(v)])
        );
    }
    return obj;
};

const SERVICE_COLORS = [
    'border-l-blue-500',
    'border-l-emerald-500',
    'border-l-violet-500',
    'border-l-amber-500',
    'border-l-rose-500',
    'border-l-cyan-500',
    'border-l-orange-500',
    'border-l-pink-500',
];

function FrequencyDisplay(item: QuoteLineItem): string {
    const WEEK_NAMES = ['1st', '2nd', '3rd', '4th'];
    const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (item.frequency === 'one_time') return 'One-Time';
    if (item.frequency === 'nightly') return 'Daily (Mon–Sun)';
    if (item.frequency === 'custom_days' && item.daysOfWeek) {
        const isWeekdays = JSON.stringify(item.daysOfWeek) === JSON.stringify([false, true, true, true, true, true, false]);
        if (isWeekdays) return 'Weekdays (Mon–Fri)';
        const count = item.daysOfWeek.filter(Boolean).length;
        const days = item.daysOfWeek.map((d, i) => d ? DAY_LABELS[i] : null).filter(Boolean);
        return `${count}x/week (${days.join(', ')})`;
    }
    const base = item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1);
    if ((item.frequency === 'monthly' || item.frequency === 'quarterly') && item.monthlyPattern) {
        if (item.monthlyPattern.type === 'day_of_month') {
            return `${base} (on the ${item.monthlyPattern.day}${getOrdinalSuffix(item.monthlyPattern.day)})`;
        }
        if (item.monthlyPattern.type === 'nth_weekday') {
            return `${base} (${WEEK_NAMES[item.monthlyPattern.week - 1]} ${FULL_DAYS[item.monthlyPattern.dayOfWeek]})`;
        }
    }
    return base;
}

function getOrdinalSuffix(n: number): string {
    if (n >= 11 && n <= 13) return 'th';
    const last = n % 10;
    if (last === 1) return 'st';
    if (last === 2) return 'nd';
    if (last === 3) return 'rd';
    return 'th';
}

export default function QuoteBuilder({ onClose, onCreated, existingQuote }: QuoteBuilderProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const isEditing = !!existingQuote;
    const [step, setStep] = useState(isEditing ? 2 : 0); // Skip to Services when editing
    const [submitting, setSubmitting] = useState(false);
    const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null);

    // Step 1: Client selection
    const [leads, setLeads] = useState<(Lead & { id: string })[]>([]);
    const [selectedLead, setSelectedLead] = useState<(Lead & { id: string }) | null>(null);
    const [leadSearch, setLeadSearch] = useState('');

    // Step 2: Locations
    const [locations, setLocations] = useState<Location[]>(
        existingQuote?.locations || []
    );
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState<any>(null);
    const [newLocationCity, setNewLocationCity] = useState('');
    const [newLocationState, setNewLocationState] = useState('');
    const [newLocationZip, setNewLocationZip] = useState('');

    // Step 3: Line items
    const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
        existingQuote?.lineItems || []
    );

    // Step 4: Terms
    const [contractTenure, setContractTenure] = useState(existingQuote?.contractTenure || 12);
    const [paymentTerms, setPaymentTerms] = useState(existingQuote?.paymentTerms || 'Pay on the 25th');
    const [exitClause, setExitClause] = useState(existingQuote?.exitClause || '30-day written notice');
    const [notes, setNotes] = useState(existingQuote?.notes || '');

    // Commission assignment
    const [assignedTo, setAssignedTo] = useState(profile?.uid || '');
    const [salesUsers, setSalesUsers] = useState<{ uid: string; displayName: string; email: string }[]>([]);

    // Check for existing quote when lead changes
    async function checkExistingQuote(leadId: string) {
        if (isEditing) { setExistingQuoteId(null); return; }
        try {
            const snap = await getDocs(
                query(collection(db, 'quotes'),
                    where('leadId', '==', leadId),
                    where('status', 'in', ['draft', 'sent', 'accepted'])
                )
            );
            setExistingQuoteId(!snap.empty ? snap.docs[0].id : null);
        } catch { setExistingQuoteId(null); }
    }

    // Fetch leads
    useEffect(() => {
        async function fetchLeads() {
            const q = query(collection(db, 'leads'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead & { id: string }));
            setLeads(data);

            // If editing, auto-select the lead
            if (existingQuote) {
                const match = data.find(l => l.id === existingQuote.leadId);
                if (match) setSelectedLead(match);
            }
        }
        fetchLeads();
    }, []);

    // Fetch sales users for commission assignment
    useEffect(() => {
        async function fetchSalesUsers() {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const sales: { uid: string; displayName: string; email: string }[] = [];
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.roles?.includes('sales') || data.roles?.includes('sales_manager') || data.roles?.includes('admin')) {
                        sales.push({ uid: d.id, displayName: data.displayName || data.email, email: data.email });
                    }
                });
                setSalesUsers(sales);
                // Default assignedTo to current user if not set
                if (!assignedTo && profile?.uid) setAssignedTo(profile.uid);
            } catch (err) {
                console.error('Error fetching sales users:', err);
            }
        }
        fetchSalesUsers();
    }, []);

    // When a lead is selected, pre-populate locations
    useEffect(() => {
        // Don't override locations when editing — they're pre-filled from the quote
        if (isEditing && locations.length > 0) return;
        if (selectedLead?.locations && selectedLead.locations.length > 0) {
            setLocations(selectedLead.locations.map((loc: any, i: number) => ({
                id: `loc_${i}`,
                name: loc.name || `Location ${i + 1}`,
                address: loc.address || '',
                city: loc.city || '',
                state: loc.state || '',
                zip: loc.zip || '',
            })));
        } else if (selectedLead) {
            setLocations([{
                id: 'loc_0',
                name: selectedLead.businessName || 'Primary Location',
                address: selectedLead.address || '',
                city: '',
                state: '',
                zip: selectedLead.zipCode || '',
            }]);
        }
    }, [selectedLead]);

    // Google Maps address selection handler
    const handleAddressSelect = (selected: any) => {
        setNewLocationAddress(selected);

        if (selected?.value?.place_id) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ placeId: selected.value.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const components = results[0].address_components;
                    components.forEach((component: any) => {
                        if (component.types.includes('locality')) {
                            setNewLocationCity(component.long_name);
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                            setNewLocationState(component.short_name);
                        }
                        if (component.types.includes('postal_code')) {
                            setNewLocationZip(component.long_name);
                        }
                    });

                    // Auto-populate name from place name if empty
                    if (!newLocationName && results[0].formatted_address) {
                        // Just use the first part before the first comma
                        const namePart = results[0].formatted_address.split(',')[0];
                        setNewLocationName(namePart);
                    }
                }
            });
        }
    };

    const addLocation = () => {
        if (!newLocationName || !newLocationAddress || !newLocationZip) return;
        setLocations(prev => [...prev, {
            id: `loc_${Date.now()}`,
            name: newLocationName,
            address: newLocationAddress.label || '',
            city: newLocationCity,
            state: newLocationState,
            zip: newLocationZip,
        }]);
        // Reset
        setNewLocationName('');
        setNewLocationAddress(null);
        setNewLocationCity('');
        setNewLocationState('');
        setNewLocationZip('');
    };

    const removeLocation = (id: string) => {
        setLocations(prev => prev.filter(l => l.id !== id));
        setLineItems(prev => prev.filter(li => li.locationId !== id));
    };

    const addLineItem = (loc: Location) => {
        const userId = profile?.uid || profile?.email || 'unknown';
        const isFsm = profile?.roles?.some((r: string) => r === 'fsm');
        const hasAcceptedItems = lineItems.some(li => li.lineItemStatus === 'accepted');

        setLineItems(prev => [...prev, {
            id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            locationId: loc.id,
            locationName: loc.name,
            locationAddress: loc.address,
            locationCity: loc.city,
            locationState: loc.state,
            locationZip: loc.zip,
            serviceType: '',
            serviceCategory: undefined,
            frequency: 'custom_days',
            daysOfWeek: [false, true, true, true, true, true, false],
            clientRate: 0,
            // Versioning & attribution
            lineItemStatus: 'pending' as const,
            addedBy: userId,
            addedByRole: (isFsm ? 'fsm' : 'sales') as 'sales' | 'fsm',
            isUpsell: !!isFsm, // only FSM-added services are upsells; sales revisions are part of initial sale
        }]);
    };

    const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
        setLineItems(prev => prev.map(li => {
            if (li.id !== id) return li;
            const updated = { ...li, ...updates };
            // Auto-compute tax when clientRate or zip changes
            if (!updated.taxExempt && updated.locationZip) {
                const rate = getTaxRate(updated.locationZip);
                if (rate) {
                    updated.taxRate = rate.combinedRate;
                    updated.taxAmount = calculateTax(updated.clientRate || 0, rate.combinedRate);
                }
            } else if (updated.taxExempt) {
                updated.taxAmount = 0;
            }
            return updated;
        }));
    };

    const removeLineItem = (id: string) => {
        setLineItems(prev => prev.filter(li => li.id !== id));
    };

    const handleServiceSelect = (itemId: string, serviceValue: string) => {
        const service = XIRI_SERVICES.find(s => s.value === serviceValue);
        if (!service) return;

        const isConsumable = service.category === 'consumables';
        updateLineItem(itemId, {
            serviceType: service.label,
            serviceCategory: service.category,
            isConsumable,
            // Consumables default to weekly
            ...(isConsumable ? { frequency: 'weekly' as const, daysOfWeek: undefined } : {}),
        });
    };

    const toggleDay = (itemId: string, dayIndex: number, currentDays: boolean[]) => {
        const newDays = [...currentDays];
        newDays[dayIndex] = !newDays[dayIndex];
        updateLineItem(itemId, { daysOfWeek: newDays });
    };

    const activeItems = lineItems.filter(li => li.lineItemStatus !== 'cancelled');
    const recurringItems = activeItems.filter(li => li.frequency !== 'one_time');
    const oneTimeItems = activeItems.filter(li => li.frequency === 'one_time');
    const recurringSubtotal = recurringItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const oneTimeSubtotal = oneTimeItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const subtotalBeforeTax = activeItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);
    const recurringTax = recurringItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const oneTimeTax = oneTimeItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const totalTax = activeItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const totalMonthly = recurringSubtotal + recurringTax;
    const totalOneTime = oneTimeSubtotal + oneTimeTax;

    const handleSubmit = async () => {
        if (lineItems.length === 0 || !profile) return;
        setSubmitting(true);

        try {
            if (isEditing && existingQuote) {
                // Update existing quote — preserve accepted items, only update pending/new ones
                const newVersion = (existingQuote.version || 1) + 1;

                // Build revision history snapshot of current state
                const revisionSnapshot = {
                    version: existingQuote.version || 1,
                    totalMonthlyRate: existingQuote.lineItems?.reduce((s, li) => s + (li.clientRate || 0), 0) || 0,
                    lineItems: stripUndefined(existingQuote.lineItems || []),
                    changedBy: profile.uid || profile.email || 'unknown',
                    changedAt: new Date(),
                    notes: notes || '',
                };

                await updateDoc(doc(db, 'quotes', existingQuote.quoteId), {
                    lineItems: stripUndefined(lineItems),
                    totalMonthlyRate: totalMonthly,
                    oneTimeCharges: totalOneTime,
                    subtotalBeforeTax,
                    totalTax,
                    contractTenure,
                    paymentTerms,
                    exitClause,
                    notes,
                    version: newVersion,
                    status: 'draft',
                    updatedAt: serverTimestamp(),
                });

                // Push revision to history (use arrayUnion-like approach via update)
                const quoteRef = doc(db, 'quotes', existingQuote.quoteId);
                const quoteDoc = await getDoc(quoteRef);
                const existingHistory = quoteDoc.data()?.revisionHistory || [];
                await updateDoc(quoteRef, {
                    revisionHistory: [...existingHistory, revisionSnapshot],
                });
                await addDoc(collection(db, 'activity_logs'), {
                    type: 'QUOTE_REVISED',
                    quoteId: existingQuote.quoteId,
                    toVersion: newVersion,
                    revisedBy: profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                });

                onCreated(existingQuote.quoteId);
            } else {
                // Create new
                if (!selectedLead) return;
                const docRef = await addDoc(collection(db, 'quotes'), {
                    leadId: selectedLead.id,
                    leadBusinessName: selectedLead.businessName,
                    lineItems: stripUndefined(lineItems),
                    totalMonthlyRate: totalMonthly,
                    oneTimeCharges: totalOneTime,
                    subtotalBeforeTax,
                    totalTax,
                    contractTenure,
                    paymentTerms,
                    exitClause,
                    notes,
                    version: 1,
                    revisionHistory: [],
                    status: 'draft',
                    createdBy: profile.uid || profile.email || 'unknown',
                    assignedTo: assignedTo || profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                await addDoc(collection(db, 'activity_logs'), {
                    type: 'QUOTE_CREATED',
                    quoteId: docRef.id,
                    leadId: selectedLead.id,
                    totalRate: totalMonthly,
                    createdBy: profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                });

                onCreated(docRef.id);
            }
        } catch (err) {
            console.error('Error saving quote:', err);
            alert('Failed to save quote. Check console for details.');
        } finally {
            setSubmitting(false);
        }
    };

    const canAdvance = () => {
        if (step === 0) return (selectedLead !== null && !existingQuoteId) || isEditing;
        if (step === 1) return locations.length > 0;
        if (step === 2) return lineItems.length > 0 && lineItems.every(li => li.serviceType && li.clientRate > 0);
        return true;
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const filteredLeads = leads.filter(l =>
        l.businessName?.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.contactName?.toLowerCase().includes(leadSearch.toLowerCase())
    );

    // Group services by category for the dropdown
    const servicesByCategory = XIRI_SERVICES.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
    }, {} as Record<string, typeof XIRI_SERVICES[number][]>);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold">New Quote</h2>
                        <p className="text-sm text-muted-foreground">
                            Step {step + 1} of {STEPS.length}: {STEPS[step]}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="flex gap-1">
                        {STEPS.map((s, i) => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Select Client */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <Input
                                placeholder="Search clients by name..."
                                value={leadSearch}
                                onChange={(e) => setLeadSearch(e.target.value)}
                                className="mb-2"
                            />
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {filteredLeads.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No leads found. Create a lead in the Sales CRM first.
                                    </p>
                                ) : (
                                    filteredLeads.map((lead) => (
                                        <Card
                                            key={lead.id}
                                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedLead?.id === lead.id
                                                ? 'border-primary ring-2 ring-primary/20'
                                                : ''
                                                }`}
                                            onClick={() => { setSelectedLead(lead); checkExistingQuote(lead.id); }}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Building2 className="w-5 h-5 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">{lead.businessName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {lead.contactName} • {lead.zipCode}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs capitalize">
                                                        {lead.facilityType?.replace(/_/g, ' ') || 'Unknown'}
                                                    </Badge>
                                                    {selectedLead?.id === lead.id && (
                                                        <Check className="w-5 h-5 text-primary" />
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            {/* Duplicate quote warning */}
                            {existingQuoteId && selectedLead && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm font-medium text-amber-800 mb-2">
                                        ⚠️ {selectedLead.businessName} already has an active quote.
                                    </p>
                                    <p className="text-xs text-amber-600 mb-3">
                                        To add services or update pricing, revise the existing quote instead of creating a new one.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                        onClick={() => {
                                            onClose();
                                            router.push(`/sales/quotes/${existingQuoteId}`);
                                        }}
                                    >
                                        Go to Existing Quote →
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Locations (with Google Maps) */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground mb-4">
                                Add all service locations for <span className="font-medium text-foreground">{selectedLead?.businessName}</span>.
                            </p>

                            {/* Existing Locations */}
                            {locations.map((loc) => (
                                <Card key={loc.id}>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{loc.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {loc.address}{loc.city ? `, ${loc.city}` : ''}{loc.state ? `, ${loc.state}` : ''} {loc.zip}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeLocation(loc.id)}>
                                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}

                            <Separator />

                            {/* Add New Location */}
                            <Card className="border-dashed">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Add Location</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <Label className="text-xs">Location Name</Label>
                                        <Input
                                            placeholder="e.g. Main Office, Suite 200"
                                            value={newLocationName}
                                            onChange={(e) => setNewLocationName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Address</Label>
                                        <GooglePlacesAutocomplete
                                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                            autocompletionRequest={{
                                                componentRestrictions: { country: ['us'] },
                                            }}
                                            selectProps={{
                                                value: newLocationAddress,
                                                onChange: handleAddressSelect,
                                                placeholder: "Start typing address...",
                                                className: "react-select-container",
                                                classNamePrefix: "react-select",
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-xs">City</Label>
                                            <Input
                                                placeholder="City"
                                                value={newLocationCity}
                                                onChange={(e) => setNewLocationCity(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">State</Label>
                                            <Input
                                                placeholder="NY"
                                                value={newLocationState}
                                                onChange={(e) => setNewLocationState(e.target.value)}
                                                maxLength={2}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Zip <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="11021"
                                                value={newLocationZip}
                                                onChange={(e) => setNewLocationZip(e.target.value)}
                                                maxLength={5}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={addLocation}
                                        variant="outline"
                                        className="gap-2"
                                        disabled={!newLocationName || !newLocationAddress || !newLocationZip}
                                    >
                                        <Plus className="w-4 h-4" /> Add Location
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 3: Services & Pricing */}
                    {step === 2 && (
                        <div className="space-y-6">
                            {locations.map((loc) => {
                                const locItems = lineItems.filter(li => li.locationId === loc.id);
                                return (
                                    <Card key={loc.id}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                                    <CardTitle className="text-base">{loc.name}</CardTitle>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 text-xs"
                                                    onClick={() => addLineItem(loc)}
                                                >
                                                    <Plus className="w-3 h-3" /> Add Service
                                                </Button>
                                            </div>
                                            <CardDescription className="text-xs">{loc.address}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {locItems.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                    No services yet. Click "Add Service" above.
                                                </p>
                                            ) : (
                                                locItems.map((item, itemIdx) => (
                                                    item.lineItemStatus === 'cancelled' ? (
                                                        /* ─── CANCELLED: Strikethrough display ─── */
                                                        <div key={item.id} className="border rounded-lg p-4 bg-red-50/50 border-red-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs font-medium">🚫 Cancelled</span>
                                                                <span className="font-medium text-sm line-through text-muted-foreground">{item.serviceType}</span>
                                                                <span className="text-xs text-muted-foreground line-through">
                                                                    {formatCurrency(item.clientRate)}/mo
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs text-muted-foreground"
                                                                onClick={() => updateLineItem(item.id, {
                                                                    lineItemStatus: 'accepted',
                                                                    cancelledInVersion: undefined,
                                                                })}
                                                            >
                                                                Undo
                                                            </Button>
                                                        </div>
                                                    ) : item.lineItemStatus === 'accepted' ? (
                                                        /* ─── ACCEPTED: Locked with Cancel/Edit actions ─── */
                                                        <div key={item.id} className="border rounded-lg p-4 bg-green-50/50 border-green-200">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs font-medium">✅ Accepted</span>
                                                                    <span className="font-medium text-sm">{item.serviceType}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {item.frequency === 'custom_days' && item.daysOfWeek
                                                                            ? item.daysOfWeek.map((d, i) => d ? DAY_LABELS[i] : null).filter(Boolean).join(', ')
                                                                            : item.frequency?.replace(/_/g, ' ')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-sm">{formatCurrency(item.clientRate)}/mo</span>
                                                                    {isEditing && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="text-xs h-7 px-2"
                                                                                onClick={() => updateLineItem(item.id, {
                                                                                    lineItemStatus: 'modified',
                                                                                    modifiedInVersion: existingQuote?.version ? existingQuote.version + 1 : 2,
                                                                                    previousValues: {
                                                                                        frequency: item.frequency,
                                                                                        daysOfWeek: item.daysOfWeek,
                                                                                        clientRate: item.clientRate,
                                                                                        serviceDate: item.serviceDate,
                                                                                    },
                                                                                })}
                                                                            >
                                                                                ✏️ Edit
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                onClick={() => updateLineItem(item.id, {
                                                                                    lineItemStatus: 'cancelled',
                                                                                    cancelledInVersion: existingQuote?.version ? existingQuote.version + 1 : 2,
                                                                                })}
                                                                            >
                                                                                🚫 Cancel
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div key={item.id} className={`border rounded-lg p-4 bg-muted/20 space-y-3 border-l-4 ${SERVICE_COLORS[itemIdx % SERVICE_COLORS.length]}`}>
                                                            {/* Service Number Header */}
                                                            <div className="flex items-center gap-2 pb-1 mb-1 border-b border-dashed">
                                                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service #{itemIdx + 1}</span>
                                                                {item.serviceType && <span className="text-xs text-muted-foreground">— {item.serviceType}</span>}
                                                            </div>
                                                            {/* Row 1: Service Type + Rate */}
                                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                                <div className="col-span-6">
                                                                    <Label className="text-xs text-muted-foreground">Service Type</Label>
                                                                    <select
                                                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                                        value={XIRI_SERVICES.find(s => s.label === item.serviceType)?.value || ''}
                                                                        onChange={(e) => handleServiceSelect(item.id, e.target.value)}
                                                                    >
                                                                        <option value="">Select a service...</option>
                                                                        {Object.entries(servicesByCategory).map(([cat, services]) => (
                                                                            <optgroup key={cat} label={SERVICE_CATEGORIES[cat as ServiceCategory]}>
                                                                                {services.map(s => (
                                                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                                                ))}
                                                                            </optgroup>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="col-span-4">
                                                                    <Label className="text-xs text-muted-foreground">
                                                                        {item.frequency === 'one_time' ? 'Flat Fee' : item.isConsumable ? 'Est. Monthly Cost' : 'Monthly Rate'}
                                                                    </Label>
                                                                    <div className="relative">
                                                                        <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                                                        <Input
                                                                            type="number"
                                                                            placeholder={item.isConsumable ? '500' : '2500'}
                                                                            className="pl-7"
                                                                            value={item.clientRate || ''}
                                                                            onChange={(e) => updateLineItem(item.id, {
                                                                                clientRate: parseFloat(e.target.value) || 0,
                                                                                ...(item.isConsumable ? { estimatedCost: parseFloat(e.target.value) || 0 } : {}),
                                                                            })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {/* Tax info */}
                                                                {item.locationZip && item.taxRate && !item.taxExempt && (
                                                                    <div className="col-span-12">
                                                                        <p className="text-xs text-muted-foreground">
                                                                            📍 ZIP {item.locationZip} — Tax: {(item.taxRate * 100).toFixed(3)}% = {formatCurrency(item.taxAmount || 0)}/mo
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {item.taxExempt && (
                                                                    <div className="col-span-12">
                                                                        <p className="text-xs text-green-600">✓ Tax exempt{item.taxExemptReason ? ` (${item.taxExemptReason})` : ''}</p>
                                                                    </div>
                                                                )}
                                                                <div className="col-span-2 flex justify-end">
                                                                    <Button variant="ghost" size="icon" onClick={() => removeLineItem(item.id)}>
                                                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* Row 2: Frequency (Google Calendar-style) */}
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                                                                    <select
                                                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                                        value={item.frequency === 'custom_days'
                                                                            ? (item.daysOfWeek && JSON.stringify(item.daysOfWeek) === JSON.stringify([false, true, true, true, true, true, false])
                                                                                ? 'weekdays'
                                                                                : 'custom_days')
                                                                            : item.frequency}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val === 'weekdays') {
                                                                                updateLineItem(item.id, {
                                                                                    frequency: 'custom_days',
                                                                                    daysOfWeek: [false, true, true, true, true, true, false],
                                                                                });
                                                                            } else if (val === 'nightly') {
                                                                                updateLineItem(item.id, {
                                                                                    frequency: 'nightly',
                                                                                    daysOfWeek: [true, true, true, true, true, true, true],
                                                                                });
                                                                            } else if (val === 'custom_days') {
                                                                                updateLineItem(item.id, {
                                                                                    frequency: 'custom_days',
                                                                                    daysOfWeek: item.daysOfWeek || [false, true, true, true, true, true, false],
                                                                                });
                                                                            } else {
                                                                                updateLineItem(item.id, {
                                                                                    frequency: val as QuoteLineItem['frequency'],
                                                                                    daysOfWeek: undefined,
                                                                                });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="one_time">Does not repeat (One-Time)</option>
                                                                        <option value="nightly">Daily (Mon–Sun)</option>
                                                                        <option value="weekdays">Every weekday (Mon–Fri)</option>
                                                                        <option value="weekly">Weekly</option>
                                                                        <option value="biweekly">Bi-Weekly</option>
                                                                        <option value="monthly">Monthly</option>
                                                                        <option value="quarterly">Quarterly</option>
                                                                        <option value="custom_days">Custom...</option>
                                                                    </select>
                                                                </div>

                                                                {/* Day Picker (shown only for Custom) */}
                                                                {item.frequency === 'custom_days' && item.daysOfWeek &&
                                                                    JSON.stringify(item.daysOfWeek) !== JSON.stringify([false, true, true, true, true, true, false]) && (
                                                                        <div>
                                                                            <Label className="text-xs text-muted-foreground">
                                                                                Select days — {item.daysOfWeek.filter(Boolean).length}x/week
                                                                            </Label>
                                                                            <div className="flex gap-1 mt-1">
                                                                                {DAY_LABELS.map((day, i) => (
                                                                                    <button
                                                                                        key={day}
                                                                                        type="button"
                                                                                        onClick={() => toggleDay(item.id, i, item.daysOfWeek!)}
                                                                                        className={`
                                                                                    w-10 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer
                                                                                    ${item.daysOfWeek![i]
                                                                                                ? 'bg-primary text-primary-foreground'
                                                                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                                                            }
                                                                                `}
                                                                                    >
                                                                                        {day}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                {/* Monthly/Quarterly pattern picker */}
                                                                {(item.frequency === 'monthly' || item.frequency === 'quarterly') && (
                                                                    <div className="flex items-center gap-2">
                                                                        <select
                                                                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                                            value={item.monthlyPattern?.type || 'none'}
                                                                            onChange={(e) => {
                                                                                const patternType = e.target.value;
                                                                                if (patternType === 'none') {
                                                                                    updateLineItem(item.id, { monthlyPattern: undefined });
                                                                                } else if (patternType === 'day_of_month') {
                                                                                    updateLineItem(item.id, {
                                                                                        monthlyPattern: { type: 'day_of_month', day: 1 },
                                                                                    });
                                                                                } else if (patternType === 'nth_weekday') {
                                                                                    updateLineItem(item.id, {
                                                                                        monthlyPattern: { type: 'nth_weekday', week: 1, dayOfWeek: 1 },
                                                                                    });
                                                                                }
                                                                            }}
                                                                        >
                                                                            <option value="none">No specific schedule</option>
                                                                            <option value="day_of_month">On day of month...</option>
                                                                            <option value="nth_weekday">On nth weekday...</option>
                                                                        </select>

                                                                        {item.monthlyPattern?.type === 'day_of_month' && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-xs text-muted-foreground">Day</span>
                                                                                <select
                                                                                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
                                                                                    value={item.monthlyPattern.day}
                                                                                    onChange={(e) => updateLineItem(item.id, {
                                                                                        monthlyPattern: { type: 'day_of_month', day: parseInt(e.target.value) },
                                                                                    })}
                                                                                >
                                                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                                        <option key={d} value={d}>{d}</option>
                                                                                    ))}
                                                                                </select>
                                                                                <span className="text-xs text-muted-foreground">of each {item.frequency === 'quarterly' ? 'quarter' : 'month'}</span>
                                                                            </div>
                                                                        )}

                                                                        {item.monthlyPattern?.type === 'nth_weekday' && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <select
                                                                                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
                                                                                    value={item.monthlyPattern.week}
                                                                                    onChange={(e) => updateLineItem(item.id, {
                                                                                        monthlyPattern: {
                                                                                            type: 'nth_weekday',
                                                                                            week: parseInt(e.target.value) as 1 | 2 | 3 | 4,
                                                                                            dayOfWeek: (item.monthlyPattern as any).dayOfWeek || 1,
                                                                                        },
                                                                                    })}
                                                                                >
                                                                                    <option value={1}>1st</option>
                                                                                    <option value={2}>2nd</option>
                                                                                    <option value={3}>3rd</option>
                                                                                    <option value={4}>4th</option>
                                                                                </select>
                                                                                <select
                                                                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                                                    value={item.monthlyPattern.dayOfWeek}
                                                                                    onChange={(e) => updateLineItem(item.id, {
                                                                                        monthlyPattern: {
                                                                                            type: 'nth_weekday',
                                                                                            week: (item.monthlyPattern as any).week || 1,
                                                                                            dayOfWeek: parseInt(e.target.value),
                                                                                        },
                                                                                    })}
                                                                                >
                                                                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                                                                        <option key={d} value={i}>{d}</option>
                                                                                    ))}
                                                                                </select>
                                                                                <span className="text-xs text-muted-foreground">of each {item.frequency === 'quarterly' ? 'quarter' : 'month'}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Service Date */}
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">
                                                                        {item.frequency === 'one_time' || item.frequency === 'quarterly'
                                                                            ? 'Service Date'
                                                                            : 'Start Service Date'}
                                                                    </Label>
                                                                    <Input
                                                                        type="date"
                                                                        className="mt-1"
                                                                        value={item.serviceDate || ''}
                                                                        onChange={(e) => updateLineItem(item.id, { serviceDate: e.target.value })}
                                                                    />
                                                                </div>

                                                                {/* Consumable info */}
                                                                {item.isConsumable && (
                                                                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                                                                        ⓘ Estimated cost — actual cost will be updated after procurement with markup.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {/* Running Total */}
                            <div className="p-4 bg-muted/30 rounded-lg border space-y-1">
                                {recurringItems.length > 0 && (
                                    <div className="flex justify-end items-center gap-4">
                                        <span className="text-sm text-muted-foreground">Monthly Recurring:</span>
                                        <span className="text-lg font-medium">{formatCurrency(recurringSubtotal + recurringTax)}</span>
                                        <span className="text-xs text-muted-foreground">/mo</span>
                                    </div>
                                )}
                                {oneTimeItems.length > 0 && (
                                    <div className="flex justify-end items-center gap-4">
                                        <span className="text-sm text-muted-foreground">One-Time Charges:</span>
                                        <span className="text-lg font-medium">{formatCurrency(oneTimeSubtotal + oneTimeTax)}</span>
                                        <span className="text-xs text-muted-foreground">one-time</span>
                                    </div>
                                )}
                                {totalTax > 0 && (
                                    <div className="flex justify-end items-center gap-4 text-xs text-muted-foreground">
                                        <span>Includes {formatCurrency(totalTax)} in sales tax</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Terms & Submit */}
                    {step === 3 && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <Card className="bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Quote Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Client</span>
                                        <span className="font-medium">{selectedLead?.businessName}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Locations</span>
                                        <span className="font-medium">{locations.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Services</span>
                                        <span className="font-medium">{lineItems.length}</span>
                                    </div>
                                    {/* Line item summary */}
                                    {/* Recurring Services */}
                                    {recurringItems.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurring Services</p>
                                            {recurringItems.map(li => (
                                                <div key={li.id} className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{li.serviceType} — {li.locationName} ({FrequencyDisplay(li)})</span>
                                                    <span className="font-medium text-foreground">{formatCurrency(li.clientRate)}/mo</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {/* One-Time Services */}
                                    {oneTimeItems.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">One-Time Services</p>
                                            {oneTimeItems.map(li => (
                                                <div key={li.id} className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{li.serviceType} — {li.locationName}</span>
                                                    <span className="font-medium text-foreground">{formatCurrency(li.clientRate)}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    <Separator />
                                    {recurringItems.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="font-medium">Monthly Recurring (incl. tax)</span>
                                            <span className="text-xl font-bold text-primary">{formatCurrency(totalMonthly)}/mo</span>
                                        </div>
                                    )}
                                    {oneTimeItems.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="font-medium">One-Time Charges (incl. tax)</span>
                                            <span className="text-xl font-bold text-amber-600">{formatCurrency(totalOneTime)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Terms */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Contract Tenure</Label>
                                    <select
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                        value={contractTenure}
                                        onChange={(e) => setContractTenure(Number(e.target.value))}
                                    >
                                        <option value={6}>6 Months</option>
                                        <option value={12}>12 Months</option>
                                        <option value={18}>18 Months</option>
                                        <option value={24}>24 Months</option>
                                        <option value={36}>36 Months</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>Payment Due Day</Label>
                                    <select
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                        value={paymentTerms}
                                        onChange={(e) => setPaymentTerms(e.target.value)}
                                    >
                                        <option value="Pay on the 1st">Pay on the 1st</option>
                                        <option value="Pay on the 5th">Pay on the 5th</option>
                                        <option value="Pay on the 10th">Pay on the 10th</option>
                                        <option value="Pay on the 15th">Pay on the 15th</option>
                                        <option value="Pay on the 20th">Pay on the 20th</option>
                                        <option value="Pay on the 25th">Pay on the 25th</option>
                                        <option value="Pay on the last day">Pay on the last day</option>
                                    </select>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Invoice issued on the 1st of each month, or at service start (pro-rated).
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label>Exit Clause</Label>
                                <Input
                                    value={exitClause}
                                    onChange={(e) => setExitClause(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            {/* Commission Assignment */}
                            <div>
                                <Label className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Commission Assigned To
                                </Label>
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                    value={assignedTo}
                                    onChange={(e) => setAssignedTo(e.target.value)}
                                >
                                    {salesUsers.map(u => (
                                        <option key={u.uid} value={u.uid}>
                                            {u.displayName}{u.uid === profile?.uid ? ' (You)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Sales commission will be calculated when the quote is accepted.
                                </p>
                            </div>

                            <div>
                                <Label>Notes (optional)</Label>
                                <textarea
                                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any additional notes about this quote..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-muted/10">
                    <Button
                        variant="outline"
                        onClick={() => step > 0 ? setStep(step - 1) : onClose()}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {step > 0 ? 'Back' : 'Cancel'}
                    </Button>

                    {step < STEPS.length - 1 ? (
                        <Button
                            onClick={() => setStep(step + 1)}
                            disabled={!canAdvance()}
                            className="gap-2"
                        >
                            Next
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !canAdvance()}
                            className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                            {submitting ? 'Creating...' : 'Create Quote'}
                            <Check className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
