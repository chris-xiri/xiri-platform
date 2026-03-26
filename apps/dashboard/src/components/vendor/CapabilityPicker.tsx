'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Pencil, Check, Search } from 'lucide-react';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    normalizeCapability,
} from '@/lib/vendor-capabilities';

interface CapabilityPickerProps {
    selected: string[];
    onChange: (capabilities: string[]) => void;
}

/**
 * A popover with grouped checkboxes for selecting vendor capabilities.
 * Includes search/filter and proper scrolling.
 */
export default function CapabilityPicker({ selected, onChange }: CapabilityPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const normalizedSelected = selected.map(normalizeCapability);

    const toggle = (value: string) => {
        if (normalizedSelected.includes(value)) {
            onChange(selected.filter((v) => normalizeCapability(v) !== value));
        } else {
            onChange([...selected.filter((v) => normalizeCapability(v) !== value), value]);
        }
    };

    const groups = useMemo(() => {
        const q = search.toLowerCase().trim();
        return (['cleaning', 'facility', 'specialty'] as const)
            .map((group) => ({
                key: group,
                label: CAPABILITY_GROUP_LABELS[group],
                items: VENDOR_CAPABILITIES.filter(
                    (c) => c.group === group && (!q || c.label.toLowerCase().includes(q))
                ),
            }))
            .filter((g) => g.items.length > 0);
    }, [search]);

    return (
        <Popover open={open} onOpenChange={(o: boolean) => { setOpen(o); if (!o) setSearch(''); }}>
            <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
                <div className="p-3 border-b space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Select Capabilities</p>
                        <span className="text-xs text-muted-foreground">{selected.length} selected</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search capabilities..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-7 text-sm pl-7"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto p-2 space-y-3" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                    {groups.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No capabilities match &ldquo;{search}&rdquo;</p>
                    )}
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
