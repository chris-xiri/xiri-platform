'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { PreviewProperty } from '@xiri/shared';
import ReactGoogleAutocomplete from 'react-google-autocomplete';

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
function PropertyDetailPanel({ property, onClose, onApprove, onDismiss, onRevive, campaignId }: {
    property: CampaignPreviewProperty;
    onClose: () => void;
    onApprove: (campaignId: string, propertyId: string) => void;
    onDismiss: (campaignId: string, propertyId: string) => void;
    onRevive: (campaignId: string, propertyId: string) => void;
    campaignId: string;
}) {
    const dismissed = property.isDismissed;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden animate-in slide-in-from-right-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                        {property.name}
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
                                    <span className="font-medium">{property.ownerName}</span>
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
    const properties = activeCampaign?.properties || [];
    const activeProperties = properties.filter(p => !p.isDismissed);
    const dismissedCount = properties.filter(p => p.isDismissed).length;
    const selectedPreviewProperty = selectedPropertyId ? properties.find(p => p.id === selectedPropertyId) : null;

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
    const handleSearch = async () => {
        if (!query.trim() || !location.trim()) { setSearchMessage('Please fill in both fields'); return; }
        setLoading(true); setSearchMessage('');

        try {
            // Use Google Maps Places Text Search (loaded via react-google-autocomplete)
            if (!window.google?.maps?.places) {
                throw new Error('Google Maps API not loaded. Check your NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.');
            }

            const service = new window.google.maps.places.PlacesService(
                document.createElement('div') // headless — no map required
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

            // Map Google Places results → CampaignPreviewProperty
            const newProperties: CampaignPreviewProperty[] = results.map((place, i) => {
                const addressParts = (place.formatted_address || '').split(',').map(s => s.trim());
                const street = addressParts[0] || '';
                const city = addressParts[1] || '';
                const stateZip = addressParts[2] || '';
                const [state = '', zip = ''] = stateZip.split(' ').filter(Boolean);

                return {
                    id: `gmap_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                    name: place.name || 'Unknown Business',
                    address: street,
                    city,
                    state,
                    zip,
                    propertyType: inferFacilityType(place.types || [], query),
                    source: 'google_maps',
                    sourceId: place.place_id || '',
                    tenantName: place.name || '',
                    tenantCount: 1, // Google Places returns individual businesses = single tenant
                    ownerPhone: '', // Not available from Places API basic search
                    ownerName: '',
                    isDismissed: false,
                    // Enrichment fields from Google
                    facilityType: inferFacilityType(place.types || [], query),
                };
            });

            // Dedupe against existing properties in campaign (by address)
            const existingAddresses = new Set(activeCampaign.properties.map(p => (p.address || '').toLowerCase().trim()));
            const uniqueNew = newProperties.filter(p => !existingAddresses.has((p.address || '').toLowerCase().trim()));

            if (uniqueNew.length > 0) {
                onSearchResults(activeCampaign.id, uniqueNew, { query, location, sourced: results.length });
            }

            // Auto-rename campaign from "New Campaign" to query+location
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
                        {/* Search Bar */}
                        <div className="px-3 py-2 border-b border-border bg-muted/30 relative flex-shrink-0">
                            {loading && (<div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden"><div className="h-full bg-blue-600 animate-progress-indeterminate"></div></div>)}
                            <div className="flex gap-2 items-center">
                                <Input type="text" placeholder="Property type (e.g. urgent care, auto dealer)..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs bg-white dark:bg-card flex-1" disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
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
                            {searchMessage && <p className={`text-[10px] mt-1 ${searchMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{searchMessage}</p>}
                        </div>

                        {/* Bulk Bar */}
                        {properties.length > 0 && (
                            <div className="px-3 py-1.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
                                <span className="text-[11px] text-muted-foreground">
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
                        )}

                        {/* Property List — compact rows */}
                        {properties.length > 0 && (
                            <div className="flex-1 overflow-y-auto">
                                {properties.map((property, index) => {
                                    const dismissed = property.isDismissed;
                                    const isSelected = property.id === selectedPropertyId;
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

                                            {/* Index */}
                                            <span className="text-muted-foreground w-4 text-center flex-shrink-0">{index + 1}</span>

                                            {/* Name + Location */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-medium truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                                                        {property.name}
                                                    </span>
                                                    {dismissed && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-amber-300 text-amber-500 flex-shrink-0 leading-tight">Dismissed</Badge>}
                                                    {property.tenantCount === 1 && !dismissed && (
                                                        <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-emerald-600 flex-shrink-0">NNN</Badge>
                                                    )}
                                                </div>
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
