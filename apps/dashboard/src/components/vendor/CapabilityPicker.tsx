'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Pencil, Check } from 'lucide-react';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    getCapabilityLabel,
    normalizeCapability,
    type CapabilityOption,
} from '@/lib/vendor-capabilities';

interface CapabilityPickerProps {
    selected: string[];
    onChange: (capabilities: string[]) => void;
}

/**
 * A popover with grouped checkboxes for selecting vendor capabilities.
 * Replaces the old free-text prompt() approach.
 * Handles legacy free-text data via normalizeCapability().
 */
export default function CapabilityPicker({ selected, onChange }: CapabilityPickerProps) {
    const [open, setOpen] = useState(false);

    // Normalize selected for correct checkbox matching with legacy data
    const normalizedSelected = selected.map(normalizeCapability);

    const toggle = (value: string) => {
        if (normalizedSelected.includes(value)) {
            // Remove — filter out both raw and normalized matches
            onChange(selected.filter((v) => normalizeCapability(v) !== value));
        } else {
            // Add — always use the standardized value
            onChange([...selected.filter((v) => normalizeCapability(v) !== value), value]);
        }
    };

    const groups = (['cleaning', 'facility', 'specialty'] as const).map((group) => ({
        key: group,
        label: CAPABILITY_GROUP_LABELS[group],
        items: VENDOR_CAPABILITIES.filter((c) => c.group === group),
    }));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
                <div className="p-3 border-b">
                    <p className="text-sm font-medium">Select Capabilities</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {selected.length} selected
                    </p>
                </div>
                <div className="max-h-[320px] overflow-y-auto p-2 space-y-3">
                    {groups.map((group) => (
                        <div key={group.key}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map((cap) => {
                                    const isChecked = normalizedSelected.includes(cap.value);
                                    return (
                                        <button
                                            key={cap.value}
                                            type="button"
                                            onClick={() => toggle(cap.value)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                                                isChecked
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'hover:bg-muted'
                                            }`}
                                        >
                                            <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                    isChecked
                                                        ? 'bg-primary border-primary'
                                                        : 'border-input'
                                                }`}
                                            >
                                                {isChecked && (
                                                    <Check className="w-3 h-3 text-primary-foreground" />
                                                )}
                                            </div>
                                            {cap.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export { CapabilityPicker };
