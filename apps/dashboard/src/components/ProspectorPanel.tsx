'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
    DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import {
    Search, Loader2, Download, Building2, Mail, Phone, Globe, User,
    MapPin, Star, Facebook, Linkedin, CheckCircle2, AlertCircle, XCircle,
    ChevronDown, ChevronUp, Zap, Radar, X, SendHorizonal, ListPlus, Plus,
} from 'lucide-react';

// Inlined from shared package to avoid build-order dependency
interface EnrichedProspect {
    businessName: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    userRatingsTotal?: number;
    contactName?: string;
    contactTitle?: string;
    contactEmail?: string;
    genericEmail?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    emailSource: string;
    emailConfidence: string;
    enrichmentLog?: string[];
    allContacts?: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
        position?: string;
        confidence?: number;
        type: 'personal' | 'generic';
        provider: string;
    }>;
}

interface TemplateOption {
    id: string;
    name: string;
    subject: string;
    category?: string;
}

interface SequenceOption {
    id: string;
    name: string;
    description?: string;
    stepCount: number;
    category?: string;
}

const BUSINESS_TYPES = [
    'dentist', 'medical office', 'dental office', 'doctor office',
    'veterinarian', 'chiropractor', 'optometrist', 'dermatologist',
    'physical therapy', 'pharmacy', 'urgent care',
    'law firm', 'accounting firm', 'insurance agency',
    'real estate office', 'financial advisor',
    'restaurant', 'gym', 'salon', 'spa', 'daycare',
    'auto repair', 'dry cleaner', 'pet grooming',
];

interface ProspectorPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProspectorPanel({ isOpen, onClose }: ProspectorPanelProps) {
    const { toast } = useToast();

    // Search state
    const [businessType, setBusinessType] = useState('');
    const [customType, setCustomType] = useState('');
    const [location, setLocation] = useState('New Hyde Park, NY');
    const [maxResults, setMaxResults] = useState(20);
    const [skipPaidApis, setSkipPaidApis] = useState(false);

