'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    Phone, Mail, MapPin, Globe, Copy, Check, Rocket, AlertTriangle,
    Pencil, X, Plus
} from 'lucide-react';
import Link from 'next/link';

// Import Sub-components
import VendorContacts from '@/components/vendor/VendorContacts';
import VendorAssignments from '@/components/vendor/VendorAssignments';
import VendorFinancials from '@/components/vendor/VendorFinancials';
import VendorCompliance from '@/components/vendor/VendorCompliance';
import EditVendorDialog from '@/components/vendor/EditVendorDialog';
import VendorStatusTimeline from '@/components/vendor/VendorStatusTimeline';
import VendorActivityFeed from '@/components/vendor/VendorActivityFeed';
import ScheduleFollowUpDialog from '@/components/vendor/ScheduleFollowUpDialog';

const LanguageBadge = ({ lang }: { lang?: 'en' | 'es' }) => {
    if (lang === 'es') {
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">🇪🇸 ES</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">🇺🇸 EN</Badge>;
};

/**
 * Inline click-to-edit field — click value to edit, Enter/blur to save
 */
const InlineEditField = ({
    vendorId, field, value, icon: Icon, type = 'text', prefix, linkHref,
}: {
    vendorId: string; field: string; value?: string; icon: React.ElementType;
    type?: 'text' | 'email' | 'tel' | 'url'; prefix?: string; linkHref?: string;
}) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (val === (value || '')) { setEditing(false); return; }
        setSaving(true);
        try {
            await updateDoc(doc(db, 'vendors', vendorId), { [field]: val || null, updatedAt: new Date() });
        } catch (e) { console.error('Save failed:', e); }
        setSaving(false);
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                    autoFocus
                    type={type}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
                    onBlur={save}
                    disabled={saving}
                    className="flex-1 text-sm px-2 py-0.5 border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={`Enter ${field}...`}
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditing(true)}>
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            {value ? (
                linkHref ? (
                    <a href={linkHref} onClick={(e) => e.stopPropagation()} target={type === 'url' ? '_blank' : undefined} rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[250px]">
                        {prefix}{value}
                    </a>
                ) : (
                    <span className="text-sm">{prefix}{value}</span>
                )
            ) : (
                <span className="text-sm text-muted-foreground italic">Add {field}...</span>
            )}
            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};

interface PageProps {
    params: Promise<{
        id: string;
    }>
}

