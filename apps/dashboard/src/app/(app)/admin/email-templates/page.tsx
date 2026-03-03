"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Save, Mail, Eye, EyeOff, ChevronDown, ChevronUp,
    Check, Clock, HardHat, Building2, Handshake, ArrowRight
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface EmailTemplate {
    id: string;
    name: string;
    description?: string;
    sequence?: number;
    subject: string;
    body: string;
    category?: string;
    type?: string;            // 'template' | 'prompt'
    variables?: string[];
    updatedAt?: any;
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
}

const SECTIONS: SectionConfig[] = [
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
    const [editSubject, setEditSubject] = useState("");
    const [editBody, setEditBody] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
                        Manage outreach templates by category. Use{" "}
                        <code className="bg-muted px-1 rounded text-[11px]">{"{{variableName}}"}</code>{" "}
                        merge fields — they get replaced with real data at send time.
                    </p>
                </div>

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

                {/* ─── Expanded Section: Template Sequence ─── */}
                {activeSection && (() => {
                    const section = SECTIONS.find(s => s.key === activeSection)!;
                    const templates = allTemplates
                        .filter(section.filter)
                        .sort((a, b) => {
                            // Sort by sequence number extracted from ID
                            const aNum = parseInt(a.id.match(/(\d+)/)?.[1] || '0');
                            const bNum = parseInt(b.id.match(/(\d+)/)?.[1] || '0');
                            return aNum - bNum;
                        });

                    if (templates.length === 0) {
                        return (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <Mail className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                                    <h3 className="font-medium text-sm">No {section.title} Templates</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {section.key === 'contractor' && <>Run <code className="bg-muted px-1 rounded">node scripts/seed-email-templates.js</code></>}
                                        {section.key === 'lead' && <>These are AI prompts stored in Firestore. Seed with <code className="bg-muted px-1 rounded">sales_outreach_prompt</code></>}
                                        {section.key === 'referral' && <>Run <code className="bg-muted px-1 rounded">node scripts/seed-referral-templates.js</code></>}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {/* Sequence visual */}
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

                            {/* Template cards */}
                            {templates.map(template => {
                                const isExpanded = expandedId === template.id;
                                const mergeFields = extractMergeFields(template.subject + template.body);
                                const isSaved = saveSuccess === template.id;
                                const stepNum = parseInt(template.id.match(/(\d+)/)?.[1] || '0');
                                const isPrompt = template.type === 'prompt' || template.id.includes('_prompt');

                                return (
                                    <Card key={template.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary/30' : ''}`}>
                                        <CardHeader
                                            className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                                            onClick={() => handleExpand(template)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                                        {stepNum || '?'}
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-sm">{template.name}</CardTitle>
                                                        {template.description && (
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isPrompt && (
                                                        <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                            AI Prompt
                                                        </Badge>
                                                    )}
                                                    {!isPrompt && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            Template
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px]">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {section.timing[stepNum] || `Step ${stepNum}`}
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
                                                            {mergePreview(editSubject, section.sampleGroup)}
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
                                                            value={editBody}
                                                            onChange={e => setEditBody(e.target.value)}
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
            </div>
        </ProtectedRoute>
    );
}
