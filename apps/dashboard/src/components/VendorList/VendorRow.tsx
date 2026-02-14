
"use client";

import { Vendor } from "@xiri/shared";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Eye } from "lucide-react";
import Link from "next/link";
import { getStatusColor, getScoreColor } from "./utils";

interface VendorRowProps {
    vendor: Vendor;
    index: number;
    showActions: boolean;
    onUpdateStatus: (id: string, newStatus: Vendor['status']) => void;
}

export function VendorRow({ vendor, index, showActions, onUpdateStatus }: VendorRowProps) {
    return (
        <TableRow className="hover:bg-muted/50 transition-colors border-b border-border text-foreground">
            <TableCell className="py-2 text-center text-muted-foreground font-medium text-xs">
                {index + 1}
            </TableCell>
            <TableCell className="py-2">
                <Link href={`/crm/${vendor.id}`} className="block group cursor-pointer">
                    <div>
                        <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{vendor.businessName}</div>
                        <div className="text-[10px] text-muted-foreground">{vendor.address || "Unknown Location"}</div>
                    </div>
                </Link>
            </TableCell>
            <TableCell className="py-2 text-center">
                <div className="flex flex-wrap justify-center gap-1">
                    {vendor.capabilities?.slice(0, 2).map((cap, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {cap}
                        </Badge>
                    ))}
                    {vendor.capabilities?.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{vendor.capabilities.length - 2}</span>
                    )}
                </div>
            </TableCell>
            <TableCell className="py-2 text-center">
                <div className={`${getScoreColor(vendor.fitScore)} text-xs`}>
                    {vendor.fitScore ? `${vendor.fitScore}/100` : "N/A"}
                </div>
            </TableCell>
            <TableCell className="py-2 text-center">
                <Badge className={`${getStatusColor(vendor.status, vendor.outreachStatus)} shadow-none text-[10px] px-1.5 py-0 h-5`}>
                    {vendor.status === 'pending_review' ? 'Review Needed' :
                        vendor.status === 'compliance_review' ? 'Compliance' :
                            vendor.status.replace('_', ' ')}
                </Badge>
            </TableCell>
            <TableCell className="text-right py-2">
                {showActions && (
                    <div className="flex justify-center gap-1.5">
                        {vendor.status === 'pending_review' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'qualified')}
                                    className="h-7 px-2 border-green-200 text-green-700 hover:bg-green-600 hover:text-white transition-all font-medium text-xs"
                                >
                                    <Check className="w-3 h-3 mr-1" /> Qualify
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'rejected')}
                                    className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all font-medium text-xs"
                                >
                                    <X className="w-3 h-3 mr-1" /> Reject
                                </Button>
                            </>
                        ) : (
                            <Link href={`/crm/${vendor.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                    <Eye className="w-3 h-3 mr-1" /> Details
                                </Button>
                            </Link>
                        )}
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}
