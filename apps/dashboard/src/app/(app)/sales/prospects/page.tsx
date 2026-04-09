'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FACILITY_TYPE_LABELS, inferFacilityType, type FacilityType } from '@xiri-facility-solutions/shared';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
    DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import {
    Search, Loader2, Building2, Mail, Phone, Globe, User,
    MapPin, Star, CheckCircle2, AlertCircle, XCircle,
    ChevronDown, Target, SendHorizonal, ListPlus, Plus,
    Settings, Play, SkipForward, ExternalLink, X,
    Calendar, TrendingUp, Zap, Filter, RefreshCw,
    Tag,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────

interface ProspectContact {
    email: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    confidence?: number;
    type: 'personal' | 'generic';
    provider: string;
}

interface QueuedProspect {
    id: string;
    businessName: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    contactEmail?: string;
    genericEmail?: string;
    contactName?: string;
    contactTitle?: string;
    emailSource?: string;
    emailConfidence?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    enrichmentLog?: string[];
    allContacts?: ProspectContact[];
    status: string;
    batchDate: string;
    searchQuery: string;
    searchLocation: string;
    companyId?: string;
    contactId?: string;
    actionedAt?: any;
    createdAt?: any;
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

interface ProspectingConfig {
    queries: string[];
    locations: string[];
    dailyTarget: number;
    enabled: boolean;
    excludePatterns: string[];
    lastRunAt?: any;
    lastRunStats?: {
        discovered: number;
        withEmail: number;
        added: number;
        duplicatesSkipped: number;
        queryYield?: Record<string, { discovered: number; qualified: number }>;
        locationYield?: Record<string, { discovered: number; qualified: number }>;
    };
}

// ── Confidence badge helper ─────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence?: string }) {
    switch (confidence) {
        case 'high':
            return <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5"><CheckCircle2 className="w-3 h-3 mr-0.5" />High</Badge>;
        case 'medium':
            return <Badge className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5"><AlertCircle className="w-3 h-3 mr-0.5" />Med</Badge>;
        default:
            return <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1.5"><XCircle className="w-3 h-3 mr-0.5" />Low</Badge>;
    }
}

// ── Main Page ───────────────────────────────────────────────────────

export default function ProspectsPage() {
    const { toast } = useToast();
    const [prospects, setProspects] = useState<QueuedProspect[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('pending_review');
    const [facilityTypeFilter, setFacilityTypeFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [acting, setActing] = useState(false);
    const [triggering, setTriggering] = useState(false);

    // Progress polling state
    interface RunStatus {
        running: boolean;
        discovered: number;
        qualified: number;
        duplicatesSkipped: number;
        target: number;
        currentQuery: string | null;
        completedAt?: any;
        updatedAt?: any;
    }
    const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
    const [polling, setPolling] = useState(false);

    // Config state
    const [config, setConfig] = useState<ProspectingConfig | null>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);
    const [editQueries, setEditQueries] = useState<string[]>([]);
    const [newQuery, setNewQuery] = useState('');
    const [editLocations, setEditLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [editTarget, setEditTarget] = useState(100);
    const [editEnabled, setEditEnabled] = useState(true);
    const [editExclude, setEditExclude] = useState<string[]>([]);
    const [newExclude, setNewExclude] = useState('');

    // Template/sequence options for the action dropdown
    const [templates, setTemplates] = useState<TemplateOption[]>([]);
    const [sequences, setSequences] = useState<SequenceOption[]>([]);

    // ── Load prospects from Firestore ────────────────────────────────

    useEffect(() => {
        const q = query(
            collection(db, 'prospect_queue'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            const list: QueuedProspect[] = [];
            snap.forEach((d) => {
                list.push({ id: d.id, ...d.data() } as QueuedProspect);
            });
            setProspects(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // ── Load config ─────────────────────────────────────────────────

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const snap = await getDoc(doc(db, 'prospecting_config', 'default'));
                if (snap.exists()) {
                    const data = snap.data() as ProspectingConfig;
                    setConfig(data);
                    setEditQueries(data.queries || []);
                    setEditLocations(data.locations || []);
                    setEditTarget(data.dailyTarget || 100);
                    setEditEnabled(data.enabled !== false);
                    setEditExclude(data.excludePatterns || []);
                }
            } catch (err) {
                console.error('Failed to load prospecting config:', err);
            }
        };
        loadConfig();
    }, []);

    // Check if a run is already in progress on mount
    useEffect(() => {
        const checkRunning = async () => {
            try {
                const snap = await getDoc(doc(db, 'prospecting_config', 'run_status'));
                if (snap.exists()) {
                    const data = snap.data() as RunStatus;
                    setRunStatus(data);
                    if (data.running) {
                        setPolling(true);
                    }
                }
            } catch (err) {
                console.error('Error checking run status:', err);
            }
        };
        checkRunning();
    }, []);

    // ── Load template & sequence options ─────────────────────────────

    const loadOptions = useCallback(async () => {
        if (templates.length > 0 && sequences.length > 0) return;
        try {
            const [tSnap, sSnap] = await Promise.all([
                getDocs(query(collection(db, 'templates'), where('category', '==', 'lead_outreach'))),
                getDocs(collection(db, 'sequences')),
            ]);
            setTemplates(tSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.id,
                subject: d.data().subject || '',
                category: d.data().category,
            })));
            setSequences(sSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.id,
                description: d.data().description,
                stepCount: d.data().steps?.length || 0,
                category: d.data().category,
            })));
        } catch (err) {
            console.error('Failed to load templates/sequences:', err);
        }
    }, [templates.length, sequences.length]);

    // ── Facility type mapping (from @xiri-facility-solutions/shared) ──

    /** Unique facility types present in the current dataset with counts. */
    const facilityTypeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of prospects) {
            const ft = inferFacilityType(p.searchQuery) || 'unknown';
            counts.set(ft, (counts.get(ft) || 0) + 1);
        }
        return counts;
    }, [prospects, inferFacilityType]);

    // ── Filtering ───────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = prospects;

        if (statusFilter !== 'all') {
            list = list.filter(p => p.status === statusFilter);
        }

        if (facilityTypeFilter !== 'all') {
            list = list.filter(p => {
                const ft = inferFacilityType(p.searchQuery) || 'unknown';
                return ft === facilityTypeFilter;
            });
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.businessName?.toLowerCase().includes(q) ||
                p.address?.toLowerCase().includes(q) ||
                p.contactEmail?.toLowerCase().includes(q) ||
                p.contactName?.toLowerCase().includes(q) ||
                p.searchLocation?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [prospects, statusFilter, facilityTypeFilter, search, inferFacilityType]);

    // ── Stats ───────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return {
            total: prospects.length,
            pending: prospects.filter(p => p.status === 'pending_review').length,
            todayBatch: prospects.filter(p => p.batchDate === today).length,
            imported: prospects.filter(p => p.status === 'imported' || p.status === 'emailed' || p.status === 'sequenced').length,
            skipped: prospects.filter(p => p.status === 'skipped').length,
        };
    }, [prospects]);

    // ── Actions ──────────────────────────────────────────────────────

    const selectedProspects = useMemo(() =>
        filtered.filter(p => selected.has(p.id)),
        [filtered, selected]
    );

    const handleSkip = async (ids: string[]) => {
        setActing(true);
        try {
            const batch = writeBatch(db);
            for (const id of ids) {
                batch.update(doc(db, 'prospect_queue', id), {
                    status: 'skipped',
                    actionedAt: new Date(),
                });
            }
            await batch.commit();
            setSelected(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            toast({ title: `Skipped ${ids.length} prospect(s)` });
        } catch (err) {
            toast({ title: 'Error skipping', description: String(err) });
        }
        setActing(false);
    };

    const handleImportOnly = async (ids: string[]) => {
        setActing(true);
        try {
            const prospectsToImport = prospects.filter(p => ids.includes(p.id));
            const addFn = httpsCallable(functions, 'addProspectsToCrm');
            const result = await addFn({
                prospects: prospectsToImport.map(p => ({
                    businessName: p.businessName,
                    address: p.address,
                    phone: p.phone,
                    website: p.website,
                    rating: p.rating,
                    contactEmail: p.contactEmail,
                    genericEmail: p.genericEmail,
                    contactName: p.contactName,
                    contactTitle: p.contactTitle,
                    emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence,
                    facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl,
                    searchQuery: p.searchQuery,
                    allContacts: p.allContacts || [],
                })),
            });

            const data = result.data as any;
            const batch = writeBatch(db);
            for (let i = 0; i < ids.length; i++) {
                const imported = data.results?.[i];
                batch.update(doc(db, 'prospect_queue', ids[i]), {
                    status: 'imported',
                    companyId: imported?.companyId || null,
                    contactId: imported?.contactId || null,
                    actionedAt: new Date(),
                });
            }
            await batch.commit();

            setSelected(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            toast({ title: `Imported ${data.imported || ids.length} prospects (${data.totalContacts || ids.length} contacts) to CRM` });
        } catch (err) {
            toast({ title: 'Import failed', description: String(err) });
        }
        setActing(false);
    };

    const handleImportAndEmail = async (ids: string[], templateId: string) => {
        setActing(true);
        try {
            const prospectsToImport = prospects.filter(p => ids.includes(p.id));
            const addFn = httpsCallable(functions, 'addProspectsToCrm');
            const result = await addFn({
                prospects: prospectsToImport.map(p => ({
                    businessName: p.businessName, address: p.address, phone: p.phone,
                    website: p.website, rating: p.rating, contactEmail: p.contactEmail,
                    genericEmail: p.genericEmail, contactName: p.contactName,
                    contactTitle: p.contactTitle, emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence, facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl, searchQuery: p.searchQuery,
                    allContacts: p.allContacts || [],
                })),
            });

            const data = result.data as any;
            const emailFn = httpsCallable(functions, 'sendSingleLeadEmail');
            let emailsSent = 0;

            for (let i = 0; i < ids.length; i++) {
                const imported = data.results?.[i];
                if (imported?.companyId && imported?.contactId) {
                    try {
                        await emailFn({
                            leadId: imported.companyId,
                            contactId: imported.contactId,
                            templateId,
                        });
                        emailsSent++;
                    } catch { /* skip failed emails */ }
                }
            }

            const batch = writeBatch(db);
            for (let i = 0; i < ids.length; i++) {
                const imported = data.results?.[i];
                batch.update(doc(db, 'prospect_queue', ids[i]), {
                    status: 'emailed',
                    companyId: imported?.companyId || null,
                    contactId: imported?.contactId || null,
                    actionedAt: new Date(),
                });
            }
            await batch.commit();

            setSelected(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            toast({ title: `Imported ${ids.length} · Emailed ${emailsSent}` });
        } catch (err) {
            toast({ title: 'Error', description: String(err) });
        }
        setActing(false);
    };

    const handleImportAndSequence = async (ids: string[], sequenceId: string) => {
        setActing(true);
        try {
            const prospectsToImport = prospects.filter(p => ids.includes(p.id));
            const addFn = httpsCallable(functions, 'addProspectsToCrm');
            const result = await addFn({
                prospects: prospectsToImport.map(p => ({
                    businessName: p.businessName, address: p.address, phone: p.phone,
                    website: p.website, rating: p.rating, contactEmail: p.contactEmail,
                    genericEmail: p.genericEmail, contactName: p.contactName,
                    contactTitle: p.contactTitle, emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence, facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl,
                    allContacts: p.allContacts || [],
                })),
            });

            const data = result.data as any;
            const seqFn = httpsCallable(functions, 'startLeadSequence');
            let started = 0;

            for (let i = 0; i < ids.length; i++) {
                const imported = data.results?.[i];
                if (imported?.companyId && imported?.contactId) {
                    try {
                        await seqFn({
                            leadId: imported.companyId,
                            contactId: imported.contactId,
                            sequenceId,
                        });
                        started++;
                    } catch { /* skip failed */ }
                }
            }

            const batch = writeBatch(db);
            for (let i = 0; i < ids.length; i++) {
                const imported = data.results?.[i];
                batch.update(doc(db, 'prospect_queue', ids[i]), {
                    status: 'sequenced',
                    companyId: imported?.companyId || null,
                    contactId: imported?.contactId || null,
                    actionedAt: new Date(),
                });
            }
            await batch.commit();

            setSelected(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
            toast({ title: `Imported ${ids.length} · Started ${started} sequences` });
        } catch (err) {
            toast({ title: 'Error', description: String(err) });
        }
        setActing(false);
    };

    // ── Trigger pipeline manually ───────────────────────────────────

    const handleTriggerRun = async () => {
        setTriggering(true);
        try {
            const fn = httpsCallable(functions, 'triggerDailyProspector');
            // Fire-and-forget: don't await — the pipeline runs for several minutes.
            // We start polling the status doc immediately instead.
            fn().catch(err => {
                console.error('Prospector pipeline error:', err);
                // Only show error toast if it's a real failure, not a timeout
                toast({ title: 'Pipeline issue', description: 'Check logs for details.' });
            });

            toast({ title: 'Prospector pipeline started', description: 'Tracking progress below...' });
            // Give the function 2s to initialize and write the first status doc
            setTimeout(() => setPolling(true), 2000);
        } catch (err) {
            toast({ title: 'Trigger failed', description: String(err) });
        }
        setTriggering(false);
    };

    // ── Poll run_status doc while pipeline is running ────────────────

    useEffect(() => {
        if (!polling) return;

        const statusDocRef = doc(db, 'prospecting_config', 'run_status');
        let interval: ReturnType<typeof setInterval>;

        const STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

        const pollStatus = async () => {
            try {
                const snap = await getDoc(statusDocRef);
                if (snap.exists()) {
                    const data = snap.data() as RunStatus;
                    setRunStatus(data);

                    if (!data.running) {
                        // Pipeline finished — stop polling
                        setPolling(false);
                        if (data.error) {
                            toast({
                                title: 'Pipeline failed',
                                description: data.error,
                                variant: 'destructive',
                            });
                        } else {
                            toast({
                                title: 'Prospector complete!',
                                description: `Added ${data.qualified} prospects (${data.duplicatesSkipped} duplicates skipped).`,
                            });
                        }
                        return;
                    }

                    // Stale-run detection: if updatedAt is older than 10 min, auto-reset
                    const updatedAt = data.updatedAt?.toDate?.() ?? (data.updatedAt ? new Date(data.updatedAt) : null);
                    if (updatedAt && Date.now() - updatedAt.getTime() > STALE_TIMEOUT_MS) {
                        setPolling(false);
                        setRunStatus({ ...data, running: false });
                        toast({
                            title: 'Pipeline timed out',
                            description: `No progress for 10+ minutes. The pipeline may have crashed. You can re-run it.`,
                            variant: 'destructive',
                        });
                    }
                }
            } catch (err) {
                console.error('Error polling run status:', err);
            }
        };

        // Poll immediately then every 3s
        pollStatus();
        interval = setInterval(pollStatus, 3000);

        return () => clearInterval(interval);
    }, [polling, toast]);

    // ── Save config ─────────────────────────────────────────────────

    const handleSaveConfig = async () => {
        setConfigSaving(true);
        try {
            // Process inputs separately
            const getUniqueArray = (items: string[], pending?: string) => {
                const map = new Map<string, string>();
                const list = [...items];
                if (pending && pending.trim()) list.push(pending.trim());
                list.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
                });
                return Array.from(map.values());
            }

            const newConfig = {
                queries: getUniqueArray(editQueries, newQuery),
                locations: getUniqueArray(editLocations, newLocation),
                dailyTarget: editTarget,
                enabled: editEnabled,
                excludePatterns: getUniqueArray(editExclude, newExclude),
            };
            await setDoc(doc(db, 'prospecting_config', 'default'), newConfig, { merge: true });
            setConfig(prev => prev ? { ...prev, ...newConfig } : newConfig as ProspectingConfig);
            
            setEditQueries(newConfig.queries);
            setEditLocations(newConfig.locations);
            setEditExclude(newConfig.excludePatterns);
            setNewQuery('');
            setNewLocation('');
            setNewExclude('');
            setConfigOpen(false);
            toast({ title: 'Config saved', description: 'Duplicates automatically removed.' });
        } catch (err) {
            toast({ title: 'Save failed', description: String(err) });
        }
        setConfigSaving(false);
    };

    // ── Select helpers ──────────────────────────────────────────────

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map(p => p.id)));
        }
    };

    // ── Render ───────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Target className="w-6 h-6 text-primary" />
                        Prospect Queue
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Auto-discovered prospects ready for your review. Take action or skip.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Settings className="w-4 h-4 mr-1" />
                                Config
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Prospecting Configuration</DialogTitle>
                                <DialogDescription>
                                    Configure what the daily prospector searches for.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                <div>
                                    <label className="text-sm font-medium">Search Queries</label>
                                    <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                        {editQueries.map(q => (
                                            <Badge key={q} variant="secondary" className="flex items-center gap-1 group">
                                                {q}
                                                <X
                                                    className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                                                    onClick={() => setEditQueries(prev => prev.filter(x => x !== q))}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Add query (press Enter)..."
                                        value={newQuery}
                                        onChange={e => setNewQuery(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newQuery.trim()) {
                                                e.preventDefault();
                                                if (!editQueries.some(q => q.toLowerCase() === newQuery.trim().toLowerCase())) {
                                                    setEditQueries(prev => [...prev, newQuery.trim()]);
                                                }
                                                setNewQuery('');
                                            }
                                        }}
                                        className="mb-2"
                                    />
                                    {Object.values(FACILITY_TYPE_LABELS).filter(label => !editQueries.some(q => q.toLowerCase() === label.toLowerCase())).length > 0 && (
                                        <div className="mt-2">
                                            <span className="text-xs text-muted-foreground mb-2 block font-medium">Expand your search:</span>
                                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pb-1">
                                                {Object.values(FACILITY_TYPE_LABELS)
                                                    .filter(label => !editQueries.some(q => q.toLowerCase() === label.toLowerCase()))
                                                    .map(label => (
                                                        <Badge
                                                            key={label}
                                                            variant="secondary"
                                                            className="text-[10px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-normal py-0 h-5"
                                                            onClick={() => {
                                                                if (!editQueries.some(q => q.toLowerCase() === label.toLowerCase())) {
                                                                    setEditQueries(prev => [...prev, label]);
                                                                }
                                                            }}
                                                        >
                                                            <Plus className="w-3 h-3 mr-0.5 inline" />
                                                            {label}
                                                        </Badge>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="text-sm font-medium">Locations</label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-xs text-blue-600 hover:text-blue-700 px-1 py-0 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                const lines = [...editLocations];
                                                const countyLineIndex = lines.findIndex(l => l.toLowerCase().includes('county') || l.toLowerCase().includes('region') || l.toLowerCase().includes('area'));
                                                
                                                if (countyLineIndex === -1 && lines.length > 0) {
                                                    toast({ title: "Using first location...", description: `Expanding: ${lines[0]}...` });
                                                } else if (lines.length === 0 && !newLocation.trim()) {
                                                    toast({ title: "No location found", description: "Please type a county (e.g. 'Nassau County, NY') and press enter to add it before expanding.", variant: "destructive" });
                                                    return;
                                                }

                                                let targetLineIndex = countyLineIndex !== -1 ? countyLineIndex : 0;
                                                let targetLine = lines[targetLineIndex];

                                                if (lines.length === 0 && newLocation.trim()) {
                                                    targetLine = newLocation.trim();
                                                }

                                                toast({ title: "Expanding...", description: `Using AI to expand ${targetLine} into towns...` });
                                                try {
                                                    const expandFn = httpsCallable(functions, 'expandLocation');
                                                    const res = await expandFn({ location: targetLine });
                                                    const towns = (res.data as any).towns as string[];
                                                    
                                                    // replace the line with the towns
                                                    const newLines = [...lines];
                                                    if (lines.length > 0) {
                                                      newLines.splice(targetLineIndex, 1, ...towns);
                                                    } else {
                                                      newLines.push(...towns);
                                                      setNewLocation('');
                                                    }
                                                    
                                                    // Deduplicate towns before setting
                                                    const uniqueSet = new Set(newLines.map(t => t.toLowerCase()));
                                                    const deduplicated = newLines.filter(t => {
                                                        if (uniqueSet.has(t.toLowerCase())) {
                                                            uniqueSet.delete(t.toLowerCase());
                                                            return true;
                                                        }
                                                        return false;
                                                    });
                                                    
                                                    setEditLocations(deduplicated);
                                                    toast({ title: "Expanded successfully!", description: `Added ${towns.length} towns.` });
                                                } catch (err: any) {
                                                    toast({ title: "Error", description: err.message, variant: "destructive" });
                                                }
                                            }}
                                        >
                                            <Zap className="w-3 h-3 mr-1" />
                                            Auto-Expand Location
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {editLocations.map(l => (
                                            <Badge key={l} variant="secondary" className="flex items-center gap-1 group">
                                                {l}
                                                <X
                                                    className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                                                    onClick={() => setEditLocations(prev => prev.filter(x => x !== l))}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Add location (press Enter)..."
                                        value={newLocation}
                                        onChange={e => setNewLocation(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newLocation.trim()) {
                                                e.preventDefault();
                                                if (!editLocations.some(l => l.toLowerCase() === newLocation.trim().toLowerCase())) {
                                                    setEditLocations(prev => [...prev, newLocation.trim()]);
                                                }
                                                setNewLocation('');
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        For best results, use specific towns or cities rather than whole counties. 
                                        Type a county and click the AI button above to automatically generate a town list.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-sm font-medium">Daily Target</label>
                                        <Input
                                            type="number"
                                            className="mt-1"
                                            value={editTarget}
                                            onChange={e => setEditTarget(Number(e.target.value))}
                                            min={10}
                                            max={500}
                                        />
                                    </div>
                                    <div className="flex-1 flex items-end">
                                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                            <Checkbox
                                                checked={editEnabled}
                                                onCheckedChange={(v: boolean) => setEditEnabled(v)}
                                            />
                                            Pipeline Enabled
                                        </label>
                                    </div>
                                </div>
                                <div>
                                <div>
                                    <label className="text-sm font-medium">Exclude Patterns</label>
                                    <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                        {editExclude.map(p => (
                                            <Badge key={p} variant="secondary" className="flex items-center gap-1 group">
                                                {p}
                                                <X
                                                    className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                                                    onClick={() => setEditExclude(prev => prev.filter(x => x !== p))}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Add exclude pattern (press Enter)..."
                                        value={newExclude}
                                        onChange={e => setNewExclude(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newExclude.trim()) {
                                                e.preventDefault();
                                                if (!editExclude.some(p => p.toLowerCase() === newExclude.trim().toLowerCase())) {
                                                    setEditExclude(prev => [...prev, newExclude.trim()]);
                                                }
                                                setNewExclude('');
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
                                <Button onClick={handleSaveConfig} disabled={configSaving}>
                                    {configSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTriggerRun}
                        disabled={triggering}
                    >
                        {triggering
                            ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            : <Play className="w-4 h-4 mr-1" />
                        }
                        Run Now
                    </Button>
                </div>
            </div>

            {/* Progress banner */}
            {(polling || (runStatus && runStatus.running)) && runStatus && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Pipeline Running...</span>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                            {runStatus.qualified} / {runStatus.target} qualified
                        </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mb-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (runStatus.qualified / runStatus.target) * 100)}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                        <div className="flex gap-4">
                            <span>Discovered: {runStatus.discovered}</span>
                            <span>Qualified: {runStatus.qualified}</span>
                            <span>Dupes Skipped: {runStatus.duplicatesSkipped}</span>
                        </div>
                        {runStatus.currentQuery && (
                            <span className="italic truncate max-w-xs">Searching: {runStatus.currentQuery}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Completed banner */}
            {runStatus && !runStatus.running && !polling && runStatus.completedAt && (
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                            Last run: Added {runStatus.qualified} prospects ({runStatus.discovered} found, {runStatus.duplicatesSkipped} dupes skipped)
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setRunStatus(null)} className="text-green-600 h-6 px-2">
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            {/* Stats bar */}
            <div className="grid grid-cols-5 gap-3">
                {[
                    { label: 'Pending Review', value: stats.pending, icon: Target, color: 'text-blue-600' },
                    { label: "Today's Batch", value: stats.todayBatch, icon: Calendar, color: 'text-indigo-600' },
                    { label: 'Imported', value: stats.imported, icon: CheckCircle2, color: 'text-green-600' },
                    { label: 'Skipped', value: stats.skipped, icon: SkipForward, color: 'text-gray-500' },
                    { label: 'Total Queued', value: stats.total, icon: TrendingUp, color: 'text-primary' },
                ].map(s => (
                    <div key={s.label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                        <div>
                            <div className="text-xl font-bold">{s.value}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Last run info */}
            {config?.lastRunStats && (
                <div className="text-xs text-muted-foreground flex items-center gap-4 bg-muted/50 rounded-lg px-3 py-2">
                    <span>Last run: {config.lastRunAt?.toDate ? config.lastRunAt.toDate().toLocaleString() : 'Unknown'}</span>
                    <span>·</span>
                    <span>Discovered {config.lastRunStats.discovered}</span>
                    <span>·</span>
                    <span>Added {config.lastRunStats.added} with email</span>
                    <span>·</span>
                    <span>{config.lastRunStats.duplicatesSkipped} duplicates skipped</span>
                </div>
            )}

            {/* Facility type filter badges */}
            {facilityTypeCounts.size > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Type:
                    </span>
                    <Badge
                        variant={facilityTypeFilter === 'all' ? 'default' : 'outline'}
                        className="cursor-pointer text-xs hover:bg-primary/10 transition-colors"
                        onClick={() => setFacilityTypeFilter('all')}
                    >
                        All ({prospects.length})
                    </Badge>
                    {Array.from(facilityTypeCounts.entries())
                        .sort(([, a], [, b]) => b - a)
                        .map(([ft, count]) => (
                            <Badge
                                key={ft}
                                variant={facilityTypeFilter === ft ? 'default' : 'outline'}
                                className="cursor-pointer text-xs hover:bg-primary/10 transition-colors"
                                onClick={() => setFacilityTypeFilter(ft === facilityTypeFilter ? 'all' : ft)}
                            >
                                {ft === 'unknown' ? 'Uncategorized' : FACILITY_TYPE_LABELS[ft as FacilityType] || ft} ({count})
                            </Badge>
                        ))
                    }
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, address, email..."
                        className="pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Status filter tabs */}
                <div className="flex rounded-lg border overflow-hidden text-sm">
                    {[
                        { key: 'pending_review', label: 'Pending' },
                        { key: 'imported', label: 'Imported' },
                        { key: 'skipped', label: 'Skipped' },
                        { key: 'all', label: 'All' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className={`px-3 py-1.5 transition-colors ${statusFilter === tab.key
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                                }`}
                            onClick={() => setStatusFilter(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Bulk actions */}
                {selected.size > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSkip(Array.from(selected))}
                            disabled={acting}
                        >
                            <SkipForward className="w-4 h-4 mr-1" />
                            Skip
                        </Button>
                        <DropdownMenu onOpenChange={(open: boolean) => { if (open) loadOptions(); }}>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" disabled={acting}>
                                    {acting
                                        ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        : <Zap className="w-4 h-4 mr-1" />
                                    }
                                    Action ({selected.size})
                                    <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => handleImportOnly(Array.from(selected))}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add to CRM Only
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <SendHorizonal className="w-4 h-4 mr-2" />
                                        Import + Send Email
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {templates.length === 0 && (
                                            <DropdownMenuItem disabled>No templates found</DropdownMenuItem>
                                        )}
                                        {templates.map(t => (
                                            <DropdownMenuItem
                                                key={t.id}
                                                onClick={() => handleImportAndEmail(Array.from(selected), t.id)}
                                            >
                                                <Mail className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                                {t.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ListPlus className="w-4 h-4 mr-2" />
                                        Import + Add to Sequence
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {sequences.length === 0 && (
                                            <DropdownMenuItem disabled>No sequences found</DropdownMenuItem>
                                        )}
                                        {sequences.map(s => (
                                            <DropdownMenuItem
                                                key={s.id}
                                                onClick={() => handleImportAndSequence(Array.from(selected), s.id)}
                                            >
                                                <ListPlus className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                                {s.name} ({s.stepCount} steps)
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Loading prospects...
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Target className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-lg font-medium">No prospects yet</p>
                    <p className="text-sm mt-1">
                        {statusFilter === 'pending_review'
                            ? 'Click "Run Now" to trigger the prospector or wait for the daily 6 AM run.'
                            : 'No prospects match the current filter.'}
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[40px_1fr_200px_180px_100px_80px_120px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center justify-center">
                            <Checkbox
                                checked={selected.size === filtered.length && filtered.length > 0}
                                onCheckedChange={toggleAll}
                            />
                        </div>
                        <div>Business</div>
                        <div>Location</div>
                        <div>Contact</div>
                        <div>Confidence</div>
                        <div>Rating</div>
                        <div>Actions</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y max-h-[calc(100vh-400px)] overflow-y-auto">
                        {filtered.map(prospect => (
                            <div
                                key={prospect.id}
                                className={`grid grid-cols-[40px_1fr_200px_180px_100px_80px_120px] gap-2 px-3 py-2.5 items-center text-sm hover:bg-muted/30 transition-colors ${selected.has(prospect.id) ? 'bg-primary/5' : ''}`}
                            >
                                {/* Checkbox */}
                                <div className="flex items-center justify-center">
                                    <Checkbox
                                        checked={selected.has(prospect.id)}
                                        onCheckedChange={() => toggleSelect(prospect.id)}
                                    />
                                </div>

                                {/* Business */}
                                <div className="min-w-0">
                                    <div className="font-medium truncate flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        {prospect.businessName}
                                        {prospect.website && (
                                            <a
                                                href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {(() => {
                                            const ft = inferFacilityType(prospect.searchQuery);
                                            return ft ? (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                                    {FACILITY_TYPE_LABELS[ft]}
                                                </Badge>
                                            ) : null;
                                        })()}
                                        {prospect.phone && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {prospect.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {prospect.address || prospect.searchLocation}
                                </div>

                                {/* Contact */}
                                <div className="min-w-0">
                                    {prospect.contactEmail ? (
                                        <div className="text-xs truncate flex items-center gap-1">
                                            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                                            <span className="truncate">{prospect.contactEmail}</span>
                                        </div>
                                    ) : prospect.genericEmail ? (
                                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                            <Mail className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{prospect.genericEmail}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">No email</span>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {prospect.contactName && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {prospect.contactName}
                                            </span>
                                        )}
                                        {(prospect.allContacts?.length ?? 0) > 1 && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-blue-600 border-blue-200 dark:border-blue-800">
                                                {prospect.allContacts!.length} contacts
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Confidence */}
                                <div>
                                    <ConfidenceBadge confidence={prospect.emailConfidence} />
                                </div>

                                {/* Rating */}
                                <div className="text-xs text-muted-foreground">
                                    {prospect.rating ? (
                                        <span className="flex items-center gap-0.5">
                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                            {prospect.rating}
                                        </span>
                                    ) : '—'}
                                </div>

                                {/* Row actions */}
                                <div className="flex items-center gap-1">
                                    {prospect.status === 'pending_review' ? (
                                        <>
                                            <DropdownMenu onOpenChange={(open: boolean) => { if (open) loadOptions(); }}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                                        title="Import to CRM"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuItem onClick={() => handleImportOnly([prospect.id])}>
                                                        <Plus className="w-3.5 h-3.5 mr-2" />
                                                        Add to CRM Only
                                                    </DropdownMenuItem>
                                                    {sequences.length > 0 && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger>
                                                                    <ListPlus className="w-3.5 h-3.5 mr-2" />
                                                                    Import + Sequence
                                                                </DropdownMenuSubTrigger>
                                                                <DropdownMenuSubContent>
                                                                    {sequences.map(s => (
                                                                        <DropdownMenuItem
                                                                            key={s.id}
                                                                            onClick={() => handleImportAndSequence([prospect.id], s.id)}
                                                                        >
                                                                            <ListPlus className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                                                            {s.name} ({s.stepCount} steps)
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuSub>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                title="Skip"
                                                onClick={() => handleSkip([prospect.id])}
                                            >
                                                <SkipForward className="w-3.5 h-3.5" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px]">
                                            {prospect.status === 'imported' && '✓ Imported'}
                                            {prospect.status === 'emailed' && '✉ Emailed'}
                                            {prospect.status === 'sequenced' && '📋 Sequenced'}
                                            {prospect.status === 'skipped' && '⏭ Skipped'}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
