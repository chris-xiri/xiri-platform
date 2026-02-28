'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MapPin, Users, ArrowUpRight, TrendingUp, Loader2, RefreshCw, Clock, Mail, Building2 } from 'lucide-react';

interface WaitlistVisit {
    zipCode: string | null;
    referrer: string | null;
    url: string | null;
    createdAt: Timestamp | null;
}

interface WaitlistSubmission {
    email: string;
    businessName: string | null;
    facilityType: string | null;
    estimatedSqft: number | null;
    zipCode: string | null;
    createdAt: Timestamp | null;
}

interface ZipCodeAgg {
    zipCode: string;
    visits: number;
    submissions: number;
    lastVisit: Date | null;
    facilityTypes: string[];
    businessNames: string[];
}

const FACILITY_TYPE_LABELS: Record<string, string> = {
    medical: 'Medical Office',
    urgent_care: 'Urgent Care',
    surgery_center: 'Surgery Center',
    auto_dealership: 'Auto Dealership',
    daycare: 'Daycare / Preschool',
    other: 'Other',
};

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [visits, setVisits] = useState<WaitlistVisit[]>([]);
    const [submissions, setSubmissions] = useState<WaitlistSubmission[]>([]);
    const [zipAggregations, setZipAggregations] = useState<ZipCodeAgg[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch visits
            const visitsSnap = await getDocs(query(collection(db, 'waitlist_visits'), orderBy('createdAt', 'desc')));
            const visitsData = visitsSnap.docs.map(d => d.data() as WaitlistVisit);
            setVisits(visitsData);

            // Fetch submissions
            const subsSnap = await getDocs(query(collection(db, 'waitlist'), orderBy('createdAt', 'desc')));
            const subsData = subsSnap.docs.map(d => d.data() as WaitlistSubmission);
            setSubmissions(subsData);

            // Aggregate by zip code
            const zipMap = new Map<string, ZipCodeAgg>();

            for (const v of visitsData) {
                const zip = v.zipCode || 'Unknown';
                if (!zipMap.has(zip)) {
                    zipMap.set(zip, { zipCode: zip, visits: 0, submissions: 0, lastVisit: null, facilityTypes: [], businessNames: [] });
                }
                const agg = zipMap.get(zip)!;
                agg.visits++;
                const visitDate = v.createdAt?.toDate?.() || null;
                if (visitDate && (!agg.lastVisit || visitDate > agg.lastVisit)) {
                    agg.lastVisit = visitDate;
                }
            }

            for (const s of subsData) {
                const zip = s.zipCode || 'Unknown';
                if (!zipMap.has(zip)) {
                    zipMap.set(zip, { zipCode: zip, visits: 0, submissions: 0, lastVisit: null, facilityTypes: [], businessNames: [] });
                }
                const agg = zipMap.get(zip)!;
                agg.submissions++;
                if (s.facilityType && !agg.facilityTypes.includes(s.facilityType)) {
                    agg.facilityTypes.push(s.facilityType);
                }
                if (s.businessName && !agg.businessNames.includes(s.businessName)) {
                    agg.businessNames.push(s.businessName);
                }
                const subDate = s.createdAt?.toDate?.() || null;
                if (subDate && (!agg.lastVisit || subDate > agg.lastVisit)) {
                    agg.lastVisit = subDate;
                }
            }

            // Sort by visits desc
            const sorted = Array.from(zipMap.values()).sort((a, b) => (b.visits + b.submissions) - (a.visits + a.submissions));
            setZipAggregations(sorted);
        } catch (err) {
            console.error('Failed to fetch report data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const totalVisits = visits.length;
    const totalSubmissions = submissions.length;
    const conversionRate = totalVisits > 0 ? ((totalSubmissions / totalVisits) * 100).toFixed(1) : '0';
    const uniqueZips = new Set(visits.map(v => v.zipCode).filter(Boolean)).size;

    const formatDate = (d: Date | null) => {
        if (!d) return '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Market Reports</h1>
                    <p className="text-sm text-muted-foreground mt-1">Track waitlist demand to identify expansion opportunities</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-card border rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Page Visits</span>
                            </div>
                            <p className="text-3xl font-bold">{totalVisits}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-green-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Form Submissions</span>
                            </div>
                            <p className="text-3xl font-bold">{totalSubmissions}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-amber-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Conversion Rate</span>
                            </div>
                            <p className="text-3xl font-bold">{conversionRate}%</p>
                        </div>
                        <div className="bg-card border rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-purple-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Unique ZIP Codes</span>
                            </div>
                            <p className="text-3xl font-bold">{uniqueZips}</p>
                        </div>
                    </div>

                    {/* ZIP Code Demand Table */}
                    <div className="bg-card border rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" />
                                Demand by ZIP Code
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">Where potential clients are looking for service — ranked by interest</p>
                        </div>

                        {zipAggregations.length === 0 ? (
                            <div className="px-6 py-12 text-center text-muted-foreground">
                                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No waitlist data yet</p>
                                <p className="text-sm mt-1">Visits and submissions will appear here as users interact with the waitlist page</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">ZIP Code</th>
                                            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Visits</th>
                                            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Submissions</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Facility Types</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Businesses</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Activity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {zipAggregations.map((agg, i) => (
                                            <tr key={agg.zipCode} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i === 0 ? 'bg-primary/5' : ''}`}>
                                                <td className="px-6 py-3">
                                                    <span className="font-mono font-bold text-base">{agg.zipCode}</span>
                                                    {i === 0 && (
                                                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                                            Top Market
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-medium text-xs">
                                                        <Users className="w-3 h-3" />
                                                        {agg.visits}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    {agg.submissions > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium text-xs">
                                                            <Mail className="w-3 h-3" />
                                                            {agg.submissions}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {agg.facilityTypes.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {agg.facilityTypes.map(ft => (
                                                                <span key={ft} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                                                    {FACILITY_TYPE_LABELS[ft] || ft}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {agg.businessNames.length > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            {agg.businessNames.map(bn => (
                                                                <span key={bn} className="text-xs flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3 text-muted-foreground" />
                                                                    {bn}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 text-xs">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(agg.lastVisit)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Recent Submissions Detail */}
                    {submissions.length > 0 && (
                        <div className="bg-card border rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-green-500" />
                                    Waitlist Submissions
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">People who signed up to be notified — warm leads for expansion</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Email</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Business</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Facility Type</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sq Ft</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">ZIP</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {submissions.map((s, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                                <td className="px-6 py-3 font-medium">{s.email}</td>
                                                <td className="px-4 py-3">{s.businessName || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {s.facilityType ? (
                                                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                                            {FACILITY_TYPE_LABELS[s.facilityType] || s.facilityType}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3">{s.estimatedSqft ? s.estimatedSqft.toLocaleString() : '—'}</td>
                                                <td className="px-4 py-3 font-mono">{s.zipCode || '—'}</td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(s.createdAt?.toDate?.() || null)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
