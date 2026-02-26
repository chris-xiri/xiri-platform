"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Save, X, ChevronDown, ChevronUp, Check, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Template {
    id: string;
    name: string;
    description?: string;
    category?: string;
    content: string;
    version?: string;
    updatedAt?: any;
}

// Auto-detect variables in prompt content (e.g., {{vendorName}})
function extractVariables(content: string): string[] {
    if (!content) return [];
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

// Category display config
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
    vendor: { label: "Supply (Vendor Outreach)", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    sales: { label: "Demand (Sales Outreach)", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};

export default function AIAgentsPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const snap = await getDocs(collection(db, "templates"));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
            // Sort: vendor first, then sales, then alphabetical
            data.sort((a, b) => {
                const catOrder = (c?: string) => c === 'vendor' ? 0 : c === 'sales' ? 1 : 2;
                return catOrder(a.category) - catOrder(b.category) || a.name.localeCompare(b.name);
            });
            setTemplates(data);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = (template: Template) => {
        if (expandedId === template.id) {
            setExpandedId(null);
            setEditContent("");
        } else {
            setExpandedId(template.id);
            setEditContent(template.content);
        }
    };

    const handleSave = async (templateId: string) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "templates", templateId), {
                content: editContent,
                updatedAt: new Date()
            });
            await fetchTemplates();
            setSaveSuccess(templateId);
            setTimeout(() => setSaveSuccess(null), 2000);
        } catch (error) {
            console.error("Error saving template:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setExpandedId(null);
        setEditContent("");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    // Group templates by category
    const grouped = templates.reduce((acc, t) => {
        const cat = t.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(t);
        return acc;
    }, {} as Record<string, Template[]>);

    return (
        <ProtectedRoute resource="admin/agents">
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold mb-1">AI Agents</h2>
                    <p className="text-muted-foreground">
                        Manage the system prompts that power your AI agents. Changes take effect immediately.
                    </p>
                </div>

                {Object.entries(grouped).map(([category, items]) => {
                    const config = CATEGORY_CONFIG[category] || { label: category, color: "bg-muted text-muted-foreground border-border" };

                    return (
                        <div key={category} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className={config.color}>
                                    {config.label}
                                </Badge>
                                <div className="h-px flex-1 bg-border" />
                            </div>

                            <div className="grid gap-4">
                                {items.map((template) => {
                                    const isExpanded = expandedId === template.id;
                                    const variables = extractVariables(template.content);
                                    const isSaved = saveSuccess === template.id;

                                    return (
                                        <Card key={template.id} className={isExpanded ? "border-primary" : ""}>
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="flex items-center gap-2 text-base">
                                                            <Bot className="w-4 h-4 text-muted-foreground" />
                                                            {template.name}
                                                            {isSaved && (
                                                                <Badge className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                                                                    <Check className="w-3 h-3" /> Saved
                                                                </Badge>
                                                            )}
                                                        </CardTitle>
                                                        {template.description && (
                                                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                                                {template.description}
                                                            </p>
                                                        )}
                                                        <CardDescription className="mt-1 font-mono text-xs">
                                                            {template.id}
                                                            {template.version && <span className="ml-2">v{template.version}</span>}
                                                        </CardDescription>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleExpand(template)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1.5 text-xs"
                                                    >
                                                        {isExpanded ? (
                                                            <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>
                                                        ) : (
                                                            <><ChevronDown className="w-3.5 h-3.5" /> Edit</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </CardHeader>

                                            {isExpanded && (
                                                <CardContent className="space-y-4 border-t pt-4">
                                                    {/* Prompt Editor */}
                                                    <div>
                                                        <label className="text-sm font-medium mb-2 block">System Prompt</label>
                                                        <Textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            rows={18}
                                                            className="font-mono text-sm leading-relaxed"
                                                        />
                                                    </div>

                                                    {/* Variables */}
                                                    {variables.length > 0 && (
                                                        <div>
                                                            <label className="text-sm font-medium mb-2 block text-muted-foreground">
                                                                Detected Variables
                                                            </label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {variables.map((v) => (
                                                                    <Badge key={v} variant="secondary" className="font-mono text-xs">
                                                                        {`{{${v}}}`}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Warning */}
                                                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                        <span>
                                                            Changes are saved directly to production. The next AI generation will use the updated prompt.
                                                        </span>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex gap-2 pt-1">
                                                        <Button
                                                            onClick={() => handleSave(template.id)}
                                                            disabled={saving}
                                                            className="gap-2"
                                                        >
                                                            {saving ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Save className="w-4 h-4" />
                                                            )}
                                                            Save Changes
                                                        </Button>
                                                        <Button onClick={handleCancel} variant="outline" className="gap-2">
                                                            <X className="w-4 h-4" />
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {templates.length === 0 && (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No AI Agents Configured</h3>
                            <p className="text-muted-foreground max-w-md">
                                Run the seed script to populate your AI prompts:
                                <code className="block mt-2 bg-muted p-2 rounded text-sm font-mono">
                                    node scripts/seed-templates-prod.js
                                </code>
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
