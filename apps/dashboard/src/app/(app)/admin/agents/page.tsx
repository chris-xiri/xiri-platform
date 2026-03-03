"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Bot, Save, X, ChevronDown, ChevronUp, Check,
    AlertTriangle, Cpu, FileText, Globe, Mail, Sparkles, MessageSquare, Settings2
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Prompt {
    id: string;
    name: string;
    description?: string;
    agent?: string;
    model?: string;
    content: string;
    variables?: string[];
    updatedAt?: any;
}

// Auto-detect variables in prompt content
function extractVariables(content: string): string[] {
    if (!content) return [];
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

// Agent display config
const AGENT_CONFIG: Record<string, { label: string; icon: typeof Bot; color: string }> = {
    onboardingChat: {
        label: "Onboarding Chat",
        icon: MessageSquare,
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
    documentVerifier: {
        label: "Document Verifier",
        icon: FileText,
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    websiteScraper: {
        label: "Website Scraper",
        icon: Globe,
        color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    },
    emailUtils: {
        label: "Email Personalization",
        icon: Mail,
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    aiTemplateOptimizer: {
        label: "Template Optimizer",
        icon: Sparkles,
        color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30",
    },
    socialContentGenerator: {
        label: "Social Content Generator",
        icon: Cpu,
        color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    },
    "index (regenCaption)": {
        label: "Caption Regenerator",
        icon: Settings2,
        color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    },
};

const DEFAULT_AGENT = {
    label: "Other",
    icon: Bot,
    color: "bg-muted text-muted-foreground border-border",
};

export default function AIAgentsPage() {
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [editModel, setEditModel] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        try {
            const snap = await getDocs(collection(db, "prompts"));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prompt));
            data.sort((a, b) => (a.agent || '').localeCompare(b.agent || '') || a.name.localeCompare(b.name));
            setPrompts(data);
        } catch (error) {
            console.error("Error fetching prompts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = (prompt: Prompt) => {
        if (expandedId === prompt.id) {
            setExpandedId(null);
            setEditContent("");
            setEditModel("");
        } else {
            setExpandedId(prompt.id);
            setEditContent(prompt.content);
            setEditModel(prompt.model || "gemini-2.0-flash");
        }
    };

    const handleSave = async (promptId: string) => {
        setSaving(true);
        try {
            const variables = extractVariables(editContent);
            await updateDoc(doc(db, "prompts", promptId), {
                content: editContent,
                model: editModel,
                variables,
                updatedAt: new Date()
            });
            await fetchPrompts();
            setSaveSuccess(promptId);
            setTimeout(() => setSaveSuccess(null), 2000);
        } catch (error) {
            console.error("Error saving prompt:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setExpandedId(null);
        setEditContent("");
        setEditModel("");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    // Group prompts by agent
    const grouped = prompts.reduce((acc, p) => {
        const agent = p.agent || 'other';
        if (!acc[agent]) acc[agent] = [];
        acc[agent].push(p);
        return acc;
    }, {} as Record<string, Prompt[]>);

    return (
        <ProtectedRoute resource="admin/agents">
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold mb-1">AI Agents</h2>
                    <p className="text-muted-foreground">
                        Manage the system prompts that power your AI agents. Changes take effect on the next function invocation.
                    </p>
                    <div className="flex gap-3 mt-3">
                        <Badge variant="outline" className="gap-1.5 text-xs">
                            <Bot className="w-3 h-3" />
                            {prompts.length} prompts
                        </Badge>
                        <Badge variant="outline" className="gap-1.5 text-xs">
                            <Cpu className="w-3 h-3" />
                            {Object.keys(grouped).length} agents
                        </Badge>
                    </div>
                </div>

                {Object.entries(grouped).map(([agent, items]) => {
                    const config = AGENT_CONFIG[agent] || DEFAULT_AGENT;
                    const AgentIcon = config.icon;

                    return (
                        <div key={agent} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className={`gap-1.5 ${config.color}`}>
                                    <AgentIcon className="w-3.5 h-3.5" />
                                    {config.label}
                                </Badge>
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-xs text-muted-foreground">
                                    {items.length} prompt{items.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="grid gap-4">
                                {items.map((prompt) => {
                                    const isExpanded = expandedId === prompt.id;
                                    const variables = extractVariables(isExpanded ? editContent : prompt.content);
                                    const isSaved = saveSuccess === prompt.id;

                                    return (
                                        <Card key={prompt.id} className={isExpanded ? "border-primary" : ""}>
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="flex items-center gap-2 text-base">
                                                            <Bot className="w-4 h-4 text-muted-foreground" />
                                                            {prompt.name}
                                                            {prompt.model && (
                                                                <Badge variant="secondary" className="text-[10px] font-mono">
                                                                    {prompt.model}
                                                                </Badge>
                                                            )}
                                                            {isSaved && (
                                                                <Badge className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                                                                    <Check className="w-3 h-3" /> Saved
                                                                </Badge>
                                                            )}
                                                        </CardTitle>
                                                        {prompt.description && (
                                                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                                                {prompt.description}
                                                            </p>
                                                        )}
                                                        <CardDescription className="mt-1 font-mono text-xs">
                                                            {prompt.id}
                                                        </CardDescription>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleExpand(prompt)}
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
                                                    {/* Model Selector */}
                                                    <div>
                                                        <label className="text-sm font-medium mb-2 block">Model</label>
                                                        <Input
                                                            value={editModel}
                                                            onChange={(e) => setEditModel(e.target.value)}
                                                            placeholder="gemini-2.0-flash"
                                                            className="font-mono text-sm max-w-xs"
                                                        />
                                                    </div>

                                                    {/* Prompt Editor */}
                                                    <div>
                                                        <label className="text-sm font-medium mb-2 block">Prompt Content</label>
                                                        <Textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            rows={Math.min(Math.max(editContent.split('\n').length + 2, 10), 30)}
                                                            className="font-mono text-sm leading-relaxed"
                                                        />
                                                    </div>

                                                    {/* Variables */}
                                                    {variables.length > 0 && (
                                                        <div>
                                                            <label className="text-sm font-medium mb-2 block text-muted-foreground">
                                                                Detected Variables ({variables.length})
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
                                                            Changes are saved directly to production. The next AI call will use the updated prompt.
                                                        </span>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex gap-2 pt-1">
                                                        <Button
                                                            onClick={() => handleSave(prompt.id)}
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

                {prompts.length === 0 && (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No AI Prompts Found</h3>
                            <p className="text-muted-foreground max-w-md">
                                Run the seed script to populate your AI prompts:
                                <code className="block mt-2 bg-muted p-2 rounded text-sm font-mono">
                                    node scripts/seed-ai-prompts.js
                                </code>
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedRoute>
    );
}
