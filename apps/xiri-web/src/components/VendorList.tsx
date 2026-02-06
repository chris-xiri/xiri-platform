"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, ExternalLink, Check, X } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
}

export default function VendorList() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const vendorData: Vendor[] = [];
                snapshot.forEach((doc) => {
                    vendorData.push({ id: doc.id, ...doc.data() } as Vendor);
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

    const getStatusColor = (status?: string) => {
        switch (status?.toLowerCase()) {
            case "qualified":
                return "bg-green-100 text-green-800 border-green-200";
            case "pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "rejected":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-gray-500";
        if (score >= 80) return "text-green-600 font-semibold";
        if (score >= 60) return "text-yellow-600 font-semibold";
        return "text-red-600 font-semibold";
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
                        Vendor Pipeline 
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-2 text-xs px-1.5 py-0">
                            {vendors.length}
                        </Badge>
                    </CardTitle>
                    {/* Add filters or actions here later */}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {vendors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No vendors yet</p>
                        <p className="text-sm">Launch a campaign to start sourcing.</p>
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
                                                    <div className="flex justify-center gap-1.5">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            className="h-7 px-2 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all font-medium text-xs"
                                                            onClick={() => console.log("Approve", vendor.id)}
                                                        >
                                                            <Check className="w-3 h-3 mr-1" /> Approve
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            className="h-7 px-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all font-medium text-xs"
                                                            onClick={() => console.log("Reject", vendor.id)}
                                                        >
                                                            <X className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
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
                                         <button className="text-primary text-xs font-medium">Details</button>
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
