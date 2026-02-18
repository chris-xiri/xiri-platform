'use strict';

import { useState } from 'react';
import { Vendor } from '@xiri/shared';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import ReactGoogleAutocomplete from 'react-google-autocomplete';

interface EditVendorDialogProps {
    vendor: Vendor;
    trigger?: React.ReactNode;
    onUpdate?: () => void;
}

export default function EditVendorDialog({ vendor, trigger, onUpdate }: EditVendorDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
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
        onboardingTrack: vendor.onboardingTrack || 'STANDARD'
    });

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

    const handleSave = async () => {
        setLoading(true);
        try {
            const fullAddress = [formData.streetAddress, formData.city, formData.state, formData.zip]
                .filter(Boolean).join(', ');

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Update vendor core details.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Business Name */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right text-xs">
                            Business
                        </Label>
                        <Input
                            id="name"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            className="col-span-3"
                        />
                    </div>

                    {/* Contact Name */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contactName" className="text-right text-xs">
                            Contact
                        </Label>
                        <Input
                            id="contactName"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            className="col-span-3"
                            placeholder="John Doe"
                        />
                    </div>

                    {/* Email */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right text-xs">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="col-span-3"
                            placeholder="contact@company.com"
                        />
                    </div>

                    {/* Phone */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right text-xs">
                            Phone
                        </Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="col-span-3"
                            placeholder="(555) 123-4567"
                        />
                    </div>

                    {/* Website */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="website" className="text-right text-xs">
                            Website
                        </Label>
                        <Input
                            id="website"
                            value={formData.website}
                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                            className="col-span-3"
                            placeholder="https://example.com"
                        />
                    </div>

                    {/* Street Address with Google Autocomplete */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="street" className="text-right text-xs">
                            Street
                        </Label>
                        <div className="col-span-3">
                            <ReactGoogleAutocomplete
                                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
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

                    {/* City / State / Zip — 3 columns */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs">
                            City
                        </Label>
                        <Input
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="City"
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs">
                            State
                        </Label>
                        <Input
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            placeholder="NY"
                            className="col-span-1"
                            maxLength={2}
                        />
                        <Label className="text-right text-xs">
                            ZIP
                        </Label>
                        <Input
                            value={formData.zip}
                            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                            placeholder="10001"
                            className="col-span-1"
                            maxLength={5}
                        />
                    </div>

                    {/* Status */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right text-xs">
                            Status
                        </Label>
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

                    {/* Track */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="track" className="text-right text-xs">
                            Track
                        </Label>
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
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
