"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import { functions } from '@/lib/firebase';
import { Lead, LeadType } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowLeft,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Clock,
    Briefcase,
    TrendingUp,
    Loader2,
    Play,
    Tag,
    CheckCircle2,
    AlertTriangle,
    Send,
    Rocket,
    XCircle,
    Activity,
    Target,
    Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// ─── Targeted template interface ──────────────────────────
interface TargetedTemplate {
    id: string;
    name: string;
    description?: string;
    subject: string;
    body: string;
    category?: string;
}

// Helper to safely convert Firestore Timestamp to Date
function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    try {
        return new Date(value);
    } catch {
        return null;
    }
}

const STATUS_COLORS: Record<string, string> = {
    'new': 'bg-blue-100 text-blue-800 border-blue-200',
    'contacted': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'qualified': 'bg-green-100 text-green-800 border-green-200',
    'walkthrough': 'bg-purple-100 text-purple-800 border-purple-200',
    'proposal': 'bg-orange-100 text-orange-800 border-orange-200',
    'quoted': 'bg-sky-100 text-sky-800 border-sky-200',
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 text-gray-800 border-gray-200',
    'churned': 'bg-red-100 text-red-800 border-red-200',
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
    'medical_urgent_care': 'Urgent Care',
    'medical_private': 'Private Practice',
    'medical_surgery': 'Surgery Center',
    'medical_dialysis': 'Dialysis Center',
    'auto_dealer_showroom': 'Auto Dealership',
    'auto_service_center': 'Auto Service Center',
    'edu_daycare': 'Daycare',
    'edu_private_school': 'Private School',
    'office_general': 'General Office',
    'fitness_gym': 'Fitness Gym',
    'other': 'Other'
};

