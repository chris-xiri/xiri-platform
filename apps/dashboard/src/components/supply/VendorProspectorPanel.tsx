'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
    Search, Loader2, ChevronDown, ChevronUp, Plus, X,
    Phone, Globe, Mail, MapPin, Star, Users, CheckCircle2,
    XCircle, Zap, ShieldCheck, ExternalLink, Facebook, Eye,
    RotateCcw, Wrench, Building2, AlertTriangle,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    VENDOR_CAPABILITIES,
    CAPABILITY_GROUP_LABELS,
    type CapabilityOption,
} from '@/lib/vendor-capabilities';
import ReactGoogleAutocomplete from 'react-google-autocomplete';

// ── Types ──

interface ProspectResult {
    businessName: string;
    address?: string;
    phone?: string;
    website?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    genericEmail?: string;
    rating?: number;
    userRatingsTotal?: number;
    emailSource: string;
    emailConfidence: string;
    enrichmentLog?: string[];
    // Vendor-specific
    detectedCapabilities?: string[];
    searchCapability?: string;
    isCommercial?: boolean;
    searchQuery?: string;
}

interface ProspectSearch {
    query: string;
    capability: string;
    location: string;
    timestamp: Date;
    found: number;
}

interface ProspectorCampaign {
    id: string;
    label: string;
    prospects: ProspectResult[];
    dismissed: Set<string>;
    searches: ProspectSearch[];
}

// ── Helper ──

