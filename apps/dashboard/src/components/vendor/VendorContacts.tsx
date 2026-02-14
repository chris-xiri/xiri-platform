'use client';

import { useState } from 'react';
import { Vendor, VendorContact } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Phone, Mail, Star, User } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface VendorContactsProps {
    vendor: Vendor;
}

export default function VendorContacts({ vendor }: VendorContactsProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState<'Owner' | 'Dispatch' | 'Billing' | 'Sales' | 'Other'>('Other');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const handleAddContact = async () => {
        if (!firstName || !lastName) return;
        setLoading(true);

        const newContact: VendorContact = {
            id: crypto.randomUUID(),
            firstName,
            lastName,
            role,
            phone,
            email,
            isPrimary: (vendor.contacts?.length || 0) === 0 // First one matches primary
        };

        try {
            const vendorRef = doc(db, 'vendors', vendor.id!);
            await updateDoc(vendorRef, {
                contacts: arrayUnion(newContact)
            });
            setOpen(false);
            // Reset form
            setFirstName('');
            setLastName('');
            setRole('Other');
            setPhone('');
            setEmail('');
        } catch (error) {
            console.error("Error adding contact:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Key People</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <UserPlus className="w-4 h-4" /> Add Person
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Contact Person</DialogTitle>
                            <DialogDescription>
                                Add a key stakeholder for {vendor.businessName}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>First Name</Label>
                                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Owner">Owner / Principal</SelectItem>
                                        <SelectItem value="Dispatch">Dispatch / Ops Manager</SelectItem>
                                        <SelectItem value="Sales">Sales Rep</SelectItem>
                                        <SelectItem value="Billing">Billing / Accounting</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddContact} disabled={loading}>
                                {loading ? "Adding..." : "Save Contact"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendor.contacts?.map((contact) => (
                    <Card key={contact.id}>
                        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {contact.firstName[0]}{contact.lastName[0]}
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold">
                                        {contact.firstName} {contact.lastName}
                                    </CardTitle>
                                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                        {contact.role}
                                    </div>
                                </div>
                            </div>
                            {contact.isPrimary && (
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-2 text-sm">
                            {contact.email && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="w-4 h-4" />
                                    <a href={`mailto:${contact.email}`} className="hover:text-foreground transition-colors">{contact.email}</a>
                                </div>
                            )}
                            {contact.phone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="w-4 h-4" />
                                    <a href={`tel:${contact.phone}`} className="hover:text-foreground transition-colors">{contact.phone}</a>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {(!vendor.contacts || vendor.contacts.length === 0) && (
                    <div className="col-span-full py-8 text-center border-dashed border-2 border-muted rounded-lg bg-muted/5">
                        <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No contacts added yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
