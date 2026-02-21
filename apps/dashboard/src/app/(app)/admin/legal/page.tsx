"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Loader2, Plus, Pencil, Trash2, X, Save, FileText, Eye, EyeOff,
    ScrollText, Scale, ChevronDown, ChevronUp, Copy, Check
} from "lucide-react";

interface LegalTemplate {
    id: string;
    name: string;
    category: 'contract' | 'msa' | 'addendum' | 'nda' | 'other';
    description: string;
    content: string;
    version: string;
    isActive: boolean;
    updatedAt: unknown;
    createdAt: unknown;
    updatedBy?: string;
}

const CATEGORIES = [
    { value: 'msa', label: 'MSA', icon: Scale },
    { value: 'contract', label: 'Contract', icon: FileText },
    { value: 'addendum', label: 'Addendum', icon: ScrollText },
    { value: 'nda', label: 'NDA', icon: FileText },
    { value: 'other', label: 'Other', icon: FileText },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
    msa: 'bg-blue-100 text-blue-800',
    contract: 'bg-green-100 text-green-800',
    addendum: 'bg-amber-100 text-amber-800',
    nda: 'bg-purple-100 text-purple-800',
    other: 'bg-gray-100 text-gray-800',
};

function LegalTemplateForm({
    initialData,
    onSave,
    onCancel,
    saving,
}: {
    initialData?: Partial<LegalTemplate>;
    onSave: (data: Omit<LegalTemplate, 'id' | 'updatedAt' | 'createdAt'>) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [name, setName] = useState(initialData?.name || "");
    const [category, setCategory] = useState<LegalTemplate['category']>(initialData?.category || 'contract');
    const [description, setDescription] = useState(initialData?.description || "");
    const [content, setContent] = useState(initialData?.content || "");
    const [version, setVersion] = useState(initialData?.version || "1.0");
    const [isActive, setIsActive] = useState(initialData?.isActive !== false);

    return (
        <Card className="border-primary">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {initialData?.id ? "Edit Legal Template" : "New Legal Template"}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">Template Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Independent Contractor Agreement"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Version</label>
                        <Input
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                            placeholder="1.0"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${category === cat.value
                                        ? `${CATEGORY_COLORS[cat.value]} border-current ring-1 ring-current/20`
                                        : "bg-muted text-muted-foreground border-transparent hover:border-border"
                                        }`}
                                >
                                    <cat.icon className="w-3 h-3" />
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end">
                        <Button
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => setIsActive(!isActive)}
                            className="gap-2"
                        >
                            {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {isActive ? "Active" : "Inactive"}
                        </Button>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of when this template is used"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium mb-1.5 block">
                        Contract Body
                        <span className="text-xs text-muted-foreground ml-2">
                            Use {"{{variableName}}"} for dynamic fields (e.g. {"{{vendorName}}"}, {"{{effectiveDate}}"})
                        </span>
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter the full contract text here..."
                        className="w-full h-96 p-4 text-sm font-mono border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        onClick={() => onSave({ name, category, description, content, version, isActive })}
                        disabled={!name || !content || saving}
                        className="gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {initialData?.id ? "Update Template" : "Create Template"}
                    </Button>
                    <Button onClick={onCancel} variant="outline" className="gap-2">
                        <X className="w-4 h-4" /> Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function LegalTemplatesPage() {
    const [templates, setTemplates] = useState<LegalTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<LegalTemplate | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, "legal_templates"));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LegalTemplate));
            data.sort((a, b) => {
                const catOrder = ['msa', 'contract', 'addendum', 'nda', 'other'];
                return catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
            });
            setTemplates(data);
        } catch (error) {
            console.error("Error fetching legal templates:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleSave = async (data: Omit<LegalTemplate, 'id' | 'updatedAt' | 'createdAt'>) => {
        setSaving(true);
        try {
            if (editingTemplate) {
                await updateDoc(doc(db, "legal_templates", editingTemplate.id), {
                    ...data,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const newId = `${data.category}_${Date.now()}`;
                await setDoc(doc(db, "legal_templates", newId), {
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
            await fetchTemplates();
            setShowForm(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error("Error saving template:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this legal template? This cannot be undone.")) return;
        setDeletingId(id);
        try {
            await deleteDoc(doc(db, "legal_templates", id));
            await fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleEdit = (template: LegalTemplate) => {
        setEditingTemplate(template);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTemplate(null);
    };

    const handleCopy = async (content: string, id: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <ProtectedRoute resource="admin/legal">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Legal Templates</h2>
                        <p className="text-muted-foreground">
                            {templates.length} template{templates.length !== 1 ? 's' : ''} — Standard contracts and agreements for vendors
                        </p>
                    </div>
                    {!showForm && (
                        <Button onClick={() => setShowForm(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> New Template
                        </Button>
                    )}
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <LegalTemplateForm
                        initialData={editingTemplate || undefined}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        saving={saving}
                    />
                )}

                {/* Template List */}
                <div className="space-y-3">
                    {templates.map(template => {
                        const isExpanded = expandedId === template.id;
                        const lines = template.content?.split('\n').length || 0;
                        const words = template.content?.split(/\s+/).length || 0;

                        return (
                            <Card key={template.id} className={!template.isActive ? 'opacity-60' : ''}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="mt-0.5">
                                                <FileText className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm">{template.name}</h3>
                                                    <Badge variant="secondary" className={`text-[10px] ${CATEGORY_COLORS[template.category]}`}>
                                                        {template.category.toUpperCase()}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">v{template.version}</span>
                                                    {!template.isActive && (
                                                        <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                                                <p className="text-[10px] text-muted-foreground">{lines} lines · {words} words</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setExpandedId(isExpanded ? null : template.id)}
                                                className="h-7 w-7"
                                                title={isExpanded ? "Collapse" : "View content"}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleCopy(template.content, template.id)}
                                                className="h-7 w-7"
                                                title="Copy content"
                                            >
                                                {copiedId === template.id
                                                    ? <Check className="w-3.5 h-3.5 text-green-600" />
                                                    : <Copy className="w-3.5 h-3.5" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(template)}
                                                className="h-7 w-7"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(template.id)}
                                                disabled={deletingId === template.id}
                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                title="Delete"
                                            >
                                                {deletingId === template.id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Trash2 className="w-3.5 h-3.5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded Content Preview */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t">
                                            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                                                {template.content}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {templates.length === 0 && !showForm && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Scale className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No legal templates yet</p>
                            <p className="text-sm mb-4">Add your standard contractor agreements, MSAs, and NDAs.</p>
                            <Button onClick={() => setShowForm(true)} className="gap-2">
                                <Plus className="w-4 h-4" /> Create First Template
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
