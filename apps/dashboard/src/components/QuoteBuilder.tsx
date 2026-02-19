'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, QuoteLineItem } from '@xiri/shared';
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
    Plus, Trash2, DollarSign, FileText, ClipboardList
} from 'lucide-react';

interface QuoteBuilderProps {
    onClose: () => void;
    onCreated: (quoteId: string) => void;
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

function FrequencyDisplay(item: QuoteLineItem): string {
    if (item.frequency === 'custom_days' && item.daysOfWeek) {
        const count = item.daysOfWeek.filter(Boolean).length;
        const days = item.daysOfWeek.map((d, i) => d ? DAY_LABELS[i] : null).filter(Boolean);
        return `${count}x/week (${days.join(', ')})`;
    }
    if (item.frequency === 'nightly') return '7x/week (Nightly)';
    return item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1);
}

export default function QuoteBuilder({ onClose, onCreated }: QuoteBuilderProps) {
    const { profile } = useAuth();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    // Step 1: Client selection
    const [leads, setLeads] = useState<(Lead & { id: string })[]>([]);
    const [selectedLead, setSelectedLead] = useState<(Lead & { id: string }) | null>(null);
    const [leadSearch, setLeadSearch] = useState('');

    // Step 2: Locations
    const [locations, setLocations] = useState<Location[]>([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState<any>(null);
    const [newLocationCity, setNewLocationCity] = useState('');
    const [newLocationState, setNewLocationState] = useState('');
    const [newLocationZip, setNewLocationZip] = useState('');

    // Step 3: Line items
    const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);

    // Step 4: Terms
    const [contractTenure, setContractTenure] = useState(12);
    const [paymentTerms, setPaymentTerms] = useState('Net 25');
    const [exitClause, setExitClause] = useState('30-day written notice');
    const [notes, setNotes] = useState('');

    // Fetch leads
    useEffect(() => {
        async function fetchLeads() {
            const q = query(collection(db, 'leads'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead & { id: string }));
            setLeads(data);
        }
        fetchLeads();
    }, []);

    // When a lead is selected, pre-populate locations
    useEffect(() => {
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
        if (!newLocationName || !newLocationAddress) return;
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

    const addLineItem = (locationId: string, locationName: string) => {
        setLineItems(prev => [...prev, {
            id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            locationId,
            locationName,
            serviceType: '',
            serviceCategory: undefined,
            frequency: 'custom_days',
            daysOfWeek: [false, true, true, true, true, true, false], // Mon-Fri default
            clientRate: 0,
        }]);
    };

    const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
        setLineItems(prev => prev.map(li => li.id === id ? { ...li, ...updates } : li));
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

    const totalMonthly = lineItems.reduce((sum, li) => sum + (li.clientRate || 0), 0);

    const handleSubmit = async () => {
        if (!selectedLead || lineItems.length === 0 || !profile) return;
        setSubmitting(true);

        try {
            const docRef = await addDoc(collection(db, 'quotes'), {
                leadId: selectedLead.id,
                leadBusinessName: selectedLead.businessName,
                lineItems,
                totalMonthlyRate: totalMonthly,
                contractTenure,
                paymentTerms,
                exitClause,
                notes,
                version: 1,
                revisionHistory: [],
                status: 'draft',
                createdBy: profile.uid || profile.email || 'unknown',
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
        } catch (err) {
            console.error('Error creating quote:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const canAdvance = () => {
        if (step === 0) return selectedLead !== null;
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
                                            onClick={() => setSelectedLead(lead)}
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
                                            <Label className="text-xs">Zip</Label>
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
                                        disabled={!newLocationName || !newLocationAddress}
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
                                                    onClick={() => addLineItem(loc.id, loc.name)}
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
                                                locItems.map((item) => (
                                                    <div key={item.id} className="border rounded-lg p-4 bg-muted/20 space-y-3">
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
                                                                    {item.isConsumable ? 'Est. Monthly Cost' : 'Monthly Rate'}
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
                                                            <div className="col-span-2 flex justify-end">
                                                                <Button variant="ghost" size="icon" onClick={() => removeLineItem(item.id)}>
                                                                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Frequency + Day Selector */}
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-40">
                                                                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                                                                    <select
                                                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                                        value={item.frequency}
                                                                        onChange={(e) => {
                                                                            const freq = e.target.value as QuoteLineItem['frequency'];
                                                                            const updates: Partial<QuoteLineItem> = { frequency: freq };
                                                                            if (freq === 'nightly') {
                                                                                updates.daysOfWeek = [true, true, true, true, true, true, true];
                                                                            } else if (freq === 'custom_days') {
                                                                                updates.daysOfWeek = item.daysOfWeek || [false, true, true, true, true, true, false];
                                                                            } else {
                                                                                updates.daysOfWeek = undefined;
                                                                            }
                                                                            updateLineItem(item.id, updates);
                                                                        }}
                                                                    >
                                                                        <option value="custom_days">Custom Days</option>
                                                                        <option value="nightly">Nightly (7x)</option>
                                                                        <option value="weekly">Weekly</option>
                                                                        <option value="biweekly">Bi-Weekly</option>
                                                                        <option value="monthly">Monthly</option>
                                                                        <option value="quarterly">Quarterly</option>
                                                                    </select>
                                                                </div>

                                                                {/* Day Picker (shown for custom_days and nightly) */}
                                                                {(item.frequency === 'custom_days' || item.frequency === 'nightly') && item.daysOfWeek && (
                                                                    <div className="flex-1">
                                                                        <Label className="text-xs text-muted-foreground">
                                                                            Days — {item.daysOfWeek.filter(Boolean).length}x/week
                                                                        </Label>
                                                                        <div className="flex gap-1 mt-1">
                                                                            {DAY_LABELS.map((day, i) => (
                                                                                <button
                                                                                    key={day}
                                                                                    type="button"
                                                                                    onClick={() => item.frequency === 'custom_days' && toggleDay(item.id, i, item.daysOfWeek!)}
                                                                                    className={`
                                                                                        w-10 h-8 rounded-md text-xs font-medium transition-colors
                                                                                        ${item.daysOfWeek![i]
                                                                                            ? 'bg-primary text-primary-foreground'
                                                                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                                                        }
                                                                                        ${item.frequency === 'nightly' ? 'cursor-default opacity-80' : 'cursor-pointer'}
                                                                                    `}
                                                                                    disabled={item.frequency === 'nightly'}
                                                                                >
                                                                                    {day}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Consumable info */}
                                                            {item.isConsumable && (
                                                                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                                                                    ⓘ Estimated cost — actual cost will be updated after procurement with markup.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {/* Running Total */}
                            <div className="flex justify-end items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                                <span className="text-sm font-medium">Total Monthly Rate:</span>
                                <span className="text-2xl font-bold text-primary">{formatCurrency(totalMonthly)}</span>
                                <span className="text-xs text-muted-foreground">/mo</span>
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
                                    <Separator />
                                    {lineItems.map(li => (
                                        <div key={li.id} className="flex justify-between text-xs text-muted-foreground">
                                            <span>{li.serviceType} — {li.locationName} ({FrequencyDisplay(li)})</span>
                                            <span className="font-medium text-foreground">{formatCurrency(li.clientRate)}</span>
                                        </div>
                                    ))}
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="font-medium">Monthly Rate</span>
                                        <span className="text-xl font-bold text-primary">{formatCurrency(totalMonthly)}</span>
                                    </div>
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
                                    <Label>Payment Terms</Label>
                                    <Input
                                        value={paymentTerms}
                                        onChange={(e) => setPaymentTerms(e.target.value)}
                                        className="mt-1"
                                    />
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
