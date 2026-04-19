'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Search, Building2, MapPin, Users, Globe, ChevronRight, Loader2
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useFacilityTypes } from '@/lib/facilityTypes';
import type { LeadStatus } from '@xiri-facility-solutions/shared';

interface CompanyRow {
    id: string;
    companyId: string;
    businessName: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    facilityType?: string;
    leadType?: string;
    companyStage?: LeadStatus;
    phone?: string;
    totalContactCount?: number;
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-purple-100 text-purple-700',
    walkthrough: 'bg-indigo-100 text-indigo-700',
    proposal: 'bg-orange-100 text-orange-700',
    quoted: 'bg-pink-100 text-pink-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    active: 'bg-green-100 text-green-700',
    churned: 'bg-gray-100 text-gray-600',
};

function sortCompanies(companies: CompanyRow[]): CompanyRow[] {
    return [...companies].sort((a, b) => a.businessName.localeCompare(b.businessName));
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<CompanyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const { facilityTypeLabels } = useFacilityTypes();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'crm_company_rows'), (snap) => {
            const list: CompanyRow[] = [];
            snap.forEach((d) => {
                const data = d.data() as any;
                list.push({
                    id: d.id,
                    companyId: data.companyId || d.id,
                    businessName: data.businessName || 'Unknown',
                    website: data.website,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    zip: data.zip,
                    facilityType: data.facilityType,
                    leadType: data.leadType,
                    companyStage: data.companyStage || 'new',
                    phone: data.phone,
                    totalContactCount: typeof data.totalContactCount === 'number' ? data.totalContactCount : 0,
                });
            });
            setCompanies(sortCompanies(list));
            setLoading(false);
            setLoadError(null);
        }, (error) => {
            console.error('Failed to load companies:', error);
            setLoadError('Could not load companies.');
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        companies.forEach((c) => {
            const stage = c.companyStage || 'new';
            counts[stage] = (counts[stage] || 0) + 1;
        });
        return counts;
    }, [companies]);

    const filtered = useMemo(() => {
        let result = companies;

        if (statusFilter !== 'all') {
            result = result.filter((c) => (c.companyStage || 'new') === statusFilter);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((c) =>
                c.businessName?.toLowerCase().includes(q) ||
                c.address?.toLowerCase().includes(q) ||
                c.city?.toLowerCase().includes(q) ||
                c.state?.toLowerCase().includes(q) ||
                c.facilityType?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [companies, search, statusFilter]);

    const STATUS_BADGES: { value: string; label: string; color: string }[] = [
        { value: 'all', label: 'All', color: 'bg-secondary text-secondary-foreground' },
        { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
        { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
        { value: 'walkthrough', label: 'Walkthrough', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'proposal', label: 'Proposal', color: 'bg-orange-100 text-orange-700' },
        { value: 'quoted', label: 'Quoted', color: 'bg-pink-100 text-pink-700' },
        { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
        { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
        { value: 'churned', label: 'Churned', color: 'bg-gray-100 text-gray-600' },
    ];

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Companies</h1>
                        <p className="text-muted-foreground">
                            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {STATUS_BADGES.map((s) => {
                        const count = s.value === 'all' ? companies.length : (statusCounts[s.value] || 0);
                        if (s.value !== 'all' && count === 0) return null;
                        const isActive = statusFilter === s.value;
                        return (
                            <button
                                key={s.value}
                                onClick={() => setStatusFilter(s.value)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                                    ${isActive
                                        ? `${s.color} ring-2 ring-offset-1 ring-primary/30 shadow-sm`
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                {s.label}
                                <span className={`tabular-nums text-[10px] ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, address, or type..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="text-sm">Loading companies...</p>
                        </div>
                    ) : loadError ? (
                        <div className="flex flex-col items-center justify-center py-20 text-destructive gap-3">
                            <Building2 className="w-12 h-12 opacity-40" />
                            <p className="font-medium text-lg">{loadError}</p>
                            <p className="text-sm text-muted-foreground">Run CRM row rebuild to repopulate company rows if needed.</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Building2 className="w-12 h-12 opacity-40" />
                            <p className="font-medium text-lg">No companies found</p>
                            <p className="text-sm">
                                {search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Companies will appear here once CRM rows are projected.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filtered.map((company) => (
                                <Link key={company.id} href={`/sales/crm/${company.companyId || company.id}`}>
                                    <CompanyCard
                                        company={company}
                                        contactCount={company.totalContactCount || 0}
                                        facilityTypeLabels={facilityTypeLabels}
                                    />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}

function CompanyCard({ company, contactCount, facilityTypeLabels }: { company: CompanyRow; contactCount: number; facilityTypeLabels: Record<string, string> }) {
    const facilityLabel = company.facilityType ? (facilityTypeLabels[company.facilityType] || company.facilityType) : '';
    const location = [company.address, company.city, company.state].filter(Boolean).join(', ');
    const statusValue = company.companyStage || 'new';
    const statusClass = STATUS_COLORS[statusValue] || 'bg-gray-100 text-gray-600';

    return (
        <div className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 hover:shadow-sm transition-all cursor-pointer">
            <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm truncate">{company.businessName}</h3>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
                        {statusValue}
                    </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {location && (
                        <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" /> {location}
                        </span>
                    )}
                    {facilityLabel && (
                        <span className="truncate">{facilityLabel}</span>
                    )}
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</span>
            </div>

            {company.website && (
                <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={company.website}
                >
                    <Globe className="w-4 h-4" />
                </a>
            )}

            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
    );
}
