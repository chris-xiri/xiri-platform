'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { CalendarPlus, Phone, Mail, MapPin, RefreshCw, ClipboardList } from 'lucide-react';

const ACTIVITY_TYPES = [
    { value: 'CALL', label: 'Call', icon: Phone },
    { value: 'EMAIL', label: 'Email', icon: Mail },
    { value: 'SITE_VISIT', label: 'Site Visit', icon: MapPin },
    { value: 'FOLLOW_UP', label: 'Follow-Up', icon: RefreshCw },
    { value: 'REVIEW', label: 'Review', icon: ClipboardList },
] as const;

interface ScheduleFollowUpProps {
    vendorId?: string;
    leadId?: string;
    entityName?: string; // Business name for display
}

export default function ScheduleFollowUpDialog({ vendorId, leadId, entityName }: ScheduleFollowUpProps) {
    const { profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [type, setType] = useState<string>('CALL');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = async () => {
        if (!title.trim() || !dueDate || !profile) return;
        setSaving(true);

        try {
            await addDoc(collection(db, 'scheduled_activities'), {
                vendorId: vendorId || null,
                leadId: leadId || null,
                type,
                status: 'PENDING',
                title: title.trim(),
                description: description.trim() || null,
                dueDate: new Date(dueDate),
                assignedTo: profile.uid,
                assignedToName: profile.displayName || profile.email || 'Unknown',
                createdAt: new Date(),
                createdBy: profile.uid,
                metadata: {
                    entityName: entityName || 'Unknown',
                },
            });

            // Also log to vendor_activities if this is a vendor follow-up
            if (vendorId) {
                await addDoc(collection(db, 'vendor_activities'), {
                    vendorId,
                    type: 'FOLLOW_UP_SCHEDULED',
                    description: `Follow-up scheduled: "${title.trim()}" on ${new Date(dueDate).toLocaleDateString()}`,
                    createdAt: new Date(),
                    metadata: { type, dueDate, assignedTo: profile.uid },
                });
            }

            // Reset form
            setTitle('');
            setDescription('');
            setDueDate('');
            setType('CALL');
            setOpen(false);
        } catch (error) {
            console.error('Failed to schedule follow-up:', error);
        } finally {
            setSaving(false);
        }
    };

    // Default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <CalendarPlus className="w-3 h-3" /> Schedule Follow-Up
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <CalendarPlus className="w-4 h-4" /> Schedule Follow-Up
                    </DialogTitle>
                    {entityName && (
                        <p className="text-xs text-muted-foreground">for {entityName}</p>
                    )}
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {/* Type Selector */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Type</label>
                        <div className="flex gap-1">
                            {ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => (
                                <Button
                                    key={value}
                                    variant={type === value ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-[10px] gap-1 flex-1"
                                    onClick={() => setType(value)}
                                >
                                    <Icon className="w-3 h-3" /> {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Title *</label>
                        <Input
                            placeholder="e.g. Call to discuss pricing"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Notes</label>
                        <textarea
                            placeholder="Optional details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full h-16 p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Due Date *</label>
                        <Input
                            type="date"
                            value={dueDate || defaultDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="h-8 text-sm"
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" size="sm">Cancel</Button>
                    </DialogClose>
                    <Button size="sm" onClick={handleSubmit} disabled={saving || !title.trim()}>
                        {saving ? 'Scheduling...' : 'Schedule'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
