"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface Template {
    id: string;
    type: string;
    name: string;
    category: string;
    subject?: string;
    content: string;
    variables: string[];
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Template>>({});

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const snap = await getDocs(collection(db, "templates"));
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Template))
                .filter(t => t.type === 'email');
            setTemplates(data);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExpand = (templateId: string) => {
        if (expandedTemplate === templateId) {
            setExpandedTemplate(null);
            setEditForm({});
        } else {
            const template = templates.find(t => t.id === templateId);
            if (template) {
                setExpandedTemplate(templateId);
                setEditForm(template);
            }
        }
    };

    const handleSave = async () => {
        if (!expandedTemplate || !editForm) return;
        try {
            await updateDoc(doc(db, "templates", expandedTemplate), {
                subject: editForm.subject,
                content: editForm.content,
                updatedAt: new Date()
            });
            await fetchTemplates();
            setExpandedTemplate(null);
            setEditForm({});
        } catch (error) {
            console.error("Error saving template:", error);
        }
    };

    const handleCancel = () => {
        setExpandedTemplate(null);
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
                    <h2 className="text-2xl font-bold mb-2">Email Templates</h2>
                    <p className="text-muted-foreground">Manage automated email templates sent to vendors</p>
                </div>

                <div className="grid gap-4">
                    {templates.map((template) => {
                        const isExpanded = expandedTemplate === template.id;

                        return (
                            <Card key={template.id} className={isExpanded ? "border-primary" : ""}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="flex items-center gap-2">
                                                <Mail className="w-5 h-5" />
                                                {template.name}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Category: {template.category}
                                            </CardDescription>
                                            {!isExpanded && template.subject && (
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    Subject: <strong>{template.subject}</strong>
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={() => handleExpand(template.id)}
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
                                                    Edit
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="space-y-4 border-t pt-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Subject</label>
                                            <Input
                                                value={editForm.subject || ""}
                                                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Content</label>
                                            <Textarea
                                                value={editForm.content || ""}
                                                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                rows={10}
                                                className="font-mono text-sm"
                                            />
                                        </div>
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
