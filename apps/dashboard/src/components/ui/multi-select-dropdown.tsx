import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Check } from 'lucide-react';

export default function MultiSelectDropdown({ label, options, selected, onChange, placeholder, color, disabled, quickFill }: {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    color: 'emerald' | 'blue' | 'purple';
    disabled?: boolean;
    quickFill?: { label: string; values: string[] };
}) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearchTerm(''); }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (value: string) => {
        onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
    };

    const colorClasses = {
        emerald: { ring: 'ring-emerald-500', badge: 'bg-emerald-600', hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950' },
        blue: { ring: 'ring-blue-500', badge: 'bg-blue-600', hover: 'hover:bg-blue-50 dark:hover:bg-blue-950' },
        purple: { ring: 'ring-purple-500', badge: 'bg-purple-600', hover: 'hover:bg-purple-50 dark:hover:bg-purple-950' },
    }[color];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => !disabled && setOpen(!open)}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all min-w-[120px] max-w-[220px] bg-white dark:bg-card ${open ? `border-${color}-500 ring-1 ${colorClasses.ring}` : 'border-border hover:border-muted-foreground/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className="text-muted-foreground flex-shrink-0 text-[10px]">{label}:</span>
                {selected.length === 0 ? (
                    <span className="text-muted-foreground/60 truncate">{placeholder}</span>
                ) : (
                    <Badge variant="default" className={`text-[9px] px-1 py-0 h-4 ${colorClasses.badge}`}>
                        {selected.length} selected
                    </Badge>
                )}
                <ChevronDown className={`w-3 h-3 ml-auto flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 top-full mt-1 left-0 min-w-[240px] max-w-[320px] bg-white dark:bg-card border border-border rounded-md shadow-lg">
                    {/* Quick actions */}
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
                        <button onClick={() => onChange(options.map(o => o.value))} className="text-[10px] text-blue-600 hover:underline">All</button>
                        <button onClick={() => onChange([])} className="text-[10px] text-red-600 hover:underline">None</button>
                        {quickFill && (
                            <button onClick={() => onChange(quickFill.values)} className="text-[10px] text-amber-600 hover:underline">{quickFill.label}</button>
                        )}
                    </div>
                    {/* Search */}
                    <div className="px-2 py-1 border-b border-border">
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full text-[11px] px-1.5 py-1 rounded border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            value={searchTerm}
                            autoFocus
                        />
                    </div>
                    {/* Options */}
                    <div className="max-h-[200px] overflow-y-auto py-1">
                        {options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase())).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => toggle(opt.value)}
                                className={`flex items-center gap-2 w-full px-2.5 py-1 text-[11px] text-left ${colorClasses.hover} transition-colors`}
                            >
                                <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${selected.includes(opt.value) ? `${colorClasses.badge} border-transparent` : 'border-border'
                                    }`}>
                                    {selected.includes(opt.value) && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className="truncate">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
