'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Plus, Search, Building2, MapPin, Users, Globe, Phone,
    Mail, ChevronRight, ExternalLink, Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { FACILITY_TYPE_OPTIONS } from '@xiri-facility-solutions/shared';

interface Company {
    id: string;
    businessName: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    facilityType?: string;
    leadType?: string;
    status?: string;
    phone?: string;
    email?: string;
    notes?: string;
    contactCount?: number;
    createdAt?: any;
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-purple-100 text-purple-700',
    proposal: 'bg-orange-100 text-orange-700',
    negotiation: 'bg-pink-100 text-pink-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    active: 'bg-green-100 text-green-700',
    churned: 'bg-gray-100 text-gray-600',
};

function getFacilityLabel(value: string | undefined): string {
    if (!value) return '';
    return FACILITY_TYPE_OPTIONS.find(t => t.value === value)?.label || value;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [legacyLeads, setLegacyLeads] = useState<Company[]>([]);
    const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Fetch from 'companies' collection
    useEffect(() => {
        const q = query(collection(db, 'companies'), orderBy('businessName', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const list: Company[] = [];
            snap.forEach((d) => {
                const data = d.data();
                list.push({ id: d.id, ...data } as Company);
            });
            setCompanies(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Also fetch legacy 'leads' that haven't been migrated
    useEffect(() => {
        const q = query(collection(db, 'leads'), orderBy('businessName', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const list: Company[] = [];
            snap.forEach((d) => {
                const data = d.data();
                if (data.businessName) {
                    list.push({
                        id: d.id,
                        businessName: data.businessName,
                        website: data.website,
                        address: data.address,
                        city: data.city,
                        state: data.state,
                        zip: data.zip,
                        facilityType: data.facilityType,
                        leadType: data.leadType,
                        status: data.status,
                        phone: data.phone,
                        email: data.email,
                        notes: data.notes,
                        createdAt: data.createdAt,
                    });
                }
            });
            setLegacyLeads(list);
        });
        return () => unsub();
    }, []);

    // Fetch contact counts per company
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'contacts'), (snap) => {
            const counts: Record<string, number> = {};
            snap.forEach((d) => {
                const companyId = d.data().companyId;
                if (companyId) {
                    counts[companyId] = (counts[companyId] || 0) + 1;
                }
            });
            setContactCounts(counts);
        });
        return () => unsub();
    }, []);

    // Merge & deduplicate
    const allCompanies = useMemo(() => {
        const merged = [...companies];
        const existingIds = new Set(companies.map(c => c.id));
        for (const lead of legacyLeads) {
            if (!existingIds.has(lead.id)) {
                merged.push(lead);
            }
        }
        return merged;
    }, [companies, legacyLeads]);

    // Status counts
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allCompanies.forEach(c => {
            const s = c.status || 'new';
            counts[s] = (counts[s] || 0) + 1;
        });
        return counts;
    }, [allCompanies]);

    // Filter by status + search
    const filtered = useMemo(() => {
        let result = allCompanies;

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(c => (c.status || 'new') === statusFilter);
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(c =>
                c.businessName?.toLowerCase().includes(q) ||
                c.address?.toLowerCase().includes(q) ||
                c.city?.toLowerCase().includes(q) ||
                c.state?.toLowerCase().includes(q) ||
                c.facilityType?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [allCompanies, search, statusFilter]);

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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Companies</h1>
                        <p className="text-muted-foreground">
                            {allCompanies.length} {allCompanies.length === 1 ? 'company' : 'companies'}
                        </p>
                    </div>
                </div>

                {/* Status Badge Filters */}
                <div className="flex flex-wrap gap-1.5">
                    {STATUS_BADGES.map(s => {
                        const count = s.value === 'all' ? allCompanies.length : (statusCounts[s.value] || 0);
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

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, address, or type..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* List */}
                <div className="flex-1 min-h-0 overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="text-sm">Loading companies...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Building2 className="w-12 h-12 opacity-40" />
                            <p className="font-medium text-lg">No companies found</p>
                            <p className="text-sm">
                                {search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Companies will appear here as contacts are added.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filtered.map((company) => (
                                <Link key={company.id} href={`/sales/crm/${company.id}`}>
                                    <CompanyCard
                                        company={company}
                                        contactCount={contactCounts[company.id] || 0}
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

function CompanyCard({ company, contactCount }: { company: Company; contactCount: number }) {
    const facilityLabel = getFacilityLabel(company.facilityType);
    const location = [company.address, company.city, company.state].filter(Boolean).join(', ');
    const statusClass = STATUS_COLORS[company.status || ''] || 'bg-gray-100 text-gray-600';

    return (
        <div className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 hover:shadow-sm transition-all cursor-pointer">
            {/* Icon */}
            <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm truncate">{company.businessName}</h3>
                    {company.status && (
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
                            {company.status}
                        </Badge>
                    )}
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

            {/* Contact count */}
            <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</span>
            </div>

            {/* Website */}
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

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
    );
}
