"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Sparkles, Plus } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { EnrichButton } from "@/components/EnrichButton";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

interface AddLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DEFAULT_FACILITY_TYPES = [
    { value: "medical_urgent_care", label: "Medical - Urgent Care" },
    { value: "medical_private", label: "Medical - Private Practice" },
    { value: "medical_surgery", label: "Medical - Surgery Center" },
    { value: "medical_dialysis", label: "Medical - Dialysis Center" },
    { value: "medical_dental", label: "Medical - Dental" },
    { value: "medical_veterinary", label: "Medical - Veterinary" },
    { value: "auto_dealer_showroom", label: "Auto - Dealership Showroom" },
    { value: "auto_service_center", label: "Auto - Service Center" },
    { value: "edu_daycare", label: "Education - Daycare" },
    { value: "edu_private_school", label: "Education - Private School" },
    { value: "lab_cleanroom", label: "Lab - Cleanroom (ISO)" },
    { value: "lab_bsl", label: "Lab - BSL-1/BSL-2" },
    { value: "manufacturing_light", label: "Manufacturing - Light" },
    { value: "office_general", label: "Office - General" },
    { value: "fitness_gym", label: "Fitness - Gym" },
    { value: "retail_storefront", label: "Retail - Storefront" },
    { value: "other", label: "Other" },
];

function loadCustomFacilityTypes(): { value: string; label: string }[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('custom-facility-types') || '[]');
}

function saveCustomFacilityType(type: { value: string; label: string }) {
    const existing = loadCustomFacilityTypes();
    if (!existing.find(t => t.value === type.value)) {
        existing.push(type);
        localStorage.setItem('custom-facility-types', JSON.stringify(existing));
    }
}

const ATTRIBUTION_SOURCES = [
    { value: "Referral", label: "Referral" },
    { value: "Manual Search", label: "Manual Search" },
    { value: "Networking Event", label: "Networking Event" },
    { value: "Cold Outreach", label: "Cold Outreach" },
    { value: "Other", label: "Other" },
];

function FacilityTypeCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [customTypes, setCustomTypes] = useState<{ value: string; label: string }[]>(loadCustomFacilityTypes());
    const wrapperRef = useRef<HTMLDivElement>(null);

    const allTypes = [...DEFAULT_FACILITY_TYPES, ...customTypes];
    const selectedLabel = allTypes.find(t => t.value === value)?.label || value || "";

    const filtered = search
        ? allTypes.filter(t => t.label.toLowerCase().includes(search.toLowerCase()))
        : allTypes;

    const exactMatch = allTypes.some(t => t.label.toLowerCase() === search.toLowerCase());
    const showAddNew = search.length > 0 && !exactMatch;

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch("");
    };

    const handleAddNew = () => {
        const slug = search.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const newType = { value: slug, label: search };
        saveCustomFacilityType(newType);
        setCustomTypes([...customTypes, newType]);
        onChange(slug);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div ref={wrapperRef} className="relative">
            <Label>Facility Type</Label>
            <div
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => { setIsOpen(true); setSearch(""); }}
            >
                {isOpen ? (
                    <input
                        autoFocus
                        className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder="Search or type new..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { setIsOpen(false); setSearch(""); }
                            if (e.key === 'Enter' && filtered.length === 1) {
                                e.preventDefault();
                                handleSelect(filtered[0].value);
                            }
                            if (e.key === 'Enter' && filtered.length === 0 && showAddNew) {
                                e.preventDefault();
                                handleAddNew();
                            }
                        }}
                    />
                ) : (
                    <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
                        {selectedLabel || "Select facility type"}
                    </span>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {filtered.map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${type.value === value ? 'bg-accent font-medium' : ''}`}
                            onClick={() => handleSelect(type.value)}
                        >
                            {type.label}
                        </button>
                    ))}
                    {showAddNew && (
                        <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors text-primary font-medium flex items-center gap-1.5 border-t"
                            onClick={handleAddNew}
                        >
                            <Plus className="w-3.5 h-3.5" /> Add &ldquo;{search}&rdquo; as new type
                        </button>
                    )}
                    {filtered.length === 0 && !showAddNew && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                    )}
                </div>
            )}
        </div>
    );
}

export function AddLeadDialog({ open, onOpenChange }: AddLeadDialogProps) {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [tempLeadId, setTempLeadId] = useState<string | null>(null);

    // Form state
    const [businessName, setBusinessName] = useState("");
    const [website, setWebsite] = useState("");
    const [address, setAddress] = useState<any>(null);
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [zip, setZip] = useState("");
    const [facilityType, setFacilityType] = useState("");
    const [contactName, setContactName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [attributionSource, setAttributionSource] = useState("Referral");

    const handleAddressSelect = (selected: any) => {
        setAddress(selected);

        // Extract address components from Google Places
        if (selected?.value?.place_id) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ placeId: selected.value.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const components = results[0].address_components;

                    let streetNumber = '';
                    let streetName = '';

                    components.forEach((component: any) => {
                        if (component.types.includes('street_number')) {
                            streetNumber = component.long_name;
                        }
                        if (component.types.includes('route')) {
                            streetName = component.long_name;
                        }
                        if (component.types.includes('locality')) {
                            setCity(component.long_name);
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                            setState(component.short_name);
                        }
                        if (component.types.includes('postal_code')) {
                            setZip(component.long_name);
                        }
                    });

                    // Show only street number + name in the address field
                    const streetOnly = [streetNumber, streetName].filter(Boolean).join(' ');
                    if (streetOnly) {
                        setAddress({ ...selected, label: streetOnly });
                    }

                    // Infer facility type from place types
                    const types = results[0].types;
                    if (types.includes('hospital') || types.includes('doctor')) {
                        setFacilityType('medical_urgent_care');
                    } else if (types.includes('car_dealer')) {
                        setFacilityType('auto_dealer_showroom');
                    } else if (types.includes('car_repair')) {
                        setFacilityType('auto_service_center');
                    } else if (types.includes('school')) {
                        setFacilityType('edu_private_school');
                    } else if (types.includes('gym')) {
                        setFacilityType('fitness_gym');
                    }
                }
            });
        }
    };

    const handlePhoneChange = (value: string) => {
        const input = value.replace(/\D/g, '');
        let formatted = '';

        if (input.length > 0) {
            formatted = '(' + input.substring(0, 3);
            if (input.length >= 3) {
                formatted += ') ' + input.substring(3, 6);
            }
            if (input.length >= 6) {
                formatted += '-' + input.substring(6, 10);
            }
        }

        setPhone(formatted);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!businessName || !address) return;

        setSubmitting(true);
        try {
            const leadData = {
                businessName,
                website: website || null,
                address: address.label,
                city,
                state,
                zip,
                facilityType: facilityType || null,
                contactName: contactName || null,
                email: email || null,
                phone: phone || null,
                notes: notes || null,
                status: 'new',
                attribution: {
                    source: attributionSource,
                    medium: 'manual',
                    campaign: 'manual-entry',
                    landingPage: '/sales/crm',
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user?.uid || 'unknown',
            };

            await addDoc(collection(db, 'leads'), leadData);

            // Reset form
            setBusinessName("");
            setWebsite("");
            setAddress(null);
            setCity("");
            setState("");
            setZip("");
            setFacilityType("");
            setContactName("");
            setEmail("");
            setPhone("");
            setNotes("");
            setAttributionSource("Referral");

            onOpenChange(false);
        } catch (error) {
            console.error("Error adding lead:", error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    <DialogDescription>
                        Manually add a lead from a referral or self-prospecting
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Business Name */}
                    <div>
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                            id="businessName"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="ABC Medical Center"
                            required
                        />
                    </div>

                    {/* Website */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="website">Website (optional)</Label>
                            {website && (
                                <EnrichButton
                                    website={website}
                                    previewOnly={true}
                                    size="sm"
                                    variant="outline"
                                    onSuccess={(data) => {
                                        // Auto-populate form fields
                                        if (data.data?.email && !email) setEmail(data.data.email);
                                        if (data.data?.phone && !phone) setPhone(data.data.phone);
                                        if (data.data?.address && !address) {
                                            // Note: Can't auto-fill address field as it requires Google Places object
                                        }
                                        if (data.data?.businessName && !businessName) setBusinessName(data.data.businessName);
                                    }}
                                    onError={(error) => {
                                        console.error('Enrichment error:', error);
                                    }}
                                />
                            )}
                        </div>
                        <Input
                            id="website"
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://example.com"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {website ? 'Click "Enrich" to auto-fill contact details' : 'Enter website to enable auto-fill'}
                        </p>
                    </div>

                    {/* Address */}
                    <div>
                        <Label>Address *</Label>
                        <GooglePlacesAutocomplete
                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                            autocompletionRequest={{
                                componentRestrictions: { country: ['us'] },
                            }}
                            selectProps={{
                                value: address,
                                onChange: handleAddressSelect,
                                placeholder: "Start typing address...",
                                className: "react-select-container",
                                classNamePrefix: "react-select",
                            }}
                        />
                    </div>

                    {/* City, State, Zip */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="Chicago"
                            />
                        </div>
                        <div>
                            <Label htmlFor="state">State</Label>
                            <Input
                                id="state"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                placeholder="IL"
                                maxLength={2}
                            />
                        </div>
                        <div>
                            <Label htmlFor="zip">Zip</Label>
                            <Input
                                id="zip"
                                value={zip}
                                onChange={(e) => setZip(e.target.value)}
                                placeholder="60601"
                                maxLength={5}
                            />
                        </div>
                    </div>

                    {/* Facility Type — Creatable Combobox */}
                    <FacilityTypeCombobox value={facilityType} onChange={setFacilityType} />

                    {/* Contact Details */}
                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-medium">Contact Information (Optional)</h4>

                        <div>
                            <Label htmlFor="contactName">Contact Name</Label>
                            <Input
                                id="contactName"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                placeholder="John Smith"
                            />
                        </div>

                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@example.com"
                            />
                        </div>

                        <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="(555) 123-4567"
                                maxLength={14}
                            />
                        </div>
                    </div>

                    {/* Attribution */}
                    <div>
                        <Label htmlFor="attribution">Lead Source</Label>
                        <Select value={attributionSource} onValueChange={setAttributionSource}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ATTRIBUTION_SOURCES.map((source) => (
                                    <SelectItem key={source.value} value={source.value}>
                                        {source.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Additional context about this lead..."
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting || !businessName || !address}>
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Lead
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
