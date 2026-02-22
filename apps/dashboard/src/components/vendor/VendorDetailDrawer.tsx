'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri/shared';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard, Users, Briefcase, DollarSign,
    ShieldCheck, Activity, Phone, Mail, MapPin, Globe,
    Copy, Check, Rocket, AlertTriangle, Pencil, X, Plus, MoreHorizontal
} from 'lucide-react';

import VendorContacts from '@/components/vendor/VendorContacts';
import VendorAssignments from '@/components/vendor/VendorAssignments';
import VendorFinancials from '@/components/vendor/VendorFinancials';
import VendorCompliance from '@/components/vendor/VendorCompliance';
import EditVendorDialog from '@/components/vendor/EditVendorDialog';
import VendorStatusTimeline from '@/components/vendor/VendorStatusTimeline';
import VendorActivityFeed from '@/components/vendor/VendorActivityFeed';
import ScheduleFollowUpDialog from '@/components/vendor/ScheduleFollowUpDialog';

const LanguageBadge = ({ lang }: { lang?: 'en' | 'es' }) => {
    if (lang === 'es') return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">🇪🇸 ES</Badge>;
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">🇺🇸 EN</Badge>;
};

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
                    autoFocus type={type} value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
                    onBlur={save} disabled={saving}
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
                ) : <span className="text-sm">{prefix}{value}</span>
            ) : <span className="text-sm text-muted-foreground italic">Add {field}...</span>}
            <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};

interface VendorDetailDrawerProps {
    vendorId: string | null;
    open: boolean;
    onClose: () => void;
}

