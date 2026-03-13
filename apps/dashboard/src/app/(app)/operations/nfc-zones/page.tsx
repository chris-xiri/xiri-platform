'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    doc, getDoc, setDoc, serverTimestamp,
    collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, NfcZone, NfcZoneConfig } from '@xiri-facility-solutions/shared';

// Inline task frequency map (from CLEANING_TASKS) — avoids subpath import issue
const TASK_RECOMMENDED_FREQ: Record<string, string> = {
    trash: 'max', dust: 'max', wipe: 'max', 'glass-entry': '3',
    'restroom-clean': 'max', 'restroom-restock': 'max',
    vacuum: 'max', mop: 'max', sweep: 'max',
    breakroom: '3', 'glass-interior': '1',
    'high-dust': '0.25', 'floor-wax': '0.25', 'carpet-extract': '0.25', 'pressure-wash': '0.25',
};

function resolveFrequency(recommended: string, bidFreq: string): string {
    if (bidFreq === 'once') return 'once';
    if (recommended === 'max') return bidFreq;
    const bid = parseFloat(bidFreq), rec = parseFloat(recommended);
    if (isNaN(rec)) return bidFreq;
    return String(Math.min(rec, bid));
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ArrowLeft, Plus, Trash2, Save, MapPin, Tag, Info,
    CheckCircle2, Package, Loader2, Wifi, Pencil, Smartphone,
    ChevronDown, X, Shield, Eye, EyeOff, Copy, KeyRound,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface RoomType {
    name: string;
    tasks: { id: string; name: string; recommendedFrequency: string }[];
}

interface ZoneDraft {
    id: string;
    name: string;
    tagId: string;
    tagLocationHint: string;
    roomTypeNames: string[];
    excludedTaskIds: string[];
}

interface StartTagDraft {
    tagId: string;
    locationHint: string;
}

type SetupStep = 'ready' | 'scanning' | 'configuring';
type WalkthroughPhase = 'start_tag' | 'zones';

// ─── Helpers ─────────────────────────────────────────────────────────
function extractRoomTypes(wo: WorkOrder): RoomType[] {
    const typeMap = new Map<string, RoomType>();
    for (const task of wo.tasks || []) {
        const t = task as any;
        const typeName = t.roomName || 'General Tasks';
        if (!typeMap.has(typeName)) {
            typeMap.set(typeName, { name: typeName, tasks: [] });
        }
        // Look up recommended frequency
        const recFreq = TASK_RECOMMENDED_FREQ[t.id || task.id] || 'max';
        typeMap.get(typeName)!.tasks.push({
            id: t.id || task.id,
            name: t.name || task.name,
            recommendedFrequency: recFreq,
        });
    }
    return Array.from(typeMap.values());
}

function generateZoneId(): string {
    return `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateFakeTagId(): string {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    return `04:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
}

function generateSiteKeyPassword(): string {
    // Generate a readable 6-char alphanumeric key (easy to share verbally)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** SHA-256 hash (must match the Cloud Function) */
async function hashSiteKey(plainKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function isWebNfcSupported(): boolean {
    return typeof window !== 'undefined' && 'NDEFReader' in window;
}

// ─── Page Content ────────────────────────────────────────────────────
function NfcZoneSetup() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const woId = searchParams.get('woId');

    const [wo, setWo] = useState<(WorkOrder & { id: string }) | null>(null);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [zones, setZones] = useState<ZoneDraft[]>([]);
    const [startTag, setStartTag] = useState<StartTagDraft>({ tagId: '', locationHint: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Site key state
    const [siteKeyPlain, setSiteKeyPlain] = useState('');
    const [showSiteKey, setShowSiteKey] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [vendorName, setVendorName] = useState('');
    const [savedLocationId, setSavedLocationId] = useState('');

    // Walkthrough phase
    const [phase, setPhase] = useState<WalkthroughPhase>('start_tag');

    // Tap-first flow state
    const [step, setStep] = useState<SetupStep>('ready');
    const [manualTagInput, setManualTagInput] = useState('');
    const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
    const [nfcError, setNfcError] = useState<string | null>(null);
    const [nfcAbortController, setNfcAbortController] = useState<AbortController | null>(null);
    const [activeZone, setActiveZone] = useState<ZoneDraft | null>(null);
    const [expandedRoomType, setExpandedRoomType] = useState<string | null>(null);

    // Work order picker
    const [allWorkOrders, setAllWorkOrders] = useState<(WorkOrder & { id: string })[]>([]);

    const isDev = process.env.NODE_ENV === 'development';
    const hasWebNfc = isWebNfcSupported();

    useEffect(() => {
        async function loadData() {
            if (woId) {
                const snap = await getDoc(doc(db, 'work_orders', woId));
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as WorkOrder & { id: string };
                    setWo(data);
                    setRoomTypes(extractRoomTypes(data));

                    // Load existing site config if any
                    const siteDoc = await getDoc(doc(db, 'nfc_sites', data.locationId || `${data.leadId}_loc`));
                    if (siteDoc.exists()) {
                        const siteData = siteDoc.data();
                        setStartTag({
                            tagId: siteData.startTagId || '',
                            locationHint: siteData.startTagLocationHint || '',
                        });
                        setVendorName(siteData.vendorName || '');
                        setZones((siteData.zones || []).map((z: any) => ({
                            id: z.id,
                            name: z.name,
                            tagId: z.tagId,
                            tagLocationHint: z.tagLocationHint || '',
                            roomTypeNames: z.roomIds || z.roomTypeNames || [],
                            excludedTaskIds: z.excludedTaskIds || [],
                        })));
                        // If already configured, go straight to zones phase
                        if (siteData.startTagId) {
                            setPhase('zones');
                        }
                    } else {
                        // Also check legacy nfc_zones collection
                        const legacyId = `${data.leadId}_${data.locationId}`;
                        const legacyDoc = await getDoc(doc(db, 'nfc_zones', legacyId));
                        if (legacyDoc.exists()) {
                            const legacyData = legacyDoc.data() as NfcZoneConfig;
                            setZones(legacyData.zones.map(z => ({
                                id: z.id,
                                name: z.name,
                                tagId: z.tagId,
                                tagLocationHint: z.tagLocationHint || '',
                                roomTypeNames: z.roomIds,
                                excludedTaskIds: [],
                            })));
                        }
                    }
                }
            } else {
                const q = query(
                    collection(db, 'work_orders'),
                    where('status', 'in', ['active', 'pending_assignment', 'paused']),
                );
                const snap = await getDocs(q);
                setAllWorkOrders(
                    snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }))
                );
            }
            setLoading(false);
        }
        loadData();
    }, [woId]);

    // ─── NFC Scanning ────────────────────────────────────────────────
    const startNfcScan = useCallback(async () => {
        setStep('scanning');
        setNfcError(null);
        try {
            const ndef = new (window as any).NDEFReader();
            const controller = new AbortController();
            setNfcAbortController(controller);
            await ndef.scan({ signal: controller.signal });
            ndef.addEventListener('reading', (event: any) => {
                controller.abort();
                setNfcAbortController(null);
                if (phase === 'start_tag') {
                    setStartTag(prev => ({ ...prev, tagId: event.serialNumber || '' }));
                    setStep('ready');
                } else {
                    handleTagDetected(event.serialNumber || '');
                }
            });
        } catch (err: any) {
            setNfcError(err.message || 'NFC scan failed');
            setStep('ready');
        }
    }, [phase]);

    const cancelNfcScan = () => {
        nfcAbortController?.abort();
        setNfcAbortController(null);
        setStep('ready');
    };

    const handleTagDetected = (tagId: string) => {
        const existingZone = zones.find(z => z.tagId === tagId);
        if (existingZone) {
            setActiveZone({ ...existingZone });
            setEditingZoneId(existingZone.id);
        } else {
            setActiveZone({
                id: generateZoneId(),
                name: '',
                tagId,
                tagLocationHint: '',
                roomTypeNames: [],
                excludedTaskIds: [],
            });
            setEditingZoneId(null);
        }
        setStep('configuring');
    };

    const handleManualEntry = () => {
        if (!manualTagInput.trim()) return;
        if (phase === 'start_tag') {
            setStartTag(prev => ({ ...prev, tagId: manualTagInput.trim() }));
            setManualTagInput('');
        } else {
            handleTagDetected(manualTagInput.trim());
            setManualTagInput('');
        }
    };

    const handleSimulateTap = () => {
        if (phase === 'start_tag') {
            setStartTag(prev => ({ ...prev, tagId: generateFakeTagId() }));
        } else {
            handleTagDetected(generateFakeTagId());
        }
    };

    // ─── Zone Config Actions ─────────────────────────────────────────
    const toggleRoomType = (typeName: string) => {
        if (!activeZone) return;
        setActiveZone(prev => {
            if (!prev) return null;
            const has = prev.roomTypeNames.includes(typeName);
            return {
                ...prev,
                roomTypeNames: has
                    ? prev.roomTypeNames.filter(n => n !== typeName)
                    : [...prev.roomTypeNames, typeName],
            };
        });
    };

    const saveActiveZone = () => {
        if (!activeZone || !activeZone.tagId || activeZone.roomTypeNames.length === 0) return;
        const zoneName = activeZone.name || activeZone.roomTypeNames.join(' + ');
        const finalZone = { ...activeZone, name: zoneName };
        if (editingZoneId) {
            setZones(prev => prev.map(z => z.id === editingZoneId ? finalZone : z));
        } else {
            setZones(prev => [...prev, finalZone]);
        }
        setActiveZone(null);
        setEditingZoneId(null);
        setStep('ready');
    };

    const cancelConfig = () => {
        setActiveZone(null);
        setEditingZoneId(null);
        setStep('ready');
    };

    const removeZone = (zoneId: string) => {
        setZones(prev => prev.filter(z => z.id !== zoneId));
    };

    const editZone = (zone: ZoneDraft) => {
        setActiveZone({ ...zone });
        setEditingZoneId(zone.id);
        setStep('configuring');
    };

    // ─── Copy site key ──────────────────────────────────────────────
    const copySiteKey = async () => {
        if (!siteKeyPlain) return;
        await navigator.clipboard.writeText(siteKeyPlain);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    // ─── Save to Firestore ───────────────────────────────────────────
    const handleSaveAll = async () => {
        if (!wo || !profile) return;
        if (!startTag.tagId) return;
        if (zones.length === 0) return;
        if (!vendorName.trim()) return;

        setSaving(true);

        try {
            // Default site key to vendor name if not set
            let plainKey = siteKeyPlain || vendorName.trim().toUpperCase();
            setSiteKeyPlain(plainKey);

            const siteKeyHash = await hashSiteKey(plainKey);
            const managerKeyHash = await hashSiteKey(`${plainKey}-AUDIT`);
            const locationId = wo.locationId || `${wo.leadId}_loc`;
            setSavedLocationId(locationId);

            // Resolve bid frequency from WO's first line item or calculator inputs
            const woLineItem = (wo as any).lineItems?.[0];
            const bidFrequency = (wo as any).calculatorInputs?.frequency || woLineItem?.frequency || '5';

            const nfcZones: NfcZone[] = zones.map(z => {
                // Resolve actual tasks from room types, excluding any deselected tasks
                const zoneTasks: { id: string; name: string; roomType: string; frequency: string }[] = [];
                for (const rtName of z.roomTypeNames) {
                    const rt = roomTypes.find(r => r.name === rtName);
                    if (rt) {
                        for (const task of rt.tasks) {
                            if (!z.excludedTaskIds.includes(task.id)) {
                                const resolved = resolveFrequency(task.recommendedFrequency, bidFrequency);
                                zoneTasks.push({ id: task.id, name: task.name, roomType: rtName, frequency: resolved });
                            }
                        }
                    }
                }
                return {
                    id: z.id,
                    name: z.name,
                    tagId: z.tagId,
                    ...(z.tagLocationHint ? { tagLocationHint: z.tagLocationHint } : {}),
                    roomIds: z.roomTypeNames,
                    tasks: zoneTasks,
                };
            });

            await setDoc(doc(db, 'nfc_sites', locationId), {
                siteKeyHash,
                managerKeyHash,
                locationId,
                locationName: wo.locationName,
                leadId: wo.leadId,
                vendorName: vendorName.trim(),
                startTagId: startTag.tagId,
                ...(startTag.locationHint ? { startTagLocationHint: startTag.locationHint } : {}),
                zones: nfcZones,
                // Service schedule for frequency-aware task display
                bidFrequency,
                daysOfWeek: woLineItem?.daysOfWeek || null,
                createdBy: profile.uid || profile.email || 'unknown',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // Show the site key to the FM so they can share it
            setShowSiteKey(true);
        } catch (err) {
            console.error('Error saving NFC site config:', err);
        } finally {
            setSaving(false);
        }
    };

    // ─── Loading ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ─── Work Order Picker ───────────────────────────────────────────
    if (!wo) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">NFC Zone Setup</h1>
                        <p className="text-sm text-muted-foreground">Select a work order to configure NFC zones</p>
                    </div>
                </div>
                {allWorkOrders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Package className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-muted-foreground">No work orders found.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {allWorkOrders.map(wo => (
                            <Card
                                key={wo.id}
                                className="cursor-pointer hover:border-primary/50 transition-all"
                                onClick={() => router.push(`/operations/nfc-zones?woId=${wo.id}`)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{wo.locationName}</p>
                                            <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {(wo.tasks || []).length} tasks
                                    </Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── No tasks ────────────────────────────────────────────────────
    if (roomTypes.length === 0) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">NFC Zone Setup</h1>
                </div>
                <Card>
                    <CardContent className="py-12 text-center">
                        <Info className="w-10 h-10 mx-auto text-amber-500 mb-3" />
                        <p className="font-medium mb-1">No task data available</p>
                        <p className="text-sm text-muted-foreground">
                            This work order doesn&apos;t have task assignments.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS: Site key generated — show it to FM
    // ═══════════════════════════════════════════════════════════════
    if (showSiteKey && siteKeyPlain) {
        return (
            <div className="max-w-md mx-auto space-y-6 pt-8">
                <Card className="overflow-hidden">
                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-lg font-bold">NFC Setup Complete!</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {wo.locationName} • {zones.length} zones configured
                        </p>
                    </div>

                    <CardContent className="p-5 space-y-4">
                        {/* Site Key */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <KeyRound className="w-3 h-3" /> Site Key (share with {vendorName})
                            </Label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted/50 rounded-lg px-4 py-3 font-mono text-xl font-bold tracking-[0.3em] text-center select-all">
                                    {siteKeyPlain}
                                </div>
                                <Button variant="outline" size="icon" className="shrink-0" onClick={copySiteKey}>
                                    {copiedKey ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Give this key to the cleaning crew. They&apos;ll enter it once when they first tap the Start tag.
                            </p>
                        </div>

                        {/* Start Tag Info */}
                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                            <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Start Tag</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{startTag.tagId}</p>
                            {startTag.locationHint && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">📍 {startTag.locationHint}</p>
                            )}
                        </div>

                        {/* Public Start URL */}
                        {savedLocationId && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">📱 Public Start URL</p>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                                    <code className="flex-1 text-[10px] font-mono break-all select-all">
                                        {typeof window !== 'undefined' ? `${window.location.origin.replace(':3001', ':3000')}/s/${savedLocationId}` : `/s/${savedLocationId}`}
                                    </code>
                                    <Button variant="outline" size="icon" className="shrink-0 h-7 w-7" onClick={() => {
                                        const url = `${window.location.origin.replace(':3001', ':3000')}/s/${savedLocationId}`;
                                        navigator.clipboard.writeText(url);
                                        setCopiedUrl(true);
                                        setTimeout(() => setCopiedUrl(false), 2000);
                                    }}>
                                        {copiedUrl ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    This is the URL cleaners visit after tapping the Start NFC tag.
                                </p>
                            </div>
                        )}

                        {/* Zone Summary */}
                        <div className="space-y-1">
                            {zones.map((z, i) => (
                                <div key={z.id} className="flex items-center gap-2 text-xs">
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 shrink-0">Z{i + 1}</Badge>
                                    <span className="truncate">{z.name}</span>
                                    <span className="text-muted-foreground ml-auto shrink-0">
                                        {z.roomTypeNames.length} types
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full gap-2"
                            onClick={() => { window.location.href = '/operations/nfc-zones'; }}
                        >
                            Done
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: START TAG SETUP
    // ═══════════════════════════════════════════════════════════════
    if (phase === 'start_tag') {
        return (
            <div className="max-w-2xl mx-auto space-y-6 pb-20">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/operations/nfc-zones')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">Walkthrough Setup</h1>
                        <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                            {wo.locationName}
                        </p>
                    </div>
                </div>

                {/* Phase indicator */}
                <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">Step 1 of 3</Badge>
                    <span className="text-sm text-muted-foreground">Place the Start tag at the entrance</span>
                </div>

                {/* Vendor Name */}
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                                Subcontractor / Cleaning Company <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={vendorName}
                                onChange={e => {
                                    setVendorName(e.target.value);
                                    // Auto-fill site key if user hasn't customized it
                                    if (!siteKeyPlain || siteKeyPlain === vendorName.trim().toUpperCase()) {
                                        setSiteKeyPlain(e.target.value.trim().toUpperCase());
                                    }
                                }}
                                placeholder="e.g. ABC Cleaning Services"
                                className="h-9 text-sm"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                This name will show when cleaners tap the Start tag.
                            </p>
                        </div>

                        {/* Site Key */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <KeyRound className="w-3 h-3" /> Site Key (password for cleaners) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={siteKeyPlain}
                                onChange={e => setSiteKeyPlain(e.target.value.toUpperCase())}
                                placeholder="Defaults to subcontractor name"
                                className="h-9 text-sm font-mono tracking-wider uppercase"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Cleaners enter this once to access the site. Defaults to company name.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Start Tag */}
                <Card className="overflow-hidden">
                    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-5 text-center">
                        <Shield className="w-12 h-12 mx-auto text-purple-600 mb-3" />
                        <h2 className="text-base font-bold">Place Start Tag at Entrance</h2>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                            This tag goes at the front entrance. Cleaners tap it to clock in each shift.
                        </p>
                    </div>

                    <CardContent className="p-4 space-y-3">
                        {startTag.tagId ? (
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Tag registered!</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">{startTag.tagId}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto text-xs"
                                    onClick={() => setStartTag(prev => ({ ...prev, tagId: '' }))}
                                >
                                    Change
                                </Button>
                            </div>
                        ) : (
                            <>
                                {hasWebNfc && (
                                    <Button className="w-full h-12 gap-2 bg-purple-600 hover:bg-purple-700" onClick={startNfcScan}>
                                        <Wifi className="w-5 h-5" /> Tap Start Tag
                                    </Button>
                                )}

                                {hasWebNfc && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-xs text-muted-foreground">or enter manually</span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>
                                )}

                                {!hasWebNfc && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 mb-1">
                                        <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-400">
                                            Use an NFC reader app to get the tag ID, then paste below.
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Input
                                        value={manualTagInput}
                                        onChange={e => setManualTagInput(e.target.value)}
                                        placeholder="Paste tag ID"
                                        className="h-10 font-mono text-sm"
                                    />
                                    <Button onClick={handleManualEntry} disabled={!manualTagInput.trim()}>Add</Button>
                                </div>

                                {isDev && (
                                    <Button
                                        variant="outline"
                                        className="w-full h-9 gap-2 text-xs border-dashed border-purple-300 text-purple-600"
                                        onClick={handleSimulateTap}
                                    >
                                        <Tag className="w-3 h-3" /> 🧪 Simulate Start Tag (Dev)
                                    </Button>
                                )}
                            </>
                        )}

                        {/* Location Hint */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                                📍 Where did you place the Start tag?
                            </Label>
                            <Input
                                value={startTag.locationHint}
                                onChange={e => setStartTag(prev => ({ ...prev, locationHint: e.target.value }))}
                                placeholder="e.g. Inside front door, left wall"
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* NFC Scanning state */}
                        {step === 'scanning' && (
                            <div className="py-4 text-center space-y-2">
                                <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 flex items-center justify-center animate-pulse">
                                    <Wifi className="w-6 h-6 text-purple-600" />
                                </div>
                                <p className="text-sm font-medium">Waiting for NFC tag...</p>
                                <Button variant="outline" size="sm" onClick={cancelNfcScan}>Cancel</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Continue to Zones */}
                <Button
                    className="w-full h-12 gap-2"
                    disabled={!startTag.tagId || !vendorName.trim()}
                    onClick={() => setPhase('zones')}
                >
                    Continue to Zone Tags →
                </Button>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: ZONE TAGS
    // ═══════════════════════════════════════════════════════════════
    const totalZoneTasks = zones.reduce((sum, z) => {
        return sum + z.roomTypeNames.reduce((s, name) => {
            const rt = roomTypes.find(r => r.name === name);
            return s + (rt?.tasks.length || 0);
        }, 0);
    }, 0);

    const canSave = zones.length > 0 && startTag.tagId && vendorName.trim();

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setPhase('start_tag')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold">Zone Tags</h1>
                    <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                        {wo.locationName}
                    </p>
                </div>
            </div>

            {/* Phase indicator */}
            <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">Step 2 of 3</Badge>
                <span className="text-sm text-muted-foreground">Place zone tags as you walk through</span>
            </div>

            {/* ─── Tap / Enter Tag ─── */}
            {step === 'ready' && (
                <Card className="overflow-hidden">
                    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-5 text-center">
                        <Wifi className="w-12 h-12 mx-auto text-purple-600 mb-3" />
                        <h2 className="text-base font-bold">
                            {zones.length === 0 ? 'Place Your First Zone Tag' : 'Place Next Zone Tag'}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                            Stick a tag in the area, then tap it to register.
                        </p>
                    </div>
                    <CardContent className="p-4 space-y-3">
                        {hasWebNfc && (
                            <Button className="w-full h-12 gap-2 bg-purple-600 hover:bg-purple-700" onClick={startNfcScan}>
                                <Wifi className="w-5 h-5" /> Tap Zone Tag
                            </Button>
                        )}
                        {hasWebNfc && (
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">or enter manually (iOS)</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>
                        )}
                        {!hasWebNfc && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 mb-1">
                                <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Paste the tag ID from your NFC reader app.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input
                                value={manualTagInput}
                                onChange={e => setManualTagInput(e.target.value)}
                                placeholder="Paste tag ID"
                                className="h-10 font-mono text-sm"
                            />
                            <Button onClick={handleManualEntry} disabled={!manualTagInput.trim()}>Add</Button>
                        </div>
                        {isDev && (
                            <Button
                                variant="outline"
                                className="w-full h-9 gap-2 text-xs border-dashed border-purple-300 text-purple-600"
                                onClick={handleSimulateTap}
                            >
                                <Tag className="w-3 h-3" /> 🧪 Simulate Zone Tap (Dev)
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Scanning ─── */}
            {step === 'scanning' && (
                <Card>
                    <CardContent className="py-10 text-center space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center animate-pulse">
                            <Wifi className="w-8 h-8 text-purple-600" />
                        </div>
                        <p className="text-sm font-medium">Waiting for NFC tag...</p>
                        {nfcError && <p className="text-xs text-red-500">{nfcError}</p>}
                        <Button variant="outline" size="sm" onClick={cancelNfcScan}>Cancel</Button>
                    </CardContent>
                </Card>
            )}

            {/* ─── Configuring Zone ─── */}
            {step === 'configuring' && activeZone && (
                <Card className="border-purple-200 dark:border-purple-800 overflow-hidden">
                    <div className="bg-purple-50 dark:bg-purple-950/20 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-mono font-medium text-purple-700 dark:text-purple-400">
                                {activeZone.tagId}
                            </span>
                        </div>
                        {editingZoneId && <Badge variant="secondary" className="text-[10px]">Editing</Badge>}
                    </div>
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Zone Name</Label>
                            <Input
                                value={activeZone.name}
                                onChange={e => setActiveZone(prev => prev ? { ...prev, name: e.target.value } : null)}
                                placeholder="e.g. Patient Room 101, Main Restroom"
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">📍 Where did you place this tag?</Label>
                            <Input
                                value={activeZone.tagLocationHint}
                                onChange={e => setActiveZone(prev => prev ? { ...prev, tagLocationHint: e.target.value } : null)}
                                placeholder="e.g. Behind the door, left side near light switch"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">What tasks apply here?</Label>
                            <div className="space-y-1.5">
                                {roomTypes.map(rt => {
                                    const isChecked = activeZone.roomTypeNames.includes(rt.name);
                                    const isExpanded = expandedRoomType === rt.name;
                                    const includedTasks = rt.tasks.filter(t => !activeZone.excludedTaskIds.includes(t.id));
                                    const allIncluded = includedTasks.length === rt.tasks.length;
                                    return (
                                        <div key={rt.name} className={`rounded-lg border transition-all ${
                                            isChecked
                                                ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/20'
                                                : 'border-border hover:border-muted-foreground/30'
                                        }`}>
                                            {/* Room type header */}
                                            <div className="flex items-center gap-3 p-3 cursor-pointer"
                                                onClick={() => toggleRoomType(rt.name)}>
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => toggleRoomType(rt.name)}
                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{rt.name}</p>
                                                    {!isExpanded && (
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {isChecked && !allIncluded
                                                                ? `${includedTasks.length}/${rt.tasks.length} tasks selected`
                                                                : rt.tasks.map(t => t.name).join(' • ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    className="p-1 rounded hover:bg-muted/50 transition-colors shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedRoomType(isExpanded ? null : rt.name);
                                                    }}
                                                >
                                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>
                                            {/* Expanded task list */}
                                            {isExpanded && isChecked && (
                                                <div className="px-3 pb-3 pt-0 space-y-1 border-t border-purple-200/50 dark:border-purple-800/50 mt-0">
                                                    <p className="text-[10px] text-muted-foreground pt-2 pb-1">Toggle individual tasks:</p>
                                                    {rt.tasks.map(task => {
                                                        const taskIncluded = !activeZone.excludedTaskIds.includes(task.id);
                                                        return (
                                                            <label
                                                                key={task.id}
                                                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-all text-sm ${
                                                                    taskIncluded
                                                                        ? 'bg-white/60 dark:bg-white/5'
                                                                        : 'opacity-50 line-through'
                                                                }`}
                                                            >
                                                                <Checkbox
                                                                    checked={taskIncluded}
                                                                    onCheckedChange={() => {
                                                                        setActiveZone(prev => {
                                                                            if (!prev) return null;
                                                                            const excluded = prev.excludedTaskIds;
                                                                            return {
                                                                                ...prev,
                                                                                excludedTaskIds: taskIncluded
                                                                                    ? [...excluded, task.id]
                                                                                    : excluded.filter(id => id !== task.id),
                                                                            };
                                                                        });
                                                                    }}
                                                                />
                                                                <span>{task.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {isExpanded && !isChecked && (
                                                <div className="px-3 pb-3 pt-1 border-t border-border">
                                                    <p className="text-[10px] text-muted-foreground italic">Enable this room type to configure tasks</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={cancelConfig}>Cancel</Button>
                            <Button
                                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                                onClick={saveActiveZone}
                                disabled={activeZone.roomTypeNames.length === 0}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {editingZoneId ? 'Update Zone' : 'Save & Next'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Saved Zones ─── */}
            {zones.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Zones ({zones.length})
                        </h3>
                        <span className="text-xs text-muted-foreground">{totalZoneTasks} total tasks</span>
                    </div>
                    {zones.map((zone, i) => (
                        <Card key={zone.id} className="group hover:border-primary/30 transition-all">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                                    <Tag className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{zone.name}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">{zone.tagId}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {zone.roomTypeNames.map(name => (
                                            <Badge key={name} variant="secondary" className="text-[9px] py-0 h-4">{name}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editZone(zone)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => removeZone(zone.id)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {zones.length === 0 && step === 'ready' && (
                <Card className="bg-muted/20 border-dashed">
                    <CardContent className="py-6 text-center">
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            Walk through the facility and place zone tags as you go.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Room types reference */}
            <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronDown className="w-3 h-3 -rotate-90 group-open:rotate-0 transition-transform" />
                    View room types ({roomTypes.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                    {roomTypes.map(rt => (
                        <Badge key={rt.name} variant="outline" className="gap-1 text-xs py-1">
                            {rt.name} <span className="text-muted-foreground/60">({rt.tasks.length})</span>
                        </Badge>
                    ))}
                </div>
            </details>

            {/* Save & finish */}
            <Button
                className="w-full h-12 gap-2"
                disabled={!canSave || saving}
                onClick={handleSaveAll}
            >
                {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                    <>Save & Generate Site Key →</>
                )}
            </Button>
        </div>
    );
}

export default function NfcZonesPage() {
    return (
        <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <NfcZoneSetup />
        </Suspense>
    );
}
