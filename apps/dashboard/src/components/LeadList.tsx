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
import { Users, Loader2, X, Search, Trash2, Edit, ChevronLeft, ChevronRight, ChevronDown, Building2, Settings2, Tag, Play, Mail, Send } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { collection, getCountFromServer, query, orderBy, doc, writeBatch, getDoc, getDocs, limit, startAfter, where } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { isAuthRelatedError, reportAuthRequired } from "@/lib/authRecovery";
import { LeadStatus, LeadType } from "@xiri-facility-solutions/shared";
import { useFacilityTypes } from "@/lib/facilityTypes";
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


export type EngagementFilter = 'clicked' | 'opened' | 'delivered' | 'bounced' | null;
type ContactLifecycleFilter = 'active' | 'held' | 'suppressed' | 'all';
type CompanyStageFilter = LeadStatus | 'all';

const CONTACTED_OUTREACH_STATUSES = new Set([
    'PENDING',
    'IN_PROGRESS',
    'SENT',
    'COMPLETED',
    'FAILED',
    'BOUNCED',
    'SPAM_COMPLAINT',
    'NEEDS_MANUAL',
]);

const CONTACTED_EMAIL_EVENTS = new Set([
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'spam',
]);

function resolveLifecycleStatus(contact: Partial<ContactRow>): Exclude<ContactLifecycleFilter, 'all'> | 'review' | 'duplicate' | 'archived' {
    if (contact.lifecycleStatus) return contact.lifecycleStatus as any;
    if (contact.unsubscribed) return 'suppressed';
    return 'active';
}

function resolveCompanyStage(company: any, contact: any): LeadStatus {
    const storedStatus = typeof company?.status === 'string' ? company.status : 'new';
    if (storedStatus !== 'new') return storedStatus as LeadStatus;

    const outreachStatus = typeof company?.outreachStatus === 'string' ? company.outreachStatus : null;
    const companyEvent = typeof company?.emailEngagement?.lastEvent === 'string' ? company.emailEngagement.lastEvent : null;
    const contactEvent = typeof contact?.emailEngagement?.lastEvent === 'string' ? contact.emailEngagement.lastEvent : null;
    const hasSequenceHistory = !!contact?.sequenceHistory && Object.keys(contact.sequenceHistory).length > 0;

    if (
        (outreachStatus && CONTACTED_OUTREACH_STATUSES.has(outreachStatus)) ||
        (companyEvent && CONTACTED_EMAIL_EVENTS.has(companyEvent)) ||
        (contactEvent && CONTACTED_EMAIL_EVENTS.has(contactEvent)) ||
        hasSequenceHistory
    ) {
        return 'contacted';
    }

    return 'new';
}

interface LeadListProps {
    statusFilters?: LeadStatus[];
    title?: string;
    onRowClick?: (id: string) => void;
    engagementFilter?: EngagementFilter;
}

