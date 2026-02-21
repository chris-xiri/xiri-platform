'use client';

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@xiri/shared";
import { AddContractorDialog } from "@/components/AddContractorDialog";
import {
    Users, CheckCircle, ShieldCheck, CalendarCheck,
    Rocket, Star, Pause, XCircle, Mail, Clock, FileSearch, Ban, Plus
} from "lucide-react";

// Status tab definitions — mirrors VendorStatusTimeline pipeline
const STATUS_TABS = [
    { key: 'all', label: 'All', icon: Users, color: '' },
    { key: 'pending_review', label: 'Sourced', icon: Users, color: 'text-sky-600' },
    { key: 'qualified', label: 'Qualified', icon: CheckCircle, color: 'text-blue-600' },
    { key: 'awaiting_onboarding', label: 'Awaiting Form', icon: Mail, color: 'text-indigo-600' },
    { key: 'compliance_review', label: 'Compliance', icon: ShieldCheck, color: 'text-amber-600' },
    { key: 'pending_verification', label: 'Verifying Docs', icon: FileSearch, color: 'text-orange-600' },
    { key: 'onboarding_scheduled', label: 'Onboarding Call', icon: CalendarCheck, color: 'text-violet-600' },
    { key: 'ready_for_assignment', label: 'Ready', icon: Rocket, color: 'text-teal-600' },
    { key: 'active', label: 'Active', icon: Star, color: 'text-emerald-600' },
    { key: 'suspended', label: 'Suspended', icon: Pause, color: 'text-orange-600' },
    { key: 'dismissed', label: 'Dismissed', icon: Ban, color: 'text-red-600' },
] as const;

export default function CRMPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'all');
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [showAddContractor, setShowAddContractor] = useState(false);

    // Sync tab to URL
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        if (tab === 'all') {
            params.delete('tab');
        } else {
            params.set('tab', tab);
        }
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Live Firestore listener for count badges
    useEffect(() => {
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"), limit(200));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Vendor[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as Vendor);
            });
            setVendors(data);
        });
        return () => unsubscribe();
    }, []);

    // Count vendors per status (normalized to lowercase)
    const counts = useMemo(() => {
        const map: Record<string, number> = { all: vendors.length };
        for (const v of vendors) {
            const s = (v.status || 'pending_review').toLowerCase();
            map[s] = (map[s] || 0) + 1;
        }
        return map;
    }, [vendors]);

    // Derive statusFilters from active tab (include legacy uppercase variants)
    const statusFilters = useMemo(() => {
        if (activeTab === 'all') return undefined;
        const upper = activeTab.toUpperCase();
        return [activeTab, upper];
    }, [activeTab]);

    return (
        <ProtectedRoute resource="supply/crm">
            <main className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col h-[calc(100vh-64px)]">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-foreground">Vendor CRM</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{vendors.length} vendors</span>
                        <Button onClick={() => setShowAddContractor(true)} className="gap-2" size="sm">
                            <Plus className="w-4 h-4" />
                            Add Contractor
                        </Button>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-3 border-b border-border mb-3 flex-shrink-0">
                    {STATUS_TABS.map((tab) => {
                        const count = counts[tab.key] || 0;
                        const isActive = activeTab === tab.key;
                        const Icon = tab.icon;

                        // Hide tabs with 0 count (except 'all')
                        if (tab.key !== 'all' && count === 0) return null;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleTabChange(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? '' : tab.color}`} />
                                {tab.label}
                                {count > 0 && (
                                    <Badge
                                        variant={isActive ? "outline" : "secondary"}
                                        className={`text-[10px] px-1 py-0 h-4 ml-0.5 ${isActive ? 'border-primary-foreground/30 text-primary-foreground' : ''}`}
                                    >
                                        {count}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Vendor List */}
                <div className="flex-1 overflow-hidden">
                    <VendorList
                        title="Vendor CRM"
                        statusFilters={statusFilters}
                    />
                </div>
            </main>

            <AddContractorDialog open={showAddContractor} onOpenChange={setShowAddContractor} />
        </ProtectedRoute>
    );
}
