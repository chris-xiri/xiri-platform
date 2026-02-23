'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    CheckCircle2, XCircle, ChevronDown, ChevronUp,
    X, RotateCcw, Plus, Rocket, Loader2, Search,
    Building2, MapPin, Ruler, User, Phone, DollarSign, Calendar,
    Database, Globe, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { PreviewProperty } from '@xiri/shared';
import ReactGoogleAutocomplete from 'react-google-autocomplete';
import { searchOpenData, AVAILABLE_COUNTIES, PROPERTY_CLASS_OPTIONS, PLUTO_BLDG_CLASS_OPTIONS, RECOMMENDED_CODES, RECOMMENDED_PLUTO_CODES, type OpenDataSearchParams, ENRICHMENT_SOURCES, searchDOHFacilities, searchDMVDealers, searchOCFSChildcare, searchDOBPermits, matchEnrichmentToProperty, matchIntentToProperty, type EnrichmentMatch, type IntentSignal, type EnrichmentSource, calculateFitScore, type FitScoreBreakdown } from '@/lib/openDataSearch';

// ── Types ──

export interface CampaignPreviewProperty extends PreviewProperty {
    isDismissed?: boolean;
}

export interface PropertyCampaign {
    id: string;
    label: string;
    properties: CampaignPreviewProperty[];
    searches: { query: string; location: string; sourced: number; timestamp: Date }[];
}

// ── Utilities ──

