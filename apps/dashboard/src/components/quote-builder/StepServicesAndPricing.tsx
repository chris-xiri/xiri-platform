'use client';

import { useState } from 'react';
import { QuoteLineItem, getTaxRate, calculateTax, ROOM_TYPES, CLEANING_TASKS } from '@xiri-facility-solutions/shared';
import { Lead } from '@xiri-facility-solutions/shared';
import { XIRI_SERVICES, SERVICE_CATEGORIES, ServiceCategory } from '@/data/serviceTypes';
import { SCOPE_TEMPLATES } from '@/data/scopeTemplates';
import { Location, DAY_LABELS, SERVICE_COLORS } from './types';
import { formatCurrency, computeTotals } from './helpers';
import { quoteLogger } from './logger';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Trash2, DollarSign, ClipboardList, Check, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────
interface StepServicesAndPricingProps {
    locations: Location[];
    lineItems: QuoteLineItem[];
    selectedLead: (Lead & { id: string }) | null;
    isEditing: boolean;
    existingQuoteVersion?: number;
    profileUid: string;
    profileRoles: string[];
    onAddLineItem: (loc: Location) => void;
    onUpdateLineItem: (id: string, updates: Partial<QuoteLineItem>) => void;
    onRemoveLineItem: (id: string) => void;
}

// ─── Service dropdown (grouped by category) ───────────────────────────
const servicesByCategory = XIRI_SERVICES.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
}, {} as Record<string, typeof XIRI_SERVICES[number][]>);

