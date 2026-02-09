"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bot, Save, X, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface AgentConfig {
    id: string;
    name: string;
    description: string;
    promptTemplateId: string;
    model: string;
    apiKey?: string;
    enabled: boolean;
}

interface Template {
    id: string;
    content: string;
    variables: string[];
}

const AVAILABLE_MODELS = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", provider: "Anthropic" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", provider: "Anthropic" }
];

export default function AgentsPage() {
    const [agents, setAgents] = useState<AgentConfig[]>([]);
    const [templates, setTemplates] = useState<Record<string, Template>>({});
    const [loading, setLoading] = useState(true);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<AgentConfig & { promptContent: string }>>({});
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch agents
            const agentsSnap = await getDocs(collection(db, "agent_configs"));
            const agentsData = agentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AgentConfig));
            setAgents(agentsData);

            // Fetch templates
            const templatesSnap = await getDocs(collection(db, "templates"));
            const templatesData: Record<string, Template> = {};
            templatesSnap.docs.forEach(d => {
                templatesData[d.id] = { id: d.id, ...d.data() } as Template;
            });
            setTemplates(templatesData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = (agentId: string) => {
        if (expandedAgent === agentId) {
            setExpandedAgent(null);
            setEditForm({});
        } else {
            const agent = agents.find(a => a.id === agentId);
            if (agent) {
                const template = templates[agent.promptTemplateId];
                setExpandedAgent(agentId);
                setEditForm({
                    ...agent,
                    promptContent: template?.content || ""
                });
            }
        }
    };

    const handleSave = async () => {
        if (!expandedAgent || !editForm) return;
        try {
            // Update agent config
            await updateDoc(doc(db, "agent_configs", expandedAgent), {
                model: editForm.model,
                apiKey: editForm.apiKey || null,
                enabled: editForm.enabled,
                updatedAt: new Date()
            });

            // Update prompt template
            if (editForm.promptContent && editForm.promptTemplateId) {
                await updateDoc(doc(db, "templates", editForm.promptTemplateId), {
                    content: editForm.promptContent,
                    updatedAt: new Date()
                });
            }

            await fetchData();
            setExpandedAgent(null);
            setEditForm({});
        } catch (error) {
            console.error("Error saving agent:", error);
        }
    };

    const handleCancel = () => {
        setExpandedAgent(null);
        setEditForm({});
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <ProtectedRoute resource="admin/agents">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Agent Manager</h2>
                    <p className="text-muted-foreground">Configure AI agents, models, and system prompts</p>
                </div>

                <div className="grid gap-4">
                    {agents.map((agent) => {
                        const isExpanded = expandedAgent === agent.id;
                        const template = templates[agent.promptTemplateId];

                        return (
                            <Card key={agent.id} className={isExpanded ? "border-primary" : ""}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="flex items-center gap-2">
                                                <Bot className="w-5 h-5" />
                                                {agent.name}
                                                <Badge variant={agent.enabled ? "default" : "secondary"}>
                                                    {agent.enabled ? "Enabled" : "Disabled"}
                                                </Badge>
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                {agent.description}
                                            </CardDescription>
                                            {!isExpanded && (
                                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                    <span>Model: <strong>{AVAILABLE_MODELS.find(m => m.id === agent.model)?.name || agent.model}</strong></span>
                                                    {agent.apiKey && <Badge variant="outline" className="text-xs">Custom API Key</Badge>}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={() => handleExpand(agent.id)}
                                            variant="ghost"
                                            size="sm"
                                            className="gap-2"
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <ChevronUp className="w-4 h-4" />
                                                    Collapse
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-4 h-4" />
                                                    Configure
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="space-y-4 border-t pt-4">
                                        {/* Model Selection */}
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">LLM Model</label>
                                            <Select
                                                value={editForm.model}
                                                onValueChange={(value) => setEditForm({ ...editForm, model: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {AVAILABLE_MODELS.map((model) => (
                                                        <SelectItem key={model.id} value={model.id}>
                                                            {model.name} <span className="text-muted-foreground">({model.provider})</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* API Key */}
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">
                                                API Key <span className="text-muted-foreground font-normal">(Optional override)</span>
                                            </label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type={showApiKey ? "text" : "password"}
                                                    value={editForm.apiKey || ""}
                                                    onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                                                    placeholder="Leave empty to use default"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                >
                                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* System Prompt */}
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">System Prompt</label>
                                            <Textarea
                                                value={editForm.promptContent || ""}
                                                onChange={(e) => setEditForm({ ...editForm, promptContent: e.target.value })}
                                                rows={12}
                                                className="font-mono text-sm"
                                            />
                                        </div>

                                        {/* Variables */}
                                        {template?.variables && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">Available Variables</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.variables.map((v) => (
                                                        <Badge key={v} variant="secondary" className="font-mono">
                                                            {`{{${v}}}`}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-2">
                                            <Button onClick={handleSave} className="gap-2">
                                                <Save className="w-4 h-4" />
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
        </ProtectedRoute>
    );
}
