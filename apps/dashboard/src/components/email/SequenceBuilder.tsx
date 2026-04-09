"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, limit, orderBy, addDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    ArrowRight, Mail, Rocket, Building2, HardHat,
    Handshake, Star, Clock, Eye, EyeOff, Save, Check,
    Flame, Snowflake, Database, X, Sparkles, Wand2,
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

interface FullTemplate {
    id: string;
    name: string;
    description?: string;
    subject: string;
    body: string;
    category?: string;
    type?: string;
    variables?: string[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; sampleGroup: string }> = {
    lead: { label: 'Lead', icon: <Building2 className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', sampleGroup: 'lead' },
    vendor: { label: 'Vendor', icon: <HardHat className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', sampleGroup: 'contractor' },
    referral: { label: 'Referral', icon: <Handshake className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', sampleGroup: 'referral' },
    custom: { label: 'Custom', icon: <Star className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', sampleGroup: 'lead' },
};

// ─── Merge field sample data (fallback) ───────────────────────────
const SAMPLE_DATA: Record<string, Record<string, string>> = {
    contractor: {
        vendorName: "Bright Shine Cleaning Co.",
        contactName: "Maria",
        city: "Queens",
        state: "NY",
        services: "Janitorial, Floor Care, Post-Construction",
        specialty: "Janitorial",
        onboardingUrl: "https://xiri.ai/contractor?vid=DEMO123",
    },
    lead: {
        businessName: "Garden City Medical Associates",
        contactName: "Dr. Smith",
        facilityType: "Medical Urgent Care",
        address: "123 Main St, Garden City, NY 11530",
        squareFootage: "3,200 sq ft",
    },
    referral: {
        contactName: "Harvey",
        businessName: "Nassau Commercial Realty",
    },
};

// ─── Live data config ─────────────────────────────────────────────
interface LiveDataConfig {
    collection: string;
    orderField: string;
    labelFn: (doc: any) => string;
    toMergeVars: (doc: any) => Record<string, string>;
}

const LIVE_DATA_CONFIG: Record<string, LiveDataConfig> = {
    contractor: {
        collection: 'vendors',
        orderField: 'businessName',
        labelFn: (v) => `${v.contactName || v.businessName || 'Unknown'}  —  ${v.businessName || ''}`,
        toMergeVars: (v: any) => ({
            vendorName: v.companyName || v.businessName || 'your company',
            contactName: v.contactName || v.businessName || 'there',
            city: v.city || 'your area',
            state: v.state || '',
            services: Array.isArray(v.capabilities) && v.capabilities.length > 0
                ? v.capabilities.join(', ')
                : v.specialty || 'Facility Services',
            specialty: v.specialty || v.capabilities?.[0] || 'Services',
            onboardingUrl: `https://xiri.ai/contractor?vid=${v._id || 'DEMO'}`,
        }),
    },
    lead: {
        collection: 'contacts',
        orderField: 'firstName',
        labelFn: (c) => {
            const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
            const email = c.email || '';
            const company = c.companyName || c._companyData?.businessName || '';
            if (name && email) return `${name} <${email}>  —  ${company}`;
            if (email) return `${email}  —  ${company}`;
            return company || c._id || 'Unknown';
        },
        toMergeVars: (c: any) => ({
            contactName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.companyName || 'there',
            contactFirstName: c.firstName || '',
            contactEmail: c.email || '',
            businessName: c.companyName || c._companyData?.businessName || 'Unknown',
            facilityType: c._companyData?.facilityType || '',
            address: c._companyData?.address || `${c._companyData?.city || ''}, ${c._companyData?.state || ''}`.replace(/^,\s*$/, ''),
            squareFootage: c._companyData?.propertySourcing?.squareFootage
                ? `${Number(c._companyData.propertySourcing.squareFootage).toLocaleString()} sq ft`
                : c._companyData?.squareFootage || '',
        }),
    },
    referral: {
        collection: 'contacts',
        orderField: 'firstName',
        labelFn: (c) => {
            const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
            const email = c.email || '';
            const company = c.companyName || c._companyData?.businessName || '';
            if (name && email) return `${name} <${email}>  —  ${company}`;
            if (email) return `${email}  —  ${company}`;
            return company || c._id || 'Unknown';
        },
        toMergeVars: (c: any) => ({
            contactName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.companyName || 'there',
            contactFirstName: c.firstName || '',
            contactEmail: c.email || '',
            businessName: c.companyName || c._companyData?.businessName || '',
        }),
    },
};

// ─── Helpers ──────────────────────────────────────────────────────
function mergePreview(text: string, sampleGroup: string, liveOverride?: Record<string, string>): string {
    let result = text;
    const sample = liveOverride || SAMPLE_DATA[sampleGroup] || {};
    for (const [key, value] of Object.entries(sample)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    result = result.replace(/\[ONBOARDING_LINK\]/g, sample.onboardingUrl || "#");
    return result;
}

function extractMergeFields(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
}

const VARIANT_META: Record<string, { label: string; icon: React.ReactNode; color: string; border: string }> = {
    base: { label: 'Base', icon: <Mail className="w-3.5 h-3.5" />, color: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
    warm: { label: 'Opened', icon: <Flame className="w-3.5 h-3.5" />, color: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
    cold: { label: 'Not Opened', icon: <Snowflake className="w-3.5 h-3.5" />, color: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
};

// ─── Main Component ───────────────────────────────────────────────
export default function SequenceBuilder() {
    const [sequences, setSequences] = useState<EmailSequence[]>([]);
    const [allTemplates, setAllTemplates] = useState<FullTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSeqId, setExpandedSeqId] = useState<string | null>(null);
    const [expandedStepIdx, setExpandedStepIdx] = useState<number | null>(null);
    const [activeVariant, setActiveVariant] = useState<'base' | 'warm' | 'cold'>('base');

    // Template inline edit state
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [activeEditField, setActiveEditField] = useState<'subject' | 'body'>('body');
    const editSubjectRef = useRef<HTMLInputElement>(null);
    const editBodyRef = useRef<HTMLTextAreaElement>(null);

    // Live preview state
    const [useLivePreview, setUseLivePreview] = useState(false);
    const [liveRecords, setLiveRecords] = useState<Record<string, any[]>>({});
    const [selectedRecordIdx, setSelectedRecordIdx] = useState<Record<string, number>>({});
    const [loadingLiveData, setLoadingLiveData] = useState(false);

    // Create / Edit sequence state
    const [showEditor, setShowEditor] = useState(false);
    const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
    const [editorName, setEditorName] = useState("");
    const [editorDescription, setEditorDescription] = useState("");
    const [editorCategory, setEditorCategory] = useState<string>("lead");
    const [editorSteps, setEditorSteps] = useState<SequenceStep[]>([]);
    const [savingSeq, setSavingSeq] = useState(false);

    // Delete
    const [deleteTarget, setDeleteTarget] = useState<EmailSequence | null>(null);
    const [deleting, setDeleting] = useState(false);

    // AI Generation
    const [showAI, setShowAI] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiCategory, setAiCategory] = useState<string>("lead");
    const [aiTone, setAiTone] = useState<string>("professional");
    const [aiNumSteps, setAiNumSteps] = useState(4);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiResult, setAiResult] = useState<{ name: string; description: string; category: string; steps: { label: string; dayOffset: number; subject: string; body: string }[] } | null>(null);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // ─── Data fetching ────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const [seqSnap, tplSnap] = await Promise.all([
                getDocs(collection(db, "sequences")),
                getDocs(collection(db, "templates")),
            ]);
            setSequences(seqSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmailSequence)));
            setAllTemplates(tplSnap.docs.map(d => ({ id: d.id, ...d.data() } as FullTemplate)));
        } catch (err) {
            console.error("Error fetching sequences:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLiveRecords = useCallback(async () => {
        setLoadingLiveData(true);
        try {
            const fetchKeys = new Map<string, { collection: string; orderField: string }>();
            for (const config of Object.values(LIVE_DATA_CONFIG)) {
                const key = `${config.collection}:${config.orderField}`;
                if (!fetchKeys.has(key)) fetchKeys.set(key, config);
            }

            const rawByCollection: Record<string, any[]> = {};
            for (const [key, { collection: col, orderField }] of fetchKeys) {
                const q = query(collection(db, col), orderBy(orderField, 'asc'), limit(25));
                const snap = await getDocs(q);
                rawByCollection[key] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            }

            // Batch-fetch parent company docs for contacts
            const contactsKey = Object.keys(rawByCollection).find(k => k.startsWith('contacts:'));
            if (contactsKey) {
                const contacts = rawByCollection[contactsKey];
                const companyIds = [...new Set(contacts.map((c: any) => c.companyId).filter(Boolean))];
                const companyMap: Record<string, any> = {};

                const companyFetches = companyIds.map(async (cid) => {
                    const compDoc = await getDoc(doc(db, 'companies', cid));
                    if (compDoc.exists()) {
                        companyMap[cid] = compDoc.data();
                    } else {
                        const leadDoc = await getDoc(doc(db, 'leads', cid));
                        if (leadDoc.exists()) companyMap[cid] = leadDoc.data();
                    }
                });
                await Promise.all(companyFetches);

                for (const c of contacts) {
                    c._companyData = companyMap[c.companyId] || {};
                }
            }

            const mapped: Record<string, any[]> = {};
            for (const [group, config] of Object.entries(LIVE_DATA_CONFIG)) {
                const key = `${config.collection}:${config.orderField}`;
                const raw = rawByCollection[key] || [];
                mapped[group] = raw.map(r => ({
                    ...r,
                    _label: config.labelFn(r),
                }));
            }
            setLiveRecords(mapped);
        } catch (error) {
            console.error("Error fetching live preview records:", error);
        } finally {
            setLoadingLiveData(false);
        }
    }, []);

    useEffect(() => { fetchData(); fetchLiveRecords(); }, [fetchData, fetchLiveRecords]);

    // ─── Merge data helper ────────────────────────────────────────
    const getLiveMergeData = useCallback((sampleGroup: string): Record<string, string> | undefined => {
        if (!useLivePreview) return undefined;
        const records = liveRecords[sampleGroup];
        if (!records || records.length === 0) return undefined;
        const idx = selectedRecordIdx[sampleGroup] ?? 0;
        const record = records[idx];
        if (!record) return undefined;
        const config = LIVE_DATA_CONFIG[sampleGroup];
        if (!config) return undefined;
        return config.toMergeVars(record);
    }, [useLivePreview, liveRecords, selectedRecordIdx]);

    // ─── Template lookup helpers ──────────────────────────────────
    const templateMap = useMemo(() => {
        const m: Record<string, FullTemplate> = {};
        for (const t of allTemplates) m[t.id] = t;
        return m;
    }, [allTemplates]);

    // For a step's templateId, find warm/cold variants
    const getStepVariants = useCallback((templateId: string) => {
        const base = templateMap[templateId];
        const warmId = templateId + '_warm';
        const coldId = templateId + '_cold';
        const warm = templateMap[warmId];
        const cold = templateMap[coldId];
        return { base, warm, cold, hasVariants: !!(warm || cold) };
    }, [templateMap]);

    // ─── Inline template edit ─────────────────────────────────────
    const openTemplateEditor = (template: FullTemplate, variant: 'base' | 'warm' | 'cold') => {
        setEditingTemplateId(template.id);
        setEditSubject(template.subject);
        setEditBody(template.body);
        setActiveVariant(variant);
        setPreviewMode(false);
    };

    const handleTemplateSave = async (templateId: string) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "templates", templateId), {
                subject: editSubject,
                body: editBody,
                updatedAt: serverTimestamp(),
            });
            setSaveSuccess(templateId);
            setTimeout(() => setSaveSuccess(null), 2000);
            await fetchData();
        } catch (error) {
            console.error("Error saving template:", error);
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (fieldType: 'subject' | 'body', variable: string) => {
        const token = `{{${variable}}}`;
        const ref = fieldType === 'subject' ? editSubjectRef.current : editBodyRef.current;
        const setter = fieldType === 'subject' ? setEditSubject : setEditBody;
        const value = fieldType === 'subject' ? editSubject : editBody;
        if (ref) {
            const start = ref.selectionStart ?? value.length;
            const end = ref.selectionEnd ?? value.length;
            const newValue = value.slice(0, start) + token + value.slice(end);
            setter(newValue);
            requestAnimationFrame(() => {
                ref.focus();
                ref.setSelectionRange(start + token.length, start + token.length);
            });
        } else {
            setter(value + token);
        }
    };

    // ─── Sequence CRUD ────────────────────────────────────────────
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

    const handleSaveSequence = async () => {
        if (!editorName.trim() || editorSteps.length === 0) return;
        setSavingSeq(true);
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
            setSavingSeq(false);
        }
    };

    const handleDeleteSequence = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "sequences", deleteTarget.id));
            setDeleteTarget(null);
            if (expandedSeqId === deleteTarget.id) setExpandedSeqId(null);
            await fetchData();
        } catch (err) {
            console.error("Error deleting sequence:", err);
        } finally {
            setDeleting(false);
        }
    };

    // ─── AI Generation handlers ──────────────────────────────────
    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setAiGenerating(true);
        setAiError(null);
        setAiResult(null);
        try {
            const generateFn = httpsCallable(functions, 'generateAISequence', { timeout: 120000 });
            const result = await generateFn({
                prompt: aiPrompt.trim(),
                category: aiCategory,
                tone: aiTone,
                numSteps: aiNumSteps,
            });
            const data = result.data as any;
            if (data?.sequence) {
                setAiResult(data.sequence);
            } else {
                setAiError("Unexpected response from AI. Please try again.");
            }
        } catch (err: any) {
            console.error("[AI Generate]", err);
            setAiError(err.message || "Failed to generate. Please try again.");
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAISave = async () => {
        if (!aiResult) return;
        setAiSaving(true);
        try {
            // 1. Create templates first (sequence needs their IDs)
            const templateIds: string[] = [];
            const seqSlug = aiResult.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

            for (let i = 0; i < aiResult.steps.length; i++) {
                const step = aiResult.steps[i];
                const tplId = `${seqSlug}_step_${i + 1}`;

                await setDoc(doc(db, "templates", tplId), {
                    name: step.label || `${aiResult.name} — Step ${i + 1}`,
                    subject: step.subject,
                    body: step.body,
                    description: `Auto-generated by AI for ${aiResult.name}`,
                    category: aiResult.category || aiCategory,
                    type: "prompt",
                    variables: extractMergeFields(step.subject + " " + step.body),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdBy: "ai-generator",
                });
                templateIds.push(tplId);
            }

            // 2. Now create the sequence referencing the template IDs
            const seqId = `${seqSlug}_sequence`;
            const steps: SequenceStep[] = aiResult.steps.map((step, i) => ({
                templateId: templateIds[i],
                dayOffset: step.dayOffset,
                label: step.label || `Step ${i + 1}`,
            }));

            await setDoc(doc(db, "sequences", seqId), {
                name: aiResult.name,
                description: aiResult.description || "",
                category: aiResult.category || aiCategory,
                steps,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: "ai-generator",
            });

            // 3. Close & refresh
            setShowAI(false);
            setAiResult(null);
            setAiPrompt("");
            await fetchData();
        } catch (err) {
            console.error("[AI Save]", err);
            setAiError("Failed to save the generated sequence. Please try again.");
        } finally {
            setAiSaving(false);
        }
    };

    // ─── Expand step + load its template content ──────────────────
    const handleExpandStep = (seqId: string, stepIdx: number, step: SequenceStep, seqCategory: string) => {
        if (expandedSeqId === seqId && expandedStepIdx === stepIdx) {
            // Collapse
            setExpandedStepIdx(null);
            setEditingTemplateId(null);
            setPreviewMode(false);
            return;
        }
        setExpandedSeqId(seqId);
        setExpandedStepIdx(stepIdx);
        setPreviewMode(false);

        const variants = getStepVariants(step.templateId);
        if (variants.hasVariants) {
            const defaultT = variants.warm || variants.cold;
            if (defaultT) {
                openTemplateEditor(defaultT, variants.warm ? 'warm' : 'cold');
            }
        } else if (variants.base) {
            openTemplateEditor(variants.base, 'base');
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
                        Multi-step email sequences with inline template previews. Click any step to view & edit its email.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { setShowAI(true); setAiResult(null); setAiError(null); }}
                        variant="outline" className="gap-2 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                        <Sparkles className="w-4 h-4" />
                        Generate with AI
                    </Button>
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="w-4 h-4" />
                        New Sequence
                    </Button>
                </div>
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
                                const isSeqExpanded = expandedSeqId === seq.id;
                                const sampleGroup = catCfg.sampleGroup;

                                return (
                                    <Card key={seq.id} className={`transition-all ${isSeqExpanded ? 'ring-2 ring-primary/30' : ''}`}>
                                        <CardHeader
                                            className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                                            onClick={() => {
                                                setExpandedSeqId(isSeqExpanded ? null : seq.id);
                                                setExpandedStepIdx(null);
                                                setEditingTemplateId(null);
                                                setPreviewMode(false);
                                            }}
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
                                                    {isSeqExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </CardHeader>

                                        {isSeqExpanded && (
                                            <CardContent className="border-t pt-4 space-y-4">
                                                {/* ═══ STEP PIPELINE ═══ */}
                                                <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                                                    {seq.steps.map((step, idx) => {
                                                        const isStepActive = expandedStepIdx === idx;
                                                        const variants = getStepVariants(step.templateId);
                                                        const tpl = templateMap[step.templateId];

                                                        return (
                                                            <div key={idx} className="flex items-stretch flex-shrink-0">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleExpandStep(seq.id, idx, step, seq.category);
                                                                    }}
                                                                    className={`flex flex-col justify-between min-w-[175px] max-w-[220px] p-3 rounded-xl border-2 transition-all hover:shadow-md text-left ${
                                                                        isStepActive
                                                                            ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-md'
                                                                            : 'border-border bg-card hover:border-muted-foreground/30'
                                                                    }`}
                                                                >
                                                                    <div className="mb-2">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <Badge variant="outline" className="text-[10px] font-mono">Step {idx + 1}</Badge>
                                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                                <Clock className="w-2.5 h-2.5" /> Day {step.dayOffset}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs font-semibold leading-tight">{step.label}</p>
                                                                        {tpl && (
                                                                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
                                                                                {tpl.subject}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {variants.hasVariants ? (
                                                                            <>
                                                                                {variants.warm && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30" title="Opened"><Flame className="w-3 h-3 text-orange-600 dark:text-orange-400" /></span>}
                                                                                {variants.cold && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30" title="Not opened"><Snowflake className="w-3 h-3 text-blue-600 dark:text-blue-400" /></span>}
                                                                                <span className="text-[10px] text-muted-foreground ml-auto">Branched</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Mail className="w-3 h-3 text-muted-foreground" />
                                                                                <span className="text-[10px] text-muted-foreground">Single</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                                {idx < seq.steps.length - 1 && (
                                                                    <div className="flex items-center px-2">
                                                                        <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* ═══ EXPANDED STEP DETAIL ═══ */}
                                                {expandedStepIdx !== null && (() => {
                                                    const step = seq.steps[expandedStepIdx];
                                                    if (!step) return null;
                                                    const variants = getStepVariants(step.templateId);
                                                    const hasWarmCold = variants.hasVariants;
                                                    const availableVariants = hasWarmCold
                                                        ? (['warm', 'cold'] as const).filter(v => variants[v])
                                                        : (['base'] as const).filter(v => variants[v]);
                                                    const currentVariantKey = variants[activeVariant] ? activeVariant : availableVariants[0];
                                                    const currentTemplate = variants[currentVariantKey];
                                                    if (!currentTemplate) {
                                                        return (
                                                            <div className="text-center py-6 text-xs text-muted-foreground border rounded-lg border-dashed">
                                                                <Mail className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                                                Template <code className="bg-muted px-1 rounded">{step.templateId}</code> not found in Firestore.
                                                            </div>
                                                        );
                                                    }

                                                    const vm = VARIANT_META[currentVariantKey];
                                                    const showTabs = hasWarmCold && availableVariants.length > 1;
                                                    const isSaved = saveSuccess === currentTemplate.id;
                                                    const isPrompt = currentTemplate.type === 'prompt' || currentTemplate.id.includes('_prompt');

                                                    return (
                                                        <Card className={`border-2 ${vm.border} transition-all`}>
                                                            <CardHeader className="py-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                                            {expandedStepIdx + 1}
                                                                        </div>
                                                                        <div>
                                                                            <CardTitle className="text-sm">{step.label}</CardTitle>
                                                                            <p className="text-[11px] text-muted-foreground">
                                                                                {hasWarmCold ? 'Branched — sends different copy based on open behavior' : 'Single template — no branching'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setExpandedStepIdx(null); setEditingTemplateId(null); setPreviewMode(false); }}>
                                                                        <X className="w-3.5 h-3.5 mr-1" /> Close
                                                                    </Button>
                                                                </div>

                                                                {/* Variant tabs */}
                                                                {showTabs && (
                                                                    <div className="flex gap-1 mt-3 p-1 bg-muted/40 rounded-lg w-fit">
                                                                        {availableVariants.map(v => {
                                                                            const meta = VARIANT_META[v];
                                                                            const t = variants[v]!;
                                                                            const isActiveV = currentVariantKey === v;
                                                                            return (
                                                                                <button
                                                                                    key={v}
                                                                                    onClick={() => {
                                                                                        openTemplateEditor(t, v);
                                                                                    }}
                                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                                                        isActiveV
                                                                                            ? `bg-background shadow-sm ${meta.color} ring-1 ring-border`
                                                                                            : 'text-muted-foreground hover:text-foreground'
                                                                                    }`}
                                                                                >
                                                                                    {meta.icon}
                                                                                    {meta.label}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </CardHeader>

                                                            <CardContent className="border-t pt-4 space-y-4">
                                                                {/* Toolbar */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant={previewMode ? "default" : "outline"}
                                                                            className="h-7 text-xs"
                                                                            onClick={() => setPreviewMode(!previewMode)}
                                                                        >
                                                                            {previewMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                                                            {previewMode ? "Edit" : "Preview"}
                                                                        </Button>
                                                                        <code className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{currentTemplate.id}</code>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 text-xs"
                                                                            onClick={() => handleTemplateSave(currentTemplate.id)}
                                                                            disabled={saving}
                                                                        >
                                                                            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> :
                                                                                isSaved ? <Check className="w-3 h-3 mr-1" /> :
                                                                                    <Save className="w-3 h-3 mr-1" />}
                                                                            {isSaved ? "Saved!" : "Save"}
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Live Preview Toggle */}
                                                                {previewMode && (
                                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-dashed">
                                                                        <button
                                                                            onClick={() => setUseLivePreview(!useLivePreview)}
                                                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                                                                useLivePreview
                                                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                                                                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                                                                            }`}
                                                                        >
                                                                            <Database className="w-3 h-3" />
                                                                            {useLivePreview ? 'Live Data' : 'Sample Data'}
                                                                        </button>
                                                                        {useLivePreview && (() => {
                                                                            const records = liveRecords[sampleGroup] || [];
                                                                            const idx = selectedRecordIdx[sampleGroup] ?? 0;
                                                                            return records.length > 0 ? (
                                                                                <select
                                                                                    value={idx}
                                                                                    onChange={e => setSelectedRecordIdx(prev => ({ ...prev, [sampleGroup]: Number(e.target.value) }))}
                                                                                    className="flex-1 max-w-xs h-7 rounded-md border bg-background px-2 text-xs"
                                                                                >
                                                                                    {records.map((r: any, i: number) => (
                                                                                        <option key={r._id} value={i}>{r._label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : loadingLiveData ? (
                                                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
                                                                            ) : (
                                                                                <span className="text-[11px] text-muted-foreground">No records found</span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                )}

                                                                {/* Insert Variable Buttons */}
                                                                {!previewMode && (() => {
                                                                    const sampleKeys = Object.keys(SAMPLE_DATA[sampleGroup] || {});
                                                                    return sampleKeys.length > 0 && (
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Insert Variable:</span>
                                                                            {sampleKeys.map(v => (
                                                                                <Button
                                                                                    key={v}
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-6 text-[10px] font-mono px-2 gap-1 hover:bg-primary/10 hover:border-primary/40"
                                                                                    onClick={() => insertVariable(activeEditField, v)}
                                                                                >
                                                                                    <Plus className="w-2.5 h-2.5" />
                                                                                    {v}
                                                                                </Button>
                                                                            ))}
                                                                            <Badge variant="secondary" className="text-[9px] px-1.5 h-5">
                                                                                → {activeEditField === 'subject' ? 'Subject' : 'Body'}
                                                                            </Badge>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Subject */}
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subject Line</label>
                                                                    {previewMode ? (
                                                                        <div className="mt-1 px-3 py-2 bg-muted/30 rounded-md text-sm font-medium">
                                                                            {mergePreview(editSubject, sampleGroup, getLiveMergeData(sampleGroup))}
                                                                        </div>
                                                                    ) : (
                                                                        <Input
                                                                            ref={editSubjectRef}
                                                                            value={editSubject}
                                                                            onChange={e => setEditSubject(e.target.value)}
                                                                            onFocus={() => setActiveEditField('subject')}
                                                                            className="mt-1 text-sm font-medium"
                                                                            placeholder="Email subject line..."
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Body */}
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                                                        {isPrompt ? "AI Prompt" : "Email Body"}
                                                                    </label>
                                                                    {previewMode ? (
                                                                        <div className="mt-1 border rounded-md bg-white dark:bg-background">
                                                                            <div className="px-4 py-3 bg-muted/20 border-b text-[10px] text-muted-foreground space-y-0.5">
                                                                                <div>From: <span className="text-foreground font-medium">XIRI Facility Solutions &lt;chris@xiri.ai&gt;</span></div>
                                                                                {(() => {
                                                                                    const md = getLiveMergeData(sampleGroup) || SAMPLE_DATA[sampleGroup] || {};
                                                                                    const toName = md.contactName || 'Contact';
                                                                                    const toEmail = md.contactEmail || '';
                                                                                    return (
                                                                                        <div>To: <span className="text-foreground font-medium">
                                                                                            {toEmail ? `${toName} <${toEmail}>` : toName}
                                                                                        </span></div>
                                                                                    );
                                                                                })()}
                                                                                <div>Subject: <span className="text-foreground font-semibold text-xs">{mergePreview(editSubject, sampleGroup, getLiveMergeData(sampleGroup))}</span></div>
                                                                            </div>
                                                                            <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-auto">
                                                                                {mergePreview(editBody, sampleGroup, getLiveMergeData(sampleGroup))}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <Textarea
                                                                            ref={editBodyRef}
                                                                            value={editBody}
                                                                            onChange={e => setEditBody(e.target.value)}
                                                                            onFocus={() => setActiveEditField('body')}
                                                                            className="mt-1 text-sm min-h-[300px] font-mono leading-relaxed"
                                                                            placeholder={isPrompt ? "AI prompt instructions..." : "Email body..."}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })()}

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 pt-2 border-t">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(seq)}>
                                                        <Edit3 className="w-3 h-3" /> Edit Sequence
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

            {/* ─── Create / Edit Sequence Dialog ─── */}
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
                                                {allTemplates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        <span className="text-xs">{t.name || t.id}</span>
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
                                        No steps yet. Click &quot;Add Step&quot; to start building your sequence.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={savingSeq}>Cancel</AlertDialogCancel>
                        <Button onClick={handleSaveSequence} disabled={savingSeq || !editorName.trim() || editorSteps.length === 0} className="gap-2">
                            {savingSeq ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            {savingSeq ? 'Saving...' : editingSequence ? 'Update Sequence' : 'Create Sequence'}
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
                        <Button variant="destructive" onClick={handleDeleteSequence} disabled={deleting} className="gap-2">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── AI Generation Dialog ─── */}
            <AlertDialog open={showAI} onOpenChange={(open: boolean) => { if (!open && !aiGenerating && !aiSaving) { setShowAI(false); } }}>
                <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            Generate Sequence with AI
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Describe the target audience and XIRI will generate a complete email sequence with templates.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Prompt */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Describe your target segment</label>
                            <Textarea
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="e.g. Religious centers and houses of worship in the New York metro area that need regular janitorial cleaning services. Focus on churches, mosques, and synagogues."
                                className="mt-1 min-h-[100px] text-sm"
                                disabled={aiGenerating}
                            />
                        </div>

                        {/* Settings row */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Category</label>
                                <Select value={aiCategory} onValueChange={setAiCategory} disabled={aiGenerating}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lead">Lead</SelectItem>
                                        <SelectItem value="vendor">Vendor</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Tone</label>
                                <Select value={aiTone} onValueChange={setAiTone} disabled={aiGenerating}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="friendly">Friendly</SelectItem>
                                        <SelectItem value="direct">Direct</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Number of Steps</label>
                                <Select value={String(aiNumSteps)} onValueChange={(v: string) => setAiNumSteps(Number(v))} disabled={aiGenerating}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="3">3 steps</SelectItem>
                                        <SelectItem value="4">4 steps</SelectItem>
                                        <SelectItem value="5">5 steps</SelectItem>
                                        <SelectItem value="6">6 steps</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Generate button */}
                        {!aiResult && (
                            <Button
                                onClick={handleAIGenerate}
                                disabled={aiGenerating || !aiPrompt.trim()}
                                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                            >
                                {aiGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating with Gemini Pro...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4" />
                                        Generate Sequence
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Error */}
                        {aiError && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                                {aiError}
                            </div>
                        )}

                        {/* Results preview */}
                        {aiResult && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-sm">{aiResult.name}</h3>
                                        <p className="text-xs text-muted-foreground">{aiResult.description}</p>
                                    </div>
                                    <Badge variant="outline" className="text-purple-700 dark:text-purple-300 border-purple-200">
                                        <Sparkles className="w-3 h-3 mr-1" /> AI Generated
                                    </Badge>
                                </div>

                                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                                    {aiResult.steps.map((step, idx) => (
                                        <Card key={idx} className="border-l-4 border-l-purple-300 dark:border-l-purple-700">
                                            <CardContent className="py-3 px-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                                            {idx + 1}
                                                        </div>
                                                        <span className="text-xs font-medium">{step.label}</span>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px] h-5">
                                                        <Clock className="w-3 h-3 mr-1" /> Day {step.dayOffset}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs">
                                                    <span className="text-muted-foreground">Subject: </span>
                                                    <span className="font-medium">{step.subject}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t pt-2 max-h-32 overflow-y-auto">
                                                    {step.body}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-2 border-t">
                                    <Button variant="outline" onClick={() => { setAiResult(null); setAiError(null); }} disabled={aiSaving} className="gap-2 flex-1">
                                        <Wand2 className="w-4 h-4" />
                                        Regenerate
                                    </Button>
                                    <Button onClick={handleAISave} disabled={aiSaving} className="gap-2 flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                                        {aiSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Saving templates & sequence...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                Save Sequence ({aiResult.steps.length} templates)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {!aiResult && (
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={aiGenerating}>Cancel</AlertDialogCancel>
                        </AlertDialogFooter>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
