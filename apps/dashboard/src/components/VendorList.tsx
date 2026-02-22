"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Loader2, X, Search, Trash2 } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, serverTimestamp, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@xiri/shared";
import { useVendorFilter } from "@/hooks/useVendorFilter";
import { VendorRow } from "./VendorList/VendorRow";
import { VendorCard } from "./VendorList/VendorCard";

interface VendorListProps {
    statusFilters?: string[];
    title?: string;
    showActions?: boolean;
    isRecruitmentMode?: boolean;
    onSelectVendor?: (id: string) => void;
    selectedVendorId?: string | null;
}

export default function VendorList({
    statusFilters,
    title = "Vendor Directory",
    showActions = true,
    isRecruitmentMode = false,
    onSelectVendor,
    selectedVendorId
}: VendorListProps) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [processedOpen, setProcessedOpen] = useState(false);

    const {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredVendors,
        resetFilters,
        hasActiveFilters
    } = useVendorFilter(vendors, statusFilters);

    const pendingVendors = isRecruitmentMode
        ? filteredVendors.filter(v => (v.status || 'pending_review').toLowerCase() === 'pending_review')
        : filteredVendors;

    const processedVendors = isRecruitmentMode
        ? filteredVendors.filter(v => (v.status || 'pending_review').toLowerCase() !== 'pending_review')
        : [];

    // Use pendingVendors as the primary display list in recruitment mode
    const displayVendors = isRecruitmentMode ? pendingVendors : filteredVendors;

    // Heat-sort: when showing awaiting_onboarding, sort by engagement signal (clicked > opened > delivered > none > bounced)
    const sortedDisplayVendors = (() => {
        // Check if we're filtering to awaiting_onboarding
        const isAwaitingFilter = statusFilters?.some(f => f.toLowerCase() === 'awaiting_onboarding');
        if (!isAwaitingFilter) return displayVendors;

        const heatScore = (v: Vendor): number => {
            const event = v.emailEngagement?.lastEvent;
            if (!event) return 0; // no data — neutral
            switch (event) {
                case 'clicked': return 3;
                case 'opened': return 2;
                case 'delivered': return 1;
                case 'bounced': return -1;
                case 'spam': return -2;
                default: return 0;
            }
        };

        return [...displayVendors].sort((a, b) => heatScore(b) - heatScore(a));
    })();

    // Log unique status values for debugging
    const uniqueStatuses = [...new Set(vendors.map(v => v.status))];

    console.log("VENDOR LIST DEBUG:", {
        totalFetched: vendors.length,
        filtered: filteredVendors.length,
        pending: pendingVendors.length,
        processed: processedVendors.length,
        uniqueStatuses,
        mode: isRecruitmentMode ? "Recruitment" : "CRM",
        statusFilter,
        searchQuery
    });

    useEffect(() => {
        // Limit query to 100 items for performance
        // Reverted to 'createdAt' because 'updatedAt' is not guaranteed on new docs yet
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

    const handleUpdateStatus = async (id: string, newStatus: Vendor['status'], options?: { onboardingTrack?: 'FAST_TRACK' | 'STANDARD', hasActiveContract?: boolean }) => {
        try {
            const updateData: any = {
                status: newStatus,
                updatedAt: serverTimestamp()
            };

            // Apply options if provided (for Qualification)
            if (options) {
                if (options.onboardingTrack) updateData.onboardingTrack = options.onboardingTrack;
                if (options.hasActiveContract !== undefined) updateData.hasActiveContract = options.hasActiveContract;
                // If qualifying, ensure outreach starts
                if (newStatus === 'qualified') updateData.outreachStatus = 'PENDING';
            }

            await updateDoc(doc(db, "vendors", id), updateData);
            console.log(`Vendor ${id} updated to ${newStatus}`);
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleAddEmailAndRetrigger = async (id: string, email: string) => {
        try {
            const vendorRef = doc(db, "vendors", id);
            // Step 1: Save email and temporarily set to pending_review + clear outreach
            await updateDoc(vendorRef, {
                email,
                status: 'pending_review',
                outreachStatus: null,
                updatedAt: serverTimestamp()
            });
            // Step 2: After a brief delay, set back to qualified — this triggers
            // onVendorApproved which enqueues the GENERATE task for the outreach worker
            setTimeout(async () => {
                await updateDoc(vendorRef, {
                    status: 'qualified',
                    updatedAt: serverTimestamp()
                });
                console.log(`Email added and outreach pipeline re-triggered for vendor ${id}`);
            }, 500);
        } catch (error) {
            console.error("Error re-triggering outreach:", error);
        }
    };

    const handleUpdateContact = async (id: string, data: { email?: string; phone?: string }) => {
        try {
            const updateData: any = { updatedAt: serverTimestamp() };
            if (data.email) updateData.email = data.email;
            if (data.phone) updateData.phone = data.phone;
            await updateDoc(doc(db, "vendors", id), updateData);
            console.log(`Contact info updated for vendor ${id}`);
        } catch (error) {
            console.error("Error updating contact:", error);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedVendors(new Set(displayVendors.map(v => v.id!)));
        } else {
            setSelectedVendors(new Set());
        }
    };

    const handleSelectVendor = (vendorId: string, checked: boolean) => {
        const newSelected = new Set(selectedVendors);
        if (checked) {
            newSelected.add(vendorId);
        } else {
            newSelected.delete(vendorId);
        }
        setSelectedVendors(newSelected);
    };

    const handleBulkDelete = async () => {
        try {
            const batch = writeBatch(db);
            selectedVendors.forEach(vendorId => {
                const vendorRef = doc(db, "vendors", vendorId);
                batch.delete(vendorRef);
            });
            await batch.commit();
            setSelectedVendors(new Set());
            setShowDeleteDialog(false);
        } catch (error) {
            console.error("Error deleting vendors:", error);
        }
    };

    const allSelected = displayVendors.length > 0 && selectedVendors.size === displayVendors.length;
    const someSelected = selectedVendors.size > 0 && selectedVendors.size < displayVendors.length;

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
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-2 bg-card rounded-lg border shadow-sm mb-4">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary text-base">
                        <Users className="w-4 h-4 text-primary" />
                        {title}
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-2 text-xs px-1.5 py-0">
                            {isRecruitmentMode ? pendingVendors.length : filteredVendors.length}
                        </Badge>
                    </CardTitle>
                </div>
            </div>

            <div className="px-3 py-2 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder='Search by name, service, or location...'
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

            {/* Bulk Actions Bar */}
            {selectedVendors.size > 0 && (
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedVendors.size} selected
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                            className="h-8 text-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedVendors(new Set())}
                            className="h-8 text-sm"
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            )}

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {displayVendors.length === 0 && (!isRecruitmentMode || processedVendors.length === 0) ? (
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
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 w-8 shadow-sm text-center">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={handleSelectAll}
                                                aria-label="Select all vendors"
                                            />
                                        </TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-xs">Vendor</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Location</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs w-16">Score</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Status</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedDisplayVendors.map((vendor, index) => (
                                        <VendorRow
                                            key={vendor.id}
                                            vendor={vendor}
                                            index={index}
                                            showActions={showActions}
                                            isRecruitmentMode={isRecruitmentMode}
                                            onUpdateStatus={handleUpdateStatus}
                                            onAddEmailAndRetrigger={handleAddEmailAndRetrigger}
                                            onUpdateContact={handleUpdateContact}
                                            onSelect={onSelectVendor}
                                            isActive={selectedVendorId === vendor.id}
                                            isSelected={selectedVendors.has(vendor.id!)}
                                            onSelectChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)}
                                        />
                                    ))}

                                    {/* Collapsible Processed Section */}
                                    {isRecruitmentMode && processedVendors.length > 0 && (
                                        <>
                                            <TableRow
                                                className="bg-muted/50 hover:bg-muted/60 cursor-pointer border-y border-border"
                                                onClick={() => setProcessedOpen(!processedOpen)}
                                            >
                                                <TableCell colSpan={6} className="py-2 text-center text-xs font-medium text-muted-foreground">
                                                    {processedOpen ? "Hide" : "Show"} {processedVendors.length} Processed Vendors
                                                </TableCell>
                                            </TableRow>

                                            {processedOpen && processedVendors.map((vendor, index) => (
                                                <VendorRow
                                                    key={vendor.id}
                                                    vendor={vendor}
                                                    index={index + pendingVendors.length}
                                                    showActions={showActions}
                                                    isRecruitmentMode={isRecruitmentMode}
                                                    onUpdateStatus={handleUpdateStatus}
                                                    onAddEmailAndRetrigger={handleAddEmailAndRetrigger}
                                                    onUpdateContact={handleUpdateContact}
                                                    onSelect={onSelectVendor}
                                                    isActive={selectedVendorId === vendor.id}
                                                />
                                            ))}
                                        </>
                                    )}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {sortedDisplayVendors.map((vendor, index) => (
                                <VendorCard
                                    key={vendor.id}
                                    vendor={vendor}
                                    index={index}
                                    isRecruitmentMode={isRecruitmentMode}
                                    isSelected={selectedVendors.has(vendor.id!)}
                                    onSelectChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)}
                                />
                            ))}

                            {/* Mobile Collapsible */}
                            {isRecruitmentMode && processedVendors.length > 0 && (
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs text-muted-foreground"
                                        onClick={() => setProcessedOpen(!processedOpen)}
                                    >
                                        {processedOpen ? "Hide" : "Show"} {processedVendors.length} Processed
                                    </Button>
                                    {processedOpen && (
                                        <div className="mt-2 space-y-3 opacity-75">
                                            {processedVendors.map((vendor, index) => (
                                                <VendorCard
                                                    key={vendor.id}
                                                    vendor={vendor}
                                                    index={index}
                                                    isRecruitmentMode={isRecruitmentMode}
                                                    isSelected={selectedVendors.has(vendor.id!)}
                                                    onSelectChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vendors?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedVendors.size} vendor{selectedVendors.size > 1 ? 's' : ''}?
                            This action cannot be undone and will permanently remove the vendor{selectedVendors.size > 1 ? 's' : ''} from Firestore.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

