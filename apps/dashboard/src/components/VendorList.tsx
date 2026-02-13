"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Loader2, ExternalLink, Check, X, Eye, Search, Filter } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
// import { toast } from "sonner"; // TODO: Install sonner for notifications
import { Vendor, VendorStatus } from "@xiri/shared";

interface VendorListProps {
    companyName?: string;
    name?: string;
    specialty?: string;
    address?: string;
    location?: string;
    phone?: string;
    website?: string;
    rating?: number;
    totalRatings?: number;
    aiScore?: number;
    fitScore?: number;
    aiReasoning?: string;
    status?: string;
    outreachStatus?: string;
    createdAt?: any;
    statusUpdatedAt?: any;
}

interface VendorListProps {
    statusFilters?: string[];
    title?: string;
    showActions?: boolean;
}

export default function VendorList({ statusFilters, title = "Vendor Pipeline", showActions = true }: VendorListProps) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [outreachFilter, setOutreachFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    useEffect(() => {
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const vendorData: Vendor[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Map legacy fields if necessary during migration
                    vendorData.push({
                        id: doc.id,
                        businessName: data.businessName || data.companyName || data.name || "Unknown",
                        status: data.status || 'pending_review',
                        capabilities: data.capabilities || (data.specialty ? [data.specialty] : []),
                        aiScore: data.aiScore || data.fitScore,
                        address: data.address || data.location,
                        ...data
                    } as Vendor);
                });
                setVendors(vendorData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching vendors:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Filter Logic
    const filteredVendors = vendors.filter(vendor => {
        // Search
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            (vendor.businessName?.toLowerCase() || "").includes(searchLower) ||
            (vendor.capabilities?.some(c => c.toLowerCase().includes(searchLower))) ||
            (vendor.address?.toLowerCase() || "").includes(searchLower);

        // Status Filter
        const matchesStatus = statusFilter === "ALL" || vendor.status === statusFilter;

        // Outreach Filter
        let matchesOutreach = true;
        if (outreachFilter !== "ALL") {
            const os = vendor.outreachStatus || "NONE";
            if (outreachFilter === "PENDING") matchesOutreach = os === "PENDING";
            else if (outreachFilter === "SENT") matchesOutreach = os === "SENT";
            else if (outreachFilter === "NONE") matchesOutreach = !vendor.outreachStatus;
        }

        // Strict Prop Filter
        const matchesPropFilters = !statusFilters || statusFilters.length === 0 || statusFilters.includes(vendor.status);

        return matchesSearch && matchesStatus && matchesOutreach && matchesPropFilters;
    });

    const handleUpdateStatus = async (id: string, newStatus: Vendor['status']) => {
        try {
            await updateDoc(doc(db, "vendors", id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            console.log(`Vendor ${id} updated to ${newStatus}`);
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const resetFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setOutreachFilter("ALL");
    };

    const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || outreachFilter !== "ALL";

    const getStatusColor = (status: Vendor['status'], outreachStatus?: string) => {
        switch (status) {
            case 'active':
                return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
            case 'rejected':
            case 'suspended':
                return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
            case 'qualified':
                return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
            case 'compliance_review':
                return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
            case 'pending_review':
            default:
                if (outreachStatus === 'SENT') return "bg-blue-50 text-blue-700 border-blue-200";
                return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
        }
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-muted-foreground";
        if (score >= 80) return "text-green-600 dark:text-green-400 font-semibold";
        if (score >= 60) return "text-yellow-600 dark:text-yellow-400 font-semibold";
        return "text-red-600 dark:text-red-400 font-semibold";
    };

    if (loading) {
        return (
            <Card className="shadow-sm h-full flex items-center justify-center border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Loading ecosystem...</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-border h-full flex flex-col bg-card overflow-hidden">
            <CardHeader className="bg-card border-b border-border py-2 px-3 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-primary text-base">
                        <Users className="w-4 h-4 text-primary" />
                        {title}
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-2 text-xs px-1.5 py-0">
                            {filteredVendors.length}
                        </Badge>
                    </CardTitle>
                </div>
            </CardHeader>

            <div className="px-3 py-2 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vendors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        className="h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="qualified">Qualified</option>
                        <option value="compliance_review">Compliance</option>
                        <option value="active">Active</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="h-9 px-2 hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Reset all filters"
                        >
                            <X className="mr-1 h-3 w-3" />
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {filteredVendors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No matching vendors</p>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block flex-1 overflow-auto">
                            <table className="w-full caption-bottom text-sm text-foreground">
                                <TableHeader className="bg-muted/50 shadow-sm">
                                    <TableRow className="border-b border-border hover:bg-muted/50">
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 w-10 shadow-sm text-center text-xs">#</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Vendor</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Capabilities</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">AI Score</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Status</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVendors.map((vendor, index) => (
                                        <TableRow key={vendor.id} className="hover:bg-muted/50 transition-colors border-b border-border text-foreground">
                                            <TableCell className="py-2 text-center text-muted-foreground font-medium text-xs">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Link href={`/crm/${vendor.id}`} className="block group cursor-pointer">
                                                    <div>
                                                        <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{vendor.businessName}</div>
                                                        <div className="text-[10px] text-muted-foreground">{vendor.address || "Unknown Location"}</div>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {vendor.capabilities?.slice(0, 2).map((cap, i) => (
                                                        <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                            {cap}
                                                        </Badge>
                                                    ))}
                                                    {vendor.capabilities?.length > 2 && (
                                                        <span className="text-[10px] text-muted-foreground">+{vendor.capabilities.length - 2}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <div className={getScoreColor(vendor.aiScore) + " text-xs"}>
                                                    {vendor.aiScore ? `${vendor.aiScore}/100` : "N/A"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <Badge className={getStatusColor(vendor.status, vendor.outreachStatus) + " shadow-none text-[10px] px-1.5 py-0 h-5"}>
                                                    {vendor.status === 'pending_review' ? 'Review Needed' :
                                                        vendor.status === 'compliance_review' ? 'Compliance' :
                                                            vendor.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                                {showActions && (
                                                    <div className="flex justify-center gap-1.5">
                                                        {vendor.status === 'pending_review' ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleUpdateStatus(vendor.id!, 'qualified')}
                                                                    className="h-7 px-2 border-green-200 text-green-700 hover:bg-green-600 hover:text-white transition-all font-medium text-xs"
                                                                >
                                                                    <Check className="w-3 h-3 mr-1" /> Qualify
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleUpdateStatus(vendor.id!, 'rejected')}
                                                                    className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all font-medium text-xs"
                                                                >
                                                                    <X className="w-3 h-3 mr-1" /> Reject
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Link href={`/crm/${vendor.id}`}>
                                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                                                    <Eye className="w-3 h-3 mr-1" /> Details
                                                                </Button>
                                                            </Link>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {filteredVendors.map((vendor, index) => (
                                <div key={vendor.id} className="border border-border rounded-lg p-3 space-y-3 bg-card shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 flex gap-2">
                                            <span className="text-muted-foreground font-medium text-xs mt-0.5">#{index + 1}</span>
                                            <div>
                                                <h3 className="font-medium text-foreground">{vendor.businessName}</h3>
                                                <p className="text-xs text-muted-foreground mt-0.5">{vendor.address}</p>
                                            </div>
                                        </div>
                                        <Badge className={getStatusColor(vendor.status, vendor.outreachStatus)}>
                                            {vendor.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium ${getScoreColor(vendor.aiScore)}`}>
                                                Score: {vendor.aiScore || "N/A"}
                                            </span>
                                        </div>
                                        <Link href={`/crm/${vendor.id}`}>
                                            <button className="text-primary text-xs font-medium">View Details</button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
