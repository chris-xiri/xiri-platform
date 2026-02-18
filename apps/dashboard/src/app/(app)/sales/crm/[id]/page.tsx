"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lead } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';

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
    'won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'lost': 'bg-gray-100 text-gray-800 border-gray-200'
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

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        fetchLead();
    }, [leadId, router]);

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

    if (!lead) {
        return null;
    }

    const createdDate = toDate(lead.createdAt);

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/sales/crm')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to CRM
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">{lead.businessName}</h1>
                            <p className="text-muted-foreground">
                                {FACILITY_TYPE_LABELS[lead.facilityType] || lead.facilityType}
                            </p>
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className={`text-sm font-medium ${STATUS_COLORS[lead.status]}`}
                    >
                        {lead.status}
                    </Badge>
                </div>

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

                    {/* Right Column - Attribution & Meta */}
                    <div className="space-y-4">
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
            </div>
        </ProtectedRoute>
    );
}
