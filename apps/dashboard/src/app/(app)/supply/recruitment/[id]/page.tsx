'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Check, X, ExternalLink, MapPin, Phone, Globe, Building2,
    ArrowLeft, AlertTriangle, ShieldCheck, Zap
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: {
        id: string;
    }
}

export default function RecruitmentDetailPage({ params }: PageProps) {
    const router = useRouter();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [websiteError, setWebsiteError] = useState(false);

    useEffect(() => {
        async function fetchVendor() {
            if (!params.id) return;
            try {
                const docRef = doc(db, 'vendors', params.id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setVendor({ id: docSnap.id, ...docSnap.data() } as Vendor);
                }
            } catch (error) {
                console.error("Error fetching vendor:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchVendor();
    }, [params.id]);

    const handleQualification = async (type: 'STANDARD' | 'URGENT' | 'REJECT') => {
        if (!vendor?.id) return;

        let curStatus = 'qualified';
        let updates: any = {
            status: 'qualified',
            updatedAt: serverTimestamp(),
        };

        if (type === 'URGENT') {
            updates.onboardingTrack = 'FAST_TRACK';
            updates.hasActiveContract = true;
        } else if (type === 'STANDARD') {
            updates.onboardingTrack = 'STANDARD';
            updates.hasActiveContract = false;
        } else if (type === 'REJECT') {
            updates.status = 'rejected';
            curStatus = 'rejected';
        }

        try {
            await updateDoc(doc(db, 'vendors', vendor.id), updates);
            router.push('/supply/recruitment');
        } catch (error) {
            console.error("Error updating vendor:", error);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!vendor) return <div className="p-8 flex justify-center">Vendor not found</div>;

    // Helper to get google maps embed url
    const getMapUrl = (address: string) => {
        const query = encodeURIComponent(address);
        // Use embedded map or search
        // For simple iframe without API key for search, we can use:
        // https://www.google.com/maps?q=[query]&output=embed
        return `https://maps.google.com/maps?q=${query}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* LEFT COLUMN: Quick Actions (35%) */}
            <div className="w-[400px] flex-shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
                {/* Header / Back */}
                <div className="p-4 border-b border-border">
                    <Link href="/supply/recruitment" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Queue
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">{vendor.businessName}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant={vendor.status === 'pending_review' ? 'default' : 'secondary'}>
                            {vendor.status?.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">ID: {vendor.id?.slice(0, 6)}</span>
                    </div>
                </div>

                {/* AI Insights */}
                <div className="p-4 space-y-4">
                    <Card className="bg-muted/30 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-500 fill-current" />
                                AI Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">Fit Score</span>
                                <span className={`font-bold ${(vendor.fitScore || 0) > 70 ? 'text-green-600' : 'text-yellow-600'
                                    }`}>{vendor.fitScore || 0}/100</span>
                            </div>
                            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                                "{vendor.aiReasoning || "No AI reasoning available."}"
                            </p>
                            <div className="flex flex-wrap gap-1 mt-3">
                                {vendor.capabilities?.map((cap, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-background">{cap}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Info */}
                    <div className="space-y-3 text-sm border p-3 rounded-lg bg-background">
                        <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                                <div className="font-medium">Address</div>
                                <div className="text-muted-foreground">{vendor.address || "Unknown"}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {vendor.city}, {vendor.state} {vendor.zip}
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{vendor.phone || "No Phone"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
                                {vendor.website || "No Website"}
                            </a>
                        </div>
                    </div>
                </div>

                {/* Qualification Actions */}
                <div className="mt-auto p-4 border-t border-border bg-muted/10 space-y-3">
                    <div className="text-sm font-medium mb-2">Qualification Decision</div>

                    <Button
                        onClick={() => handleQualification('URGENT')}
                        className="w-full bg-red-600 hover:bg-red-700 text-white justify-between"
                    >
                        <span className="flex items-center"><Zap className="w-4 h-4 mr-2" /> Urgent Needs</span>
                        <span className="text-xs opacity-80">Has Job</span>
                    </Button>

                    <Button
                        onClick={() => handleQualification('STANDARD')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-between"
                    >
                        <span className="flex items-center"><ShieldCheck className="w-4 h-4 mr-2" /> Standard Network</span>
                        <span className="text-xs opacity-80">Passive</span>
                    </Button>

                    <Button
                        onClick={() => handleQualification('REJECT')}
                        variant="ghost"
                        className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <X className="w-4 h-4 mr-2" /> Reject Vendor
                    </Button>
                </div>
            </div>

            {/* RIGHT COLUMN: Visual Evidence (65%) */}
            <div className="flex-1 bg-muted/20 flex flex-col h-full overflow-hidden">
                {/* Website View */}
                <div className="flex-1 border-b border-border relative bg-white">
                    <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-medium border border-border">
                        Vendor Website
                    </div>
                    {vendor.website ? (
                        <iframe
                            src={vendor.website}
                            className="w-full h-full border-none"
                            title="Vendor Website"
                            sandbox="allow-scripts allow-same-origin"
                            onError={() => setWebsiteError(true)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
                            <Globe className="w-12 h-12 opacity-20" />
                            <p>No website URL provided</p>
                        </div>
                    )}
                    {websiteError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
                            <div className="text-center">
                                <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                                <p className="font-medium">Cannot embed website</p>
                                <a href={vendor.website} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">
                                    Open in new tab
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Map View */}
                <div className="h-1/3 relative bg-slate-100">
                    <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-medium border border-border">
                        Street View / Map
                    </div>
                    <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={getMapUrl(vendor.address || "")}
                    ></iframe>
                </div>
            </div>
        </div>
    );
}
