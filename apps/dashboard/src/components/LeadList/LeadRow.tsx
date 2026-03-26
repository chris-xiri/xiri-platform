"use client";

import { useState } from 'react';
import { Lead, LeadStatus, LeadType, FACILITY_TYPE_LABELS } from '@xiri-facility-solutions/shared';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
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
} from 'lucide-react';

export type ColumnKey = 'business' | 'type' | 'contact' | 'location' | 'auditTime' | 'status' | 'source' | 'created' | 'actions';

interface LeadRowProps {
    lead: Lead;
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
function getEngagementSignal(lead: Lead) {
    const eng = (lead as any).emailEngagement;
    if (!eng) return null;

    switch (eng.lastEvent) {
        case 'clicked':
            return { icon: MousePointerClick, label: 'Clicked', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
        case 'opened':
            return { icon: MailOpen, label: `Opened${eng.openCount > 1 ? ` ×${eng.openCount}` : ''}`, color: 'text-blue-600 bg-blue-50 border-blue-200' };
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

    const handleClick = () => {
        if (onRowClick && lead.id) {
            onRowClick(lead.id);
        } else {
            router.push(`/sales/dashboard/${lead.id}`);
        }
    };

    const handleStartSequence = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lead.email || !lead.id) return;
        setStartingSequence(true);
        try {
            const startSequence = httpsCallable(functions, 'startLeadSequence');
            await startSequence({ leadId: lead.id });
        } catch (err) {
            console.error('Failed to start sequence:', err);
        } finally {
            setStartingSequence(false);
        }
    };

    const hasActiveSequence = !!(lead as any).sequenceStatus === true || (lead as any).sequenceStep > 0;

    const firstAuditTime = lead.preferredAuditTimes && lead.preferredAuditTimes.length > 0
        ? toDate(lead.preferredAuditTimes[0])
        : null;

    const createdDate = toDate(lead.createdAt);
    const show = (col: ColumnKey) => visibleColumns.has(col);
    const engagement = getEngagementSignal(lead);

    return (
        <TableRow className="hover:bg-muted/50 transition-colors">
            {onSelect && (
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onSelect}
                        aria-label="Select lead"
                    />
                </TableCell>
            )}

            <TableCell
                className="text-center text-xs text-muted-foreground font-mono cursor-pointer"
                onClick={handleClick}
            >
                {index + 1}
            </TableCell>

            {show('business') && (
                <TableCell className="cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col gap-1">
                        <div className="font-semibold text-sm">{lead.businessName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                        </div>
                    </div>
                </TableCell>
            )}

            {show('type') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    {(() => {
                        const lt = lead.leadType || 'direct';
                        const cfg = LEAD_TYPE_CONFIG[lt] || LEAD_TYPE_CONFIG['direct'];
                        return (
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                                {cfg.label}
                            </Badge>
                        );
                    })()}
                </TableCell>
            )}

            {show('contact') && (
                <TableCell className="cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col gap-1">
                        <div className="text-sm">{lead.contactName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                        </div>
                        {lead.contactPhone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {lead.contactPhone}
                            </div>
                        )}
                    </div>
                </TableCell>
            )}

            {show('location') && (
                <TableCell className="cursor-pointer" onClick={handleClick}>
                    <div className="flex flex-col gap-0.5">
                        {lead.address && (
                            <div className="text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="line-clamp-1">{lead.address}</span>
                            </div>
                        )}
                        {(lead.city || lead.state || lead.zip) && (
                            <div className="text-xs text-muted-foreground pl-4">
                                {[lead.city, lead.state].filter(Boolean).join(', ')}{lead.zip ? ` ${lead.zip}` : ''}
                            </div>
                        )}
                        {!lead.address && !lead.city && lead.zipCode && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                ZIP: {lead.zipCode}
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
                            className={`text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                        >
                            {lead.status}
                        </Badge>
                        {engagement && (
                            <div className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${engagement.color}`}>
                                <engagement.icon className="w-3 h-3" />
                                {engagement.label}
                                {(lead as any).emailEngagement?.lastEventAt && (
                                    <span className="opacity-70">{timeAgo((lead as any).emailEngagement.lastEventAt)}</span>
                                )}
                            </div>
                        )}
                    </div>
                </TableCell>
            )}

            {show('source') && (
                <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                    {lead.attribution?.source && (
                        <div className="text-xs text-muted-foreground">
                            {lead.attribution.source}
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
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {(lead as any).outreachStatus && ['PENDING', 'IN_PROGRESS', 'SENT', 'COMPLETED'].includes((lead as any).outreachStatus) ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sequence Active
                        </Badge>
                    ) : lead.email ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            disabled={startingSequence}
                            onClick={handleStartSequence}
                        >
                            {startingSequence
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Rocket className="w-3 h-3" />}
                            {startingSequence ? 'Starting…' : 'Start Sequence'}
                        </Button>
                    ) : (
                        <span className="text-[10px] text-muted-foreground">No email</span>
                    )}
                </TableCell>
            )}
        </TableRow>
    );
}
