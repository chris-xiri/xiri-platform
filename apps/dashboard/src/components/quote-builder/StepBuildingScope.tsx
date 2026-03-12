'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    type Lead,
    type RoomScope,
    type CalculatorInputs,
    type CalculatorResults,
    type Frequency,
    BUILDING_TYPES,
    ROOM_TYPES,
    CLEANING_TASKS,
    FREQUENCIES,
    DEFAULT_INPUTS,
    getDefaultRooms,
    getTaskFrequencyOptions,
    getStateDefaults,
    calculate,
} from '@xiri-facility-solutions/shared';
import { Location } from './types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Building2, Plus, Trash2, ChevronDown, ChevronRight,
    DollarSign, Clock, MapPin,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────
interface StepBuildingScopeProps {
    selectedLead: (Lead & { id: string }) | null;
    initialData?: {
        rooms?: RoomScope[];
        calculatorInputs?: CalculatorInputs;
        sqft?: number;
        facilityType?: string;
    };
    onScopeChange: (scope: {
        rooms: RoomScope[];
        inputs: CalculatorInputs;
        results: CalculatorResults;
        location: Location;
    } | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

let nextRoomId = 1;
function makeRoomId() {
    return `room_${nextRoomId++}_${Date.now()}`;
}

// ─── Component ────────────────────────────────────────────────────────
export default function StepBuildingScope({
    selectedLead,
    initialData,
    onScopeChange,
}: StepBuildingScopeProps) {

    // ─── Derive defaults from the selected lead ──────────────────────
    const leadFacilityType = initialData?.facilityType || selectedLead?.facilityType || '';
    const leadSqft = initialData?.sqft || (selectedLead as any)?.propertySourcing?.squareFootage || 0;
    const leadAddress = selectedLead?.address || '';
    const leadState = selectedLead?.state || 'NY';

    // ─── Map lead facility type to calculator building type ──────────
    const matchBuildingType = (ft: string): string => {
        const lower = ft.toLowerCase();
        if (lower.includes('office')) return 'office';
        if (lower.includes('medic') || lower.includes('clinic') || lower.includes('dental')) return 'medical';
        if (lower.includes('school') || lower.includes('university')) return 'school';
        if (lower.includes('retail') || lower.includes('store')) return 'retail';
        if (lower.includes('restaurant') || lower.includes('food')) return 'restaurant';
        if (lower.includes('warehouse') || lower.includes('industrial')) return 'warehouse';
        if (lower.includes('church') || lower.includes('worship')) return 'church';
        if (lower.includes('gym') || lower.includes('fitness')) return 'gym';
        if (lower.includes('hotel') || lower.includes('hospitality')) return 'hotel';
        if (lower.includes('daycare') || lower.includes('child')) return 'daycare';
        return 'office'; // default
    };

    // ─── State ───────────────────────────────────────────────────────
    const [buildingTypeId, setBuildingTypeId] = useState(
        initialData?.calculatorInputs?.buildingTypeId || matchBuildingType(leadFacilityType)
    );
    const [sqft, setSqft] = useState(leadSqft);
    const [rooms, setRooms] = useState<RoomScope[]>(
        initialData?.rooms || []
    );
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

    // Calculator inputs
    const [frequency, setFrequency] = useState<Frequency>(
        (initialData?.calculatorInputs?.frequency as Frequency) || '5'
    );
    const [wageRate, setWageRate] = useState(
        initialData?.calculatorInputs?.wageRate || DEFAULT_INPUTS.wageRate
    );
    const [overheadPercent, setOverheadPercent] = useState(
        initialData?.calculatorInputs?.overheadPercent ?? DEFAULT_INPUTS.overheadPercent
    );
    const [profitPercent, setProfitPercent] = useState(
        initialData?.calculatorInputs?.profitPercent ?? DEFAULT_INPUTS.profitPercent
    );

    // Location
    const [locationName, setLocationName] = useState(
        selectedLead?.businessName || ''
    );
    const [locationAddress, setLocationAddress] = useState(leadAddress);

    // Auto-fill wage from state data on state change
    useEffect(() => {
        if (leadState) {
            const stateDefaults = getStateDefaults(leadState);
            if (stateDefaults?.wageRate) {
                setWageRate(stateDefaults.wageRate);
            }
        }
    }, [leadState]);

    // Auto-seed rooms when building type or sqft changes (only if rooms are empty)
    useEffect(() => {
        if (rooms.length === 0 && buildingTypeId && sqft > 0) {
            const defaultRooms = getDefaultRooms(buildingTypeId, sqft);
            setRooms(defaultRooms.map((r: RoomScope) => ({ ...r, id: makeRoomId() })));
        }
    }, [buildingTypeId, sqft]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Calculator results ──────────────────────────────────────────
    const inputs: CalculatorInputs = useMemo(() => ({
        buildingTypeId,
        sqft,
        frequency,
        wageRate,
        payrollTaxPercent: DEFAULT_INPUTS.payrollTaxPercent,
        overheadPercent,
        profitPercent,
        supplyCostPerSqft: DEFAULT_INPUTS.supplyCostPerSqft,
        supplyPolicy: 'company' as const,
    }), [buildingTypeId, sqft, frequency, wageRate, overheadPercent, profitPercent]);

    const results = useMemo(() => {
        if (rooms.length === 0 || sqft <= 0) return null;
        try {
            return calculate(inputs, rooms);
        } catch {
            return null;
        }
    }, [inputs, rooms, sqft]);

    // ─── Propagate scope changes ─────────────────────────────────────
    const propagate = useCallback(() => {
        if (!results || rooms.length === 0) {
            onScopeChange(null);
            return;
        }
        onScopeChange({
            rooms,
            inputs,
            results,
            location: {
                id: 'loc_1',
                name: locationName,
                address: locationAddress,
                city: selectedLead?.city || '',
                state: selectedLead?.state || '',
                zip: selectedLead?.zipCode || '',
            },
        });
    }, [results, rooms, inputs, locationName, locationAddress, onScopeChange]);

    useEffect(() => { propagate(); }, [propagate]);

    // ─── Room management ─────────────────────────────────────────────
    const addRoom = (roomTypeId: string) => {
        const roomType = ROOM_TYPES.find(r => r.id === roomTypeId);
        if (!roomType) return;
        const newRoom: RoomScope = {
            id: makeRoomId(),
            roomTypeId,
            sqft: 0,
            tasks: [...roomType.defaultTasks],
        };
        setRooms(prev => [...prev, newRoom]);
        setExpandedRoom(newRoom.id);
    };

    const removeRoom = (roomId: string) => {
        setRooms(prev => prev.filter(r => r.id !== roomId));
    };

    const updateRoom = (roomId: string, updates: Partial<RoomScope>) => {
        setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...updates } : r));
    };

