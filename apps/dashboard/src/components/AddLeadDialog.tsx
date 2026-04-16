"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Sparkles, Plus, User, ChevronDown, ChevronUp, Building2, Search, MapPin } from "lucide-react";
import { collection, doc, serverTimestamp, writeBatch, onSnapshot, query, getDocs, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { EnrichButton } from "@/components/EnrichButton";
import { FacilityType } from '@xiri-facility-solutions/shared';
import { ensureCustomFacilityType, useFacilityTypes } from "@/lib/facilityTypes";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

/**
 * Maps Google Places `types` to the canonical FacilityType enum.
 * Order matters — first match wins (specific before generic).
 */
const PLACES_TYPE_MAP: [string[], FacilityType][] = [
    // Medical
    [['dentist'], 'medical_dental'],
    [['veterinary_care'], 'medical_veterinary'],
    [['hospital', 'emergency_room'], 'medical_urgent_care'],
    [['doctor', 'physiotherapist', 'health'], 'medical_private'],
    // Auto
    [['car_dealer'], 'auto_dealer_showroom'],
    [['car_repair', 'car_wash'], 'auto_service_center'],
    // Education
    [['daycare', 'child_care'], 'edu_daycare'],
    [['school', 'primary_school', 'secondary_school', 'university'], 'edu_private_school'],
    // Fitness
    [['gym'], 'fitness_gym'],
    // Retail
    [['store', 'shopping_mall', 'clothing_store', 'jewelry_store', 'shoe_store',
      'electronics_store', 'hardware_store', 'furniture_store', 'book_store',
      'pet_store', 'convenience_store', 'supermarket', 'department_store',
      'home_goods_store', 'florist', 'bakery', 'liquor_store'], 'retail_storefront'],
    // Office (catch-all for professional services)
    [['accounting', 'lawyer', 'insurance_agency', 'real_estate_agency',
      'travel_agency', 'finance', 'bank'], 'office_general'],
];

function inferFacilityType(placeTypes: string[]): FacilityType | null {
    for (const [googleTypes, facilityType] of PLACES_TYPE_MAP) {
        if (googleTypes.some(t => placeTypes.includes(t))) {
            return facilityType;
        }
    }
    return null;
}

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

function sortCompanyOptions(options: CompanyOption[]): CompanyOption[] {
    return [...options].sort((a, b) => a.businessName.localeCompare(b.businessName));
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
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [creatingType, setCreatingType] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const { facilityTypeOptions } = useFacilityTypes();

    const allTypes = facilityTypeOptions;
    const selectedLabel = allTypes.find(t => t.value === value)?.label || value || "";

    const filtered = search
        ? allTypes.filter(t => t.label.toLowerCase().includes(search.toLowerCase()))
        : allTypes;

    const exactMatch = allTypes.some(t => t.label.toLowerCase() === search.toLowerCase());
    const showAddNew = search.length > 0 && !exactMatch;

    // Total selectable items: filtered options + optional "Add new" row
    const totalItems = filtered.length + (showAddNew ? 1 : 0);

    // Reset highlight when search changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [search]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && listRef.current) {
            const items = listRef.current.querySelectorAll('[data-option]');
            items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isOpen]);

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

    const handleAddNew = async () => {
        setCreatingType(true);
        try {
            const newType = await ensureCustomFacilityType(search);
            onChange(newType.value);
            setIsOpen(false);
            setSearch("");
        } catch (error) {
            console.error("Failed to create facility type:", error);
        } finally {
            setCreatingType(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setIsOpen(false); setSearch(""); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(i => (i + 1) % Math.max(totalItems, 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(i => (i - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex < filtered.length) {
                handleSelect(filtered[highlightedIndex].value);
            } else if (showAddNew) {
                void handleAddNew();
            }
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <Label>Facility Type</Label>
            <div
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => { setIsOpen(true); setSearch(""); setHighlightedIndex(0); }}
            >
                {isOpen ? (
                    <input
                        autoFocus
                        className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder="Search or type new..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                ) : (
                    <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
                        {selectedLabel || "Select facility type"}
                    </span>
                )}
            </div>

            {isOpen && (
                <div ref={listRef} className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {filtered.map((type, idx) => (
                        <button
                            key={type.value}
                            type="button"
                            data-option
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                idx === highlightedIndex ? 'bg-accent' : ''
                            } ${type.value === value ? 'font-medium' : ''}`}
                            onClick={() => handleSelect(type.value)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                        >
                            {type.label}
                        </button>
                    ))}
                    {showAddNew && (
                        <button
                            type="button"
                            data-option
                            className={`w-full text-left px-3 py-2 text-sm transition-colors text-primary font-medium flex items-center gap-1.5 border-t ${
                                highlightedIndex === filtered.length ? 'bg-accent' : ''
                            }`}
                            onClick={() => void handleAddNew()}
                            onMouseEnter={() => setHighlightedIndex(filtered.length)}
                            disabled={creatingType}
                        >
                            {creatingType ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add &ldquo;{search}&rdquo; as new type
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
    onCreateNew: (searchText?: string) => void;
    autoFocus?: boolean;
}) {
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [contactCompanies, setContactCompanies] = useState<CompanyOption[]>([]);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { autoFocus } = { autoFocus: arguments[0].autoFocus };

    // Auto-open when autoFocus is true (dialog just opened)
    useEffect(() => {
        if (autoFocus && !value) {
            // Small delay to let dialog mount
            const t = setTimeout(() => setIsOpen(true), 150);
            return () => clearTimeout(t);
        }
    }, [autoFocus, value]);

    // Fetch companies once on mount
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "companies"), (snap) => {
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
            setCompanies(sortCompanyOptions(list));
            setLoading(false);
            setLoadError(null);
        }, (error) => {
            console.error("Failed to load companies:", error);
            setLoadError("Could not load companies.");
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Also check 'leads' collection for backward compat (existing leads not yet migrated)
    const [legacyCompanies, setLegacyCompanies] = useState<CompanyOption[]>([]);
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "leads"), (snap) => {
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
            setLegacyCompanies(sortCompanyOptions(list));
        }, (error) => {
            console.error("Failed to load legacy leads:", error);
        });
        return () => unsub();
    }, []);

    // Final fallback: derive company options from contacts if company docs are incomplete.
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "contacts"), (snap) => {
            const byCompany = new Map<string, CompanyOption>();
            snap.forEach((d) => {
                const data = d.data();
                const companyId = data.companyId;
                const companyName = data.companyName;
                if (!companyId || !companyName) return;
                if (!byCompany.has(companyId)) {
                    byCompany.set(companyId, {
                        id: companyId,
                        businessName: companyName,
                    });
                }
            });
            setContactCompanies(sortCompanyOptions(Array.from(byCompany.values())));
        }, (error) => {
            console.error("Failed to derive companies from contacts:", error);
        });
        return () => unsub();
    }, []);

    const allCompanies = [...companies, ...legacyCompanies, ...contactCompanies];

    // Deduplicate by company id; prefer richer company docs over contact-derived fallbacks.
    const uniqueCompanies = Array.from(
        allCompanies.reduce((map, company) => {
            const existing = map.get(company.id);
            if (!existing || ((!existing.address && company.address) || (!existing.city && company.city))) {
                map.set(company.id, company);
            }
            return map;
        }, new Map<string, CompanyOption>())
            .values()
    );

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
                    ) : loadError ? (
                        <div className="px-3 py-2 text-sm text-destructive">
                            {loadError}
                        </div>
                    ) : (
                        <>
                            {/* Create new company option — always on top */}
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors text-primary font-medium flex items-center gap-1.5 border-b bg-primary/5"
                                onClick={() => {
                                    const currentSearch = search;
                                    setIsOpen(false);
                                    setSearch("");
                                    onCreateNew(currentSearch);
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
    const [creatingNewCompany, setCreatingNewCompany] = useState(true);

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

    const handleCreateNewCompany = (searchText?: string) => {
        setSelectedCompanyId(null);
        setSelectedCompanyName("");
        setCreatingNewCompany(true);
        // Pre-fill the business name from the search text
        if (searchText) {
            setBusinessName(searchText);
        }
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

        // Auto-detect facility type from Google Places types
        const types = place.types || [];
        const inferredType = inferFacilityType(types);
        if (inferredType) setFacilityType(inferredType);
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

    const canSubmit = selectedCompanyId || (creatingNewCompany && businessName && address);
    const hasContactDetails = !!(firstName.trim() || lastName.trim() || email.trim() || phone.trim() || contactRole.trim());

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
            let shouldCreatePrimaryContact = false;

            if (creatingNewCompany) {
                // Create a new company
                const companyRef = doc(collection(db, 'companies'));
                companyId = companyRef.id;
                companyName = businessName.trim();
                shouldCreatePrimaryContact = true;

                batch.set(companyRef, {
                    businessName: companyName,
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
                if (hasContactDetails) {
                    const existingContactsSnap = await getDocs(query(
                        collection(db, 'contacts'),
                        where('companyId', '==', companyId),
                        limit(1),
                    ));
                    shouldCreatePrimaryContact = existingContactsSnap.empty;
                }
            }

            if (hasContactDetails) {
                const contactRef = doc(collection(db, 'contacts'));
                batch.set(contactRef, {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    role: contactRole.trim() || null,
                    companyId,
                    companyName,
                    isPrimary: shouldCreatePrimaryContact,
                    lifecycleStatus: 'active',
                    unsubscribed: false,
                    notes: '',
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid || 'unknown',
                });
            }

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
        setCreatingNewCompany(true);
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
                    {/* ─── Company Mode Toggle ─── */}
                    <div>
                        <Label className="flex items-center gap-1.5 mb-1.5">
                            <Building2 className="w-3.5 h-3.5" /> Company
                        </Label>
                        <div className="flex rounded-lg border overflow-hidden mb-3">
                            <button
                                type="button"
                                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                    creatingNewCompany
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:bg-accent'
                                }`}
                                onClick={() => { setCreatingNewCompany(true); setSelectedCompanyId(null); setSelectedCompanyName(''); }}
                            >
                                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                                New Company
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-2 text-sm font-medium transition-colors border-l ${
                                    !creatingNewCompany
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:bg-accent'
                                }`}
                                onClick={() => { setCreatingNewCompany(false); setBusinessName(''); setBusinessNamePlaces(null); setAddress(null); setCity(''); setState(''); setZip(''); setCompanyPhone(''); setWebsite(''); setFacilityType(''); }}
                            >
                                <Search className="w-3.5 h-3.5 inline mr-1.5" />
                                Existing Company
                            </button>
                        </div>
                    </div>

                    {/* ─── Existing company selector ─── */}
                    {!creatingNewCompany && (
                        <>
                            <CompanyCombobox
                                value={selectedCompanyId}
                                onChange={handleCompanySelect}
                                onCreateNew={handleCreateNewCompany}
                                autoFocus
                            />

                            {selectedCompanyId && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                                    <Building2 className="w-4 h-4" />
                                    <span>Linking to <strong>{selectedCompanyName}</strong></span>
                                </div>
                            )}
                        </>
                    )}

                    {/* ─── New company creation fields (default) ─── */}
                    {creatingNewCompany && (
                        <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                            <div>
                                <Label htmlFor="businessName" className="flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    Business Name * <span className="text-xs text-muted-foreground font-normal ml-1">— search to auto-fill address &amp; phone</span>
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
                                        autoFocus: true,
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

                    <div className="border-t my-2" />

                    {/* ─── Contact Section (optional) ─── */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Contact Details <span className="text-xs text-muted-foreground font-normal">(optional — can add later)</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="John"
                                />
                            </div>
                            <div>
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Smith"
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
                            {hasContactDetails ? 'Add Lead & Contact' : 'Add Lead'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
