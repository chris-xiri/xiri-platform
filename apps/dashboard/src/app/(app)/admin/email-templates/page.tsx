"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    Loader2, Save, Mail, Eye, EyeOff, ChevronDown, ChevronUp,
    Check, Clock, HardHat, Building2, Handshake, ArrowRight,
    Plus, Trash2, X, Target, Edit3,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SequenceBuilder from "@/components/email/SequenceBuilder";
import { Rocket } from "lucide-react";

interface EmailTemplate {
    id: string;
    name: string;
    description?: string;
    sequence?: number;
    subject: string;
    body: string;
    category?: string;        // 'lead_sequence' | 'lead_targeted'
    type?: string;            // 'template' | 'prompt'
    variables?: string[];
    updatedAt?: any;
    createdAt?: any;
}

// ─── Merge field sample data per section ──────────────────────────
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
    targeted: {
        businessName: "Morning Star Baptist Church",
        contactName: "Pastor Johnson",
        facilityType: "Religious Institution",
        address: "1600 Hylan Boulevard, Staten Island, 10305",
        squareFootage: "5,000 sq ft",
    },
};

function mergePreview(text: string, sampleGroup: string): string {
    let result = text;
    const sample = SAMPLE_DATA[sampleGroup] || {};
    for (const [key, value] of Object.entries(sample)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    // Legacy placeholder
    result = result.replace(/\[ONBOARDING_LINK\]/g, sample.onboardingUrl || "#");
    return result;
}

function extractMergeFields(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
}

// ─── Section configuration ────────────────────────────────────────
interface SectionConfig {
    key: string;
    title: string;
    icon: React.ReactNode;
    description: string;
    sampleGroup: string;
    filter: (t: EmailTemplate) => boolean;
    timing: Record<number, string>;
    allowCreate?: boolean;
    allowDelete?: boolean;
}

const SECTIONS: SectionConfig[] = [
    {
        key: 'targeted',
        title: 'Targeted Sends',
        icon: <Target className="w-5 h-5" />,
        description: 'One-off email templates sent to individual leads — not part of any drip sequence.',
        sampleGroup: 'targeted',
        filter: (t) => t.category === 'lead_targeted',
        timing: {},
        allowCreate: true,
        allowDelete: true,
    },
    {
        key: 'contractor',
        title: 'Contractors',
        icon: <HardHat className="w-5 h-5" />,
        description: 'Vendor outreach sequence — sent when a campaign targets new subcontractors.',
        sampleGroup: 'contractor',
        filter: (t) => t.id.startsWith('vendor_outreach_') && !t.id.includes('_warm') && !t.id.includes('_cold'),
        timing: { 1: "Initial Contact", 2: "Day 3 — Follow Up", 3: "Day 7 — Social Proof", 4: "Day 14 — Final" },
    },
    {
        key: 'lead',
        title: 'Leads',
        icon: <Building2 className="w-5 h-5" />,
        description: 'Sales lead drip campaign — AI-generated emails for direct and tenant leads.',
        sampleGroup: 'lead',
        filter: (t) => t.id.startsWith('sales_outreach_') || t.id.startsWith('sales_followup_'),
        timing: { 0: "Day 0 — Intro", 1: "Day 3 — Value Prop", 2: "Day 7 — Social Proof", 3: "Day 14 — Final" },
    },
    {
        key: 'referral',
        title: 'Referral Partnerships',
        icon: <Handshake className="w-5 h-5" />,
        description: 'CRE broker referral partnership outreach — static templates with {{variables}}.',
        sampleGroup: 'referral',
        filter: (t) => t.id.startsWith('referral_partnership_'),
        timing: { 1: "Day 0 — Intro", 2: "Day 4 — Follow Up", 3: "Day 10 — Final" },
    },
];

// ─── Main Page ────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
    const [allTemplates, setAllTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'templates' | 'sequences'>('templates');
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    // Refs for inserting variables at cursor
    const editSubjectRef = useRef<HTMLInputElement>(null);
    const editBodyRef = useRef<HTMLTextAreaElement>(null);
    const newSubjectRef = useRef<HTMLInputElement>(null);
    const newBodyRef = useRef<HTMLTextAreaElement>(null);
    const [activeEditField, setActiveEditField] = useState<'subject' | 'body'>('body');
    const [activeNewField, setActiveNewField] = useState<'subject' | 'body'>('body');

    const insertVariable = (
        fieldType: 'subject' | 'body',
        variable: string,
        context: 'edit' | 'new'
    ) => {
        const token = `{{${variable}}}`;
        if (context === 'edit') {
            const ref = fieldType === 'subject' ? editSubjectRef.current : editBodyRef.current;
            const setter = fieldType === 'subject' ? setEditSubject : setEditBody;
            const value = fieldType === 'subject' ? editSubject : editBody;
            if (ref) {
                const start = ref.selectionStart ?? value.length;
                const end = ref.selectionEnd ?? value.length;
                const newValue = value.slice(0, start) + token + value.slice(end);
                setter(newValue);
                // Restore cursor after token
                requestAnimationFrame(() => {
                    ref.focus();
                    ref.setSelectionRange(start + token.length, start + token.length);
                });
            } else {
                setter(value + token);
            }
        } else {
            const ref = fieldType === 'subject' ? newSubjectRef.current : newBodyRef.current;
            const setter = fieldType === 'subject' ? setNewSubject : setNewBody;
            const value = fieldType === 'subject' ? newSubject : newBody;
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
        }
    };

    // Create new template state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newSubject, setNewSubject] = useState("");
    const [newBody, setNewBody] = useState("");
    const [creating, setCreating] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchTemplates = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, "templates"));
            const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate));
            setAllTemplates(results);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleExpand = (template: EmailTemplate) => {
        if (expandedId === template.id) {
            setExpandedId(null);
            setPreviewMode(false);
        } else {
            setExpandedId(template.id);
            setEditSubject(template.subject);
            setEditBody(template.body);
            setEditName(template.name || '');
            setEditDescription(template.description || '');
            setPreviewMode(false);
        }
    };

    const handleSave = async (templateId: string) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "templates", templateId), {
                subject: editSubject,
                body: editBody,
                name: editName,
                description: editDescription,
                updatedAt: serverTimestamp(),
            });
            setSaveSuccess(templateId);
            setTimeout(() => setSaveSuccess(null), 2000);
            await fetchTemplates();
        } catch (error) {
            console.error("Error saving template:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !newSubject.trim()) return;
        setCreating(true);
        try {
            // Generate a slug-style ID
            const slug = 'targeted_' + newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            const docRef = doc(db, "templates", slug);
            const { setDoc } = await import("firebase/firestore");
            await setDoc(docRef, {
                name: newName.trim(),
                description: newDescription.trim(),
                subject: newSubject.trim(),
                body: newBody.trim(),
                category: 'lead_targeted',
                type: 'template',
                variables: extractMergeFields(newSubject + newBody),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            setShowCreateDialog(false);
            setNewName('');
            setNewDescription('');
            setNewSubject('');
            setNewBody('');
            await fetchTemplates();
        } catch (error) {
            console.error("Error creating template:", error);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "templates", deleteTarget.id));
            setDeleteTarget(null);
            if (expandedId === deleteTarget.id) setExpandedId(null);
            await fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute resource="admin/email-templates">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute resource="admin/email-templates">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Email & Outreach</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Manage templates and build multi-step email sequences.
                        </p>
                    </div>
                </div>

                {/* ─── Tab Switcher ─── */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'templates'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Mail className="w-4 h-4" />
                        Templates
                    </button>
                    <button
                        onClick={() => setActiveTab('sequences')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'sequences'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Rocket className="w-4 h-4" />
                        Sequences
                    </button>
                </div>

                {activeTab === 'sequences' ? (
                    <SequenceBuilder />
                ) : (
                <>
                {/* Templates content below */}

                {/* ─── Section Selector (horizontal pipeline-style) ─── */}
                <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                    {SECTIONS.map((section, idx) => {
                        const templates = allTemplates.filter(section.filter);
                        const isActive = activeSection === section.key;

                        return (
                            <div key={section.key} className="flex items-stretch flex-shrink-0">
                                <button
                                    onClick={() => {
                                        setActiveSection(isActive ? null : section.key);
                                        setExpandedId(null);
                                        setPreviewMode(false);
                                    }}
                                    className={`flex flex-col justify-between min-w-[200px] max-w-[260px] p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${isActive
                                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-md'
                                        : 'border-border bg-card hover:border-muted-foreground/30'
                                        }`}
                                >
                                    <div className="mb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            {section.icon}
                                            <span className="text-sm font-semibold">{section.title}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-snug">
                                            {section.description}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-[10px]">
                                            {templates.length} template{templates.length !== 1 ? 's' : ''}
                                        </Badge>
                                        {isActive
                                            ? <ChevronUp className="w-4 h-4 text-sky-500" />
                                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        }
                                    </div>
                                </button>
                                {idx < SECTIONS.length - 1 && (
                                    <div className="flex items-center px-3">
                                        <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ─── Expanded Section ─── */}
                {activeSection && (() => {
                    const section = SECTIONS.find(s => s.key === activeSection)!;
                    const templates = allTemplates
                        .filter(section.filter)
                        .sort((a, b) => {
                            // For targeted: sort alphabetically by name
                            if (section.key === 'targeted') {
                                return (a.name || '').localeCompare(b.name || '');
                            }
                            // For sequences: sort by sequence number extracted from ID
                            const aNum = parseInt(a.id.match(/(\d+)/)?.[1] || '0');
                            const bNum = parseInt(b.id.match(/(\d+)/)?.[1] || '0');
                            return aNum - bNum;
                        });

                    return (
                        <div className="space-y-3">
                            {/* Section header with create button for targeted */}
                            {section.allowCreate && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Target className="w-4 h-4" />
                                        {templates.length} targeted template{templates.length !== 1 ? 's' : ''}
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowCreateDialog(true)}
                                        className="gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        New Template
                                    </Button>
                                </div>
                            )}

                            {/* Sequence visual (for non-targeted sections) */}
                            {!section.allowCreate && templates.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {templates.map((t, i) => {
                                        const stepNum = parseInt(t.id.match(/(\d+)/)?.[1] || '0');
                                        return (
                                            <div key={t.id} className="flex items-center gap-2">
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border cursor-pointer transition-all ${expandedId === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:border-muted-foreground/50'}`}
                                                    onClick={() => handleExpand(t)}
                                                >
                                                    <span className="font-bold">{stepNum || i + 1}</span>
                                                    <span className="hidden sm:inline">
                                                        {section.timing[stepNum] || section.timing[i] || `Step ${stepNum || i + 1}`}
                                                    </span>
                                                </div>
                                                {i < templates.length - 1 && <span className="text-muted-foreground">→</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {templates.length === 0 && (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Mail className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                                        <h3 className="font-medium text-sm">No {section.title} Templates</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {section.allowCreate
                                                ? 'Click "New Template" to create your first targeted email template.'
                                                : section.key === 'contractor'
                                                    ? <>Run <code className="bg-muted px-1 rounded">node scripts/seed-email-templates.js</code></>
                                                    : section.key === 'lead'
                                                        ? <>These are AI prompts stored in Firestore.</>
                                                        : <>Run <code className="bg-muted px-1 rounded">node scripts/seed-referral-templates.js</code></>
                                            }
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Template cards */}
                            {templates.map(template => {
                                const isExpanded = expandedId === template.id;
                                const mergeFields = extractMergeFields(template.subject + template.body);
                                const isSaved = saveSuccess === template.id;
                                const stepNum = parseInt(template.id.match(/(\d+)/)?.[1] || '0');
                                const isPrompt = template.type === 'prompt' || template.id.includes('_prompt');
                                const isTargeted = section.key === 'targeted';

                                return (
                                    <Card key={template.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}>
                                        <CardHeader
                                            className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                                            onClick={() => handleExpand(template)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {isTargeted ? (
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                            <Target className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                            {stepNum || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <CardTitle className="text-sm">{template.name}</CardTitle>
                                                        {template.description && (
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isTargeted && (
                                                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                            Targeted
                                                        </Badge>
                                                    )}
                                                    {isPrompt && !isTargeted && (
                                                        <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                            AI Prompt
                                                        </Badge>
                                                    )}
                                                    {!isPrompt && !isTargeted && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            Template
                                                        </Badge>
                                                    )}
                                                    {!isTargeted && (
                                                        <Badge variant="outline" className="text-[10px]">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {section.timing[stepNum] || `Step ${stepNum}`}
                                                        </Badge>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </CardHeader>

                                        {isExpanded && (
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
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {section.allowDelete && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-xs text-destructive hover:text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteTarget(template);
                                                                }}
                                                            >
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                                Delete
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleSave(template.id)}
                                                            disabled={saving}
                                                        >
                                                            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> :
                                                                isSaved ? <Check className="w-3 h-3 mr-1" /> :
                                                                    <Save className="w-3 h-3 mr-1" />}
                                                            {isSaved ? "Saved!" : "Save"}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Name & Description (editable for targeted) */}
                                                {isTargeted && !previewMode && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Template Name</label>
                                                            <Input
                                                                value={editName}
                                                                onChange={e => setEditName(e.target.value)}
                                                                className="mt-1 text-sm"
                                                                placeholder="e.g. Backflow Preventer"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
                                                            <Input
                                                                value={editDescription}
                                                                onChange={e => setEditDescription(e.target.value)}
                                                                className="mt-1 text-sm"
                                                                placeholder="Short description..."
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Insert Variable Buttons */}
                                                {!previewMode && (() => {
                                                    const sampleKeys = Object.keys(SAMPLE_DATA[section.sampleGroup] || {});
                                                    return sampleKeys.length > 0 && (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Insert Variable:</span>
                                                            {sampleKeys.map(v => (
                                                                <Button
                                                                    key={v}
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-6 text-[10px] font-mono px-2 gap-1 hover:bg-primary/10 hover:border-primary/40"
                                                                    onClick={() => insertVariable(activeEditField, v, 'edit')}
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
                                                            {mergePreview(editSubject, section.sampleGroup)}
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
                                                                <div>To: <span className="text-foreground font-medium">{SAMPLE_DATA[section.sampleGroup]?.contactName || 'Contact'}</span></div>
                                                                <div>Subject: <span className="text-foreground font-semibold text-xs">{mergePreview(editSubject, section.sampleGroup)}</span></div>
                                                            </div>
                                                            <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-auto">
                                                                {mergePreview(editBody, section.sampleGroup)}
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

                                                {/* Template ID for reference */}
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-1 border-t">
                                                    <span>Firestore ID:</span>
                                                    <code className="bg-muted px-1.5 py-0.5 rounded">{template.id}</code>
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    );
                })()}

                {allTemplates.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <h3 className="font-medium text-sm">No Email Templates Found</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Run <code className="bg-muted px-1 rounded">node scripts/seed-email-templates.js</code> and{" "}
                                <code className="bg-muted px-1 rounded">node scripts/seed-referral-templates.js</code> to seed templates.
                            </p>
                        </CardContent>
                    </Card>
                )}

            {/* ─── Create Template Dialog ─── */}
            <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            New Targeted Template
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Create a new email template for one-off targeted sends. Use <code className="bg-muted px-1 rounded text-[11px]">{"{{variableName}}"}</code> for merge fields.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Template Name</label>
                                <Input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Backflow Preventer"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                                <Input
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    placeholder="Short description..."
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Insert Variable Buttons for Create */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Insert Variable:</span>
                            {Object.keys(SAMPLE_DATA['targeted'] || {}).map(v => (
                                <Button
                                    key={v}
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    className="h-6 text-[10px] font-mono px-2 gap-1 hover:bg-primary/10 hover:border-primary/40"
                                    onClick={() => insertVariable(activeNewField, v, 'new')}
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                    {v}
                                </Button>
                            ))}
                            <Badge variant="secondary" className="text-[9px] px-1.5 h-5">
                                → {activeNewField === 'subject' ? 'Subject' : 'Body'}
                            </Badge>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Subject Line</label>
                            <Input
                                ref={newSubjectRef}
                                value={newSubject}
                                onChange={e => setNewSubject(e.target.value)}
                                onFocus={() => setActiveNewField('subject')}
                                placeholder="Email subject..."
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Email Body</label>
                            <Textarea
                                ref={newBodyRef}
                                value={newBody}
                                onChange={e => setNewBody(e.target.value)}
                                onFocus={() => setActiveNewField('body')}
                                placeholder="Email body text..."
                                className="mt-1 min-h-[250px] text-sm font-mono leading-relaxed"
                            />
                        </div>

                        {newBody && (
                            <div className="flex gap-1 flex-wrap text-[10px]">
                                <span className="text-muted-foreground">Detected merge fields:</span>
                                {extractMergeFields(newSubject + newBody).map(f => (
                                    <Badge key={f} variant="secondary" className="text-[9px] px-1 h-5 font-mono">{`{{${f}}}`}</Badge>
                                ))}
                                {extractMergeFields(newSubject + newBody).length === 0 && (
                                    <span className="text-muted-foreground italic">None</span>
                                )}
                            </div>
                        )}
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleCreate}
                            disabled={creating || !newName.trim() || !newSubject.trim()}
                            className="gap-2"
                        >
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {creating ? 'Creating...' : 'Create Template'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Delete Confirmation Dialog ─── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
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
                </>
                )}
            </div>
        </ProtectedRoute>
    );
}
