'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp, limit as queryLimit, onSnapshot } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Search, Loader2, Check, X, ChevronDown, ChevronUp, ArrowRight,
    Zap, AlertTriangle, TrendingUp, TrendingDown, Eye, MousePointerClick,
    BarChart3, RefreshCw, Link2, Sparkles, Shield, Clock, GitPullRequest,
    CheckCircle2, XCircle, Pause, Filter, Users, HardHat, Globe,
    ExternalLink, PlugZap, Unplug, TestTube2, Info, Rocket, GitMerge,
} from 'lucide-react';
import {
    SCOPE_COLORS as scopeColors,
    SCOPE_LABELS as scopeLabels,
    SCOPE_DESCRIPTIONS as scopeDescriptions,
    PRIORITY_COLORS as priorityColors,
    STATUS_LABELS as statusLabels,
    PRIORITY_SORT_ORDER as prioritySortOrder,
    HEURISTIC_RULES,
} from '@xiri-facility-solutions/shared';
import type {
    PseoNudge, PseoBatch, NudgeSegment, NudgeScope, NudgePriority, NudgeStatus,
} from '@xiri-facility-solutions/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface GscStatus {
    connected: boolean;
    email?: string;
    siteUrl?: string;
    connectedAt?: string;
}

interface RunStatus {
    running: boolean;
    segment?: string;
    phase?: string;
    pagesAnalyzed?: number;
    nudgesDetected?: number;
    startedAt?: any;
    completedAt?: any;
    updatedAt?: any;
    error?: string;
    batchId?: string;
}

interface TestResult {
    success: boolean;
    sites?: string[];
    samplePerformance?: any[];
    dateRange?: { start: string; end: string };
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SeoEnginePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // ── State ────────────────────────────────────────────────────────────────

    // Connection
    const [gscStatus, setGscStatus] = useState<GscStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    // Nudge inbox
    const [nudges, setNudges] = useState<PseoNudge[]>([]);
    const [loadingNudges, setLoadingNudges] = useState(false);
    const [expandedNudge, setExpandedNudge] = useState<string | null>(null);
    const [editingNudge, setEditingNudge] = useState<string | null>(null);
    const [editedValue, setEditedValue] = useState('');
    const [reviewingNudge, setReviewingNudge] = useState<string | null>(null);

    // Batches
    const [batches, setBatches] = useState<PseoBatch[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);

    // Deployment
    const [deployingBatch, setDeployingBatch] = useState<string | null>(null);

    // Filters
    const [activeSegment, setActiveSegment] = useState<NudgeSegment>('leads');
    const [scopeFilter, setScopeFilter] = useState<NudgeScope | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<NudgeStatus | 'all'>('pending');

    // Run Now
    const [runningAnalysis, setRunningAnalysis] = useState(false);
    const [runStatus, setRunStatus] = useState<RunStatus | null>(null);

    // Feedback
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Tab state
    const activeTab = (searchParams.get('tab') as 'inbox' | 'batches' | 'connect') || 'inbox';
    const setActiveTab = useCallback((tab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // ── OAuth Code Exchange (on redirect back from Google) ───────────────────

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (code && state === 'pseo-connect') {
            // Exchange the code for tokens
            const exchange = async () => {
                setConnecting(true);
                try {
                    const isDev = window.location.hostname === 'localhost';
                    const exchangeFn = httpsCallable(functions, 'exchangeGscToken');
                    const result: any = await exchangeFn({ code, isDev });

                    if (result.data?.success) {
                        setSuccessMessage(`Connected as ${result.data.email}!`);
                        setGscStatus({ connected: true, email: result.data.email });
                    } else {
                        setErrorMessage('Token exchange failed');
                    }
                } catch (err: any) {
                    setErrorMessage('Connection failed: ' + (err.message || 'Unknown error'));
                } finally {
                    setConnecting(false);
                    // Clean up URL params
                    router.replace(`${pathname}?tab=connect`, { scroll: false });
                }
            };
            exchange();
        }
    }, [searchParams, pathname, router]);

    // ── Data Fetching ────────────────────────────────────────────────────────

