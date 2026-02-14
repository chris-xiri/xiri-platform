
"use client";

import { Vendor } from "@xiri/shared";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getStatusColor, getScoreColor } from "./utils";

interface VendorCardProps {
    vendor: Vendor;
    index: number;
}

export function VendorCard({ vendor, index }: VendorCardProps) {
    return (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-card shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1 flex gap-2">
                    <span className="text-muted-foreground font-medium text-xs mt-0.5">#{index + 1}</span>
                    <div>
                        <h3 className="font-medium text-foreground">{vendor.businessName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{vendor.address}</p>
                    </div>
                </div>
                <Badge className={getStatusColor(vendor.status, vendor.outreachStatus)}>
                    {vendor.status.replace('_', ' ')}
                </Badge>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${getScoreColor(vendor.fitScore)}`}>
                        Score: {vendor.fitScore || "N/A"}
                    </span>
                </div>
                <Link href={`/crm/${vendor.id}`}>
                    <button className="text-primary text-xs font-medium">View Details</button>
                </Link>
            </div>
        </div>
    );
}