export default function LeadList({
    statusFilters,
    title = "Sales Pipeline",
    onRowClick,
    engagementFilter,
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
    const [updatingLifecycle, setUpdatingLifecycle] = useState(false);
    const [lifecycleFilter, setLifecycleFilter] = useState<ContactLifecycleFilter>('active');
    const [lifecycleCounts, setLifecycleCounts] = useState<Record<ContactLifecycleFilter, number>>({
        active: 0,
        held: 0,
        suppressed: 0,
        all: 0,
    });
    // Bulk sequence
    const [showBulkSequenceDialog, setShowBulkSequenceDialog] = useState(false);
    const [bulkSequences, setBulkSequences] = useState<{id:string;name:string;description?:string;steps:any[]}[]>([]);
    const [bulkSelectedSequenceId, setBulkSelectedSequenceId] = useState('');
    const [enrollingSequence, setEnrollingSequence] = useState(false);
    const [loadingBulkSequences, setLoadingBulkSequences] = useState(false);
    const [bulkSequenceProgress, setBulkSequenceProgress] = useState<{done:number;total:number;errors:string[]}|null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;
    const SERVER_PAGE_SIZE = 120;
    const [totalCount, setTotalCount] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [groupByCompany, setGroupByCompany] = useState(false);
    const companyCacheRef = useRef<Map<string, any>>(new Map());
    const pageCursorRef = useRef<Record<number, any>>({});
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pipeline-columns');
            if (saved) {
                try { return new Set(JSON.parse(saved) as ColumnKey[]); } catch { }
            }
        }
        return new Set(DEFAULT_VISIBLE);
    });
    const { facilityTypeLabels } = useFacilityTypes();

    const {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredLeads: filteredContacts,
        resetFilters,
        hasActiveFilters
    } = useLeadFilter(contacts as any, statusFilters, engagementFilter);

    const hasAnyFilters = hasActiveFilters || lifecycleFilter !== 'active';
    const requiresFullDataset = searchQuery.trim() !== '' || statusFilter !== 'all' || !!engagementFilter;

    const hydrateContacts = useCallback(async (docSnaps: any[]): Promise<ContactRow[]> => {
        const companyIdsToFetch = new Set<string>();

        docSnaps.forEach((docSnap) => {
            const data = docSnap.data();
            const companyId = data.companyId;
            if (companyId && !companyCacheRef.current.has(companyId)) {
                companyIdsToFetch.add(companyId);
            }
        });

        await Promise.all(Array.from(companyIdsToFetch).map(async (companyId) => {
            try {
                const companyDoc = await getDoc(doc(db, "companies", companyId));
                if (companyDoc.exists()) {
                    companyCacheRef.current.set(companyId, companyDoc.data());
                }
            } catch (error) {
                console.error(`Failed to hydrate company ${companyId}:`, error);
            }
        }));

        return docSnaps.map((docSnap) => {
            const data = docSnap.data();
            const company = companyCacheRef.current.get(data.companyId) || {};

            return {
                id: docSnap.id,
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                email: data.email || "",
                phone: data.phone || "",
                companyId: data.companyId || "",
                companyName: data.companyName || company.businessName || "Unknown",
                role: data.role || undefined,
                isPrimary: data.isPrimary ?? false,
                lifecycleStatus: data.lifecycleStatus || (data.unsubscribed ? 'suppressed' : 'active'),
                lifecycleReason: data.lifecycleReason || null,
                holdUntilAt: data.holdUntilAt || null,
                holdCreatedAt: data.holdCreatedAt || null,
                lifecycleUpdatedAt: data.lifecycleUpdatedAt || null,
                reviewReasons: data.reviewReasons || [],
                duplicateOfContactId: data.duplicateOfContactId || null,
                unsubscribed: data.unsubscribed || false,
                notes: data.notes || "",
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
                createdBy: data.createdBy,
                emailEngagement: data.emailEngagement,
                sequenceHistory: data.sequenceHistory || undefined,
                _companyStatus: resolveCompanyStage(company, data),
                _companyLeadType: company.leadType,
                _companyFacilityType: company.facilityType,
                _companyAddress: company.address,
                _companyCity: company.city,
                _companyState: company.state,
                _companyZip: company.zip,
                _companyAttribution: company.attribution,
                _companyOutreachStatus: company.outreachStatus,
                _companyPreferredAuditTimes: company.preferredAuditTimes,
            } as ContactRow;
        });
    }, []);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedLeads(new Set());
        pageCursorRef.current = {};
    }, [lifecycleFilter, requiresFullDataset]);

    useEffect(() => {
        if (!requiresFullDataset) return;
        setCurrentPage(1);
        setSelectedLeads(new Set());
    }, [searchQuery, statusFilter, engagementFilter, requiresFullDataset]);

    useEffect(() => {
        let cancelled = false;

        const loadLifecycleCounts = async () => {
            const contactsRef = collection(db, "contacts");
            const [allSnap, heldSnap, suppressedSnap, reviewSnap, duplicateSnap, archivedSnap] = await Promise.all([
                getCountFromServer(contactsRef),
                getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "held"))),
                getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "suppressed"))),
                getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "review"))),
                getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "duplicate"))),
                getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "archived"))),
            ]);

            const all = allSnap.data().count;
            const held = heldSnap.data().count;
            const suppressed = suppressedSnap.data().count;
            const review = reviewSnap.data().count;
            const duplicate = duplicateSnap.data().count;
            const archived = archivedSnap.data().count;
            const active = Math.max(0, all - held - suppressed - review - duplicate - archived);

            if (cancelled) return;
            setLifecycleCounts({ active, held, suppressed, all });
            if (!requiresFullDataset) {
                setTotalCount(
                    lifecycleFilter === "all"
                        ? all
                        : lifecycleFilter === "active"
                            ? active
                            : lifecycleFilter === "held"
                                ? held
                                : suppressed
                );
            }
        };

        const loadServerPage = async () => {
            const contactsRef = collection(db, "contacts");
            const previousCursor = currentPage === 1 ? null : pageCursorRef.current[currentPage - 1];
            let scannedCursor = previousCursor;
            let pageRows: ContactRow[] = [];
            let exhausted = false;

            while (pageRows.length < PAGE_SIZE && !exhausted) {
                const constraints: any[] = [];
                if (lifecycleFilter === "held" || lifecycleFilter === "suppressed") {
                    constraints.push(where("lifecycleStatus", "==", lifecycleFilter));
                }
                constraints.push(orderBy("createdAt", "desc"));
                if (scannedCursor) constraints.push(startAfter(scannedCursor));
                constraints.push(limit(SERVER_PAGE_SIZE));

                const snapshot = await getDocs(query(contactsRef, ...constraints));
                if (snapshot.empty) {
                    exhausted = true;
                    break;
                }

                scannedCursor = snapshot.docs[snapshot.docs.length - 1];
                let rows = await hydrateContacts(snapshot.docs);
                if (lifecycleFilter === "active") {
                    rows = rows.filter((contact) => resolveLifecycleStatus(contact) === "active");
                } else if (lifecycleFilter !== "all" && lifecycleFilter !== "held" && lifecycleFilter !== "suppressed") {
                    rows = rows.filter((contact) => resolveLifecycleStatus(contact) === lifecycleFilter);
                }

                pageRows = [...pageRows, ...rows].slice(0, PAGE_SIZE);
                if (snapshot.size < SERVER_PAGE_SIZE) {
                    exhausted = true;
                }
            }

            if (cancelled) return;
            pageCursorRef.current[currentPage] = scannedCursor;
            setContacts(pageRows);
            setHasNextPage(!exhausted);
        };

        const loadFullDataset = async () => {
            const snapshot = await getDocs(query(collection(db, "contacts"), orderBy("createdAt", "desc")));
            let rows = await hydrateContacts(snapshot.docs);
            if (lifecycleFilter !== "all") {
                rows = rows.filter((contact) => resolveLifecycleStatus(contact) === lifecycleFilter);
            }
            if (cancelled) return;
            setContacts(rows);
            setHasNextPage(false);
            setTotalCount(rows.length);
        };

        const run = async () => {
            setLoading(true);
            try {
                await loadLifecycleCounts();
                if (requiresFullDataset) {
                    await loadFullDataset();
                } else {
                    await loadServerPage();
                }
            } catch (error) {
                console.error("Error fetching contacts:", error);
                if (isAuthRelatedError(error)) {
                    reportAuthRequired("Contacts could not be loaded because your session is no longer authorized.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();
        return () => { cancelled = true; };
    }, [currentPage, lifecycleFilter, requiresFullDataset, hydrateContacts]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedLeads(new Set(displayedContacts.map((l: any) => l.id!)));
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
            if (isAuthRelatedError(error)) {
                reportAuthRequired("Your session expired while updating contact status.");
            }
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
            if (isAuthRelatedError(error)) {
                reportAuthRequired("Your session expired while deleting contacts.");
            }
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
            if (isAuthRelatedError(error)) {
                reportAuthRequired("Your session expired while updating company type.");
            }
            window.alert(`Failed to update type: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUpdatingType(false);
        }
    };

    const handleBulkLifecycleUpdate = async (nextStatus: 'active' | 'held', holdMonths?: 4 | 6) => {
        if (selectedLeads.size === 0) return;
        setUpdatingLifecycle(true);
        const ids = Array.from(selectedLeads);
        const BATCH_LIMIT = 499;
        const now = new Date();
        const holdUntil = holdMonths ? new Date(now.getFullYear(), now.getMonth() + holdMonths, now.getDate()) : null;
        try {
            for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
                const chunk = ids.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);
                chunk.forEach(contactId => {
                    const update: Record<string, any> = {
                        lifecycleStatus: nextStatus,
                        lifecycleUpdatedAt: now,
                        lifecycleReason: nextStatus === 'held' ? 'not_currently_looking' : null,
                        holdUntilAt: nextStatus === 'held' ? holdUntil : null,
                        holdCreatedAt: nextStatus === 'held' ? now : null,
                    };
                    batch.update(doc(db, "contacts", contactId), update);
                });
                await batch.commit();
            }
            setSelectedLeads(new Set());
        } catch (error) {
            console.error("Error updating contact lifecycle:", error);
            if (isAuthRelatedError(error)) {
                reportAuthRequired("Your session expired while updating contact lifecycle.");
            }
            window.alert(`Failed to update contact lifecycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUpdatingLifecycle(false);
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

    const displayedContacts = requiresFullDataset ? filteredContacts as ContactRow[] : contacts;
    const allSelected = displayedContacts.length > 0 && selectedLeads.size === displayedContacts.length;
    const someSelected = selectedLeads.size > 0 && selectedLeads.size < displayedContacts.length;

    // Pagination
    const totalPages = requiresFullDataset ? Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE)) : Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const paginatedContacts = requiresFullDataset
        ? filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) as ContactRow[]
        : contacts;
    const startIdx = (currentPage - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(startIdx + paginatedContacts.length - 1, requiresFullDataset ? filteredContacts.length : totalCount);

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

    const companyStageOptions = useMemo(
        (): { value: CompanyStageFilter; label: string; color: string }[] => [
            { value: 'all', label: 'All', color: 'bg-secondary text-secondary-foreground' },
            { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
            { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
            { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
            { value: 'walkthrough', label: 'Walkthrough', color: 'bg-indigo-100 text-indigo-700' },
            { value: 'proposal', label: 'Proposal', color: 'bg-orange-100 text-orange-700' },
            { value: 'quoted', label: 'Quoted', color: 'bg-pink-100 text-pink-700' },
            { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
            { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
        ],
        []
    );

    const companyStageCounts = useMemo(() => {
        return contacts.reduce((acc, contact) => {
            const stage = (contact as any)._companyStatus || 'new';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [contacts]);

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
                            {requiresFullDataset ? filteredContacts.length : totalCount}
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => handleBulkLifecycleUpdate('held', 4)} disabled={updatingLifecycle}>
                                {updatingLifecycle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Hold 4m
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => handleBulkLifecycleUpdate('held', 6)} disabled={updatingLifecycle}>
                                {updatingLifecycle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Hold 6m
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => handleBulkLifecycleUpdate('active')} disabled={updatingLifecycle}>
                                {updatingLifecycle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Activate
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

            <div className="px-3 pt-2">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Contact Lifecycle
                </p>
                <div className="flex flex-wrap gap-1.5">
                {(() => {
                    const lifecycles: { value: ContactLifecycleFilter; label: string; color: string }[] = [
                        { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
                        { value: 'held', label: 'Held', color: 'bg-amber-100 text-amber-900' },
                        { value: 'suppressed', label: 'Suppressed', color: 'bg-red-100 text-red-800' },
                        { value: 'all', label: 'All', color: 'bg-secondary text-secondary-foreground' },
                    ];
                    return lifecycles.map(item => {
                        const count = lifecycleCounts[item.value] || 0;
                        if (item.value !== 'all' && count === 0) return null;
                        const isActive = lifecycleFilter === item.value;
                        return (
                            <button
                                key={item.value}
                                onClick={() => { setLifecycleFilter(item.value); setCurrentPage(1); }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                                    ${isActive
                                        ? `${item.color} ring-2 ring-offset-1 ring-primary/30 shadow-sm`
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                {item.label}
                                <span className={`tabular-nums text-[10px] ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    });
                })()}
                </div>
            </div>

            <div className="px-3 py-2">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Company Stage
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {requiresFullDataset
                            ? 'Counts reflect all matching contacts.'
                            : 'Counts are hidden until a stage filter or search loads the full dataset.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {companyStageOptions.map(s => {
                        const count = s.value === 'all' ? contacts.length : (companyStageCounts[s.value] || 0);
                        if (requiresFullDataset && s.value !== 'all' && count === 0) return null;
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
                                {requiresFullDataset ? (
                                    <span className={`tabular-nums text-[10px] ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                        {count}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
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
                    {hasAnyFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                resetFilters();
                                setLifecycleFilter('active');
                                setCurrentPage(1);
                            }}
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
                {displayedContacts.length === 0 ? (
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
                                                        facilityTypeLabels={facilityTypeLabels}
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
                                                                facilityTypeLabels={facilityTypeLabels}
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
                                                facilityTypeLabels={facilityTypeLabels}
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
                                    facilityTypeLabels={facilityTypeLabels}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                        <p className="text-sm text-muted-foreground">
                            Showing {startIdx}–{endIdx} of {requiresFullDataset ? filteredContacts.length : totalCount} contacts
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
                                disabled={requiresFullDataset ? currentPage === totalPages : !hasNextPage}
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
