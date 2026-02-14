'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    X, ExternalLink, MapPin, Phone, Globe,
    ArrowLeft, AlertTriangle, ShieldCheck, Zap
} from 'lucide-react';
import Link from 'next/link';

interface RecruitmentDetailViewProps {
    vendorId: string;
    onClose: () => void;
}

export default function RecruitmentDetailView({ vendorId, onClose }: RecruitmentDetailViewProps) {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [websiteError, setWebsiteError] = useState(false);

    useEffect(() => {
        async function fetchVendor() {
            if (!vendorId) return;
            setLoading(true);
            setWebsiteError(false); // Reset error state on ID change
            try {
                const docRef = doc(db, 'vendors', vendorId);
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
    }, [vendorId]);

    const handleQualification = async (type: 'STANDARD' | 'URGENT' | 'REJECT') => {
        if (!vendor?.id) return;

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
        }

        try {
            await updateDoc(doc(db, 'vendors', vendor.id), updates);
            // Close view or trigger parent refresh
            onClose();
        } catch (error) {
            console.error("Error updating vendor:", error);
        }
    };

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-background border-l border-border p-8">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="h-4 w-32 bg-muted rounded"></div>
                <div className="h-32 w-full max-w-md bg-muted rounded"></div>
            </div>
        </div>
    );

    if (!vendor) return <div className="p-8">Vendor not found</div>;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden">
            {/* ... Header ... */}

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col h-full">

                    {/* Top: Info & Decisions (Moved Up) */}
                    <div className="p-4 space-y-4 bg-muted/5 border-b border-border">
                        {/* AI Section */}
                        <Card className="bg-card border-secondary/20 shadow-sm">
                            <CardHeader className="py-3 px-4 pb-2">
                                <CardTitle className="text-sm font-medium flex justify-between items-center">
                                    <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500 fill-current" /> AI Analysis</span>
                                    <span className={`font-bold ${(vendor.fitScore || 0) > 70 ? 'text-green-600' : 'text-yellow-600'
                                        }`}>{vendor.fitScore || 0}/100</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 pt-0">
                                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2 my-2">
                                    "{vendor.aiReasoning || "No reasoning available."}"
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {vendor.capabilities?.map((cap, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px] h-5">{cap}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Decision Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                                onClick={() => handleQualification('URGENT')}
                                className="bg-purple-600 hover:bg-purple-700 text-white h-auto py-2 flex-col items-start gap-1"
                            >
                                <span className="flex items-center font-bold"><Zap className="w-4 h-4 mr-1fill-current" /> Urgent Needs</span>
                                <span className="text-[10px] opacity-90 font-normal leading-tight">Assign to active job immediately</span>
                            </Button>

                            <Button
                                onClick={() => handleQualification('STANDARD')}
                                className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-2 flex-col items-start gap-1"
                            >
                                <span className="flex items-center font-bold"><ShieldCheck className="w-4 h-4 mr-1" /> Standard Network</span>
                                <span className="text-[10px] opacity-90 font-normal leading-tight">Add to passive supply pool</span>
                            </Button>
                        </div>
                        <Button
                            onClick={() => handleQualification('REJECT')}
                            variant="default" // Changed from ghost to default for solid background
                            size="sm"
                            className="w-full bg-red-600 hover:bg-red-700 text-white h-8 text-xs font-semibold"
                        >
                            <X className="w-3 h-3 mr-1" /> Reject Vendor (Not a fit)
                        </Button>
                    </div>

                    {/* Bottom: Website Preview */}
                    <div className="flex-1 min-h-[400px] relative bg-white group">
                        {vendor.websiteScreenshotUrl ? (
                            // 1. BEST CASE: Screenshot Available
                            <div className="w-full h-full relative cursor-pointer" onClick={() => window.open(vendor.website, '_blank')}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={vendor.websiteScreenshotUrl}
                                    alt={`Preview of ${vendor.businessName}`}
                                    className="w-full h-full object-cover object-top hover:opacity-95 transition-opacity"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none">
                                    <ExternalLink className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                                </div>
                            </div>
                        ) : vendor.website ? (
                            // 2. FALLBACK: Try Iframe (with validation)
                            !websiteError ? (
                                <iframe
                                    src={vendor.website}
                                    className="w-full h-full border-none"
                                    title="Vendor Website"
                                    sandbox="allow-scripts allow-same-origin"
                                    onError={() => setWebsiteError(true)}
                                />
                            ) : (
                                // 3. ERROR STATE: Iframe Blocked
                                <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-3 bg-muted/10 p-6 text-center">
                                    <div className="bg-muted rounded-full p-4">
                                        <Globe className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Preview Unavailable</p>
                                        <p className="text-xs max-w-[200px] mx-auto mt-1">
                                            {vendor.businessName}&apos;s website prevents embedding.
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => window.open(vendor.website, '_blank')}>
                                        <ExternalLink className="w-3 h-3 mr-2" />
                                        Open Website
                                    </Button>
                                </div>
                            )
                        ) : (
                            // 4. NO URL: Empty State
                            <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
                                <Globe className="w-12 h-12 opacity-20" />
                                <p>No website URL provided</p>
                            </div>
                        )}

                        {/* Overlay Label for Context */}
                        <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs border border-border flex items-center gap-1 shadow-sm pointer-events-none z-10">
                            <Globe className="w-3 h-3" />
                            {vendor.websiteScreenshotUrl ? "Live Snapshot" : "Website Preview"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
