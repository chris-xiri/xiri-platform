"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Save, X } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Prompt {
    id: string;
    type: string;
    name: string;
    category: string;
    content: string;
    variables: string[];
}

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Prompt>>({});

    useEffect(() => {
        fetchPrompts();
    }, []);

    const fetchPrompts = async () => {
        try {
            const snap = await getDocs(collection(db, "templates"));
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Prompt))
                .filter(t => t.type === 'prompt');
            setPrompts(data);
        } catch (error) {
            console.error("Error fetching prompts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (prompt: Prompt) => {
        setEditing(prompt.id);
        setEditForm(prompt);
    };

    const handleSave = async () => {
        if (!editing || !editForm) return;
        try {
            await updateDoc(doc(db, "templates", editing), {
                content: editForm.content,
                updatedAt: new Date()
            });
            await fetchPrompts();
            setEditing(null);
            setEditForm({});
        } catch (error) {
            console.error("Error saving prompt:", error);
        }
    };

    const handleCancel = () => {
        setEditing(null);
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
        <ProtectedRoute resource="admin/templates">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Agent Prompts</h2>
                    <p className="text-muted-foreground">Manage system prompts for AI agents</p>
                </div>

                <div className="space-y-4">
                    {prompts.map((prompt) => (
                        <Card key={prompt.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Bot className="w-5 h-5" />
                                            {prompt.name}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Category: {prompt.category}
                                        </CardDescription>
                                    </div>
                                    {editing !== prompt.id && (
                                        <Button onClick={() => handleEdit(prompt)} variant="outline" size="sm">
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {editing === prompt.id ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">System Prompt</label>
                                            <Textarea
                                                value={editForm.content || ""}
                                                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                rows={15}
                                                className="font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Available Variables</label>
                                            <div className="flex flex-wrap gap-2">
                                                {prompt.variables.map((v) => (
                                                    <Badge key={v} variant="secondary" className="font-mono">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleSave} className="gap-2">
                                                <Save className="w-4 h-4" />
                                                Save Changes
                                            </Button>
                                            <Button onClick={handleCancel} variant="outline" className="gap-2">
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">Prompt:</p>
                                            <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap font-mono">
                                                {prompt.content}
                                            </pre>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Variables:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {prompt.variables.map((v) => (
                                                    <Badge key={v} variant="secondary" className="font-mono">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </ProtectedRoute>
    );
}