    const toggleTask = (roomId: string, taskId: string) => {
        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            const has = r.tasks.includes(taskId);
            return {
                ...r,
                tasks: has ? r.tasks.filter(t => t !== taskId) : [...r.tasks, taskId],
            };
        }));
    };

    // Available frequency options based on bid frequency
    const freqOptions = getTaskFrequencyOptions(frequency);

    // ─── Building type info ──────────────────────────────────────────
    const buildingType = BUILDING_TYPES.find(bt => bt.id === buildingTypeId);

    return (
        <div className="space-y-6">
            {/* ═══ LOCATION ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" /> Location
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Location Name</Label>
                            <Input
                                value={locationName}
                                onChange={e => setLocationName(e.target.value)}
                                placeholder="Main Office"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Address</Label>
                            <Input
                                value={locationAddress}
                                onChange={e => setLocationAddress(e.target.value)}
                                placeholder="123 Main St, City, ST"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═══ BUILDING TYPE + SQFT ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" /> Building Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Building Type</Label>
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                value={buildingTypeId}
                                onChange={e => {
                                    setBuildingTypeId(e.target.value);
                                    // Re-seed rooms for new building type
                                    if (sqft > 0) {
                                        const defaultRooms = getDefaultRooms(e.target.value, sqft);
                                        setRooms(defaultRooms.map((r: RoomScope) => ({ ...r, id: makeRoomId() })));
                                    }
                                }}
                            >
                                <optgroup label="Popular">
                                    {BUILDING_TYPES.filter(bt => bt.popular).map(bt => (
                                        <option key={bt.id} value={bt.id}>{bt.icon} {bt.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Advanced">
                                    {BUILDING_TYPES.filter(bt => !bt.popular).map(bt => (
                                        <option key={bt.id} value={bt.id}>{bt.icon} {bt.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Total Square Footage</Label>
                            <Input
                                type="number"
                                value={sqft || ''}
                                onChange={e => setSqft(parseInt(e.target.value) || 0)}
                                placeholder="e.g. 10,000"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Frequency and key params */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Cleaning Frequency</Label>
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as Frequency)}
                            >
                                {FREQUENCIES.filter(f => f.group === 'recurring').map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Wage Rate ($/hr)</Label>
                            <Input
                                type="number"
                                step="0.50"
                                value={wageRate}
                                onChange={e => setWageRate(parseFloat(e.target.value) || DEFAULT_INPUTS.wageRate)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Overhead %</Label>
                            <Input
                                type="number"
                                step="1"
                                value={overheadPercent}
                                onChange={e => setOverheadPercent(parseInt(e.target.value) || 0)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {buildingType && (
                        <p className="text-xs text-muted-foreground">
                            ISSA production rate: {buildingType.productionRate.toLocaleString()} sqft/hr
                            {buildingType.complexityMultiplier > 1 && ` · ${buildingType.complexityMultiplier}x complexity`}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ═══ ROOMS + TASKS ═══ */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Rooms & Task Scope</CardTitle>
                        <span className="text-xs text-muted-foreground">{rooms.length} room{rooms.length !== 1 ? 's' : ''}</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {rooms.length === 0 && sqft <= 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            Enter square footage above to auto-generate rooms
                        </p>
                    )}
                    {rooms.length === 0 && sqft > 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            No rooms yet — they&apos;ll auto-populate when you select a building type.
                        </p>
                    )}

                    {rooms.map(room => {
                        const roomType = ROOM_TYPES.find(rt => rt.id === room.roomTypeId);
                        const isExpanded = expandedRoom === room.id;
                        const availableTasks = CLEANING_TASKS.filter(t =>
                            roomType?.relevantCategories?.includes(t.category) || room.tasks.includes(t.id)
                        );

                        return (
                            <div key={room.id} className="border rounded-lg overflow-hidden">
                                {/* Room header */}
                                <button
                                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                                    onClick={() => setExpandedRoom(isExpanded ? null : room.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        <span className="text-sm font-medium">
                                            {room.customName || roomType?.name || room.roomTypeId}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {room.tasks.length} task{room.tasks.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            className="text-destructive/60 hover:text-destructive p-0.5"
                                            onClick={e => { e.stopPropagation(); removeRoom(room.id); }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </button>

                                {/* Room detail */}
                                {isExpanded && (
                                    <div className="px-3 py-3 space-y-3 border-t">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <Label className="text-[10px]">Name</Label>
                                                <Input
                                                    value={room.customName || roomType?.name || ''}
                                                    onChange={e => updateRoom(room.id, { customName: e.target.value })}
                                                    className="h-7 text-xs mt-0.5"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[10px]">Sqft</Label>
                                                <Input
                                                    type="number"
                                                    value={room.sqft || ''}
                                                    onChange={e => updateRoom(room.id, { sqft: parseInt(e.target.value) || 0 })}
                                                    className="h-7 text-xs mt-0.5"
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Task checklist */}
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tasks</p>
                                            <div className="grid grid-cols-2 gap-1">
                                                {availableTasks.map(task => {
                                                    const isOn = room.tasks.includes(task.id);
                                                    return (
                                                        <label
                                                            key={task.id}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                                                isOn ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isOn}
                                                                onChange={() => toggleTask(room.id, task.id)}
                                                                className="rounded border-input"
                                                            />
                                                            <span className="truncate">{task.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add room */}
                    <div className="pt-2">
                        <Label className="text-xs text-muted-foreground mb-1 block">Add Room</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {ROOM_TYPES.map(rt => (
                                <button
                                    key={rt.id}
                                    onClick={() => addRoom(rt.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    {rt.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═══ PRICING SUMMARY ═══ */}
            {results && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4" /> Scope Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Monthly Price</p>
                                <p className="text-2xl font-bold text-primary">{fmt(results.totalPricePerMonth)}</p>
                                <p className="text-xs text-muted-foreground">
                                    {fmt(results.pricePerVisit)}/visit × {results.visitsPerMonth} visits
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Hours Per Visit</p>
                                <p className="text-2xl font-bold flex items-center gap-1">
                                    <Clock className="w-5 h-5 text-muted-foreground" />
                                    {results.hoursPerVisit.toFixed(1)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {results.totalHoursPerMonth.toFixed(0)} hrs/month
                                </p>
                            </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                                <span className="text-muted-foreground">Labor Cost</span>
                                <p className="font-medium">{fmt(results.laborCostPerMonth)}/mo</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Overhead</span>
                                <p className="font-medium">{fmt(results.overheadCost)}/mo</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Profit</span>
                                <p className="font-medium">{fmt(results.profitAmount)}/mo</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Effective rate: {fmt(results.pricePerSqft)}/sqft · Rate: {fmt(results.effectiveHourlyRate)}/hr
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
