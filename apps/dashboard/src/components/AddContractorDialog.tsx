"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, Building2, User, Phone, Mail, MapPin, Briefcase } from "lucide-react";
import ReactGoogleAutocomplete from 'react-google-autocomplete';

interface AddContractorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const SERVICE_TYPES = [
    "Janitorial",
    "Floor Care",
    "Window Cleaning",
    "Carpet Cleaning",
    "Pressure Washing",
    "Landscaping",
    "HVAC",
    "Plumbing",
    "Electrical",
    "Handyman",
    "Pest Control",
    "Snow Removal",
    "Painting",
    "Other",
];

export function AddContractorDialog({ open, onOpenChange }: AddContractorDialogProps) {
    const { profile } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [businessName, setBusinessName] = useState("");
    const [contactName, setContactName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [zip, setZip] = useState("");
    const [website, setWebsite] = useState("");
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [notes, setNotes] = useState("");

    const toggleService = (svc: string) => {
        setSelectedServices(prev =>
            prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
        );
    };

    const handlePhoneChange = (value: string) => {
        // Auto-format: (XXX) XXX-XXXX
        const digits = value.replace(/\D/g, '').slice(0, 10);
        let formatted = digits;
        if (digits.length > 6) {
            formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length > 3) {
            formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        } else if (digits.length > 0) {
            formatted = `(${digits}`;
        }
        setPhone(formatted);
    };

    const resetForm = () => {
        setBusinessName("");
        setContactName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setCity("");
        setState("");
        setZip("");
        setWebsite("");
        setSelectedServices([]);
        setNotes("");
    };

    const handlePlaceSelected = (place: any) => {
        if (!place?.address_components) return;

        let street = '';
        let placeCity = '';
        let placeState = '';
        let placeZip = '';

        for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('street_number')) {
                street = component.long_name + ' ';
            }
            if (types.includes('route')) {
                street += component.long_name;
            }
            if (types.includes('locality') || types.includes('sublocality_level_1')) {
                placeCity = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
                placeState = component.short_name;
            }
            if (types.includes('postal_code')) {
                placeZip = component.long_name;
            }
        }

        setAddress(street.trim());
        setCity(placeCity);
        setState(placeState);
        setZip(placeZip);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!businessName.trim() || !profile) return;
        setSubmitting(true);

        try {
            const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

            await addDoc(collection(db, "vendors"), {
                businessName: businessName.trim(),
                contactName: contactName.trim() || null,
                phone: phone.trim() || null,
                email: email.trim() || null,
                address: fullAddress,
                streetAddress: address.trim() || null,
                city: city.trim() || null,
                state: state.trim() || null,
                zip: zip.trim() || null,
                website: website.trim() || null,
                capabilities: ["general"],
                services: selectedServices,
                status: "pending_review",
                aiScore: 0,
                fitScore: 0,
                hasActiveContract: false,
                notes: notes.trim() || null,
                source: "manual_entry",
                createdBy: profile.uid || profile.email || "unknown",
                createdAt: serverTimestamp(),
            });

            // Log activity
            await addDoc(collection(db, "activity_logs"), {
                type: "VENDOR_MANUALLY_ADDED",
                businessName: businessName.trim(),
                addedBy: profile.uid || profile.email || "unknown",
                createdAt: serverTimestamp(),
            });

            resetForm();
            onOpenChange(false);
        } catch (err) {
            console.error("Error adding contractor:", err);
            alert("Failed to add contractor. Check console for details.");
        } finally {
            setSubmitting(false);
        }
    };

    const isValid = businessName.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" /> Add Contractor
                    </DialogTitle>
                    <DialogDescription>
                        Manually add a contractor to the Supply CRM pipeline. They will start in "Sourced" status.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {/* Business Info */}
                    <div className="space-y-3">
                        <div>
                            <Label className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" /> Business Name *
                            </Label>
                            <Input
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="e.g. Elite Cleaning Services"
                                className="mt-1"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> Contact Name
                                </Label>
                                <Input
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> Phone
                                </Label>
                                <Input
                                    value={phone}
                                    onChange={(e) => handlePhoneChange(e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> Email
                                </Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="vendor@example.com"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Website</Label>
                                <Input
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="https://..."
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Address */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> Address
                        </Label>
                        <ReactGoogleAutocomplete
                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                            onPlaceSelected={handlePlaceSelected}
                            options={{
                                types: ['address'],
                                componentRestrictions: { country: 'us' }
                            }}
                            defaultValue={address}
                            onChange={(e: any) => setAddress(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Start typing an address..."
                        />
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="City"
                            />
                            <Input
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                placeholder="State"
                                maxLength={2}
                            />
                            <Input
                                value={zip}
                                onChange={(e) => setZip(e.target.value)}
                                placeholder="ZIP"
                                maxLength={5}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Services */}
                    <div>
                        <Label className="flex items-center gap-1.5 mb-2">
                            <Briefcase className="w-3.5 h-3.5" /> Services Offered
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {SERVICE_TYPES.map(svc => (
                                <Badge
                                    key={svc}
                                    variant={selectedServices.includes(svc) ? "default" : "outline"}
                                    className={`cursor-pointer transition-all text-xs ${selectedServices.includes(svc)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted'
                                        }`}
                                    onClick={() => toggleService(svc)}
                                >
                                    {selectedServices.includes(svc) ? (
                                        <X className="w-3 h-3 mr-0.5" />
                                    ) : (
                                        <Plus className="w-3 h-3 mr-0.5" />
                                    )}
                                    {svc}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <textarea
                            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional notes about this contractor..."
                        />
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!isValid || submitting} className="gap-2">
                            <Plus className="w-4 h-4" />
                            {submitting ? "Adding..." : "Add Contractor"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
