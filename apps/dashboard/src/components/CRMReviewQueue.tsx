"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, functions } from "@/lib/firebase";
import { Contact } from "@xiri-facility-solutions/shared";
import {
    collection,
    deleteField,
    doc,
    getCountFromServer,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { AlertTriangle, Archive, Copy, Loader2, RefreshCcw, RotateCcw, UserCheck } from "lucide-react";
import { format } from "date-fns";

type ReviewBucket = "due_held" | "invalid_email" | "duplicates";

interface ReviewContact extends Contact {
    reviewReasons?: string[];
    duplicateOfContactId?: string | null;
}

const BUCKET_LABELS: Record<ReviewBucket, string> = {
    due_held: "Due Held",
    invalid_email: "Invalid Email",
    duplicates: "Duplicates",
};

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value?.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapReviewContact(docSnap: any): ReviewContact {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
        phone: data.phone || "",
        companyId: data.companyId || "",
        companyName: data.companyName || "Unknown",
        role: data.role,
        isPrimary: data.isPrimary ?? false,
        lifecycleStatus: data.lifecycleStatus || (data.unsubscribed ? "suppressed" : "active"),
        lifecycleReason: data.lifecycleReason || null,
        holdUntilAt: data.holdUntilAt || null,
        holdCreatedAt: data.holdCreatedAt || null,
        reviewReasons: data.reviewReasons || [],
        duplicateOfContactId: data.duplicateOfContactId || null,
        unsubscribed: data.unsubscribed || false,
        unsubscribedAt: data.unsubscribedAt || null,
        notes: data.notes || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt || null,
        emailEngagement: data.emailEngagement,
    };
}

function getReasonLabel(contact: ReviewContact) {
    if (contact.lifecycleStatus === "held") {
        const holdUntil = toDate(contact.holdUntilAt);
        return holdUntil ? `Hold expired ${format(holdUntil, "MMM d, yyyy")}` : "Hold expired";
    }

    if (contact.lifecycleStatus === "suppressed") {
        const event = contact.emailEngagement?.lastEvent;
        if (event === "bounced") return "Bounced email";
        if (event === "spam") return "Spam complaint";
        return "Suppressed contact";
    }

    if (contact.lifecycleStatus === "duplicate") {
        return "Exact email duplicate";
    }

    if (contact.reviewReasons?.includes("duplicate_name_candidate")) {
        return "Possible duplicate by name";
    }

    return contact.lifecycleReason || "Needs review";
}

interface CRMReviewQueueProps {
    onRowClick?: (contactId: string) => void;
}

