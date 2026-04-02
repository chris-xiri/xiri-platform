"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Loader2, Plus, Trash2, ChevronUp, ChevronDown, Edit3,
    GripVertical, ArrowRight, Mail, Rocket, Building2, HardHat,
    Handshake, Star, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
export interface SequenceStep {
    templateId: string;
    dayOffset: number;
    label: string;
}

export interface EmailSequence {
    id: string;
    name: string;
    description: string;
    category: 'lead' | 'vendor' | 'referral' | 'custom';
    steps: SequenceStep[];
    createdAt?: any;
    updatedAt?: any;
    createdBy?: string;
}

interface TemplateOption {
    id: string;
    name: string;
    subject: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    lead: { label: 'Lead', icon: <Building2 className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    vendor: { label: 'Vendor', icon: <HardHat className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    referral: { label: 'Referral', icon: <Handshake className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    custom: { label: 'Custom', icon: <Star className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

// ─── Main Component ───────────────────────────────────────────────
export default function SequenceBuilder() {
    const [sequences, setSequences] = useState<EmailSequence[]>([]);
    const [templates, setTemplates] = useState<TemplateOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Create / Edit state
    const [showEditor, setShowEditor] = useState(false);
    const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
    const [editorName, setEditorName] = useState("");
    const [editorDescription, setEditorDescription] = useState("");
    const [editorCategory, setEditorCategory] = useState<string>("lead");
    const [editorSteps, setEditorSteps] = useState<SequenceStep[]>([]);
    const [saving, setSaving] = useState(false);

    // Delete
    const [deleteTarget, setDeleteTarget] = useState<EmailSequence | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [seqSnap, tplSnap] = await Promise.all([
                getDocs(collection(db, "sequences")),
                getDocs(collection(db, "templates")),
            ]);
            setSequences(seqSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmailSequence)));
            setTemplates(
                tplSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.id,
                    subject: d.data().subject || '',
                }))
            );
        } catch (err) {
            console.error("Error fetching sequences:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Editor helpers ───────────────────────────────────────────
    const openCreate = () => {
        setEditingSequence(null);
        setEditorName("");
        setEditorDescription("");
        setEditorCategory("lead");
        setEditorSteps([{ templateId: "", dayOffset: 0, label: "Step 1" }]);
        setShowEditor(true);
    };

    const openEdit = (seq: EmailSequence) => {
        setEditingSequence(seq);
        setEditorName(seq.name);
        setEditorDescription(seq.description);
        setEditorCategory(seq.category);
        setEditorSteps([...seq.steps]);
        setShowEditor(true);
    };

    const addStep = () => {
        const lastOffset = editorSteps.length > 0 ? editorSteps[editorSteps.length - 1].dayOffset : 0;
        setEditorSteps([...editorSteps, { templateId: "", dayOffset: lastOffset + 3, label: `Step ${editorSteps.length + 1}` }]);
    };

    const removeStep = (idx: number) => {
        setEditorSteps(editorSteps.filter((_, i) => i !== idx));
    };

    const updateStep = (idx: number, field: keyof SequenceStep, value: string | number) => {
        const updated = [...editorSteps];
        (updated[idx] as any)[field] = value;
        setEditorSteps(updated);
    };

    const moveStep = (idx: number, direction: 'up' | 'down') => {
        const updated = [...editorSteps];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= updated.length) return;
        [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
        setEditorSteps(updated);
    };

    const handleSave = async () => {
        if (!editorName.trim() || editorSteps.length === 0) return;
        setSaving(true);
        try {
            const id = editingSequence?.id ||
                editorName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_sequence';

            await setDoc(doc(db, "sequences", id), {
                name: editorName.trim(),
                description: editorDescription.trim(),
                category: editorCategory,
                steps: editorSteps.filter(s => s.templateId),
                updatedAt: serverTimestamp(),
                ...(!editingSequence ? { createdAt: serverTimestamp(), createdBy: 'dashboard' } : {}),
            }, { merge: true });

            setShowEditor(false);
            await fetchData();
        } catch (err) {
            console.error("Error saving sequence:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "sequences", deleteTarget.id));
            setDeleteTarget(null);
            if (expandedId === deleteTarget.id) setExpandedId(null);
            await fetchData();
        } catch (err) {
            console.error("Error deleting sequence:", err);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const grouped: Record<string, EmailSequence[]> = {};
    for (const seq of sequences) {
        const cat = seq.category || 'custom';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(seq);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-muted-foreground text-sm">
                        Build multi-step email sequences. Assign them to contacts or vendors manually from the CRM.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Sequence
                </Button>
            </div>

            {/* Sequence list grouped by category */}
            {sequences.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Rocket className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-medium text-sm">No Sequences Yet</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Create your first email sequence or run the seed script.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(CATEGORY_CONFIG).map(([catKey, catCfg]) => {
                    const catSequences = grouped[catKey];
                    if (!catSequences || catSequences.length === 0) return null;

                    return (
                        <div key={catKey} className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                {catCfg.icon}
                                <span>{catCfg.label} Sequences</span>
                                <Badge variant="outline" className="text-[10px]">{catSequences.length}</Badge>
                            </div>

                            {catSequences.map(seq => {
                                const isExpanded = expandedId === seq.id;

                                return (
                                    <Card key={seq.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}>
                                        <CardHeader
                                            className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                                            onClick={() => setExpandedId(isExpanded ? null : seq.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${catCfg.color}`}>
                                                        {catCfg.icon}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-sm">{seq.name}</CardTitle>
                                                        {seq.description && (
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{seq.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className={`text-[10px] ${catCfg.color}`}>
                                                        {catCfg.label}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </CardHeader>

                                        {isExpanded && (
                                            <CardContent className="border-t pt-4 space-y-4">
                                                {/* Visual step timeline */}
                                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                                    {seq.steps.map((step, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-muted/30">
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                                                    {i + 1}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{step.label}</span>
                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        Day {step.dayOffset}
                                                                        {step.templateId && (
                                                                            <> · <code className="bg-muted px-1 rounded">{step.templateId}</code></>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {i < seq.steps.length - 1 && (
                                                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 pt-2 border-t">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(seq)}>
                                                        <Edit3 className="w-3 h-3" /> Edit
                                                    </Button>
                                                    <Button
                                                        size="sm" variant="ghost"
                                                        className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                                                        onClick={() => setDeleteTarget(seq)}
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Delete
                                                    </Button>
                                                    <div className="flex-1" />
                                                    <span className="text-[10px] text-muted-foreground">
                                                        ID: <code className="bg-muted px-1 rounded">{seq.id}</code>
                                                    </span>
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    );
                })
            )}

            {/* ─── Create / Edit Dialog ─── */}
            <AlertDialog open={showEditor} onOpenChange={(open: boolean) => !open && setShowEditor(false)}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {editingSequence ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingSequence ? 'Edit Sequence' : 'New Sequence'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Define the steps, timing, and templates for this email sequence.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name & Category */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Sequence Name</label>
                                <Input value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="e.g. Tenant Lead Outreach" className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Category</label>
                                <Select value={editorCategory} onValueChange={setEditorCategory}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lead">Lead</SelectItem>
                                        <SelectItem value="vendor">Vendor</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Description</label>
                            <Input value={editorDescription} onChange={e => setEditorDescription(e.target.value)} placeholder="Short description..." className="mt-1" />
                        </div>

                        {/* Steps */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Steps</label>
                                <Button size="sm" variant="outline" onClick={addStep} className="h-6 text-[10px] gap-1">
                                    <Plus className="w-3 h-3" /> Add Step
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {editorSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                                            {idx + 1}
                                        </div>

                                        <Input
                                            value={step.label}
                                            onChange={e => updateStep(idx, 'label', e.target.value)}
                                            placeholder="Step label..."
                                            className="h-8 text-xs flex-1 min-w-0"
                                        />

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Day</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={step.dayOffset}
                                                onChange={e => updateStep(idx, 'dayOffset', parseInt(e.target.value) || 0)}
                                                className="h-8 text-xs w-14 text-center"
                                            />
                                        </div>

                                        <Select value={step.templateId} onValueChange={(v: string) => updateStep(idx, 'templateId', v)}>
                                            <SelectTrigger className="h-8 text-xs w-48 flex-shrink-0">
                                                <SelectValue placeholder="Template..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        <span className="text-xs">{t.name}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                                            <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0}
                                                className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                                                <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => moveStep(idx, 'down')} disabled={idx === editorSteps.length - 1}
                                                className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>

                                        <button onClick={() => removeStep(idx)}
                                            className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {editorSteps.length === 0 && (
                                    <div className="text-center py-6 text-xs text-muted-foreground border rounded-lg border-dashed">
                                        No steps yet. Click "Add Step" to start building your sequence.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <Button onClick={handleSave} disabled={saving || !editorName.trim() || editorSteps.length === 0} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            {saving ? 'Saving...' : editingSequence ? 'Update Sequence' : 'Create Sequence'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Delete Confirmation ─── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will not cancel any in-progress sequences already started.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
