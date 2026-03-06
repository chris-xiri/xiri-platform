"use client";

import { useEffect, useState, useMemo } from "react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Loader2, X, Search, Trash2, Edit, ChevronLeft, ChevronRight, ChevronDown, MapPin, Settings2, Tag } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Lead, LeadStatus, LeadType } from "@xiri/shared";
import { useLeadFilter } from "@/hooks/useLeadFilter";
import { LeadRow, ColumnKey } from "./LeadList/LeadRow";
import { LeadCard } from "./LeadList/LeadCard";

const COLUMN_LABELS: Record<ColumnKey, string> = {
    business: 'Business',
    type: 'Lead Type',
    contact: 'Contact',
    location: 'Location',
    auditTime: 'Audit Time',
    status: 'Status',
    source: 'Source',
    created: 'Created',
    actions: 'Actions',
};

const DEFAULT_VISIBLE: ColumnKey[] = ['business', 'type', 'contact', 'location', 'status', 'actions'];

interface LeadListProps {
    statusFilters?: LeadStatus[];
    title?: string;
    onRowClick?: (id: string) => void;
}

export default function LeadList({
    statusFilters,
    title = "Sales Pipeline",
    onRowClick
}: LeadListProps) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
    const [bulkLeadType, setBulkLeadType] = useState<LeadType | "">("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [groupByAddress, setGroupByAddress] = useState(true);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pipeline-columns');
            if (saved) {
                try { return new Set(JSON.parse(saved) as ColumnKey[]); } catch { }
            }
        }
        return new Set(DEFAULT_VISIBLE);
    });

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
            orderBy("createdAt", "desc")
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
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        try {
            for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
                const chunk = ids.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(leadId => {
                    batch.update(doc(db, "leads", leadId), { status: bulkStatus });
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setBulkStatus("");
        } catch (error) {
            console.error("Error updating leads:", error);
        }
    };

    const deleteConfirmPhrase = `Delete ${selectedLeads.size} leads`;

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499; // Firestore max is 500 operations per batch
        setDeleting(true);
        try {
            // Chunk into batches of 499 to stay within Firestore limits
            for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
                const chunk = ids.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(leadId => {
                    batch.delete(doc(db, "leads", leadId));
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setShowDeleteDialog(false);
            setDeleteConfirmText("");
        } catch (error: any) {
            console.error("Error deleting leads:", error);
            setShowDeleteDialog(false);
            setDeleteConfirmText("");
            window.alert(
                error?.code === 'permission-denied'
                    ? 'Delete failed: Your account does not have permission to delete leads.'
                    : `Delete failed: ${error?.message || 'Unknown error'}`
            );
        } finally {
            setDeleting(false);
        }
    };

    const handleBulkLeadTypeUpdate = async () => {
        if (!bulkLeadType || selectedLeads.size === 0) return;
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        try {
            for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
                const chunk = ids.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(leadId => {
                    batch.update(doc(db, "leads", leadId), { leadType: bulkLeadType });
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setBulkLeadType("");
        } catch (error) {
            console.error("Error updating lead types:", error);
        }
    };

    const toggleColumn = (col: ColumnKey) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(col)) {
                next.delete(col);
            } else {
                next.add(col);
            }
            localStorage.setItem('pipeline-columns', JSON.stringify([...next]));
            return next;
        });
    };

    const allSelected = filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length;
    const someSelected = selectedLeads.size > 0 && selectedLeads.size < filteredLeads.length;

    // Pagination
    const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const startIdx = (currentPage - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(currentPage * PAGE_SIZE, filteredLeads.length);

    // Group paginated leads by exact address
    const addressGroups = useMemo(() => {
        if (!groupByAddress) return null;
        const groups: { key: string; label: string; sublabel: string; leads: { lead: Lead; globalIndex: number }[] }[] = [];
        const groupMap = new Map<string, typeof groups[0]>();

        paginatedLeads.forEach((lead, i) => {
            const addr = (lead.address || '').trim();
            const key = addr.toLowerCase() || `__no_address_${lead.id}`;
            const cityState = [lead.city, lead.state].filter(Boolean).join(', ');
            const sublabel = cityState + (lead.zip ? ` ${lead.zip}` : '');

            if (!groupMap.has(key)) {
                const group = { key, label: addr || 'No address', sublabel, leads: [] as { lead: Lead; globalIndex: number }[] };
                groupMap.set(key, group);
                groups.push(group);
            }
            groupMap.get(key)!.leads.push({ lead, globalIndex: startIdx + i - 1 });
        });

        return groups;
    }, [paginatedLeads, groupByAddress, startIdx]);

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

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

                        <div className="w-px h-6 bg-blue-200 mx-1" />

                        <Select value={bulkLeadType} onValueChange={(value: string) => setBulkLeadType(value as LeadType)}>
                            <SelectTrigger className="w-[160px] h-8 text-sm">
                                <SelectValue placeholder="Update type..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="tenant">Tenant</SelectItem>
                                <SelectItem value="referral_partnership">Referral Partnership</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            onClick={handleBulkLeadTypeUpdate}
                            disabled={!bulkLeadType}
                            className="h-8"
                        >
                            <Tag className="w-3 h-3 mr-1" />
                            Update Type
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                                <Settings2 className="w-3.5 h-3.5" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map(col => (
                                <DropdownMenuCheckboxItem
                                    key={col}
                                    checked={visibleColumns.has(col)}
                                    onCheckedChange={() => toggleColumn(col)}
                                    className="text-xs"
                                >
                                    {COLUMN_LABELS[col]}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                                        {visibleColumns.has('business') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Business</TableHead>}
                                        {visibleColumns.has('type') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Type</TableHead>}
                                        {visibleColumns.has('contact') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Contact</TableHead>}
                                        {visibleColumns.has('location') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Location</TableHead>}
                                        {visibleColumns.has('auditTime') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Audit Time</TableHead>}
                                        {visibleColumns.has('status') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Status</TableHead>}
                                        {visibleColumns.has('source') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Source</TableHead>}
                                        {visibleColumns.has('created') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Created</TableHead>}
                                        {visibleColumns.has('actions') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs w-12"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupByAddress && addressGroups ? (
                                        addressGroups.map(group => (
                                            <>
                                                <TableRow
                                                    key={`group-${group.key}`}
                                                    className={`cursor-pointer hover:bg-muted/50 border-b ${group.leads.length > 1 ? 'bg-amber-500/5' : 'bg-muted/20'
                                                        }`}
                                                    onClick={() => toggleGroup(group.key)}
                                                >
                                                    <TableCell colSpan={visibleColumns.size + 2} className="py-1.5 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedGroups.has(group.key) ? '-rotate-90' : ''}`} />
                                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span className="text-xs font-medium">{group.label}</span>
                                                            {group.sublabel && (
                                                                <span className="text-xs text-muted-foreground">— {group.sublabel}</span>
                                                            )}
                                                            <Badge variant={group.leads.length > 1 ? 'default' : 'secondary'}
                                                                className={`text-[10px] px-1.5 py-0 h-4 ml-auto ${group.leads.length > 1 ? 'bg-amber-500 hover:bg-amber-600' : ''}`}>
                                                                {group.leads.length}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {!collapsedGroups.has(group.key) && group.leads.map(({ lead, globalIndex }) => (
                                                    <LeadRow
                                                        key={lead.id}
                                                        lead={lead}
                                                        index={globalIndex}
                                                        isSelected={selectedLeads.has(lead.id!)}
                                                        onSelect={(checked) => handleSelectLead(lead.id!, checked)}
                                                        onRowClick={onRowClick}
                                                        visibleColumns={visibleColumns}
                                                    />
                                                ))}
                                            </>
                                        ))
                                    ) : (
                                        paginatedLeads.map((lead, index) => (
                                            <LeadRow
                                                key={lead.id}
                                                lead={lead}
                                                index={startIdx + index - 1}
                                                isSelected={selectedLeads.has(lead.id!)}
                                                onSelect={(checked) => handleSelectLead(lead.id!, checked)}
                                                onRowClick={onRowClick}
                                                visibleColumns={visibleColumns}
                                            />
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {paginatedLeads.map((lead, index) => (
                                <LeadCard
                                    key={lead.id}
                                    lead={lead}
                                    index={startIdx + index - 1}
                                    isSelected={selectedLeads.has(lead.id!)}
                                    onSelect={(checked) => handleSelectLead(lead.id!, checked)}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                        <p className="text-sm text-muted-foreground">
                            Showing {startIdx}–{endIdx} of {filteredLeads.length} leads
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                            </Button>
                            <span className="text-sm font-medium px-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-8"
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={(open: boolean) => { setShowDeleteDialog(open); if (!open) setDeleteConfirmText(""); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedLeads.size} lead(s)?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>This action cannot be undone. This will permanently delete the selected leads from the database.</p>
                                <div>
                                    <p className="text-sm font-medium text-foreground mb-1.5">Type <strong className="text-destructive">{deleteConfirmPhrase}</strong> to confirm:</p>
                                    <Input
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={deleteConfirmPhrase}
                                        className="font-mono text-sm"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleBulkDelete}
                            disabled={deleteConfirmText !== deleteConfirmPhrase || deleting}
                            variant="destructive"
                        >
                            {deleting ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting...</>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
