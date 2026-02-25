)) 'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
    CheckCircle2, XCircle, Eye, ChevronDown, ChevronUp, ExternalLink, Phone, Globe, MapPin, X, RotateCcw, Plus, Rocket, Loader2, Search, Zap, ShieldCheck, Database, Star, Clock
} from 'lucide-react';
import { Vendor } from '@xiri/shared';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import ReactGoogleAutocomplete from 'react-google-autocomplete';
import MultiSelectDropdown from '@/components/ui/multi-select-dropdown';
import { AVAILABLE_COUNTIES } from '@/lib/openDataSearch';
import { enrichWithGooglePlaces, type PlacesEnrichment } from '@/lib/googlePlaces';

export interface PreviewVendor extends Vendor {
    isDismissed?: boolean;
}

export interface Campaign {
    id: string;
    label: string;
    vendors: PreviewVendor[];
    searches: { query: string; location: string; sourced: number; qualified: number; timestamp: Date }[];
}

interface CampaignResultsTableProps {
    campaigns: Campaign[];
    activeCampaignId: string | null;
    onSetActiveCampaign: (id: string) => void;
    onNewCampaign: () => void;
    onCloseCampaign: (id: string) => void;
    onSearchResults: (campaignId: string, vendors: PreviewVendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => void;
    onApprove: (campaignId: string, vendorId: string, track: 'STANDARD' | 'FAST_TRACK') => void;
    onDismiss: (campaignId: string, vendorId: string) => void;
    onRevive: (campaignId: string, vendorId: string) => void;
    onApproveAll: (campaignId: string, track: 'STANDARD' | 'FAST_TRACK') => void;
    onDismissAll: (campaignId: string) => void;
    onRenameCampaign: (campaignId: string, newLabel: string) => void;
}

/* ─── Vendor Detail Panel (right-side preview) ─── */
function VendorDetailPanel({ vendor, onClose, onApprove, onDismiss, onRevive, campaignId }: {
    vendor: PreviewVendor;
    onClose: () => void;
    onApprove: (campaignId: string, vendorId: string, track: 'STANDARD' | 'FAST_TRACK') => void;
    onDismiss: (campaignId: string, vendorId: string) => void;
    onRevive: (campaignId: string, vendorId: string) => void;
    campaignId: string;
}) {
    const dismissed = vendor.isDismissed;
    const [placesData, setPlacesData] = useState<PlacesEnrichment | null>(null);
    const [placesLoading, setPlacesLoading] = useState(false);

    useEffect(() => {
        if (!vendor.address && !vendor.city && !vendor.businessName) return;
        setPlacesLoading(true);
        setPlacesData(null);
        enrichWithGooglePlaces(vendor.address, vendor.city, vendor.state, vendor.businessName)
            .then(data => setPlacesData(data))
            .catch(err => console.error('Places enrichment failed:', err))
            .finally(() => setPlacesLoading(false));
    }, [vendor.id, vendor.address, vendor.city, vendor.state, vendor.businessName]);

    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const addressStr = vendor.address
        ? `${vendor.address}, ${vendor.city || ''}, ${vendor.state || ''}`
        : `${vendor.businessName || ''} ${vendor.city || ''}, ${vendor.state || ''}`;
    const uriEncodedAddress = encodeURIComponent(addressStr);
    const streetViewUrl = mapsApiKey && uriEncodedAddress ? `https://maps.googleapis.com/maps/api/streetview?size=400x160&location=${uriEncodedAddress}&key=${mapsApiKey}` : null;
    const mapUrl = mapsApiKey && uriEncodedAddress ? `https://maps.googleapis.com/maps/api/staticmap?center=${uriEncodedAddress}&zoom=15&size=400x160&markers=color:red%7C${uriEncodedAddress}&key=${mapsApiKey}` : null;


    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden animate-in slide-in-from-right-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                        {placesData?.name || vendor.businessName}
                    </h3>
                    {/* Show registered entity name when Google found a different DBA */}
                    {placesData?.name && vendor.businessName &&
                        placesData.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== vendor.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                                Registered as: {vendor.businessName}
                            </p>
                        )}
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                            {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}
                        </p>
                        {vendor.dcaCategory && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-none flex-shrink-0 capitalize">
                                NY Open Data
                            </Badge>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Image Strip: Street View + Map Map */}
            {mapsApiKey && streetViewUrl && mapUrl && (
                <div className="grid grid-cols-2 h-28 flex-shrink-0 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={streetViewUrl} alt="Street view" className="w-full h-full object-cover border-r border-background/20" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mapUrl} alt="Map view" className="w-full h-full object-cover" />
                </div>
            )}