function toTitleCase(str: string): string {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── MultiSelectDropdown ──

function MultiSelectDropdown({ label, options, selected, onChange, placeholder, color, disabled, quickFill }: {
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
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
                    {/* Options */}
                    <div className="max-h-[200px] overflow-y-auto py-1">
                        {options.map(opt => (
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

interface LeadSourcingCampaignTableProps {
    campaigns: PropertyCampaign[];
    activeCampaignId: string | null;
    onSetActiveCampaign: (id: string) => void;
    onNewCampaign: () => void;
    onCloseCampaign: (id: string) => void;
    onSearchResults: (campaignId: string, properties: CampaignPreviewProperty[], meta: { query: string; location: string; sourced: number }) => void;
    onApprove: (campaignId: string, propertyId: string) => void;
    onDismiss: (campaignId: string, propertyId: string) => void;
    onRevive: (campaignId: string, propertyId: string) => void;
    onApproveAll: (campaignId: string) => void;
    onDismissAll: (campaignId: string) => void;
    onRenameCampaign: (campaignId: string, newLabel: string) => void;
}

/* ─── Property Detail Panel (right-side preview) ─── */
function PropertyDetailPanel({ property, onClose, onApprove, onDismiss, onRevive, campaignId, enrichMatch, intentMatch }: {
    property: CampaignPreviewProperty;
    onClose: () => void;
    onApprove: (campaignId: string, propertyId: string) => void;
    onDismiss: (campaignId: string, propertyId: string) => void;
    onRevive: (campaignId: string, propertyId: string) => void;
    campaignId: string;
    enrichMatch?: EnrichmentMatch;
    intentMatch?: IntentSignal;
}) {
    const dismissed = property.isDismissed;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden animate-in slide-in-from-right-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                        {enrichMatch ? toTitleCase(enrichMatch.facilityName) : toTitleCase(property.name || '')}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                        {property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}
                    </p>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Property Details */}
            <div className="p-3 space-y-3 border-b border-border flex-shrink-0 bg-muted/5 overflow-y-auto flex-1">
                {/* Property Info Card */}
                <Card className="bg-card border-secondary/20 shadow-sm">
                    <CardHeader className="py-2 px-3 pb-1">
                        <CardTitle className="text-xs font-medium flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-500" /> Property Details
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                                {property.propertyType?.replace(/_/g, ' ') || 'Commercial'}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0 space-y-2">
                        {/* Address */}
                        <div className="flex items-start gap-2 text-xs">
                            <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
                        </div>

                        {/* Sq Ft + Year Built */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {property.squareFootage && (
                                <div className="flex items-center gap-1.5">
                                    <Ruler className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-medium">{property.squareFootage.toLocaleString()} sq ft</span>
                                </div>
                            )}
                            {property.yearBuilt && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span>Built {property.yearBuilt}</span>
                                </div>
                            )}
                        </div>

                        {/* Last Sale */}
                        {property.lastSalePrice && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <DollarSign className="w-3 h-3 text-muted-foreground" />
                                <span>Last sold: ${property.lastSalePrice.toLocaleString()}</span>
                                {property.lastSaleDate && <span className="text-muted-foreground">({property.lastSaleDate})</span>}
                            </div>
                        )}

                        {/* Tenant */}
                        {property.tenantName && (
                            <div className="flex items-center gap-1.5 text-xs border-t border-border pt-2 mt-2">
                                <Building2 className="w-3 h-3 text-emerald-500" />
                                <span><span className="font-medium">Tenant:</span> {property.tenantName}</span>
                                {property.tenantCount && (
                                    <Badge variant={property.tenantCount === 1 ? "default" : "secondary"} className="text-[10px] h-4 px-1">
                                        {property.tenantCount === 1 ? 'Single-Tenant' : `${property.tenantCount} tenants`}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Owner Info Card */}
                {(property.ownerName || property.ownerPhone) && (
                    <Card className="bg-card border-secondary/20 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-amber-500" /> Owner / Decision Maker
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-1.5">
                            {property.ownerName && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-medium">{toTitleCase(property.ownerName)}</span>
                                </div>
                            )}
                            {property.ownerPhone && (
                                <a href={`tel:${property.ownerPhone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                    <Phone className="w-3 h-3" /> {property.ownerPhone}
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Enrichment Card — from DOH/DMV/OCFS */}
                {enrichMatch && (
                    <Card className="bg-card border-emerald-200 dark:border-emerald-800 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-emerald-500" /> Licensing Data
                                </span>
                                <Badge variant="default" className={`text-[9px] px-1.5 h-4 ${enrichMatch.source === 'doh' ? 'bg-emerald-600' :
                                    enrichMatch.source === 'dmv' ? 'bg-orange-600' :
                                        enrichMatch.source === 'ocfs' ? 'bg-purple-600' : 'bg-blue-600'
                                    }`}>
                                    {enrichMatch.source.toUpperCase()} Verified
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs">
                                <Building2 className="w-3 h-3 text-emerald-500" />
                                <span className="font-medium">{toTitleCase(enrichMatch.facilityName)}</span>
                            </div>
                            {enrichMatch.description && (
                                <div className="text-[10px] text-muted-foreground pl-[18px]">
                                    {enrichMatch.description}
                                </div>
                            )}
                            {enrichMatch.operatorName && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span>{toTitleCase(enrichMatch.operatorName)}</span>
                                </div>
                            )}
                            {enrichMatch.phone && (
                                <a href={`tel:${enrichMatch.phone}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                    <Phone className="w-3 h-3" /> {enrichMatch.phone}
                                </a>
                            )}
                            {enrichMatch.licenseId && (
                                <div className="text-[10px] text-muted-foreground pl-[18px]">
                                    License: {enrichMatch.licenseId}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Intent Signal Card */}
                {intentMatch && (
                    <Card className="bg-card border-amber-200 dark:border-amber-800 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                                <Rocket className="w-3.5 h-3.5 text-amber-500" /> 🔥 Buyer Intent
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-1.5">
                            <div className="text-xs font-medium">{intentMatch.label}</div>
                            <div className="text-[10px] text-muted-foreground">{intentMatch.details}</div>
                            {intentMatch.ownerBusinessName && intentMatch.ownerBusinessName !== 'N/A' && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Building2 className="w-3 h-3" /> {toTitleCase(intentMatch.ownerBusinessName)}
                                </div>
                            )}
                            {intentMatch.ownerPhone && (
                                <a href={`tel:${intentMatch.ownerPhone}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                    <Phone className="w-3 h-3" /> {intentMatch.ownerPhone}
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* AI Analysis (future) */}
                {property.fitScore !== undefined && (
                    <Card className="bg-card border-secondary/20 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <Rocket className="w-3.5 h-3.5 text-yellow-500 fill-current" /> Fit Score
                                </span>
                                <span className={`font-bold text-sm ${(property.fitScore || 0) > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {property.fitScore}/100
                                </span>
                            </CardTitle>
                        </CardHeader>
                        {property.aiReasoning && (
                            <CardContent className="px-3 pb-2 pt-0">
                                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 my-1.5">
                                    "{property.aiReasoning}"
                                </p>
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* Action Buttons */}
                <div className="pt-2">
                    {dismissed ? (
                        <Button onClick={() => onRevive(campaignId, property.id)} className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                            <RotateCcw className="w-3 h-3 mr-1" /> Revive Property
                        </Button>
                    ) : (
                        <>
                            <Button onClick={() => onApprove(campaignId, property.id)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white h-auto py-2 text-xs mb-2">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve — Add to Sales CRM
                            </Button>
                            <Button onClick={() => onDismiss(campaignId, property.id)}
                                variant="default" size="sm"
                                className="w-full bg-red-600 hover:bg-red-700 text-white h-7 text-xs">
                                <XCircle className="w-3 h-3 mr-1" /> Dismiss (Blacklist)
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function LeadSourcingCampaignTable({
    campaigns, activeCampaignId, onSetActiveCampaign, onNewCampaign,
    onCloseCampaign, onSearchResults, onApprove, onDismiss, onRevive,
    onApproveAll, onDismissAll, onRenameCampaign,
}: LeadSourcingCampaignTableProps) {
    const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(true);
    const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
    const [showBulkDismissDialog, setShowBulkDismissDialog] = useState(false);
    const [showCloseTabDialog, setShowCloseTabDialog] = useState<string | null>(null);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    // Search state
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    // Source toggle: 'google' | 'opendata'
    const [searchSource, setSearchSource] = useState<'google' | 'opendata'>('opendata');

    // Open Data search state
    const [odCounties, setOdCounties] = useState<string[]>([]);
    const [odClasses, setOdClasses] = useState<string[]>([]);
    const [odPlutoClasses, setOdPlutoClasses] = useState<string[]>([]);
    const [odMinSqFt, setOdMinSqFt] = useState('');
    const [odMaxSqFt, setOdMaxSqFt] = useState('');
    const [odMunicipality, setOdMunicipality] = useState('');
    const [odOffset, setOdOffset] = useState(0);
    const [odTotalCount, setOdTotalCount] = useState<number | null>(null);
    const [odHasMore, setOdHasMore] = useState(false);
    const OD_PAGE_SIZE = 200;

    // Enrichment state
    const [enrichmentSources, setEnrichmentSources] = useState<EnrichmentSource[]>([]);
    const [enrichments, setEnrichments] = useState<EnrichmentMatch[]>([]);
    const [intentSignals, setIntentSignals] = useState<IntentSignal[]>([]);
    const [enrichmentLoading, setEnrichmentLoading] = useState(false);

    // Sort & filter state
    type SortField = 'score' | 'name' | 'default';
    type FilterMode = 'all' | 'enriched' | 'intent' | 'nnn';
    const [sortBy, setSortBy] = useState<SortField>('score');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');

    if (campaigns.length === 0) {
        return (
            <Card className="border-2 border-dashed border-border shadow-sm h-full">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
                    <Building2 className="w-10 h-10 text-muted-foreground/40" />
                    <div>
                        <p className="text-base font-medium text-foreground">Lead Sourcing Campaigns</p>
                        <p className="text-sm text-muted-foreground mt-1">Source single-tenant commercial buildings for your sales pipeline.<br />Approved properties become leads in the Sales CRM.</p>
                    </div>
                    <Button onClick={onNewCampaign} className="mt-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-4 h-4 mr-1.5" /> New Campaign
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];
    const rawProperties = activeCampaign?.properties || [];

    // Calculate fit scores and sort/filter
    const scoredProperties = rawProperties.map(p => {
        const em = matchEnrichmentToProperty(p, enrichments);
        const im = matchIntentToProperty(p, intentSignals);
        return { property: p, score: calculateFitScore(p, em, im), enrichMatch: em, intentMatch: im };
    });

    // Filter
    const filteredScored = scoredProperties.filter(({ property, enrichMatch, intentMatch }) => {
        if (filterMode === 'enriched') return !!enrichMatch;
        if (filterMode === 'intent') return !!intentMatch;
        if (filterMode === 'nnn') return property.tenantCount === 1;
        return true;
    });

    // Sort
    const sortedScored = [...filteredScored].sort((a, b) => {
        if (sortBy === 'score') return b.score.total - a.score.total;
        if (sortBy === 'name') return (a.property.name || '').localeCompare(b.property.name || '');
        return 0;
    });

    const properties = sortedScored.map(s => s.property);
    const scoreMap = new Map(sortedScored.map(s => [s.property.id, s.score]));
    const activeProperties = properties.filter(p => !p.isDismissed);
    const dismissedCount = properties.filter(p => p.isDismissed).length;
    const selectedPreviewProperty = selectedPropertyId ? rawProperties.find(p => p.id === selectedPropertyId) : null;

    const handleSelectAll = (checked: boolean) => {
        if (checked) { setSelectedProperties(new Set(activeProperties.map(p => p.id!))); }
        else { setSelectedProperties(new Set()); }
    };
    const handleSelectProperty = (propertyId: string, checked: boolean) => {
        const s = new Set(selectedProperties);
        if (checked) { s.add(propertyId); } else { s.delete(propertyId); }
        setSelectedProperties(s);
    };

    const handleBulkApprove = () => { selectedProperties.forEach(id => onApprove(activeCampaign.id, id)); setSelectedProperties(new Set()); setShowBulkApproveDialog(false); };
    const handleBulkDismiss = () => { selectedProperties.forEach(id => onDismiss(activeCampaign.id, id)); setSelectedProperties(new Set()); setShowBulkDismissDialog(false); };
    const confirmCloseTab = () => { if (showCloseTabDialog) { onCloseCampaign(showCloseTabDialog); setShowCloseTabDialog(null); setSelectedProperties(new Set()); setSelectedPropertyId(null); } };

    const allSelected = activeProperties.length > 0 && selectedProperties.size === activeProperties.length;
    const handleTabSwitch = (id: string) => { setSelectedProperties(new Set()); setSearchMessage(''); setSelectedPropertyId(null); onSetActiveCampaign(id); };

    // ── Google Maps Places Text Search ──
    const handleGoogleSearch = async () => {
        if (!query.trim() || !location.trim()) { setSearchMessage('Please fill in both fields'); return; }
        setLoading(true); setSearchMessage('');

        try {
            if (!window.google?.maps?.places) {
                throw new Error('Google Maps API not loaded. Check your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.');
            }

            const service = new window.google.maps.places.PlacesService(
                document.createElement('div')
            );

            const searchText = `${query.trim()} near ${location.trim()}`;

            const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
                service.textSearch({ query: searchText }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        resolve(results);
                    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                        resolve([]);
                    } else {
                        reject(new Error(`Google Places API error: ${status}`));
                    }
                });
            });

            const newProperties: CampaignPreviewProperty[] = results.map((place, i) => {
                const addressParts = (place.formatted_address || '').split(',').map(s => s.trim());
                const street = addressParts[0] || '';
                const city = addressParts[1] || '';
                const stateZip = addressParts[2] || '';
                const [state = '', zip = ''] = stateZip.split(' ').filter(Boolean);

                return {
                    id: `gmap_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                    name: place.name || 'Unknown Business',
                    address: street, city, state, zip,
                    propertyType: inferFacilityType(place.types || [], query),
                    source: 'google_maps',
                    sourceId: place.place_id || '',
                    tenantName: place.name || '',
                    tenantCount: 1,
                    ownerPhone: '', ownerName: '',
                    isDismissed: false,
                    facilityType: inferFacilityType(place.types || [], query),
                };
            });

            const existingAddresses = new Set(activeCampaign.properties.map(p => (p.address || '').toLowerCase().trim()));
            const uniqueNew = newProperties.filter(p => !existingAddresses.has((p.address || '').toLowerCase().trim()));

            if (uniqueNew.length > 0) {
                onSearchResults(activeCampaign.id, uniqueNew, { query, location, sourced: results.length });
            }

            if (activeCampaign.label === 'New Campaign' && query.trim()) {
                const loc = location.trim();
                const parts = loc.split(',').map(p => p.trim());
                const town = parts[0] || loc;
                const stateVal = parts.length >= 2 ? parts[1].replace(/\s*\d{5}.*/, '').trim() : '';
                onRenameCampaign(activeCampaign.id, `${query.trim()}\n${town}\n${stateVal}`);
            }

            setSearchMessage(`Found ${results.length} places · ${uniqueNew.length} new added`);
            setQuery(''); setLocation('');
        } catch (error: any) {
            console.error('Error:', error);
            setSearchMessage(`Error: ${error.message || 'Failed to search'}`);
        } finally { setLoading(false); }
    };

    // ── Open Data SODA API Search ──
    const handleOpenDataSearch = async (newOffset: number = 0) => {
        if (odCounties.length === 0) { setSearchMessage('Select at least one county/borough'); return; }
        if (odClasses.length === 0 && odPlutoClasses.length === 0) { setSearchMessage('Select at least one property class'); return; }
        setLoading(true); setSearchMessage('');

        try {
            const params: OpenDataSearchParams = {
                counties: odCounties,
                propertyClasses: odClasses,
                plutoBldgClasses: odPlutoClasses,
                minLotSqFt: odMinSqFt ? parseInt(odMinSqFt) : undefined,
                maxLotSqFt: odMaxSqFt ? parseInt(odMaxSqFt) : undefined,
                municipality: odMunicipality || undefined,
                limit: OD_PAGE_SIZE,
                offset: newOffset,
            };

            // Determine which enrichment sources to auto-enable
            const autoSources: EnrichmentSource[] = [];
            for (const src of ENRICHMENT_SOURCES) {
                const hasMatchingClass = src.autoEnableClasses.some(c => odClasses.includes(c));
                const hasMatchingPluto = src.autoEnablePlutoClasses.some(c => odPlutoClasses.includes(c));
                if (hasMatchingClass || hasMatchingPluto) autoSources.push(src.id);
            }
            // Always include manually toggled sources
            const activeSources = [...new Set([...autoSources, ...enrichmentSources])];

            // Fetch property data + enrichment in parallel
            const [result, ...enrichResults] = await Promise.all([
                searchOpenData(params),
                activeSources.includes('doh') ? searchDOHFacilities(odCounties) : Promise.resolve([]),
                activeSources.includes('dmv') ? searchDMVDealers(odCounties) : Promise.resolve([]),
                activeSources.includes('ocfs') ? searchOCFSChildcare(odCounties) : Promise.resolve([]),
            ]);

            // Fetch DOB intent signals for NYC boroughs
            const plutoBoroughs = odCounties.filter(c => AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'pluto'));
            let dobIntents: IntentSignal[] = [];
            if (activeSources.includes('dob_permits') && plutoBoroughs.length > 0) {
                dobIntents = await searchDOBPermits(plutoBoroughs);
            }

            // Merge all enrichment matches
            const allEnrichments = [...enrichResults[0], ...enrichResults[1], ...enrichResults[2]] as EnrichmentMatch[];
            setEnrichments(allEnrichments);
            setIntentSignals(dobIntents);

            setOdOffset(newOffset);
            setOdTotalCount(result.totalCount);
            setOdHasMore(result.hasMore);

            // Dedupe
            const existingIds = new Set(activeCampaign.properties.map(p => p.sourceId));
            const uniqueNew = result.properties.filter(p => !existingIds.has(p.sourceId));

            if (uniqueNew.length > 0) {
                const countyLabels = odCounties.map(c => AVAILABLE_COUNTIES.find(ac => ac.value === c)?.label || c);
                onSearchResults(activeCampaign.id, uniqueNew, {
                    query: `Open Data: ${countyLabels.join(', ')}`,
                    location: odMunicipality || countyLabels.join(', '),
                    sourced: result.totalCount,
                });
            }

            if (activeCampaign.label === 'New Campaign') {
                const countyLabels = odCounties.map(c => AVAILABLE_COUNTIES.find(ac => ac.value === c)?.label || c);
                onRenameCampaign(activeCampaign.id, `Open Data\n${countyLabels.join(', ')}\nNY`);
            }

            const page = Math.floor(newOffset / OD_PAGE_SIZE) + 1;
            const totalPages = Math.ceil(result.totalCount / OD_PAGE_SIZE);
            const enrichCount = allEnrichments.length;
            const intentCount = dobIntents.length;
            setSearchMessage(`${result.totalCount.toLocaleString()} total · Page ${page}/${totalPages} · ${uniqueNew.length} new · ${enrichCount} licensing matches · ${intentCount} intent signals`);
        } catch (error: any) {
            console.error('Open Data error:', error);
            setSearchMessage(`Error: ${error.message || 'Failed to fetch'}`);
        } finally { setLoading(false); }
    };

    // Unified search dispatcher
    const handleSearch = () => {
        if (searchSource === 'opendata') handleOpenDataSearch(0);
        else handleGoogleSearch();
    };

    // Toggle an Open Data county
    const toggleOdCounty = (county: string) => {
        setOdCounties(prev => prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county]);
    };

    // Toggle an Open Data property class
    const toggleOdClass = (code: string) => {
        setOdClasses(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    // Toggle a PLUTO building class
    const toggleOdPlutoClass = (code: string) => {
        setOdPlutoClasses(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    // Detect which source types are selected
    const hasNYStateCounty = odCounties.some(c => AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'nystate'));
    const hasPlutoBorough = odCounties.some(c => AVAILABLE_COUNTIES.find(ac => ac.value === c && ac.source === 'pluto'));

    // Infer XIRI facility type from Google Places types + search query
    function inferFacilityType(types: string[], searchQuery: string): string {
        const q = searchQuery.toLowerCase();
        const t = types.map(t => t.toLowerCase());

        if (t.includes('doctor') || t.includes('health') || t.includes('hospital') ||
            q.includes('medical') || q.includes('urgent care') || q.includes('clinic') ||
            q.includes('doctor') || q.includes('physician')) {
            return 'medical_urgent_care';
        }
        if (q.includes('surgery') || q.includes('surgical') || q.includes('ambulatory')) {
            return 'medical_surgery';
        }
        if (q.includes('dialysis')) return 'medical_dialysis';
        if (q.includes('dentist') || q.includes('dental') || q.includes('orthodont')) return 'medical_private';
        if (t.includes('car_dealer') || q.includes('auto dealer') || q.includes('dealership')) {
            return 'auto_dealer_showroom';
        }
        if (t.includes('car_repair') || q.includes('auto service') || q.includes('body shop')) {
            return 'auto_service_center';
        }
        if (t.includes('gym') || q.includes('gym') || q.includes('fitness')) return 'fitness_gym';
        if (q.includes('daycare') || q.includes('childcare')) return 'edu_daycare';
        if (q.includes('school') || q.includes('academy')) return 'edu_private_school';
        return 'office_general';
    }

    return (
        <div className="h-full flex">
            {/* Left Panel: Tabs + Table */}
            <Card className={`border border-border bg-card shadow-sm flex flex-col transition-all duration-200 ${selectedPreviewProperty ? 'w-[55%] min-w-[420px]' : 'w-full'}`}>
                {/* Tab Strip */}
                <div className="flex items-center border-b border-border bg-muted/50 overflow-x-auto flex-shrink-0">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 flex-1 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mr-1.5" />
                        {campaigns.map((campaign) => {
                            const activeCount = campaign.properties.filter(p => !p.isDismissed).length;
                            const labelLines = campaign.label.split('\n');
                            const isStructured = labelLines.length >= 2;
                            return (
                                <div key={campaign.id}
                                    className={`group flex items-start gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer text-xs font-medium transition-all
                                        ${campaign.id === activeCampaign.id
                                            ? 'bg-card text-primary border border-b-0 border-border shadow-sm -mb-px'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                    onClick={() => handleTabSwitch(campaign.id)}>
                                    {isStructured ? (
                                        <div className="flex flex-col leading-tight min-w-0">
                                            <span className="text-[11px] font-semibold">{labelLines[0]}</span>
                                            <span className="text-[10px] font-normal text-muted-foreground">{labelLines[1]}</span>
                                            {labelLines[2] && <span className="text-[9px] font-normal text-muted-foreground/70">{labelLines[2]}</span>}
                                        </div>
                                    ) : (
                                        <span className="truncate">{campaign.label}</span>
                                    )}
                                    {activeCount > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 mt-0.5">{activeCount}</Badge>}
                                    <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0 ml-0.5 mt-0.5"
                                        onClick={(e) => { e.stopPropagation(); setShowCloseTabDialog(campaign.id); }}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                        <button onClick={onNewCampaign} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-0.5" title="New Campaign">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 whitespace-nowrap">Preview</Badge>
                        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-muted rounded transition-colors">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Search Bar — dual source */}
                        <div className="px-3 py-2 border-b border-border bg-muted/30 relative flex-shrink-0">
                            {loading && (<div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden"><div className="h-full bg-blue-600 animate-progress-indeterminate"></div></div>)}

                            {/* Source Toggle */}
                            <div className="flex items-center gap-1 mb-2">
                                <button
                                    onClick={() => setSearchSource('opendata')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${searchSource === 'opendata'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted'
                                        }`}>
                                    <Database className="w-3 h-3" /> NY Open Data
                                </button>
                                <button
                                    onClick={() => setSearchSource('google')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${searchSource === 'google'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted'
                                        }`}>
                                    <Globe className="w-3 h-3" /> Google Maps
                                </button>
                            </div>

                            {/* Google Maps Search */}
                            {searchSource === 'google' && (
                                <div className="flex gap-2 items-center">
                                    <Input type="text" placeholder="Property type (e.g. urgent care)..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs bg-white dark:bg-card flex-1" disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                    <ReactGoogleAutocomplete
                                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                        onPlaceSelected={(place) => { if (place && (place.formatted_address || place.name)) { setLocation(place.formatted_address || place.name || ''); } }}
                                        options={{ types: ['geocode'], componentRestrictions: { country: 'us' } }}
                                        placeholder="Location..."
                                        className="flex h-7 w-full rounded-md border border-input bg-white dark:bg-card px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 flex-1"
                                        onChange={(e: any) => setLocation(e.target.value)} value={location} disabled={loading}
                                    />
                                    <Button onClick={handleSearch} disabled={loading} size="sm" className="h-7 text-xs px-3 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white">
                                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Rocket className="mr-1 h-3 w-3" /> Search</>}
                                    </Button>
                                </div>
                            )}

                            {/* Open Data Search */}
                            {searchSource === 'opendata' && (
                                <div className="space-y-2">
                                    {/* Row 1: County + Property Class dropdowns */}
                                    <div className="flex gap-2 items-center flex-wrap">
                                        {/* County Multi-Select */}
                                        <MultiSelectDropdown
                                            label="County / Borough"
                                            options={AVAILABLE_COUNTIES.map(c => ({ value: c.value, label: c.label }))}
                                            selected={odCounties}
                                            onChange={setOdCounties}
                                            placeholder="Select counties..."
                                            color="emerald"
                                            disabled={loading}
                                        />

                                        {/* LI Property Class Multi-Select */}
                                        {hasNYStateCounty && (
                                            <MultiSelectDropdown
                                                label="LI Property Class"
                                                options={PROPERTY_CLASS_OPTIONS.map(pc => ({ value: pc.code, label: `${pc.code} — ${pc.label}` }))}
                                                selected={odClasses}
                                                onChange={setOdClasses}
                                                placeholder="Select classes..."
                                                color="blue"
                                                disabled={loading}
                                                quickFill={{ label: '↺ Recommended', values: [...RECOMMENDED_CODES] }}
                                            />
                                        )}

                                        {/* NYC Building Class Multi-Select */}
                                        {hasPlutoBorough && (
                                            <MultiSelectDropdown
                                                label="NYC Building Class"
                                                options={PLUTO_BLDG_CLASS_OPTIONS.map(pc => ({ value: pc.code, label: `${pc.code} — ${pc.label}` }))}
                                                selected={odPlutoClasses}
                                                onChange={setOdPlutoClasses}
                                                placeholder="Select classes..."
                                                color="purple"
                                                disabled={loading}
                                                quickFill={{ label: '↺ Recommended', values: [...RECOMMENDED_PLUTO_CODES] }}
                                            />
                                        )}

                                        <Input
                                            type="text" placeholder="Town (optional)..."
                                            value={odMunicipality} onChange={(e) => setOdMunicipality(e.target.value)}
                                            className="h-7 text-[10px] bg-white dark:bg-card w-32"
                                            disabled={loading}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>

                                    {/* Row 3: Lot Size + Search */}
                                    <div className="flex gap-2 items-center">
                                        <span className="text-[10px] text-muted-foreground font-medium w-12 flex-shrink-0">Lot ft²</span>
                                        <Input type="number" placeholder="Min" value={odMinSqFt} onChange={(e) => setOdMinSqFt(e.target.value)}
                                            className="h-6 text-[10px] bg-white dark:bg-card w-20" disabled={loading} />
                                        <span className="text-[10px] text-muted-foreground">–</span>
                                        <Input type="number" placeholder="Max" value={odMaxSqFt} onChange={(e) => setOdMaxSqFt(e.target.value)}
                                            className="h-6 text-[10px] bg-white dark:bg-card w-20" disabled={loading} />
                                        <div className="flex-1" />
                                        <Button onClick={handleSearch} disabled={loading} size="sm" className="h-7 text-xs px-3 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white">
                                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Database className="mr-1 h-3 w-3" /> Search Open Data</>}
                                        </Button>
                                    </div>

                                    {/* Pagination */}
                                    {odTotalCount !== null && (
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[10px] text-muted-foreground">
                                                {odTotalCount.toLocaleString()} properties · Showing {odOffset + 1}–{Math.min(odOffset + OD_PAGE_SIZE, odTotalCount)}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" disabled={odOffset === 0 || loading}
                                                    onClick={() => handleOpenDataSearch(Math.max(0, odOffset - OD_PAGE_SIZE))}>
                                                    <ChevronLeft className="w-3 h-3" /> Prev
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" disabled={!odHasMore || loading}
                                                    onClick={() => handleOpenDataSearch(odOffset + OD_PAGE_SIZE)}>
                                                    Next <ChevronRight className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {searchMessage && <p className={`text-[10px] mt-1 ${searchMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{searchMessage}</p>}
                        </div>

                        {/* Bulk Bar */}
                        {properties.length > 0 && (
                            <div className="px-3 py-1.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
                                {/* Filter buttons */}
                                <div className="flex items-center gap-1">
                                    {[
                                        { key: 'all' as FilterMode, label: 'All', count: rawProperties.length },
                                        { key: 'enriched' as FilterMode, label: '📋 Enriched', count: scoredProperties.filter(s => s.enrichMatch).length },
                                        { key: 'intent' as FilterMode, label: '🔥 Intent', count: scoredProperties.filter(s => s.intentMatch).length },
                                        { key: 'nnn' as FilterMode, label: 'NNN', count: scoredProperties.filter(s => s.property.tenantCount === 1).length },
                                    ].map(f => (
                                        <button key={f.key} onClick={() => setFilterMode(f.key)}
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium border transition-all ${filterMode === f.key
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/50'
                                                }`}>
                                            {f.label}{f.count > 0 && f.key !== 'all' ? ` (${f.count})` : ''}
                                        </button>
                                    ))}
                                </div>
                                {/* Sort + bulk info */}
                                <div className="flex items-center gap-2">
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortField)}
                                        className="text-[10px] h-5 border border-border rounded bg-transparent px-1 text-muted-foreground">
                                        <option value="score">★ Best Fit</option>
                                        <option value="name">A–Z Name</option>
                                        <option value="default">Default</option>
                                    </select>
                                    <span className="text-[10px] text-muted-foreground">
                                        {selectedProperties.size > 0
                                            ? <span className="font-medium text-primary">{selectedProperties.size} selected</span>
                                            : <>{activeProperties.length} active{dismissedCount > 0 && ` · ${dismissedCount} dismissed`}</>
                                        }
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {selectedProperties.size > 0 ? (
                                            <>
                                                <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => setShowBulkApproveDialog(true)}>
                                                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve ({selectedProperties.size})
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-600 px-2" onClick={() => setShowBulkDismissDialog(true)}>
                                                    <XCircle className="w-3 h-3 mr-0.5" /> ✕
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => onApproveAll(activeCampaign.id)}>
                                                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve All
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-600 px-2" onClick={() => onDismissAll(activeCampaign.id)}>
                                                    <XCircle className="w-3 h-3 mr-0.5" /> Dismiss All
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Property List — compact rows */}
                        {properties.length > 0 && (
                            <div className="flex-1 overflow-y-auto">
                                {properties.map((property, index) => {
                                    const dismissed = property.isDismissed;
                                    const isSelected = property.id === selectedPropertyId;
                                    const enrichMatch = matchEnrichmentToProperty(property, enrichments);
                                    const intentMatch = matchIntentToProperty(property, intentSignals);
                                    const score = scoreMap.get(property.id!);
                                    return (
                                        <div
                                            key={property.id || index}
                                            className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer transition-colors text-xs
                                                ${isSelected ? 'bg-primary/10 border-primary/30' : ''}
                                                ${dismissed ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/50'}
                                                ${!isSelected && !dismissed ? 'border-border' : ''}
                                                ${dismissed ? 'border-border/50' : ''}
                                            `}
                                            onClick={() => setSelectedPropertyId(property.id === selectedPropertyId ? null : property.id!)}
                                        >
                                            {/* Checkbox */}
                                            <div onClick={(e) => e.stopPropagation()}>
                                                {!dismissed && <Checkbox checked={selectedProperties.has(property.id!)} onCheckedChange={(checked: boolean) => handleSelectProperty(property.id!, checked)} className="h-3.5 w-3.5" />}
                                            </div>

                                            {/* Score Badge */}
                                            {score && !dismissed && (
                                                <span className={`text-[9px] font-bold w-6 text-center flex-shrink-0 rounded px-0.5 py-0.5 ${score.total >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                                                    score.total >= 45 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                                    }`}>
                                                    {score.total}
                                                </span>
                                            )}
                                            {dismissed && <span className="w-6 flex-shrink-0" />}

                                            {/* Name + Location + Enrichment */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-medium truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                                                        {enrichMatch ? toTitleCase(enrichMatch.facilityName) : toTitleCase(property.name || '')}
                                                    </span>
                                                    {enrichMatch && (
                                                        <Badge variant="default" className={`text-[8px] px-1 py-0 h-3.5 flex-shrink-0 ${enrichMatch.source === 'doh' ? 'bg-emerald-600' :
                                                            enrichMatch.source === 'dmv' ? 'bg-orange-600' :
                                                                enrichMatch.source === 'ocfs' ? 'bg-purple-600' : 'bg-blue-600'
                                                            }`}>
                                                            {enrichMatch.source === 'doh' ? '📋 DOH' :
                                                                enrichMatch.source === 'dmv' ? '🚘 DMV' :
                                                                    enrichMatch.source === 'ocfs' ? '🧒 OCFS' : '✓'}
                                                        </Badge>
                                                    )}
                                                    {intentMatch && (
                                                        <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-amber-600 flex-shrink-0">
                                                            🔥 Permit
                                                        </Badge>
                                                    )}
                                                    {dismissed && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-amber-300 text-amber-500 flex-shrink-0 leading-tight">Dismissed</Badge>}
                                                    {property.tenantCount === 1 && !dismissed && (
                                                        <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-emerald-600 flex-shrink-0">NNN</Badge>
                                                    )}
                                                </div>
                                                {/* Owner (from assessment) + enrichment details */}
                                                {enrichMatch && enrichMatch.operatorName && (
                                                    <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate">
                                                        <User className="w-2.5 h-2.5 inline mr-0.5" />
                                                        {enrichMatch.operatorName}
                                                        {enrichMatch.phone && (
                                                            <span className="ml-1.5 text-muted-foreground">
                                                                <Phone className="w-2 h-2 inline mr-0.5" />
                                                                {enrichMatch.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <span className="flex items-center gap-0.5 truncate">
                                                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                                        {property.city && property.state ? `${property.city}, ${property.state}` : property.address || 'N/A'}
                                                    </span>
                                                    {property.squareFootage && (
                                                        <span className="flex items-center gap-0.5 flex-shrink-0">
                                                            <Ruler className="w-2.5 h-2.5" />
                                                            {property.squareFootage.toLocaleString()} ft²
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Property Type Tag */}
                                            <Badge variant="outline" className={`text-[9px] px-1.5 flex-shrink-0 ${property.propertyType === 'medical_office' ? 'border-blue-300 text-blue-600' : property.propertyType === 'auto_dealership' ? 'border-orange-300 text-orange-600' : ''}`}>
                                                {property.propertyType?.replace(/_/g, ' ') || 'Commercial'}
                                            </Badge>

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {dismissed ? (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-600 px-1.5" onClick={() => onRevive(activeCampaign.id, property.id!)}>
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600 hover:bg-green-50" onClick={() => onApprove(activeCampaign.id, property.id!)} title="Approve to CRM">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50" onClick={() => onDismiss(activeCampaign.id, property.id!)} title="Dismiss">
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Empty state */}
                        {properties.length === 0 && !loading && (
                            <div className="flex-1 flex flex-col items-center justify-center py-12">
                                <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">Search for commercial properties</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Try &quot;urgent care&quot; or &quot;auto dealership&quot; + a location</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Right Panel: Property Detail */}
            {selectedPreviewProperty && (
                <div className="w-[45%] h-full">
                    <PropertyDetailPanel
                        property={selectedPreviewProperty}
                        campaignId={activeCampaign.id}
                        onClose={() => setSelectedPropertyId(null)}
                        onApprove={onApprove}
                        onDismiss={onDismiss}
                        onRevive={onRevive}
                        enrichMatch={matchEnrichmentToProperty(selectedPreviewProperty, enrichments)}
                        intentMatch={matchIntentToProperty(selectedPreviewProperty, intentSignals)}
                    />
                </div>
            )}

            {/* Dialogs */}
            <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>✅ Approve {selectedProperties.size} Propert{selectedProperties.size > 1 ? 'ies' : 'y'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            They&apos;ll be added to the Sales CRM as new leads.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700 text-white">Approve</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showBulkDismissDialog} onOpenChange={setShowBulkDismissDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dismiss {selectedProperties.size} Propert{selectedProperties.size > 1 ? 'ies' : 'y'}?</AlertDialogTitle>
                        <AlertDialogDescription>They&apos;ll be blacklisted and shown grayed out in future campaigns.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDismiss} className="bg-red-600 hover:bg-red-700 text-white">Dismiss</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!showCloseTabDialog} onOpenChange={() => setShowCloseTabDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Close Campaign Tab?</AlertDialogTitle>
                        <AlertDialogDescription>This will discard the preview. Properties are not blacklisted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmCloseTab} className="bg-slate-600 hover:bg-slate-700 text-white">Close Tab</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
