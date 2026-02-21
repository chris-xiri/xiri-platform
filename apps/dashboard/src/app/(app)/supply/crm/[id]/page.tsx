'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard, Users, Briefcase, DollarSign,
    ShieldCheck, Activity, ArrowLeft, MoreHorizontal,
    Phone, Mail, MapPin, Globe, Copy, Check, Rocket, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

// Import Sub-components
import VendorContacts from '@/components/vendor/VendorContacts';
import VendorAssignments from '@/components/vendor/VendorAssignments';
import VendorFinancials from '@/components/vendor/VendorFinancials';
import VendorCompliance from '@/components/vendor/VendorCompliance';
import EditVendorDialog from '@/components/vendor/EditVendorDialog';
import VendorStatusTimeline from '@/components/vendor/VendorStatusTimeline';

const LanguageBadge = ({ lang }: { lang?: 'en' | 'es' }) => {
    if (lang === 'es') {
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">🇪🇸 ES</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">🇺🇸 EN</Badge>;
};

interface PageProps {
    params: Promise<{
        id: string;
    }>
}

export default function CRMDetailPage(props: PageProps) {
    const params = React.use(props.params);
    const router = useRouter();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);

    const ONBOARDING_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

    useEffect(() => {

        const docRef = doc(db, 'vendors', params.id);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setVendor({ id: docSnap.id, ...docSnap.data() } as Vendor);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching vendor:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [params.id]);

    if (loading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-[200px] w-full" />
            </div>
        );
    }

    if (!vendor) return <div className="p-8">Vendor not found</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b bg-card shadow-sm z-10">
                <div className="mb-2">
                    <Link href="/supply/crm" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to CRM
                    </Link>
                </div>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                            {vendor.businessName?.charAt(0) || '?'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">{vendor.businessName}</h1>
                                <LanguageBadge lang={vendor.preferredLanguage} />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <select
                                    value={vendor.status}
                                    onChange={async (e) => {
                                        const newStatus = e.target.value;
                                        if (newStatus === vendor.status) return;
                                        try {
                                            await updateDoc(doc(db, 'vendors', vendor.id!), {
                                                status: newStatus,
                                                updatedAt: new Date(),
                                            });
                                        } catch (err) {
                                            console.error('Failed to update status:', err);
                                        }
                                    }}
                                    className="text-xs font-medium px-2 py-1 rounded-md border bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="pending_review">Sourced</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="awaiting_onboarding">Awaiting Form</option>
                                    <option value="compliance_review">Compliance Review</option>
                                    <option value="pending_verification">Verifying Docs</option>
                                    <option value="onboarding_scheduled">Onboarding Call</option>
                                    <option value="ready_for_assignment">✅ Ready</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">⚠️ Suspended</option>
                                    <option value="dismissed">🚫 Dismissed</option>
                                </select>
                                {vendor.outreachStatus && (
                                    <Badge variant="outline" className={
                                        vendor.outreachStatus === 'NEEDS_CONTACT' ? 'border-amber-400 text-amber-600 dark:text-amber-400' :
                                            vendor.outreachStatus === 'ENRICHING' ? 'border-blue-400 text-blue-600 dark:text-blue-400' :
                                                vendor.outreachStatus === 'PENDING' ? 'border-purple-400 text-purple-600 dark:text-purple-400' :
                                                    vendor.outreachStatus === 'SENT' ? 'border-green-400 text-green-600 dark:text-green-400' :
                                                        vendor.outreachStatus === 'FAILED' ? 'border-red-500 text-red-600 dark:text-red-400' :
                                                            vendor.outreachStatus === 'PROFILE_INCOMPLETE' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : ''
                                    }>
                                        {vendor.outreachStatus === 'NEEDS_CONTACT' && <><AlertTriangle className="w-3 h-3 mr-1" /> Needs Contact</>}
                                        {vendor.outreachStatus === 'ENRICHING' && 'Enriching...'}
                                        {vendor.outreachStatus === 'PENDING' && 'Outreach Queued'}
                                        {vendor.outreachStatus === 'SENT' && 'Outreach Sent'}
                                        {vendor.outreachStatus === 'FAILED' && <><AlertTriangle className="w-3 h-3 mr-1" /> Outreach Failed</>}
                                        {vendor.outreachStatus === 'PROFILE_INCOMPLETE' && <><AlertTriangle className="w-3 h-3 mr-1" /> Incomplete Profile</>}
                                    </Badge>
                                )}
                                <span className="text-sm text-muted-foreground border-l pl-2 ml-2 font-mono select-all">ID: {vendor.id}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Copy Onboarding Link */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const link = `${ONBOARDING_BASE_URL}/onboarding/${vendor.id}`;
                                navigator.clipboard.writeText(link);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="h-8 text-xs"
                        >
                            {copied ? <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Onboarding Link</>}
                        </Button>

                        {/* Start Sequence — for NEEDS_CONTACT vendors */}
                        {vendor.outreachStatus === 'NEEDS_CONTACT' && vendor.email && (
                            <Button
                                variant="default"
                                size="sm"
                                disabled={startingSequence}
                                onClick={async () => {
                                    setStartingSequence(true);
                                    try {
                                        // Re-trigger the pipeline by resetting status
                                        const vendorRef = doc(db, 'vendors', vendor.id!);
                                        // Temporarily set to a non-qualified status, then back to qualified
                                        await updateDoc(vendorRef, { status: 'pending_review', outreachStatus: null });
                                        // Small delay to ensure Firestore processes
                                        setTimeout(async () => {
                                            await updateDoc(vendorRef, { status: 'qualified' });
                                            setStartingSequence(false);
                                        }, 500);
                                    } catch (err) {
                                        console.error('Failed to start sequence:', err);
                                        setStartingSequence(false);
                                    }
                                }}
                                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                            >
                                <Rocket className="w-3 h-3 mr-1" /> {startingSequence ? 'Starting...' : 'Start Sequence'}
                            </Button>
                        )}
                        {vendor.outreachStatus === 'NEEDS_CONTACT' && !vendor.email && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="h-8 text-xs border-amber-300 text-amber-600"
                            >
                                <AlertTriangle className="w-3 h-3 mr-1" /> Add email first
                            </Button>
                        )}

                        <EditVendorDialog vendor={vendor} />
                        <Button variant="default">Log Activity</Button>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-auto p-6">
                <VendorStatusTimeline status={vendor.status} />
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="w-4 h-4" /> Overview</TabsTrigger>
                        <TabsTrigger value="contacts" className="gap-2"><Users className="w-4 h-4" /> Contacts</TabsTrigger>
                        <TabsTrigger value="assignments" className="gap-2"><Briefcase className="w-4 h-4" /> Assignments</TabsTrigger>
                        <TabsTrigger value="financials" className="gap-2"><DollarSign className="w-4 h-4" /> Financials</TabsTrigger>
                        <TabsTrigger value="compliance" className="gap-2"><ShieldCheck className="w-4 h-4" /> Compliance</TabsTrigger>
                        <TabsTrigger value="activity" className="gap-2"><Activity className="w-4 h-4" /> Activity</TabsTrigger>
                    </TabsList>

                    {/* TAB: OVERVIEW */}
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Col: Info */}
                            <div className="md:col-span-2 space-y-6">
                                <Card>
                                    <CardHeader><CardTitle>Business Details</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">Address</div>
                                                <div className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                    <div className="text-sm">
                                                        {vendor.streetAddress || vendor.address}<br />
                                                        {[vendor.city, vendor.state].filter(Boolean).join(', ')} {vendor.zip}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">Contact</div>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                                        {vendor.phone ? (
                                                            <a href={`tel:${vendor.phone}`} className="text-primary hover:underline">{vendor.phone}</a>
                                                        ) : <span className="text-muted-foreground">-</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                                        {vendor.email ? (
                                                            <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">{vendor.email}</a>
                                                        ) : <span className="text-muted-foreground">-</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="w-4 h-4 text-muted-foreground" />
                                                        {vendor.website ? (
                                                            <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">{vendor.website}</a>
                                                        ) : <span className="text-muted-foreground">-</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader><CardTitle>Capabilities</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {vendor.capabilities?.map((cap, i) => (
                                                <Badge key={i} variant="secondary">{cap}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Col: Notes */}
                            <div>
                                <Card className="h-full">
                                    <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
                                    <CardContent>
                                        <textarea
                                            className="w-full h-[200px] p-2 text-sm border rounded-md bg-muted/20 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Add internal notes about this vendor..."
                                            defaultValue={vendor.notes || vendor.description || ""}
                                        />
                                        <div className="mt-2 text-right">
                                            <Button size="sm">Save Notes</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB: CONTACTS */}
                    <TabsContent value="contacts">
                        <VendorContacts vendor={vendor} />
                    </TabsContent>

                    {/* TAB: ASSIGNMENTS */}
                    <TabsContent value="assignments">
                        <VendorAssignments vendor={vendor} />
                    </TabsContent>

                    {/* TAB: FINANCIALS */}
                    <TabsContent value="financials">
                        <VendorFinancials vendor={vendor} />
                    </TabsContent>

                    {/* TAB: COMPLIANCE */}
                    <TabsContent value="compliance">
                        <VendorCompliance vendor={vendor} />
                    </TabsContent>
                    <TabsContent value="activity">
                        <div className="p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                            <Activity className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                            <h3 className="font-medium">Activity Log</h3>
                            <p className="text-sm text-muted-foreground">Event timeline coming soon.</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
