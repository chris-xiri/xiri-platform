'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    type Lead,
    type RoomScope,
    type CalculatorInputs,
    type CalculatorResults,
    type Frequency,
    type CustomTask,
    BUILDING_TYPES,
    ROOM_TYPES,
    ROOM_AREA_RATIOS,
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
import { Button } from '@/components/ui/button';
import {
    Building2, Plus, Trash2, ChevronDown, ChevronRight,
    DollarSign, Clock, MapPin, Pencil, X, Check,
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
const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const fmtNumber = (n: number) =>
    new Intl.NumberFormat('en-US').format(n);

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
        return 'office';
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

    // Override states (null = use calculated)
    const [hoursOverride, setHoursOverride] = useState<number | null>(null);
    const [priceOverride, setPriceOverride] = useState<number | null>(null);

    // Task editing state
    const [editingTask, setEditingTask] = useState<{ roomId: string; taskId: string } | null>(null);
    const [editingTaskName, setEditingTaskName] = useState('');

    // Custom task input state
    const [addingCustomTask, setAddingCustomTask] = useState<string | null>(null); // roomId
    const [customTaskName, setCustomTaskName] = useState('');

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

    // ─── Auto-distribute sqft across rooms ───────────────────────────
    // When total sqft changes and rooms exist, distribute proportionally
    // based on ROOM_AREA_RATIOS from the building type config
    useEffect(() => {
        if (sqft <= 0 || rooms.length === 0) return;
        const ratios = ROOM_AREA_RATIOS[buildingTypeId];
        if (!ratios) return;

        // Get area ratios for each room's type
        const roomsWithRatios = rooms.map(room => {
            const ratio = ratios[room.roomTypeId] || 0.10;
            return { room, ratio };
        });
        const totalRatio = roomsWithRatios.reduce((sum, r) => sum + r.ratio, 0);
        if (totalRatio <= 0) return;

        // Only redistribute if all rooms have zero sqft or all match previous distribution
        const allZero = rooms.every(r => !r.sqft || r.sqft === 0);
        const allMatchPrevDistribution = rooms.every(r => {
            const ratio = ratios[r.roomTypeId] || 0.10;
            const expected = Math.round(sqft * ratio / totalRatio);
            return r.sqft === expected;
        });

        if (allZero || allMatchPrevDistribution) {
            setRooms(prev => prev.map(r => {
                const ratio = ratios[r.roomTypeId] || 0.10;
                return { ...r, sqft: Math.round(sqft * ratio / totalRatio) };
            }));
        }
    }, [sqft, rooms.length, buildingTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // ─── Task overrides (edit task name) ─────────────────────────────
    const startEditingTask = (roomId: string, taskId: string) => {
        const room = rooms.find(r => r.id === roomId);
        const task = CLEANING_TASKS.find(t => t.id === taskId);
        const overrideName = room?.taskOverrides?.[taskId]?.name;
        setEditingTask({ roomId, taskId });
        setEditingTaskName(overrideName || task?.name || '');
    };

    const saveTaskEdit = () => {
        if (!editingTask) return;
        const { roomId, taskId } = editingTask;
        const task = CLEANING_TASKS.find(t => t.id === taskId);
        const isDefault = editingTaskName === task?.name || editingTaskName.trim() === '';

        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            const overrides = { ...(r.taskOverrides || {}) };
            if (isDefault) {
                delete overrides[taskId];
            } else {
                overrides[taskId] = { name: editingTaskName.trim() };
            }
            return { ...r, taskOverrides: Object.keys(overrides).length > 0 ? overrides : undefined };
        }));
        setEditingTask(null);
        setEditingTaskName('');
    };

    // ─── Custom tasks ────────────────────────────────────────────────
    const addCustomTask = (roomId: string) => {
        if (!customTaskName.trim()) return;
        const newTask: CustomTask = {
            id: `custom_${Date.now()}`,
            name: customTaskName.trim(),
        };
        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            return { ...r, customTasks: [...(r.customTasks || []), newTask] };
        }));
        setCustomTaskName('');
        setAddingCustomTask(null);
    };

    const removeCustomTask = (roomId: string, taskId: string) => {
        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            return { ...r, customTasks: (r.customTasks || []).filter(t => t.id !== taskId) };
        }));
    };

    // Available frequency options based on bid frequency
    const freqOptions = getTaskFrequencyOptions(frequency);

    // ─── Building type info ──────────────────────────────────────────
    const buildingType = BUILDING_TYPES.find(bt => bt.id === buildingTypeId);

    // Effective hours (override or calculated)
    const displayHours = hoursOverride ?? results?.hoursPerVisit ?? null;

    return (
        <div className="space-y-6">
            {/* ═══ PRICING SUMMARY — STICKY AT TOP ═══ */}
            {results && (() => {
                const calcPrice = results.totalPricePerMonth;
                const low = Math.round(calcPrice * 0.8);
                const high = Math.round(calcPrice * 1.2);
                const finalPrice = priceOverride ?? calcPrice;
                return (
                    <Card className="border-primary/30 bg-card sticky top-0 z-10 shadow-sm">
                        <CardContent className="py-3 px-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Final Monthly Price</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg text-muted-foreground">$</span>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                value={priceOverride !== null ? fmtNumber(priceOverride) : fmtNumber(Math.round(calcPrice))}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                                    setPriceOverride(parseInt(raw) || null);
                                                }}
                                                className="w-28 h-8 text-xl font-bold text-primary"
                                            />
                                            <span className="text-sm text-muted-foreground">/mo</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            ISSA range: {fmtCurrency(low)} – {fmtCurrency(high)}
                                            {priceOverride !== null && (
                                                <button onClick={() => setPriceOverride(null)} className="ml-1 text-destructive hover:underline">(reset)</button>
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Per Visit</p>
                                        <p className="text-sm font-semibold">{fmtCurrency(Math.round(finalPrice / results.visitsPerMonth))}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hrs/Visit</p>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                            {hoursOverride !== null ? (
                                                <span className="text-sm font-semibold">
                                                    {hoursOverride.toFixed(1)}
                                                    <span className="text-[9px] text-muted-foreground ml-0.5">(override)</span>
                                                </span>
                                            ) : (
                                                <span className="text-sm font-semibold">{results.hoursPerVisit.toFixed(1)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Eff. Rate</p>
                                        <p className="text-sm font-semibold">{fmtCurrency(Math.round(finalPrice / results.totalHoursPerMonth))}/hr</p>
                                    </div>
                                </div>
                            </div>
                            {/* Full cost breakdown */}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-2 border-dashed">
                                <span>Labor: {fmtCurrency(results.laborCostPerMonth)}</span>
                                <span>Payroll Tax: {fmtCurrency(results.payrollTaxCost)}</span>
                                <span>Supplies: {fmtCurrency(results.supplyCostPerMonth)}</span>
                                <span>Overhead: {fmtCurrency(results.overheadCost)}</span>
                                <span>Profit: {fmtCurrency(results.profitAmount)}</span>
                                <span className="font-medium text-foreground">= {fmtCurrency(results.totalPricePerMonth)}</span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}

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
                                type="text"
                                inputMode="numeric"
                                value={sqft > 0 ? fmtNumber(sqft) : ''}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    setSqft(parseInt(raw) || 0);
                                }}
                                placeholder="e.g. 10,000"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Frequency, wage, overhead, hours override */}
                    <div className="grid grid-cols-4 gap-3">
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
                        <div>
                            <Label className="text-xs">
                                Hours Override
                                {hoursOverride !== null && (
                                    <button
                                        onClick={() => setHoursOverride(null)}
                                        className="ml-1 text-[9px] text-destructive hover:underline"
                                    >
                                        (reset)
                                    </button>
                                )}
                            </Label>
                            <Input
                                type="number"
                                step="0.5"
                                value={hoursOverride ?? ''}
                                onChange={e => {
                                    const v = parseFloat(e.target.value);
                                    setHoursOverride(isNaN(v) ? null : v);
                                }}
                                placeholder={results?.hoursPerVisit?.toFixed(1) || 'auto'}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {buildingType && (
                        <p className="text-xs text-muted-foreground">
                            ISSA production rate: {fmtNumber(buildingType.productionRate)} sqft/hr
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
                        <span className="text-xs text-muted-foreground">
                            {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                            {sqft > 0 && ` · ${fmtNumber(rooms.reduce((s, r) => s + (r.sqft || 0), 0))} of ${fmtNumber(sqft)} sqft assigned`}
                        </span>
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
                                        {room.sqft ? (
                                            <span className="text-[10px] text-muted-foreground">({fmtNumber(room.sqft)} sqft)</span>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {room.tasks.length + (room.customTasks?.length || 0)} task{(room.tasks.length + (room.customTasks?.length || 0)) !== 1 ? 's' : ''}
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
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={room.sqft ? fmtNumber(room.sqft) : ''}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        updateRoom(room.id, { sqft: parseInt(raw) || 0 });
                                                    }}
                                                    className="h-7 text-xs mt-0.5"
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Task checklist with edit capability */}
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                                Standard Tasks
                                            </p>
                                            <div className="grid grid-cols-1 gap-0.5">
                                                {availableTasks.map(task => {
                                                    const isOn = room.tasks.includes(task.id);
                                                    const isEditing = editingTask?.roomId === room.id && editingTask?.taskId === task.id;
                                                    const displayName = room.taskOverrides?.[task.id]?.name || task.name;
                                                    const isOverridden = !!room.taskOverrides?.[task.id]?.name;

                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                                                                isOn ? 'bg-primary/10' : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isOn}
                                                                onChange={() => toggleTask(room.id, task.id)}
                                                                className="rounded border-input flex-shrink-0"
                                                            />
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-1 flex-1">
                                                                    <input
                                                                        type="text"
                                                                        value={editingTaskName}
                                                                        onChange={e => setEditingTaskName(e.target.value)}
                                                                        onKeyDown={e => { if (e.key === 'Enter') saveTaskEdit(); if (e.key === 'Escape') setEditingTask(null); }}
                                                                        className="flex-1 h-5 px-1 text-xs border border-input rounded bg-background"
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={saveTaskEdit} className="text-primary hover:text-primary/80">
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                    <button onClick={() => setEditingTask(null)} className="text-muted-foreground hover:text-foreground">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className={`truncate flex-1 ${isOverridden ? 'italic' : ''}`}>
                                                                        {displayName}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); startEditingTask(room.id, task.id); }}
                                                                        className="opacity-40 hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5 flex-shrink-0 transition-opacity"
                                                                        title="Edit task name"
                                                                    >
                                                                        <Pencil className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Custom Tasks */}
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                                Custom Tasks
                                            </p>
                                            {(room.customTasks || []).map(ct => (
                                                <div key={ct.id} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-amber-500/10">
                                                    <span className="text-[10px] text-amber-600">★</span>
                                                    <span className="truncate flex-1">{ct.name}</span>
                                                    <button
                                                        onClick={() => removeCustomTask(room.id, ct.id)}
                                                        className="text-destructive/60 hover:text-destructive flex-shrink-0"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {addingCustomTask === room.id ? (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <input
                                                        type="text"
                                                        value={customTaskName}
                                                        onChange={e => setCustomTaskName(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') addCustomTask(room.id); if (e.key === 'Escape') { setAddingCustomTask(null); setCustomTaskName(''); } }}
                                                        className="flex-1 h-6 px-2 text-xs border border-input rounded bg-background"
                                                        placeholder="Enter custom task name..."
                                                        autoFocus
                                                    />
                                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addCustomTask(room.id)}>
                                                        Add
                                                    </Button>
                                                    <button onClick={() => { setAddingCustomTask(null); setCustomTaskName(''); }} className="text-muted-foreground hover:text-foreground">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setAddingCustomTask(room.id)}
                                                    className="flex items-center gap-1 px-2 py-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" /> Add custom task
                                                </button>
                                            )}
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
        </div>
    );
}
