"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, ExternalLink } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Vendor {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    totalRatings?: number;
    aiScore?: number;
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
            <Card className="shadow-lg">
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Users className="w-5 h-5" />
                    Vendor Pipeline ({vendors.length})
                </CardTitle>
                <CardDescription>
                    AI-qualified vendor leads from your campaigns
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {vendors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No vendors yet</p>
                        <p className="text-sm">Launch a campaign to start sourcing vendors</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="font-semibold">Vendor</TableHead>
                                        <TableHead className="font-semibold">Contact</TableHead>
                                        <TableHead className="font-semibold">Rating</TableHead>
                                        <TableHead className="font-semibold">AI Score</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendors.map((vendor) => (
                                        <TableRow key={vendor.id} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-gray-900">{vendor.name}</div>
                                                    <div className="text-sm text-gray-500">{vendor.address}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {vendor.phone && <div>{vendor.phone}</div>}
                                                    {vendor.website && (
                                                        <a
                                                            href={vendor.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                        >
                                                            Website <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {vendor.rating ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-yellow-500">★</span>
                                                        <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                                                        <span className="text-gray-400 text-sm">
                                                            ({vendor.totalRatings || 0})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className={getScoreColor(vendor.aiScore)}>
                                                    {vendor.aiScore ? `${vendor.aiScore}/100` : "N/A"}
                                                </div>
                                                {vendor.aiReasoning && (
                                                    <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                                                        {vendor.aiReasoning}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getStatusColor(vendor.status)}>
                                                    {vendor.status || "Pending"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                                                    View Details
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                            {vendors.map((vendor) => (
                                <div key={vendor.id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                                            <p className="text-sm text-gray-500">{vendor.address}</p>
                                        </div>
                                        <Badge className={getStatusColor(vendor.status)}>
                                            {vendor.status || "Pending"}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-500">Rating:</span>
                                            {vendor.rating ? (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-yellow-500">★</span>
                                                    <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                                                    <span className="text-gray-400">({vendor.totalRatings || 0})</span>
                                                </div>
                                            ) : (
                                                <div className="text-gray-400 mt-1">N/A</div>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-gray-500">AI Score:</span>
                                            <div className={`mt-1 ${getScoreColor(vendor.aiScore)}`}>
                                                {vendor.aiScore ? `${vendor.aiScore}/100` : "N/A"}
                                            </div>
                                        </div>
                                    </div>

                                    {vendor.phone && (
                                        <div className="text-sm">
                                            <span className="text-gray-500">Phone:</span> {vendor.phone}
                                        </div>
                                    )}

                                    {vendor.website && (
                                        <a
                                            href={vendor.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                                        >
                                            Visit Website <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}

                                    {vendor.aiReasoning && (
                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                            {vendor.aiReasoning}
                                        </div>
                                    )}

                                    <button className="w-full text-indigo-600 hover:text-indigo-800 text-sm font-medium py-2 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors">
                                        View Details
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
