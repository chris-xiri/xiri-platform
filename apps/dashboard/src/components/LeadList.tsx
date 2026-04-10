"use client";

import { Fragment, useCallback } from "react";

import { useEffect, useState, useMemo, useRef } from "react";
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
import { Users, Loader2, X, Search, Trash2, Edit, ChevronLeft, ChevronRight, ChevronDown, Building2, Settings2, Tag, Play, Mail, MailOpen, MousePointerClick, AlertTriangle, Send } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, writeBatch, getDoc, getDocs } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { LeadStatus, LeadType } from "@xiri-facility-solutions/shared";
import { useLeadFilter } from "@/hooks/useLeadFilter";
import { LeadRow, ColumnKey, ContactRow } from "./LeadList/LeadRow";
import { LeadCard } from "./LeadList/LeadCard";

const COLUMN_LABELS: Record<ColumnKey, string> = {
    contact: 'Contact',
    business: 'Company',
    type: 'Lead Type',
    location: 'Location',
    auditTime: 'Audit Time',
    status: 'Status',
    source: 'Source',
    created: 'Created',
    actions: 'Actions',
};

const DEFAULT_VISIBLE: ColumnKey[] = ['contact', 'business', 'type', 'location', 'status', 'actions'];

// ─── Email Funnel Summary ─────────────────────────────────────────
function EmailFunnelSummary({ contacts }: { contacts: ContactRow[] }) {
    const [expanded, setExpanded] = useState(false);

    const stats = useMemo(() => {
        let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0;
        contacts.forEach(c => {
            const eng = c.emailEngagement;
            if (!eng?.lastEvent) return;
            sent++;
            switch (eng.lastEvent) {
                case 'clicked':
                    clicked++;
                    opened++;
                    delivered++;
                    break;
                case 'opened':
                    opened++;
                    delivered++;
                    break;
                case 'delivered':
                    delivered++;
                    break;
                case 'bounced':
                    bounced++;
                    break;
                case 'spam':
                    bounced++;
                    break;
            }
        });
        return { sent, delivered, opened, clicked, bounced };
    }, [contacts]);

    if (stats.sent === 0) return null;

    const metrics = [
        { label: 'Sent', value: stats.sent, icon: Send, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
        { label: 'Delivered', value: stats.delivered, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        { label: 'Opened', value: stats.opened, icon: MailOpen, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        { label: 'Clicked', value: stats.clicked, icon: MousePointerClick, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
        { label: 'Bounced', value: stats.bounced, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    ];

    return (
        <div className="mx-0 mb-3">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-1"
            >
                <Mail className="w-3.5 h-3.5" />
                Email Engagement
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                {!expanded && (
                    <span className="text-[10px] text-muted-foreground/70 ml-1">
                        {stats.sent} sent · {stats.opened} opened · {stats.clicked} clicked
                    </span>
                )}
            </button>
            {expanded && (
                <div className="flex gap-2 mt-1.5 flex-wrap">
                    {metrics.map(m => (
                        <div key={m.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${m.bg} text-xs`}>
                            <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                            <span className={`font-semibold tabular-nums ${m.color}`}>{m.value}</span>
                            <span className="text-muted-foreground">{m.label}</span>
                            {m.label !== 'Bounced' && stats.sent > 0 && (
                                <span className="text-muted-foreground/60 text-[10px]">
                                    ({Math.round((m.value / stats.sent) * 100)}%)
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    const [contacts, setContacts] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'status'|'type'|'sequence'|'delete'|null>(null);
    const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
    const [bulkLeadType, setBulkLeadType] = useState<LeadType | "">("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingType, setUpdatingType] = useState(false);
    // Bulk sequence
    const [showBulkSequenceDialog, setShowBulkSequenceDialog] = useState(false);
    const [bulkSequences, setBulkSequences] = useState<{id:string;name:string;description?:string;steps:any[]}[]>([]);
    const [bulkSelectedSequenceId, setBulkSelectedSequenceId] = useState('');
    const [enrollingSequence, setEnrollingSequence] = useState(false);
    const [loadingBulkSequences, setLoadingBulkSequences] = useState(false);
    const [bulkSequenceProgress, setBulkSequenceProgress] = useState<{done:number;total:number;errors:string[]}|null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [groupByCompany, setGroupByCompany] = useState(false);
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
        filteredLeads: filteredContacts,
        resetFilters,
        hasActiveFilters
    } = useLeadFilter(contacts as any, statusFilters);

    // ─── Fetch contacts + join company data ──────────────────────────
    useEffect(() => {
        const q = query(
            collection(db, "contacts"),
            orderBy("createdAt", "desc")
        );

        // Cache companies to avoid re-fetching the same company for each contact
        const companyCache = new Map<string, any>();

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                const contactData: ContactRow[] = [];
                const companyIdsToFetch = new Set<string>();

                // First pass: collect all unique companyIds we need
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const companyId = data.companyId;
                    if (companyId && !companyCache.has(companyId)) {
                        companyIdsToFetch.add(companyId);
                    }
                });

                // Fetch any missing companies
                const fetchPromises = Array.from(companyIdsToFetch).map(async (cId) => {
                    try {
                        const compDoc = await getDoc(doc(db, "companies", cId));
                        if (compDoc.exists()) {
                            companyCache.set(cId, compDoc.data());
                        }
                    } catch (err) {
                        console.error(`Failed to fetch company ${cId}:`, err);
                    }
                });
                await Promise.all(fetchPromises);

                // Second pass: build enriched contact rows
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const company = companyCache.get(data.companyId) || {};

                    contactData.push({
                        id: docSnap.id,
                        firstName: data.firstName || "",
                        lastName: data.lastName || "",
                        email: data.email || "",
                        phone: data.phone || "",
                        companyId: data.companyId || "",
                        companyName: data.companyName || company.businessName || "Unknown",
                        role: data.role || undefined,
                        isPrimary: data.isPrimary ?? false,
                        unsubscribed: data.unsubscribed || false,
                        notes: data.notes || "",
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
                        createdBy: data.createdBy,
                        emailEngagement: data.emailEngagement,
                        sequenceHistory: data.sequenceHistory || undefined,
                        // Denormalized company fields
                        _companyStatus: company.status || "new",
                        _companyLeadType: company.leadType,
                        _companyFacilityType: company.facilityType,
                        _companyAddress: company.address,
                        _companyCity: company.city,
                        _companyState: company.state,
                        _companyZip: company.zip,
                        _companyAttribution: company.attribution,
                        _companyOutreachStatus: company.outreachStatus,
                        _companyPreferredAuditTimes: company.preferredAuditTimes,
                    } as ContactRow);
                });
                setContacts(contactData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching contacts:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedLeads(new Set(filteredContacts.map((l: any) => l.id!)));
        } else {
            setSelectedLeads(new Set());
        }
    };

    const handleSelectLead = (contactId: string, checked: boolean) => {
        const newSelected = new Set(selectedLeads);
        if (checked) {
            newSelected.add(contactId);
        } else {
            newSelected.delete(contactId);
        }
        setSelectedLeads(newSelected);
    };

    // Bulk update status — updates the COMPANY, not the contact
    const handleBulkStatusUpdate = async () => {
        if (!bulkStatus || selectedLeads.size === 0) return;
        setUpdatingStatus(true);
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        try {
            // Resolve unique companyIds for selected contacts
            const companyIds = new Set(
                ids.map(id => contacts.find(c => c.id === id)?.companyId).filter(Boolean) as string[]
            );
            const companyArr = Array.from(companyIds);
            for (let i = 0; i < companyArr.length; i += BATCH_LIMIT) {
                const chunk = companyArr.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(companyId => {
                    batch.update(doc(db, "companies", companyId), { status: bulkStatus });
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setBulkStatus("");
        } catch (error) {
            console.error("Error updating status:", error);
            window.alert(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const deleteConfirmPhrase = `Delete ${selectedLeads.size} contacts`;

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        setDeleting(true);
        try {
            for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
                const chunk = ids.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(contactId => {
                    batch.delete(doc(db, "contacts", contactId));
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setShowDeleteDialog(false);
            setDeleteConfirmText("");
        } catch (error: any) {
            console.error("Error deleting contacts:", error);
            setShowDeleteDialog(false);
            setDeleteConfirmText("");
            window.alert(
                error?.code === 'permission-denied'
                    ? 'Delete failed: Your account does not have permission to delete contacts.'
                    : `Delete failed: ${error?.message || 'Unknown error'}`
            );
        } finally {
            setDeleting(false);
        }
    };

    const handleBulkLeadTypeUpdate = async () => {
        if (!bulkLeadType || selectedLeads.size === 0) return;
        setUpdatingType(true);
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        try {
            const companyIds = new Set(
                ids.map(id => contacts.find(c => c.id === id)?.companyId).filter(Boolean) as string[]
            );
            const companyArr = Array.from(companyIds);
            for (let i = 0; i < companyArr.length; i += BATCH_LIMIT) {
                const chunk = companyArr.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(companyId => {
                    batch.update(doc(db, "companies", companyId), { leadType: bulkLeadType });
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
            setBulkLeadType("");
        } catch (error) {
            console.error("Error updating lead types:", error);
            window.alert(`Failed to update type: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUpdatingType(false);
        }
    };

    // ─── Bulk sequence enrollment ────────────────────────────
    const openBulkSequenceDialog = useCallback(async () => {
        setShowBulkSequenceDialog(true);
        setLoadingBulkSequences(true);
        setBulkSequenceProgress(null);
        try {
            const seqSnap = await getDocs(collection(db, 'sequences'));
            const allSeqs = seqSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Only show lead-appropriate sequences — exclude vendor sequences
            const LEAD_CATEGORIES = ['lead', 'referral', 'custom'];
            setBulkSequences(allSeqs.filter((s: any) => !s.category || LEAD_CATEGORIES.includes(s.category)));
        } catch (err) {
            console.error('Error loading sequences:', err);
        } finally {
            setLoadingBulkSequences(false);
        }
    }, []);

    const handleBulkStartSequence = async () => {
        if (!bulkSelectedSequenceId || selectedLeads.size === 0) return;
        setEnrollingSequence(true);
        const startSequence = httpsCallable(functions, 'startLeadSequence');
        const ids = Array.from(selectedLeads);
        const eligibleContacts = ids
            .map(id => contacts.find(c => c.id === id))
            .filter(c => c && c.email && c.companyId) as ContactRow[];

        const progress = { done: 0, total: eligibleContacts.length, errors: [] as string[] };
        setBulkSequenceProgress({ ...progress });

        for (const contact of eligibleContacts) {
            try {
                await startSequence({ leadId: contact.companyId, contactId: contact.id, sequenceId: bulkSelectedSequenceId });
            } catch (err: any) {
                progress.errors.push(`${contact.firstName} ${contact.lastName}: ${err.message || 'Failed'}`);
            }
            progress.done++;
            setBulkSequenceProgress({ ...progress });
        }

        setEnrollingSequence(false);
        if (progress.errors.length === 0) {
            setShowBulkSequenceDialog(false);
            setBulkSelectedSequenceId('');
            setSelectedLeads(new Set());
            setBulkSequenceProgress(null);
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

    const allSelected = filteredContacts.length > 0 && selectedLeads.size === filteredContacts.length;
    const someSelected = selectedLeads.size > 0 && selectedLeads.size < filteredContacts.length;

    // Pagination
    const totalPages = Math.ceil(filteredContacts.length / PAGE_SIZE);
    const paginatedContacts = filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) as ContactRow[];
    const startIdx = (currentPage - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(currentPage * PAGE_SIZE, filteredContacts.length);

    // Group paginated contacts by company
    const companyGroups = useMemo(() => {
        if (!groupByCompany) return null;
        const groups: { key: string; label: string; sublabel: string; contacts: { contact: ContactRow; globalIndex: number }[] }[] = [];
        const groupMap = new Map<string, typeof groups[0]>();

        paginatedContacts.forEach((contact, i) => {
            const key = contact.companyId || `__no_company_${contact.id}`;
            const label = contact.companyName || 'No company';
            const sublabel = [contact._companyCity, contact._companyState].filter(Boolean).join(', ');

            if (!groupMap.has(key)) {
                const group = { key, label, sublabel, contacts: [] as { contact: ContactRow; globalIndex: number }[] };
                groupMap.set(key, group);
                groups.push(group);
            }
            groupMap.get(key)!.contacts.push({ contact, globalIndex: startIdx + i - 1 });
        });

        return groups;
    }, [paginatedContacts, groupByCompany, startIdx]);

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
                    <p className="text-sm text-muted-foreground font-medium">Loading contacts…</p>
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
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-2 text-xs px-1.5 py-0 tabular-nums">
                            {filteredContacts.length}
                        </Badge>
                    </CardTitle>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedLeads.size > 0 && (
                <div className="px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg mb-2 flex items-center gap-2">
                    <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        className="mr-1"
                    />
                    <span className="text-sm font-semibold text-primary tabular-nums whitespace-nowrap">
                        {selectedLeads.size} selected
                    </span>

                    <div className="w-px h-5 bg-border mx-1" />

                    {/* ─── Inline quick-actions ─── */}
                    {!bulkAction && (
                        <div className="flex items-center gap-1 flex-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => setBulkAction('status')}>
                                <Edit className="w-3 h-3" /> Status
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => setBulkAction('type')}>
                                <Tag className="w-3 h-3" /> Type
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={openBulkSequenceDialog}>
                                <Play className="w-3 h-3" /> Sequence
                            </Button>
                            <div className="w-px h-5 bg-border mx-1" />
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
                                <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                        </div>
                    )}

                    {/* ─── Status inline picker ─── */}
                    {bulkAction === 'status' && (
                        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2 duration-150">
                            <Select value={bulkStatus} onValueChange={(v: string) => setBulkStatus(v as LeadStatus)}>
                                <SelectTrigger className="w-[160px] h-7 text-xs">
                                    <SelectValue placeholder="Choose status…" />
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
                            <Button size="sm" className="h-7 text-xs" onClick={handleBulkStatusUpdate} disabled={!bulkStatus || updatingStatus}>
                                {updatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setBulkAction(null); setBulkStatus(''); }}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {/* ─── Type inline picker ─── */}
                    {bulkAction === 'type' && (
                        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2 duration-150">
                            <Select value={bulkLeadType} onValueChange={(v: string) => setBulkLeadType(v as LeadType)}>
                                <SelectTrigger className="w-[180px] h-7 text-xs">
                                    <SelectValue placeholder="Choose type…" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="direct">Direct</SelectItem>
                                    <SelectItem value="tenant">Tenant</SelectItem>
                                    <SelectItem value="referral_partnership">Referral Partnership</SelectItem>
                                    <SelectItem value="enterprise">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 text-xs" onClick={handleBulkLeadTypeUpdate} disabled={!bulkLeadType || updatingType}>
                                {updatingType ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setBulkAction(null); setBulkLeadType(''); }}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {/* ─── Clear all ─── */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedLeads(new Set()); setBulkAction(null); }}
                        className="h-7 text-xs px-2 ml-auto text-muted-foreground"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            {/* Status Badge Filters */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5">
                {(() => {
                    const statuses: { value: LeadStatus | 'all'; label: string; color: string }[] = [
                        { value: 'all', label: 'All', color: 'bg-secondary text-secondary-foreground' },
                        { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
                        { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
                        { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
                        { value: 'walkthrough', label: 'Walkthrough', color: 'bg-indigo-100 text-indigo-700' },
                        { value: 'proposal', label: 'Proposal', color: 'bg-orange-100 text-orange-700' },
                        { value: 'quoted', label: 'Quoted', color: 'bg-pink-100 text-pink-700' },
                        { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
                        { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
                    ];
                    const counts = contacts.reduce((acc, c) => {
                        const s = (c as any)._companyStatus || 'new';
                        acc[s] = (acc[s] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    return statuses.map(s => {
                        const count = s.value === 'all' ? contacts.length : (counts[s.value] || 0);
                        if (s.value !== 'all' && count === 0) return null;
                        const isActive = statusFilter === s.value;
                        return (
                            <button
                                key={s.value}
                                onClick={() => setStatusFilter(s.value as LeadStatus | 'all')}
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
                    });
                })()}
            </div>

            <div className="px-3 py-2 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by contact, company, email, or location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Clear search"
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

            {/* Email Engagement Funnel Summary */}
            {contacts.length > 0 && (
                <EmailFunnelSummary contacts={contacts} />
            )}

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {filteredContacts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No matching contacts</p>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block flex-1 overflow-auto">
                            <table className="w-full caption-bottom text-sm text-foreground table-fixed">
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
                                        {visibleColumns.has('contact') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '22%'}}>Contact</TableHead>}
                                        {visibleColumns.has('business') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '18%'}}>Company</TableHead>}
                                        {visibleColumns.has('type') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '8%'}}>Type</TableHead>}
                                        {visibleColumns.has('location') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '16%'}}>Location</TableHead>}
                                        {visibleColumns.has('auditTime') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '8%'}}>Audit Time</TableHead>}
                                        {visibleColumns.has('status') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '10%'}}>Status</TableHead>}
                                        {visibleColumns.has('source') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '8%'}}>Source</TableHead>}
                                        {visibleColumns.has('created') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '9%'}}>Created</TableHead>}
                                        {visibleColumns.has('actions') && <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs" style={{width: '12%'}}></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupByCompany && companyGroups ? (
                                        companyGroups.map(group => (
                                            <Fragment key={group.key}>
                                                {group.contacts.length === 1 ? (
                                                    /* Single contact — render flat row, no group header */
                                                    <LeadRow
                                                        key={group.contacts[0].contact.id}
                                                        lead={group.contacts[0].contact}
                                                        index={group.contacts[0].globalIndex}
                                                        isSelected={selectedLeads.has(group.contacts[0].contact.id!)}
                                                        onSelect={(checked) => handleSelectLead(group.contacts[0].contact.id!, checked)}
                                                        onRowClick={onRowClick}
                                                        visibleColumns={visibleColumns}
                                                    />
                                                ) : (
                                                    /* Multiple contacts — show collapsible group header */
                                                    <>
                                                        <TableRow
                                                            key={`group-${group.key}`}
                                                            className="cursor-pointer hover:bg-muted/50 border-b bg-amber-500/5"
                                                            onClick={() => toggleGroup(group.key)}
                                                        >
                                                            <TableCell colSpan={visibleColumns.size + 2} className="py-1.5 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedGroups.has(group.key) ? '-rotate-90' : ''}`} />
                                                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <span className="text-xs font-medium">{group.label}</span>
                                                                    {group.sublabel && (
                                                                        <span className="text-xs text-muted-foreground">— {group.sublabel}</span>
                                                                    )}
                                                                    <Badge variant="default"
                                                                        className="text-[10px] px-1.5 py-0 h-4 ml-auto bg-amber-500 hover:bg-amber-600">
                                                                        {group.contacts.length} contacts
                                                                    </Badge>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                        {!collapsedGroups.has(group.key) && group.contacts.map(({ contact, globalIndex }) => (
                                                            <LeadRow
                                                                key={contact.id}
                                                                lead={contact}
                                                                index={globalIndex}
                                                                isSelected={selectedLeads.has(contact.id!)}
                                                                onSelect={(checked) => handleSelectLead(contact.id!, checked)}
                                                                onRowClick={onRowClick}
                                                                visibleColumns={visibleColumns}
                                                            />
                                                        ))}
                                                    </>
                                                )}
                                            </Fragment>
                                        ))
                                    ) : (
                                        paginatedContacts.map((contact, index) => (
                                            <LeadRow
                                                key={contact.id}
                                                lead={contact}
                                                index={startIdx + index - 1}
                                                isSelected={selectedLeads.has(contact.id!)}
                                                onSelect={(checked) => handleSelectLead(contact.id!, checked)}
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
                            {paginatedContacts.map((contact, index) => (
                                <LeadCard
                                    key={contact.id}
                                    lead={contact}
                                    index={startIdx + index - 1}
                                    isSelected={selectedLeads.has(contact.id!)}
                                    onSelect={(checked) => handleSelectLead(contact.id!, checked)}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                        <p className="text-sm text-muted-foreground">
                            Showing {startIdx}–{endIdx} of {filteredContacts.length} contacts
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
                            <span className="text-sm font-medium px-2 tabular-nums">
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
                        <AlertDialogTitle>Delete {selectedLeads.size} contact(s)?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>This action cannot be undone. This will permanently delete the selected contacts from the database.</p>
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
                                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting…</>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Sequence Enrollment Dialog */}
            <AlertDialog open={showBulkSequenceDialog} onOpenChange={(open: boolean) => { setShowBulkSequenceDialog(open); if (!open) { setBulkSelectedSequenceId(''); setBulkSequenceProgress(null); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-primary" />
                            Enroll {selectedLeads.size} contact(s) in sequence
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                {(() => {
                                    const ids = Array.from(selectedLeads);
                                    const eligible = ids.filter(id => { const c = contacts.find(ct => ct.id === id); return c && c.email && c.companyId; });
                                    const skipped = ids.length - eligible.length;
                                    return (
                                        <>
                                            <p className="text-sm">
                                                {eligible.length} contact{eligible.length !== 1 ? 's' : ''} with email will be enrolled.
                                                {skipped > 0 && <span className="text-amber-600 font-medium"> {skipped} skipped (no email).</span>}
                                            </p>
                                            {loadingBulkSequences ? (
                                                <div className="flex items-center gap-2 py-4 justify-center">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm text-muted-foreground">Loading sequences…</span>
                                                </div>
                                            ) : (
                                                <Select value={bulkSelectedSequenceId} onValueChange={setBulkSelectedSequenceId}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select a sequence…" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {bulkSequences.map(seq => (
                                                            <SelectItem key={seq.id} value={seq.id}>
                                                                <div className="flex flex-col">
                                                                    <span>{seq.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{seq.steps?.length || 0} steps{seq.description ? ` · ${seq.description}` : ''}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {bulkSequenceProgress && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>Enrolling…</span>
                                                        <span className="tabular-nums">{bulkSequenceProgress.done}/{bulkSequenceProgress.total}</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${(bulkSequenceProgress.done / bulkSequenceProgress.total) * 100}%` }} />
                                                    </div>
                                                    {bulkSequenceProgress.errors.length > 0 && (
                                                        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded max-h-20 overflow-y-auto">
                                                            {bulkSequenceProgress.errors.map((e, i) => <div key={i}>{e}</div>)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={enrollingSequence}>Cancel</AlertDialogCancel>
                        <Button onClick={handleBulkStartSequence} disabled={enrollingSequence || !bulkSelectedSequenceId} className="gap-2">
                            {enrollingSequence ? <><Loader2 className="w-4 h-4 animate-spin" /> Enrolling…</> : <><Play className="w-4 h-4" /> Start Sequence</>}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
