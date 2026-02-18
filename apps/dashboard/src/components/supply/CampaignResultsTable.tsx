'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TableHead, TableHeader, TableRow, TableBody, TableCell } from '@/components/ui/table';
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
import { CheckCircle2, XCircle, Eye, ChevronDown, ChevronUp, ExternalLink, Phone, Globe, MapPin, X, RotateCcw, Plus, Rocket, Loader2, Search } from 'lucide-react';
import { Vendor } from '@xiri/shared';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import ReactGoogleAutocomplete from 'react-google-autocomplete';

// Extend Vendor with optional isDismissed tag from backend
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
    onApprove: (campaignId: string, vendorId: string) => void;
    onDismiss: (campaignId: string, vendorId: string) => void;
    onRevive: (campaignId: string, vendorId: string) => void;
    onApproveAll: (campaignId: string) => void;
    onDismissAll: (campaignId: string) => void;
    onRenameCampaign: (campaignId: string, newLabel: string) => void;
}

export default function CampaignResultsTable({
    campaigns,
    activeCampaignId,
    onSetActiveCampaign,
    onNewCampaign,
    onCloseCampaign,
    onSearchResults,
    onApprove,
    onDismiss,
    onRevive,
    onApproveAll,
    onDismissAll,
    onRenameCampaign,
}: CampaignResultsTableProps) {
    const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(true);
    const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
    const [showBulkDismissDialog, setShowBulkDismissDialog] = useState(false);
    const [showCloseTabDialog, setShowCloseTabDialog] = useState<string | null>(null);

    // Search state (lives inside each tab)
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    if (campaigns.length === 0) {
        // Empty state — show just a "New Campaign" button
        return (
            <Card className="border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm mb-4">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center">
                    <Search className="w-8 h-8 text-blue-400/60" />
                    <div>
                        <p className="text-sm font-medium text-foreground">No campaigns yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Create a new campaign to start sourcing vendors</p>
                    </div>
                    <Button onClick={onNewCampaign} className="mt-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-3.5 h-3.5 mr-1" /> New Campaign
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0];
    const vendors = activeCampaign?.vendors || [];
    const activeVendors = vendors.filter(v => !v.isDismissed);
    const dismissedCount = vendors.filter(v => v.isDismissed).length;

    const handleSelectAll = (checked: boolean) => {
        if (checked) { setSelectedVendors(new Set(activeVendors.map(v => v.id!))); }
        else { setSelectedVendors(new Set()); }
    };

    const handleSelectVendor = (vendorId: string, checked: boolean) => {
        const newSelected = new Set(selectedVendors);
        if (checked) { newSelected.add(vendorId); } else { newSelected.delete(vendorId); }
        setSelectedVendors(newSelected);
    };

    const handleBulkApprove = () => { selectedVendors.forEach(id => onApprove(activeCampaign.id, id)); setSelectedVendors(new Set()); setShowBulkApproveDialog(false); };
    const handleBulkDismiss = () => { selectedVendors.forEach(id => onDismiss(activeCampaign.id, id)); setSelectedVendors(new Set()); setShowBulkDismissDialog(false); };
    const handleCloseTab = (campaignId: string) => { setShowCloseTabDialog(campaignId); };
    const confirmCloseTab = () => { if (showCloseTabDialog) { onCloseCampaign(showCloseTabDialog); setShowCloseTabDialog(null); setSelectedVendors(new Set()); } };

    const allSelected = activeVendors.length > 0 && selectedVendors.size === activeVendors.length;
    const getScoreColor = (score?: number) => { if (!score) return 'text-muted-foreground'; if (score >= 80) return 'text-green-600'; if (score >= 50) return 'text-yellow-600'; return 'text-red-500'; };
    const handleTabSwitch = (id: string) => { setSelectedVendors(new Set()); setSearchMessage(''); onSetActiveCampaign(id); };

    // In-tab search handler
    const handleSearch = async () => {
        if (!query.trim() || !location.trim()) { setSearchMessage('Please fill in both fields'); return; }
        setLoading(true);
        setSearchMessage('');

        try {
            const generateLeads = httpsCallable(functions, 'generateLeads', { timeout: 60000 });
            const result = await generateLeads({ query, location, hasActiveContract: false, previewOnly: true });
            const data = result.data as any;
            const newVendors: PreviewVendor[] = data.vendors || [];
            const sourced = data.sourced || 0;
            const qualified = data.analysis?.qualified || 0;

            // Deduplicate against vendors already in this campaign
            const existingNames = new Set(activeCampaign.vendors.map(v => (v.businessName || '').toLowerCase().trim()));
            const uniqueNewVendors = newVendors.filter(v => !existingNames.has((v.businessName || '').toLowerCase().trim()));

            if (uniqueNewVendors.length > 0) {
                onSearchResults(activeCampaign.id, uniqueNewVendors, { query, location, sourced, qualified });
            }

            // Auto-rename tab if it's still "New Campaign"
            if (activeCampaign.label === 'New Campaign' && query.trim()) {
                onRenameCampaign(activeCampaign.id, `${query} — ${location.split(',')[0]}`);
            }

            setSearchMessage(`Found ${sourced} vendors · ${qualified} qualified · ${uniqueNewVendors.length} new added`);
            setQuery('');
            setLocation('');
        } catch (error: any) {
            console.error('Error launching campaign:', error);
            setSearchMessage(`Error: ${error.message || 'Failed to launch campaign'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm mb-4">
            {/* Tab Strip */}
            <div className="flex items-center border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 overflow-x-auto">
                <div className="flex items-center gap-0.5 px-2 py-1.5 flex-1 min-w-0">
                    <Eye className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mr-1.5" />
                    {campaigns.map((campaign) => {
                        const activeCount = campaign.vendors.filter(v => !v.isDismissed).length;
                        return (
                            <div
                                key={campaign.id}
                                className={`
                                    group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer
                                    text-xs font-medium transition-all whitespace-nowrap max-w-[220px]
                                    ${campaign.id === activeCampaign.id
                                        ? 'bg-white dark:bg-card text-blue-700 dark:text-blue-400 border border-b-0 border-blue-200 dark:border-blue-700 shadow-sm -mb-px'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                                    }
                                `}
                                onClick={() => handleTabSwitch(campaign.id)}
                            >
                                <span className="truncate">{campaign.label}</span>
                                {activeCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                                        {activeCount}
                                    </Badge>
                                )}
                                <button
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0 ml-0.5"
                                    onClick={(e) => { e.stopPropagation(); handleCloseTab(campaign.id); }}
                                    title={`Close "${campaign.label}"`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                    {/* + New Tab Button */}
                    <button
                        onClick={onNewCampaign}
                        className="flex items-center justify-center w-6 h-6 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-0.5"
                        title="New Campaign"
                    >
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
                <CardContent className="p-0">
                    {/* Search Bar — inside the active tab */}
                    <div className="px-3 py-2.5 border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-950/10 relative">
                        {loading && (
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden">
                                <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-2 items-end">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                                <Input
                                    type="text"
                                    placeholder="Search query, e.g., HVAC contractors"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="h-8 text-xs bg-white dark:bg-card"
                                    disabled={loading}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <ReactGoogleAutocomplete
                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                    onPlaceSelected={(place) => {
                                        if (place && (place.formatted_address || place.name)) {
                                            setLocation(place.formatted_address || place.name);
                                        }
                                    }}
                                    options={{ types: ['geocode'], componentRestrictions: { country: 'us' } }}
                                    placeholder="Location, e.g., 11040 or New York, NY"
                                    className="flex h-8 w-full rounded-md border border-input bg-white dark:bg-card px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                                    onChange={(e: any) => setLocation(e.target.value)}
                                    value={location}
                                    disabled={loading}
                                />
                            </div>
                            <Button
                                onClick={handleSearch}
                                disabled={loading}
                                size="sm"
                                className="h-8 text-xs px-4 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Rocket className="mr-1.5 h-3 w-3" /> Search</>}
                            </Button>
                        </div>
                        {searchMessage && (
                            <p className={`text-[11px] mt-1.5 ${searchMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{searchMessage}</p>
                        )}
                    </div>

                    {/* Campaign Summary */}
                    {vendors.length > 0 && (
                        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b border-blue-100/50 dark:border-blue-900/30">
                            {activeVendors.length} active vendors
                            {dismissedCount > 0 && <span className="text-amber-600"> · {dismissedCount} previously dismissed</span>}
                            {activeCampaign.searches.length > 0 && (
                                <span> · {activeCampaign.searches.length} search{activeCampaign.searches.length > 1 ? 'es' : ''} run</span>
                            )}
                        </div>
                    )}

                    {/* Bulk Action Bar — only show when there are vendors */}
                    {vendors.length > 0 && (
                        <div className="px-4 py-2 border-b border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {selectedVendors.size > 0 ? (
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{selectedVendors.size} selected</span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Select vendors to approve or dismiss</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedVendors.size > 0 ? (
                                    <>
                                        <Button size="sm" variant="default" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowBulkApproveDialog(true)}>
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve ({selectedVendors.size})
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setShowBulkDismissDialog(true)}>
                                            <XCircle className="w-3 h-3 mr-1" /> Dismiss ({selectedVendors.size})
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" variant="default" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onApproveAll(activeCampaign.id)}>
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve All
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDismissAll(activeCampaign.id)}>
                                            <XCircle className="w-3 h-3 mr-1" /> Dismiss All
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Desktop Table */}
                    {vendors.length > 0 && (
                        <div className="hidden md:block overflow-auto max-h-[400px]">
                            <table className="w-full caption-bottom text-sm">
                                <TableHeader className="bg-blue-50/80 dark:bg-blue-950/40">
                                    <TableRow className="border-b border-blue-200/50 dark:border-blue-800/50">
                                        <TableHead className="h-8 w-10 text-center"><Checkbox checked={allSelected} onCheckedChange={handleSelectAll} aria-label="Select all" /></TableHead>
                                        <TableHead className="h-8 text-xs font-semibold w-8 text-center">#</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold">Vendor</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold">Location</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold text-center">AI Score</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold">Capabilities</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold text-center">Contact</TableHead>
                                        <TableHead className="h-8 text-xs font-semibold text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendors.map((vendor, index) => {
                                        const dismissed = vendor.isDismissed;
                                        return (
                                            <TableRow
                                                key={vendor.id || index}
                                                className={`border-b transition-colors ${dismissed ? 'border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/20 opacity-50' : 'border-blue-100/50 dark:border-blue-900/30 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'}`}
                                            >
                                                <TableCell className="text-center py-2">
                                                    {!dismissed && <Checkbox checked={selectedVendors.has(vendor.id!)} onCheckedChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)} />}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-muted-foreground py-2">{index + 1}</TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`font-medium text-sm truncate max-w-[200px] ${dismissed ? 'line-through text-muted-foreground' : ''}`}>{vendor.businessName}</span>
                                                            {dismissed && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-500 flex-shrink-0">Dismissed</Badge>}
                                                        </div>
                                                        {!dismissed && vendor.website && (
                                                            <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                                                <Globe className="w-3 h-3" /> website
                                                            </a>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                                        <span className="truncate max-w-[180px]">{vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                    <span className={`text-sm font-bold ${dismissed ? 'text-muted-foreground' : getScoreColor(vendor.fitScore)}`}>{vendor.fitScore || '—'}</span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(vendor.capabilities || []).slice(0, 2).map((cap, i) => (
                                                            <Badge key={i} variant="secondary" className={`text-[10px] px-1.5 py-0 ${dismissed ? 'opacity-50' : ''}`}>{cap}</Badge>
                                                        ))}
                                                        {(vendor.capabilities || []).length > 2 && <Badge variant="outline" className="text-[10px] px-1 py-0">+{(vendor.capabilities || []).length - 2}</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                    {!dismissed ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            {vendor.phone && <a href={`tel:${vendor.phone}`} className="text-muted-foreground hover:text-foreground" title={vendor.phone}><Phone className="w-3.5 h-3.5" /></a>}
                                                            {vendor.website && <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Visit website"><ExternalLink className="w-3.5 h-3.5" /></a>}
                                                            {!vendor.phone && !vendor.website && <span className="text-xs text-muted-foreground">—</span>}
                                                        </div>
                                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                    {dismissed ? (
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1" onClick={() => onRevive(activeCampaign.id, vendor.id!)} title="Revive — remove from blacklist">
                                                            <RotateCcw className="w-3 h-3" /> Revive
                                                        </Button>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => onApprove(activeCampaign.id, vendor.id!)} title="Approve into CRM"><CheckCircle2 className="w-4 h-4" /></Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDismiss(activeCampaign.id, vendor.id!)} title="Dismiss"><XCircle className="w-4 h-4" /></Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </table>
                        </div>
                    )}

                    {/* Mobile Card View */}
                    {vendors.length > 0 && (
                        <div className="md:hidden p-3 space-y-2">
                            {vendors.map((vendor, index) => {
                                const dismissed = vendor.isDismissed;
                                return (
                                    <div key={vendor.id || index} className={`border rounded-lg p-3 ${dismissed ? 'border-gray-200/50 bg-gray-50/50 opacity-50' : 'border-blue-200/50 dark:border-blue-800/50 bg-white dark:bg-card'}`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`font-medium text-sm ${dismissed ? 'line-through text-muted-foreground' : ''}`}>{vendor.businessName}</p>
                                                    {dismissed && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-500">Dismissed</Badge>}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}</p>
                                            </div>
                                            <span className={`text-sm font-bold ${dismissed ? 'text-muted-foreground' : getScoreColor(vendor.fitScore)}`}>{vendor.fitScore || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {dismissed ? (
                                                <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs text-amber-600 gap-1" onClick={() => onRevive(activeCampaign.id, vendor.id!)}>
                                                    <RotateCcw className="w-3 h-3" /> Revive
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onApprove(activeCampaign.id, vendor.id!)}><CheckCircle2 className="w-3 h-3 mr-1" /> Approve</Button>
                                                    <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs text-red-600" onClick={() => onDismiss(activeCampaign.id, vendor.id!)}><XCircle className="w-3 h-3 mr-1" /> Dismiss</Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty tab state */}
                    {vendors.length === 0 && !loading && (
                        <div className="py-8 text-center">
                            <Search className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Run a search above to start sourcing vendors for this campaign</p>
                        </div>
                    )}
                </CardContent>
            )}

            {/* Dialogs */}
            <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve {selectedVendors.size} Vendor{selectedVendors.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>They'll be saved to the CRM pipeline with "pending_review" status.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700 text-white">Approve</AlertDialogAction></AlertDialogFooter>
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
                        <AlertDialogDescription>This will discard the preview. Vendors are not blacklisted and may appear in future campaigns.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmCloseTab} className="bg-slate-600 hover:bg-slate-700 text-white">Close Tab</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
