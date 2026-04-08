"use client";

import { Contact, LeadStatus, FACILITY_TYPE_LABELS } from '@xiri-facility-solutions/shared';
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
import type { ContactRow } from './LeadRow';

interface LeadCardProps {
    lead: ContactRow;
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
    'quoted': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 text-gray-800 border-gray-200',
    'churned': 'bg-red-100 text-red-800 border-red-200',
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
        router.push(`/sales/crm/${lead.companyId}`);
    };

    const fullName = `${lead.firstName} ${lead.lastName}`.trim();
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
                                aria-label="Select contact"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            />
                        )}
                        <div className="flex-1 cursor-pointer" onClick={handleClick}>
                            {/* Contact name — primary */}
                            <h3 className="font-semibold text-base mb-0.5 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                {fullName || 'No name'}
                                {lead.isPrimary && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20">Primary</Badge>
                                )}
                            </h3>
                            {/* Company — secondary */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="w-3 h-3" />
                                {lead.companyName}
                                {lead._companyFacilityType && (
                                    <span className="ml-1">· {FACILITY_TYPE_LABELS[lead._companyFacilityType as keyof typeof FACILITY_TYPE_LABELS] || lead._companyFacilityType}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className={`text-xs font-medium ${STATUS_COLORS[lead._companyStatus]}`}
                    >
                        {lead._companyStatus}
                    </Badge>
                </div>

                <div className="space-y-2 cursor-pointer" onClick={handleClick}>
                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                    </div>

                    {lead.phone && (
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{lead.phone}</span>
                        </div>
                    )}

                    {lead._companyAddress && (
                        <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-muted-foreground">{lead._companyAddress}</span>
                        </div>
                    )}
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                        {lead._companyAttribution?.source && `Source: ${lead._companyAttribution.source}`}
                    </span>
                    <span>
                        {createdDate && format(createdDate, 'MMM d')}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
