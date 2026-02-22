"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Mail, Eye, EyeOff, ChevronDown, ChevronUp, Check, Clock } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface EmailTemplate {
    id: string;
    name: string;
    description?: string;
    sequence: number;
    subject: string;
    body: string;
    updatedAt?: any;
}

// Preview merge fields with sample data
const SAMPLE_VENDOR = {
    vendorName: "Bright Shine Cleaning Co.",
    contactName: "Maria",
    city: "Queens",
    state: "NY",
    services: "Janitorial, Floor Care, Post-Construction",
    specialty: "Janitorial",
    onboardingUrl: "https://xiri.ai/contractor?vid=DEMO123",
};

function mergePreview(text: string): string {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_VENDOR)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    // Also handle the [ONBOARDING_LINK] legacy placeholder
    result = result.replace(/\[ONBOARDING_LINK\]/g, SAMPLE_VENDOR.onboardingUrl);
    return result;
}

function extractMergeFields(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
}

const SEQUENCE_TIMING: Record<number, string> = {
    1: "Initial Contact",
    2: "Day 3 — Follow Up",
    3: "Day 7 — Social Proof",
    4: "Day 14 — Final",
};

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            const q = query(
                collection(db, "templates"),
                where("category", "==", "vendor_email"),
                orderBy("sequence", "asc")
            );
            const snap = await getDocs(q);
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate)));
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
            setPreviewMode(false);
        }
    };

    const handleSave = async (templateId: string) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "templates", templateId), {
                subject: editSubject,
                body: editBody,
                updatedAt: new Date()
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
                <div>
                    <h2 className="text-2xl font-bold">Email Templates</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Vendor outreach email sequence. These templates are sent automatically when a campaign runs.
                        Use <code className="bg-muted px-1 rounded text-[11px]">{'{{vendorName}}'}</code> style merge fields — they get replaced with real vendor data at send time.
                    </p>
                </div>

                {/* Sequence visual */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {templates.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${expandedId === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border'}`}>
                                <span className="font-bold">{t.sequence}</span>
                                <span className="hidden sm:inline">{SEQUENCE_TIMING[t.sequence] || `Step ${t.sequence}`}</span>
                            </div>
                            {i < templates.length - 1 && <span className="text-muted-foreground">→</span>}
                        </div>
                    ))}
                </div>

                {/* Template Cards */}
                <div className="space-y-3">
                    {templates.map(template => {
                        const isExpanded = expandedId === template.id;
                        const mergeFields = extractMergeFields(template.subject + template.body);
                        const isSaved = saveSuccess === template.id;

                        return (
                            <Card key={template.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}>
                                <CardHeader
                                    className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                                    onClick={() => handleExpand(template)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                {template.sequence}
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm">{template.name}</CardTitle>
                                                {template.description && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px]">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {SEQUENCE_TIMING[template.sequence]}
                                            </Badge>
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
                                                <div className="flex gap-1 flex-wrap">
                                                    {mergeFields.map(f => (
                                                        <Badge key={f} variant="secondary" className="text-[9px] px-1 h-5 font-mono">{`{{${f}}}`}</Badge>
                                                    ))}
                                                </div>
                                            </div>
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

                                        {/* Subject */}
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subject Line</label>
                                            {previewMode ? (
                                                <div className="mt-1 px-3 py-2 bg-muted/30 rounded-md text-sm font-medium">
                                                    {mergePreview(editSubject)}
                                                </div>
                                            ) : (
                                                <Input
                                                    value={editSubject}
                                                    onChange={e => setEditSubject(e.target.value)}
                                                    className="mt-1 text-sm font-medium"
                                                    placeholder="Email subject line..."
                                                />
                                            )}
                                        </div>

                                        {/* Body */}
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email Body</label>
                                            {previewMode ? (
                                                <div className="mt-1 border rounded-md bg-white dark:bg-background">
                                                    {/* Render as formatted email preview */}
                                                    <div className="px-4 py-3 bg-muted/20 border-b text-[10px] text-muted-foreground space-y-0.5">
                                                        <div>From: <span className="text-foreground font-medium">Xiri Facility Solutions &lt;onboarding@xiri.ai&gt;</span></div>
                                                        <div>To: <span className="text-foreground font-medium">{SAMPLE_VENDOR.vendorName}</span></div>
                                                        <div>Subject: <span className="text-foreground font-semibold text-xs">{mergePreview(editSubject)}</span></div>
                                                    </div>
                                                    <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-96 overflow-auto">
                                                        {mergePreview(editBody)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <Textarea
                                                    value={editBody}
                                                    onChange={e => setEditBody(e.target.value)}
                                                    className="mt-1 text-sm min-h-[300px] font-mono leading-relaxed"
                                                    placeholder="Email body..."
                                                />
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>

                {templates.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <h3 className="font-medium text-sm">No Email Templates Found</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Run <code className="bg-muted px-1 rounded">node scripts/seed-email-templates.js</code> to seed the default outreach sequence.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