function generateId() {
    return `vp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/** Parse city and state from a Google Maps formatted address string.
 *  e.g. "123 Main St, Brooklyn, NY 11201, USA" → { city: "Brooklyn", state: "NY" }
 */
function parseCityState(address?: string): { city: string | null; state: string | null } {
    if (!address) return { city: null, state: null };
    const parts = address.split(',').map(p => p.trim());
    // Google Maps format: street, city, state zip, country
    if (parts.length >= 3) {
        const city = parts[parts.length - 3] || null;
        const stateZip = parts[parts.length - 2] || '';
        const state = stateZip.replace(/\s*\d{5}(-\d{4})?$/, '').trim() || null;
        return { city, state };
    }
    // Fallback for "City, State" or "City, State ZIP"
    if (parts.length === 2) {
        const city = parts[0] || null;
        const state = parts[1].replace(/\s*\d{5}(-\d{4})?$/, '').trim() || null;
        return { city, state };
    }
    return { city: null, state: null };
}

function getEmailIcon(confidence: string) {
    if (confidence === 'verified' || confidence === 'high') return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    if (confidence === 'medium') return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
    return <Mail className="w-3 h-3 text-muted-foreground" />;
}

function getConfidenceBadge(confidence: string) {
    const colors: Record<string, string> = {
        verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        low: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        none: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    };
    return colors[confidence] || colors.none;
}

// ── Detail Panel ──

function ProspectDetailPanel({
    prospect,
    onClose,
    onApprove,
    onDismiss,
}: {
    prospect: ProspectResult;
    onClose: () => void;
    onApprove: (track: 'STANDARD' | 'FAST_TRACK') => void;
    onDismiss: () => void;
}) {
    const bestEmail = prospect.contactEmail || prospect.genericEmail;
    const hasContact = prospect.contactName || prospect.contactEmail;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden animate-in slide-in-from-right-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{prospect.businessName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                            {prospect.address || 'No address'}
                        </p>
                        {prospect.isCommercial && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-none flex-shrink-0">
                                Commercial
                            </Badge>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                {/* Contact Card */}
                {hasContact && (
                    <Card className="bg-card border-green-200 dark:border-green-800 shadow-sm">
                        <CardHeader className="py-2 px-3 pb-1">
                            <CardTitle className="text-xs font-medium flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-green-500" /> Contact
                                </span>
                                <Badge className={`text-[9px] px-1.5 h-4 border-none ${getConfidenceBadge(prospect.emailConfidence)}`}>
                                    {prospect.emailConfidence || 'unknown'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-2 pt-0 space-y-1.5">
                            {prospect.contactName && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium">{prospect.contactName}</span>
                                    {prospect.contactTitle && (
                                        <span className="text-muted-foreground">· {prospect.contactTitle}</span>
                                    )}
                                </div>
                            )}
                            {prospect.contactEmail && (
                                <a href={`mailto:${prospect.contactEmail}`} className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                    {getEmailIcon(prospect.emailConfidence)} {prospect.contactEmail}
                                </a>
                            )}
                            {prospect.genericEmail && prospect.genericEmail !== prospect.contactEmail && (
                                <a href={`mailto:${prospect.genericEmail}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:underline">
                                    <Mail className="w-3 h-3 flex-shrink-0" /> {prospect.genericEmail}
                                    <Badge variant="outline" className="text-[8px] h-3 px-0.5">generic</Badge>
                                </a>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Links */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-card p-3 rounded-md border border-border shadow-sm text-xs">
                    {prospect.phone && (
                        <a href={`tel:${prospect.phone}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {prospect.phone}
                        </a>
                    )}
                    {prospect.website && (
                        <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            <Globe className="w-3.5 h-3.5 flex-shrink-0" /> Website
                        </a>
                    )}
                    {prospect.facebookUrl && (
                        <a href={prospect.facebookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            <Facebook className="w-3.5 h-3.5 flex-shrink-0" /> Facebook
                        </a>
                    )}
                    {prospect.linkedinUrl && (
                        <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> LinkedIn
                        </a>
                    )}
                </div>

                {/* Rating */}
                {prospect.rating && (
                    <div className="flex items-center gap-1.5 text-xs px-1">
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} className={`w-3 h-3 ${star <= Math.round(prospect.rating!) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                            ))}
                        </div>
                        <span className="font-medium">{prospect.rating}</span>
                        {prospect.userRatingsTotal && (
                            <span className="text-muted-foreground">({prospect.userRatingsTotal} reviews)</span>
                        )}
                    </div>
                )}

                {/* Capabilities */}
                {prospect.detectedCapabilities && prospect.detectedCapabilities.length > 0 && (
                    <div className="px-1">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Detected Capabilities</p>
                        <div className="flex flex-wrap gap-1">
                            {prospect.detectedCapabilities.map((cap, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] h-4 px-1.5 py-0 font-normal capitalize">
                                    {cap.replace(/_/g, ' ')}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Enrichment Log */}
                {prospect.enrichmentLog && prospect.enrichmentLog.length > 0 && (
                    <details className="text-[10px] text-muted-foreground px-1">
                        <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
                            Enrichment Log ({prospect.enrichmentLog.length} steps)
                        </summary>
                        <ul className="mt-1 space-y-0.5 ml-3 list-disc list-outside">
                            {prospect.enrichmentLog.map((entry, i) => (
                                <li key={i} className="leading-tight">{entry}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>

            {/* Actions */}
            <div className="p-3 bg-muted/30 border-t border-border flex-shrink-0">
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button onClick={() => onApprove('FAST_TRACK')}
                        className="bg-orange-500 hover:bg-orange-600 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                        <span className="flex items-center font-bold"><Zap className="w-3.5 h-3.5 mr-1 fill-current" /> Urgent Needs</span>
                        <span className="text-[9px] opacity-90 font-normal leading-tight">Fast-track onboarding</span>
                    </Button>
                    <Button onClick={() => onApprove('STANDARD')}
                        className="bg-green-600 hover:bg-green-700 text-white h-auto py-2 flex-col items-start gap-0.5 text-xs">
                        <span className="flex items-center font-bold"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Standard</span>
                        <span className="text-[9px] opacity-90 font-normal leading-tight">Add to pipeline</span>
                    </Button>
                </div>
                <Button onClick={onDismiss}
                    variant="default" size="sm"
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-7 text-xs">
                    <XCircle className="w-3 h-3 mr-1" /> Dismiss
                </Button>
            </div>
        </div>
    );
}

// ── Main Component ──

interface VendorProspectorPanelProps {
    onVendorAdded?: () => void;
}

export default function VendorProspectorPanel({ onVendorAdded }: VendorProspectorPanelProps) {
    // Campaign state
    const [campaigns, setCampaigns] = useState<ProspectorCampaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

    // Search state
    const [capability, setCapability] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    const [expanded, setExpanded] = useState(true);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedProspectIdx, setSelectedProspectIdx] = useState<number | null>(null);
    const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
    const [showCloseTabDialog, setShowCloseTabDialog] = useState<string | null>(null);
    const [bulkTrack, setBulkTrack] = useState<'STANDARD' | 'FAST_TRACK'>('STANDARD');

    // ── Campaign Helpers ──

    const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || campaigns[0] || null;
    const activeProspects = activeCampaign
        ? activeCampaign.prospects.filter((_, i) => !activeCampaign.dismissed.has(String(i)))
        : [];
    const dismissedCount = activeCampaign?.dismissed.size || 0;

    const newCampaign = useCallback(() => {
        const c: ProspectorCampaign = {
            id: generateId(),
            label: 'New Search',
            prospects: [],
            dismissed: new Set(),
            searches: [],
        };
        setCampaigns(prev => [...prev, c]);
        setActiveCampaignId(c.id);
    }, []);

    const closeCampaign = useCallback((id: string) => {
        setCampaigns(prev => {
            const updated = prev.filter(c => c.id !== id);
            if (updated.length > 0 && activeCampaignId === id) {
                setActiveCampaignId(updated[updated.length - 1].id);
            } else if (updated.length === 0) {
                setActiveCampaignId(null);
            }
            return updated;
        });
        setSelectedProspectIdx(null);
        setSelectedIds(new Set());
    }, [activeCampaignId]);

    // ── Search ──

    const handleSearch = useCallback(async () => {
        if (!activeCampaign) return;
        if (!capability) { setSearchMessage('Select a trade / capability'); return; }
        if (!location.trim()) { setSearchMessage('Enter a location'); return; }

        const capOption = VENDOR_CAPABILITIES.find(c => c.value === capability);
        if (!capOption) { setSearchMessage('Invalid capability'); return; }

        setLoading(true);
        setSearchMessage('');

        try {
            const fn = httpsCallable(functions, 'runVendorProspector', { timeout: 600000 });
            const result = await fn({
                query: `${capOption.label} contractor`,
                location: location.trim(),
                capability: capability,
                capabilityLabel: capOption.label,
                capabilityGroup: capOption.group,
                maxResults: 20,
                skipPaidApis: true,
            });

            const data = result.data as any;
            const newProspects: ProspectResult[] = data.prospects || [];
            const stats = data.stats || {};

            // Deduplicate against existing campaign prospects
            const existingNames = new Set(
                activeCampaign.prospects.map(p => p.businessName.toLowerCase().replace(/[^a-z0-9]/g, ''))
            );
            const unique = newProspects.filter(p =>
                !existingNames.has(p.businessName.toLowerCase().replace(/[^a-z0-9]/g, ''))
            );

            if (unique.length > 0) {
                setCampaigns(prev => prev.map(c =>
                    c.id === activeCampaign.id
                        ? {
                            ...c,
                            prospects: [...c.prospects, ...unique],
                            searches: [...c.searches, {
                                query: capOption.label,
                                capability,
                                location: location.trim(),
                                timestamp: new Date(),
                                found: unique.length,
                            }],
                        }
                        : c
                ));
            }

            // Auto-rename campaign
            if (activeCampaign.label === 'New Search') {
                const locParts = location.trim().split(',').map(p => p.trim());
                const town = locParts[0];
                const state = locParts.length >= 2 ? locParts[1].replace(/\s*\d{5}.*/, '').trim() : '';
                setCampaigns(prev => prev.map(c =>
                    c.id === activeCampaign.id
                        ? { ...c, label: `${capOption.label}\n${town}\n${state}` }
                        : c
                ));
            }

            setSearchMessage(
                `Found ${stats.discovered || 0} vendors · ${unique.length} new · ${stats.withPersonalEmail || 0} with emails`
            );
        } catch (error: any) {
            console.error('Vendor prospector error:', error);
            setSearchMessage(`Error: ${error.message || 'Search failed'}`);
        } finally {
            setLoading(false);
        }
    }, [activeCampaign, capability, location]);

    // ── Actions ──

    const approveProspect = useCallback(async (idx: number, track: 'STANDARD' | 'FAST_TRACK') => {
        if (!activeCampaign) return;
        const prospect = activeCampaign.prospects[idx];
        if (!prospect) return;

        const { city, state } = parseCityState(prospect.address);

        try {
            await addDoc(collection(db, 'vendors'), {
                businessName: prospect.businessName,
                address: prospect.address || null,
                city: city,
                state: state,
                phone: prospect.phone || null,
                email: prospect.contactEmail || prospect.genericEmail || null,
                website: prospect.website || null,
                facebookUrl: prospect.facebookUrl || null,
                linkedinUrl: prospect.linkedinUrl || null,
                rating: prospect.rating || null,
                capabilities: prospect.detectedCapabilities || [prospect.searchCapability || capability],
                primaryCapability: prospect.searchCapability || capability,
                contactName: prospect.contactName || null,
                contactTitle: prospect.contactTitle || null,
                emailSource: prospect.emailSource || null,
                emailConfidence: prospect.emailConfidence || null,
                status: 'qualified',
                onboardingTrack: track,
                hasActiveContract: track === 'FAST_TRACK',
                source: 'vendor_prospector',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            onVendorAdded?.();
        } catch (error) {
            console.error('Error approving vendor prospect:', error);
            return;
        }

        // Remove from campaign
        setCampaigns(prev => prev.map(c =>
            c.id === activeCampaign.id
                ? { ...c, dismissed: new Set([...c.dismissed, String(idx)]) }
                : c
        ));
        if (selectedProspectIdx === idx) setSelectedProspectIdx(null);
    }, [activeCampaign, capability, onVendorAdded, selectedProspectIdx]);

    const dismissProspect = useCallback((idx: number) => {
        if (!activeCampaign) return;
        setCampaigns(prev => prev.map(c =>
            c.id === activeCampaign.id
                ? { ...c, dismissed: new Set([...c.dismissed, String(idx)]) }
                : c
        ));
        if (selectedProspectIdx === idx) setSelectedProspectIdx(null);
    }, [activeCampaign, selectedProspectIdx]);

    const handleTabSwitch = useCallback((id: string) => {
        setSelectedIds(new Set());
        setSearchMessage('');
        setSelectedProspectIdx(null);
        setActiveCampaignId(id);
    }, []);

    const getScoreColor = (confidence: string) => {
        if (confidence === 'verified' || confidence === 'high') return 'text-green-600 dark:text-green-400';
        if (confidence === 'medium') return 'text-yellow-600 dark:text-yellow-400';
        return 'text-muted-foreground';
    };

    // ── Empty State ──

    if (campaigns.length === 0) {
        return (
            <Card className="border-2 border-dashed border-border shadow-sm h-full">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
                    <Wrench className="w-10 h-10 text-muted-foreground/40" />
                    <div>
                        <p className="text-base font-medium text-foreground">Contractor Prospector</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Discover subcontractors across all trades.<br />
                            Searches Google Maps + Facebook for businesses without websites.
                        </p>
                    </div>
                    <Button onClick={newCampaign} className="mt-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-4 h-4 mr-1.5" /> New Search
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const selectedDetail = selectedProspectIdx !== null ? activeCampaign?.prospects[selectedProspectIdx] : null;

    // ── Render ──

    return (
        <div className="h-full flex">
            {/* Left Panel: Tabs + Table */}
            <Card className={`border border-border bg-card shadow-sm flex flex-col transition-all duration-200 ${selectedDetail ? 'w-[55%] min-w-[420px]' : 'w-full'}`}>
                {/* Tab Strip */}
                <div className="flex items-center border-b border-border bg-muted/50 overflow-x-auto flex-shrink-0">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 flex-1 min-w-0">
                        <Wrench className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mr-1.5" />
                        {campaigns.map(campaign => {
                            const count = campaign.prospects.length - campaign.dismissed.size;
                            const labelLines = campaign.label.split('\n');
                            const isStructured = labelLines.length >= 2;
                            return (
                                <div
                                    key={campaign.id}
                                    className={`group flex items-start gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer text-xs font-medium transition-all
                                        ${campaign.id === activeCampaign?.id
                                            ? 'bg-card text-primary border border-b-0 border-border shadow-sm -mb-px'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                    onClick={() => handleTabSwitch(campaign.id)}
                                >
                                    {isStructured ? (
                                        <div className="flex flex-col leading-tight min-w-0">
                                            <span className="text-[11px] font-semibold">{labelLines[0]}</span>
                                            <span className="text-[10px] font-normal text-muted-foreground">{labelLines[1]}</span>
                                            {labelLines[2] && <span className="text-[9px] font-normal text-muted-foreground/70">{labelLines[2]}</span>}
                                        </div>
                                    ) : (
                                        <span className="truncate">{campaign.label}</span>
                                    )}
                                    {count > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 mt-0.5">{count}</Badge>}
                                    <button
                                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all flex-shrink-0 ml-0.5 mt-0.5"
                                        onClick={(e) => { e.stopPropagation(); setShowCloseTabDialog(campaign.id); }}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                        <button onClick={newCampaign} className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-0.5" title="New Search">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 dark:text-orange-400 whitespace-nowrap">Prospector</Badge>
                        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-muted rounded transition-colors">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Search Bar */}
                        <div className="px-3 py-2 border-b border-border bg-muted/30 relative flex-shrink-0">
                            {loading && (
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-muted overflow-hidden">
                                    <div className="h-full bg-orange-500 animate-progress-indeterminate" />
                                </div>
                            )}

                            <div className="flex gap-2 items-end">
                                {/* Capability Selector */}
                                <div className="flex-1 min-w-[180px]">
                                    <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Trade / Capability</label>
                                    <Select value={capability} onValueChange={setCapability}>
                                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-card">
                                            <SelectValue placeholder="Select trade..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CAPABILITY_GROUP_LABELS).map(([group, label]) => (
                                                <SelectGroup key={group}>
                                                    <SelectLabel className="text-xs font-semibold">{label}</SelectLabel>
                                                    {VENDOR_CAPABILITIES.filter(c => c.group === group).map(cap => (
                                                        <SelectItem key={cap.value} value={cap.value} className="text-xs">
                                                            {cap.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Location */}
                                <div className="flex-1 min-w-[180px]">
                                    <label className="text-[10px] text-muted-foreground font-medium mb-0.5 block">Location</label>
                                    <ReactGoogleAutocomplete
                                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                        onPlaceSelected={(place: any) => setLocation(place?.formatted_address || '')}
                                        options={{ types: ['(regions)'], componentRestrictions: { country: 'us' } }}
                                        defaultValue={location}
                                        onChange={(e: any) => setLocation(e.target.value)}
                                        className="flex h-7 w-full rounded-md border border-input bg-white dark:bg-card px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        placeholder="City, State..."
                                        disabled={loading}
                                    />
                                </div>

                                {/* Search Button */}
                                <Button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    size="sm"
                                    className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1 flex-shrink-0"
                                >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                    {loading ? 'Prospecting...' : 'Search'}
                                </Button>
                            </div>

                            {searchMessage && (
                                <p className={`text-[11px] mt-1.5 ${searchMessage.startsWith('Error') ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {searchMessage}
                                </p>
                            )}
                        </div>

                        {/* Results Table */}
                        <div className="flex-1 overflow-y-auto">
                            {activeProspects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <Building2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">No prospects yet</p>
                                    <p className="text-xs text-muted-foreground/70 mt-0.5">Search for contractors above</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {activeCampaign!.prospects.map((prospect, idx) => {
                                        if (activeCampaign!.dismissed.has(String(idx))) return null;
                                        const isSelected = selectedProspectIdx === idx;
                                        const bestEmail = prospect.contactEmail || prospect.genericEmail;
                                        return (
                                            <div
                                                key={`${prospect.businessName}-${idx}`}
                                                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-xs
                                                    ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'}`}
                                                onClick={() => setSelectedProspectIdx(isSelected ? null : idx)}
                                            >
                                                {/* Business Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-medium truncate text-foreground">{prospect.businessName}</p>
                                                        {prospect.facebookUrl && !prospect.website && (
                                                            <Badge variant="secondary" className="text-[8px] px-1 h-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-none flex-shrink-0">
                                                                FB Only
                                                            </Badge>
                                                        )}
                                                        {prospect.isCommercial && (
                                                            <Badge variant="secondary" className="text-[8px] px-1 h-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-none flex-shrink-0">
                                                                Commercial
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                        {prospect.address || 'No address'}
                                                    </p>
                                                </div>

                                                {/* Contact Preview */}
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    {prospect.phone && (
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <Phone className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                    {bestEmail && (
                                                        <span className="flex items-center gap-1">
                                                            {getEmailIcon(prospect.emailConfidence)}
                                                        </span>
                                                    )}
                                                    {prospect.rating && (
                                                        <span className="flex items-center gap-0.5 text-muted-foreground">
                                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                            <span className="tabular-nums">{prospect.rating}</span>
                                                        </span>
                                                    )}
                                                    <Badge className={`text-[9px] px-1 h-4 border-none ${getConfidenceBadge(prospect.emailConfidence)}`}>
                                                        {prospect.emailSource?.replace(/_/g, ' ') || 'pending'}
                                                    </Badge>
                                                </div>

                                                {/* Quick Actions */}
                                                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => approveProspect(idx, 'STANDARD')}
                                                        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
                                                        title="Approve"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => dismissProspect(idx)}
                                                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                                                        title="Dismiss"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Stats */}
                        {activeProspects.length > 0 && (
                            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex-shrink-0">
                                <span>{activeProspects.length} prospects · {dismissedCount} dismissed</span>
                                <span>
                                    {activeCampaign?.searches.length || 0} searches ·
                                    Emails: {activeProspects.filter(p => p.contactEmail).length} personal, {activeProspects.filter(p => !p.contactEmail && p.genericEmail).length} generic
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Right Panel: Detail View */}
            {selectedDetail && (
                <div className="w-[45%] min-w-[340px] max-w-[500px]">
                    <ProspectDetailPanel
                        prospect={selectedDetail}
                        onClose={() => setSelectedProspectIdx(null)}
                        onApprove={(track) => approveProspect(selectedProspectIdx!, track)}
                        onDismiss={() => dismissProspect(selectedProspectIdx!)}
                    />
                </div>
            )}

            {/* Close Tab Confirmation */}
            <AlertDialog open={!!showCloseTabDialog} onOpenChange={() => setShowCloseTabDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Close search tab?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will discard all prospects in this tab. Approved vendors are already saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (showCloseTabDialog) { closeCampaign(showCloseTabDialog); setShowCloseTabDialog(null); } }}>
                            Close Tab
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