export default function VendorDetailDrawer({ vendorId, open, onClose }: VendorDetailDrawerProps) {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [startingSequence, setStartingSequence] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const ONBOARDING_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

    useEffect(() => {
        if (!vendorId || !open) { setVendor(null); setLoading(true); return; }
        setLoading(true);
        setActiveTab('overview');
        const unsubscribe = onSnapshot(doc(db, 'vendors', vendorId), (snap) => {
            if (snap.exists()) setVendor({ id: snap.id, ...snap.data() } as Vendor);
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribe();
    }, [vendorId, open]);

    return (
        <Sheet open={open} onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
            <SheetContent className="w-full sm:max-w-[680px] overflow-y-auto p-0" side="right">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                ) : !vendor ? (
                    <div className="p-6 text-muted-foreground">Vendor not found</div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 bg-card border-b px-5 py-4 z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                                    {vendor.businessName?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <SheetTitle className="text-lg truncate">{vendor.businessName}</SheetTitle>
                                        <LanguageBadge lang={vendor.preferredLanguage} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <select
                                            value={vendor.status}
                                            onChange={async (e) => {
                                                try { await updateDoc(doc(db, 'vendors', vendor.id!), { status: e.target.value, updatedAt: new Date() }); }
                                                catch (err) { console.error('Failed:', err); }
                                            }}
                                            className="text-xs font-medium px-2 py-0.5 rounded border bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
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
                                                vendor.outreachStatus === 'SENT' ? 'border-green-400 text-green-600' :
                                                    vendor.outreachStatus === 'FAILED' ? 'border-red-500 text-red-600' :
                                                        vendor.outreachStatus === 'PENDING' ? 'border-purple-400 text-purple-600' :
                                                            vendor.outreachStatus === 'NEEDS_CONTACT' ? 'border-amber-400 text-amber-600' :
                                                                vendor.outreachStatus === 'ENRICHING' ? 'border-blue-400 text-blue-600' : ''
                                            }>
                                                {vendor.outreachStatus === 'SENT' && 'Outreach Sent'}
                                                {vendor.outreachStatus === 'FAILED' && <><AlertTriangle className="w-3 h-3 mr-1" /> Failed</>}
                                                {vendor.outreachStatus === 'PENDING' && 'Queued'}
                                                {vendor.outreachStatus === 'NEEDS_CONTACT' && <><AlertTriangle className="w-3 h-3 mr-1" /> Needs Contact</>}
                                                {vendor.outreachStatus === 'ENRICHING' && 'Enriching...'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick actions */}
                            <div className="flex gap-2 flex-wrap">
                                {vendor.status === 'pending_review' && (
                                    <>
                                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                            onClick={async () => { await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'qualified', updatedAt: new Date() }); }}>
                                            <Check className="w-3 h-3 mr-1" /> Qualify
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                            onClick={async () => { await updateDoc(doc(db, 'vendors', vendor.id!), { status: 'dismissed', updatedAt: new Date() }); }}>
                                            Dismiss
                                        </Button>
                                    </>
                                )}
                                {vendor.status === 'qualified' && vendor.email && (
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={startingSequence}
                                        onClick={async () => {
                                            setStartingSequence(true);
                                            try {
                                                const ref = doc(db, 'vendors', vendor.id!);
                                                await updateDoc(ref, { status: 'pending_review', outreachStatus: null });
                                                setTimeout(async () => { await updateDoc(ref, { status: 'qualified' }); setStartingSequence(false); }, 500);
                                            } catch { setStartingSequence(false); }
                                        }}>
                                        <Rocket className="w-3 h-3 mr-1" /> {startingSequence ? 'Starting...' : 'Send Outreach'}
                                    </Button>
                                )}
                                {vendor.status === 'awaiting_onboarding' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${ONBOARDING_BASE_URL}/onboarding/${vendor.id}`);
                                            setCopied(true); setTimeout(() => setCopied(false), 2000);
                                        }}>
                                        {copied ? <><Check className="w-3 h-3 mr-1 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Onboarding Link</>}
                                    </Button>
                                )}
                                <EditVendorDialog vendor={vendor} />
                                <ScheduleFollowUpDialog vendorId={vendor.id} entityName={vendor.businessName} />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            <VendorStatusTimeline status={vendor.status} />
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
                                <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                                    <TabsTrigger value="overview" className="gap-1 text-xs"><LayoutDashboard className="w-3.5 h-3.5" /> Overview</TabsTrigger>
                                    <TabsTrigger value="contacts" className="gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Contacts</TabsTrigger>
                                    <TabsTrigger value="assignments" className="gap-1 text-xs"><Briefcase className="w-3.5 h-3.5" /> Jobs</TabsTrigger>
                                    <TabsTrigger value="financials" className="gap-1 text-xs"><DollarSign className="w-3.5 h-3.5" /> Financial</TabsTrigger>
                                    <TabsTrigger value="compliance" className="gap-1 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Compliance</TabsTrigger>
                                    <TabsTrigger value="activity" className="gap-1 text-xs"><Activity className="w-3.5 h-3.5" /> Activity</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <Card>
                                        <CardHeader className="py-3"><CardTitle className="text-sm">Business Details</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2.5">
                                                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Contact</div>
                                                    <div className="space-y-2 pl-1">
                                                        <InlineEditField vendorId={vendor.id!} field="phone" value={vendor.phone} icon={Phone} type="tel" linkHref={vendor.phone ? `tel:${vendor.phone}` : undefined} />
                                                        <InlineEditField vendorId={vendor.id!} field="email" value={vendor.email} icon={Mail} type="email" linkHref={vendor.email ? `mailto:${vendor.email}` : undefined} />
                                                        <InlineEditField vendorId={vendor.id!} field="website" value={vendor.website} icon={Globe} type="url" linkHref={vendor.website ? (vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`) : undefined} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Address</div>
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
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                Capabilities
                                                <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                                                    onClick={() => {
                                                        const cap = prompt('Add capability:');
                                                        if (cap?.trim()) {
                                                            updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: [...(vendor.capabilities || []), cap.trim()], updatedAt: new Date() });
                                                        }
                                                    }}>
                                                    <Plus className="w-3 h-3" /> Add
                                                </Button>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1.5">
                                                {vendor.capabilities?.map((cap, i) => (
                                                    <Badge key={i} variant="secondary" className="group cursor-pointer text-xs" onClick={() => {
                                                        if (confirm(`Remove "${cap}"?`)) {
                                                            updateDoc(doc(db, 'vendors', vendor.id!), { capabilities: vendor.capabilities!.filter((_, idx) => idx !== i), updatedAt: new Date() });
                                                        }
                                                    }}>
                                                        {cap}
                                                        <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                                    </Badge>
                                                ))}
                                                {(!vendor.capabilities || vendor.capabilities.length === 0) && (
                                                    <span className="text-xs text-muted-foreground italic">No capabilities — click Add</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="contacts"><VendorContacts vendor={vendor} /></TabsContent>
                                <TabsContent value="assignments"><VendorAssignments vendor={vendor} /></TabsContent>
                                <TabsContent value="financials"><VendorFinancials vendor={vendor} /></TabsContent>
                                <TabsContent value="compliance"><VendorCompliance vendor={vendor} /></TabsContent>
                                <TabsContent value="activity"><VendorActivityFeed vendorId={vendor.id!} /></TabsContent>
                            </Tabs>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