const LEAD_TYPE_CONFIG: Record<string, { color: string; label: string; sequence: string }> = {
    'direct': { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Direct', sequence: '4 emails over 14 days (Day 0, 3, 7, 14)' },
    'tenant': { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Tenant', sequence: '4 emails over 14 days (Day 0, 3, 7, 14)' },
    'referral_partnership': { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Referral Partnership', sequence: '3 emails over 10 days (Day 0, 4, 10)' },
    'enterprise': { color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Enterprise', sequence: '5 emails over 21 days (Day 0, 4, 8, 14, 21)' },
};

const OUTREACH_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    'PENDING': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Sequence Pending' },
    'IN_PROGRESS': { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Sequence Active' },
    'COMPLETED': { color: 'bg-green-100 text-green-700 border-green-200', label: 'Sequence Completed' },
    'NEEDS_MANUAL': { color: 'bg-red-100 text-red-700 border-red-200', label: 'Needs Manual Outreach' },
};

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSequenceDialog, setShowSequenceDialog] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);
    const [sequenceMessage, setSequenceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [activities, setActivities] = useState<{ id: string; type: string; description: string; createdAt: any; metadata?: any }[]>([]);

    // ─── Targeted email send state ──────────────────────────
    const [showSendDialog, setShowSendDialog] = useState(false);
    const [targetedTemplates, setTargetedTemplates] = useState<TargetedTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [previewingEmail, setPreviewingEmail] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    const fetchLead = async () => {
        try {
            const leadDoc = await getDoc(doc(db, 'leads', leadId));
            if (leadDoc.exists()) {
                const data = leadDoc.data();
                setLead({
                    id: leadDoc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                    preferredAuditTimes: data.preferredAuditTimes?.map((t: any) =>
                        t?.toDate ? t.toDate() : new Date(t)
                    )
                } as Lead);
            } else {
                router.push('/sales/crm');
            }
        } catch (error) {
            console.error('Error fetching lead:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async () => {
        try {
            const q = query(
                collection(db, 'lead_activities'),
                where('leadId', '==', leadId),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        } catch (err) {
            console.error('Error fetching activities:', err);
        }
    };

    // ─── Fetch targeted templates ────────────────────────────
    const fetchTargetedTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const snap = await getDocs(collection(db, 'templates'));
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as TargetedTemplate));
            setTargetedTemplates(all.filter(t => t.category === 'lead_targeted'));
        } catch (err) {
            console.error('Error fetching targeted templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, []);

    // ─── Send targeted email handler ────────────────────────
    const handleSendTargetedEmail = async () => {
        if (!selectedTemplateId || !lead) return;
        setSendingEmail(true);
        setSequenceMessage(null);
        try {
            const sendSingle = httpsCallable(functions, 'sendSingleLeadEmail');
            const result = await sendSingle({ leadId, templateId: selectedTemplateId });
            const data = result.data as any;
            setSequenceMessage({ type: 'success', text: data.message || 'Email sent successfully' });
            setShowSendDialog(false);
            setSelectedTemplateId('');
            setPreviewingEmail(false);
            await fetchLead();
            await fetchActivities();
        } catch (error: any) {
            const message = error?.message || 'Failed to send email';
            setSequenceMessage({ type: 'error', text: message });
        } finally {
            setSendingEmail(false);
        }
    };

    useEffect(() => {
        fetchLead();
        fetchActivities();
    }, [leadId]);

    const handleStatusChange = async (newStatus: string) => {
        if (!lead) return;
        setUpdatingStatus(true);
        try {
            await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
            setLead({ ...lead, status: newStatus as any });
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleLeadTypeChange = async (newType: string) => {
        if (!lead) return;
        try {
            await updateDoc(doc(db, 'leads', leadId), { leadType: newType });
            setLead({ ...lead, leadType: newType as LeadType });
        } catch (error) {
            console.error('Error updating lead type:', error);
        }
    };

    const handleStartSequence = async () => {
        setStartingSequence(true);
        setSequenceMessage(null);
        try {
            // If not already qualified, qualify first
            if (lead?.status !== 'qualified') {
                await updateDoc(doc(db, 'leads', leadId), { status: 'qualified' });
            }

            const startSequence = httpsCallable(functions, 'startLeadSequence');
            const result = await startSequence({ leadId });
            const data = result.data as any;

            setSequenceMessage({ type: 'success', text: data.message });
            setShowSequenceDialog(false);
            await fetchLead(); // Refresh lead data
        } catch (error: any) {
            const message = error?.message || 'Failed to start sequence';
            setSequenceMessage({ type: 'error', text: message });
        } finally {
            setStartingSequence(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute resource="sales/crm">
                <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading lead...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!lead) return null;

    const createdDate = toDate(lead.createdAt);
    const leadType = (lead as any).leadType || 'direct';
    const typeConfig = LEAD_TYPE_CONFIG[leadType] || LEAD_TYPE_CONFIG['direct'];
    const outreachStatus = (lead as any).outreachStatus;
    const outreachConfig = outreachStatus ? OUTREACH_STATUS_CONFIG[outreachStatus] : null;
    const canStartSequence = !outreachStatus || outreachStatus === 'COMPLETED' || outreachStatus === 'NEEDS_MANUAL';
    const hasEmail = lead.email && lead.email.trim().length > 0;

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/sales/dashboard')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to CRM
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">{lead.businessName}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-muted-foreground">
                                    {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                                </span>
                                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                    {typeConfig.label}
                                </Badge>
                                {outreachConfig && (
                                    <Badge variant="outline" className={`text-xs ${outreachConfig.color}`}>
                                        <Send className="w-3 h-3 mr-1" />
                                        {outreachConfig.label}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        {/* Status Selector */}
                        <Select value={lead.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="walkthrough">Walkthrough</SelectItem>
                                <SelectItem value="proposal">Proposal</SelectItem>
                                <SelectItem value="quoted">Quoted</SelectItem>
                                <SelectItem value="won">Won</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Send Targeted Email */}
                        <Button
                            variant="outline"
                            className="gap-2"
                            disabled={!hasEmail}
                            onClick={() => {
                                fetchTargetedTemplates();
                                setShowSendDialog(true);
                            }}
                        >
                            <Target className="w-4 h-4" />
                            Send Email
                        </Button>

                        {/* Start Sequence CTA */}
                        <Button
                            onClick={() => setShowSequenceDialog(true)}
                            disabled={!canStartSequence || !hasEmail}
                            className="gap-2"
                            variant={canStartSequence && hasEmail ? "default" : "outline"}
                        >
                            <Play className="w-4 h-4" />
                            {lead.status === 'qualified' ? 'Start Sequence' : 'Qualify & Start Sequence'}
                        </Button>
                    </div>
                </div>

                {/* Feedback Messages */}
                {sequenceMessage && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${sequenceMessage.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {sequenceMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <AlertTriangle className="w-4 h-4" />
                        )}
                        {sequenceMessage.text}
                        <button className="ml-auto text-xs hover:underline" onClick={() => setSequenceMessage(null)}>
                            Dismiss
                        </button>
                    </div>
                )}

                {/* No email warning */}
                {!hasEmail && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-4 h-4" />
                        No email on file — email sequences cannot be started until an email is added.
                    </div>
                )}

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-auto">
                    {/* Left Column - Main Info */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Contact Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    Contact Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                                        <p className="text-base font-medium">{lead.contactName}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-muted-foreground" />
                                            <a href={`mailto:${lead.email}`} className="text-base text-blue-600 hover:underline">
                                                {lead.email}
                                            </a>
                                        </div>
                                    </div>
                                    {lead.contactPhone && (
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">Phone</label>
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                <a href={`tel:${lead.contactPhone}`} className="text-base text-blue-600 hover:underline">
                                                    {lead.contactPhone}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {lead.address && (
                                        <div className="md:col-span-2">
                                            <label className="text-sm font-medium text-muted-foreground">Address</label>
                                            <div className="flex items-start gap-2">
                                                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                                                <p className="text-base">{lead.address}</p>
                                            </div>
                                        </div>
                                    )}
                                    {lead.zipCode && (
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground">ZIP Code</label>
                                            <p className="text-base font-medium">{lead.zipCode}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Audit Booking Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5" />
                                    Audit Booking Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {lead.preferredAuditTimes && lead.preferredAuditTimes.length > 0 ? (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                            Preferred Times
                                        </label>
                                        <div className="space-y-2">
                                            {lead.preferredAuditTimes.map((time, idx) => {
                                                const timeDate = toDate(time);
                                                return timeDate ? (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">
                                                                {format(timeDate, 'EEEE, MMMM d, yyyy')}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {format(timeDate, 'h:mm a')}
                                                            </p>
                                                        </div>
                                                        {idx === 0 && (
                                                            <Badge variant="secondary" className="ml-auto">Primary</Badge>
                                                        )}
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No audit times scheduled</p>
                                )}

                                {lead.serviceInterest && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Service Interest</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                                            <p className="text-base capitalize">{lead.serviceInterest.replace(/_/g, ' ')}</p>
                                        </div>
                                    </div>
                                )}

                                {lead.notes && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Notes</label>
                                        <p className="text-base mt-1 p-3 bg-muted/50 rounded-lg">{lead.notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        {/* Lead Type */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Tag className="w-4 h-4" />
                                    Lead Type
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Select value={leadType} onValueChange={handleLeadTypeChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="direct">Direct</SelectItem>
                                        <SelectItem value="tenant">Tenant</SelectItem>
                                        <SelectItem value="referral_partnership">Referral Partnership</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Sequence: {typeConfig.sequence}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Attribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Attribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {lead.attribution?.source && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Source</label>
                                        <p className="text-base font-medium capitalize">{lead.attribution.source}</p>
                                    </div>
                                )}
                                {lead.attribution?.medium && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Medium</label>
                                        <p className="text-base capitalize">{lead.attribution.medium}</p>
                                    </div>
                                )}
                                {lead.attribution?.campaign && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Campaign</label>
                                        <p className="text-base">{lead.attribution.campaign}</p>
                                    </div>
                                )}
                                {lead.attribution?.landingPage && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Landing Page</label>
                                        <p className="text-sm text-blue-600 break-all">{lead.attribution.landingPage}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Lead Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Lead ID</label>
                                    <p className="text-xs font-mono bg-muted/50 p-2 rounded">{lead.id}</p>
                                </div>
                                {createdDate && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                                        <p className="text-base">{format(createdDate, 'MMM d, yyyy h:mm a')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* ── Activity Timeline ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Activity Timeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
                        ) : (
                            <div className="space-y-0">
                                {activities.map((act, i) => {
                                    const date = toDate(act.createdAt);
                                    const isLast = i === activities.length - 1;
                                    return (
                                        <div key={act.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${act.type === 'OUTREACH_SENT' ? 'bg-green-100 text-green-600' :
                                                    act.type === 'OUTREACH_FAILED' ? 'bg-red-100 text-red-600' :
                                                        act.type === 'SEQUENCE_STARTED' ? 'bg-blue-100 text-blue-600' :
                                                            act.type === 'OUTREACH_QUEUED' ? 'bg-amber-100 text-amber-600' :
                                                                'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {act.type === 'OUTREACH_SENT' ? <Send className="w-3.5 h-3.5" /> :
                                                        act.type === 'OUTREACH_FAILED' ? <XCircle className="w-3.5 h-3.5" /> :
                                                            act.type === 'SEQUENCE_STARTED' ? <Rocket className="w-3.5 h-3.5" /> :
                                                                act.type === 'OUTREACH_QUEUED' ? <Clock className="w-3.5 h-3.5" /> :
                                                                    <Activity className="w-3.5 h-3.5" />}
                                                </div>
                                                {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
                                            </div>
                                            <div className={`pb-4 ${isLast ? '' : ''}`}>
                                                <p className="text-sm font-medium leading-tight">
                                                    {act.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                                                {date && (
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        {format(date, 'MMM d, yyyy h:mm a')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Start Sequence Confirmation Dialog */}
            <AlertDialog open={showSequenceDialog} onOpenChange={setShowSequenceDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Play className="w-5 h-5" />
                            Start Email Sequence
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    This will start an automated email drip campaign for <strong>{lead.businessName}</strong>.
                                </p>
                                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Lead Type:</span>
                                        <Badge variant="outline" className={typeConfig.color}>{typeConfig.label}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Sequence:</span>
                                        <span className="font-medium">{typeConfig.sequence}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Recipient:</span>
                                        <span className="font-medium">{lead.email}</span>
                                    </div>
                                </div>
                                {lead.status !== 'qualified' && (
                                    <p className="text-xs text-amber-600">
                                        This will also update the lead status to <strong>Qualified</strong>.
                                    </p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={startingSequence}>Cancel</AlertDialogCancel>
                        <Button onClick={handleStartSequence} disabled={startingSequence} className="gap-2">
                            {startingSequence ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            {startingSequence ? 'Starting...' : 'Start Sequence'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Send Targeted Email Dialog ─── */}
            <AlertDialog open={showSendDialog} onOpenChange={(open: boolean) => { setShowSendDialog(open); if (!open) { setSelectedTemplateId(''); setPreviewingEmail(false); } }}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Send Targeted Email
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>
                                    Choose a template to send a one-off email to <strong>{lead.businessName}</strong> ({lead.email}).
                                </p>

                                {loadingTemplates ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : targetedTemplates.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        No targeted templates found. Create one in{' '}
                                        <a href="/admin/email-templates" className="text-primary hover:underline font-medium">Settings → Email Templates</a>.
                                    </div>
                                ) : (
                                    <>
                                        {/* Template selector */}
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Template</label>
                                            <Select value={selectedTemplateId} onValueChange={(v: string) => { setSelectedTemplateId(v); setPreviewingEmail(false); }}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {targetedTemplates.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            <div className="flex flex-col">
                                                                <span>{t.name}</span>
                                                                {t.description && <span className="text-[10px] text-muted-foreground">{t.description}</span>}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Preview */}
                                        {selectedTemplateId && (() => {
                                            const tpl = targetedTemplates.find(t => t.id === selectedTemplateId);
                                            if (!tpl) return null;

                                            // Simple preview merge
                                            const mergeVars: Record<string, string> = {
                                                businessName: lead.businessName || '',
                                                contactName: lead.contactName || '',
                                                facilityType: lead.facilityType || '',
                                                address: lead.address || '',
                                                squareFootage: (lead as any).squareFootage || '',
                                            };
                                            const previewSubject = tpl.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => mergeVars[k] || `{{${k}}}`);
                                            const previewBody = tpl.body.replace(/\{\{(\w+)\}\}/g, (_, k) => mergeVars[k] || `{{${k}}}`);

                                            return (
                                                <div className="space-y-3">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1.5"
                                                        onClick={() => setPreviewingEmail(!previewingEmail)}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {previewingEmail ? 'Hide Preview' : 'Preview Email'}
                                                    </Button>

                                                    {previewingEmail && (
                                                        <div className="border rounded-lg bg-white dark:bg-background overflow-hidden">
                                                            <div className="px-4 py-2.5 bg-muted/30 border-b text-[11px] space-y-0.5">
                                                                <div>From: <span className="font-medium">XIRI Facility Solutions &lt;chris@xiri.ai&gt;</span></div>
                                                                <div>To: <span className="font-medium">{lead.contactName} &lt;{lead.email}&gt;</span></div>
                                                                <div>Subject: <span className="font-semibold text-xs">{previewSubject}</span></div>
                                                            </div>
                                                            <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">
                                                                {previewBody}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Template:</span>
                                                            <span className="font-medium">{tpl.name}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Subject:</span>
                                                            <span className="font-medium">{previewSubject}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Recipient:</span>
                                                            <span className="font-medium">{lead.email}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sendingEmail}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleSendTargetedEmail}
                            disabled={sendingEmail || !selectedTemplateId}
                            className="gap-2"
                        >
                            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sendingEmail ? 'Sending...' : 'Send Email'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ProtectedRoute>
    );
}