export default function CRMReviewQueue({ onRowClick }: CRMReviewQueueProps) {
    const [activeBucket, setActiveBucket] = useState<ReviewBucket>("due_held");
    const [counts, setCounts] = useState<Record<ReviewBucket, number>>({
        due_held: 0,
        invalid_email: 0,
        duplicates: 0,
    });
    const [items, setItems] = useState<Record<ReviewBucket, ReviewContact[]>>({
        due_held: [],
        invalid_email: [],
        duplicates: [],
    });
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [updating, setUpdating] = useState(false);
    const [refreshingDuplicates, setRefreshingDuplicates] = useState(false);

    const loadCounts = useCallback(async () => {
        const now = new Date();
        const contactsRef = collection(db, "contacts");
        const [
            dueHeldCount,
            invalidCount,
            duplicateStatusCount,
            duplicateNameCount,
        ] = await Promise.all([
            getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "held"), where("holdUntilAt", "<=", now))),
            getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "suppressed"))),
            getCountFromServer(query(contactsRef, where("lifecycleStatus", "==", "duplicate"))),
            getCountFromServer(query(contactsRef, where("reviewReasons", "array-contains", "duplicate_name_candidate"))),
        ]);

        setCounts({
            due_held: dueHeldCount.data().count,
            invalid_email: invalidCount.data().count,
            duplicates: duplicateStatusCount.data().count + duplicateNameCount.data().count,
        });
    }, []);

    const loadBucket = useCallback(async (bucket: ReviewBucket) => {
        const contactsRef = collection(db, "contacts");
        const now = new Date();

        if (bucket === "due_held") {
            const snap = await getDocs(query(
                contactsRef,
                where("lifecycleStatus", "==", "held"),
                where("holdUntilAt", "<=", now),
                orderBy("holdUntilAt", "asc"),
                limit(100),
            ));
            return snap.docs.map(mapReviewContact);
        }

        if (bucket === "invalid_email") {
            const snap = await getDocs(query(
                contactsRef,
                where("lifecycleStatus", "==", "suppressed"),
                limit(100),
            ));
            return snap.docs.map(mapReviewContact).sort((a, b) => {
                const aDate = toDate(a.lifecycleUpdatedAt)?.getTime() || 0;
                const bDate = toDate(b.lifecycleUpdatedAt)?.getTime() || 0;
                return bDate - aDate;
            });
        }

        const [duplicateSnap, duplicateNameSnap] = await Promise.all([
            getDocs(query(contactsRef, where("lifecycleStatus", "==", "duplicate"), limit(50))),
            getDocs(query(contactsRef, where("reviewReasons", "array-contains", "duplicate_name_candidate"), limit(50))),
        ]);

        const deduped = new Map<string, ReviewContact>();
        [...duplicateSnap.docs, ...duplicateNameSnap.docs].forEach((docSnap) => {
            deduped.set(docSnap.id, mapReviewContact(docSnap));
        });

        return Array.from(deduped.values()).sort((a, b) => {
            const aDate = toDate(a.lifecycleUpdatedAt || a.updatedAt || a.createdAt)?.getTime() || 0;
            const bDate = toDate(b.lifecycleUpdatedAt || b.updatedAt || b.createdAt)?.getTime() || 0;
            return bDate - aDate;
        });
    }, []);

    const loadData = useCallback(async (bucket: ReviewBucket) => {
        setLoading(true);
        try {
            const [bucketItems] = await Promise.all([
                loadBucket(bucket),
                loadCounts(),
            ]);
            setItems((prev) => ({ ...prev, [bucket]: bucketItems }));
        } finally {
            setLoading(false);
        }
    }, [loadBucket, loadCounts]);

    useEffect(() => {
        void loadData(activeBucket);
    }, [activeBucket, loadData]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeBucket]);

    const visibleItems = items[activeBucket];
    const allSelected = visibleItems.length > 0 && visibleItems.every((item) => item.id && selectedIds.has(item.id));

    const toggleSelected = (contactId: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(contactId);
            else next.delete(contactId);
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(visibleItems.map((item) => item.id!).filter(Boolean)));
    };

    const handleBulkUpdate = async (builder: (contact: ReviewContact) => Record<string, any>) => {
        if (selectedIds.size === 0) return;
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            for (const contact of visibleItems) {
                if (!contact.id || !selectedIds.has(contact.id)) continue;
                batch.update(doc(db, "contacts", contact.id), builder(contact));
            }
            await batch.commit();
            setSelectedIds(new Set());
            await loadData(activeBucket);
        } finally {
            setUpdating(false);
        }
    };

    const handleSingleUpdate = async (contactId: string, update: Record<string, any>) => {
        setUpdating(true);
        try {
            await updateDoc(doc(db, "contacts", contactId), update);
            await loadData(activeBucket);
        } finally {
            setUpdating(false);
        }
    };

    const handleRefreshDuplicates = async () => {
        setRefreshingDuplicates(true);
        try {
            const callable = httpsCallable(functions, "refreshContactReviewQueue");
            await callable({});
            await loadData(activeBucket);
        } finally {
            setRefreshingDuplicates(false);
        }
    };

    const bucketDescription = useMemo(() => {
        switch (activeBucket) {
            case "due_held":
                return "Contacts whose hold window has expired and are ready to reactivate.";
            case "invalid_email":
                return "Suppressed contacts with bounced or blocked outreach that need fixing or archiving.";
            case "duplicates":
                return "Exact duplicates and same-name duplicate candidates that need approval.";
        }
    }, [activeBucket]);

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-base">Contact Review Queue</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{bucketDescription}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => void loadData(activeBucket)}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleRefreshDuplicates}
                            disabled={refreshingDuplicates}
                        >
                            {refreshingDuplicates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                            Refresh Duplicates
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Tabs value={activeBucket} onValueChange={(value) => setActiveBucket(value as ReviewBucket)}>
                    <TabsList className="grid w-full grid-cols-3">
                        {(["due_held", "invalid_email", "duplicates"] as ReviewBucket[]).map((bucket) => (
                            <TabsTrigger key={bucket} value={bucket} className="gap-2">
                                <span>{BUCKET_LABELS[bucket]}</span>
                                <Badge variant="secondary" className="tabular-nums">
                                    {counts[bucket]}
                                </Badge>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                        <span className="text-sm font-medium">{selectedIds.size} selected</span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => void handleBulkUpdate(() => ({
                                lifecycleStatus: "active",
                                lifecycleReason: null,
                                lifecycleUpdatedAt: new Date(),
                                holdUntilAt: null,
                                holdCreatedAt: null,
                                reviewReasons: deleteField(),
                                duplicateOfContactId: null,
                            }))}
                            disabled={updating}
                        >
                            <UserCheck className="w-3.5 h-3.5" />
                            Activate
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => void handleBulkUpdate((contact) => ({
                                lifecycleStatus: "duplicate",
                                lifecycleReason: "manual_duplicate",
                                lifecycleUpdatedAt: new Date(),
                                duplicateOfContactId: contact.duplicateOfContactId || null,
                            }))}
                            disabled={updating}
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Mark Duplicate
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => void handleBulkUpdate(() => ({
                                lifecycleStatus: "archived",
                                lifecycleReason: "review_archive",
                                lifecycleUpdatedAt: new Date(),
                            }))}
                            disabled={updating}
                        >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={updating}
                        >
                            Clear
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading review queue…
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No contacts in this review bucket.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <div className="hidden grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1fr)_180px_140px] items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                            <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} aria-label="Select all review contacts" />
                            <span>Contact</span>
                            <span>Company</span>
                            <span>Reason</span>
                            <span>Actions</span>
                        </div>
                        <div className="divide-y">
                            {visibleItems.map((contact) => {
                                const displayName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.email;
                                return (
                                    <div
                                        key={contact.id}
                                        className="grid gap-3 px-4 py-3 md:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1fr)_180px_140px] md:items-center"
                                    >
                                        <div className="pt-1 md:pt-0">
                                            <Checkbox
                                                checked={contact.id ? selectedIds.has(contact.id) : false}
                                                onCheckedChange={(checked) => contact.id && toggleSelected(contact.id, Boolean(checked))}
                                                aria-label={`Select ${displayName}`}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <button
                                                type="button"
                                                className="text-left"
                                                onClick={() => contact.id && onRowClick?.(contact.id)}
                                            >
                                                <div className="truncate font-medium text-foreground">{displayName}</div>
                                                <div className="truncate text-sm text-muted-foreground">{contact.email || "No email"}</div>
                                                {contact.role && <div className="truncate text-xs text-muted-foreground">{contact.role}</div>}
                                            </button>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{contact.companyName || "Unknown"}</div>
                                            <div className="truncate text-sm text-muted-foreground">{contact.companyId || "No company link"}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                            <span className="text-sm">{getReasonLabel(contact)}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
                                                onClick={() => contact.id && onRowClick?.(contact.id)}
                                            >
                                                Open
                                            </Button>
                                            {activeBucket === "due_held" && (
                                                <Button
                                                    size="sm"
                                                    className="h-8 gap-1"
                                                    onClick={() => contact.id && void handleSingleUpdate(contact.id, {
                                                        lifecycleStatus: "active",
                                                        lifecycleReason: null,
                                                        lifecycleUpdatedAt: new Date(),
                                                        holdUntilAt: null,
                                                        holdCreatedAt: null,
                                                    })}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Activate
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
