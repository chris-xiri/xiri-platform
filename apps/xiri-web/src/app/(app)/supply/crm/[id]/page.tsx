"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { addDoc, doc, onSnapshot, collection, query, where, orderBy, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Phone, Mail, Globe, MapPin, Building2, Calendar, MessageSquare, CheckCircle2, Clock, Send, User, Bot, AlertTriangle, Pencil } from "lucide-react";
import Link from "next/link";
import { Vendor, OutreachEvent } from "@/types/vendor";
import { Textarea } from "@/components/ui/textarea";


// Helper for relative time (e.g. "2 hours ago")
function timeAgo(date: any) {
    if (!date) return "";
    let jsDate: Date;
    if (typeof date.toDate === 'function') {
        jsDate = date.toDate();
    } else if (date instanceof Date) {
        jsDate = date;
    } else if (typeof date === 'number') {
        jsDate = new Date(date);
    } else {
        jsDate = new Date(date);
    }

    if (isNaN(jsDate.getTime())) return "Just now";

    const seconds = Math.floor((new Date().getTime() - jsDate.getTime()) / 1000);
    // Simple logic
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
}

function formatPhoneNumber(value: string) {
    if (!value) return "";
    const cleaned = ('' + value).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return value;
}

function EditableField({ value, icon: Icon, onSave, placeholder, className, type = 'text' }: { value: string, icon?: any, onSave: (val: string) => void, placeholder?: string, className?: string, type?: 'text' | 'phone' | 'email' | 'url' }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value || "");

    useEffect(() => { setTempValue(value || ""); }, [value]);

    const handleSave = () => {
        let finalValue = tempValue;
        if (type === 'phone') {
            // Auto-format on save if it looks like a 10-digit number
            finalValue = formatPhoneNumber(tempValue);
        }

        if (finalValue !== value) {
            onSave(finalValue);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-3 w-full">
                {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                <Input
                    autoFocus
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') {
                            setTempValue(value || "");
                            setIsEditing(false);
                        }
                    }}
                    className="h-8 text-sm"
                    placeholder={placeholder}
                />
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-3 text-sm group cursor-pointer hover:bg-muted/50 p-1 -ml-1 rounded transition-colors ${className}`}
            onDoubleClick={() => setIsEditing(true)}
            title="Double click to edit"
        >
            {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}

            {type === 'phone' && value ? (
                <a
                    href={`tel:${value.replace(/\D/g, '')}`}
                    className="text-foreground hover:underline hover:text-primary transition-colors"
                    onClick={(e) => {
                        // Allow link click, but don't interfere with potential parent handlers if any
                        // Actually, double-click handling is on the parent div. 
                        // Clicking this link will trigger navigation.
                        // To allow editing, user might need to double click 'near' it or we accept that double clicking might trigger the link.
                        // For now, let's keep it simple.
                    }}
                >
                    {formatPhoneNumber(value)}
                </a>
            ) : (
                <span className={!value ? "text-muted-foreground italic" : "text-foreground"}>
                    {value || placeholder || "Click to add..."}
                </span>
            )}

            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-50 ml-auto" />
        </div>
    );
}



export default function VendorDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [activities, setActivities] = useState<OutreachEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const updateField = async (field: string, value: string) => {
        try {
            await updateDoc(doc(db, "vendors", id), {
                [field]: value,
                statusUpdatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Update failed", e);
        }
    };

    // Simulation State
    const [customReply, setCustomReply] = useState("");
    const [isSimulating, setIsSimulating] = useState(false);



    useEffect(() => {
        if (!id) return;

        // 1. Listen to Vendor Doc
        const unsubVendor = onSnapshot(doc(db, "vendors", id), (doc) => {
            if (doc.exists()) {
                setVendor({ id: doc.id, ...doc.data() } as Vendor);
            } else {
                setVendor(null);
            }
            setLoading(false);
        });

        // 2. Listen to Activities
        const qActivity = query(
            collection(db, "vendor_activities"),
            where("vendorId", "==", id)
        );

        const unsubActivities = onSnapshot(qActivity, (snapshot) => {
            const acts: OutreachEvent[] = [];
            snapshot.forEach((doc) => {
                acts.push({ ...doc.data() } as OutreachEvent);
            });
            // Sort client-side
            acts.sort((a, b) => {
                const getTime = (d: any) => {
                    if (!d) return 0;
                    if (typeof d.toDate === 'function') return d.toDate().getTime();
                    if (d instanceof Date) return d.getTime();
                    if (typeof d === 'number') return d;
                    return new Date(d).getTime();
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            });
            setActivities(acts);
        }, (error) => {
            console.error("Error fetching activities:", error);
        });

        return () => {
            unsubVendor();
            unsubActivities();
        };
    }, [id]);

    const handleSimulateReply = async (text: string) => {
        if (!id || !text) return;
        setIsSimulating(true);
        try {
            await addDoc(collection(db, "vendor_activities"), {
                vendorId: id,
                type: 'INBOUND_REPLY',
                description: text,
                createdAt: serverTimestamp(),
                metadata: {
                    channel: 'SMS',
                    simulation: true
                }
            });
            setCustomReply("");
            // The Cloud Function 'onIncomingMessage' will trigger automatically
        } catch (error) {
            console.error("Error simulating reply:", error);
        } finally {
            setIsSimulating(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (!vendor) {
        return <div className="p-8 text-center">Vendor not found</div>;
    }

    return (
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link href="/crm">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <EditableField
                                value={vendor.companyName || ""}
                                onSave={(val) => updateField('companyName', val)}
                                className="text-3xl font-bold"
                                placeholder="Company Name"
                            />
                            <Badge className={
                                vendor.status === 'APPROVED' ? "bg-green-100 text-green-800" :
                                    vendor.status === 'REJECTED' ? "bg-red-100 text-red-800" :
                                        "bg-gray-100 text-gray-800"
                            }>
                                {vendor.status}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 w-fit">
                            <EditableField
                                value={vendor.location || ""}
                                icon={MapPin}
                                onSave={(val) => updateField('location', val)}
                                placeholder="Location"
                                className="text-muted-foreground text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Col: Info & Simulation */}
                <div className="space-y-6">
                    {/* Simulation Console (Admin Only) */}
                    <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                                <Bot className="w-4 h-4" /> Simulator
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground">Inject a mock vendor reply to test the AI agent.</p>
                            <div className="grid grid-cols-3 gap-2">
                                <Button variant="outline" size="sm" className="text-xs border-green-200 hover:bg-green-50 text-green-700" onClick={() => handleSimulateReply("Yes, I'm interested. Send me details.")} disabled={isSimulating}>
                                    Interested
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs border-yellow-200 hover:bg-yellow-50 text-yellow-700" onClick={() => handleSimulateReply("What are your payment terms?")} disabled={isSimulating}>
                                    Question
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs border-red-200 hover:bg-red-50 text-red-700" onClick={() => handleSimulateReply("Stop texting me.")} disabled={isSimulating}>
                                    Stop
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Custom reply..."
                                    className="min-h-[60px] text-xs resize-none"
                                    value={customReply}
                                    onChange={(e) => setCustomReply(e.target.value)}
                                />
                                <Button size="icon" className="h-auto w-10 shrink-0" onClick={() => handleSimulateReply(customReply)} disabled={!customReply || isSimulating}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <EditableField
                                value={vendor.phone || ""}
                                icon={Phone}
                                onSave={(val) => updateField('phone', val)}
                                placeholder="Phone"
                                type="phone"
                            />
                            <EditableField
                                value={vendor.email || ""}
                                icon={Mail}
                                onSave={(val) => updateField('email', val)}
                                placeholder="Email"
                            />
                            <EditableField
                                value={vendor.website || ""}
                                icon={Globe}
                                onSave={(val) => updateField('website', val)}
                                placeholder="Website"
                            />
                            <EditableField
                                value={vendor.specialty || ""}
                                icon={Building2}
                                onSave={(val) => updateField('specialty', val)}
                                placeholder="Specialty"
                            />
                        </CardContent>
                    </Card>

                    {/* Onboarding Status Card */}
                    {(vendor.status === 'QUALIFIED' || vendor.status === 'COMPLIANCE_REVIEW' || vendor.status === 'ONBOARDING_SCHEDULED' || vendor.status === 'ACTIVE' || vendor.onboardingStep) && (
                        <Card className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex justify-between items-center">
                                    Onboarding
                                    {vendor.speedTrack && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Speed Track ⚡️</Badge>}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-bold">{vendor.onboardingStep || 1} / 4</span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((vendor.onboardingStep || 1) / 4) * 100}%` }}></div>
                                    </div>
                                </div>

                                {vendor.qualification && (
                                    <div className="space-y-2 pt-2 border-t">
                                        <p className="text-sm font-medium">Qualification</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {Object.entries(vendor.qualification).map(([key, val]) => (
                                                <div key={key} className="flex items-center gap-1.5">
                                                    {val ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                                                    <span className="capitalize">{key === 'gl' ? 'Gen. Liab.' : key}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(vendor.status === 'COMPLIANCE_REVIEW' || vendor.status === 'ACTIVE' || vendor.compliance) && (
                                    <div className="space-y-3 pt-2 border-t text-sm">
                                        <p className="font-medium">Compliance Documents</p>

                                        {/* COI */}
                                        <div className="flex items-center justify-between border p-2 rounded bg-muted/20">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={vendor.compliance?.coi?.status === 'VERIFIED' ? 'secondary' : 'outline'} className={
                                                    vendor.compliance?.coi?.status === 'VERIFIED' ? "bg-green-100 text-green-800 border-green-200" :
                                                        vendor.compliance?.coi?.status === 'REJECTED' ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-50 text-yellow-800 border-yellow-200"
                                                }>
                                                    {vendor.compliance?.coi?.status || 'MISSING'}
                                                </Badge>
                                                <span>General Liability (COI)</span>
                                            </div>
                                            {vendor.compliance?.coi?.url ? (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800" onClick={() => window.open(vendor.compliance?.coi?.url, '_blank')}>
                                                    View
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                                            )}
                                        </div>

                                        {/* W9 */}
                                        <div className="flex items-center justify-between border p-2 rounded bg-muted/20">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={vendor.compliance?.w9?.status === 'VERIFIED' ? 'secondary' : 'outline'} className={
                                                    vendor.compliance?.w9?.status === 'VERIFIED' ? "bg-green-100 text-green-800 border-green-200" :
                                                        vendor.compliance?.w9?.status === 'REJECTED' ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-50 text-yellow-800 border-yellow-200"
                                                }>
                                                    {vendor.compliance?.w9?.status || 'MISSING'}
                                                </Badge>
                                                <span>W-9 Form</span>
                                            </div>
                                            {vendor.compliance?.w9?.url ? (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800" onClick={() => window.open(vendor.compliance?.w9?.url, '_blank')}>
                                                    View
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                                            )}
                                        </div>

                                        {/* AI Analysis Placeholder */}
                                        {(vendor.compliance?.coi?.aiAnalysis || vendor.compliance?.w9?.aiAnalysis) && (
                                            <div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs space-y-2">
                                                <p className="font-bold flex items-center gap-1 text-blue-800">
                                                    <Bot className="w-3 h-3" /> AI Analysis
                                                </p>
                                                {vendor.compliance?.coi?.aiAnalysis && (
                                                    <div>
                                                        <span className="font-semibold">COI:</span> {vendor.compliance.coi.aiAnalysis.reasoning}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Col: Timeline & Chat */}
                <div className="md:col-span-2">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="border-b border-border py-4">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Communication History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 bg-muted/30">
                            <div className="space-y-6">
                                {activities.length === 0 && (
                                    <div className="text-center text-muted-foreground py-12">
                                        No interactions yet.
                                    </div>
                                )}

                                {activities.map((act, i) => {
                                    // Render Logic based on Type

                                    // 1. Inbound Reply (Vendor) -> Chat Bubble Right
                                    if (act.type === 'INBOUND_REPLY') {
                                        return (
                                            <div key={i} className="flex justify-start">
                                                <div className="flex gap-3 max-w-[80%]">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                                                        <User className="w-4 h-4 text-slate-600" />
                                                    </div>
                                                    <div>
                                                        <div className="bg-white border border-border p-3 rounded-2xl rounded-tl-none shadow-sm text-sm">
                                                            {act.description}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-1 ml-1">
                                                            Vendor • {timeAgo(act.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // 2. AI Reply (System) -> Chat Bubble Left
                                    if (act.type === 'AI_REPLY') {
                                        return (
                                            <div key={i} className="flex justify-end">
                                                <div className="flex flex-col items-end gap-1 max-w-[80%]">
                                                    <div className="flex gap-3 flex-row-reverse">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                                            <Bot className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <div className="bg-primary/5 border border-primary/20 p-3 rounded-2xl rounded-tr-none shadow-sm text-sm">
                                                                {act.description}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground mt-1 mr-1 text-right flex items-center justify-end gap-1">
                                                                AI Agent • {timeAgo(act.createdAt)}
                                                                {act.metadata?.intent && (
                                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-primary/20">{act.metadata.intent}</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // 3. Status Changes & System Events -> Timeline Item
                                    return (
                                        <div key={i} className="flex items-center gap-4 px-4 py-2 opacity-70 hover:opacity-100 transition-opacity">
                                            <div className="flex-1 h-px bg-border"></div>
                                            <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                                {act.type === 'STATUS_CHANGE' && <Badge variant="outline" className="h-5">System</Badge>}
                                                {act.description}
                                                <span className="text-[10px] opacity-60">({timeAgo(act.createdAt)})</span>
                                            </div>
                                            <div className="flex-1 h-px bg-border"></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
