import { useState, useCallback, useRef } from 'react';
import { Vendor } from '@xiri-facility-solutions/shared';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import ReactGoogleAutocomplete from 'react-google-autocomplete';
import { X, Plus, Loader2, Check } from 'lucide-react';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    normalizeCapabilities,
    type CapabilityOption,
} from '@/lib/vendor-capabilities';

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface EditVendorDialogProps {
    vendor: Vendor;
    trigger?: React.ReactNode;
    onUpdate?: () => void;
}

export default function EditVendorDialog({ vendor, trigger, onUpdate }: EditVendorDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [zipLoading, setZipLoading] = useState(false);
    const zipLookupTimer = useRef<NodeJS.Timeout | null>(null);
    const [formData, setFormData] = useState({
        businessName: vendor.businessName || '',
        contactName: vendor.contactName || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        website: vendor.website || '',
        streetAddress: vendor.streetAddress || vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        zip: vendor.zip || '',
        status: vendor.status || 'pending_review',
        onboardingTrack: vendor.onboardingTrack || 'STANDARD',
        preferredLanguage: vendor.preferredLanguage || 'en',
        capabilities: [...(vendor.capabilities || [])] as string[],
        notes: (vendor as any).notes || (vendor as any).description || '',
    });

    // Lookup city/state from ZIP code via Google Geocoding API
    const lookupZip = useCallback(async (zip: string) => {
        if (!MAPS_API_KEY || zip.length !== 5 || !/^\d{5}$/.test(zip)) return;
        setZipLoading(true);
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&components=country:US&key=${MAPS_API_KEY}`
            );
            const data = await res.json();
            if (data.status === 'OK' && data.results?.[0]) {
                const components = data.results[0].address_components;
                let city = '';
                let state = '';
                for (const c of components) {
                    if (c.types.includes('locality') || c.types.includes('sublocality_level_1')) {
                        city = c.long_name;
                    }
                    // Fallback: use neighborhood or political area for NYC boroughs
                    if (!city && (c.types.includes('neighborhood') || c.types.includes('political'))) {
                        city = c.long_name;
                    }
                    if (c.types.includes('administrative_area_level_1')) {
                        state = c.short_name;
                    }
                }
                if (city || state) {
                    setFormData(prev => ({
                        ...prev,
                        ...(city ? { city } : {}),
                        ...(state ? { state } : {}),
                    }));
                }
            }
        } catch (err) {
            console.error('ZIP lookup failed:', err);
        } finally {
            setZipLoading(false);
        }
    }, []);

    const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
        setFormData(prev => ({ ...prev, zip }));

        // Debounce: auto-lookup when user types a full 5-digit ZIP
        if (zipLookupTimer.current) clearTimeout(zipLookupTimer.current);
        if (zip.length === 5) {
            zipLookupTimer.current = setTimeout(() => lookupZip(zip), 300);
        }
    };

    const handlePlaceSelected = (place: any) => {
        if (!place?.address_components) return;

        let street = '';
        let city = '';
        let state = '';
        let zip = '';

        for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('street_number')) {
                street = component.long_name + ' ';
            }
            if (types.includes('route')) {
                street += component.long_name;
            }
            if (types.includes('locality') || types.includes('sublocality_level_1')) {
                city = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
                state = component.short_name;
            }
            if (types.includes('postal_code')) {
                zip = component.long_name;
            }
        }

        setFormData(prev => ({
            ...prev,
            streetAddress: street.trim(),
            city,
            state,
            zip
        }));
    };

    const toggleCapability = (value: string) => {
        setFormData(prev => ({
            ...prev,
            capabilities: prev.capabilities.includes(value)
                ? prev.capabilities.filter(c => c !== value)
                : [...prev.capabilities, value],
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const fullAddress = [formData.streetAddress, formData.city, formData.state, formData.zip]
                .filter(Boolean).join(', ');
            const normalizedCaps = normalizeCapabilities(formData.capabilities);

            await updateDoc(doc(db, 'vendors', vendor.id!), {
                businessName: formData.businessName,
                contactName: formData.contactName || null,
                email: formData.email || null,
                phone: formData.phone || null,
                website: formData.website || null,
                streetAddress: formData.streetAddress,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                address: fullAddress,
                status: formData.status,
                onboardingTrack: formData.onboardingTrack,
                preferredLanguage: formData.preferredLanguage,
                capabilities: normalizedCaps,
                notes: formData.notes || null,
                updatedAt: new Date()
            });
            setOpen(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error updating vendor:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Edit Profile</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Vendor Profile</DialogTitle>
                    <DialogDescription>
                        Update vendor details, contact info, and capabilities.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* === SECTION: Business === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Business Info</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right text-xs">Business</Label>
                        <Input
                            id="name"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            className="col-span-3"
                        />
                    </div>

                    {/* Preferred Language */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs">Language</Label>
                        <div className="col-span-3">
                            <Select
                                value={formData.preferredLanguage}
                                onValueChange={(val: any) => setFormData({ ...formData, preferredLanguage: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="es">Español</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* === SECTION: Contact === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-2">Contact</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contactName" className="text-right text-xs">Name</Label>
                        <Input
                            id="contactName"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            className="col-span-3"
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right text-xs">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="col-span-3"
                            placeholder="contact@company.com"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right text-xs">Phone</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="col-span-3"
                            placeholder="(555) 123-4567"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="website" className="text-right text-xs">Website</Label>
                        <Input
                            id="website"
                            value={formData.website}
                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                            className="col-span-3"
                            placeholder="https://example.com"
                        />
                    </div>

                    {/* === SECTION: Address === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-2">Address</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="street" className="text-right text-xs">Street</Label>
                        <div className="col-span-3">
                            <ReactGoogleAutocomplete
                                apiKey={MAPS_API_KEY}
                                onPlaceSelected={handlePlaceSelected}
                                options={{
                                    types: ['address'],
                                    componentRestrictions: { country: 'us' }
                                }}
                                defaultValue={formData.streetAddress}
                                onChange={(e: any) => setFormData({ ...formData, streetAddress: e.target.value })}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                placeholder="Start typing an address..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs">City</Label>
                        <Input
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="City"
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs">State</Label>
                        <Input
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                            placeholder="NY"
                            className="col-span-1"
                            maxLength={2}
                        />
                        <Label className="text-right text-xs">ZIP</Label>
                        <div className="col-span-1 relative">
                            <Input
                                value={formData.zip}
                                onChange={handleZipChange}
                                placeholder="10001"
                                maxLength={5}
                                inputMode="numeric"
                            />
                            {zipLoading && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    {/* === SECTION: Capabilities === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-2">Capabilities</div>

                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right text-xs mt-2">Services</Label>
                        <div className="col-span-3 space-y-3">
                            {(['cleaning', 'facility', 'specialty'] as const).map((group) => (
                                <div key={group}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        {CAPABILITY_GROUP_LABELS[group]}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {VENDOR_CAPABILITIES.filter(c => c.group === group).map((cap) => {
                                            const isChecked = formData.capabilities.includes(cap.value);
                                            return (
                                                <button
                                                    key={cap.value}
                                                    type="button"
                                                    onClick={() => toggleCapability(cap.value)}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors ${
                                                        isChecked
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'hover:bg-muted text-foreground'
                                                    }`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                        isChecked ? 'bg-primary border-primary' : 'border-input'
                                                    }`}>
                                                        {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                                    </div>
                                                    {cap.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* === SECTION: Pipeline === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-2">Pipeline</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right text-xs">Status</Label>
                        <div className="col-span-3">
                            <Select
                                value={formData.status}
                                onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending_review">Sourced</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                    <SelectItem value="awaiting_onboarding">Awaiting Form</SelectItem>
                                    <SelectItem value="compliance_review">Compliance Review</SelectItem>
                                    <SelectItem value="pending_verification">Verifying Docs</SelectItem>
                                    <SelectItem value="onboarding_scheduled">Onboarding Call</SelectItem>
                                    <SelectItem value="ready_for_assignment">Ready</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                    <SelectItem value="dismissed">Dismissed</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="track" className="text-right text-xs">Track</Label>
                        <div className="col-span-3">
                            <Select
                                value={formData.onboardingTrack}
                                onValueChange={(val: any) => setFormData({ ...formData, onboardingTrack: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select track" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STANDARD">Standard</SelectItem>
                                    <SelectItem value="FAST_TRACK">Fast Track</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* === SECTION: Notes === */}
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mt-2">Notes</div>

                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right text-xs mt-2">Internal</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Add internal notes about this vendor..."
                            className="col-span-3 min-h-[80px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
