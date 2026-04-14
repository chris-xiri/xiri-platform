'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FACILITY_TYPE_LABELS, FACILITY_TYPE_OPTIONS, inferFacilityType, type FacilityType } from '@xiri-facility-solutions/shared';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
    DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, orderBy, where, getDocs, doc, updateDoc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import {
    Search, Loader2, Building2, Mail, Phone, Globe, User,
    MapPin, Star, CheckCircle2, AlertCircle, XCircle,
    ChevronDown, ChevronRight, Target, SendHorizonal, ListPlus, Plus,
    Settings, Play, SkipForward, ExternalLink, X,
    Calendar, TrendingUp, Zap, Filter, RefreshCw,
    Tag, Users, AlertTriangle, Sparkles, Pencil, Check,
} from 'lucide-react';
import type { ProspectingConfig, QueuedProspect } from './components/types';
import { ConfigPanel } from './components/ConfigPanel';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import type { RecommendationAction } from './components/RecommendationsPanel';

// ── Local-only types (not exported) ─────────────────────────────────

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

    // ── Inline contact editing ──────────────────────────────────────
    const [editingContact, setEditingContact] = useState<string | null>(null); // prospect id being edited
    const [editEmail, setEditEmail] = useState('');
    const [editName, setEditName] = useState('');
    const [savingContact, setSavingContact] = useState(false);

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
        error?: string;
    }
    const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
    const [polling, setPolling] = useState(false);

    // Config state
    const [config, setConfig] = useState<ProspectingConfig | null>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);
    const [editQueries, setEditQueries] = useState<string[]>([]);
    const [editLocations, setEditLocations] = useState<string[]>([]);
    const [editTarget, setEditTarget] = useState(100);
    const [editEnabled, setEditEnabled] = useState(true);
    const [editExclude, setEditExclude] = useState<string[]>([]);

    // Template/sequence options for the action dropdown
    const [templates, setTemplates] = useState<TemplateOption[]>([]);
    const [sequences, setSequences] = useState<SequenceOption[]>([]);

    // ── Custom facility types from Firestore ────────────────────────
    const [customFacilityTypes, setCustomFacilityTypes] = useState<Record<string, string>>({});

    /** Merged labels: static well-known types + dynamic custom types from Firestore */
    const mergedFacilityLabels = useMemo(() => {
        return { ...FACILITY_TYPE_LABELS, ...customFacilityTypes } as Record<string, string>;
    }, [customFacilityTypes]);

    /** Merged options for dropdowns: static + custom, sorted alphabetically */
    const mergedFacilityOptions = useMemo(() => {
        const staticOpts = FACILITY_TYPE_OPTIONS.map(o => ({ value: o.value as string, label: o.label }));
        const customOpts = Object.entries(customFacilityTypes)
            .filter(([slug]) => !(slug in FACILITY_TYPE_LABELS))
            .map(([slug, label]) => ({ value: slug, label: `${label} ✦` }));
        return [...staticOpts, ...customOpts];
    }, [customFacilityTypes]);

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

    // ── Load custom facility types from Firestore (real-time) ──────
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'facility_types_custom'), (snap) => {
            const types: Record<string, string> = {};
            snap.forEach((d) => {
                types[d.id] = d.data().label || d.id;
            });
            setCustomFacilityTypes(types);
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

    // ── Expanded contacts state ─────────────────────────────────────
    const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
    const toggleContactsExpand = (id: string) => {
        setExpandedContacts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ── Facility type helpers ──────────────────────────────────────

    /** Get effective facility type: stored > inferred > unknown */
    const getEffectiveFacilityType = useCallback((p: QueuedProspect): string => {
        return p.facilityType || inferFacilityType(p.searchQuery) || 'unknown';
    }, []);

    /** Auto-persist inferred facility types so they flow to CRM on import */
    useEffect(() => {
        const toSave = prospects.filter(p => !p.facilityType && inferFacilityType(p.searchQuery));
        if (toSave.length === 0) return;

        const batch = writeBatch(db);
        for (const p of toSave) {
            const inferred = inferFacilityType(p.searchQuery)!;
            batch.update(doc(db, 'prospect_queue', p.id), { facilityType: inferred });
        }
        batch.commit().catch(err => console.error('Auto-save facility types failed:', err));
    }, [prospects]);

    /** Unique facility types present in pending_review prospects only, with counts.
     *  We only show pending counts in the pills so reps see what's actually actionable. */
    const facilityTypeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of prospects) {
            if (p.status !== 'pending_review') continue;
            const ft = getEffectiveFacilityType(p);
            counts.set(ft, (counts.get(ft) || 0) + 1);
        }
        return counts;
    }, [prospects, getEffectiveFacilityType]);

    /** Check if any selected prospects are uncategorized — gates sequence/email actions */
    const selectedUncategorizedCount = useMemo(() => {
        return Array.from(selected).filter(id => {
            const p = prospects.find(pr => pr.id === id);
            return p && getEffectiveFacilityType(p) === 'unknown';
        }).length;
    }, [selected, prospects, getEffectiveFacilityType]);
    const selectedHasUncategorized = selectedUncategorizedCount > 0;

    /** Detect clusters of 5+ uncategorized prospects sharing a common business term */
    const uncategorizedClusters = useMemo(() => {
        const uncategorized = prospects.filter(p =>
            p.status === 'pending_review' && getEffectiveFacilityType(p) === 'unknown'
        );
        if (uncategorized.length < 5) return [];

        // Extract meaningful terms from business names (2+ words get bigrams too)
        const termProspects = new Map<string, Set<string>>();
        const stopWords = new Set(['the', 'of', 'and', 'in', 'at', 'to', 'for', 'a', 'an', 'inc', 'llc', 'corp', 'ltd', 'pc', 'pllc', 'md', 'dds', 'dmd']);

        for (const p of uncategorized) {
            const words = p.businessName.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));

            // Single meaningful words
            for (const w of words) {
                if (!termProspects.has(w)) termProspects.set(w, new Set());
                termProspects.get(w)!.add(p.id);
            }
            // Bigrams (e.g. "physical therapy")
            for (let i = 0; i < words.length - 1; i++) {
                const bigram = `${words[i]} ${words[i + 1]}`;
                if (!termProspects.has(bigram)) termProspects.set(bigram, new Set());
                termProspects.get(bigram)!.add(p.id);
            }
        }

        // Filter to clusters with 5+ unique prospects, prefer longer (more specific) terms
        const clusters: { term: string; count: number; prospectIds: string[] }[] = [];
        for (const [term, ids] of termProspects) {
            if (ids.size >= 5) {
                clusters.push({ term, count: ids.size, prospectIds: Array.from(ids) });
            }
        }

        // Sort by count desc, then by term length desc (prefer more specific terms)
        clusters.sort((a, b) => b.count - a.count || b.term.length - a.term.length);

        // Deduplicate: if a bigram covers the same prospects as a unigram, keep the bigram
        const usedIds = new Set<string>();
        const deduped: typeof clusters = [];
        for (const cluster of clusters) {
            const newIds = cluster.prospectIds.filter(id => !usedIds.has(id));
            if (newIds.length >= 5) {
                deduped.push({ ...cluster, prospectIds: newIds, count: newIds.length });
                newIds.forEach(id => usedIds.add(id));
            }
        }

        return deduped.slice(0, 3); // Show max 3 suggestions
    }, [prospects, getEffectiveFacilityType]);

    /** Create a dynamic facility type from a suggested cluster */
    const handleCreateTypeFromCluster = async (term: string, prospectIds: string[]) => {
        // Generate a slug from the term
        const slug = term.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const label = term.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        try {
            // Build broader infer patterns from the term
            const patterns = new Set<string>();
            patterns.add(term);
            // Common variations: "physical therapist" ↔ "physical therapy"
            const words = term.split(' ');
            for (const word of words) {
                // Add individual words as partial matches if multi-word
                if (words.length > 1 && word.length > 4) {
                    patterns.add(word);
                }
            }
            // If term ends in common suffixes, add the root
            if (term.endsWith('ist')) patterns.add(term.slice(0, -3) + 'y');
            if (term.endsWith('ists')) patterns.add(term.slice(0, -4) + 'y');
            if (term.endsWith('y') && !term.endsWith('ey')) {
                patterns.add(term.slice(0, -1) + 'ist');
            }

            // Save to custom facility types collection
            await setDoc(doc(db, 'facility_types_custom', slug), {
                slug,
                label,
                phrases: {
                    spaceNoun: 'facility',
                    cadencePhrase: 'scheduled professional cleaning',
                    facilityCategory: `${label.toLowerCase()} facilities`,
                    serviceHook: `reliable, transparent cleaning tailored to your ${label.toLowerCase()}`,
                    coreOpsPhrase: 'core operations',
                },
                inferPatterns: Array.from(patterns),
                createdAt: new Date(),
                prospectCount: prospectIds.length,
            });

            // Auto-categorize: scan ALL uncategorized prospects using all infer patterns
            const patternsLower = Array.from(patterns).map(p => p.toLowerCase());
            const allMatching = prospects.filter(p => {
                // Already categorized? Skip.
                const ft = getEffectiveFacilityType(p);
                if (ft !== 'unknown') return false;
                // Check if business name or search query contains ANY pattern
                const haystack = `${p.businessName || ''} ${p.searchQuery || ''}`.toLowerCase();
                return patternsLower.some(pat => haystack.includes(pat));
            });

            // Merge the cluster IDs with any additional matches found
            const allIds = new Set([...prospectIds, ...allMatching.map(p => p.id)]);

            // Firestore batch limit is 500, chunk if needed
            const idArray = Array.from(allIds);
            const BATCH_SIZE = 450;
            let batchCount = 0;
            for (let i = 0; i < idArray.length; i += BATCH_SIZE) {
                const chunk = idArray.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);
                for (const id of chunk) {
                    batch.update(doc(db, 'prospect_queue', id), {
                        facilityType: slug,
                        updatedAt: new Date(),
                    });
                }
                await batch.commit();
                batchCount += chunk.length;
            }

            toast({
                title: `Created "${label}" facility type`,
                description: `${batchCount} prospects auto-categorized.`,
            });
        } catch (err) {
            toast({ title: 'Error creating type', description: String(err) });
        }
    };

    /** Re-run auto-categorization against static inference + custom types' inferPatterns */
    const handleAutoRecategorize = async () => {
        const uncategorized = prospects.filter(p => getEffectiveFacilityType(p) === 'unknown');
        if (uncategorized.length === 0) {
            toast({ title: 'All categorized', description: 'No uncategorized prospects found.' });
            return;
        }

        let matched = 0;
        const updates: { id: string; slug: string }[] = [];

        for (const p of uncategorized) {
            const haystack = `${p.businessName || ''} ${p.searchQuery || ''}`.toLowerCase();

            // 1. Try the static inferFacilityType from shared package (on searchQuery, then businessName)
            const staticMatch = inferFacilityType(p.searchQuery) || inferFacilityType(p.businessName);
            if (staticMatch) {
                updates.push({ id: p.id, slug: staticMatch });
                matched++;
                continue;
            }

            // Note: customFacilityTypes is a slug→label map; no pattern matching supported for custom types
        }

        if (updates.length === 0) {
            toast({ title: 'No matches', description: `${uncategorized.length} uncategorized prospects didn't match any patterns.` });
            return;
        }

        try {
            const BATCH_SIZE = 450;
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const chunk = updates.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);
                for (const u of chunk) {
                    batch.update(doc(db, 'prospect_queue', u.id), {
                        facilityType: u.slug,
                        updatedAt: new Date(),
                    });
                }
                await batch.commit();
            }
            toast({
                title: 'Auto-categorized',
                description: `${matched} of ${uncategorized.length} uncategorized prospects categorized.`,
            });
        } catch (err) {
            toast({ title: 'Error auto-categorizing', description: String(err) });
        }
    };

    // ── Filtering ───────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = prospects;

        if (statusFilter !== 'all') {
            list = list.filter(p => p.status === statusFilter);
        }

        if (facilityTypeFilter !== 'all') {
            list = list.filter(p => {
                const ft = getEffectiveFacilityType(p);
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

    /** Save a manually-selected facility type to Firestore */
    const handleSetFacilityType = async (prospectId: string, facilityType: string) => {
        try {
            await updateDoc(doc(db, 'prospect_queue', prospectId), {
                facilityType,
                updatedAt: new Date(),
            });
            toast({ title: `Facility type set to ${mergedFacilityLabels[facilityType] || facilityType}` });
        } catch (err) {
            toast({ title: 'Error updating facility type', description: String(err) });
        }
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
                    inferredTitle: p.inferredTitle || null,
                    inferredDept: p.inferredDept || null,
                    emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence,
                    facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl,
                    searchQuery: p.searchQuery,
                    facilityType: p.facilityType,
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
                    contactTitle: p.contactTitle, inferredTitle: p.inferredTitle || null,
                    inferredDept: p.inferredDept || null, emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence, facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl, searchQuery: p.searchQuery,
                    facilityType: p.facilityType,
                    allContacts: p.allContacts || [],
                })),
            });

            const data = result.data as any;
            const emailFn = httpsCallable(functions, 'sendSingleLeadEmail');

            // Fire all email sends concurrently instead of serially
            const emailResults = await Promise.allSettled(
                ids.map((_, i) => {
                    const imported = data.results?.[i];
                    if (!imported?.companyId || !imported?.contactId) return Promise.resolve(null);
                    return emailFn({ leadId: imported.companyId, contactId: imported.contactId, templateId });
                })
            );
            const emailsSent = emailResults.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<unknown>).value !== null).length;

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
                    contactTitle: p.contactTitle, inferredTitle: p.inferredTitle || null,
                    inferredDept: p.inferredDept || null, emailSource: p.emailSource,
                    emailConfidence: p.emailConfidence, facebookUrl: p.facebookUrl,
                    linkedinUrl: p.linkedinUrl, searchQuery: p.searchQuery,
                    facilityType: p.facilityType,
                    allContacts: p.allContacts || [],
                })),
            });

            const data = result.data as any;
            const seqFn = httpsCallable(functions, 'startLeadSequence');

            // Fire all sequence enrollments concurrently instead of serially
            const seqResults = await Promise.allSettled(
                ids.map((_, i) => {
                    const imported = data.results?.[i];
                    if (!imported?.companyId || !imported?.contactId) return Promise.resolve(null);
                    return seqFn({ leadId: imported.companyId, contactId: imported.contactId, sequenceId });
                })
            );
            const started = seqResults.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<unknown>).value !== null).length;

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
            fn().catch((err: any) => {
                console.warn('Prospector pipeline error (may be benign):', err?.code, err?.message);
                // deadline-exceeded = client HTTP connection dropped but the Cloud Function
                // is still running server-side. The status polling will continue tracking it.
                if (err?.code === 'functions/deadline-exceeded' || err?.message?.includes('deadline-exceeded')) {
                    console.info('Pipeline still running server-side — continuing to poll status.');
                    return;
                }
                toast({ title: 'Pipeline issue', description: String(err?.message || err), variant: 'destructive' });
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
            const dedup = (items: string[]) => {
                const map = new Map<string, string>();
                items.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
                });
                return Array.from(map.values());
            };

            const newConfig = {
                queries: dedup(editQueries),
                locations: dedup(editLocations),
                dailyTarget: editTarget,
                enabled: editEnabled,
                excludePatterns: dedup(editExclude),
            };
            await setDoc(doc(db, 'prospecting_config', 'default'), newConfig, { merge: true });
            setConfig(prev => prev ? { ...prev, ...newConfig } : newConfig as ProspectingConfig);
            setEditQueries(newConfig.queries);
            setEditLocations(newConfig.locations);
            setEditExclude(newConfig.excludePatterns);
            toast({ title: 'Config saved', description: 'Duplicates automatically removed.' });
        } catch (err) {
            toast({ title: 'Save failed', description: String(err) });
        }
        setConfigSaving(false);
    };

    // ── Seed config from ICP engine ──────────────────────────────────

    const handleSeedFromICP = async () => {
        try {
            toast({ title: 'Regenerating config...', description: 'Seeding queries and locations from the ICP engine.' });
            const fn = httpsCallable(functions, 'regenerateProspectingConfig');
            await fn({});
            // Reload config after seed
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
            toast({ title: 'Config seeded!', description: 'ICP engine queries and locations are now active.' });
        } catch (err) {
            toast({ title: 'Seed failed', description: String(err), variant: 'destructive' });
        }
    };

    // ── Apply/dismiss AI recommendations ────────────────────────────

    const handleApplyRecommendation = async (action: RecommendationAction, id: string) => {
        const configRef = doc(db, 'prospecting_config', 'default');
        try {
            // Apply the recommended mutation to local state + Firestore
            switch (action.type) {
                case 'remove_query':
                    setEditQueries(prev => prev.filter(q => q !== action.query));
                    await setDoc(configRef, { queries: editQueries.filter(q => q !== action.query) }, { merge: true });
                    break;
                case 'add_query':
                    if (!editQueries.includes(action.query)) {
                        const next = [...editQueries, action.query];
                        setEditQueries(next);
                        await setDoc(configRef, { queries: next }, { merge: true });
                    }
                    break;
                case 'add_queries': {
                    const next = [...new Set([...editQueries, ...action.queries])];
                    setEditQueries(next);
                    await setDoc(configRef, { queries: next }, { merge: true });
                    break;
                }
                case 'remove_location':
                    setEditLocations(prev => prev.filter(l => l !== action.location));
                    await setDoc(configRef, { locations: editLocations.filter(l => l !== action.location) }, { merge: true });
                    break;
                case 'add_exclude': {
                    const next = [...editExclude, action.pattern];
                    setEditExclude(next);
                    await setDoc(configRef, { excludePatterns: next }, { merge: true });
                    break;
                }
            }
            // Mark as applied (same as dismissed — prevents re-showing)
            handleDismissRecommendation(id);
            toast({ title: 'Recommendation applied' });
        } catch (err) {
            toast({ title: 'Failed to apply recommendation', description: String(err), variant: 'destructive' });
        }
    };

    const handleDismissRecommendation = async (id: string) => {
        const dismissed = [...(config?.dismissedRecommendations || []), id];
        setConfig(prev => prev ? { ...prev, dismissedRecommendations: dismissed } : prev);
        try {
            await setDoc(doc(db, 'prospecting_config', 'default'), { dismissedRecommendations: dismissed }, { merge: true });
        } catch (err) {
            console.error('Failed to persist dismissed recommendation:', err);
        }
    };

    // ── Inline contact edit save ─────────────────────────────────

    const handleStartEditContact = (p: QueuedProspect) => {
        setEditingContact(p.id);
        setEditEmail(p.contactEmail || p.genericEmail || '');
        setEditName(p.contactName || '');
    };

    const handleCancelEditContact = () => {
        setEditingContact(null);
        setEditEmail('');
        setEditName('');
    };

    const handleSaveContact = async (prospectId: string) => {
        setSavingContact(true);
        try {
            const trimmedEmail = editEmail.trim();
            const trimmedName = editName.trim();
            await updateDoc(doc(db, 'prospect_queue', prospectId), {
                ...(trimmedEmail ? { contactEmail: trimmedEmail, emailConfidence: 'high', emailSource: 'manual' } : {}),
                ...(trimmedName ? { contactName: trimmedName } : {}),
            });
            toast({ title: 'Contact updated' });
            setEditingContact(null);
        } catch (err) {
            toast({ title: 'Failed to save', description: String(err), variant: 'destructive' });
        }
        setSavingContact(false);
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
                    <Button
                        variant={configOpen ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setConfigOpen(c => !c)}
                    >
                        <Settings className="w-4 h-4 mr-1" />
                        {configOpen ? 'Hide Config' : 'Config'}
                    </Button>

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

            {/* ICP Config Panel */}
            <ConfigPanel
                configOpen={configOpen}
                onClose={() => setConfigOpen(false)}
                config={config}
                editQueries={editQueries}
                setEditQueries={setEditQueries}
                editLocations={editLocations}
                setEditLocations={setEditLocations}
                editTarget={editTarget}
                setEditTarget={setEditTarget}
                editEnabled={editEnabled}
                setEditEnabled={setEditEnabled}
                editExclude={editExclude}
                setEditExclude={setEditExclude}
                onSave={handleSaveConfig}
                onSeedFromICP={handleSeedFromICP}
                isSaving={configSaving}
            />

            {/* AI Recommendations Panel */}
            {config && (
                <RecommendationsPanel
                    config={config}
                    prospects={prospects}
                    onApply={handleApplyRecommendation}
                    onDismiss={handleDismissRecommendation}
                />
            )}
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
                <div className="rounded-lg border bg-emerald-600 dark:bg-emerald-700 border-emerald-700 dark:border-emerald-800 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span className="text-sm text-white font-medium">
                            Last run: Added {runStatus.qualified} prospects ({runStatus.discovered} found, {runStatus.duplicatesSkipped} dupes skipped)
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setRunStatus(null)} className="text-white hover:text-emerald-100 h-6 px-2">
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
                                {ft === 'unknown' ? 'Uncategorized' : mergedFacilityLabels[ft] || ft} ({count})
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
                                {selectedHasUncategorized && (
                                    <div className="px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-b">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{selectedUncategorizedCount} prospect(s) missing a facility type. Set one before emailing or sequencing.</span>
                                    </div>
                                )}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={selectedHasUncategorized} className={selectedHasUncategorized ? 'opacity-50' : ''}>
                                        <SendHorizonal className="w-4 h-4 mr-2" />
                                        Import + Send Email
                                    </DropdownMenuSubTrigger>
                                    {!selectedHasUncategorized && (
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
                                    )}
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={selectedHasUncategorized} className={selectedHasUncategorized ? 'opacity-50' : ''}>
                                        <ListPlus className="w-4 h-4 mr-2" />
                                        Import + Add to Sequence
                                    </DropdownMenuSubTrigger>
                                    {!selectedHasUncategorized && (
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
                                    )}
                                </DropdownMenuSub>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Cluster suggestions */}
            {uncategorizedClusters.length > 0 && (
                <div className="space-y-2 mb-3">
                    {uncategorizedClusters.map(cluster => (
                        <div
                            key={cluster.term}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                        >
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="text-sm flex-1">
                                <span className="font-medium">{cluster.count}</span> uncategorized prospects match
                                &ldquo;<span className="font-semibold text-amber-700 dark:text-amber-300">{cluster.term}</span>&rdquo;
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                onClick={() => handleCreateTypeFromCluster(cluster.term, cluster.prospectIds)}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                Create Type
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Auto-categorize banner — independent of cluster detection threshold */}
            {prospects.some(p => getEffectiveFacilityType(p) === 'unknown') && (
                <div className="flex items-center gap-3 px-4 py-2 mb-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-sm flex-1 text-blue-700 dark:text-blue-300">
                        {prospects.filter(p => getEffectiveFacilityType(p) === 'unknown').length} uncategorized — auto-match against known patterns{Object.keys(customFacilityTypes).length > 0 ? ` + ${Object.keys(customFacilityTypes).length} custom type${Object.keys(customFacilityTypes).length !== 1 ? 's' : ''}` : ''}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        onClick={handleAutoRecategorize}
                    >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Auto-Categorize
                    </Button>
                </div>
            )}

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
                    <div className="hidden md:grid grid-cols-[2.5rem_1fr_minmax(150px,180px)_minmax(140px,200px)_minmax(160px,220px)_90px_64px_100px] gap-x-3 px-4 py-2.5 bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center justify-center">
                            <Checkbox
                                checked={selected.size === filtered.length && filtered.length > 0}
                                onCheckedChange={toggleAll}
                            />
                        </div>
                        <div>Business</div>
                        <div>Facility Type</div>
                        <div>Location</div>
                        <div>Contact</div>
                        <div>Confidence</div>
                        <div>Rating</div>
                        <div>Actions</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y max-h-[calc(100vh-360px)] overflow-y-auto">
                        {filtered.map(prospect => (
                            <div
                                key={prospect.id}
                                className={`group flex flex-col md:grid md:grid-cols-[2.5rem_1fr_minmax(150px,180px)_minmax(140px,200px)_minmax(160px,220px)_90px_64px_100px] gap-x-3 gap-y-2 px-4 py-3 md:items-center text-sm hover:bg-muted/30 transition-colors cursor-pointer ${
                                    selected.has(prospect.id) ? 'bg-primary/5' : ''
                                }`}
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
                                        {prospect.phone && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {prospect.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Facility Type */}
                                <div className="min-w-0">
                                    {(() => {
                                        const effectiveFt = getEffectiveFacilityType(prospect);
                                        const isUnknown = effectiveFt === 'unknown';
                                        const isInferred = !prospect.facilityType && !isUnknown;
                                        return (
                                            <Select
                                                value={effectiveFt === 'unknown' ? undefined : effectiveFt}
                                                onValueChange={(val: string) => handleSetFacilityType(prospect.id, val)}
                                            >
                                                <SelectTrigger
                                                    className={`h-7 text-[11px] px-2 w-full ${
                                                        isUnknown
                                                            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                                                            : isInferred
                                                            ? 'border-dashed border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                                            : 'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400'
                                                    }`}
                                                >
                                                    <SelectValue placeholder="⚠ Set type…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mergedFacilityOptions.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        );
                                    })()}
                                </div>

                                {/* Location */}
                                <div className="min-w-0 text-xs text-muted-foreground flex items-start gap-1">
                                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span className="truncate leading-snug">{prospect.address || prospect.searchLocation}</span>
                                </div>

                                {/* Contact — inline editable */}
                                <div className="min-w-0">
                                    {editingContact === prospect.id ? (
                                        /* ── Edit mode ── */
                                        <div className="space-y-1" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    value={editEmail}
                                                    onChange={e => setEditEmail(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveContact(prospect.id);
                                                        if (e.key === 'Escape') handleCancelEditContact();
                                                    }}
                                                    placeholder="email@example.com"
                                                    className="h-6 text-[11px] px-1.5 py-0"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveContact(prospect.id);
                                                        if (e.key === 'Escape') handleCancelEditContact();
                                                    }}
                                                    placeholder="Contact name"
                                                    className="h-6 text-[11px] px-1.5 py-0"
                                                />
                                                <button
                                                    onClick={() => handleSaveContact(prospect.id)}
                                                    disabled={savingContact}
                                                    className="h-6 w-6 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors shrink-0"
                                                    title="Save"
                                                >
                                                    {savingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                </button>
                                                <button
                                                    onClick={handleCancelEditContact}
                                                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors shrink-0"
                                                    title="Cancel"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── View mode ── */
                                        <div className="group relative">
                                            {prospect.contactEmail ? (
                                                <div className="text-xs truncate flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                                                    <span className="truncate">{prospect.contactEmail}</span>
                                                    {prospect.emailSource === 'manual' && (
                                                        <span className="text-[9px] text-emerald-600 font-medium">✎</span>
                                                    )}
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
                                                        {prospect.contactTitle && (
                                                            <span className="text-[10px] text-muted-foreground/60">· {prospect.contactTitle}</span>
                                                        )}
                                                    </span>
                                                )}
                                                {!prospect.contactTitle && prospect.inferredTitle && (
                                                    <span
                                                        className="text-[10px] italic text-blue-600/70 dark:text-blue-400/60 border border-dashed border-blue-300 dark:border-blue-700 rounded px-1.5 py-0 leading-5"
                                                        title={`Inferred from facility type${prospect.inferredDept ? ` · ${prospect.inferredDept}` : ''}`}
                                                    >
                                                        ~{prospect.inferredTitle}
                                                    </span>
                                                )}
                                                {(prospect.allContacts?.length ?? 0) > 1 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleContactsExpand(prospect.id); }}
                                                        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 font-normal text-blue-600 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                                    >
                                                        {expandedContacts.has(prospect.id)
                                                            ? <ChevronDown className="w-2.5 h-2.5" />
                                                            : <ChevronRight className="w-2.5 h-2.5" />
                                                        }
                                                        <Users className="w-2.5 h-2.5" />
                                                        {prospect.allContacts!.length} contacts
                                                    </button>
                                                )}
                                                {/* Edit pencil — only for pending */}
                                                {prospect.status === 'pending_review' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStartEditContact(prospect); }}
                                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[10px] px-1 py-0 h-4 text-muted-foreground hover:text-primary transition-all cursor-pointer rounded"
                                                        title="Edit contact"
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </button>
                                                )}
                                            </div>
                                            {/* Expanded contacts list */}
                                            {expandedContacts.has(prospect.id) && prospect.allContacts && prospect.allContacts.length > 1 && (
                                                <div className="mt-1.5 space-y-1 pl-1 border-l-2 border-blue-200 dark:border-blue-800">
                                                    {prospect.allContacts.map((c, idx) => (
                                                        <div key={idx} className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.type === 'personal' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                            <span className="truncate">{c.email}</span>
                                                            {c.firstName && <span className="text-[10px] text-muted-foreground/60">({c.firstName}{c.lastName ? ` ${c.lastName}` : ''}{c.position ? `, ${c.position}` : ''})</span>}
                                                            {c.confidence && <span className="text-[10px] text-muted-foreground/40">{Math.round(c.confidence * 100)}%</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
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
                                                    {sequences.length > 0 && getEffectiveFacilityType(prospect) !== 'unknown' && (
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
                                                    {sequences.length > 0 && getEffectiveFacilityType(prospect) === 'unknown' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem disabled className="text-amber-600 dark:text-amber-400 text-xs">
                                                                <AlertTriangle className="w-3 h-3 mr-2" />
                                                                Set facility type first
                                                            </DropdownMenuItem>
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
