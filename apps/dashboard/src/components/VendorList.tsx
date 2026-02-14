"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Loader2, X, Search } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@xiri/shared";
import { useVendorFilter } from "@/hooks/useVendorFilter";
import { VendorRow } from "./VendorList/VendorRow";
import { VendorCard } from "./VendorList/VendorCard";

interface VendorListProps {
    statusFilters?: string[];
    title?: string;
    showActions?: boolean;
}

export default function VendorList({ statusFilters, title = "Vendor Pipeline", showActions = true }: VendorListProps) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    const {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredVendors,
        resetFilters,
        hasActiveFilters
    } = useVendorFilter(vendors, statusFilters);

    useEffect(() => {
        // Limit query to 100 items for performance
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"), limit(100));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const vendorData: Vendor[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    vendorData.push({
                        id: doc.id,
                        businessName: data.businessName || data.companyName || data.name || "Unknown",
                        status: data.status || 'pending_review',
                        capabilities: data.capabilities || (data.specialty ? [data.specialty] : []),
                        fitScore: data.fitScore || data.aiScore,
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
                                        <VendorRow
                                            key={vendor.id}
                                            vendor={vendor}
                                            index={index}
                                            showActions={showActions}
                                            onUpdateStatus={handleUpdateStatus}
                                        />
                                    ))}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {filteredVendors.map((vendor, index) => (
                                <VendorCard key={vendor.id} vendor={vendor} index={index} />
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
