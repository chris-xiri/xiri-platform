'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Mail, Phone, FileText, Shield, RefreshCw, AlertTriangle, Check,
    Eye, Link as LinkIcon, XCircle, Clock, ArrowRight, Zap, Globe
} from 'lucide-react';

interface VendorActivity {
    id: string;
    vendorId: string;
    type: string;
    description: string;
    createdAt: any;
    metadata?: any;
}

const ACTIVITY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    'STATUS_CHANGE': { icon: ArrowRight, color: 'text-blue-500', label: 'Status Change' },
    'OUTREACH_SENT': { icon: Mail, color: 'text-green-500', label: 'Email Sent' },
    'OUTREACH_RESENT': { icon: RefreshCw, color: 'text-blue-500', label: 'Email Resent' },
    'OUTREACH_FAILED': { icon: XCircle, color: 'text-red-500', label: 'Email Failed' },
    'DRIP_SENT': { icon: Mail, color: 'text-purple-500', label: 'Drip Email' },
    'DRIP_SCHEDULED': { icon: Clock, color: 'text-purple-400', label: 'Drip Scheduled' },
    'ENRICHMENT': { icon: Globe, color: 'text-cyan-500', label: 'Enrichment' },
    'DOCUMENT_UPLOADED': { icon: FileText, color: 'text-amber-500', label: 'Document' },
    'DOCUMENT_VERIFIED': { icon: Shield, color: 'text-green-500', label: 'Doc Verified' },
    'COMPLIANCE_UPDATED': { icon: Shield, color: 'text-blue-500', label: 'Compliance' },
    'ONBOARDING_COMPLETE': { icon: Check, color: 'text-green-600', label: 'Onboarded' },
    'CALL': { icon: Phone, color: 'text-blue-500', label: 'Call' },
    'EMAIL_DELIVERED': { icon: Check, color: 'text-green-500', label: 'Delivered' },
    'EMAIL_OPENED': { icon: Eye, color: 'text-blue-500', label: 'Opened' },
    'EMAIL_CLICKED': { icon: LinkIcon, color: 'text-purple-500', label: 'Clicked' },
    'EMAIL_BOUNCED': { icon: XCircle, color: 'text-red-500', label: 'Bounced' },
    'FAST_TRACK': { icon: Zap, color: 'text-orange-500', label: 'Fast Track' },
};

const DEFAULT_CONFIG = { icon: AlertTriangle, color: 'text-muted-foreground', label: 'Event' };

function formatTimestamp(ts: any): string {
    if (!ts) return '';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function VendorActivityFeed({ vendorId }: { vendorId: string }) {
    const [activities, setActivities] = useState<VendorActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'vendor_activities'),
            where('vendorId', '==', vendorId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as VendorActivity[];
            setActivities(items);
            setLoading(false);
        }, (error) => {
            console.error('Error loading activities:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex gap-3 animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-muted" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (activities.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Clock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                    <h3 className="font-medium text-sm">No Activity Yet</h3>
                    <p className="text-xs text-muted-foreground mt-1">Events will appear here as they happen — emails, status changes, enrichment, etc.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                    <span>Activity Timeline</span>
                    <Badge variant="secondary" className="text-[10px]">{activities.length} events</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    {activities.map((activity) => {
                        const config = ACTIVITY_CONFIG[activity.type] || DEFAULT_CONFIG;
                        const Icon = config.icon;

                        return (
                            <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                <div className={`mt-0.5 p-1.5 rounded-full bg-muted/50 ${config.color}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-medium">
                                            {config.label}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatTimestamp(activity.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">
                                        {activity.description}
                                    </p>
                                    {/* Email delivery status badges */}
                                    {activity.metadata?.deliveryStatus && (
                                        <div className="flex gap-1 mt-1">
                                            {activity.metadata.deliveryStatus === 'delivered' && (
                                                <Badge className="text-[8px] bg-green-100 text-green-700 border-green-200">✅ Delivered</Badge>
                                            )}
                                            {activity.metadata.deliveryStatus === 'opened' && (
                                                <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-200">👁️ Opened</Badge>
                                            )}
                                            {activity.metadata.deliveryStatus === 'clicked' && (
                                                <Badge className="text-[8px] bg-purple-100 text-purple-700 border-purple-200">🔗 Clicked</Badge>
                                            )}
                                            {activity.metadata.deliveryStatus === 'bounced' && (
                                                <Badge className="text-[8px] bg-red-100 text-red-700 border-red-200">❌ Bounced</Badge>
                                            )}
                                        </div>
                                    )}
                                    {/* Enriched fields */}
                                    {activity.metadata?.enrichedFields?.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                            {activity.metadata.enrichedFields.map((f: string) => (
                                                <Badge key={f} variant="secondary" className="text-[8px] px-1">{f}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
