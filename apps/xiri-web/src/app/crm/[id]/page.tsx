"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Phone, Mail, Globe, MapPin, Building2, Calendar, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { Vendor, OutreachEvent } from "@/types/vendor";

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
        // Assume string or other
        jsDate = new Date(date);
    }

    if (isNaN(jsDate.getTime())) return "Just now";

    const seconds = Math.floor((new Date().getTime() - jsDate.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

export default function VendorDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [activities, setActivities] = useState<OutreachEvent[]>([]);
    const [loading, setLoading] = useState(true);

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
            // Sort client-side to avoid needing a composite index immediately
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
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        {vendor.companyName}
                        <Badge className={
                            vendor.status === 'APPROVED' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }>
                            {vendor.status}
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3" /> {vendor.location}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Col: Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {vendor.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span>{vendor.phone}</span>
                                </div>
                            )}
                            {vendor.email && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email}</a>
                                </div>
                            )}
                            {vendor.website && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <a href={vendor.website} target="_blank" className="hover:underline text-primary">Visit Website</a>
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-sm">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span>{vendor.specialty || "General Services"}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">AI Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Fit Score</span>
                                <Badge variant="outline" className="font-bold text-lg">{vendor.fitScore || 0}</Badge>
                            </div>
                            {vendor.aiReasoning && (
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md italic">
                                    "{vendor.aiReasoning}"
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Timeline */}
                <div className="md:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Activity Timeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l border-border ml-3 space-y-8 pl-6 py-2">
                                {activities.map((act, i) => (
                                    <div key={i} className="relative">
                                        {/* Icon Dot */}
                                        <div className={`absolute -left-[31px] top-1 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center 
                                            ${act.type === 'STATUS_CHANGE' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}
                                        `}>
                                            {act.type === 'STATUS_CHANGE' ? <CheckCircle2 className="w-4 h-4" /> :
                                                act.type === 'OUTREACH_QUEUED' ? <MessageSquare className="w-4 h-4" /> :
                                                    <Clock className="w-4 h-4" />}
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                                {timeAgo(act.createdAt)}
                                            </span>
                                            <h4 className="text-sm font-semibold text-foreground">
                                                {act.type.replace('_', ' ')}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {act.description}
                                            </p>

                                            {/* Metadata Preview */}
                                            {/* Metadata Preview */}
                                            {act.metadata && (
                                                <div className="mt-3">
                                                    {/* New Combined Format (SMS & Email) */}
                                                    {act.metadata.sms && act.metadata.email ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                                            {/* SMS Draft */}
                                                            <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
                                                                <div className="bg-muted px-3 py-2 border-b border-border flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                        <MessageSquare className="w-3 h-3" /> SMS Draft
                                                                    </div>
                                                                    <Badge variant="secondary" className="text-[10px] h-5">160 chars</Badge>
                                                                </div>
                                                                <div className="p-3 text-sm text-foreground/90 whitespace-pre-wrap font-sans">
                                                                    {act.metadata.sms}
                                                                </div>
                                                            </div>

                                                            {/* Email Draft */}
                                                            <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
                                                                <div className="bg-muted px-3 py-2 border-b border-border flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                    <Mail className="w-3 h-3" /> Email Draft
                                                                </div>
                                                                <div className="p-3 space-y-2 text-sm text-foreground/90">
                                                                    <div>
                                                                        <span className="text-muted-foreground text-xs uppercase font-bold mr-2">Subject:</span>
                                                                        <span className="font-medium">{act.metadata.email.subject}</span>
                                                                    </div>
                                                                    <div className="whitespace-pre-wrap font-sans border-t border-border pt-2 mt-2">
                                                                        {act.metadata.email.body}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    ) : act.metadata.content ? (
                                                        /* Legacy Format */
                                                        <div className="bg-muted p-3 rounded-md text-sm italic border-l-4 border-primary/20">
                                                            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                {act.metadata.channel === 'SMS' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                                                                {act.metadata.channel} Draft
                                                            </div>
                                                            <div className="whitespace-pre-wrap font-sans not-italic text-foreground/90">
                                                                {act.metadata.content}
                                                            </div>
                                                        </div>
                                                    ) : act.metadata.oldStatus && act.metadata.newStatus ? (
                                                        /* Status Change */
                                                        <div className="text-sm flex items-center gap-2 text-muted-foreground">
                                                            <Badge variant="outline" className="text-xs font-normal bg-background">{act.metadata.oldStatus}</Badge>
                                                            <span>→</span>
                                                            <Badge variant="outline" className="text-xs font-medium bg-background border-primary/20 text-primary">{act.metadata.newStatus}</Badge>
                                                        </div>
                                                    ) : (
                                                        /* Raw Fallback */
                                                        <div className="text-xs bg-muted/50 p-2 rounded border border-border">
                                                            <pre className="whitespace-pre-wrap font-mono">
                                                                {JSON.stringify(act.metadata, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {activities.length === 0 && (
                                    <div className="text-center text-muted-foreground py-8">
                                        No recent activity.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
