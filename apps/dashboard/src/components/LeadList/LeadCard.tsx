"use client";

import { Lead, LeadStatus } from '@xiri/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
    Building2,
    Calendar,
    Phone,
    Mail,
    MapPin,
    User
} from 'lucide-react';

interface LeadCardProps {
    lead: Lead;
    index: number;
    isSelected?: boolean;
    onSelect?: (checked: boolean) => void;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
    'new': 'bg-blue-100 text-blue-800 border-blue-200',
    'contacted': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'qualified': 'bg-green-100 text-green-800 border-green-200',
    'walkthrough': 'bg-purple-100 text-purple-800 border-purple-200',
    'proposal': 'bg-orange-100 text-orange-800 border-orange-200',
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 text-gray-800 border-gray-200'
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

export function LeadCard({ lead, index, isSelected, onSelect }: LeadCardProps) {
    const router = useRouter();

    const handleClick = () => {
        router.push(`/sales/crm/${lead.id}`);
    };

    const firstAuditTime = lead.preferredAuditTimes && lead.preferredAuditTimes.length > 0
        ? toDate(lead.preferredAuditTimes[0])
        : null;

    const createdDate = toDate(lead.createdAt);

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-start gap-3 flex-1">
                        {onSelect && (
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={onSelect}
                                aria-label="Select lead"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            />
                        )}
                        <div className="flex-1 cursor-pointer" onClick={handleClick}>
                            <h3 className="font-semibold text-base mb-1">{lead.businessName}</h3>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="w-3 h-3" />
                                {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                            </div>
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className={`text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                    >
                        {lead.status}
                    </Badge>
                </div>

                <div className="space-y-2 cursor-pointer" onClick={handleClick}>
                    <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span>{lead.contactName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                    </div>

                    {lead.contactPhone && (
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{lead.contactPhone}</span>
                        </div>
                    )}

                    {lead.address && (
                        <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-muted-foreground">{lead.address}</span>
                        </div>
                    )}

                    {firstAuditTime && (
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>
                                {format(firstAuditTime, 'MMM d, yyyy')} at {format(firstAuditTime, 'h:mm a')}
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                        {lead.attribution?.source && `Source: ${lead.attribution.source}`}
                    </span>
                    <span>
                        {createdDate && format(createdDate, 'MMM d')}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