export default function CRMDetailPage(props: PageProps) {
    const params = React.use(props.params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);
    const activeDetailTab = searchParams.get('tab') || 'overview';

    const handleDetailTabChange = (tab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (tab === 'overview') {
            params.delete('tab');
        } else {
            params.set('tab', tab);
        }
        router.replace(`?${params.toString()}`, { scroll: false });
    };

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
                    <div className="flex gap-2 items-center flex-wrap">
                        {/* ─── Status-Based Context Actions ─── */}

                        {/* pending_review: Qualify + Dismiss */}
                        {vendor.status === 'pending_review' && (
                            <>
                                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={async () => {
                                        await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'qualified', updatedAt: new Date() });
                                    }}>
                                    <Check className="w-3 h-3 mr-1" /> Qualify
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                        await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'dismissed', updatedAt: new Date() });
                                    }}>
                                    Dismiss
                                </Button>
                            </>
                        )}

                        {/* qualified: Send Outreach + Dismiss */}
                        {vendor.status === 'qualified' && (
                            <>
                                {vendor.email ? (
                                    <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                        disabled={startingSequence}
                                        onClick={async () => {
                                            setStartingSequence(true);
                                            try {
                                                const vendorRef = doc(db, 'vendors', vendor.id!);
                                                await updateDoc(vendorRef, { status: 'pending_review', outreachStatus: null });
                                                setTimeout(async () => {
                                                    await updateDoc(vendorRef, { status: 'qualified' });
                                                    setStartingSequence(false);
                                                }, 500);
                                            } catch (err) {
                                                console.error('Failed to start sequence:', err);
                                                setStartingSequence(false);
                                            }
                                        }}>
                                        <Rocket className="w-3 h-3 mr-1" /> {startingSequence ? 'Starting...' : 'Send Outreach'}
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="outline" disabled className="h-8 text-xs border-amber-300 text-amber-600">
                                        <AlertTriangle className="w-3 h-3 mr-1" /> Add email first
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                        await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'dismissed', updatedAt: new Date() });
                                    }}>
                                    Dismiss
                                </Button>
                            </>
                        )}

                        {/* awaiting_onboarding: Resend Outreach + Copy Onboarding Link */}
                        {vendor.status === 'awaiting_onboarding' && (
                            <>
                                {vendor.email && (
                                    <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                        disabled={startingSequence}
                                        onClick={async () => {
                                            setStartingSequence(true);
                                            try {
                                                await updateDoc(doc(db, 'vendors', vendor.id!), {
                                                    outreachStatus: 'PENDING',
                                                    updatedAt: new Date(),
                                                });
                                                // Enqueue a new GENERATE task
                                                const { addDoc, collection, Timestamp } = await import('firebase/firestore');
                                                await addDoc(collection(db, 'outreach_queue'), {
                                                    vendorId: vendor.id,
                                                    type: 'GENERATE',
                                                    status: 'PENDING',
                                                    scheduledAt: new Date(),
                                                    createdAt: new Date(),
                                                    retryCount: 0,
                                                });
                                                // Log activity
                                                await addDoc(collection(db, 'vendor_activities'), {
                                                    vendorId: vendor.id,
                                                    type: 'OUTREACH_RESENT',
                                                    description: 'Outreach email manually re-queued by staff.',
                                                    createdAt: new Date(),
                                                });
                                                setStartingSequence(false);
                                            } catch (err) {
                                                console.error('Failed to resend outreach:', err);
                                                setStartingSequence(false);
                                            }
                                        }}>
                                        <Mail className="w-3 h-3 mr-1" /> {startingSequence ? 'Resending...' : 'Resend Outreach'}
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" className="h-8 text-xs"
                                    onClick={() => {
                                        const link = `${ONBOARDING_BASE_URL}/onboarding/${vendor.id}`;
                                        navigator.clipboard.writeText(link);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}>
                                    {copied ? <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Onboarding Link</>}
                                </Button>
                            </>
                        )}

                        {/* Enrichment: Skip / Retry when stuck */}
                        {vendor.outreachStatus === 'ENRICHING' && (
                            <>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-amber-300 text-amber-600"
                                    onClick={async () => {
                                        await updateDoc(doc(db, 'vendors', vendor.id!), {
                                            outreachStatus: 'NEEDS_CONTACT',
                                            updatedAt: new Date(),
                                        });
                                    }}>
                                    Skip Enrichment
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-600"
                                    onClick={async () => {
                                        const vendorRef = doc(db, 'vendors', vendor.id!);
                                        await updateDoc(vendorRef, { outreachStatus: null, updatedAt: new Date() });
                                        setTimeout(async () => {
                                            await updateDoc(vendorRef, { status: 'qualified' });
                                        }, 500);
                                    }}>
                                    Retry Enrichment
                                </Button>
                            </>
                        )}

                        {/* NEEDS_CONTACT: Start Sequence (if email added) */}
                        {vendor.outreachStatus === 'NEEDS_CONTACT' && vendor.email && (
                            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                disabled={startingSequence}
                                onClick={async () => {
                                    setStartingSequence(true);
                                    try {
                                        const vendorRef = doc(db, 'vendors', vendor.id!);
                                        await updateDoc(vendorRef, { status: 'pending_review', outreachStatus: null });
                                        setTimeout(async () => {
                                            await updateDoc(vendorRef, { status: 'qualified' });
                                            setStartingSequence(false);
                                        }, 500);
                                    } catch (err) {
                                        console.error('Failed to start sequence:', err);
                                        setStartingSequence(false);
                                    }
                                }}>
                                <Rocket className="w-3 h-3 mr-1" /> {startingSequence ? 'Starting...' : 'Start Sequence'}
                            </Button>
                        )}

                        {/* active: Suspend */}
                        {vendor.status === 'active' && (
                            <Button size="sm" variant="outline" className="h-8 text-xs border-amber-300 text-amber-600"
                                onClick={async () => {
                                    await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'suspended', updatedAt: new Date() });
                                }}>
                                Suspend
                            </Button>
                        )}

                        {/* suspended: Reactivate */}
                        {vendor.status === 'suspended' && (
                            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                onClick={async () => {
                                    await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'active', updatedAt: new Date() });
                                }}>
                                Reactivate
                            </Button>
                        )}

                        {/* ─── Always Visible ─── */}
                        <EditVendorDialog vendor={vendor} />
                        <ScheduleFollowUpDialog vendorId={vendor.id} entityName={vendor.businessName} />
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-auto p-6">
                <VendorStatusTimeline status={vendor.status} />
                <Tabs value={activeDetailTab} onValueChange={handleDetailTabChange} className="space-y-4">
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
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Contact */}
                                            <div className="space-y-3">
                                                <div className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">Contact</div>
                                                <div className="space-y-3 pl-1">
                                                    <InlineEditField vendorId={vendor.id!} field="phone" value={vendor.phone} icon={Phone} type="tel" linkHref={vendor.phone ? `tel:${vendor.phone}` : undefined} />
                                                    <InlineEditField vendorId={vendor.id!} field="email" value={vendor.email} icon={Mail} type="email" linkHref={vendor.email ? `mailto:${vendor.email}` : undefined} />
                                                    <InlineEditField vendorId={vendor.id!} field="website" value={vendor.website} icon={Globe} type="url" linkHref={vendor.website ? (vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`) : undefined} />
                                                </div>
                                            </div>

                                            {/* Address — stacked like a mailing label */}
                                            <div className="space-y-3">
                                                <div className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">Address</div>
                                                <div className="space-y-2 pl-1">
                                                    <InlineEditField vendorId={vendor.id!} field="streetAddress" value={vendor.streetAddress || vendor.address} icon={MapPin} />
                                                    <div className="flex items-center gap-1 pl-6">
                                                        <InlineEditField vendorId={vendor.id!} field="city" value={vendor.city} icon={() => null} />
                                                        <span className="text-muted-foreground">,</span>
                                                        <InlineEditField vendorId={vendor.id!} field="state" value={vendor.state} icon={() => null} />
                                                        <InlineEditField vendorId={vendor.id!} field="zip" value={vendor.zip} icon={() => null} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between">
                                            Capabilities
                                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                                                onClick={() => {
                                                    const cap = prompt('Add capability:');
                                                    if (cap?.trim()) {
                                                        const updated = [...(vendor.capabilities || []), cap.trim()];
                                                        updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: updated, updatedAt: new Date() });
                                                    }
                                                }}>
                                                <Plus className="w-3 h-3" /> Add
                                            </Button>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {vendor.capabilities?.map((cap, i) => (
                                                <Badge key={i} variant="secondary" className="group cursor-pointer" onClick={() => {
                                                    if (confirm(`Remove "${cap}"?`)) {
                                                        const updated = vendor.capabilities!.filter((_, idx) => idx !== i);
                                                        updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: updated, updatedAt: new Date() });
                                                    }
                                                }}>
                                                    {cap}
                                                    <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                                </Badge>
                                            ))}
                                            {(!vendor.capabilities || vendor.capabilities.length === 0) && (
                                                <span className="text-sm text-muted-foreground italic">No capabilities — click Add to start</span>
                                            )}
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
                        <VendorActivityFeed vendorId={vendor.id!} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
