"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, ExternalLink } from "lucide-react";
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
            <Card className="shadow-sm h-full flex items-center justify-center border-indigo-100 bg-white/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                     <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                     <p className="text-sm text-gray-500 font-medium">Loading ecosystem...</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-indigo-100 h-full flex flex-col bg-white overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 py-3 px-4 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-indigo-900 text-lg">
                        <Users className="w-5 h-5 text-indigo-600" />
                        Vendor Pipeline 
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 ml-2">
                            {vendors.length}
                        </Badge>
                    </CardTitle>
                    {/* Add filters or actions here later */}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {vendors.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                        <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-gray-600">No vendors yet</p>
                        <p className="text-sm">Launch a campaign to start sourcing.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View - Scrollable */}
                        <div className="hidden md:block flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                                    <TableRow className="border-b border-gray-200 hover:bg-gray-50">
                                        <TableHead className="font-semibold text-gray-600 h-10">Vendor</TableHead>
                                        <TableHead className="font-semibold text-gray-600 h-10">Contact</TableHead>
                                        <TableHead className="font-semibold text-gray-600 h-10">Rating</TableHead>
                                        <TableHead className="font-semibold text-gray-600 h-10">AI Score</TableHead>
                                        <TableHead className="font-semibold text-gray-600 h-10">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-600 h-10 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendors.map((vendor) => (
                                        <TableRow key={vendor.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
                                            <TableCell className="py-3">
                                                <div>
                                                    <div className="font-medium text-gray-900">{vendor.companyName || vendor.name || "Unknown Vendor"}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{vendor.address || vendor.location}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="text-sm space-y-0.5">
                                                    {vendor.phone && <div className="text-gray-600">{vendor.phone}</div>}
                                                    {vendor.website && (
                                                        <a
                                                            href={vendor.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-medium"
                                                        >
                                                            Website <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                {vendor.rating ? (
                                                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full w-fit">
                                                        <span className="text-yellow-500 text-xs">★</span>
                                                        <span className="font-medium text-sm text-yellow-700">{vendor.rating.toFixed(1)}</span>
                                                        <span className="text-yellow-600/60 text-xs">
                                                            ({vendor.totalRatings || 0})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="flex flex-col">
                                                    <div className={getScoreColor(vendor.aiScore || vendor.fitScore)}>
                                                        {(vendor.aiScore || vendor.fitScore) ? `${vendor.aiScore || vendor.fitScore}/100` : "N/A"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Badge className={getStatusColor(vendor.status) + " shadow-none"}>
                                                    {vendor.status || "Pending"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2"
                                                        onClick={() => console.log("Approve", vendor.id)}
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                                        onClick={() => console.log("Reject", vendor.id)}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View - Scrollable */}
                        <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                            {vendors.map((vendor) => (
                                <div key={vendor.id} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">{vendor.companyName || vendor.name || "Unknown"}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{vendor.address || vendor.location}</p>
                                        </div>
                                        <Badge className={getStatusColor(vendor.status)}>
                                            {vendor.status || "Pending"}
                                        </Badge>
                                    </div>
                                    {/* Compact details for mobile */}
                                    <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                                         <div className="flex items-center gap-2">
                                             {vendor.rating && (
                                                <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded text-xs">
                                                    ★ {vendor.rating.toFixed(1)}
                                                </span>
                                             )}
                                             {vendor.aiScore && (
                                                 <span className={`text-xs font-medium ${getScoreColor(vendor.aiScore)}`}>
                                                     Score: {vendor.aiScore}
                                                 </span>
                                             )}
                                         </div>
                                         <button className="text-indigo-600 text-xs font-medium">Details</button>
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