export default function StepServicesAndPricing({
    locations, lineItems, selectedLead, isEditing, existingQuoteVersion,
    profileUid, profileRoles, onAddLineItem, onUpdateLineItem, onRemoveLineItem,
}: StepServicesAndPricingProps) {

    const totals = computeTotals(lineItems);
    const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({});
    const [customTaskInputs, setCustomTaskInputs] = useState<Record<string, string>>({});

    const toggleScopeExpanded = (id: string) =>
        setExpandedScopes(prev => ({ ...prev, [id]: !prev[id] }));

    const handleServiceSelect = (itemId: string, serviceValue: string) => {
        const service = XIRI_SERVICES.find(s => s.value === serviceValue);
        if (!service) return;
        const isConsumable = service.category === 'consumables';

        // Auto-load scope tasks from matching template
        const template = SCOPE_TEMPLATES.find(t =>
            t.name.toLowerCase().includes(service.label.toLowerCase()) ||
            service.label.toLowerCase().includes(t.facilityType.replace(/_/g, ' '))
        );
        // Also try to match by facility type from selected lead
        const leadTemplate = !template && selectedLead?.facilityType
            ? SCOPE_TEMPLATES.find(t => t.facilityType === selectedLead.facilityType)
            : null;
        const matchedTemplate = template || leadTemplate;
        const scopeTasks = matchedTemplate
            ? matchedTemplate.tasks.map(t => ({ name: t.name, description: t.description, required: t.required, isCustom: false }))
            : undefined;

        onUpdateLineItem(itemId, {
            serviceType: service.label,
            serviceCategory: service.category,
            isConsumable,
            ...(isConsumable ? { frequency: 'weekly' as const, daysOfWeek: undefined } : {}),
            ...(scopeTasks ? { scopeTasks } : {}),
        });
        // Auto-expand scope section when tasks are loaded
        if (scopeTasks && scopeTasks.length > 0) {
            setExpandedScopes(prev => ({ ...prev, [itemId]: true }));
        }
        quoteLogger.lineItemUpdated(itemId, ['serviceType', 'serviceCategory', 'scopeTasks']);
    };

    const addCustomTask = (itemId: string) => {
        const taskName = customTaskInputs[itemId]?.trim();
        if (!taskName) return;
        const item = lineItems.find(li => li.id === itemId);
        const existing = item?.scopeTasks || [];
        onUpdateLineItem(itemId, {
            scopeTasks: [...existing, { name: taskName, required: false, isCustom: true }],
        });
        setCustomTaskInputs(prev => ({ ...prev, [itemId]: '' }));
    };

    const removeScopeTask = (itemId: string, taskIndex: number) => {
        const item = lineItems.find(li => li.id === itemId);
        if (!item?.scopeTasks) return;
        const updated = item.scopeTasks.filter((_, i) => i !== taskIndex);
        onUpdateLineItem(itemId, { scopeTasks: updated });
    };

    const toggleTaskRequired = (itemId: string, taskIndex: number) => {
        const item = lineItems.find(li => li.id === itemId);
        if (!item?.scopeTasks) return;
        const updated = item.scopeTasks.map((t, i) =>
            i === taskIndex ? { ...t, required: !t.required } : t
        );
        onUpdateLineItem(itemId, { scopeTasks: updated });
    };

    const toggleDay = (itemId: string, dayIndex: number, currentDays: boolean[]) => {
        const newDays = [...currentDays];
        newDays[dayIndex] = !newDays[dayIndex];
        onUpdateLineItem(itemId, { daysOfWeek: newDays });
    };

    return (
        <div className="space-y-6">
            {locations.map((loc) => {
                const locItems = lineItems.filter(li => li.locationId === loc.id);
                return (
                    <Card key={loc.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    <CardTitle className="text-base">{loc.name}</CardTitle>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => onAddLineItem(loc)}
                                >
                                    <Plus className="w-3 h-3" /> Add Service
                                </Button>
                            </div>
                            <CardDescription className="text-xs">{loc.address}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {locItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No services yet. Click &quot;Add Service&quot; above.
                                </p>
                            ) : (
                                locItems.map((item, itemIdx) => (
                                    item.lineItemStatus === 'cancelled' ? (
                                        /* ─── CANCELLED: Strikethrough display ─── */
                                        <div key={item.id} className="border rounded-lg p-4 bg-red-50/50 border-red-200 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs font-medium">🚫 Cancelled</span>
                                                <span className="font-medium text-sm line-through text-muted-foreground">{item.serviceType}</span>
                                                <span className="text-xs text-muted-foreground line-through">
                                                    {formatCurrency(item.clientRate)}/mo
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs text-muted-foreground"
                                                onClick={() => onUpdateLineItem(item.id, {
                                                    lineItemStatus: 'accepted',
                                                    cancelledInVersion: undefined,
                                                })}
                                            >
                                                Undo
                                            </Button>
                                        </div>
                                    ) : item.lineItemStatus === 'accepted' ? (
                                        /* ─── ACCEPTED: Locked with Cancel/Edit actions ─── */
                                        <div key={item.id} className="border rounded-lg p-4 bg-green-50/50 border-green-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded text-xs font-medium">✅ Accepted</span>
                                                    <span className="font-medium text-sm">{item.serviceType}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.frequency === 'custom_days' && item.daysOfWeek
                                                            ? item.daysOfWeek.map((d, i) => d ? DAY_LABELS[i] : null).filter(Boolean).join(', ')
                                                            : item.frequency?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{formatCurrency(item.clientRate)}/mo</span>
                                                    {isEditing && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-7 px-2"
                                                                onClick={() => onUpdateLineItem(item.id, {
                                                                    lineItemStatus: 'modified',
                                                                    modifiedInVersion: existingQuoteVersion ? existingQuoteVersion + 1 : 2,
                                                                    previousValues: {
                                                                        frequency: item.frequency,
                                                                        daysOfWeek: item.daysOfWeek,
                                                                        clientRate: item.clientRate,
                                                                        serviceDate: item.serviceDate,
                                                                    },
                                                                })}
                                                            >
                                                                ✏️ Edit
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => onUpdateLineItem(item.id, {
                                                                    lineItemStatus: 'cancelled',
                                                                    cancelledInVersion: existingQuoteVersion ? existingQuoteVersion + 1 : 2,
                                                                })}
                                                            >
                                                                🚫 Cancel
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={item.id} className={`border rounded-lg p-4 bg-muted/20 space-y-3 border-l-4 ${SERVICE_COLORS[itemIdx % SERVICE_COLORS.length]}`}>
                                            {/* Service Number Header */}
                                            <div className="flex items-center justify-between pb-1 mb-1 border-b border-dashed">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service #{itemIdx + 1}</span>
                                                    {item.serviceType && <span className="text-xs text-muted-foreground">— {item.serviceType}</span>}
                                                </div>
                                                <button
                                                    onClick={() => onRemoveLineItem(item.id)}
                                                    className="text-destructive/60 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                                                    title="Remove service"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {/* Row 1: Service Type + Rate */}
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-6">
                                                    <Label className="text-xs text-muted-foreground">Service Type</Label>
                                                    <select
                                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                        value={XIRI_SERVICES.find(s => s.label === item.serviceType)?.value || ''}
                                                        onChange={(e) => handleServiceSelect(item.id, e.target.value)}
                                                    >
                                                        <option value="">Select a service...</option>
                                                        {Object.entries(servicesByCategory).map(([cat, services]) => (
                                                            <optgroup key={cat} label={SERVICE_CATEGORIES[cat as ServiceCategory]}>
                                                                {services.map(s => (
                                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-4">
                                                    <Label className="text-xs text-muted-foreground">
                                                        {item.frequency === 'one_time' ? 'Flat Fee' : item.isConsumable ? 'Est. Monthly Cost' : 'Monthly Rate'}
                                                    </Label>
                                                    <div className="relative">
                                                        <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                                        <Input
                                                            type="number"
                                                            placeholder={item.isConsumable ? '500' : '2500'}
                                                            className="pl-7"
                                                            value={item.clientRate || ''}
                                                            onChange={(e) => onUpdateLineItem(item.id, {
                                                                clientRate: parseFloat(e.target.value) || 0,
                                                                ...(item.isConsumable ? { estimatedCost: parseFloat(e.target.value) || 0 } : {}),
                                                            })}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Calculator Scope Summary (for items generated from Building Scope step) */}
                                                {item.rooms && item.rooms.length > 0 && (
                                                    <div className="col-span-12">
                                                        <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
                                                            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                                                🏢 ISSA Calculator Scope
                                                                <span className="text-[10px] font-normal text-muted-foreground">
                                                                    {item.rooms.length} room{item.rooms.length !== 1 ? 's' : ''}
                                                                    {item.calculatorResults && ` · ${item.calculatorResults.hoursPerVisit.toFixed(1)} hrs/visit`}
                                                                </span>
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                {item.rooms.map(room => {
                                                                    const rt = ROOM_TYPES.find(r => r.id === room.roomTypeId);
                                                                    return (
                                                                        <div key={room.id} className="flex items-center gap-1.5 text-[11px]">
                                                                            <span className="text-muted-foreground">•</span>
                                                                            <span className="font-medium">{room.customName || rt?.name || room.roomTypeId}</span>
                                                                            <span className="text-muted-foreground">
                                                                                ({room.tasks.length} task{room.tasks.length !== 1 ? 's' : ''})
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {item.calculatorResults && (
                                                                <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t border-dashed">
                                                                    <span>Labor: {formatCurrency(item.calculatorResults.laborCostPerMonth)}/mo</span>
                                                                    <span>Overhead: {formatCurrency(item.calculatorResults.overheadCost)}/mo</span>
                                                                    <span>Profit: {formatCurrency(item.calculatorResults.profitAmount)}/mo</span>
                                                                    <span>Rate: {formatCurrency(item.calculatorResults.effectiveHourlyRate)}/hr</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Tax info */}
                                                {item.locationZip && item.taxRate && !item.taxExempt && (
                                                    <div className="col-span-12">
                                                        <p className="text-xs text-muted-foreground">
                                                            📍 ZIP {item.locationZip} — Tax: {(item.taxRate * 100).toFixed(3)}% = {formatCurrency(item.taxAmount || 0)}/mo
                                                        </p>
                                                    </div>
                                                )}
                                                {item.taxExempt && (
                                                    <div className="col-span-12">
                                                        <p className="text-xs text-green-600">✓ Tax exempt{item.taxExemptReason ? ` (${item.taxExemptReason})` : ''}</p>
                                                    </div>
                                                )}
                                                <div className="col-span-2 flex justify-end">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        onRemoveLineItem(item.id);
                                                        quoteLogger.lineItemRemoved(item.id);
                                                    }}>
                                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                                    </Button>
                                                </div>

                                                {/* ±20% Price Band (internal only) */}
                                                {item.clientRate > 0 && !item.isConsumable && item.frequency !== 'one_time' && (
                                                    <div className="col-span-12">
                                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">📊 Internal Range:</span>
                                                            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                                                                {formatCurrency(Math.round(item.clientRate * 0.8))} – {formatCurrency(Math.round(item.clientRate * 1.2))}/mo
                                                            </span>
                                                            <span className="text-[10px] text-blue-500">(±20%)</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Row 2: Frequency */}
                                            <div className="space-y-2">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                                                    <select
                                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                        value={item.frequency === 'custom_days'
                                                            ? (item.daysOfWeek && JSON.stringify(item.daysOfWeek) === JSON.stringify([false, true, true, true, true, true, false])
                                                                ? 'weekdays'
                                                                : 'custom_days')
                                                            : item.frequency}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'weekdays') {
                                                                onUpdateLineItem(item.id, { frequency: 'custom_days', daysOfWeek: [false, true, true, true, true, true, false] });
                                                            } else if (val === 'nightly') {
                                                                onUpdateLineItem(item.id, { frequency: 'nightly', daysOfWeek: [true, true, true, true, true, true, true] });
                                                            } else if (val === 'custom_days') {
                                                                onUpdateLineItem(item.id, { frequency: 'custom_days', daysOfWeek: item.daysOfWeek || [false, true, true, true, true, true, false] });
                                                            } else {
                                                                onUpdateLineItem(item.id, { frequency: val as QuoteLineItem['frequency'], daysOfWeek: undefined });
                                                            }
                                                        }}
                                                    >
                                                        <option value="one_time">Does not repeat (One-Time)</option>
                                                        <option value="nightly">Daily (Mon–Sun)</option>
                                                        <option value="weekdays">Every weekday (Mon–Fri)</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="biweekly">Bi-Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="quarterly">Quarterly</option>
                                                        <option value="custom_days">Custom...</option>
                                                    </select>
                                                </div>

                                                {/* Day Picker */}
                                                {item.frequency === 'custom_days' && item.daysOfWeek &&
                                                    JSON.stringify(item.daysOfWeek) !== JSON.stringify([false, true, true, true, true, true, false]) && (
                                                        <div>
                                                            <Label className="text-xs text-muted-foreground">
                                                                Select days — {item.daysOfWeek.filter(Boolean).length}x/week
                                                            </Label>
                                                            <div className="flex gap-1 mt-1">
                                                                {DAY_LABELS.map((day, i) => (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        onClick={() => toggleDay(item.id, i, item.daysOfWeek!)}
                                                                        className={`
                                                                            w-10 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer
                                                                            ${item.daysOfWeek![i]
                                                                                ? 'bg-primary text-primary-foreground'
                                                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                                            }
                                                                        `}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Monthly/Quarterly pattern picker */}
                                                {(item.frequency === 'monthly' || item.frequency === 'quarterly') && (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                            value={item.monthlyPattern?.type || 'none'}
                                                            onChange={(e) => {
                                                                const patternType = e.target.value;
                                                                if (patternType === 'none') {
                                                                    onUpdateLineItem(item.id, { monthlyPattern: undefined });
                                                                } else if (patternType === 'day_of_month') {
                                                                    onUpdateLineItem(item.id, { monthlyPattern: { type: 'day_of_month', day: 1 } });
                                                                } else if (patternType === 'nth_weekday') {
                                                                    onUpdateLineItem(item.id, { monthlyPattern: { type: 'nth_weekday', week: 1, dayOfWeek: 1 } });
                                                                }
                                                            }}
                                                        >
                                                            <option value="none">No specific schedule</option>
                                                            <option value="day_of_month">On day of month...</option>
                                                            <option value="nth_weekday">On nth weekday...</option>
                                                        </select>

                                                        {item.monthlyPattern?.type === 'day_of_month' && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs text-muted-foreground">Day</span>
                                                                <select
                                                                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
                                                                    value={item.monthlyPattern.day}
                                                                    onChange={(e) => onUpdateLineItem(item.id, {
                                                                        monthlyPattern: { type: 'day_of_month', day: parseInt(e.target.value) },
                                                                    })}
                                                                >
                                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                        <option key={d} value={d}>{d}</option>
                                                                    ))}
                                                                </select>
                                                                <span className="text-xs text-muted-foreground">of each {item.frequency === 'quarterly' ? 'quarter' : 'month'}</span>
                                                            </div>
                                                        )}

                                                        {item.monthlyPattern?.type === 'nth_weekday' && (
                                                            <div className="flex items-center gap-1.5">
                                                                <select
                                                                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
                                                                    value={item.monthlyPattern.week}
                                                                    onChange={(e) => onUpdateLineItem(item.id, {
                                                                        monthlyPattern: {
                                                                            type: 'nth_weekday',
                                                                            week: parseInt(e.target.value) as 1 | 2 | 3 | 4,
                                                                            dayOfWeek: (item.monthlyPattern as any).dayOfWeek || 1,
                                                                        },
                                                                    })}
                                                                >
                                                                    <option value={1}>1st</option>
                                                                    <option value={2}>2nd</option>
                                                                    <option value={3}>3rd</option>
                                                                    <option value={4}>4th</option>
                                                                </select>
                                                                <select
                                                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                                                    value={item.monthlyPattern.dayOfWeek}
                                                                    onChange={(e) => onUpdateLineItem(item.id, {
                                                                        monthlyPattern: {
                                                                            type: 'nth_weekday',
                                                                            week: (item.monthlyPattern as any).week || 1,
                                                                            dayOfWeek: parseInt(e.target.value),
                                                                        },
                                                                    })}
                                                                >
                                                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                                                        <option key={d} value={i}>{d}</option>
                                                                    ))}
                                                                </select>
                                                                <span className="text-xs text-muted-foreground">of each {item.frequency === 'quarterly' ? 'quarter' : 'month'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Service Date */}
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">
                                                        {item.frequency === 'one_time' || item.frequency === 'quarterly'
                                                            ? 'Service Date'
                                                            : 'Start Service Date'}
                                                    </Label>
                                                    <Input
                                                        type="date"
                                                        className="mt-1"
                                                        value={item.serviceDate || ''}
                                                        onChange={(e) => onUpdateLineItem(item.id, { serviceDate: e.target.value })}
                                                    />
                                                </div>

                                                {/* Consumable info */}
                                                {item.isConsumable && (
                                                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                                                        ⓘ Estimated cost — actual cost will be updated after procurement with markup.
                                                    </p>
                                                )}
                                            </div>

                                            {/* ─── Cleaning Scope Checklist ─── */}
                                            {item.serviceCategory === 'janitorial' && (
                                                <div className="border-t border-dashed pt-3">
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                                                        onClick={() => toggleScopeExpanded(item.id)}
                                                    >
                                                        {expandedScopes[item.id]
                                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                                            : <ChevronRight className="w-3.5 h-3.5" />}
                                                        <ClipboardList className="w-3.5 h-3.5" />
                                                        Cleaning Scope
                                                        {item.scopeTasks && item.scopeTasks.length > 0 && (
                                                            <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                                                                {item.scopeTasks.length} tasks
                                                            </span>
                                                        )}
                                                        {(!item.scopeTasks || item.scopeTasks.length === 0) && (
                                                            <span className="ml-1 text-[10px] text-amber-600">No scope — click to add</span>
                                                        )}
                                                    </button>

                                                    {expandedScopes[item.id] && (
                                                        <div className="mt-2 space-y-1.5">
                                                            {/* Existing scope tasks */}
                                                            {(item.scopeTasks || []).map((task, tIdx) => (
                                                                <div key={tIdx} className="flex items-center gap-2 group">
                                                                    <button
                                                                        type="button"
                                                                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${task.required
                                                                                ? 'bg-primary border-primary text-primary-foreground'
                                                                                : 'border-muted-foreground/30 hover:border-primary/50'
                                                                            }`}
                                                                        onClick={() => toggleTaskRequired(item.id, tIdx)}
                                                                        title={task.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                                                                    >
                                                                        {task.required && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className={`text-xs font-medium ${task.isCustom ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                                                            {task.isCustom && '✦ '}{task.name}
                                                                        </span>
                                                                        {task.description && (
                                                                            <span className="text-[10px] text-muted-foreground ml-1.5">— {task.description}</span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={() => removeScopeTask(item.id, tIdx)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                                                    </button>
                                                                </div>
                                                            ))}

                                                            {/* Add custom task */}
                                                            <div className="flex gap-2 mt-2">
                                                                <Input
                                                                    placeholder="Add custom task..."
                                                                    className="h-7 text-xs flex-1"
                                                                    value={customTaskInputs[item.id] || ''}
                                                                    onChange={(e) => setCustomTaskInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            addCustomTask(item.id);
                                                                        }
                                                                    }}
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs gap-1 px-2"
                                                                    onClick={() => addCustomTask(item.id)}
                                                                    disabled={!customTaskInputs[item.id]?.trim()}
                                                                >
                                                                    <Plus className="w-3 h-3" /> Add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                ))
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {/* Running Total */}
            <div className="p-4 bg-muted/30 rounded-lg border space-y-1">
                {totals.recurringItems.length > 0 && (
                    <div className="flex justify-end items-center gap-4">
                        <span className="text-sm text-muted-foreground">Monthly Recurring:</span>
                        <span className="text-lg font-medium">{formatCurrency(totals.recurringSubtotal + totals.recurringTax)}</span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                )}
                {totals.oneTimeItems.length > 0 && (
                    <div className="flex justify-end items-center gap-4">
                        <span className="text-sm text-muted-foreground">One-Time Charges:</span>
                        <span className="text-lg font-medium">{formatCurrency(totals.oneTimeSubtotal + totals.oneTimeTax)}</span>
                        <span className="text-xs text-muted-foreground">one-time</span>
                    </div>
                )}
                {totals.totalTax > 0 && (
                    <div className="flex justify-end items-center gap-4 text-xs text-muted-foreground">
                        <span>Includes {formatCurrency(totals.totalTax)} in sales tax</span>
                    </div>
                )}
            </div>
        </div>
    );
}
