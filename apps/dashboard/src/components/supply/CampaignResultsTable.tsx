'use client';

import { useState } from 'react';
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
import { CheckCircle2, XCircle, Eye, ChevronDown, ChevronUp, ExternalLink, Phone, Globe, MapPin, X, RotateCcw, Plus, Rocket, Loader2, Search, Zap, ShieldCheck } from 'lucide-react';
import { Vendor } from '@xiri/shared';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import ReactGoogleAutocomplete from 'react-google-autocomplete';

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
    const [websiteError, setWebsiteError] = useState(false);
    const dismissed = vendor.isDismissed;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden animate-in slide-in-from-right-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${dismissed ? 'line-through text-muted-foreground' : ''}`}>
                        {vendor.businessName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                        {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}
                    </p>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Info + Actions */}
            <div className="p-3 space-y-3 border-b border-border flex-shrink-0 bg-muted/5">
                {/* AI Analysis */}
                <Card className="bg-card border-secondary/20 shadow-sm">
                    <CardHeader className="py-2 px-3 pb-1">
                        <CardTitle className="text-xs font-medium flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-yellow-500 fill-current" /> AI Analysis
                            </span>
                            <span className={`font-bold text-sm ${(vendor.fitScore || 0) > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                                {vendor.fitScore || 0}/100
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 pt-0">
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 my-1.5">
                            "{vendor.aiReasoning || 'No reasoning available.'}"
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {vendor.capabilities?.map((cap, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] h-5">{cap}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Info */}
                <div className="flex items-center gap-3 text-xs">
                    {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                            <Phone className="w-3 h-3" /> {vendor.phone}
                        </a>
                    )}
                    {vendor.website && (
                        <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline">
                            <Globe className="w-3 h-3" /> Website
                        </a>
                    )}
                </div>

                {/* Action Buttons */}
                {dismissed ? (
                    <Button onClick={() => onRevive(campaignId, vendor.id!)} className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                        <RotateCcw className="w-3 h-3 mr-1" /> Revive Vendor
                    </Button>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => onApprove(campaignId, vendor.id!, 'FAST_TRACK')}
                                className="bg-orange-500 hover:bg-orange-600 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                                <span className="flex items-center font-bold"><Zap className="w-3.5 h-3.5 mr-1 fill-current" /> Urgent</span>
                                <span className="text-[10px] opacity-90 font-normal">Fast-track onboarding</span>
                            </Button>
                            <Button onClick={() => onApprove(campaignId, vendor.id!, 'STANDARD')}
                                className="bg-green-600 hover:bg-green-700 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                                <span className="flex items-center font-bold"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Standard</span>
                                <span className="text-[10px] opacity-90 font-normal">Add to pipeline</span>
                            </Button>
                        </div>
                        <Button onClick={() => onDismiss(campaignId, vendor.id!)}
                            variant="default" size="sm"
                            className="w-full bg-red-600 hover:bg-red-700 text-white h-7 text-xs">
                            <XCircle className="w-3 h-3 mr-1" /> Dismiss (Blacklist)
                        </Button>
                    </>
                )}
            </div>

            {/* Website Preview */}
            <div className="flex-1 min-h-[200px] relative bg-white group">
                {vendor.websiteScreenshotUrl ? (
                    <div className="w-full h-full relative cursor-pointer" onClick={() => window.open(vendor.website, '_blank')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={vendor.websiteScreenshotUrl} alt={`Preview of ${vendor.businessName}`} className="w-full h-full object-cover object-top hover:opacity-95 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none">
                            <ExternalLink className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                        </div>
                    </div>
                ) : vendor.website ? (
                    !websiteError ? (
                        <iframe
                            src={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                            className="w-full h-full border-none"
                            title="Vendor Website"
                            sandbox="allow-scripts allow-same-origin"
                            onError={() => setWebsiteError(true)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-3 bg-muted/10 p-6 text-center">
                            <Globe className="w-8 h-8 text-muted-foreground" />
                            <div>
                                <p className="font-medium text-foreground text-sm">Preview Unavailable</p>
                                <p className="text-xs mt-1">{vendor.businessName}&apos;s website prevents embedding.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => window.open(vendor.website, '_blank')}>
                                <ExternalLink className="w-3 h-3 mr-2" /> Open Website
                            </Button>
                        </div>
                    )
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
                        <Globe className="w-10 h-10 opacity-20" />
                        <p className="text-xs">No website URL provided</p>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs border border-border flex items-center gap-1 shadow-sm pointer-events-none z-10">
                    <Globe className="w-3 h-3" />
                    {vendor.websiteScreenshotUrl ? 'Live Snapshot' : 'Website Preview'}
                </div>
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
    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    if (campaigns.length === 0) {
        return (
            <Card className="border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm h-full">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
                    <Search className="w-10 h-10 text-blue-400/60" />
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
    const activeVendors = vendors.filter(v => !v.isDismissed);
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
    const getScoreColor = (score?: number) => { if (!score) return 'text-muted-foreground'; if (score >= 80) return 'text-green-600'; if (score >= 50) return 'text-yellow-600'; return 'text-red-500'; };
    const handleTabSwitch = (id: string) => { setSelectedVendors(new Set()); setSearchMessage(''); setSelectedVendorId(null); onSetActiveCampaign(id); };

    const handleSearch = async () => {
        if (!query.trim() || !location.trim()) { setSearchMessage('Please fill in both fields'); return; }
        setLoading(true); setSearchMessage('');
        try {
            const generateLeads = httpsCallable(functions, 'generateLeads', { timeout: 60000 });
            const result = await generateLeads({ query, location, hasActiveContract: false, previewOnly: true });
            const data = result.data as any;
            const newVendors: PreviewVendor[] = data.vendors || [];
            const sourced = data.sourced || 0;
            const qualified = data.analysis?.qualified || 0;
            const existingNames = new Set(activeCampaign.vendors.map(v => (v.businessName || '').toLowerCase().trim()));
            const uniqueNew = newVendors.filter(v => !existingNames.has((v.businessName || '').toLowerCase().trim()));
            if (uniqueNew.length > 0) { onSearchResults(activeCampaign.id, uniqueNew, { query, location, sourced, qualified }); }
            if (activeCampaign.label === 'New Campaign' && query.trim()) { onRenameCampaign(activeCampaign.id, `${query} — ${location.split(',')[0]}`); }
            setSearchMessage(`Found ${sourced} vendors · ${qualified} qualified · ${uniqueNew.length} new added`);
            setQuery(''); setLocation('');
        } catch (error: any) {
            console.error('Error:', error);
            setSearchMessage(`Error: ${error.message || 'Failed to search'}`);
        } finally { setLoading(false); }
    };

    return (
        <div className="h-full flex">
            {/* Left Panel: Tabs + Table */}
            <Card className={`border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm flex flex-col transition-all duration-200 ${selectedPreviewVendor ? 'w-[55%] min-w-[420px]' : 'w-full'}`}>
                {/* Tab Strip */}
                <div className="flex items-center border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 overflow-x-auto flex-shrink-0">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 flex-1 min-w-0">
                        <Eye className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mr-1.5" />
                        {campaigns.map((campaign) => {
                            const activeCount = campaign.vendors.filter(v => !v.isDismissed).length;
                            return (
                                <div key={campaign.id}
                                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer text-xs font-medium transition-all whitespace-nowrap max-w-[200px]
                                        ${campaign.id === activeCampaign.id
                                            ? 'bg-white dark:bg-card text-blue-700 dark:text-blue-400 border border-b-0 border-blue-200 dark:border-blue-700 shadow-sm -mb-px'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-blue-100/50 dark:hover:bg-blue-900/30'}`}
                                    onClick={() => handleTabSwitch(campaign.id)}>
                                    <span className="truncate">{campaign.label}</span>
                                    {activeCount > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">{activeCount}</Badge>}
                                    <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0 ml-0.5"
                                        onClick={(e) => { e.stopPropagation(); setShowCloseTabDialog(campaign.id); }}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                        <button onClick={onNewCampaign} className="flex items-center justify-center w-6 h-6 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-0.5" title="New Campaign">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 whitespace-nowrap">Preview</Badge>
                        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Search Bar */}
                        <div className="px-3 py-2 border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/10 relative flex-shrink-0">
                            {loading && (<div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden"><div className="h-full bg-blue-600 animate-progress-indeterminate"></div></div>)}
                            <div className="flex gap-2 items-center">
                                <Input type="text" placeholder="Search query..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs bg-white dark:bg-card flex-1" disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                                <ReactGoogleAutocomplete
                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                    onPlaceSelected={(place) => { if (place && (place.formatted_address || place.name)) { setLocation(place.formatted_address || place.name); } }}
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
                        {vendors.length > 0 && (
                            <div className="px-3 py-1.5 border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between flex-shrink-0">
                                <span className="text-[11px] text-muted-foreground">
                                    {selectedVendors.size > 0
                                        ? <span className="font-medium text-blue-700 dark:text-blue-400">{selectedVendors.size} selected</span>
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
                                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-600 px-2" onClick={() => setShowBulkDismissDialog(true)}>
                                                <XCircle className="w-3 h-3 mr-0.5" /> ✕
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => onApproveAll(activeCampaign.id, 'STANDARD')}>
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
                                                ${isSelected ? 'bg-blue-100/80 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : ''}
                                                ${dismissed ? 'opacity-50 bg-gray-50/50 dark:bg-gray-900/10' : 'hover:bg-blue-50/50 dark:hover:bg-blue-950/20'}
                                                ${!isSelected && !dismissed ? 'border-blue-100/50 dark:border-blue-900/30' : ''}
                                                ${dismissed ? 'border-gray-200/50' : ''}
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
                                                    {dismissed && <Badge variant="outline" className="text-[8px] px-0.5 py-0 border-amber-300 text-amber-500 flex-shrink-0 leading-tight">Dismissed</Badge>}
                                                </div>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                                    <span className="truncate">{vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : 'N/A'}</span>
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <span className={`font-bold text-sm flex-shrink-0 ${dismissed ? 'text-muted-foreground' : getScoreColor(vendor.fitScore)}`}>
                                                {vendor.fitScore || '—'}
                                            </span>

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {dismissed ? (
                                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-amber-600 px-1.5" onClick={() => onRevive(activeCampaign.id, vendor.id!)}>
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600 hover:bg-green-50" onClick={() => onApprove(activeCampaign.id, vendor.id!, 'STANDARD')} title="Standard">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-orange-500 hover:bg-orange-50" onClick={() => onApprove(activeCampaign.id, vendor.id!, 'FAST_TRACK')} title="Urgent">
                                                            <Zap className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50" onClick={() => onDismiss(activeCampaign.id, vendor.id!)} title="Dismiss">
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
                        <AlertDialogDescription>They'll be blacklisted and shown grayed out in future campaigns.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDismiss} className="bg-red-600 hover:bg-red-700 text-white">Dismiss</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!showCloseTabDialog} onOpenChange={() => setShowCloseTabDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Close Campaign Tab?</AlertDialogTitle>
                        <AlertDialogDescription>This will discard the preview. Vendors are not blacklisted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmCloseTab} className="bg-slate-600 hover:bg-slate-700 text-white">Close Tab</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
