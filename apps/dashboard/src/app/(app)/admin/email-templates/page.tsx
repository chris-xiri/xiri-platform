"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Loader2, Save, Mail, Eye, EyeOff, ChevronDown, ChevronUp,
    Check, Plus, Trash2, Search, Rocket,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SequenceBuilder from "@/components/email/SequenceBuilder";

interface EmailTemplate {
    id: string;
    name: string;
    description?: string;
    sequence?: number;
    subject: string;
    body: string;
    category?: string;
    type?: string;
    variables?: string[];
    updatedAt?: any;
    createdAt?: any;
}

function extractMergeFields(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
}

// ─── Main Page ────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
    const [allTemplates, setAllTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'sequences' | 'templates'>('sequences');

    // Templates tab state
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    const editSubjectRef = useRef<HTMLInputElement>(null);
    const editBodyRef = useRef<HTMLTextAreaElement>(null);
    const [activeEditField, setActiveEditField] = useState<'subject' | 'body'>('body');

    // Create new template state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newSubject, setNewSubject] = useState("");
    const [newBody, setNewBody] = useState("");
    const [creating, setCreating] = useState(false);

    const newSubjectRef = useRef<HTMLInputElement>(null);
    const newBodyRef = useRef<HTMLTextAreaElement>(null);
    const [activeNewField, setActiveNewField] = useState<'subject' | 'body'>('body');

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

    // ─── Template handlers ────────────────────────────────────────
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
            const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            const docRef = doc(db, "templates", slug);
            await setDoc(docRef, {
                name: newName.trim(),
                description: newDescription.trim(),
                subject: newSubject.trim(),
                body: newBody.trim(),
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

    // ─── Category detection ──────────────────────────────────────
    const getCategoryKey = (t: EmailTemplate): string => {
        if (t.type === 'prompt' || t.id.includes('_prompt')) return 'prompt';
        if (t.id.startsWith('vendor_outreach_') || t.id.startsWith('contractor_')) return 'vendor';
        if (t.id.startsWith('enterprise_lead_')) return 'enterprise';
        if (t.id.startsWith('tenant_lead_') || t.id.startsWith('sales_')) return 'lead';
        if (t.id.startsWith('referral_')) return 'referral';
        if (t.category === 'lead_targeted') return 'targeted';
        if (t.id.includes('_warm')) return 'warm';
        if (t.id.includes('_cold')) return 'cold';
        return 'custom';
    };

    // Compute counts per category
    const categoryCounts = allTemplates.reduce<Record<string, number>>((acc, t) => {
        const key = getCategoryKey(t);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const FILTER_BADGES: { key: string; label: string; icon?: string; className: string }[] = [
        { key: 'all', label: 'All', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
        { key: 'lead', label: 'Lead', icon: '🎯', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
        { key: 'enterprise', label: 'Enterprise', icon: '🏢', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
        { key: 'vendor', label: 'Vendor', icon: '🔧', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
        { key: 'referral', label: 'Referral', icon: '🤝', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
        { key: 'targeted', label: 'Targeted', icon: '📌', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
        { key: 'warm', label: 'Warm (Opened)', icon: '🔥', className: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' },
        { key: 'cold', label: 'Cold (Not Opened)', icon: '❄️', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
        { key: 'prompt', label: 'AI Prompt', icon: '✨', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
        { key: 'custom', label: 'Custom', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    ];

    // Only show badges that have templates (plus 'all' always)
    const visibleBadges = FILTER_BADGES.filter(b => b.key === 'all' || (categoryCounts[b.key] || 0) > 0);

    // ─── Filtering ────────────────────────────────────────────────
    const filteredTemplates = allTemplates
        .filter(t => {
            // Category filter
            if (categoryFilter !== 'all' && getCategoryKey(t) !== categoryFilter) return false;
            // Text search
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                t.id.toLowerCase().includes(q) ||
                (t.name || '').toLowerCase().includes(q) ||
                (t.subject || '').toLowerCase().includes(q) ||
                (t.description || '').toLowerCase().includes(q) ||
                (t.category || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

    // Derive a simple category badge from template ID / category field
    const getTemplateBadge = (t: EmailTemplate): { label: string; className: string } => {
        if (t.id.startsWith('vendor_outreach_') || t.id.startsWith('contractor_')) return { label: 'Vendor', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
        if (t.id.startsWith('tenant_lead_') || t.id.startsWith('sales_')) return { label: 'Lead', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
        if (t.id.startsWith('enterprise_lead_')) return { label: 'Enterprise', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
        if (t.id.startsWith('referral_')) return { label: 'Referral', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
        if (t.category === 'lead_targeted') return { label: 'Targeted', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' };
        if (t.id.includes('_warm')) return { label: 'Warm', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
        if (t.id.includes('_cold')) return { label: 'Cold', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };
        return { label: 'Custom', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    };

    const getVariantBadge = (t: EmailTemplate): { label: string; className: string } | null => {
        if (t.id.includes('_warm')) return { label: '🔥 Opened', className: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' };
        if (t.id.includes('_cold')) return { label: '❄️ Not Opened', className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' };
        return null;
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
                            Manage sequences, templates, and outreach campaigns.
                        </p>
                    </div>
                </div>

                {/* ─── Tab Switcher ─── */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
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
                        <Badge variant="outline" className="text-[10px] ml-0.5">{allTemplates.length}</Badge>
                    </button>
                </div>

                {activeTab === 'sequences' ? (
                    <SequenceBuilder />
                ) : (
                    <>
                        {/* ─── Templates Tab: Flat Searchable List ─── */}
                        <div className="space-y-4">
                            {/* Toolbar */}
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search templates by name, subject, ID…"
                                        className="pl-9 h-9 text-sm"
                                    />
                                </div>
                                <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1.5 h-9">
                                    <Plus className="w-4 h-4" />
                                    New Template
                                </Button>
                            </div>

                            {/* Category Badge Filters */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {visibleBadges.map(badge => {
                                    const isActive = categoryFilter === badge.key;
                                    const count = badge.key === 'all' ? allTemplates.length : (categoryCounts[badge.key] || 0);
                                    return (
                                        <button
                                            key={badge.key}
                                            onClick={() => setCategoryFilter(badge.key)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                                isActive
                                                    ? `${badge.className} ring-2 ring-primary/40 shadow-sm`
                                                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                                            }`}
                                        >
                                            {badge.icon && <span className="text-[11px]">{badge.icon}</span>}
                                            {badge.label}
                                            <span className={`text-[10px] ml-0.5 ${isActive ? 'opacity-80' : 'opacity-50'}`}>({count})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Template List */}
                            {filteredTemplates.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <h3 className="font-medium text-sm">
                                            {searchQuery ? 'No templates match your search' : 'No Email Templates Found'}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {searchQuery
                                                ? 'Try a different search term or clear the filter.'
                                                : 'Create your first template to get started.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-2">
                                    {filteredTemplates.map(template => {
                                        const isExpanded = expandedId === template.id;
                                        const isSaved = saveSuccess === template.id;
                                        const isPrompt = template.type === 'prompt' || template.id.includes('_prompt');
                                        const catBadge = getTemplateBadge(template);
                                        const variantBadge = getVariantBadge(template);
                                        const mergeFields = extractMergeFields((template.subject || '') + (template.body || ''));

                                        return (
                                            <Card key={template.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}>
                                                <CardHeader
                                                    className="cursor-pointer hover:bg-muted/30 transition-colors py-3"
                                                    onClick={() => handleExpand(template)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/60 text-muted-foreground flex-shrink-0">
                                                                <Mail className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <CardTitle className="text-sm truncate">
                                                                    {template.name || template.id}
                                                                </CardTitle>
                                                                <p className="text-[11px] text-muted-foreground truncate max-w-md">
                                                                    {template.subject || 'No subject'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            <Badge variant="secondary" className={`text-[10px] ${catBadge.className}`}>
                                                                {catBadge.label}
                                                            </Badge>
                                                            {variantBadge && (
                                                                <Badge variant="secondary" className={`text-[10px] ${variantBadge.className}`}>
                                                                    {variantBadge.label}
                                                                </Badge>
                                                            )}
                                                            {isPrompt && (
                                                                <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                                    AI Prompt
                                                                </Badge>
                                                            )}
                                                            {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
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
                                                                <code className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{template.id}</code>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(template); }}
                                                                >
                                                                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                                                                </Button>
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

                                                        {/* Name & Description */}
                                                        {!previewMode && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Template Name</label>
                                                                    <Input
                                                                        value={editName}
                                                                        onChange={e => setEditName(e.target.value)}
                                                                        className="mt-1 text-sm"
                                                                        placeholder="Template name..."
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

                                                        {/* Merge fields (edit mode) */}
                                                        {!previewMode && mergeFields.length > 0 && (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Insert Variable:</span>
                                                                {mergeFields.map(v => (
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
                                                        )}

                                                        {/* Subject */}
                                                        <div>
                                                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subject Line</label>
                                                            {previewMode ? (
                                                                <div className="mt-1 px-3 py-2 bg-muted/30 rounded-md text-sm font-medium">
                                                                    {editSubject}
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
                                                                        <div>Subject: <span className="text-foreground font-semibold text-xs">{editSubject}</span></div>
                                                                    </div>
                                                                    <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-auto">
                                                                        {editBody}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <Textarea
                                                                    ref={editBodyRef}
                                                                    value={editBody}
                                                                    onChange={e => setEditBody(e.target.value)}
                                                                    onFocus={() => setActiveEditField('body')}
                                                                    className="mt-1 text-sm min-h-[250px] font-mono leading-relaxed"
                                                                    placeholder={isPrompt ? "AI prompt instructions..." : "Email body..."}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Template ID */}
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
                            )}
                        </div>

                        {/* ─── Create Template Dialog ─── */}
                        <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <Plus className="w-5 h-5" />
                                        New Template
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Create a standalone email template. Use <code className="bg-muted px-1 rounded text-[11px]">{"{{variableName}}"}</code> for merge fields.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>

                                <div className="space-y-4 py-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground">Template Name</label>
                                            <Input
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                placeholder="e.g. Follow-Up After Meeting"
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
                                        Are you sure you want to delete <strong>{deleteTarget?.name || deleteTarget?.id}</strong>? This action cannot be undone.
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