    // Results state
    const [prospects, setProspects] = useState<EnrichedProspect[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [importing, setImporting] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Cached template & sequence lists (loaded once when dropdown opens)
    const [templates, setTemplates] = useState<TemplateOption[]>([]);
    const [sequences, setSequences] = useState<SequenceOption[]>([]);
    const [loadedOptions, setLoadedOptions] = useState(false);

    // ─── Load templates & sequences on first dropdown open ───
    const loadOptions = useCallback(async () => {
        if (loadedOptions) return;
        try {
            const [tplSnap, seqSnap] = await Promise.all([
                getDocs(collection(db, 'templates')),
                getDocs(collection(db, 'sequences')),
            ]);

            // Deduplicate templates: only pick the base (non-variant) ones
            const tpls: TemplateOption[] = tplSnap.docs
                .map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        name: data.name || d.id,
                        subject: data.subject || '',
                        category: data.category || '',
                        variant: data.variant || null,
                    };
                })
                .filter(t => !t.variant) // Exclude cold/warm variants — only show base templates
                .map(({ variant, ...rest }) => rest);

            const LEAD_CATEGORIES = ['lead', 'referral', 'custom'];
            const seqs: SequenceOption[] = seqSnap.docs
                .map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        name: data.name || d.id,
                        description: data.description || '',
                        stepCount: data.steps?.length || 0,
                        category: data.category || '',
                    };
                })
                .filter(s => !s.category || LEAD_CATEGORIES.includes(s.category));

            setTemplates(tpls);
            setSequences(seqs);
            setLoadedOptions(true);
        } catch (err) {
            console.error('Error loading templates/sequences:', err);
        }
    }, [loadedOptions]);

    const handleSearch = useCallback(async () => {
        const query = customType || businessType;
        if (!query || !location) {
            toast({ title: 'Missing fields', description: 'Select a business type and location.' });
            return;
        }

        setLoading(true);
        setProspects([]);
        setStats(null);
        setSelected(new Set());

        try {
            const runProspector = httpsCallable(functions, 'runProspector', { timeout: 540000 });
            const result = await runProspector({ query, location, maxResults, skipPaidApis });
            const data = result.data as any;

            setProspects(data.prospects || []);
            setStats(data.stats);

            toast({
                title: 'Prospecting complete',
                description: `Found ${data.prospects?.length || 0} businesses. ${data.stats?.withPersonalEmail || 0} with personal emails.`,
            });
        } catch (error: any) {
            console.error('Prospecting error:', error);
            toast({ title: 'Error', description: error.message || 'Prospecting failed.' });
        } finally {
            setLoading(false);
        }
    }, [businessType, customType, location, maxResults, skipPaidApis, toast]);

    // ─── Import: Add Only ────────────────────────────────────
    const handleAddOnly = useCallback(async () => {
        if (selected.size === 0) return;
        setImporting(true);
        try {
            const selectedProspects = prospects.filter((_, i) => selected.has(i));
            const addToCrm = httpsCallable(functions, 'addProspectsToCrm');
            const result = await addToCrm({ prospects: selectedProspects.map(p => ({ ...p, allContacts: p.allContacts || [] })) });
            const data = result.data as any;

            toast({
                title: 'Imported to CRM',
                description: `Created ${data.imported} company + contact records.`,
            });

            setProspects(prev => prev.filter((_, i) => !selected.has(i)));
            setSelected(new Set());
        } catch (error: any) {
            console.error('CRM import error:', error);
            toast({ title: 'Import failed', description: error.message });
        } finally {
            setImporting(false);
        }
    }, [selected, prospects, toast]);

    // ─── Import + Send Single Email ──────────────────────────
    const handleSendEmail = useCallback(async (templateId: string, templateName: string) => {
        if (selected.size === 0) return;
        setImporting(true);
        try {
            // Step 1: Import to CRM
            const selectedProspects = prospects.filter((_, i) => selected.has(i));
            const addToCrm = httpsCallable(functions, 'addProspectsToCrm');
            const importResult = await addToCrm({ prospects: selectedProspects.map(p => ({ ...p, allContacts: p.allContacts || [] })) });
            const importData = importResult.data as { results: { companyId: string; contactId?: string; businessName: string }[]; imported: number };

            // Step 2: Send email to each imported prospect that has a contact
            const sendEmail = httpsCallable(functions, 'sendSingleLeadEmail');
            let sentCount = 0;
            let failCount = 0;

            for (const rec of importData.results) {
                if (!rec.contactId) {
                    failCount++;
                    continue;
                }
                try {
                    await sendEmail({ leadId: rec.companyId, contactId: rec.contactId, templateId });
                    sentCount++;
                } catch (err: any) {
                    console.error(`Failed to send email for ${rec.businessName}:`, err);
                    failCount++;
                }
            }

            toast({
                title: 'Imported & emailed',
                description: `Imported ${importData.imported} records. Sent "${templateName}" to ${sentCount}${failCount > 0 ? ` (${failCount} failed)` : ''}.`,
            });

            setProspects(prev => prev.filter((_, i) => !selected.has(i)));
            setSelected(new Set());
        } catch (error: any) {
            console.error('Import + email error:', error);
            toast({ title: 'Error', description: error.message });
        } finally {
            setImporting(false);
        }
    }, [selected, prospects, toast]);

    // ─── Import + Start Sequence ─────────────────────────────
    const handleStartSequence = useCallback(async (sequenceId: string, sequenceName: string) => {
        if (selected.size === 0) return;
        setImporting(true);
        try {
            // Step 1: Import to CRM
            const selectedProspects = prospects.filter((_, i) => selected.has(i));
            const addToCrm = httpsCallable(functions, 'addProspectsToCrm');
            const importResult = await addToCrm({ prospects: selectedProspects.map(p => ({ ...p, allContacts: p.allContacts || [] })) });
            const importData = importResult.data as { results: { companyId: string; contactId?: string; businessName: string }[]; imported: number };

            // Step 2: Start sequence for each imported prospect that has a contact
            const startSequence = httpsCallable(functions, 'startLeadSequence');
            let enrolledCount = 0;
            let failCount = 0;

            for (const rec of importData.results) {
                if (!rec.contactId) {
                    failCount++;
                    continue;
                }
                try {
                    await startSequence({ leadId: rec.companyId, contactId: rec.contactId, sequenceId });
                    enrolledCount++;
                } catch (err: any) {
                    console.error(`Failed to enroll ${rec.businessName} in sequence:`, err);
                    failCount++;
                }
            }

            toast({
                title: 'Imported & enrolled',
                description: `Imported ${importData.imported} records. Enrolled ${enrolledCount} in "${sequenceName}"${failCount > 0 ? ` (${failCount} failed)` : ''}.`,
            });

            setProspects(prev => prev.filter((_, i) => !selected.has(i)));
            setSelected(new Set());
        } catch (error: any) {
            console.error('Import + sequence error:', error);
            toast({ title: 'Error', description: error.message });
        } finally {
            setImporting(false);
        }
    }, [selected, prospects, toast]);

    const toggleSelect = (index: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === prospects.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(prospects.map((_, i) => i)));
        }
    };

    const toggleExpand = (index: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="border rounded-xl bg-card shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                        <Radar className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">Lead Prospector</h3>
                        <p className="text-xs text-muted-foreground">Discover businesses &amp; find decision-maker emails</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                        <DropdownMenu onOpenChange={(open: boolean) => { if (open) loadOptions(); }}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    disabled={importing}
                                    size="sm"
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                                >
                                    {importing ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                    Add {selected.size} to CRM
                                    <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                {/* Option 1: Add Only */}
                                <DropdownMenuItem
                                    onClick={handleAddOnly}
                                    className="gap-2 cursor-pointer"
                                >
                                    <Plus className="w-4 h-4 text-emerald-600" />
                                    <div>
                                        <div className="font-medium text-xs">Add Only</div>
                                        <div className="text-[10px] text-muted-foreground">Import to CRM without emailing</div>
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* Option 2: Send Single Email → submenu with templates */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                        <SendHorizonal className="w-4 h-4 text-blue-600" />
                                        <div>
                                            <div className="font-medium text-xs">Send Email</div>
                                            <div className="text-[10px] text-muted-foreground">Import + send a single template</div>
                                        </div>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-72 max-h-64 overflow-auto">
                                        {templates.length === 0 ? (
                                            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                                Loading templates...
                                            </DropdownMenuItem>
                                        ) : (
                                            templates.map(t => (
                                                <DropdownMenuItem
                                                    key={t.id}
                                                    onClick={() => handleSendEmail(t.id, t.name)}
                                                    className="flex-col items-start gap-0.5 cursor-pointer"
                                                >
                                                    <div className="font-medium text-xs">{t.name}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate w-full">
                                                        {t.subject}
                                                    </div>
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Option 3: Add to Sequence → submenu with sequences */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                        <ListPlus className="w-4 h-4 text-violet-600" />
                                        <div>
                                            <div className="font-medium text-xs">Add to Sequence</div>
                                            <div className="text-[10px] text-muted-foreground">Import + start a drip campaign</div>
                                        </div>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-72 max-h-64 overflow-auto">
                                        {sequences.length === 0 ? (
                                            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                                Loading sequences...
                                            </DropdownMenuItem>
                                        ) : (
                                            sequences.map(s => (
                                                <DropdownMenuItem
                                                    key={s.id}
                                                    onClick={() => handleStartSequence(s.id, s.name)}
                                                    className="flex-col items-start gap-0.5 cursor-pointer"
                                                >
                                                    <div className="font-medium text-xs">{s.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {s.stepCount} emails · {s.description}
                                                    </div>
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Search Form */}
            <div className="px-4 py-3 border-b bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Business Type</label>
                        <Select value={businessType} onValueChange={(v: string) => { setBusinessType(v); setCustomType(''); }}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {BUSINESS_TYPES.map(bt => (
                                    <SelectItem key={bt} value={bt}>{bt.charAt(0).toUpperCase() + bt.slice(1)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Or type custom..."
                            value={customType}
                            onChange={(e) => { setCustomType(e.target.value); setBusinessType(''); }}
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Location</label>
                        <Input
                            placeholder="City, State"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="h-9 text-xs"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Max Results</label>
                        <Select value={String(maxResults)} onValueChange={(v: string) => setMaxResults(Number(v))}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Options</label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer h-9 px-2 border rounded-md bg-background">
                            <Checkbox
                                checked={skipPaidApis}
                                onCheckedChange={(v: boolean | 'indeterminate') => setSkipPaidApis(!!v)}
                            />
                            Skip paid APIs
                        </label>
                    </div>

                    <Button
                        onClick={handleSearch}
                        disabled={loading || (!businessType && !customType) || !location}
                        className="gap-2 h-9"
                        size="sm"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        {loading ? 'Prospecting...' : 'Find & Enrich'}
                    </Button>
                </div>
            </div>

            {/* Stats Bar */}
            {stats && (
                <div className="flex gap-3 px-4 py-2 border-b bg-muted/20">
                    <StatBadge icon={<Building2 className="w-3 h-3" />} label="Discovered" value={stats.discovered} />
                    <StatBadge icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />} label="Personal" value={stats.withPersonalEmail} />
                    <StatBadge icon={<AlertCircle className="w-3 h-3 text-amber-500" />} label="Generic" value={stats.withGenericEmail} />
                    <StatBadge icon={<XCircle className="w-3 h-3 text-red-500" />} label="None" value={stats.noEmail} />
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">Prospecting in progress...</p>
                        <p className="text-xs text-muted-foreground">
                            Scraping sites, checking Facebook, calling enrichment APIs. ~1–3 min for {maxResults} businesses.
                        </p>
                    </div>
                </div>
            )}

            {/* Importing overlay */}
            {importing && (
                <div className="flex items-center justify-center py-8 gap-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-b">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Importing & processing...</p>
                        <p className="text-xs text-muted-foreground">
                            Creating CRM records and sending outreach. This may take a moment.
                        </p>
                    </div>
                </div>
            )}

            {/* Results */}
            {!loading && prospects.length > 0 && (
                <div className="max-h-[50vh] overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                            <tr className="border-b">
                                <th className="p-2.5 text-left w-8">
                                    <Checkbox
                                        checked={selected.size === prospects.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-2.5 text-left font-medium">Business</th>
                                <th className="p-2.5 text-left font-medium">Contact</th>
                                <th className="p-2.5 text-left font-medium">Email</th>
                                <th className="p-2.5 text-left font-medium">Phone</th>
                                <th className="p-2.5 text-left font-medium">Confidence</th>
                                <th className="p-2.5 text-left font-medium w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {prospects.map((p, i) => (
                                <ProspectRow
                                    key={i}
                                    prospect={p}
                                    index={i}
                                    isSelected={selected.has(i)}
                                    isExpanded={expandedRows.has(i)}
                                    onToggleSelect={() => toggleSelect(i)}
                                    onToggleExpand={() => toggleExpand(i)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Empty state while panel is open but no search run */}
            {!loading && prospects.length === 0 && !stats && (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-3">
                    <Search className="w-5 h-5 opacity-30" />
                    <p className="text-sm">Select a business type and location, then click <strong>Find &amp; Enrich</strong></p>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-background rounded-md text-xs border">
            {icon}
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-semibold">{value}</span>
        </div>
    );
}

function ConfidenceBadge({ prospect }: { prospect: EnrichedProspect }) {
    const hasPersonal = prospect.contactEmail && !/^(info|contact|hello|office|admin|sales|team|service|services|marketing)@/i.test(prospect.contactEmail);
    const hasGeneric = prospect.genericEmail || (prospect.contactEmail && !hasPersonal);
    const hasNone = !prospect.contactEmail && !prospect.genericEmail;

    if (hasPersonal) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] px-1.5 py-0">🟢 Personal</Badge>;
    if (hasGeneric) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0">🟡 Generic</Badge>;
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] px-1.5 py-0">🔴 None</Badge>;
}

function ProspectRow({
    prospect, index, isSelected, isExpanded, onToggleSelect, onToggleExpand
}: {
    prospect: EnrichedProspect;
    index: number;
    isSelected: boolean;
    isExpanded: boolean;
    onToggleSelect: () => void;
    onToggleExpand: () => void;
}) {
    const email = prospect.contactEmail || prospect.genericEmail;

    return (
        <>
            <tr className={`border-b hover:bg-muted/30 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                <td className="p-2.5">
                    <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
                </td>
                <td className="p-2.5">
                    <div className="font-medium text-xs">{prospect.businessName}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {prospect.address && (
                            <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {prospect.address.split(',').slice(0, 2).join(',')}
                            </span>
                        )}
                        {prospect.rating && (
                            <span className="flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 text-amber-500" /> {prospect.rating}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {prospect.website && (
                            <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                <Globe className="w-3 h-3" />
                            </a>
                        )}
                        {prospect.facebookUrl && (
                            <a href={prospect.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                                <Facebook className="w-3 h-3" />
                            </a>
                        )}
                        {prospect.linkedinUrl && (
                            <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-800 hover:underline">
                                <Linkedin className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                </td>
                <td className="p-2.5">
                    {prospect.contactName ? (
                        <div>
                            <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="font-medium text-xs">{prospect.contactName}</span>
                            </div>
                            {prospect.contactTitle && (
                                <div className="text-[10px] text-muted-foreground">{prospect.contactTitle}</div>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                </td>
                <td className="p-2.5">
                    {email ? (
                        <a href={`mailto:${email}`} className="flex items-center gap-1 text-blue-600 hover:underline text-[10px]">
                            <Mail className="w-3 h-3" /> {email}
                        </a>
                    ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                </td>
                <td className="p-2.5">
                    {prospect.phone ? (
                        <a href={`tel:${prospect.phone}`} className="flex items-center gap-1 text-[10px]">
                            <Phone className="w-3 h-3 text-muted-foreground" /> {prospect.phone}
                        </a>
                    ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                </td>
                <td className="p-2.5">
                    <ConfidenceBadge prospect={prospect} />
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                        {prospect.emailSource !== 'none' ? `via ${prospect.emailSource}` : ''}
                    </div>
                </td>
                <td className="p-2.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleExpand}
                        className="h-6 w-6 p-0"
                    >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                </td>
            </tr>
            {isExpanded && (
                <tr className="border-b bg-muted/20">
                    <td colSpan={7} className="p-2.5">
                        <div className="text-[10px] font-mono text-muted-foreground max-h-32 overflow-auto">
                            <p className="font-semibold mb-0.5">Enrichment Log:</p>
                            {prospect.enrichmentLog?.map((line: string, i: number) => (
                                <div key={i} className="py-0.5">{line}</div>
                            )) || <span>No log available</span>}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
