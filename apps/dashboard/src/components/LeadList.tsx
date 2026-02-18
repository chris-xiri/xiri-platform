"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Users, Loader2, X, Search, Trash2, Edit } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Lead, LeadStatus } from "@xiri/shared";
import { useLeadFilter } from "@/hooks/useLeadFilter";
import { LeadRow } from "./LeadList/LeadRow";
import { LeadCard } from "./LeadList/LeadCard";

interface LeadListProps {
    statusFilters?: LeadStatus[];
    title?: string;
}

export default function LeadList({
    statusFilters,
    title = "Sales Pipeline"
}: LeadListProps) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredLeads,
        resetFilters,
        hasActiveFilters
    } = useLeadFilter(leads, statusFilters);

    useEffect(() => {
        const q = query(
            collection(db, "leads"),
            orderBy("createdAt", "desc"),
            limit(100)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const leadData: Lead[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    leadData.push({
                        id: doc.id,
                        businessName: data.businessName || "Unknown",
                        facilityType: data.facilityType || 'other',
                        contactName: data.contactName || "",
                        contactPhone: data.contactPhone || "",
                        email: data.email || "",
                        zipCode: data.zipCode || "",
                        address: data.address,
                        serviceInterest: data.serviceInterest,
                        preferredAuditTimes: data.preferredAuditTimes,
                        notes: data.notes,
                        attribution: data.attribution || {
                            source: '',
                            medium: '',
                            campaign: '',
                            landingPage: ''
                        },
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                        status: data.status || 'new',
                        ...data
                    } as Lead);
                });
                setLeads(leadData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching leads:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedLeads(new Set(filteredLeads.map(l => l.id!)));
        } else {
            setSelectedLeads(new Set());
        }
    };

    const handleSelectLead = (leadId: string, checked: boolean) => {
        const newSelected = new Set(selectedLeads);
        if (checked) {
            newSelected.add(leadId);
        } else {
            newSelected.delete(leadId);
        }
        setSelectedLeads(newSelected);
    };

    const handleBulkStatusUpdate = async () => {
        if (!bulkStatus || selectedLeads.size === 0) return;

        try {
            const batch = writeBatch(db);
            selectedLeads.forEach(leadId => {
                const leadRef = doc(db, "leads", leadId);
                batch.update(leadRef, { status: bulkStatus });
            });
            await batch.commit();
            setSelectedLeads(new Set());
            setBulkStatus("");
        } catch (error) {
            console.error("Error updating leads:", error);
        }
    };

    const handleBulkDelete = async () => {
        try {
            const batch = writeBatch(db);
            selectedLeads.forEach(leadId => {
                const leadRef = doc(db, "leads", leadId);
                batch.delete(leadRef);
            });
            await batch.commit();
            setSelectedLeads(new Set());
            setShowDeleteDialog(false);
        } catch (error) {
            console.error("Error deleting leads:", error);
        }
    };

    const allSelected = filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length;
    const someSelected = selectedLeads.size > 0 && selectedLeads.size < filteredLeads.length;

    if (loading) {
        return (
            <Card className="shadow-sm h-full flex items-center justify-center border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Loading leads...</p>
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
                            {filteredLeads.length}
                        </Badge>
                    </CardTitle>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedLeads.size > 0 && (
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedLeads.size} selected
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                        <Select value={bulkStatus} onValueChange={(value: string) => setBulkStatus(value as LeadStatus)}>
                            <SelectTrigger className="w-[180px] h-8 text-sm">
                                <SelectValue placeholder="Update status..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="walkthrough">Walkthrough</SelectItem>
                                <SelectItem value="proposal">Proposal</SelectItem>
                                <SelectItem value="won">Won</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            onClick={handleBulkStatusUpdate}
                            disabled={!bulkStatus}
                            className="h-8"
                        >
                            <Edit className="w-3 h-3 mr-1" />
                            Update Status
                        </Button>
                    </div>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        className="h-8"
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLeads(new Set())}
                        className="h-8"
                    >
                        <X className="w-3 h-3 mr-1" />
                        Clear
                    </Button>
                </div>
            )}

            <div className="px-3 py-2 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by business, contact, email, or location..."
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

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {filteredLeads.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No matching leads</p>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block flex-1 overflow-auto">
                            <table className="w-full caption-bottom text-sm text-foreground">
                                <TableHeader className="bg-muted/50 shadow-sm">
                                    <TableRow className="border-b border-border hover:bg-muted/50">
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 w-12 shadow-sm text-center">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={handleSelectAll}
                                                aria-label="Select all"
                                                className="mx-auto"
                                            />
                                        </TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 w-10 shadow-sm text-center text-xs">#</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Business</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Contact</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Location</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Audit Time</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Status</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Source</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLeads.map((lead, index) => (
                                        <LeadRow
                                            key={lead.id}
                                            lead={lead}
                                            index={index}
                                            isSelected={selectedLeads.has(lead.id!)}
                                            onSelect={(checked) => handleSelectLead(lead.id!, checked)}
                                        />
                                    ))}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {filteredLeads.map((lead, index) => (
                                <LeadCard
                                    key={lead.id}
                                    lead={lead}
                                    index={index}
                                    isSelected={selectedLeads.has(lead.id!)}
                                    onSelect={(checked) => handleSelectLead(lead.id!, checked)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </CardContent>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedLeads.size} lead(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected leads from the database.
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
