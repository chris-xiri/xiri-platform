"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Sparkles, Plus, User, ChevronDown, ChevronUp, Building2, Search, MapPin } from "lucide-react";
import { collection, doc, serverTimestamp, writeBatch, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { EnrichButton } from "@/components/EnrichButton";
import { FACILITY_TYPE_OPTIONS } from '@xiri-facility-solutions/shared';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

interface AddLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CompanyOption {
    id: string;
    businessName: string;
    address?: string;
    city?: string;
    state?: string;
}

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

    const allTypes = [...FACILITY_TYPE_OPTIONS, ...customTypes];
    const selectedLabel = allTypes.find(t => t.value === value)?.label || value || "";

    const filtered = search
        ? allTypes.filter(t => t.label.toLowerCase().includes(search.toLowerCase()))
        : allTypes;

    const exactMatch = allTypes.some(t => t.label.toLowerCase() === search.toLowerCase());
    const showAddNew = search.length > 0 && !exactMatch;

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

// ─── Company Combobox ────────────────────────────────────────────────────────
function CompanyCombobox({
    value,
    onChange,
    onCreateNew,
}: {
    value: string | null;             // selected companyId
    onChange: (companyId: string, companyName: string) => void;
    onCreateNew: () => void;
}) {
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch companies once on mount
    useEffect(() => {
        const q = query(collection(db, "companies"), orderBy("businessName", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const list: CompanyOption[] = [];
            snap.forEach((d) => {
                const data = d.data();
                list.push({
                    id: d.id,
                    businessName: data.businessName || "Unnamed",
                    address: data.address,
                    city: data.city,
                    state: data.state,
                });
            });
            setCompanies(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Also check 'leads' collection for backward compat (existing leads not yet migrated)
    const [legacyCompanies, setLegacyCompanies] = useState<CompanyOption[]>([]);
    useEffect(() => {
        const q = query(collection(db, "leads"), orderBy("businessName", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const list: CompanyOption[] = [];
            snap.forEach((d) => {
                const data = d.data();
                if (data.businessName) {
                    list.push({
                        id: d.id,
                        businessName: data.businessName,
                        address: data.address,
                        city: data.city,
                        state: data.state,
                    });
                }
            });
            setLegacyCompanies(list);
        });
        return () => unsub();
    }, []);

    const allCompanies = [...companies, ...legacyCompanies];

    // Deduplicate by id
    const uniqueCompanies = allCompanies.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

    const filtered = search
        ? uniqueCompanies.filter(c =>
            c.businessName.toLowerCase().includes(search.toLowerCase()) ||
            (c.address && c.address.toLowerCase().includes(search.toLowerCase())) ||
            (c.city && c.city.toLowerCase().includes(search.toLowerCase()))
        )
        : uniqueCompanies;

    const selectedCompany = value ? uniqueCompanies.find(c => c.id === value) : null;

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

    return (
        <div ref={wrapperRef} className="relative">
            <Label className="flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5" /> Company
            </Label>
            <div
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => { setIsOpen(true); setSearch(""); }}
            >
                {isOpen ? (
                    <div className="flex items-center gap-2 w-full">
                        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <input
                            autoFocus
                            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                            placeholder="Search existing companies..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') { setIsOpen(false); setSearch(""); }
                            }}
                        />
                    </div>
                ) : (
                    <span className={selectedCompany ? "text-foreground" : "text-muted-foreground"}>
                        {selectedCompany ? selectedCompany.businessName : "Select or create a company"}
                    </span>
                )}
                {selectedCompany && !isOpen && (
                    <button
                        type="button"
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onChange("", ""); }}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {loading ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading companies...
                        </div>
                    ) : (
                        <>
                            {/* Create new company option — always on top */}
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors text-primary font-medium flex items-center gap-1.5 border-b bg-primary/5"
                                onClick={() => {
                                    setIsOpen(false);
                                    setSearch("");
                                    onCreateNew();
                                }}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Create new company{search && ` "${search}"`}
                            </button>

                            {filtered.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                    No companies match "{search}"
                                </div>
                            ) : (
                                filtered.slice(0, 50).map((company) => (
                                    <button
                                        key={company.id}
                                        type="button"
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${company.id === value ? 'bg-accent font-medium' : ''}`}
                                        onClick={() => {
                                            onChange(company.id, company.businessName);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                    >
                                        <div className="font-medium">{company.businessName}</div>
                                        {(company.address || company.city) && (
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {[company.address, company.city, company.state].filter(Boolean).join(', ')}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────
export function AddLeadDialog({ open, onOpenChange }: AddLeadDialogProps) {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    // Contact fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [contactRole, setContactRole] = useState("");

    // Company selection
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [selectedCompanyName, setSelectedCompanyName] = useState("");
    const [creatingNewCompany, setCreatingNewCompany] = useState(false);

    // New company fields (only shown when creatingNewCompany)
    const [businessName, setBusinessName] = useState("");
    const [businessNamePlaces, setBusinessNamePlaces] = useState<any>(null);
    const [website, setWebsite] = useState("");
    const [address, setAddress] = useState<any>(null);
    const [companyPhone, setCompanyPhone] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [zip, setZip] = useState("");
    const [facilityType, setFacilityType] = useState("");
    const [leadType, setLeadType] = useState("tenant");
    const [attributionSource, setAttributionSource] = useState("__none");
    const [notes, setNotes] = useState("");
    const placesServiceRef = useRef<HTMLDivElement>(null);

    const handleCompanySelect = (companyId: string, companyName: string) => {
        setSelectedCompanyId(companyId || null);
        setSelectedCompanyName(companyName);
        setCreatingNewCompany(false);
    };

    const handleCreateNewCompany = () => {
        setSelectedCompanyId(null);
        setSelectedCompanyName("");
        setCreatingNewCompany(true);
    };

    // Helper: extract address components from PlacesService result
    const extractAddressComponents = useCallback((place: google.maps.places.PlaceResult) => {
        const components = place.address_components || [];
        let streetNumber = '';
        let streetName = '';

        components.forEach((component: any) => {
            if (component.types.includes('street_number')) streetNumber = component.long_name;
            if (component.types.includes('route')) streetName = component.long_name;
            if (component.types.includes('locality')) setCity(component.long_name);
            if (component.types.includes('administrative_area_level_1')) setState(component.short_name);
            if (component.types.includes('postal_code')) setZip(component.long_name);
        });

        const streetOnly = [streetNumber, streetName].filter(Boolean).join(' ');
        if (streetOnly) {
            setAddress({ label: streetOnly, value: { place_id: place.place_id } });
        } else if (place.formatted_address) {
            // Fallback: use the portion before the first comma
            const addrPart = place.formatted_address.split(',')[0];
            setAddress({ label: addrPart, value: { place_id: place.place_id } });
        }

        // Auto-detect facility type from place types
        const types = place.types || [];
        if (types.includes('hospital') || types.includes('doctor')) setFacilityType('medical_urgent_care');
        else if (types.includes('car_dealer')) setFacilityType('auto_dealer_showroom');
        else if (types.includes('car_repair')) setFacilityType('auto_service_center');
        else if (types.includes('school')) setFacilityType('edu_private_school');
        else if (types.includes('gym')) setFacilityType('fitness_gym');
    }, []);

    // Format a raw US phone string into (XXX) XXX-XXXX
    const formatPhoneNumber = (raw: string): string => {
        const digits = raw.replace(/\D/g, '');
        // Strip leading country code 1
        const local = digits.startsWith('1') && digits.length === 11 ? digits.substring(1) : digits;
        if (local.length === 10) {
            return `(${local.substring(0, 3)}) ${local.substring(3, 6)}-${local.substring(6, 10)}`;
        }
        return raw; // Return as-is if not standard US
    };

    // Fetch full place details (address, phone, website) from a place_id
    const fetchPlaceDetails = useCallback((placeId: string, opts?: { setName?: boolean }) => {
        if (!placesServiceRef.current) return;
        const service = new google.maps.places.PlacesService(placesServiceRef.current);
        service.getDetails(
            {
                placeId,
                fields: [
                    'name', 'formatted_address', 'address_components',
                    'formatted_phone_number', 'international_phone_number',
                    'website', 'types', 'place_id',
                ],
            },
            (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    // Set business name if requested (from Business Name autocomplete)
                    if (opts?.setName && place.name) {
                        setBusinessName(place.name);
                    }

                    // Extract address components
                    extractAddressComponents(place);

                    // Phone number
                    if (place.formatted_phone_number) {
                        const formatted = formatPhoneNumber(place.formatted_phone_number);
                        setCompanyPhone(formatted);
                        // Also set contact phone if empty
                        setPhone(prev => prev || formatted);
                    }

                    // Website
                    if (place.website && !website) {
                        const w = place.website.replace(/\/$/, '');
                        setWebsite(w);
                    }
                }
            }
        );
    }, [extractAddressComponents, website]);

    // Handle business name autocomplete selection
    const handleBusinessNameSelect = (selected: any) => {
        setBusinessNamePlaces(selected);
        if (selected?.value?.place_id) {
            fetchPlaceDetails(selected.value.place_id, { setName: true });
        } else if (selected?.label) {
            setBusinessName(selected.label);
        }
    };

    const handleAddressSelect = (selected: any) => {
        setAddress(selected);
        if (selected?.value?.place_id) {
            fetchPlaceDetails(selected.value.place_id);
        }
    };

    const handlePhoneChange = (value: string) => {
        const input = value.replace(/\D/g, '');
        let formatted = '';
        if (input.length > 0) {
            formatted = '(' + input.substring(0, 3);
            if (input.length >= 3) formatted += ') ' + input.substring(3, 6);
            if (input.length >= 6) formatted += '-' + input.substring(6, 10);
        }
        setPhone(formatted);
    };

    const canSubmit = firstName && lastName && (selectedCompanyId || (creatingNewCompany && businessName && address));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        try {
            let normalizedWebsite = website?.trim() || null;
            if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
                normalizedWebsite = `https://${normalizedWebsite}`;
            }

            const batch = writeBatch(db);

            let companyId: string;
            let companyName: string;

            if (creatingNewCompany) {
                // Create a new company
                const companyRef = doc(collection(db, 'companies'));
                companyId = companyRef.id;
                companyName = businessName;

                batch.set(companyRef, {
                    businessName,
                    website: normalizedWebsite,
                    address: address?.label || '',
                    city,
                    state,
                    zip,
                    phone: companyPhone || null,
                    facilityType: facilityType || null,
                    leadType,
                    status: 'new',
                    attribution: {
                        source: attributionSource === '__none' ? null : attributionSource,
                        medium: 'manual',
                        campaign: 'manual-entry',
                        landingPage: '/sales/crm',
                    },
                    notes: notes || null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdBy: user?.uid || 'unknown',
                });
            } else {
                // Use existing company
                companyId = selectedCompanyId!;
                companyName = selectedCompanyName;
            }

            // Create the contact
            const contactRef = doc(collection(db, 'contacts'));
            batch.set(contactRef, {
                firstName,
                lastName,
                email: email || null,
                phone: phone || null,
                role: contactRole || null,
                companyId,
                companyName,
                isPrimary: false, // existing company may already have a primary
                unsubscribed: false,
                notes: '',
                createdAt: serverTimestamp(),
                createdBy: user?.uid || 'unknown',
            });

            await batch.commit();

            // Reset form
            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error adding contact:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setContactRole("");
        setSelectedCompanyId(null);
        setSelectedCompanyName("");
        setCreatingNewCompany(false);
        setBusinessName("");
        setBusinessNamePlaces(null);
        setWebsite("");
        setAddress(null);
        setCompanyPhone("");
        setCity("");
        setState("");
        setZip("");
        setFacilityType("");
        setLeadType("tenant");
        setNotes("");
        setAttributionSource("__none");
    };

    return (
        <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) resetForm(); onOpenChange(o); }}>
            {/* Hidden container for PlacesService */}
            <div ref={placesServiceRef} style={{ display: 'none' }} />
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>
                        Add a contact and associate them with an existing or new company
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ─── Contact Section ─── */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Contact Details
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="John"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Smith"
                                    required
                                />
                            </div>
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
                        <div className="grid grid-cols-2 gap-4">
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
                            <div>
                                <Label htmlFor="contactRole">Role / Title</Label>
                                <Input
                                    id="contactRole"
                                    value={contactRole}
                                    onChange={(e) => setContactRole(e.target.value)}
                                    placeholder="Facility Manager"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t my-2" />

                    {/* ─── Company Section ─── */}
                    <CompanyCombobox
                        value={selectedCompanyId}
                        onChange={handleCompanySelect}
                        onCreateNew={handleCreateNewCompany}
                    />

                    {/* Show existing company badge when selected */}
                    {selectedCompanyId && !creatingNewCompany && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                            <Building2 className="w-4 h-4" />
                            <span>Linking to <strong>{selectedCompanyName}</strong></span>
                        </div>
                    )}

                    {/* New company creation fields */}
                    {creatingNewCompany && (
                        <div className="space-y-4 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm flex items-center gap-2 text-primary">
                                    <Plus className="w-3.5 h-3.5" /> New Company
                                </h4>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => setCreatingNewCompany(false)}
                                >
                                    Cancel
                                </Button>
                            </div>

                            <div>
                                <Label htmlFor="businessName" className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    Company Name * <span className="text-xs text-muted-foreground font-normal ml-1">— search to auto-fill address &amp; phone</span>
                                </Label>
                                <GooglePlacesAutocomplete
                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                    autocompletionRequest={{
                                        componentRestrictions: { country: ['us'] },
                                        types: ['establishment'],
                                    }}
                                    selectProps={{
                                        value: businessNamePlaces,
                                        onChange: handleBusinessNameSelect,
                                        placeholder: "Search business name...",
                                        isClearable: true,
                                        className: "react-select-container",
                                        classNamePrefix: "react-select",
                                        noOptionsMessage: () => "Type a business name to search",
                                    }}
                                />
                                {/* Fallback: manual entry if business not found in Google */}
                                {businessNamePlaces === null && (
                                    <Input
                                        id="businessName"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        placeholder="Or type company name manually"
                                        className="mt-1.5"
                                    />
                                )}
                            </div>

                            {/* Website + Enrich */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor="website">Website</Label>
                                    {website && (
                                        <EnrichButton
                                            website={website}
                                            previewOnly={true}
                                            size="sm"
                                            variant="outline"
                                            onSuccess={(data) => {
                                                if (data.data?.email && !email) setEmail(data.data.email);
                                                if (data.data?.phone && !phone) setPhone(data.data.phone);
                                                if (data.data?.businessName && !businessName) setBusinessName(data.data.businessName);
                                            }}
                                            onError={(error) => console.error('Enrichment error:', error)}
                                        />
                                    )}
                                </div>
                                <Input
                                    id="website"
                                    type="text"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="example.com"
                                />
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

                            {/* City / State / Zip */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="city">City</Label>
                                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chicago" />
                                </div>
                                <div>
                                    <Label htmlFor="state">State</Label>
                                    <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="IL" maxLength={2} />
                                </div>
                                <div>
                                    <Label htmlFor="zip">Zip</Label>
                                    <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="60601" maxLength={5} />
                                </div>
                            </div>

                            {/* Company Phone (auto-filled from Google Places) */}
                            <div>
                                <Label htmlFor="companyPhone" className="flex items-center gap-1.5">
                                    Company Phone
                                    {companyPhone && <span className="text-xs text-green-600 font-normal">✓ from Google</span>}
                                </Label>
                                <Input
                                    id="companyPhone"
                                    type="tel"
                                    value={companyPhone}
                                    onChange={(e) => {
                                        const input = e.target.value.replace(/\D/g, '');
                                        let formatted = '';
                                        if (input.length > 0) {
                                            formatted = '(' + input.substring(0, 3);
                                            if (input.length >= 3) formatted += ') ' + input.substring(3, 6);
                                            if (input.length >= 6) formatted += '-' + input.substring(6, 10);
                                        }
                                        setCompanyPhone(formatted);
                                    }}
                                    placeholder="(555) 123-4567"
                                    maxLength={14}
                                />
                            </div>

                            {/* Facility Type */}
                            <FacilityTypeCombobox value={facilityType} onChange={setFacilityType} />

                            {/* Lead Type */}
                            <div>
                                <Label>Lead Type</Label>
                                <Select value={leadType} onValueChange={setLeadType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="direct">Direct</SelectItem>
                                        <SelectItem value="tenant">Tenant</SelectItem>
                                        <SelectItem value="referral_partnership">Referral Partnership</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Attribution */}
                            <div>
                                <Label>Source</Label>
                                <Select value={attributionSource} onValueChange={setAttributionSource}>
                                    <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none">— Select —</SelectItem>
                                        {ATTRIBUTION_SOURCES.map((s) => (
                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                                    placeholder="Additional context..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { resetForm(); onOpenChange(false); }}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting || !canSubmit}>
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Contact
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
