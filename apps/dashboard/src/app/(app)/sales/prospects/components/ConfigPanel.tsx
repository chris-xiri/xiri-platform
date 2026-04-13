'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X, Search, MapPin, Settings2, Sparkles, TrendingUp, Target, Save, ChevronDown } from 'lucide-react';
import { groupQueriesByTier, groupLocationsByCounty, TIER_LABELS } from './icp-data';
import type { ProspectingConfig } from './types';

interface ConfigPanelProps {
    configOpen: boolean;
    config: ProspectingConfig | null;
    isSaving: boolean;
    editQueries: string[];
    editLocations: string[];
    editTarget: number;
    editEnabled: boolean;
    editExclude: string[];
    setEditQueries: (val: string[]) => void;
    setEditLocations: (val: string[]) => void;
    setEditTarget: (val: number) => void;
    setEditEnabled: (val: boolean) => void;
    setEditExclude: (val: string[]) => void;
    onSave: () => void;
    onSeedFromICP: () => void;
    onClose: () => void;
}

/** Helper to get yield color from stats */
function getYieldColor(qualified: number): string {
    if (qualified === 0) return 'bg-red-600 text-white border-red-700';
    if (qualified >= 5) return 'bg-emerald-600 text-white border-emerald-700';
    return 'bg-secondary text-secondary-foreground border-border';
}

