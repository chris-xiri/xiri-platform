'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Mail, XCircle, Clock, Check, Rocket,
    ChevronDown, ChevronUp, AlertTriangle, Send, Activity
} from 'lucide-react';

interface LeadActivity {
    id: string;
    leadId: string;
    type: string;
    description: string;
    createdAt: any;
    metadata?: any;
}

interface QueueTask {
    id: string;
    leadId: string;
    status: string;
    scheduledAt: any;
    metadata?: any;
}

const ACTIVITY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    'SEQUENCE_STARTED': { icon: Rocket, color: 'text-blue-500', label: 'Sequence Started' },
    'OUTREACH_SENT': { icon: Send, color: 'text-green-500', label: 'Email Sent' },
    'OUTREACH_FAILED': { icon: XCircle, color: 'text-red-500', label: 'Email Failed' },
    'OUTREACH_QUEUED': { icon: Clock, color: 'text-amber-500', label: 'Queued' },
    'STATUS_CHANGE': { icon: Activity, color: 'text-blue-500', label: 'Status Change' },
};

const DEFAULT_CONFIG = { icon: Activity, color: 'text-muted-foreground', label: 'Event' };

function formatTimestamp(ts: any): { relative: string; absolute: string } {
    if (!ts) return { relative: '', absolute: '' };
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relative: string;
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays < 7) relative = `${diffDays}d ago`;
    else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const absolute = date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return { relative, absolute };
}

function formatFutureTimestamp(ts: any): string {
    if (!ts) return '';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
}

export default function LeadActivityFeed({ leadId }: { leadId: string }) {
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [scheduledTasks, setScheduledTasks] = useState<QueueTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Real-time listener for lead_activities
    useEffect(() => {
        const q = query(
            collection(db, 'lead_activities'),
            where('leadId', '==', leadId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LeadActivity[];
            setActivities(items);
            setLoading(false);
        }, (error) => {
            console.error('Error loading lead activities:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [leadId]);

    // Real-time listener for outreach_queue (scheduled emails)
    useEffect(() => {
        const q = query(
            collection(db, 'outreach_queue'),
            where('leadId', '==', leadId),
            where('status', 'in', ['PENDING', 'RETRY'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as QueueTask[];
            // Sort by scheduledAt ascending
            tasks.sort((a, b) => {
                const aTime = a.scheduledAt instanceof Timestamp ? a.scheduledAt.toMillis() : 0;
                const bTime = b.scheduledAt instanceof Timestamp ? b.scheduledAt.toMillis() : 0;
                return aTime - bTime;
            });
            setScheduledTasks(tasks);
        }, (error) => {
            console.error('Error loading scheduled tasks:', error);
        });

        return () => unsubscribe();
    }, [leadId]);

    if (loading) {
        return (
            <div className="p-4">
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
            </div>
        );
    }

    if (activities.length === 0 && scheduledTasks.length === 0) {
        return (
            <div className="p-8 text-center">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <h3 className="font-medium text-sm">No Activity Yet</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Click "Start Sequence" to begin outreach — emails and events will appear here.
                </p>
            </div>
        );
    }

    const renderActivity = (activity: LeadActivity) => {
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
                            {formatTimestamp(activity.createdAt).relative} · {formatTimestamp(activity.createdAt).absolute}
                        </span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">
                        {activity.description}
                    </p>
                    {/* Expandable email content */}
                    {(activity.metadata?.subject || activity.metadata?.html || activity.metadata?.body) && (
                        <div className="mt-1.5">
                            <button
                                onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                            >
                                <Mail className="w-3 h-3" />
                                {expandedId === activity.id ? 'Hide email' : 'View email'}
                                {expandedId === activity.id
                                    ? <ChevronUp className="w-3 h-3" />
                                    : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {expandedId === activity.id && (
                                <div className="mt-2 rounded-md border bg-card overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/40 border-b space-y-0.5 text-[10px] text-muted-foreground">
                                        {activity.metadata.to && (
                                            <div>To: <span className="text-foreground font-medium">{activity.metadata.to}</span></div>
                                        )}
                                        {activity.metadata.subject && (
                                            <div className="pt-1 border-t mt-1">
                                                Subject: <span className="text-foreground font-semibold text-xs">
                                                    {activity.metadata.subject}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {activity.metadata.html ? (
                                        <iframe
                                            srcDoc={activity.metadata.html}
                                            sandbox="allow-same-origin"
                                            className="w-full border-0"
                                            style={{ height: '320px' }}
                                            title="Email preview"
                                        />
                                    ) : activity.metadata.body ? (
                                        <div className="px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto text-foreground">
                                            {activity.metadata.body}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderScheduledTask = (task: QueueTask) => {
        const ts = formatTimestamp(task.scheduledAt);
        const futureLabel = formatFutureTimestamp(task.scheduledAt);
        const step = task.metadata?.sequence != null ? task.metadata.sequence + 1 : '?';
        const templateId = task.metadata?.templateId || '';

        return (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors">
                <div className="mt-0.5 p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600">
                    <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-medium border-amber-300 text-amber-700">
                            Step {step}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                            {futureLabel} · {ts.absolute}
                        </span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5">
                        Email to <span className="font-medium">{task.metadata?.email || 'unknown'}</span>
                    </p>
                    {templateId && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Template: {templateId}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Scheduled / Upcoming */}
            {scheduledTasks.length > 0 && (
                <>
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Scheduled ({scheduledTasks.length})
                        </span>
                    </div>
                    <div className="divide-y divide-border border-b-2 border-amber-200 dark:border-amber-800">
                        {scheduledTasks.map(t => renderScheduledTask(t))}
                    </div>
                </>
            )}
            {/* Past Activity */}
            {activities.length > 0 && (
                <>
                    {scheduledTasks.length > 0 && (
                        <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">Past Activity</span>
                        </div>
                    )}
                    <div className="divide-y divide-border">
                        {activities.map(a => renderActivity(a))}
                    </div>
                </>
            )}
        </div>
    );
}
