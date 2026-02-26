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
    ArrowLeft, AlertTriangle, ShieldCheck, Zap, Star, Clock, Database,
    BarChart3, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { enrichWithGooglePlaces, type PlacesEnrichment } from '@/lib/googlePlaces';

const LanguageBadge = ({ lang }: { lang?: 'en' | 'es' }) => {
    if (lang === 'es') {
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">🇪🇸 ES</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">🇺🇸 EN</Badge>;
};

// Fit Score Breakdown bar component
const ScoreBar = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => {
    const getColor = (v: number) => {
        if (v >= 80) return 'bg-emerald-500';
        if (v >= 60) return 'bg-blue-500';
        if (v >= 40) return 'bg-yellow-500';
        return 'bg-red-400';
    };
    return (
        <div className="flex items-center gap-2">
            <div className="w-4 flex-shrink-0 text-muted-foreground">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-muted-foreground truncate">{label}</span>
                    <span className="text-[10px] font-semibold tabular-nums">{value}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getColor(value)}`} style={{ width: `${value}%` }} />
                </div>
            </div>
        </div>
    );
};

interface RecruitmentDetailViewProps {
    vendorId: string;
    onClose: () => void;
}

export default function RecruitmentDetailView({ vendorId, onClose }: RecruitmentDetailViewProps) {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [websiteError, setWebsiteError] = useState(false);
    const [placesData, setPlacesData] = useState<PlacesEnrichment | null>(null);
    const [placesLoading, setPlacesLoading] = useState(false);

    useEffect(() => {
        async function fetchVendor() {
            if (!vendorId) return;
            setLoading(true);
            setWebsiteError(false);
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

    // Google Places enrichment — check persisted data first, re-fetch if stale (>7 days)
    useEffect(() => {
        if (!vendor) return;

        // Check if vendor has fresh persisted Google Places data
        const persisted = vendor.googlePlaces;
        if (persisted?.placeId) {
            const enrichedAt = persisted.enrichedAt?.toDate?.() || persisted.enrichedAt;
            const isStale = !enrichedAt || (Date.now() - new Date(enrichedAt).getTime()) > 7 * 24 * 60 * 60 * 1000;
            if (!isStale) {
                // Use persisted data directly
                setPlacesData({
                    name: persisted.name || vendor.businessName,
                    rating: persisted.rating,
                    ratingCount: persisted.ratingCount,
                    phone: persisted.phone,
                    website: persisted.website,
                    types: persisted.types,
                    openNow: persisted.openNow,
                    googleMapsUrl: persisted.googleMapsUrl,
                    photoUrls: persisted.photoUrls,
                } as PlacesEnrichment);
                return;
            }
        }

        if (!vendor.address && !vendor.city && !vendor.businessName) return;
        setPlacesLoading(true);
        setPlacesData(null);
        enrichWithGooglePlaces(vendor.address, vendor.city, vendor.state, vendor.businessName)
            .then(async (data) => {
                setPlacesData(data);
                // Persist enrichment to Firestore for future loads
                if (data && vendor.id) {
                    try {
                        await updateDoc(doc(db, 'vendors', vendor.id), {
                            googlePlaces: {
                                placeId: data.placeId || null,
                                name: data.name || null,
                                rating: data.rating || null,
                                ratingCount: data.ratingCount || null,
                                phone: data.phone || null,
                                website: data.website || null,
                                types: data.types || [],
                                openNow: data.openNow ?? null,
                                photoUrls: data.photoUrls || [],
                                googleMapsUrl: data.googleMapsUrl || null,
                                enrichedAt: serverTimestamp(),
                            },
                            // Also update top-level rating fields
                            ...(data.rating ? { rating: data.rating } : {}),
                            ...(data.ratingCount ? { totalRatings: data.ratingCount } : {}),
                            updatedAt: serverTimestamp(),
                        });
                    } catch (err) {
                        console.warn('Failed to persist Places data:', err);
                    }
                }
            })
            .catch(err => console.error('Places enrichment failed:', err))
            .finally(() => setPlacesLoading(false));
    }, [vendor?.id, vendor?.address, vendor?.city, vendor?.state, vendor?.businessName]);

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

    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const addressStr = vendor.address
        ? `${vendor.address}, ${vendor.city || ''}, ${vendor.state || ''}`
        : `${vendor.businessName || ''} ${vendor.city || ''}, ${vendor.state || ''}`;
    const uriEncodedAddress = encodeURIComponent(addressStr);
    const streetViewUrl = mapsApiKey && uriEncodedAddress ? `https://maps.googleapis.com/maps/api/streetview?size=400x160&location=${uriEncodedAddress}&key=${mapsApiKey}` : null;
    const mapUrl = mapsApiKey && uriEncodedAddress ? `https://maps.googleapis.com/maps/api/staticmap?center=${uriEncodedAddress}&zoom=15&size=400x160&markers=color:red%7C${uriEncodedAddress}&key=${mapsApiKey}` : null;

    return (
        <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">
                        {placesData?.name || vendor.businessName}
                    </h3>
                    {placesData?.name && vendor.businessName &&
                        placesData.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== vendor.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                                Registered as: {vendor.businessName}
                            </p>
                        )}
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                            {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.address || 'N/A'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Street View + Map Strip */}
            {mapsApiKey && streetViewUrl && mapUrl && (
                <div className="grid grid-cols-2 h-28 flex-shrink-0 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={streetViewUrl} alt="Street view" className="w-full h-full object-cover border-r border-background/20" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mapUrl} alt="Map view" className="w-full h-full object-cover" />
                </div>
            )}

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4 bg-muted/5">

                    {/* AI Analysis Section */}
                    <Card className="bg-card border-secondary/20 shadow-sm">
                        <CardHeader className="py-3 px-4 pb-2">
                            <CardTitle className="text-sm font-medium flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-500 fill-current" />
                                    AI Analysis
                                </span>
                                <div className="flex items-center gap-2">
                                    <LanguageBadge lang={vendor.preferredLanguage} />
                                    <span className={`font-bold ${(vendor.fitScore || 0) > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {vendor.fitScore || 0}/100
                                    </span>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 pt-0">
                            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2 my-2">
                                &ldquo;{vendor.aiReasoning || "No reasoning available."}&rdquo;
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {vendor.capabilities?.map((cap, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px] h-5">{cap}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Fit Score Breakdown */}
                    {vendor.fitScoreBreakdown && (
                        <Card className="bg-card border-secondary/20 shadow-sm">
                            <CardHeader className="py-2 px-4 pb-1">
                                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                    Score Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 pt-1 space-y-1.5">
                                <ScoreBar label="Google Reputation" value={vendor.fitScoreBreakdown.googleReputation} icon={<Star className="w-3 h-3" />} />
                                <ScoreBar label="Service Alignment" value={vendor.fitScoreBreakdown.serviceAlignment} icon={<ShieldCheck className="w-3 h-3" />} />
                                <ScoreBar label="Location" value={vendor.fitScoreBreakdown.locationScore} icon={<MapPin className="w-3 h-3" />} />
                                <ScoreBar label="Business Maturity" value={vendor.fitScoreBreakdown.businessMaturity} icon={<TrendingUp className="w-3 h-3" />} />
                                <ScoreBar label="Website Quality" value={vendor.fitScoreBreakdown.websiteQuality} icon={<Globe className="w-3 h-3" />} />
                            </CardContent>
                        </Card>
                    )}

                    {/* Google Business Card */}
                    {placesLoading && (
                        <Card className="bg-card border-secondary/20 shadow-sm">
                            <CardContent className="px-4 py-3 space-y-2">
                                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                                <div className="h-2 w-48 bg-muted rounded animate-pulse" />
                                <div className="h-2 w-24 bg-muted rounded animate-pulse" />
                            </CardContent>
                        </Card>
                    )}

                    {placesData && (
                        <Card className="bg-card border-info-border shadow-sm">
                            <CardHeader className="py-2 px-4 pb-1">
                                <CardTitle className="text-xs font-medium flex justify-between items-center">
                                    <span className="flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-info" /> Google Business
                                    </span>
                                    {placesData.openNow !== undefined && (
                                        <Badge variant="default" className={`text-[9px] px-1.5 h-4 ${placesData.openNow ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                            {placesData.openNow ? 'Open Now' : 'Closed'}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 pt-0 space-y-2">
                                {/* Rating */}
                                {(placesData.rating || vendor.rating) && (
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map(star => {
                                                const rating = placesData.rating || vendor.rating || 0;
                                                return <Star key={star} className={`w-3 h-3 ${star <= Math.round(rating) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />;
                                            })}
                                        </div>
                                        <span className="font-medium">{placesData.rating || vendor.rating}</span>
                                        {(placesData.ratingCount || vendor.totalRatings) && (
                                            <span className="text-muted-foreground">({(placesData.ratingCount || vendor.totalRatings)?.toLocaleString()} reviews)</span>
                                        )}
                                    </div>
                                )}

                                {/* Links */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {(placesData.phone || vendor.phone) && (
                                        <a href={`tel:${placesData.phone || vendor.phone}`} className="flex items-center gap-1 text-xs text-info hover:underline">
                                            <Phone className="w-3 h-3 flex-shrink-0" /> {placesData.phone || vendor.phone}
                                        </a>
                                    )}
                                    {(placesData.website || vendor.website) && (
                                        <a href={placesData.website || vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-info hover:underline">
                                            <Globe className="w-3 h-3 flex-shrink-0" /> Website
                                        </a>
                                    )}
                                    {(placesData.googleMapsUrl) && (
                                        <a href={placesData.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-info hover:underline">
                                            <MapPin className="w-3 h-3 flex-shrink-0" /> Open in Maps
                                        </a>
                                    )}
                                </div>

                                {/* Hours */}
                                {placesData.weekdayHours && placesData.weekdayHours.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border">
                                        <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Hours
                                        </div>
                                        <div className="grid grid-cols-1 gap-0.5 ml-5">
                                            {placesData.weekdayHours.map((hourStr, i) => {
                                                const [day, ...times] = hourStr.split(':');
                                                const isToday = i === ((new Date().getDay() + 6) % 7);
                                                return (
                                                    <div key={i} className={`flex justify-between text-[10px] ${isToday ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                                        <span>{day}:</span>
                                                        <span>{times.join(':').trim()}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Google Photos */}
                                {placesData.photoUrls && placesData.photoUrls.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border">
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                            {placesData.photoUrls.map((url, i) => (
                                                <a key={i} href={placesData.googleMapsUrl || placesData.website || '#'} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt="Business photo" className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Fallback for Phone/Web if no Places data */}
                    {!placesLoading && !placesData && (vendor.phone || vendor.website) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-card p-3 rounded-md border border-border shadow-sm text-xs">
                            {vendor.phone && (
                                <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 text-info hover:underline">
                                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {vendor.phone}
                                </a>
                            )}
                            {vendor.website && (
                                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-info hover:underline">
                                    <Globe className="w-3.5 h-3.5 flex-shrink-0" /> Website
                                </a>
                            )}
                        </div>
                    )}

                    {/* Decision Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                            onClick={() => handleQualification('URGENT')}
                            className="bg-purple-600 hover:bg-purple-700 text-white h-auto py-2 flex-col items-start gap-1"
                        >
                            <span className="flex items-center font-bold"><Zap className="w-4 h-4 mr-1 fill-current" /> Urgent Needs</span>
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
                        variant="default"
                        size="sm"
                        className="w-full bg-red-600 hover:bg-red-700 text-white h-8 text-xs font-semibold"
                    >
                        <X className="w-3 h-3 mr-1" /> Reject Vendor (Not a fit)
                    </Button>
                </div>

                {/* Website Preview */}
                <div className="min-h-[400px] relative bg-white group">
                    {vendor.websiteScreenshotUrl ? (
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
                        !websiteError ? (
                            <iframe
                                src={vendor.website}
                                className="w-full h-full border-none"
                                title="Vendor Website"
                                sandbox="allow-scripts allow-same-origin"
                                onError={() => setWebsiteError(true)}
                            />
                        ) : (
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
                        <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
                            <Globe className="w-12 h-12 opacity-20" />
                            <p>No website URL provided</p>
                        </div>
                    )}

                    {/* Overlay Label */}
                    <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs border border-border flex items-center gap-1 shadow-sm pointer-events-none z-10">
                        <Globe className="w-3 h-3" />
                        {vendor.websiteScreenshotUrl ? "Live Snapshot" : "Website Preview"}
                    </div>
                </div>
            </div>
        </div>
    );
}
