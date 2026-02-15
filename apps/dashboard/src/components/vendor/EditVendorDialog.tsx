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
        address: vendor.address || '',
        status: vendor.status || 'pending_review',
        onboardingTrack: vendor.onboardingTrack || 'STANDARD'
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'vendors', vendor.id!), {
                businessName: formData.businessName,
                address: formData.address,
                status: formData.status,
                onboardingTrack: formData.onboardingTrack,
                updatedAt: new Date() // Updates timestamp
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Update vendor core details.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Business Name
                        </Label>
                        <Input
                            id="name"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="address" className="text-right">
                            Address
                        </Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">
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
                                    <SelectItem value="pending_review">Pending Review</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                    <SelectItem value="compliance_review">Compliance Review</SelectItem>
                                    <SelectItem value="onboarding_scheduled">Onboarding Scheduled</SelectItem>
                                    <SelectItem value="ready_for_assignment">Ready for Assignment</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="track" className="text-right">
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
