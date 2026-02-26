"use client";

import { Lead, LeadStatus } from '@xiri/shared';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
    Building2,
    Calendar,
    Phone,
    Mail,
    MapPin
} from 'lucide-react';

interface LeadRowProps {
    lead: Lead;
    index: number;
    isSelected?: boolean;
    onSelect?: (checked: boolean) => void;
    onRowClick?: (id: string) => void;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
    'new': 'bg-blue-100 text-blue-800 border-blue-200 dark:border-blue-800',
    'contacted': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'qualified': 'bg-green-100 text-green-800 border-green-200',
    'walkthrough': 'bg-purple-100 text-purple-800 dark:text-purple-300 border-purple-200',
    'proposal': 'bg-orange-100 text-orange-800 border-orange-200',
    'quoted': 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 dark:bg-gray-800 text-gray-800 border-gray-200',
    'churned': 'bg-red-100 text-red-800 border-red-200',
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
    'medical_urgent_care': 'Urgent Care',
    'medical_private': 'Private Practice',
    'medical_surgery': 'Surgery Center',
    'medical_dialysis': 'Dialysis',
    'auto_dealer_showroom': 'Auto Dealership',
    'auto_service_center': 'Auto Service',
    'edu_daycare': 'Daycare',
    'edu_private_school': 'Private School',
    'office_general': 'Office',
    'fitness_gym': 'Gym',
    'other': 'Other'
};

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

export function LeadRow({ lead, index, isSelected, onSelect, onRowClick }: LeadRowProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onRowClick && lead.id) {
            onRowClick(lead.id);
        } else {
            router.push(`/sales/crm/${lead.id}`);
        }
    };

    const firstAuditTime = lead.preferredAuditTimes && lead.preferredAuditTimes.length > 0
        ? toDate(lead.preferredAuditTimes[0])
        : null;

    const createdDate = toDate(lead.createdAt);

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

            <TableCell className="cursor-pointer" onClick={handleClick}>
                <div className="flex flex-col gap-1">
                    <div className="font-semibold text-sm">{lead.businessName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                    </div>
                </div>
            </TableCell>

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

            <TableCell className="cursor-pointer" onClick={handleClick}>
                <div className="flex flex-col gap-1">
                    {lead.address && (
                        <div className="text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="line-clamp-2">{lead.address}</span>
                        </div>
                    )}
                    {lead.zipCode && (
                        <div className="text-xs text-muted-foreground">
                            ZIP: {lead.zipCode}
                        </div>
                    )}
                </div>
            </TableCell>

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

            <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                <Badge
                    variant="outline"
                    className={`text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                >
                    {lead.status}
                </Badge>
            </TableCell>

            <TableCell className="text-center cursor-pointer" onClick={handleClick}>
                {lead.attribution?.source && (
                    <div className="text-xs text-muted-foreground">
                        {lead.attribution.source}
                    </div>
                )}
            </TableCell>

            <TableCell className="text-center text-xs text-muted-foreground cursor-pointer" onClick={handleClick}>
                {createdDate && format(createdDate, 'MMM d, yyyy')}
            </TableCell>
        </TableRow>
    );
}
