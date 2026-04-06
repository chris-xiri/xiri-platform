"use client";

import { useState } from 'react';
import { Contact, LeadStatus, LeadType, FACILITY_TYPE_LABELS } from '@xiri-facility-solutions/shared';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Building2,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Rocket,
    Loader2,
    CheckCircle2,
    MousePointerClick,
    MailOpen,
    MailCheck,
    AlertTriangle,
    Ban,
    Target,
    Send,
    Eye,
    User,
} from 'lucide-react';

export type ColumnKey = 'business' | 'type' | 'contact' | 'location' | 'auditTime' | 'status' | 'source' | 'created' | 'actions';

/** Contact row with denormalized company data */
export interface ContactRow extends Contact {
    _companyStatus: LeadStatus;
    _companyLeadType?: LeadType;
    _companyFacilityType?: string;
    _companyAddress?: string;
    _companyCity?: string;
    _companyState?: string;
    _companyZip?: string;
    _companyAttribution?: { source?: string; medium?: string; campaign?: string; landingPage?: string };
    _companyOutreachStatus?: string;
    _companyPreferredAuditTimes?: any[];
    sequenceHistory?: Record<string, { startedAt?: any; status?: string; sequenceName?: string }>;
}

interface LeadRowProps {
    lead: ContactRow;
    index: number;
    isSelected?: boolean;
    onSelect?: (checked: boolean) => void;
    onRowClick?: (id: string) => void;
    visibleColumns?: Set<ColumnKey>;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
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

const LEAD_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
    'direct': { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Direct' },
    'tenant': { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Tenant' },
    'referral_partnership': { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Referral' },
    'enterprise': { color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Enterprise' },
};

const ALL_COLUMNS = new Set<ColumnKey>(['business', 'type', 'contact', 'location', 'auditTime', 'status', 'source', 'created', 'actions']);

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

// ─── Engagement signal helpers ───
function getEngagementSignal(contact: Contact) {
    const eng = contact.emailEngagement;
    if (!eng) return null;

    switch (eng.lastEvent) {
        case 'clicked':
            return { icon: MousePointerClick, label: 'Clicked', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
        case 'opened':
            return { icon: MailOpen, label: `Opened${eng.openCount && eng.openCount > 1 ? ` ×${eng.openCount}` : ''}`, color: 'text-blue-600 bg-blue-50 border-blue-200' };
        case 'delivered':
            return { icon: MailCheck, label: 'Delivered', color: 'text-gray-500 bg-gray-50 border-gray-200' };
        case 'bounced':
            return { icon: AlertTriangle, label: 'Bounced', color: 'text-red-600 bg-red-50 border-red-200' };
        case 'spam':
            return { icon: Ban, label: 'Spam', color: 'text-red-700 bg-red-50 border-red-200' };
        default:
            return null;
    }
}

function timeAgo(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

export function LeadRow({ lead, index, isSelected, onSelect, onRowClick, visibleColumns = ALL_COLUMNS }: LeadRowProps) {
    const router = useRouter();
    const [startingSequence, setStartingSequence] = useState(false);
    const [sequenceError, setSequenceError] = useState<string | null>(null);

    // Navigate to the contact detail page (now company-scoped)
    const handleClick = () => {
        if (onRowClick && lead.id) {
            onRowClick(lead.id);
        } else {
            router.push(`/sales/crm/${lead.companyId}`);
        }
    };

    // ─── Sequence picker state ──────────────────────────────
    const [showSequenceDialog, setShowSequenceDialog] = useState(false);
    const [availableSequences, setAvailableSequences] = useState<{id:string;name:string;description?:string;steps:any[];leadTypes?:string[]}[]>([]);
    const [selectedSequenceId, setSelectedSequenceId] = useState('');
    const [loadingSequencesList, setLoadingSequencesList] = useState(false);

    const openSequenceDialog = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lead.email || !lead.companyId) return;
        setShowSequenceDialog(true);
        setLoadingSequencesList(true);
        try {
            const seqSnap = await getDocs(collection(db, 'sequences'));
            const allSeqs = seqSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Only show lead-appropriate sequences — exclude vendor sequences
            const LEAD_CATEGORIES = ['lead', 'referral', 'custom'];
            setAvailableSequences(allSeqs.filter((s: any) => !s.category || LEAD_CATEGORIES.includes(s.category)));
        } catch (err) {
            console.error('Error loading sequences:', err);
        } finally {
            setLoadingSequencesList(false);
        }
    };

    const handleStartSequence = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lead.email || !lead.companyId || !selectedSequenceId) return;
        setStartingSequence(true);
        setSequenceError(null);
        try {
            const startSequence = httpsCallable(functions, 'startLeadSequence');
            await startSequence({ leadId: lead.companyId, contactId: lead.id, sequenceId: selectedSequenceId });
            setShowSequenceDialog(false);
            setSelectedSequenceId('');
        } catch (err: any) {
            const msg = err?.message || 'Failed to start sequence';
            // Firebase callable errors wrap the message
            const cleanMsg = msg.replace(/^.*?:\s*/, '');
            setSequenceError(cleanMsg);
        } finally {
            setStartingSequence(false);
        }
    };

    // ─── Targeted email state ─────────────────────────────────
    const [showSendDialog, setShowSendDialog] = useState(false);
    const [targetedTemplates, setTargetedTemplates] = useState<{id:string;name:string;description?:string;subject:string;body:string;category?:string}[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [sendResult, setSendResult] = useState<{type:'success'|'error';text:string}|null>(null);

    const openSendDialog = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowSendDialog(true);
        setLoadingTemplates(true);
        try {
            const snap = await getDocs(collection(db, 'templates'));
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setTargetedTemplates(all.filter((t: any) => t.category === 'lead_targeted'));
        } catch (err) {
            console.error('Error fetching templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleSendEmail = async () => {
        if (!selectedTemplateId || !lead.id) return;
        setSendingEmail(true);
        setSendResult(null);
        try {
            const sendSingle = httpsCallable(functions, 'sendSingleLeadEmail');
            const result = await sendSingle({ leadId: lead.companyId, contactId: lead.id, templateId: selectedTemplateId });
            const data = result.data as any;
            setSendResult({ type: 'success', text: data.message || 'Email sent!' });
            setShowSendDialog(false);
            setSelectedTemplateId('');
            setPreviewOpen(false);
        } catch (err: any) {
            setSendResult({ type: 'error', text: err?.message || 'Failed to send' });
        } finally {
            setSendingEmail(false);
        }
    };

    // Check both company-level outreach status AND contact-level sequenceHistory
    const hasActiveSequence = (() => {
        // Check contact-level sequenceHistory (real-time via onSnapshot)
        if (lead.sequenceHistory) {
            const activeStatuses = ['active', 'in_progress', 'pending', 'PENDING', 'IN_PROGRESS'];
            const hasActive = Object.values(lead.sequenceHistory).some(
                s => activeStatuses.includes(s.status || '')
            );
            if (hasActive) return true;
        }
        // Fallback: company-level outreach status
        return !!(lead as any)._companyOutreachStatus && ['PENDING', 'IN_PROGRESS', 'SENT', 'COMPLETED'].includes((lead as any)._companyOutreachStatus);
    })();

    const firstAuditTime = lead._companyPreferredAuditTimes && lead._companyPreferredAuditTimes.length > 0
        ? toDate(lead._companyPreferredAuditTimes[0])
        : null;

    const createdDate = toDate(lead.createdAt);
    const show = (col: ColumnKey) => visibleColumns.has(col);
    const engagement = getEngagementSignal(lead);

    const fullName = `${lead.firstName} ${lead.lastName}`.trim();

    return (
        <TableRow className="hover:bg-muted/50 transition-colors">
            {onSelect && (
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onSelect}
                        aria-label="Select contact"
                    />
                </TableCell>
            )}

            <TableCell
                className="text-center text-xs text-muted-foreground font-mono cursor-pointer"
                onClick={handleClick}
            >
                {index + 1}
            </TableCell>

            {/* Contact column — now the PRIMARY display */}
            {show('contact') && (
                <TableCell className="cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-semibold text-sm">{fullName || lead.companyName || 'No name'}</span>
                            {lead.isPrimary && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20">Primary</Badge>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 pl-[18px]">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                        </div>
                        {lead.phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 pl-[18px]">
                                <Phone className="w-3 h-3" />
                                {lead.phone}
                            </div>
                        )}
                        {lead.role && (
                            <span className="text-[10px] text-muted-foreground pl-[18px]">{lead.role}</span>
                        )}
                    </div>
                </TableCell>
            )}

            {/* Business / Company column */}
            {show('business') && (
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <div
                            className="font-medium text-sm flex items-center gap-1 cursor-pointer hover:underline text-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (lead.companyId) router.push(`/sales/dashboard/${lead.companyId}`);
                            }}
                        >
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {lead.companyName}
                        </div>
                        {lead._companyFacilityType && (
                            <div className="text-xs text-muted-foreground pl-4">
                                {(FACILITY_TYPE_LABELS as Record<string, string>)[lead._companyFacilityType] || lead._companyFacilityType}
                            </div>
                        )}
                    </div>
                </TableCell>
            )}

            {show('type') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    {(() => {
                        const lt = lead._companyLeadType || 'direct';
                        const cfg = LEAD_TYPE_CONFIG[lt] || LEAD_TYPE_CONFIG['direct'];
                        return (
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                                {cfg.label}
                            </Badge>
                        );
                    })()}
                </TableCell>
            )}

            {show('location') && (
                <TableCell className="cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col gap-0.5">
                        {lead._companyAddress && (
                            <div className="text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="line-clamp-1">{lead._companyAddress}</span>
                            </div>
                        )}
                        {(lead._companyCity || lead._companyState || lead._companyZip) && (
                            <div className="text-xs text-muted-foreground pl-4">
                                {[lead._companyCity, lead._companyState].filter(Boolean).join(', ')}{lead._companyZip ? ` ${lead._companyZip}` : ''}
                            </div>
                        )}
                    </div>
                </TableCell>
            )}

            {show('auditTime') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    {firstAuditTime ? (
                        <div className="flex flex-col gap-1">
                            <div className="text-xs font-medium flex items-center justify-center gap-1">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {format(firstAuditTime, 'MMM d')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {format(firstAuditTime, 'h:mm a')}
                            </div>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                    )}
                </TableCell>
            )}

            {show('status') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col items-center gap-1">
                        <Badge
                            variant="outline"
                            className={`text-xs font-medium ${STATUS_COLORS[lead._companyStatus]}`}
                        >
                            {lead._companyStatus}
                        </Badge>
                        {engagement && (
                            <div className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${engagement.color}`}>
                                <engagement.icon className="w-3 h-3" />
                                {engagement.label}
                                {lead.emailEngagement?.lastEventAt && (
                                    <span className="opacity-70">{timeAgo(lead.emailEngagement.lastEventAt)}</span>
                                )}
                            </div>
                        )}
                    </div>
                </TableCell>
            )}

            {show('source') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    {lead._companyAttribution?.source && (
                        <div className="text-xs text-muted-foreground">
                            {lead._companyAttribution.source}
                        </div>
                    )}
                </TableCell>
            )}

            {show('created') && (
                <TableCell className="text-center text-xs text-muted-foreground cursor-pointer" onClick={handleClick}>
                    {createdDate && format(createdDate, 'MMM d, yyyy')}
                </TableCell>
            )}

            {show('actions') && (
                <TableCell className="text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {lead.email ? (
                        <div className="flex flex-col items-center gap-1">
                            {/* ── Primary actions: Email & Sequence (HubSpot pattern) ── */}
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={openSendDialog}
                                >
                                    <Mail className="w-3 h-3" />
                                    Email
                                </Button>
                                {hasActiveSequence ? (
                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 h-7 px-2">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> In Sequence
                                    </Badge>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                        disabled={startingSequence}
                                        onClick={openSequenceDialog}
                                    >
                                        {startingSequence
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <Rocket className="w-3 h-3" />}
                                        {startingSequence ? 'Starting…' : 'Sequence'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] text-muted-foreground">No email</span>
                    )}

                    {/* Send result toast */}
                    {sendResult && (
                        <div className={`mt-1 text-[10px] px-1.5 py-0.5 rounded ${sendResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {sendResult.text}
                        </div>
                    )}
                </TableCell>
            )}

            {/* ─── Send Targeted Email Dialog ─── */}
            <AlertDialog open={showSendDialog} onOpenChange={(open: boolean) => { setShowSendDialog(open); if (!open) { setSelectedTemplateId(''); setPreviewOpen(false); } }}>
                <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Send Email to {fullName}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p className="text-sm">
                                    Choose a targeted template to send a one-off email to <strong>{lead.email}</strong>.
                                    <span className="text-muted-foreground ml-1">({lead.companyName})</span>
                                </p>

                                {loadingTemplates ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : targetedTemplates.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-muted-foreground">
                                        <Mail className="w-7 h-7 mx-auto mb-2 opacity-30" />
                                        No targeted templates yet.{' '}
                                        <a href="/admin/email-templates" className="text-primary hover:underline font-medium">Create one</a>.
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Template</label>
                                            <Select value={selectedTemplateId} onValueChange={(v: string) => { setSelectedTemplateId(v); setPreviewOpen(false); }}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {targetedTemplates.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            {t.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedTemplateId && (() => {
                                            const tpl = targetedTemplates.find(t => t.id === selectedTemplateId);
                                            if (!tpl) return null;
                                            const vars: Record<string, string> = {
                                                businessName: lead.companyName || '',
                                                contactName: fullName,
                                                firstName: lead.firstName || '',
                                                lastName: lead.lastName || '',
                                                facilityType: lead._companyFacilityType || '',
                                                address: lead._companyAddress || '',
                                            };
                                            const subj = tpl.subject.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] || `{{${k}}}`);
                                            const body = tpl.body.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] || `{{${k}}}`);

                                            return (
                                                <div className="space-y-2">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPreviewOpen(!previewOpen)}>
                                                        <Eye className="w-3 h-3" />
                                                        {previewOpen ? 'Hide' : 'Preview'}
                                                    </Button>
                                                    {previewOpen && (
                                                        <div className="border rounded-lg overflow-hidden bg-white dark:bg-background">
                                                            <div className="px-3 py-2 bg-muted/30 border-b text-[11px] space-y-0.5">
                                                                <div>From: <span className="font-medium">XIRI Facility Solutions</span></div>
                                                                <div>To: <span className="font-medium">{lead.email}</span></div>
                                                                <div>Subject: <span className="font-semibold">{subj}</span></div>
                                                            </div>
                                                            <div className="px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed max-h-52 overflow-auto">
                                                                {body}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="bg-muted/30 p-2 rounded text-xs space-y-0.5">
                                                        <div className="flex justify-between"><span className="text-muted-foreground">Template:</span><span className="font-medium">{tpl.name}</span></div>
                                                        <div className="flex justify-between"><span className="text-muted-foreground">Subject:</span><span className="font-medium">{subj}</span></div>
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
                        <Button onClick={handleSendEmail} disabled={sendingEmail || !selectedTemplateId} className="gap-2">
                            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sendingEmail ? 'Sending...' : 'Send Email'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Sequence Picker Dialog ─── */}
            <AlertDialog open={showSequenceDialog} onOpenChange={(open: boolean) => { setShowSequenceDialog(open); if (!open) { setSelectedSequenceId(''); setSequenceError(null); } }}>
                <AlertDialogContent className="max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Rocket className="w-5 h-5" />
                            Start Email Sequence
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p className="text-sm">
                                    Choose a sequence for <strong>{fullName}</strong> ({lead.email}).
                                </p>

                                {loadingSequencesList ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : availableSequences.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-muted-foreground">
                                        <Rocket className="w-7 h-7 mx-auto mb-2 opacity-30" />
                                        No sequences found.{' '}
                                        <a href="/admin/email-templates" className="text-primary hover:underline font-medium">Create one</a>.
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Sequence</label>
                                            <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a sequence..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableSequences.map(seq => (
                                                        <SelectItem key={seq.id} value={seq.id}>
                                                            <div className="flex items-center gap-2">
                                                                <span>{seq.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    ({seq.steps?.length || 0} emails)
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedSequenceId && (() => {
                                            const seq = availableSequences.find(s => s.id === selectedSequenceId);
                                            if (!seq) return null;
                                            const dayList = seq.steps?.map((s: any) => `Day ${s.dayOffset}`).join(', ') || '';
                                            return (
                                                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Steps:</span>
                                                        <span className="font-medium">{seq.steps?.length || 0} emails</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Schedule:</span>
                                                        <span className="font-medium">{dayList}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Recipient:</span>
                                                        <span className="font-medium">{lead.email}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}

                                {/* Sequence error display */}
                                {sequenceError && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <div className="font-medium">Cannot start sequence</div>
                                            <div className="text-xs mt-0.5 opacity-80">{sequenceError}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={startingSequence}>Cancel</AlertDialogCancel>
                        <Button onClick={handleStartSequence} disabled={startingSequence || !selectedSequenceId} className="gap-2">
                            {startingSequence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            {startingSequence ? 'Starting...' : 'Start Sequence'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableRow>
    );
}