            {/* Info + Actions */}
            <div className="p-3 space-y-3 border-b border-border flex-shrink-0 bg-muted/5 flex-1 overflow-y-auto">
                {/* AI Analysis */}
                <Card className="bg-card border-secondary/20 shadow-sm">
                    <CardHeader className="py-2 px-3 pb-1">
                        <CardTitle className="text-xs font-medium flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-yellow-500 fill-current" /> AI Analysis
                            </span>
                            <span className={`font-bold text-sm ${(vendor.fitScore || 0) > 70 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                {vendor.fitScore || 0}/100
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2 my-1.5 leading-tight">
                            "{vendor.aiReasoning || 'No reasoning available.'}"
                        </p>
                        {vendor.capabilities && vendor.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {vendor.capabilities.map((cap, i) => (
                                    <Badge key={i} variant="outline" className="text-[9px] h-4 px-1 py-0 font-normal">{cap}</Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* DCA Licensing Data Card (if available) */}
                {vendor.dcaCategory && (
                    <Card className="bg-card border-slate-300 dark:border-slate-600 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-emerald-500" /> Licensing Data
                                </span>
                                <Badge variant="default" className="text-[9px] px-1.5 h-4 bg-emerald-600">
                                    NYC DCA Verified
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <span className="font-medium text-foreground">{vendor.dcaCategory}</span>
                            </div>
                            {vendor.phone && (
                                <a href={`tel:${vendor.phone}`} className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                    <Phone className="w-3 h-3 flex-shrink-0" /> {vendor.phone}
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Google Business Card */}
                {placesLoading && (
                    <Card className="bg-card border-secondary/20 shadow-sm">
                        <CardContent className="px-3 py-3 space-y-2">
                            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                            <div className="h-2 w-48 bg-muted rounded animate-pulse" />
                            <div className="h-2 w-24 bg-muted rounded animate-pulse" />
                        </CardContent>
                    </Card>
                )}

                {placesData && (
                    <Card className="bg-card border-blue-200 dark:border-blue-800 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-blue-500" /> Google Business
                                </span>
                                {placesData.openNow !== undefined && (
                                    <Badge variant="default" className={`text-[9px] px-1.5 h-4 ${placesData.openNow ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                        {placesData.openNow ? 'Open Now' : 'Closed'}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-2">
                            {/* Rating */}
                            {(placesData.rating || vendor.rating) && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(star => {
                                            const rating = placesData.rating || vendor.rating || 0;
                                            return <Star key={star} className={`w-3 h-3 ${star <= Math.round(rating) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />;
                                        })}
                                    </div>
                                    <span className="font-medium">{placesData.rating || vendor.rating}</span>
                                    {(placesData.ratingCount || vendor.totalRatings) && (
                                        <span className="text-muted-foreground">({(placesData.ratingCount || vendor.totalRatings)?.toLocaleString()} reviews)</span>
                                    )}
                                </div>
                            )}

                            {/* Links (Phone / Website / Map) */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {(placesData.phone || vendor.phone) && (
                                    <a href={`tel:${placesData.phone || vendor.phone}`} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                        <Phone className="w-3 h-3 flex-shrink-0" /> {placesData.phone || vendor.phone}
                                    </a>
                                )}
                                {(placesData.website || vendor.website) && (
                                    <a href={placesData.website || vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                        <Globe className="w-3 h-3 flex-shrink-0" /> Website
                                    </a>
                                )}
                                {(placesData.googleMapsUrl) && (
                                    <a href={placesData.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                        <MapPin className="w-3 h-3 flex-shrink-0" /> Open in Maps
                                    </a>
                                )}
                            </div>

                            {/* Hours Grid */}
                            {placesData.weekdayHours && placesData.weekdayHours.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border">
                                    <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Hours
                                    </div>
                                    <div className="grid grid-cols-1 gap-0.5 ml-4.5">
                                        {placesData.weekdayHours.map((hourStr, i) => {
                                            const [day, ...times] = hourStr.split(':');
                                            const isToday = i === ((new Date().getDay() + 6) % 7);
                                            return (
                                                <div key={i} className={`flex justify-between text-[10px] ${isToday ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                                    <span>{day}:</span>
                                                    <span>{times.join(':').trim()}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Google Photos (Static API fallback logic handled inside Places) */}
                            {placesData.photoUrls && placesData.photoUrls.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border">
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        {placesData.photoUrls.map((url, i) => (
                                            <a key={i} href={placesData.googleMapsUrl || placesData.website || '#'} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={url} alt="Business photo" className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Legacy Fallback for Phone/Web if no Google Places match AND not DCA (DCA has it's own card) */}
                {!placesLoading && !placesData && !vendor.dcaCategory && (vendor.phone || vendor.website) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-card p-3 rounded-md border border-border shadow-sm text-xs">
                        {vendor.phone && (
                            <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {vendor.phone}
                            </a>
                        )}
                        {vendor.website && (
                            <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                                <Globe className="w-3.5 h-3.5 flex-shrink-0" /> Website
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons (Sticky Bottom) */}
            <div className="p-3 bg-muted/30 border-t border-border flex-shrink-0">
                {dismissed ? (
                    <Button onClick={() => onRevive(campaignId, vendor.id!)} className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                        <RotateCcw className="w-3 h-3 mr-1" /> Revive Vendor
                    </Button>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <Button onClick={() => onApprove(campaignId, vendor.id!, 'FAST_TRACK')}
                                className="bg-orange-500 hover:bg-orange-600 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                                <span className="flex items-center font-bold"><Zap className="w-3.5 h-3.5 mr-1 fill-current" /> Urgent Needs</span>
                                <span className="text-[9px] opacity-90 font-normal leading-tight">Fast-track onboarding</span>
                            </Button>
                            <Button onClick={() => onApprove(campaignId, vendor.id!, 'STANDARD')}
                                className="bg-green-600 hover:bg-green-700 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                                <span className="flex items-center font-bold"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Standard</span>
                                <span className="text-[9px] opacity-90 font-normal leading-tight">Add to pipeline</span>
                            </Button>
                        </div>
                        <Button onClick={() => onDismiss(campaignId, vendor.id!)}
                            variant="default" size="sm"
                            className="w-full bg-red-600 hover:bg-red-700 text-white h-7 text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function CampaignResultsTable({
    campaigns, activeCampaignId, onSetActiveCampaign, onNewCampaign,
    onCloseCampaign, onSearchResults, onApprove, onDismiss, onRevive,
    onApproveAll, onDismissAll, onRenameCampaign,
}: CampaignResultsTableProps) {
    const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(true);
    const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
    const [showBulkDismissDialog, setShowBulkDismissDialog] = useState(false);
    const [showCloseTabDialog, setShowCloseTabDialog] = useState<string | null>(null);
    const [bulkTrack, setBulkTrack] = useState<'STANDARD' | 'FAST_TRACK'>('STANDARD');
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

    // Search state
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [searchSource, setSearchSource] = useState<'google' | 'opendata'>('opendata');
    const [odCounties, setOdCounties] = useState<string[]>([]);
    const [odMunicipality, setOdMunicipality] = useState('');

    // Legacy state for SODA fallback categorization - we'll keep the variable but it's optional
    const [dcaCategory, setDcaCategory] = useState<string>('');
    const [dcaCategories, setDcaCategories] = useState<{ name: string; count: number }[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    // Fetch DCA categories when NYC Open Data is selected (Optional advanced filter)
    useEffect(() => {
        if (searchSource === 'opendata' && dcaCategories.length === 0) {
            setLoadingCategories(true);
            const url = new URL('https://data.cityofnewyork.us/resource/w7w3-xahh.json');
            url.searchParams.set('$select', 'business_category, count(*) as cnt');
            url.searchParams.set('$group', 'business_category');
            url.searchParams.set('$order', 'cnt DESC');
            url.searchParams.set('$limit', '100');
            url.searchParams.set('$where', "license_status='Active'");
            fetch(url.toString())
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setDcaCategories(data.map((d: any) => ({ name: d.business_category, count: parseInt(d.cnt) })));
                    }
                })
                .catch(err => console.error('Failed to fetch DCA categories:', err))
                .finally(() => setLoadingCategories(false));
        }
    }, [searchSource, dcaCategories.length]);

    if (campaigns.length === 0) {
        return (
            <Card className="border-2 border-dashed border-border shadow-sm h-full">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
                    <Search className="w-10 h-10 text-muted-foreground/40" />
                    <div>
                        <p className="text-base font-medium text-foreground">Recruitment Campaigns</p>
                        <p className="text-sm text-muted-foreground mt-1">Create a campaign to source and evaluate vendors.<br />Approved vendors go directly to the CRM.</p>
                    </div>
                    <Button onClick={onNewCampaign} className="mt-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-4 h-4 mr-1.5" /> New Campaign
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];
    const vendors = activeCampaign?.vendors || [];
    const activeVendors = vendors.filter(v => !v.isDismissed).sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
    const dismissedCount = vendors.filter(v => v.isDismissed).length;
    const selectedPreviewVendor = selectedVendorId ? vendors.find(v => v.id === selectedVendorId) : null;

    const handleSelectAll = (checked: boolean) => {
        if (checked) { setSelectedVendors(new Set(activeVendors.map(v => v.id!))); }
        else { setSelectedVendors(new Set()); }
    };
    const handleSelectVendor = (vendorId: string, checked: boolean) => {
        const s = new Set(selectedVendors);
        if (checked) { s.add(vendorId); } else { s.delete(vendorId); }
        setSelectedVendors(s);
    };

    const handleBulkApprove = () => { selectedVendors.forEach(id => onApprove(activeCampaign.id, id, bulkTrack)); setSelectedVendors(new Set()); setShowBulkApproveDialog(false); };
    const handleBulkDismiss = () => { selectedVendors.forEach(id => onDismiss(activeCampaign.id, id)); setSelectedVendors(new Set()); setShowBulkDismissDialog(false); };
    const confirmCloseTab = () => { if (showCloseTabDialog) { onCloseCampaign(showCloseTabDialog); setShowCloseTabDialog(null); setSelectedVendors(new Set()); setSelectedVendorId(null); } };

    const allSelected = activeVendors.length > 0 && selectedVendors.size === activeVendors.length;
    const getScoreColor = (score?: number) => { if (!score) return 'text-muted-foreground'; if (score >= 80) return 'text-green-600 dark:text-green-400'; if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'; return 'text-red-500 dark:text-red-400'; };
    const handleTabSwitch = (id: string) => { setSelectedVendors(new Set()); setSearchMessage(''); setSelectedVendorId(null); onSetActiveCampaign(id); };

    const handleSearch = async (overrideQuery?: string, overrideLocation?: string) => {
        const isGoogle = searchSource === 'google';

        let q = overrideQuery || query;
        let loc = overrideLocation || location;
        let provider: 'google_maps' | 'nyc_open_data' | 'all' = isGoogle ? 'google_maps' : 'nyc_open_data';

        if (!isGoogle) {
            if (odCounties.length === 0) { setSearchMessage('Select at least one county/borough'); return; }
            // For SODA, location is the comma separated counties if municipality is empty
            const countyLabels = odCounties.map(c => AVAILABLE_COUNTIES.find(ac => ac.value === c)?.label || c);
            loc = odMunicipality ? `${odMunicipality}, ${countyLabels.join(',')}` : countyLabels.join(', ');
        } else {
            if (!q.trim() || !loc.trim()) { setSearchMessage('Please fill in both fields'); return; }
        }

        setLoading(true); setSearchMessage('');
        try {
            const generateLeads = httpsCallable(functions, 'generateLeads', { timeout: 60000 });
            const result = await generateLeads({
                query: q || undefined,
                location: loc,
                hasActiveContract: false,
                previewOnly: true,
                provider,
                dcaCategory: isGoogle ? undefined : (dcaCategory || undefined)
            });
            const data = result.data as any;
            const newVendors: PreviewVendor[] = data.vendors || [];
            const sourced = data.sourced || 0;
            const qualified = data.analysis?.qualified || 0;
            const existingNames = new Set(activeCampaign.vendors.map(v => (v.businessName || '').toLowerCase().trim()));
            const uniqueNew = newVendors.filter(v => !existingNames.has((v.businessName || '').toLowerCase().trim()));
            if (uniqueNew.length > 0) { onSearchResults(activeCampaign.id, uniqueNew, { query: q || 'Open Data', location: loc, sourced, qualified }); }
            if (activeCampaign.label === 'New Campaign') {
                if (isGoogle && q.trim()) {
                    // Structured label: Trade\nTown\nState (rendered as 3 lines)
                    const locStr = loc.trim();
                    const parts = locStr.split(',').map(p => p.trim());
                    const town = parts[0] || locStr;
                    const state = parts.length >= 2 ? parts[1].replace(/\s*\d{5}.*/, '').trim() : '';
                    const tradeLabel = q.trim();
                    onRenameCampaign(activeCampaign.id, `${tradeLabel}\n${town}\n${state}`);
                } else if (!isGoogle) {
                    const countyLabels = odCounties.map(c => AVAILABLE_COUNTIES.find(ac => ac.value === c)?.label || c);
                    onRenameCampaign(activeCampaign.id, `${q || 'Contractors'}\n${countyLabels.join(', ')}\nNY`);
                }
            }
            setSearchMessage(`Found ${sourced} vendors · ${qualified} qualified · ${uniqueNew.length} new added`);
            if (isGoogle) { setQuery(''); setLocation(''); }
        } catch (error: any) {
            console.error('Error:', error);
            setSearchMessage(`Error: ${error.message || 'Failed to search'}`);
        } finally { setLoading(false); }
    };

    return (
        <div className="h-full flex">
            {/* Left Panel: Tabs + Table */}
            <Card className={`border border-border bg-card shadow-sm flex flex-col transition-all duration-200 ${selectedPreviewVendor ? 'w-[55%] min-w-[420px]' : 'w-full'}`}>
                {/* Tab Strip */}
                <div className="flex items-center border-b border-border bg-muted/50 overflow-x-auto flex-shrink-0">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 flex-1 min-w-0">
                        <Eye className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mr-1.5" />
                        {campaigns.map((campaign) => {
                            const activeCount = campaign.vendors.filter(v => !v.isDismissed).length;
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
                                    <Input type="text" placeholder="Trade (e.g. cleaning)..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs bg-white dark:bg-card flex-1 min-w-[150px]" disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                    <ReactGoogleAutocomplete
                                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                        onPlaceSelected={(place) => { if (place && (place.formatted_address || place.name)) { setLocation(place.formatted_address || place.name || ''); } }}
                                        options={{ types: ['geocode'], componentRestrictions: { country: 'us' } }}
                                        placeholder="Location..."
                                        className="flex h-7 w-full rounded-md border border-input bg-white dark:bg-card px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 flex-1 min-w-[150px]"
                                        onChange={(e: any) => setLocation(e.target.value)} value={location} disabled={loading}
                                    />
                                    <Button onClick={() => handleSearch()} disabled={loading} size="sm" className="h-7 text-xs px-3 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white">
                                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Rocket className="mr-1 h-3 w-3" /> Search</>}
                                    </Button>
                                </div>
                            )}

                            {/* Open Data Search */}
                            {searchSource === 'opendata' && (
                                <div className="space-y-2">
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <MultiSelectDropdown
                                            label="County / Borough"
                                            options={AVAILABLE_COUNTIES.map(c => ({ value: c.value, label: c.label }))}
                                            selected={odCounties}
                                            onChange={setOdCounties}
                                            placeholder="Select counties..."
                                            color="emerald"
                                            disabled={loading}
                                        />

                                        <Input type="text" placeholder="Town (optional)..."
                                            value={odMunicipality} onChange={(e) => setOdMunicipality(e.target.value)}
                                            className="h-7 text-[10px] bg-white dark:bg-card w-32"
                                            disabled={loading}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />

                                        <Input type="text" placeholder="Keyword (e.g. HVAC)..."
                                            value={query} onChange={(e) => setQuery(e.target.value)}
                                            className="h-7 text-[10px] bg-white dark:bg-card w-40"
                                            disabled={loading}
                                            title="Filters business names by keyword"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />

                                        <select
                                            value={dcaCategory}
                                            onChange={(e) => setDcaCategory(e.target.value)}
                                            className="h-7 rounded-md border border-input bg-white dark:bg-card px-2 py-1 text-[10px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-w-[180px]"
                                            disabled={loading || loadingCategories}
                                        >
                                            <option value="">{loadingCategories ? 'Loading...' : 'DCA: All Categories'}</option>
                                            {dcaCategories.map(c => (
                                                <option key={c.name} value={c.name}>
                                                    {c.name} ({c.count.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>

                                        <div className="flex-1" />
                                        <Button onClick={() => handleSearch()} disabled={loading} size="sm" className="h-7 text-xs px-3 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white">
                                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Database className="mr-1 h-3 w-3" /> Search Open Data</>}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {searchMessage && (
                                <div className="flex items-center gap-2 mt-1">
                                    <p className={`text-[10px] ${searchMessage.includes('Error') ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{searchMessage}</p>
                                    {!searchMessage.includes('Error') && activeCampaign.searches.length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 text-[10px] px-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                                            onClick={() => {
                                                const lastSearch = activeCampaign.searches[activeCampaign.searches.length - 1];
                                                handleSearch(lastSearch.query, lastSearch.location);
                                            }}
                                            disabled={loading}
                                        >
                                            <RotateCcw className="w-3 h-3 mr-0.5" /> Search Again
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bulk Bar */}
                        {vendors.length > 0 && (
                            <div className="px-3 py-1.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
                                <span className="text-[11px] text-muted-foreground">
                                    {selectedVendors.size > 0
                                        ? <span className="font-medium text-primary">{selectedVendors.size} selected</span>
                                        : <>{activeVendors.length} active{dismissedCount > 0 && ` · ${dismissedCount} dismissed`}</>
                                    }
                                </span>
                                <div className="flex items-center gap-1">
                                    {selectedVendors.size > 0 ? (
                                        <>
                                            <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => { setBulkTrack('STANDARD'); setShowBulkApproveDialog(true); }}>
                                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Std ({selectedVendors.size})
                                            </Button>
                                            <Button size="sm" className="h-6 text-[10px] bg-orange-500 hover:bg-orange-600 text-white px-2" onClick={() => { setBulkTrack('FAST_TRACK'); setShowBulkApproveDialog(true); }}>
                                                <Zap className="w-3 h-3 mr-0.5" /> Urg ({selectedVendors.size})
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-600 dark:text-red-400 px-2" onClick={() => setShowBulkDismissDialog(true)}>
                                                <XCircle className="w-3 h-3 mr-0.5" /> ✕
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => onApproveAll(activeCampaign.id, 'STANDARD')}>
                                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve All
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-600 dark:text-red-400 px-2" onClick={() => onDismissAll(activeCampaign.id)}>
                                                <XCircle className="w-3 h-3 mr-0.5" /> Dismiss All
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Vendor List — compact rows, no horizontal scroll */}
                        {vendors.length > 0 && (
                            <div className="flex-1 overflow-y-auto">
                                {vendors.map((vendor, index) => {
                                    const dismissed = vendor.isDismissed;
                                    const isSelected = vendor.id === selectedVendorId;
                                    return (
                                        <div
                                            key={vendor.id || index}
                                            className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer transition-colors text-xs
                                                ${isSelected ? 'bg-primary/10 border-primary/30' : ''}
                                                ${dismissed ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/50'}
                                                ${!isSelected && !dismissed ? 'border-border' : ''}
                                                ${dismissed ? 'border-border/50' : ''}
                                            `}
                                            onClick={() => setSelectedVendorId(vendor.id === selectedVendorId ? null : vendor.id!)}
                                        >
                                            {/* Checkbox */}
                                            <div onClick={(e) => e.stopPropagation()}>
                                                {!dismissed && <Checkbox checked={selectedVendors.has(vendor.id!)} onCheckedChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)} className="h-3.5 w-3.5" />}
                                            </div>

                                            {/* Index */}
                                            <span className="text-muted-foreground w-4 text-center flex-shrink-0">{index + 1}</span>

                                            {/* Name + Location */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-medium truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                                                        {vendor.businessName}
                                                    </span>
                                                    {dismissed && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 flex-shrink-0 leading-tight">Dismissed</Badge>}
                                                    {vendor.dcaCategory && <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-none ml-1 truncate max-w-[120px]" title={vendor.dcaCategory}>{vendor.dcaCategory}</Badge>}
                                                </div>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                                    <span className="truncate">{vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}</span>
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <span className={`font-bold text-sm flex-shrink-0 ${dismissed ? 'text-muted-foreground' : getScoreColor(vendor.fitScore)}`}>
                                                {vendor.fitScore || '—'}
                                            </span>

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {dismissed ? (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-600 dark:text-amber-400 px-1.5" onClick={() => onRevive(activeCampaign.id, vendor.id!)}>
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => onApprove(activeCampaign.id, vendor.id!, 'STANDARD')} title="Standard">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950" onClick={() => onApprove(activeCampaign.id, vendor.id!, 'FAST_TRACK')} title="Urgent">
                                                            <Zap className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => onDismiss(activeCampaign.id, vendor.id!)} title="Dismiss">
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
                        {vendors.length === 0 && !loading && (
                            <div className="flex-1 flex flex-col items-center justify-center py-12">
                                <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">Run a search to source vendors</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Results accumulate — run multiple searches to build your list</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Right Panel: Vendor Detail */}
            {selectedPreviewVendor && (
                <div className="w-[45%] h-full">
                    <VendorDetailPanel
                        vendor={selectedPreviewVendor}
                        campaignId={activeCampaign.id}
                        onClose={() => setSelectedVendorId(null)}
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
                        <AlertDialogTitle>{bulkTrack === 'FAST_TRACK' ? '⚡ Urgent' : '✅ Standard'} Approve {selectedVendors.size} Vendor{selectedVendors.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {bulkTrack === 'FAST_TRACK' ? 'They\'ll be fast-tracked through onboarding.' : 'They\'ll go through standard onboarding.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove} className={bulkTrack === 'FAST_TRACK' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}>Approve</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showBulkDismissDialog} onOpenChange={setShowBulkDismissDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dismiss {selectedVendors.size} Vendor{selectedVendors.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>They will be removed from this campaign.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDismiss} className="bg-red-600 hover:bg-red-700 text-white">Dismiss</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!showCloseTabDialog} onOpenChange={() => setShowCloseTabDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Close Campaign Tab?</AlertDialogTitle>
                        <AlertDialogDescription>This will discard the preview. Vendors are NOT saved automatically.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmCloseTab} className="bg-slate-600 hover:bg-slate-700 text-white">Close Tab</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
