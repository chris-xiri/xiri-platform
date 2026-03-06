'use client';

import { QuoteLineItem, getTaxRate, calculateTax } from '@xiri/shared';
import { Lead } from '@xiri/shared';
import { XIRI_SERVICES, SERVICE_CATEGORIES, ServiceCategory } from '@/data/serviceTypes';
import JanitorialPricingCalc from '@/components/JanitorialPricingCalc';
import { Location, DAY_LABELS, SERVICE_COLORS } from './types';
import { formatCurrency, computeTotals } from './helpers';
import { quoteLogger } from './logger';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Trash2, DollarSign } from 'lucide-react';

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

    const handleServiceSelect = (itemId: string, serviceValue: string) => {
        const service = XIRI_SERVICES.find(s => s.value === serviceValue);
        if (!service) return;
        const isConsumable = service.category === 'consumables';
        onUpdateLineItem(itemId, {
            serviceType: service.label,
            serviceCategory: service.category,
            isConsumable,
            ...(isConsumable ? { frequency: 'weekly' as const, daysOfWeek: undefined } : {}),
        });
        quoteLogger.lineItemUpdated(itemId, ['serviceType', 'serviceCategory']);
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
                                            <div className="flex items-center gap-2 pb-1 mb-1 border-b border-dashed">
                                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service #{itemIdx + 1}</span>
                                                {item.serviceType && <span className="text-xs text-muted-foreground">— {item.serviceType}</span>}
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
                                                {/* Janitorial Pricing Calculator */}
                                                {item.serviceCategory === 'janitorial' && (
                                                    <div className="col-span-12">
                                                        <JanitorialPricingCalc
                                                            facilityType={selectedLead?.facilityType}
                                                            initialSqft={item.sqft || selectedLead?.propertySourcing?.squareFootage}
                                                            onApplyRate={(rate, sqft) => onUpdateLineItem(item.id, { clientRate: rate, sqft })}
                                                        />
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
