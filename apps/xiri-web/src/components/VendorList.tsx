"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, ExternalLink, Check, X, Eye } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
// import { toast } from "sonner"; // TODO: Install sonner for notifications

interface Vendor {
    id: string;
    companyName?: string;
    name?: string;
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

    useEffect(() => {
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const vendorData: Vendor[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() as Vendor;
                    const status = data.status || "PENDING_REVIEW";

                    // Client-side filtering logic
                    if (statusFilters) {
                        // Normalize status for comparison if needed, but strict string match is fine for now
                        if (statusFilters.includes(status)) {
                            vendorData.push({ id: doc.id, ...data });
                        }
                    } else {
                        vendorData.push({ id: doc.id, ...data });
                    }
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
    }, [statusFilters]);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "vendors", id), {
                status: newStatus,
                statusUpdatedAt: serverTimestamp()
            });
            console.log(`Vendor ${id} updated to ${newStatus}`);
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const getStatusColor = (status?: string) => {
        const s = status?.toUpperCase();
        if (s === "APPROVED") return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
        if (s === "REJECTED") return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
        if (s === "PENDING_REVIEW" || s === "SCRAPED") return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
        return "bg-gray-100 text-gray-800 border-gray-200";
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
                            {vendors.length}
                        </Badge>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {vendors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No vendors found</p>
                        <p className="text-sm">Try adjusting your filters or launch a new campaign.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View - Scrollable */}
                        <div className="hidden md:block flex-1 overflow-auto">
                            <table className="w-full caption-bottom text-sm text-foreground">
                                <TableHeader className="bg-muted/50 shadow-sm">
                                    <TableRow className="border-b border-border hover:bg-muted/50">
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 w-10 shadow-sm text-center text-xs">#</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Vendor</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Contact</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Rating</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">AI Score</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Status</TableHead>
                                        <TableHead className="sticky top-0 z-20 bg-card font-semibold text-muted-foreground h-9 shadow-sm text-center text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendors.map((vendor, index) => (
                                        <TableRow key={vendor.id} className="hover:bg-muted/50 transition-colors border-b border-border text-foreground">
                                            <TableCell className="py-2 text-center text-muted-foreground font-medium text-xs">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <div>
                                                    <div className="font-medium text-foreground text-sm">{vendor.companyName || vendor.name || "Unknown Vendor"}</div>
                                                    <div className="text-[10px] text-muted-foreground">{vendor.address || vendor.location}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <div className="flex flex-col items-center">
                                                    {vendor.phone && <div className="text-muted-foreground text-xs mb-0.5">{vendor.phone}</div>}
                                                    {vendor.website && (
                                                        <a
                                                            href={vendor.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary/80 flex items-center justify-center gap-1 text-[10px] font-medium"
                                                        >
                                                            Website <ExternalLink className="w-2 h-2" />
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <div className="flex justify-center">
                                                    {vendor.rating ? (
                                                        <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full w-fit">
                                                            <span className="text-yellow-500 text-[10px]">★</span>
                                                            <span className="font-medium text-xs text-yellow-700 dark:text-yellow-400">{vendor.rating.toFixed(1)}</span>
                                                            <span className="text-yellow-600/60 dark:text-yellow-400/60 text-[10px]">
                                                                ({vendor.totalRatings || 0})
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className={getScoreColor(vendor.aiScore || vendor.fitScore) + " text-xs"}>
                                                        {(vendor.aiScore || vendor.fitScore) ? `${vendor.aiScore || vendor.fitScore}/100` : "N/A"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-center">
                                                <Badge className={getStatusColor(vendor.status) + " shadow-none text-[10px] px-1.5 py-0 h-5"}>
                                                    {vendor.status || "Pending"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                                {showActions && (
                                                    <div className="flex justify-center gap-1.5">
                                                        {vendor.status === 'APPROVED' ? (
                                                            <Link href={`/crm/${vendor.id}`}>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 px-3 border-primary/20 text-primary hover:bg-primary/10 transition-all font-medium text-xs"
                                                                >
                                                                    <Eye className="w-3 h-3 mr-1" /> View
                                                                </Button>
                                                            </Link>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleUpdateStatus(vendor.id, "APPROVED")}
                                                                    className="h-7 px-2 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all font-medium text-xs"
                                                                >
                                                                    <Check className="w-3 h-3 mr-1" /> Approve
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleUpdateStatus(vendor.id, "REJECTED")}
                                                                    className="h-7 px-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all font-medium text-xs"
                                                                >
                                                                    <X className="w-3 h-3 mr-1" /> Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile Card View - Scrollable */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50">
                            {vendors.map((vendor, index) => (
                                <div key={vendor.id} className="border border-border rounded-lg p-3 space-y-3 bg-card shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 flex gap-2">
                                            <span className="text-muted-foreground font-medium text-xs mt-0.5">#{index + 1}</span>
                                            <div>
                                                <h3 className="font-medium text-foreground">{vendor.companyName || vendor.name || "Unknown"}</h3>
                                                <p className="text-xs text-muted-foreground mt-0.5">{vendor.address || vendor.location}</p>
                                            </div>
                                        </div>
                                        <Badge className={getStatusColor(vendor.status)}>
                                            {vendor.status || "Pending"}
                                        </Badge>
                                    </div>
                                    {/* Compact details for mobile */}
                                    <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                                        <div className="flex items-center gap-2">
                                            {vendor.rating && (
                                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded text-xs">
                                                    ★ {vendor.rating.toFixed(1)}
                                                </span>
                                            )}
                                            {vendor.aiScore && (
                                                <span className={`text-xs font-medium ${getScoreColor(vendor.aiScore)}`}>
                                                    Score: {vendor.aiScore}
                                                </span>
                                            )}
                                        </div>
                                        {vendor.status === 'APPROVED' ? (
                                            <Link href={`/crm/${vendor.id}`}>
                                                <button className="text-primary text-xs font-medium">View Details</button>
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => handleUpdateStatus(vendor.id, "APPROVED")}
                                                className="text-primary text-xs font-medium"
                                            >
                                                Approve
                                            </button>
                                        )}
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