    const fetchConnectionStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const fn = httpsCallable(functions, 'getGscConnectionStatus');
            const result: any = await fn({});
            setGscStatus(result.data as GscStatus);
        } catch (err) {
            console.error('Error fetching GSC status:', err);
            setGscStatus({ connected: false });
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    const fetchNudges = useCallback(async () => {
        setLoadingNudges(true);
        try {
            const constraints: any[] = [
                where('segment', '==', activeSegment),
                orderBy('createdAt', 'desc'),
                queryLimit(100),
            ];

            if (statusFilter !== 'all') {
                constraints.push(where('status', '==', statusFilter));
            }

            const q = query(collection(db, 'pseo_nudges'), ...constraints);
            const snap = await getDocs(q);
            let items = snap.docs.map(d => ({ id: d.id, ...d.data() } as PseoNudge));

            // Client-side scope filter
            if (scopeFilter !== 'all') {
                items = items.filter(n => n.scope === scopeFilter);
            }

            // Sort by priority
            items.sort((a, b) => (prioritySortOrder[a.priority] ?? 3) - (prioritySortOrder[b.priority] ?? 3));

            setNudges(items);
        } catch (err) {
            console.error('Error fetching nudges:', err);
        } finally {
            setLoadingNudges(false);
        }
    }, [activeSegment, statusFilter, scopeFilter]);

    const fetchBatches = useCallback(async () => {
        setLoadingBatches(true);
        try {
            const q = query(
                collection(db, 'pseo_batches'),
                where('segment', '==', activeSegment),
                orderBy('createdAt', 'desc'),
                queryLimit(20),
            );
            const snap = await getDocs(q);
            setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as PseoBatch)));
        } catch (err) {
            console.error('Error fetching batches:', err);
        } finally {
            setLoadingBatches(false);
        }
    }, [activeSegment]);

    useEffect(() => {
        fetchConnectionStatus();
    }, [fetchConnectionStatus]);

    useEffect(() => {
        if (activeTab === 'inbox') fetchNudges();
        if (activeTab === 'batches') fetchBatches();
    }, [activeTab, fetchNudges, fetchBatches]);

    // Auto-clear feedback
    useEffect(() => {
        if (successMessage) {
            const t = setTimeout(() => setSuccessMessage(''), 5000);
            return () => clearTimeout(t);
        }
    }, [successMessage]);

    // Real-time run status listener
    useEffect(() => {
        if (!runningAnalysis) return;
        const statusRef = doc(db, 'pseo_config', 'run_status');
        const unsubscribe = onSnapshot(statusRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as RunStatus;
                setRunStatus(data);
                // If backend reports done, let the calling function handle setRunningAnalysis(false)
            }
        }, (err) => {
            console.error('Run status listener error:', err);
        });
        return () => unsubscribe();
    }, [runningAnalysis]);

    // Phase progress mapping
    const PIPELINE_PHASES = [
        'Connecting to GSC',
        'Fetching GSC data',
        'Aggregating metrics',
        'Fetching GA4 engagement',
        'Fetching trust signals',
        'Running heuristics',
        'Generating copy suggestions',
        'Writing to Firestore',
        'Complete',
    ];

    const getPhaseProgress = (phase?: string): number => {
        if (!phase) return 0;
        // Handle "Generating copy (3/10)" style phases
        if (phase.startsWith('Generating copy (')) {
            const match = phase.match(/\((\d+)\/(\d+)\)/);
            if (match) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                // Copy generation is phase 7 out of 9 total — scale within that slice
                const base = (6 / 9) * 100; // 66%
                const slice = (1 / 9) * 100;  // ~11%
                return Math.round(base + (current / total) * slice);
            }
        }
        if (phase === 'Starting…') return 2;
        if (phase === 'Complete') return 100;
        if (phase === 'Failed') return 100;
        const idx = PIPELINE_PHASES.indexOf(phase);
        if (idx < 0) return 5;
        return Math.round(((idx + 1) / PIPELINE_PHASES.length) * 100);
    };

    const getElapsedTime = (startedAt?: any): string => {
        if (!startedAt) return '';
        const start = startedAt?.toDate?.() ?? new Date(startedAt);
        const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
        if (elapsed < 60) return `${elapsed}s`;
        return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const isDev = window.location.hostname === 'localhost';
            const fn = httpsCallable(functions, 'getGscAuthUrl');
            const result: any = await fn({ isDev });
            window.location.href = result.data.url;
        } catch (err: any) {
            setErrorMessage('Failed to start OAuth: ' + err.message);
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Google Search Console? You will need to reconnect to use the SEO engine.')) return;
        setDisconnecting(true);
        try {
            const fn = httpsCallable(functions, 'disconnectGsc');
            await fn({});
            setGscStatus({ connected: false });
            setSuccessMessage('GSC disconnected');
        } catch (err: any) {
            setErrorMessage('Disconnect failed: ' + err.message);
        } finally {
            setDisconnecting(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const fn = httpsCallable(functions, 'testGscConnection');
            const result: any = await fn({});
            setTestResult(result.data as TestResult);
            setSuccessMessage('Connection test passed!');
        } catch (err: any) {
            setErrorMessage('Connection test failed: ' + err.message);
        } finally {
            setTesting(false);
        }
    };

    const handleReview = async (nudgeId: string, action: 'approved' | 'rejected' | 'deferred') => {
        setReviewingNudge(nudgeId);
        try {
            const nudgeRef = doc(db, 'pseo_nudges', nudgeId);
            const updates: any = {
                status: action,
                reviewedAt: Timestamp.now(),
            };

            if (action === 'approved' && editingNudge === nudgeId && editedValue) {
                updates.editedValue = editedValue;
            }

            await updateDoc(nudgeRef, updates);
            setSuccessMessage(`Nudge ${action}!`);
            setEditingNudge(null);
            setEditedValue('');
            setExpandedNudge(null);

            // Update local state
            setNudges(prev => prev.map(n =>
                n.id === nudgeId ? { ...n, status: action as NudgeStatus, reviewedAt: Timestamp.now() } : n
            ));

            // If filtering by pending, remove from view
            if (statusFilter === 'pending') {
                setNudges(prev => prev.filter(n => n.id !== nudgeId));
            }
        } catch (err: any) {
            setErrorMessage('Review failed: ' + err.message);
        } finally {
            setReviewingNudge(null);
        }
    };

    const handleDeploy = async (batchId: string) => {
        if (!confirm('Deploy all approved nudges from this batch as a GitHub PR?')) return;
        setDeployingBatch(batchId);
        try {
            const fn = httpsCallable(functions, 'deployApprovedNudges');
            const result: any = await fn({ batchId });
            setSuccessMessage(
                `PR #${result.data.prNumber} created with ${result.data.applied} changes! Review and merge to go live.`
            );
            // Update local batch state with PR info
            setBatches(prev => prev.map(b =>
                b.id === batchId ? { ...b, prUrl: result.data.prUrl, prNumber: result.data.prNumber, deployedCount: result.data.applied } : b
            ));
        } catch (err: any) {
            setErrorMessage('Deploy failed: ' + err.message);
        } finally {
            setDeployingBatch(null);
        }
    };

    // ── Computed ──────────────────────────────────────────────────────────────

    const pendingCount = nudges.filter(n => n.status === 'pending').length;
    const nudgesByScope = {
        template: nudges.filter(n => n.scope === 'template').length,
        instance: nudges.filter(n => n.scope === 'instance').length,
        expansion: nudges.filter(n => n.scope === 'expansion').length,
        'trust-refresh': nudges.filter(n => n.scope === 'trust-refresh').length,
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Search className="w-6 h-6 text-violet-600" />
                        SEO Engine
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        AI-powered content optimization — review, approve, and deploy SEO improvements
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Run Now */}
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={runningAnalysis || !gscStatus?.connected}
                        onClick={async () => {
                            setRunningAnalysis(true);
                            setRunStatus({ running: true, phase: 'Starting…' });
                            setErrorMessage('');
                            try {
                                const fn = httpsCallable(functions, 'triggerPseoAnalysis');
                                const result: any = await fn({ segment: activeSegment });
                                setSuccessMessage(`Analysis complete for "${activeSegment}" — ${result.data?.totalNudges ?? 0} nudges generated`);
                                fetchNudges();
                                fetchBatches();
                            } catch (err: any) {
                                setErrorMessage('Run failed: ' + (err.message || 'Unknown error'));
                            } finally {
                                setRunningAnalysis(false);
                            }
                        }}
                        className="gap-1.5"
                    >
                        {runningAnalysis ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
                        ) : (
                            <><Rocket className="w-3.5 h-3.5" /> Run Now</>
                        )}
                    </Button>

                    {/* Connection indicator */}
                    {loadingStatus ? (
                        <Badge variant="outline" className="gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                        </Badge>
                    ) : gscStatus?.connected ? (
                        <Badge variant="outline" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="gap-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Not Connected
                        </Badge>
                    )}
                </div>
            </div>

            {/* Analysis Progress Bar */}
            {runningAnalysis && runStatus && (
                <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 dark:border-violet-800 dark:from-violet-950/30 dark:to-indigo-950/30">
                    <CardContent className="pt-4 pb-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                                    <span className="font-medium text-sm text-violet-900 dark:text-violet-100">
                                        {runStatus.phase || 'Initializing…'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {runStatus.startedAt && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {getElapsedTime(runStatus.startedAt)}
                                        </span>
                                    )}
                                    {(runStatus.pagesAnalyzed ?? 0) > 0 && (
                                        <span>{runStatus.pagesAnalyzed} pages</span>
                                    )}
                                    {(runStatus.nudgesDetected ?? 0) > 0 && (
                                        <span>{runStatus.nudgesDetected} nudges</span>
                                    )}
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-violet-100 dark:bg-violet-900/50 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 ease-out"
                                    style={{ width: `${getPhaseProgress(runStatus.phase)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Analyzing <span className="font-medium">{activeSegment}</span> pages — this may take a few minutes
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Segment Toggle */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Segment:</span>
                <div className="flex gap-1 border border-border rounded-lg p-1 bg-muted">
                    <button
                        onClick={() => setActiveSegment('leads')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all
                            ${activeSegment === 'leads'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Users className="w-3.5 h-3.5" /> Leads
                    </button>
                    <button
                        onClick={() => setActiveSegment('contractors')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all
                            ${activeSegment === 'contractors'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <HardHat className="w-3.5 h-3.5" /> Contractors
                    </button>
                </div>
            </div>

            {/* Feedback Messages */}
            {successMessage && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                    {successMessage}
                    <button onClick={() => setSuccessMessage('')}>✕</button>
                </div>
            )}
            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                    {errorMessage}
                    <button onClick={() => setErrorMessage('')}>✕</button>
                </div>
            )}

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="inbox" className="gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Inbox
                        {pendingCount > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                                {pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="batches" className="gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" /> History
                    </TabsTrigger>
                    <TabsTrigger value="connect" className="gap-1.5">
                        <PlugZap className="w-3.5 h-3.5" /> Connect
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* INBOX TAB                                                  */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="inbox" className="mt-6 space-y-4">
                    {/* Scope breakdown cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(['template', 'instance', 'expansion', 'trust-refresh'] as NudgeScope[]).map(scope => (
                            <button
                                key={scope}
                                onClick={() => setScopeFilter(scopeFilter === scope ? 'all' : scope)}
                                title={scopeDescriptions[scope]}
                                className={`text-left p-3 rounded-lg border transition-all group
                                    ${scopeFilter === scope
                                        ? 'ring-2 ring-offset-1 bg-background shadow-sm'
                                        : 'bg-card hover:bg-muted/50'
                                    }`}
                                style={{
                                    borderColor: scopeFilter === scope ? scopeColors[scope] : undefined,
                                    ringColor: scopeFilter === scope ? scopeColors[scope] : undefined,
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scopeColors[scope] }} />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {scopeLabels[scope]}
                                    </span>
                                    <Info className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors ml-auto" />
                                </div>
                                <p className="text-2xl font-bold">{nudgesByScope[scope]}</p>
                            </button>
                        ))}
                    </div>

                    {/* Status filter pills */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        {(['all', 'pending', 'approved', 'rejected', 'deferred'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                                    ${statusFilter === status
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {status === 'all' ? 'All' : statusLabels[status]}
                            </button>
                        ))}
                    </div>

                    {/* Nudge List */}
                    {loadingNudges ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : nudges.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-semibold mb-1">No nudges found</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    {!gscStatus?.connected
                                        ? 'Connect Google Search Console first to start generating optimization suggestions.'
                                        : statusFilter === 'pending'
                                            ? 'All caught up! No pending nudges to review.'
                                            : 'No nudges match the current filters.'
                                    }
                                </p>
                                {!gscStatus?.connected && (
                                    <Button className="mt-4" onClick={() => setActiveTab('connect')}>
                                        <PlugZap className="w-4 h-4 mr-1.5" /> Connect GSC
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {nudges.map(nudge => {
                                const isExpanded = expandedNudge === nudge.id;
                                const isEditing = editingNudge === nudge.id;
                                const isReviewing = reviewingNudge === nudge.id;
                                const rule = HEURISTIC_RULES.find(r => r.id === nudge.ruleTriggered);

                                return (
                                    <Card key={nudge.id} className={`transition-all ${isExpanded ? 'ring-1 ring-border shadow-md' : ''}`}>
                                        {/* Nudge Header (always visible) */}
                                        <button
                                            onClick={() => setExpandedNudge(isExpanded ? null : nudge.id)}
                                            className="w-full text-left p-4 flex items-start gap-3"
                                        >
                                            {/* Priority indicator */}
                                            <div
                                                className="w-1.5 min-h-[40px] rounded-full mt-1 shrink-0"
                                                style={{ backgroundColor: priorityColors[nudge.priority] }}
                                            />

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] h-5"
                                                        style={{
                                                            borderColor: scopeColors[nudge.scope],
                                                            color: scopeColors[nudge.scope],
                                                        }}
                                                    >
                                                        {scopeLabels[nudge.scope]}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] h-5">
                                                        {nudge.ruleTriggered} — {rule?.label || 'Unknown Rule'}
                                                    </Badge>
                                                    {nudge.status !== 'pending' && (
                                                        <Badge
                                                            variant={nudge.status === 'approved' ? 'default' : 'secondary'}
                                                            className="text-[10px] h-5"
                                                        >
                                                            {statusLabels[nudge.status]}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium truncate">{nudge.targetSlug}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                    <span className="font-medium">{nudge.targetField}</span>
                                                    {' — '}{nudge.reasoning}
                                                </p>
                                            </div>

                                            {/* Data pills */}
                                            <div className="hidden md:flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                                {nudge.dataPoints.gscPosition != null && (
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" />
                                                        Pos {nudge.dataPoints.gscPosition.toFixed(1)}
                                                    </span>
                                                )}
                                                {nudge.dataPoints.gscCtr != null && (
                                                    <span className="flex items-center gap-1">
                                                        <MousePointerClick className="w-3 h-3" />
                                                        {(nudge.dataPoints.gscCtr * 100).toFixed(1)}% CTR
                                                    </span>
                                                )}
                                                {nudge.dataPoints.bounceRate != null && (
                                                    <span className="flex items-center gap-1">
                                                        <TrendingDown className="w-3 h-3" />
                                                        {nudge.dataPoints.bounceRate.toFixed(0)}% bounce
                                                    </span>
                                                )}
                                            </div>

                                            {isExpanded
                                                ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                            }
                                        </button>

                                        {/* Expanded Detail */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 border-t">
                                                <div className="grid md:grid-cols-2 gap-4 pt-4">
                                                    {/* Current vs Suggested */}
                                                    <div>
                                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                                            <XCircle className="w-3 h-3 text-red-500" /> Current
                                                        </label>
                                                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm">
                                                            {nudge.currentValue || <span className="text-muted-foreground italic">Not detected</span>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Suggested
                                                        </label>
                                                        {isEditing ? (
                                                            <Textarea
                                                                value={editedValue || nudge.suggestedValue}
                                                                onChange={(e) => setEditedValue(e.target.value)}
                                                                className="min-h-[100px] text-sm"
                                                            />
                                                        ) : (
                                                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm">
                                                                {nudge.editedValue || nudge.suggestedValue}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Data Points Grid */}
                                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                    {nudge.dataPoints.gscImpressions != null && (
                                                        <MiniStat icon={<Eye className="w-3 h-3" />} label="Impressions" value={nudge.dataPoints.gscImpressions.toLocaleString()} />
                                                    )}
                                                    {nudge.dataPoints.gscClicks != null && (
                                                        <MiniStat icon={<MousePointerClick className="w-3 h-3" />} label="Clicks" value={nudge.dataPoints.gscClicks.toLocaleString()} />
                                                    )}
                                                    {nudge.dataPoints.gscPosition != null && (
                                                        <MiniStat icon={<TrendingUp className="w-3 h-3" />} label="Avg Position" value={nudge.dataPoints.gscPosition.toFixed(1)} />
                                                    )}
                                                    {nudge.dataPoints.gscCtr != null && (
                                                        <MiniStat icon={<BarChart3 className="w-3 h-3" />} label="CTR" value={`${(nudge.dataPoints.gscCtr * 100).toFixed(1)}%`} />
                                                    )}
                                                    {nudge.dataPoints.bounceRate != null && (
                                                        <MiniStat icon={<TrendingDown className="w-3 h-3" />} label="Bounce Rate" value={`${nudge.dataPoints.bounceRate.toFixed(0)}%`} />
                                                    )}
                                                    {nudge.dataPoints.avgEngagementTime != null && (
                                                        <MiniStat icon={<Clock className="w-3 h-3" />} label="Engagement" value={`${nudge.dataPoints.avgEngagementTime.toFixed(0)}s`} />
                                                    )}
                                                    {nudge.dataPoints.nfcSessionsMonth != null && (
                                                        <MiniStat icon={<Shield className="w-3 h-3" />} label="NFC/mo" value={nudge.dataPoints.nfcSessionsMonth.toString()} />
                                                    )}
                                                    {nudge.dataPoints.workOrdersMonth != null && (
                                                        <MiniStat icon={<Zap className="w-3 h-3" />} label="WOs/mo" value={nudge.dataPoints.workOrdersMonth.toString()} />
                                                    )}
                                                </div>

                                                {/* Query cluster */}
                                                {nudge.dataPoints.queryCluster && nudge.dataPoints.queryCluster.length > 0 && (
                                                    <div className="mt-3">
                                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                                                            Related Queries
                                                        </label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {nudge.dataPoints.queryCluster.map((q, i) => (
                                                                <Badge key={i} variant="secondary" className="text-[10px]">{q}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Trust Signal */}
                                                {nudge.dataPoints.trustSignal && (
                                                    <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm">
                                                        <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                                                        <span>{nudge.dataPoints.trustSignal}</span>
                                                    </div>
                                                )}

                                                {/* PR Link */}
                                                {nudge.prUrl && (
                                                    <div className="mt-3 flex items-center gap-2 text-sm">
                                                        <GitPullRequest className="w-4 h-4 text-blue-500" />
                                                        <a href={nudge.prUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                            View PR <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                {nudge.status === 'pending' && (
                                                    <div className="mt-4 flex items-center gap-2 border-t pt-4">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleReview(nudge.id, 'approved')}
                                                            disabled={isReviewing}
                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                        >
                                                            {isReviewing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                if (isEditing) {
                                                                    setEditingNudge(null);
                                                                    setEditedValue('');
                                                                } else {
                                                                    setEditingNudge(nudge.id);
                                                                    setEditedValue(nudge.suggestedValue);
                                                                }
                                                            }}
                                                        >
                                                            {isEditing ? <X className="w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                                            {isEditing ? 'Cancel Edit' : 'Edit & Approve'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleReview(nudge.id, 'deferred')}
                                                            disabled={isReviewing}
                                                        >
                                                            <Pause className="w-3 h-3 mr-1" /> Defer
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleReview(nudge.id, 'rejected')}
                                                            disabled={isReviewing}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <X className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* BATCHES TAB                                                */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="batches" className="mt-6 space-y-4">
                    {loadingBatches ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : batches.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-semibold mb-1">No batches yet</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Weekly analysis batches will appear here once the engine runs its first analysis.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {batches.map(batch => {
                                const reviewedPct = batch.totalNudges > 0
                                    ? Math.round(((batch.approvedCount + batch.rejectedCount + batch.deferredCount) / batch.totalNudges) * 100)
                                    : 0;

                                return (
                                    <Card key={batch.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="font-semibold flex items-center gap-2">
                                                        Week {batch.weekId}
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {batch.segment}
                                                        </Badge>
                                                    </h3>
                                                    {batch.gscDataRange && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            GSC data: {batch.gscDataRange.startDate} → {batch.gscDataRange.endDate}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold">{batch.totalNudges}</p>
                                                    <p className="text-xs text-muted-foreground">nudges</p>
                                                </div>
                                            </div>

                                            {/* Scope breakdown */}
                                            <div className="flex gap-3 mb-3">
                                                {Object.entries(batch.breakdown || {}).map(([scope, count]) => (
                                                    <div key={scope} className="flex items-center gap-1.5 text-xs">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scopeColors[scope as NudgeScope] }} />
                                                        <span className="text-muted-foreground">{scopeLabels[scope as NudgeScope]}:</span>
                                                        <span className="font-medium">{count as number}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Progress bar */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full flex">
                                                        <div className="bg-emerald-500 transition-all" style={{ width: `${(batch.approvedCount / batch.totalNudges) * 100}%` }} />
                                                        <div className="bg-red-400 transition-all" style={{ width: `${(batch.rejectedCount / batch.totalNudges) * 100}%` }} />
                                                        <div className="bg-amber-400 transition-all" style={{ width: `${(batch.deferredCount / batch.totalNudges) * 100}%` }} />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted-foreground font-medium">{reviewedPct}%</span>
                                            </div>

                                            {/* Status counts */}
                                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    {batch.approvedCount} approved
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    {batch.rejectedCount} rejected
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                    {batch.deferredCount} deferred
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                                    {batch.pendingCount} pending
                                                </span>
                                            </div>

                                            {/* Deploy Actions */}
                                            <div className="mt-3 flex items-center gap-2 border-t pt-3">
                                                {batch.prUrl ? (
                                                    <>
                                                        <a
                                                            href={batch.prUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900 transition-colors"
                                                        >
                                                            <GitPullRequest className="w-3 h-3" />
                                                            View PR #{batch.prNumber}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                        {batch.deployedCount != null && (
                                                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                                                <GitMerge className="w-3 h-3 mr-1" />
                                                                {batch.deployedCount} changes deployed
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : batch.approvedCount > 0 ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDeploy(batch.id)}
                                                        disabled={deployingBatch === batch.id}
                                                        className="bg-violet-600 hover:bg-violet-700 text-white"
                                                    >
                                                        {deployingBatch === batch.id ? (
                                                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Rocket className="w-3 h-3 mr-1.5" />
                                                        )}
                                                        Deploy {batch.approvedCount} Approved
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        No approved nudges to deploy
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* CONNECT TAB                                                */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="connect" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="w-5 h-5" />
                                Google Search Console & Analytics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingStatus ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-8 w-48" />
                                    <Skeleton className="h-10 w-32" />
                                </div>
                            ) : gscStatus?.connected ? (
                                <>
                                    <div className="flex items-start gap-4 rounded-lg p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderLeft: '4px solid #16a34a' }}>
                                        <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#16a34a' }} />
                                        <div>
                                            <p className="font-semibold" style={{ color: '#15803d' }}>Connected</p>
                                            <p className="text-sm mt-0.5" style={{ color: '#374151' }}>
                                                Account: <span className="font-medium" style={{ color: '#111827' }}>{gscStatus.email}</span>
                                            </p>
                                            <p className="text-sm" style={{ color: '#374151' }}>
                                                Property: <span className="font-medium" style={{ color: '#111827' }}>{gscStatus.siteUrl || 'sc-domain:xiri.ai'}</span>
                                            </p>
                                            {gscStatus.connectedAt && (
                                                <p className="text-xs mt-1.5" style={{ color: '#6b7280' }}>
                                                    Connected {new Date(gscStatus.connectedAt).toLocaleDateString('en-US', {
                                                        month: 'short', day: 'numeric', year: 'numeric'
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleTestConnection}
                                            disabled={testing}
                                        >
                                            {testing
                                                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</>
                                                : <><TestTube2 className="w-3.5 h-3.5 mr-1.5" /> Test Connection</>
                                            }
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDisconnect}
                                            disabled={disconnecting}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            {disconnecting
                                                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Disconnecting…</>
                                                : <><Unplug className="w-3.5 h-3.5 mr-1.5" /> Disconnect</>
                                            }
                                        </Button>
                                    </div>

                                    {/* Test results */}
                                    {testResult && (
                                        <Card className="bg-muted/30">
                                            <CardContent className="p-4 space-y-3">
                                                <h4 className="font-medium text-sm flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    Connection Test Results
                                                </h4>

                                                {testResult.sites && testResult.sites.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">Accessible Sites:</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {testResult.sites.map((site, i) => (
                                                                <Badge key={i} variant="secondary" className="text-[10px]">{site}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {testResult.samplePerformance && testResult.samplePerformance.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                                            Sample Data ({testResult.dateRange?.start} → {testResult.dateRange?.end}):
                                                        </p>
                                                        <div className="overflow-x-auto">
                                                            <table className="text-xs w-full">
                                                                <thead>
                                                                    <tr className="border-b">
                                                                        <th className="text-left py-1 pr-2">Page</th>
                                                                        <th className="text-right py-1 px-2">Clicks</th>
                                                                        <th className="text-right py-1 px-2">Impressions</th>
                                                                        <th className="text-right py-1 px-2">CTR</th>
                                                                        <th className="text-right py-1 pl-2">Pos</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {testResult.samplePerformance.map((row: any, i: number) => (
                                                                        <tr key={i} className="border-b border-dashed last:border-0">
                                                                            <td className="py-1 pr-2 max-w-[200px] truncate">{row.keys?.[0] || '-'}</td>
                                                                            <td className="text-right py-1 px-2">{row.clicks}</td>
                                                                            <td className="text-right py-1 px-2">{row.impressions}</td>
                                                                            <td className="text-right py-1 px-2">{(row.ctr * 100).toFixed(1)}%</td>
                                                                            <td className="text-right py-1 pl-2">{row.position?.toFixed(1)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                                        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Not Connected</p>
                                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                                                Connect your Google Search Console and Analytics to start generating
                                                SEO optimization suggestions based on real performance data.
                                            </p>
                                            <ul className="text-xs text-amber-600 dark:text-amber-400 mt-2 space-y-1 list-disc list-inside">
                                                <li>Search Console — ranking positions, CTR, impressions, queries</li>
                                                <li>Analytics 4 — bounce rates, engagement time, scroll depth</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <Button onClick={handleConnect} disabled={connecting}>
                                        {connecting
                                            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting…</>
                                            : <><PlugZap className="w-4 h-4 mr-1.5" /> Connect Google Account</>
                                        }
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Heuristic Rules Documentation */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Zap className="w-4 h-4" />
                                Detection Rules
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {HEURISTIC_RULES.map(rule => (
                                    <div key={rule.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] h-5 shrink-0 mt-0.5"
                                            style={{
                                                borderColor: scopeColors[rule.scope],
                                                color: scopeColors[rule.scope],
                                            }}
                                        >
                                            {rule.id}
                                        </Badge>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{rule.label}</p>
                                            <p className="text-xs text-muted-foreground">{rule.description}</p>
                                            <div className="flex gap-1 mt-1">
                                                {rule.metricsUsed.map((m, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[9px] h-4">{m}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Mini Stat Component ──────────────────────────────────────────────────────

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
            <span className="text-muted-foreground">{icon}</span>
            <div>
                <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
            </div>
        </div>
    );
}