/** Simple collapsible section using <details> styled to match shadcn aesthetics */
function TierSection({ tierNum, items, config, onRemove }: {
    tierNum: number;
    items: { category: string; query: string }[];
    config: ProspectingConfig | null;
    onRemove: (query: string) => void;
}) {
    const tierData = TIER_LABELS[tierNum] || { label: 'Custom / Other', color: 'text-muted-foreground', bgColor: 'bg-muted border-border/50' };
    const label = tierNum > 0 ? `Tier ${tierNum}: ${tierData.label}` : tierData.label;

    return (
        <details className="border rounded-md overflow-hidden mb-2" open={tierNum <= 2}>
            <summary className={`flex items-center justify-between px-3 py-2 cursor-pointer list-none select-none border-b ${tierData.bgColor} hover:brightness-95 transition-all`}>
                <span className="text-sm font-bold text-white tracking-wide">{label}</span>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs font-semibold">{items.length}</Badge>
                    <ChevronDown className="w-3.5 h-3.5 text-white/70 transition-transform details-chevron" />
                </div>
            </summary>
            <div className="p-3 bg-card flex flex-wrap gap-2">
                {items.map(({ query }) => {
                    const yieldStats = config?.lastRunStats?.queryYield?.[query];
                    const yieldClass = yieldStats ? getYieldColor(yieldStats.qualified) : 'bg-secondary text-secondary-foreground border-border';
                    return (
                        <div key={query} className={`flex items-center border rounded-md overflow-hidden text-xs ${yieldClass}`}>
                            <span className="px-2 py-1 flex items-center gap-1.5 border-r border-border/10">
                                {query}
                                {yieldStats && <span className="opacity-60 text-[10px]">({yieldStats.qualified})</span>}
                            </span>
                            <button
                                className="px-1.5 py-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                onClick={() => onRemove(query)}
                                title="Remove query"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </details>
    );
}

/** Inline toggle switch using a styled button */
function ToggleSwitch({ checked, onToggle }: { checked: boolean; onToggle: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onToggle(!checked)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? 'bg-primary' : 'bg-input'}`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`}
            />
        </button>
    );
}

export function ConfigPanel({
    configOpen,
    config,
    isSaving,
    editQueries,
    editLocations,
    editTarget,
    editEnabled,
    editExclude,
    setEditQueries,
    setEditLocations,
    setEditTarget,
    setEditEnabled,
    setEditExclude,
    onSave,
    onSeedFromICP,
    onClose,
}: ConfigPanelProps) {
    const [newQuery, setNewQuery] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newExclude, setNewExclude] = useState('');

    if (!configOpen) return null;

    const queriesByTier = groupQueriesByTier(editQueries);
    const locationsByCounty = groupLocationsByCounty(editLocations);

    return (
        <div className="mb-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="border-primary/20 shadow-sm bg-card/50 backdrop-blur">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-primary" />
                            ICP Config Dashboard
                        </CardTitle>
                        <CardDescription>
                            Define logic for the background prospector engine. Grouped by Ideal Customer Profile.
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>

                {/* Summary / Stats Row */}
                {config?.lastRunStats && (
                    <div className="px-6 pb-2">
                        <div className="flex items-center gap-4 text-xs bg-muted/50 p-2 rounded-md border border-border/50">
                            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-muted-foreground" /> Last Run:</div>
                            <div className="font-medium text-emerald-600 dark:text-emerald-400">{config.lastRunStats.added} imported</div>
                            <div className="text-muted-foreground">{config.lastRunStats.withEmail} e-mails</div>
                            <div className="text-muted-foreground">{config.lastRunStats.duplicatesSkipped} skipped dups</div>
                        </div>
                    </div>
                )}

                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Queries */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Search className="w-4 h-4 text-muted-foreground" />
                                    Search Queries ({editQueries.length})
                                </h3>
                            </div>

                            <div>
                                {[1, 2, 3, 0].map(tierNum => {
                                    const items = queriesByTier[tierNum];
                                    if (!items || items.length === 0) return null;
                                    return (
                                        <TierSection
                                            key={tierNum}
                                            tierNum={tierNum}
                                            items={items}
                                            config={config}
                                            onRemove={(query) => setEditQueries(editQueries.filter(q => q !== query))}
                                        />
                                    );
                                })}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    value={newQuery}
                                    onChange={(e) => setNewQuery(e.target.value)}
                                    placeholder="Add custom query..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newQuery.trim()) {
                                            if (!editQueries.includes(newQuery.trim())) {
                                                setEditQueries([...editQueries, newQuery.trim()]);
                                            }
                                            setNewQuery('');
                                        }
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        if (newQuery.trim() && !editQueries.includes(newQuery.trim())) {
                                            setEditQueries([...editQueries, newQuery.trim()]);
                                            setNewQuery('');
                                        }
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add
                                </Button>
                            </div>
                        </div>

                        {/* Right Column: Locations */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    Locations ({editLocations.length})
                                </h3>
                            </div>

                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {Object.entries(locationsByCounty).map(([county, locs]) => (
                                    <div key={county} className="space-y-2 border rounded-md p-3 bg-muted/20">
                                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            <span>{county} County</span>
                                            <span>{locs.length}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {locs.map(loc => {
                                                const yieldStats = config?.lastRunStats?.locationYield?.[loc];
                                                const yieldClass = yieldStats ? getYieldColor(yieldStats.qualified) : 'bg-secondary text-secondary-foreground border-border';
                                                return (
                                                    <div key={loc} className={`flex items-center border rounded-md overflow-hidden text-xs ${yieldClass}`}>
                                                        <span className="px-2 py-1 flex items-center gap-1.5 border-r border-border/10">
                                                            {loc}
                                                            {yieldStats && <span className="opacity-60 text-[10px]">({yieldStats.qualified})</span>}
                                                        </span>
                                                        <button
                                                            className="px-1.5 py-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                                            onClick={() => setEditLocations(editLocations.filter(l => l !== loc))}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    value={newLocation}
                                    onChange={(e) => setNewLocation(e.target.value)}
                                    placeholder="Add location (e.g. Jericho, NY)..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newLocation.trim()) {
                                            if (!editLocations.includes(newLocation.trim())) {
                                                setEditLocations([...editLocations, newLocation.trim()]);
                                            }
                                            setNewLocation('');
                                        }
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        if (newLocation.trim() && !editLocations.includes(newLocation.trim())) {
                                            setEditLocations([...editLocations, newLocation.trim()]);
                                            setNewLocation('');
                                        }
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Exclusions & Targets Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Exclusion Patterns</Label>
                            <p className="text-xs text-muted-foreground">Skip businesses matching these exact names/terms.</p>
                            <div className="flex flex-wrap gap-1.5">
                                {editExclude.map(pattern => (
                                    <Badge key={pattern} variant="outline" className="flex items-center gap-1 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                                        {pattern}
                                        <X
                                            className="w-3 h-3 cursor-pointer hover:text-red-900 transition-colors"
                                            onClick={() => setEditExclude(editExclude.filter(p => p !== pattern))}
                                        />
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newExclude}
                                    onChange={(e) => setNewExclude(e.target.value)}
                                    placeholder="Exclude match..."
                                    className="h-8 text-sm w-48"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newExclude.trim()) {
                                            if (!editExclude.includes(newExclude.trim())) {
                                                setEditExclude([...editExclude, newExclude.trim()]);
                                            }
                                            setNewExclude('');
                                        }
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        if (newExclude.trim() && !editExclude.includes(newExclude.trim())) {
                                            setEditExclude([...editExclude, newExclude.trim()]);
                                            setNewExclude('');
                                        }
                                    }}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold">Engine Status</Label>
                                    <p className="text-xs text-muted-foreground">Run daily background sourcing.</p>
                                </div>
                                <ToggleSwitch checked={editEnabled} onToggle={setEditEnabled} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Daily Qualified Target</Label>
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={editTarget}
                                        onChange={(e) => setEditTarget(parseInt(e.target.value) || 0)}
                                        className="w-24 h-8"
                                    />
                                    <span className="text-xs text-muted-foreground">leads/day</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <Button
                            variant="outline"
                            className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                            onClick={onSeedFromICP}
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Seed from ICP Engine
                        </Button>
                        <Button onClick={onSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Configuration
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
